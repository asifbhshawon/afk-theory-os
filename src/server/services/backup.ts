import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { pool } from "@/db";

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

// Pure Node.js database fallback if pg_dump and docker are unavailable
async function exportDatabaseNodeFallback(outputPath: string): Promise<void> {
  const client = await pool.connect();
  try {
    const tableRes = await client.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema IN ('public', 'drizzle') AND table_type = 'BASE TABLE'
      ORDER BY table_schema, table_name
    `);

    let sql = "-- ==========================================================\n";
    sql += "-- AFK THEORY BUSINESS OS Logical Backup (Node DB Fallback)\n";
    sql += `-- Generated: ${new Date().toISOString()}\n`;
    sql += "-- ==========================================================\n\n";

    for (const row of tableRes.rows) {
      const { table_schema, table_name } = row;
      const fullTableName = `"${table_schema}"."${table_name}"`;

      const rowsRes = await client.query(`SELECT * FROM ${fullTableName}`);
      if (rowsRes.rows.length === 0) continue;

      sql += `-- Table: ${fullTableName} (${rowsRes.rows.length} rows)\n`;
      const cols = Object.keys(rowsRes.rows[0]);
      const colList = cols.map((c) => `"${c}"`).join(", ");

      for (const r of rowsRes.rows) {
        const valList = cols
          .map((c) => {
            const v = r[c];
            if (v === null || v === undefined) return "NULL";
            if (typeof v === "number" || typeof v === "boolean") return String(v);
            if (Buffer.isBuffer(v)) return `'\\x${v.toString("hex")}'`;
            if (v instanceof Date) return `'${v.toISOString()}'`;
            if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
            return `'${String(v).replace(/'/g, "''")}'`;
          })
          .join(", ");
        sql += `INSERT INTO ${fullTableName} (${colList}) VALUES (${valList}) ON CONFLICT DO NOTHING;\n`;
      }
      sql += "\n";
    }

    fs.writeFileSync(outputPath, sql, "utf8");
  } finally {
    client.release();
  }
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
  const dbUrl =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/afk_business_os";

  let parsedHost = "localhost";
  let parsedPort = "5432";
  let parsedUser = "postgres";
  let parsedPassword = "";
  let parsedDb = "afk_business_os";

  try {
    const url = new URL(dbUrl);
    parsedHost = url.hostname || "localhost";
    parsedPort = url.port || "5432";
    parsedUser = decodeURIComponent(url.username || "postgres");
    parsedPassword = decodeURIComponent(url.password || "");
    parsedDb = url.pathname.replace(/^\//, "") || "afk_business_os";
  } catch {
    // Keep defaults
  }

  try {
    // 1. Export PostgreSQL schema + data
    let dumpSuccess = false;
    const dumpErrors: string[] = [];

    // Strategy 1: Direct pg_dump with connection flags or URI
    try {
      execSync(
        `pg_dump -h "${parsedHost}" -p "${parsedPort}" -U "${parsedUser}" -d "${parsedDb}" -f "${rawDumpPath}"`,
        {
          stdio: "pipe",
          timeout: 60000,
          env: {
            ...process.env,
            PGPASSWORD: parsedPassword,
          },
        }
      );
      if (fs.existsSync(rawDumpPath) && fs.statSync(rawDumpPath).size > 0) {
        dumpSuccess = true;
      }
    } catch (e1: any) {
      dumpErrors.push(`pg_dump flags: ${e1.message}`);
      try {
        execSync(`pg_dump -d "${dbUrl}" -f "${rawDumpPath}"`, {
          stdio: "pipe",
          timeout: 60000,
          env: {
            ...process.env,
            PGPASSWORD: parsedPassword,
          },
        });
        if (fs.existsSync(rawDumpPath) && fs.statSync(rawDumpPath).size > 0) {
          dumpSuccess = true;
        }
      } catch (e2: any) {
        dumpErrors.push(`pg_dump URI: ${e2.message}`);
      }
    }

    // Strategy 2: Docker exec pg_dump (when running on host with Docker available)
    if (!dumpSuccess) {
      try {
        execSync(
          `docker exec ${container} pg_dump -U postgres afk_business_os > "${rawDumpPath}"`,
          { stdio: "pipe", timeout: 60000 }
        );
        if (fs.existsSync(rawDumpPath) && fs.statSync(rawDumpPath).size > 0) {
          dumpSuccess = true;
        }
      } catch (e3: any) {
        dumpErrors.push(`docker exec: ${e3.message}`);
      }
    }

    // Strategy 3: Pure Node.js fallback via active database pool
    if (!dumpSuccess) {
      try {
        await exportDatabaseNodeFallback(rawDumpPath);
        if (fs.existsSync(rawDumpPath) && fs.statSync(rawDumpPath).size > 0) {
          dumpSuccess = true;
        }
      } catch (e4: any) {
        dumpErrors.push(`node fallback: ${e4.message}`);
        throw new Error(`Database dump failed across all strategies: ${dumpErrors.join("; ")}`);
      }
    }

    if (!fs.existsSync(rawDumpPath)) {
      throw new Error(`Database dump file was not generated: ${rawDumpPath}`);
    }

    const rawData = fs.readFileSync(rawDumpPath);
    const rawSha256 = crypto.createHash("sha256").update(rawData).digest("hex");

    // 2. Perform AES-256-GCM Authenticated Encryption
    const encResult = encryptBuffer(rawData, password);
    fs.writeFileSync(encDumpPath, encResult.encrypted);

    // Securely delete plaintext dump after encryption
    fs.unlinkSync(rawDumpPath);

    // 3. Copy storage directory documents and evidence recursively if present
    const backupDocsDir = path.join(backupFolder, "documents");
    fs.mkdirSync(backupDocsDir, { recursive: true });
    let docCount = 0;

    function copyDirRecursive(src: string, dest: string) {
      if (!fs.existsSync(src)) return;
      fs.mkdirSync(dest, { recursive: true });
      const entries = fs.readdirSync(src, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
          copyDirRecursive(srcPath, destPath);
        } else if (entry.isFile()) {
          fs.copyFileSync(srcPath, destPath);
          docCount++;
        }
      }
    }

    if (fs.existsSync(storageDir)) {
      copyDirRecursive(storageDir, backupDocsDir);
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
