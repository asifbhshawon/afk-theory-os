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
  success: boolean;
  error?: string;
}

// Generate full logical backup of PostgreSQL database + documents + manifest
export async function createLocalBackup(destinationDir?: string): Promise<BackupResult> {
  const targetDir = destinationDir || process.env.BACKUP_DIR || "./backups";
  const storageDir = process.env.STORAGE_DIR || "./storage";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupId = `AFK-BACKUP-${timestamp}`;

  const backupFolder = path.join(targetDir, backupId);
  fs.mkdirSync(backupFolder, { recursive: true });

  const dbDumpPath = path.join(backupFolder, "database.sql");

  try {
    // 1. Export PostgreSQL schema + data
    // Use pg_dump if available or docker exec pg_dump
    try {
      execSync(
        `docker exec afk-theory-postgres pg_dump -U postgres afk_business_os > "${dbDumpPath}"`,
        { stdio: "pipe", timeout: 30000 }
      );
    } catch {
      // Fallback: run local pg_dump directly
      execSync(`pg_dump -U postgres afk_business_os > "${dbDumpPath}"`, {
        stdio: "pipe",
        timeout: 30000,
      });
    }

    // 2. Copy storage directory documents if present
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

    // 3. Create manifest with SHA256 hashes
    const dbHash = crypto
      .createHash("sha256")
      .update(fs.readFileSync(dbDumpPath))
      .digest("hex");

    const manifest = {
      backupId,
      timestamp: new Date().toISOString(),
      businessName: "AFK THEORY",
      version: "1.0",
      database: {
        file: "database.sql",
        sha256: dbHash,
        sizeBytes: fs.statSync(dbDumpPath).size,
      },
      documentCount: docCount,
      environment: process.env.NODE_ENV || "production",
    };

    const manifestPath = path.join(backupFolder, "manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    const folderStats = fs.statSync(dbDumpPath);

    return {
      backupId,
      timestamp: manifest.timestamp,
      archivePath: backupFolder,
      checksum: dbHash,
      fileSizeBytes: folderStats.size,
      dbDumpName: "database.sql",
      documentCount: docCount,
      success: true,
    };
  } catch (err: any) {
    return {
      backupId,
      timestamp: new Date().toISOString(),
      archivePath: backupFolder,
      checksum: "",
      fileSizeBytes: 0,
      dbDumpName: "database.sql",
      documentCount: 0,
      success: false,
      error: err.message || String(err),
    };
  }
}

// Verify backup manifest and checksums
export function verifyBackup(backupFolderPath: string): {
  isValid: boolean;
  manifest?: any;
  error?: string;
} {
  try {
    const manifestPath = path.join(backupFolderPath, "manifest.json");
    if (!fs.existsSync(manifestPath)) {
      return { isValid: false, error: "Manifest file missing from backup." };
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    const dbDumpPath = path.join(backupFolderPath, manifest.database.file);

    if (!fs.existsSync(dbDumpPath)) {
      return { isValid: false, error: "Database dump file missing." };
    }

    const calculatedHash = crypto
      .createHash("sha256")
      .update(fs.readFileSync(dbDumpPath))
      .digest("hex");

    if (calculatedHash !== manifest.database.sha256) {
      return {
        isValid: false,
        error: `Checksum mismatch! Expected: ${manifest.database.sha256}, Actual: ${calculatedHash}`,
      };
    }

    return { isValid: true, manifest };
  } catch (err: any) {
    return { isValid: false, error: err.message };
  }
}
