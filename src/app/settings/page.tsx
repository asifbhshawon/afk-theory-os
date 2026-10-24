import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import { SettingsClientView } from "@/components/settings/SettingsClientView";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "System Health & Backups | AFK THEORY Business OS",
  description: "PostgreSQL status, local encrypted backups, and disaster recovery runbooks",
};

export default async function SettingsPage() {
  const recentLogs = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      details: auditLogs.details,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(20);

  const dbRes = await db.execute(sql`SELECT current_database() as db_name, version() as version`);
  const dbStatus = dbRes.rows[0] as { db_name: string; version: string } | undefined;

  // Scan ./backups directory for real verified backups
  const backupsDir = path.resolve(process.cwd(), "backups");
  const backupHistory: any[] = [];

  if (fs.existsSync(backupsDir)) {
    const entries = fs.readdirSync(backupsDir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.isDirectory() && ent.name.startsWith("AFK-BACKUP-")) {
        const fullPath = path.join(backupsDir, ent.name);
        const stats = fs.statSync(fullPath);
        const files = fs.readdirSync(fullPath);

        let totalSize = 0;
        for (const f of files) {
          try {
            const fStat = fs.statSync(path.join(fullPath, f));
            totalSize += fStat.size;
          } catch {
            // ignore
          }
        }

        backupHistory.push({
          id: ent.name,
          name: ent.name,
          dateStr: stats.mtime.toLocaleDateString("en-BD", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          mtime: stats.mtime.getTime(),
          sizeBytes: totalSize,
          hasManifest: files.includes("manifest.json"),
          hasEncryptedDb: files.some((f) => f.endsWith(".sql.enc")),
        });
      }
    }
  }

  // Sort newest first
  backupHistory.sort((a, b) => b.mtime - a.mtime);

  return (
    <div className="space-y-6">
      <SettingsClientView
        dbName={String(dbStatus?.db_name || "afk_business_os")}
        pgVersion={String(dbStatus?.version || "PostgreSQL 16")}
        backupHistory={backupHistory}
        recentLogs={recentLogs}
      />
    </div>
  );
}
