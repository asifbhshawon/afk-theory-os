"use client";

import { useEffect, useState } from "react";
import { RefreshCw, CheckCircle2, Clock, CloudOff } from "lucide-react";
import { formatRelativeSyncTime } from "@/lib/format";

interface SyncStatusData {
  isInitialized: boolean;
  lastPushedAt: string | null;
  lastPushStatus: string;
  sourceSystem: string;
  isLive: boolean;
}

export function SyncStatusBadge({ initialStatus }: { initialStatus?: SyncStatusData }) {
  const [status, setStatus] = useState<SyncStatusData | null>(initialStatus || null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/sync/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {
      // offline / snapshot
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!initialStatus) {
      fetchStatus();
    }
    const interval = setInterval(fetchStatus, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, [initialStatus]);

  const isLive = status?.isLive ?? false;
  const lastSync = status?.lastPushedAt;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-afk-surface border border-afk-border text-xs">
      <div className="flex items-center gap-1.5">
        {isLive ? (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        ) : (
          <span className="inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
        )}

        <span className="font-medium text-afk-offwhite">
          {isLive ? "Live Synced" : "Saved Snapshot"}
        </span>
      </div>

      <span className="text-afk-border">•</span>

      <span className="text-afk-muted flex items-center gap-1">
        <Clock className="w-3 h-3 text-afk-secondary" />
        <span>{lastSync ? formatRelativeSyncTime(lastSync) : "Pending sync"}</span>
      </span>

      <button
        onClick={fetchStatus}
        disabled={isLoading}
        title="Check synchronization status"
        className="text-afk-secondary hover:text-afk-offwhite transition ml-1 p-0.5"
      >
        <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin text-afk-olive-accent" : ""}`} />
      </button>
    </div>
  );
}
