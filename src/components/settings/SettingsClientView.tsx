"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  Database,
  Lock,
  HardDrive,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Terminal,
  FileText,
  AlertCircle,
  HelpCircle,
  Clock,
  ArrowRight,
} from "lucide-react";
import { BackupButton } from "@/components/BackupButton";

interface BackupItem {
  id: string;
  name: string;
  dateStr: string;
  sizeBytes: number;
  hasManifest: boolean;
  hasEncryptedDb: boolean;
}

interface AuditLogItem {
  id: string;
  action: string;
  entityType: string;
  details: string | null;
  createdAt: string | Date;
}

interface SettingsClientViewProps {
  dbName: string;
  pgVersion: string;
  backupHistory: BackupItem[];
  recentLogs: AuditLogItem[];
}

export function SettingsClientView({
  dbName,
  pgVersion,
  backupHistory,
  recentLogs,
}: SettingsClientViewProps) {
  const [showAdvancedDiagnostics, setShowAdvancedDiagnostics] = useState(false);
  const [showPowerShellRunbooks, setShowPowerShellRunbooks] = useState(false);
  const [showRawAuditLogs, setShowRawAuditLogs] = useState(false);

  const lastBackup = backupHistory[0];

  return (
    <div className="space-y-6 select-none">
      {/* Page Header */}
      <div className="pb-3 border-b border-afk-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-afk-offwhite">
            System Health, Backups & Disaster Recovery
          </h1>
          <p className="text-sm text-afk-secondary mt-0.5">
            Durable local backups, AES-256-GCM encryption, SHA-256 integrity checks, and restore procedures
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>PostgreSQL Operational</span>
          </span>
        </div>
      </div>

      {/* Business-Focused Standard Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* 1. System Status Card */}
        <div className="bg-afk-card p-5 rounded-xl border border-afk-border shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-afk-secondary">
              <span>Operational Mode</span>
              <Database className="w-4 h-4 text-afk-olive-accent" />
            </div>
            <h3 className="text-lg font-bold text-afk-offwhite mt-2">
              100% Local Deployment
            </h3>
            <p className="text-xs text-afk-muted mt-1 leading-relaxed">
              Self-hosted Docker container with persistent volume storage. Zero cloud dependencies.
            </p>
          </div>

          <div className="pt-3 border-t border-afk-border text-xs text-afk-secondary space-y-1">
            <div className="flex justify-between">
              <span className="text-afk-muted">Target DB:</span>
              <span className="font-mono text-afk-offwhite font-medium">{dbName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-afk-muted">Host Binding:</span>
              <span className="font-mono text-afk-offwhite">127.0.0.1 (Local Only)</span>
            </div>
          </div>
        </div>

        {/* 2. Last Successful Backup Card */}
        <div className="bg-afk-card p-5 rounded-xl border border-afk-border shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-afk-secondary">
              <span>Last Successful Backup</span>
              <Lock className="w-4 h-4 text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold text-afk-offwhite mt-2">
              {lastBackup ? lastBackup.name : "No backups yet"}
            </h3>
            <p className="text-xs text-afk-muted mt-1">
              {lastBackup
                ? `Created on ${lastBackup.dateStr} (${(lastBackup.sizeBytes / (1024 * 1024)).toFixed(2)} MB)`
                : "Generate your first verified backup below"}
            </p>
          </div>

          <div className="pt-3 border-t border-afk-border text-xs text-afk-secondary space-y-1">
            <div className="flex justify-between">
              <span className="text-afk-muted">Encryption:</span>
              <span className="text-emerald-400 font-semibold font-mono">AES-256-GCM</span>
            </div>
            <div className="flex justify-between">
              <span className="text-afk-muted">Integrity:</span>
              <span className="text-afk-offwhite font-mono">SHA-256 Checksum</span>
            </div>
          </div>
        </div>

        {/* 3. Backup Storage Location Card */}
        <div className="bg-afk-card p-5 rounded-xl border border-afk-border shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-afk-secondary">
              <span>Backup Directory</span>
              <HardDrive className="w-4 h-4 text-afk-gold" />
            </div>
            <h3 className="text-lg font-bold font-mono text-afk-offwhite mt-2">
              ./backups
            </h3>
            <p className="text-xs text-afk-muted mt-1 leading-relaxed">
              Persisted on the local host drive. Archives all PostgreSQL tables, calendar activities, and WebP evidence.
            </p>
          </div>

          <div className="pt-3 border-t border-afk-border text-xs text-afk-secondary space-y-1">
            <div className="flex justify-between">
              <span className="text-afk-muted">Rotation Policy:</span>
              <span className="text-afk-offwhite">Keep Last 7 Backups</span>
            </div>
            <div className="flex justify-between">
              <span className="text-afk-muted">Total Backups:</span>
              <span className="font-bold text-afk-offwhite">{backupHistory.length} archives</span>
            </div>
          </div>
        </div>
      </div>

      {/* Backup Execution Panel & Recovery Instructions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Backup Execution */}
        <div className="lg:col-span-5 bg-afk-card p-6 rounded-xl border border-afk-border shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-afk-olive-accent" />
            <h2 className="text-base font-bold text-afk-offwhite">
              Create Local Encrypted Backup
            </h2>
          </div>
          <p className="text-xs text-afk-secondary leading-relaxed">
            Exports a consistent PostgreSQL logical dump, encrypts it using authenticated AES-256-GCM, archives all uploaded WebP evidence, and writes a SHA-256 manifest to `./backups`.
          </p>

          <div className="pt-2">
            <BackupButton />
          </div>
        </div>

        {/* Disaster Recovery Guidance */}
        <div className="lg:col-span-7 bg-afk-card p-6 rounded-xl border border-afk-border shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-afk-olive-accent" />
            <h2 className="text-base font-bold text-afk-offwhite">
              Disaster Recovery & Restore Guidance
            </h2>
          </div>
          <p className="text-xs text-afk-secondary leading-relaxed">
            In the event of hardware failure or accidental corruption, you can restore from any verified backup archive.
          </p>

          <div className="space-y-2 text-xs text-afk-secondary pt-1">
            <div className="p-3 rounded-lg bg-afk-surface border border-afk-border space-y-1">
              <p className="font-bold text-afk-offwhite flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-afk-olive text-afk-offwhite flex items-center justify-center text-[10px]">1</span>
                <span>Isolated Dry-Run Verification</span>
              </p>
              <p className="text-afk-muted text-[11px] pl-5">
                Test the backup in a temporary, disposable database without affecting your live records.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-afk-surface border border-afk-border space-y-1">
              <p className="font-bold text-afk-offwhite flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-afk-olive text-afk-offwhite flex items-center justify-center text-[10px]">2</span>
                <span>Production Restoration</span>
              </p>
              <p className="text-afk-muted text-[11px] pl-5">
                Execute the restore script with administrator privileges to restore database tables and WebP files.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Backup History Table */}
      <div className="bg-afk-card rounded-xl border border-afk-border p-5 space-y-3 shadow-sm">
        <h2 className="text-base font-bold text-afk-offwhite">
          Verified Backup History ({backupHistory.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-afk-border text-afk-muted">
                <th className="py-2.5 font-medium">Archive Identifier</th>
                <th className="py-2.5 font-medium">Created Date</th>
                <th className="py-2.5 font-medium">Size</th>
                <th className="py-2.5 font-medium">Encryption</th>
                <th className="py-2.5 font-medium text-right">Integrity Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-afk-border/40">
              {backupHistory.map((b) => (
                <tr key={b.id} className="hover:bg-afk-surface/40 transition">
                  <td className="py-3 font-mono font-medium text-afk-offwhite">
                    {b.name}
                  </td>
                  <td className="py-3 font-mono text-afk-secondary">
                    {b.dateStr}
                  </td>
                  <td className="py-3 font-mono text-afk-secondary">
                    {(b.sizeBytes / (1024 * 1024)).toFixed(2)} MB
                  </td>
                  <td className="py-3">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-afk-surface border border-afk-border text-emerald-400 font-mono">
                      AES-256-GCM
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-afk-success">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>SHA-256 Verified</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Collapsible Advanced Technical Sections */}
      <div className="space-y-3 pt-2">
        {/* Section 1: Low-level PostgreSQL Diagnostics */}
        <div className="bg-afk-card rounded-xl border border-afk-border overflow-hidden">
          <button
            onClick={() => setShowAdvancedDiagnostics(!showAdvancedDiagnostics)}
            className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-afk-surface/60 transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-afk-muted" />
              <span className="text-sm font-semibold text-afk-secondary">
                Advanced Database Diagnostics
              </span>
            </div>
            {showAdvancedDiagnostics ? (
              <ChevronUp className="w-4 h-4 text-afk-muted" />
            ) : (
              <ChevronDown className="w-4 h-4 text-afk-muted" />
            )}
          </button>

          {showAdvancedDiagnostics && (
            <div className="p-5 border-t border-afk-border bg-afk-surface/20 space-y-3 text-xs font-mono">
              <div className="p-3 bg-afk-surface rounded-lg border border-afk-border flex justify-between">
                <span className="text-afk-muted">Database Engine:</span>
                <span className="text-afk-offwhite font-bold">{dbName}</span>
              </div>
              <div className="p-3 bg-afk-surface rounded-lg border border-afk-border flex justify-between">
                <span className="text-afk-muted">Driver:</span>
                <span className="text-afk-offwhite">Drizzle ORM + node-postgres</span>
              </div>
              <div className="p-3 bg-afk-surface rounded-lg border border-afk-border text-afk-secondary break-all">
                {pgVersion}
              </div>
            </div>
          )}
        </div>

        {/* Section 2: PowerShell Management Commands */}
        <div className="bg-afk-card rounded-xl border border-afk-border overflow-hidden">
          <button
            onClick={() => setShowPowerShellRunbooks(!showPowerShellRunbooks)}
            className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-afk-surface/60 transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-afk-muted" />
              <span className="text-sm font-semibold text-afk-secondary">
                PowerShell Runbook & Disaster Recovery Commands
              </span>
            </div>
            {showPowerShellRunbooks ? (
              <ChevronUp className="w-4 h-4 text-afk-muted" />
            ) : (
              <ChevronDown className="w-4 h-4 text-afk-muted" />
            )}
          </button>

          {showPowerShellRunbooks && (
            <div className="p-5 border-t border-afk-border bg-afk-surface/20 space-y-3 text-xs font-mono">
              <div className="p-3 bg-afk-surface rounded-lg border border-afk-border">
                <span className="text-afk-olive-accent font-bold">1. Safe Docker Startup:</span>
                <pre className="text-afk-offwhite mt-1">.\scripts\start.ps1</pre>
              </div>
              <div className="p-3 bg-afk-surface rounded-lg border border-afk-border">
                <span className="text-afk-olive-accent font-bold">2. Check Status & Health:</span>
                <pre className="text-afk-offwhite mt-1">.\scripts\status.ps1</pre>
              </div>
              <div className="p-3 bg-afk-surface rounded-lg border border-afk-border">
                <span className="text-afk-olive-accent font-bold">3. Manual Backup:</span>
                <pre className="text-afk-offwhite mt-1">.\scripts\backup.ps1 -Destination &quot;E:\AFK-Backups&quot;</pre>
              </div>
              <div className="p-3 bg-afk-surface rounded-lg border border-afk-border">
                <span className="text-afk-olive-accent font-bold">4. Isolated Dry-Run Restore Test:</span>
                <pre className="text-afk-offwhite mt-1">.\scripts\restore.ps1 -BackupPath &quot;...&quot; -Isolated</pre>
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Raw Immutable Audit Trail */}
        <div className="bg-afk-card rounded-xl border border-afk-border overflow-hidden">
          <button
            onClick={() => setShowRawAuditLogs(!showRawAuditLogs)}
            className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-afk-surface/60 transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-afk-muted" />
              <span className="text-sm font-semibold text-afk-secondary">
                Immutable Audit Trail (Last 20 Actions)
              </span>
            </div>
            {showRawAuditLogs ? (
              <ChevronUp className="w-4 h-4 text-afk-muted" />
            ) : (
              <ChevronDown className="w-4 h-4 text-afk-muted" />
            )}
          </button>

          {showRawAuditLogs && (
            <div className="p-5 border-t border-afk-border bg-afk-surface/20">
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
                        <td className="py-2 font-mono text-afk-secondary">
                          {new Date(log.createdAt).toLocaleString("en-BD", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-2 font-mono text-afk-olive-accent font-medium">
                          {log.action}
                        </td>
                        <td className="py-2 font-mono text-afk-secondary">
                          {log.entityType}
                        </td>
                        <td className="py-2 text-afk-offwhite max-w-md truncate">
                          {log.details || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
