import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface BackupResult {
  backupId: string;
  timestamp: string;
  archivePath: string;
  checksum: string;
  fileSizeBytes: number;
  dbDumpName: string;
  documentCount: number;
  encrypted: boolean;
  success: boolean;
  error?: string;
}

// Detect the running PostgreSQL container dynamically
export function getPostgresContainer(): string {
  if (process.env.DB_CONTAINER) return process.env.DB_CONTAINER;
  try {
    const containers = execSync("docker ps --format {{.Names}}", { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
    if (containers.includes("afk_business_os_db")) return "afk_business_os_db";
    if (containers.includes("afk-theory-postgres")) return "afk-theory-postgres";
  } catch {
    // Ignore error if docker command fails
  }
  return "afk-theory-postgres";
}

// AES-256-GCM Authenticated Encryption for backup payload
export function encryptBuffer(data: Buffer, password: string): { encrypted: Buffer; salt: string; iv: string; authTag: string } {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 32);
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    salt: salt.toString("hex"),
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

// AES-256-GCM Authenticated Decryption
export function decryptBuffer(encrypted: Buffer, password: string, saltHex: string, ivHex: string, authTagHex: string): Buffer {
  const salt = Buffer.from(saltHex, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const key = crypto.scryptSync(password, salt, 32);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

// Generate full logical backup of PostgreSQL database + documents + authenticated encryption
export async function createLocalBackup(
  destinationDir?: string,
  encryptionPassword?: string,
  keepCount: number = 7
): Promise<BackupResult> {
  const targetDir = destinationDir || process.env.BACKUP_DIR || "./backups";
  const storageDir = process.env.STORAGE_DIR || "./storage";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupId = `AFK-BACKUP-${timestamp}`;
  const password = encryptionPassword || process.env.RESTIC_PASSWORD || "afk-theory-secure-local-backup-key-2026";

  const backupFolder = path.join(targetDir, backupId);
  fs.mkdirSync(backupFolder, { recursive: true });

  const rawDumpPath = path.join(backupFolder, "database.sql");
  const encDumpPath = path.join(backupFolder, "database.sql.enc");
  const container = getPostgresContainer();

  try {
    // 1. Export PostgreSQL schema + data
    try {
      execSync(
        `docker exec ${container} pg_dump -U postgres afk_business_os > "${rawDumpPath}"`,
        { stdio: "pipe", timeout: 45000 }
      );
    } catch {
      // Fallback: run local pg_dump directly
      execSync(`pg_dump -U postgres afk_business_os > "${rawDumpPath}"`, {
        stdio: "pipe",
        timeout: 45000,
      });
    }

    const rawData = fs.readFileSync(rawDumpPath);
    const rawSha256 = crypto.createHash("sha256").update(rawData).digest("hex");

    // 2. Perform AES-256-GCM Authenticated Encryption
    const encResult = encryptBuffer(rawData, password);
    fs.writeFileSync(encDumpPath, encResult.encrypted);

    // Securely delete plaintext dump after encryption
    fs.unlinkSync(rawDumpPath);

    // 3. Copy storage directory documents if present
    const backupDocsDir = path.join(backupFolder, "documents");
    fs.mkdirSync(backupDocsDir, { recursive: true });
    let docCount = 0;

    if (fs.existsSync(storageDir)) {
      const files = fs.readdirSync(storageDir);
      for (const f of files) {
        const src = path.join(storageDir, f);
        if (fs.statSync(src).isFile()) {
          fs.copyFileSync(src, path.join(backupDocsDir, f));
          docCount++;
        }
      }
    }

    // 4. Create manifest with SHA256 and authenticated encryption metadata
    const manifest = {
      backupId,
      timestamp: new Date().toISOString(),
      businessName: "AFK THEORY",
      version: "1.0",
      database: {
        file: "database.sql.enc",
        originalSizeBytes: rawData.length,
        encryptedSizeBytes: encResult.encrypted.length,
        originalSha256: rawSha256,
      },
      encryption: {
        algorithm: "aes-256-gcm",
        salt: encResult.salt,
        iv: encResult.iv,
        authTag: encResult.authTag,
        authenticated: true,
      },
      documentCount: docCount,
      environment: process.env.NODE_ENV || "production",
      containerUsed: container,
    };

    const manifestPath = path.join(backupFolder, "manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    // 5. Automatic backup rotation (keep last N backups)
    try {
      rotateBackups(targetDir, keepCount);
    } catch {
      // Non-fatal if rotation fails
    }

    return {
      backupId,
      timestamp: manifest.timestamp,
      archivePath: backupFolder,
      checksum: rawSha256,
      fileSizeBytes: encResult.encrypted.length,
      dbDumpName: "database.sql.enc",
      documentCount: docCount,
      encrypted: true,
      success: true,
    };
  } catch (err: any) {
    return {
      backupId,
      timestamp: new Date().toISOString(),
      archivePath: backupFolder,
      checksum: "",
      fileSizeBytes: 0,
      dbDumpName: "",
      documentCount: 0,
      encrypted: false,
      success: false,
      error: err.message,
    };
  }
}

// Decrypt and extract backup contents for verification or restore
export function decryptBackup(backupDir: string, password?: string): { rawDumpPath: string; manifest: any } {
  const manifestPath = path.join(backupDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest file not found: ${manifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const pass = password || process.env.RESTIC_PASSWORD || "afk-theory-secure-local-backup-key-2026";
  const encFile = path.join(backupDir, manifest.database.file);

  if (!fs.existsSync(encFile)) {
    throw new Error(`Encrypted database file not found: ${encFile}`);
  }

  const encData = fs.readFileSync(encFile);
  const decrypted = decryptBuffer(
    encData,
    pass,
    manifest.encryption.salt,
    manifest.encryption.iv,
    manifest.encryption.authTag
  );

  // Verify SHA256 matches manifest
  const decHash = crypto.createHash("sha256").update(decrypted).digest("hex");
  if (decHash !== manifest.database.originalSha256) {
    throw new Error(
      `Decrypted payload checksum mismatch! Expected ${manifest.database.originalSha256}, got ${decHash}`
    );
  }

  const outPath = path.join(backupDir, "database.sql");
  fs.writeFileSync(outPath, decrypted);

  return { rawDumpPath: outPath, manifest };
}

// Rotate old backups keeping latest `keepCount`
export function rotateBackups(targetDir: string, keepCount: number = 7) {
  if (!fs.existsSync(targetDir)) return;
  const entries = fs
    .readdirSync(targetDir)
    .filter((f) => f.startsWith("AFK-BACKUP-"))
    .map((f) => ({
      name: f,
      fullPath: path.join(targetDir, f),
      time: fs.statSync(path.join(targetDir, f)).mtimeMs,
    }))
    .sort((a, b) => b.time - a.time);

  if (entries.length > keepCount) {
    const toRemove = entries.slice(keepCount);
    for (const item of toRemove) {
      try {
        fs.rmSync(item.fullPath, { recursive: true, force: true });
      } catch {
        // Silently continue
      }
    }
  }
}
