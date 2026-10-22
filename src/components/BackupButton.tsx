"use client";

import { useState } from "react";
import { DownloadCloud, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export function BackupButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleBackup() {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/backup", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setResult(data.backup);
      } else {
        setError(data.error || "Backup failed");
      }
    } catch (err: any) {
      setError(err.message || "Failed to trigger backup");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleBackup}
        disabled={loading}
        className="w-full py-2 bg-afk-olive hover:bg-afk-olive-light disabled:opacity-50 text-afk-offwhite text-xs font-semibold rounded flex items-center justify-center gap-2 transition shadow"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Exporting PostgreSQL Dump & Documents...</span>
          </>
        ) : (
          <>
            <DownloadCloud className="w-4 h-4" />
            <span>Generate Local Backup Now</span>
          </>
        )}
      </button>

      {result && (
        <div className="p-3 bg-afk-olive-dark/60 border border-afk-olive rounded text-xs space-y-1 font-mono text-afk-offwhite">
          <div className="flex items-center gap-1.5 text-afk-success font-bold">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Backup Generated Successfully!</span>
          </div>
          <p className="text-[11px] text-afk-muted">ID: {result.backupId}</p>
          <p className="text-[11px] text-afk-muted truncate">SHA256: {result.checksum}</p>
          <p className="text-[11px] text-afk-muted">Path: {result.archivePath}</p>
        </div>
      )}

      {error && (
        <div className="p-3 bg-afk-danger/10 border border-afk-danger/40 rounded text-xs text-afk-danger flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
