import { db } from "@/db";
import { auditLogs, settings } from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import { BackupButton } from "@/components/BackupButton";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const recentLogs = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(20);

  const dbRes = await db.execute(sql`SELECT current_database() as db_name, version() as version`);
  const dbStatus = dbRes.rows[0] as { db_name: string; version: string } | undefined;

  return (
    <div className="space-y-6">
      <div className="pb-2 border-b border-afk-border">
        <h2 className="text-xl font-bold tracking-tight text-afk-offwhite">System Health & Operations</h2>
        <p className="text-xs text-afk-muted mt-0.5">
          Local backup execution, database health, audit center, and PowerShell recovery runbooks.
        </p>
      </div>

      {/* Backup & System Health Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Local Backup Control Panel */}
        <div className="bg-afk-charcoal p-5 rounded-lg border border-afk-border flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-afk-offwhite">Local Encrypted Backup</h3>
              <span className="text-[10px] px-2 py-0.5 rounded bg-afk-olive-dark text-afk-olive-accent font-mono">
                Logical pg_dump + SHA256
              </span>
            </div>
            <p className="text-xs text-afk-muted leading-relaxed">
              Backs up all PostgreSQL database tables, uploaded documents, configuration, and SHA256 integrity checksums to a durable local folder.
            </p>
            <div className="mt-4 p-3 bg-afk-surface rounded border border-afk-border text-xs font-mono space-y-1">
              <div className="flex justify-between">
                <span className="text-afk-muted">Target Directory:</span>
                <span className="text-afk-offwhite font-medium">./backups</span>
              </div>
              <div className="flex justify-between">
                <span className="text-afk-muted">Encryption:</span>
                <span className="text-afk-success font-medium">SHA-256 Verified</span>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <BackupButton />
          </div>
        </div>

        {/* PostgreSQL Database Diagnostics */}
        <div className="bg-afk-charcoal p-5 rounded-lg border border-afk-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-afk-offwhite">PostgreSQL Diagnostics</h3>
            <span className="text-[10px] px-2 py-0.5 rounded bg-afk-olive-dark text-afk-success font-mono">
              HEALTHY
            </span>
          </div>
          <p className="text-xs text-afk-muted mb-4">
            Authoritative transactional store running in durable Docker volume.
          </p>

          <div className="space-y-2 text-xs font-mono">
            <div className="p-2.5 bg-afk-surface rounded border border-afk-border flex justify-between">
              <span className="text-afk-muted">Database:</span>
              <span className="text-afk-offwhite font-bold">{String(dbStatus?.db_name || "afk_business_os")}</span>
            </div>
            <div className="p-2.5 bg-afk-surface rounded border border-afk-border flex justify-between">
              <span className="text-afk-muted">Driver:</span>
              <span className="text-afk-offwhite">Drizzle ORM + node-postgres</span>
            </div>
            <div className="p-2.5 bg-afk-surface rounded border border-afk-border text-[10px] text-afk-muted truncate">
              {String(dbStatus?.version || "PostgreSQL 16")}
            </div>
          </div>
        </div>
      </div>

      {/* PowerShell Runbook Commands */}
      <div className="bg-afk-charcoal p-5 rounded-lg border border-afk-border">
        <h3 className="text-sm font-semibold text-afk-offwhite mb-2">Windows PowerShell Management Commands</h3>
        <p className="text-xs text-afk-muted mb-4">
          All operations can be executed directly from Windows PowerShell in the project directory:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
          <div className="p-3 bg-afk-surface rounded border border-afk-border">
            <span className="text-afk-olive-accent font-bold">1. Start System (Safe Docker):</span>
            <pre className="text-afk-offwhite mt-1">.\scripts\start.ps1</pre>
          </div>
          <div className="p-3 bg-afk-surface rounded border border-afk-border">
            <span className="text-afk-olive-accent font-bold">2. Check Status & Health:</span>
            <pre className="text-afk-offwhite mt-1">.\scripts\status.ps1</pre>
          </div>
          <div className="p-3 bg-afk-surface rounded border border-afk-border">
            <span className="text-afk-olive-accent font-bold">3. Run Local Backup:</span>
            <pre className="text-afk-offwhite mt-1">.\scripts\backup.ps1 -Destination "E:\AFK-Backups"</pre>
          </div>
          <div className="p-3 bg-afk-surface rounded border border-afk-border">
            <span className="text-afk-olive-accent font-bold">4. Isolated Restore Test:</span>
            <pre className="text-afk-offwhite mt-1">.\scripts\restore.ps1 -BackupPath "..." -Isolated</pre>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-afk-charcoal rounded-lg border border-afk-border p-5">
        <h3 className="text-sm font-semibold text-afk-offwhite mb-3">Immutable Audit Trail</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-afk-border text-afk-muted">
                <th className="py-2 font-medium">Timestamp</th>
                <th className="py-2 font-medium">Action</th>
                <th className="py-2 font-medium">Entity</th>
                <th className="py-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-afk-border/40">
              {recentLogs.map((log) => (
                <tr key={log.id} className="hover:bg-afk-surface/30 transition">
                  <td className="py-2 font-mono text-afk-muted">
                    {new Date(log.createdAt).toLocaleString("en-BD", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="py-2 font-mono text-afk-olive-accent font-medium">{log.action}</td>
                  <td className="py-2 font-mono text-afk-muted">{log.entityType}</td>
                  <td className="py-2 text-afk-offwhite max-w-md truncate">{log.details || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
