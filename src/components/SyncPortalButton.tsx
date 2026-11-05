"use client";

import React, { useState, useEffect } from "react";
import {
  Cloud,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Check,
} from "lucide-react";

interface SyncStatusData {
  isConfigured: boolean;
  lastPushedAt: string | null;
  lastPushStatus: string | null;
  isLive: boolean;
  sourceSystem?: string;
  error?: string;
}

interface SyncPortalButtonProps {
  variant?: "header" | "quick-action" | "card";
  className?: string;
}

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return "Never synced";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Unknown";

  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString("en-BD", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SyncPortalButton({
  variant = "header",
  className = "",
}: SyncPortalButtonProps) {
  const [status, setStatus] = useState<SyncStatusData | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<any>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/sync/portal");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {
      // Ignore background status polling errors
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 60000); // Poll every minute
    return () => clearInterval(interval);
  }, []);

  const handleSync = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isSyncing) return;

    setIsSyncing(true);
    setSyncSuccess(false);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/sync/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSyncSuccess(true);
        setLastSyncResult(data);
        setStatus({
          isConfigured: true,
          lastPushedAt: data.timestamp,
          lastPushStatus: "SUCCESS",
          isLive: true,
        });

        // Hide success message after 4 seconds
        setTimeout(() => {
          setSyncSuccess(false);
        }, 4000);
      } else {
        setErrorMessage(data.error || "Sync failed");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Network error while syncing");
    } finally {
      setIsSyncing(false);
    }
  };

  const isLive = status?.isLive ?? false;
  const relativeTime = formatRelativeTime(status?.lastPushedAt ?? null);

  // ========================================================
  // VARIANT 1: HEADER (Compact button in top navigation bar)
  // ========================================================
  if (variant === "header") {
    return (
      <div
        className="relative"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition cursor-pointer shadow-sm select-none ${
            syncSuccess
              ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-300"
              : errorMessage
              ? "bg-red-950/60 border-red-500/50 text-red-300"
              : isSyncing
              ? "bg-afk-surface border-afk-border text-afk-secondary opacity-80 cursor-wait"
              : "bg-afk-surface hover:bg-afk-elevated border-afk-border hover:border-afk-olive/40 text-afk-secondary hover:text-afk-offwhite"
          } ${className}`}
          title="Push Authoritative Snapshot to Cloud Partner Portal"
        >
          {isSyncing ? (
            <RefreshCw className="w-3.5 h-3.5 text-afk-olive-accent animate-spin" />
          ) : syncSuccess ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          ) : errorMessage ? (
            <AlertCircle className="w-3.5 h-3.5 text-red-400" />
          ) : (
            <Cloud className="w-3.5 h-3.5 text-sky-400" />
          )}

          <span className="hidden sm:inline">
            {isSyncing
              ? "Syncing..."
              : syncSuccess
              ? "Synced!"
              : errorMessage
              ? "Sync Failed"
              : "Sync Cloud"}
          </span>

          {/* Status Dot */}
          {!isSyncing && !syncSuccess && !errorMessage && (
            <span className="flex h-2 w-2 relative ml-0.5">
              {isLive ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              )}
            </span>
          )}
        </button>

        {/* Hover Popover Details */}
        {showTooltip && (
          <div className="absolute right-0 mt-2 w-64 bg-afk-card border border-afk-border rounded-xl shadow-2xl p-3 z-50 animate-in fade-in duration-150 text-xs select-none">
            <div className="flex items-center justify-between pb-2 border-b border-afk-border mb-2">
              <span className="font-semibold text-afk-offwhite flex items-center gap-1.5">
                <Cloud className="w-3.5 h-3.5 text-sky-400" />
                <span>Partner Portal Cloud</span>
              </span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  isLive
                    ? "bg-emerald-950/70 border border-emerald-500/40 text-emerald-400"
                    : "bg-amber-950/70 border border-amber-500/40 text-amber-400"
                }`}
              >
                {isLive ? "Live Synced" : "Snapshot"}
              </span>
            </div>

            <div className="space-y-1 text-afk-muted text-[11px]">
              <div className="flex items-center justify-between">
                <span>Last Pushed:</span>
                <span className="text-afk-offwhite font-mono">{relativeTime}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Target:</span>
                <a
                  href="https://afk-theory-os.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 hover:underline flex items-center gap-1"
                >
                  afk-theory-os.vercel.app
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>

            {errorMessage && (
              <div className="mt-2 p-2 bg-red-950/50 border border-red-500/40 rounded text-red-300 text-[11px]">
                {errorMessage}
              </div>
            )}

            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="mt-2.5 w-full py-1.5 bg-afk-olive hover:bg-afk-olive-light text-afk-offwhite rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Syncing Now..." : "Push Sync Now"}</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // ========================================================
  // VARIANT 2: QUICK ACTION (Dashboard launcher button)
  // ========================================================
  if (variant === "quick-action") {
    return (
      <button
        onClick={handleSync}
        disabled={isSyncing}
        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-xs font-semibold shadow-sm transition cursor-pointer select-none ${
          syncSuccess
            ? "bg-emerald-950/70 border-emerald-500/60 text-emerald-300"
            : errorMessage
            ? "bg-red-950/70 border-red-500/60 text-red-300"
            : isSyncing
            ? "bg-afk-surface border-afk-border text-afk-secondary opacity-75 cursor-wait"
            : "bg-afk-surface hover:bg-afk-elevated border-afk-border hover:border-sky-500/40 text-afk-offwhite"
        } ${className}`}
        title="Sync local ERP to Cloud Partner Portal"
      >
        {isSyncing ? (
          <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin" />
        ) : syncSuccess ? (
          <Check className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <Cloud className="w-3.5 h-3.5 text-sky-400" />
        )}

        <span>
          {isSyncing
            ? "Syncing to Cloud..."
            : syncSuccess
            ? "Cloud Synced!"
            : errorMessage
            ? "Sync Failed"
            : "Sync Cloud Portal"}
        </span>

        {/* Small indicator pill */}
        <span
          className={`text-[10px] font-mono px-1 py-0.2 rounded ml-1 ${
            isLive
              ? "bg-emerald-950 border border-emerald-500/40 text-emerald-400"
              : "bg-afk-surface border border-afk-border text-afk-muted"
          }`}
        >
          {relativeTime}
        </span>
      </button>
    );
  }

  // ========================================================
  // VARIANT 3: CARD (Full control panel for /settings)
  // ========================================================
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-afk-surface border border-afk-border text-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full ${
                isLive ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
              }`}
            />
            <span className="font-semibold text-afk-offwhite">
              {isLive ? "Live Synced Cloud Read Model" : "Saved Snapshot in Cloud"}
            </span>
          </div>
          <p className="text-afk-muted text-[11px]">
            Target:{" "}
            <a
              href="https://afk-theory-os.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-400 hover:underline"
            >
              afk-theory-os.vercel.app
            </a>{" "}
            • Last pushed: <span className="text-afk-offwhite font-mono">{relativeTime}</span>
          </p>
        </div>

        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="px-4 py-2 bg-afk-olive hover:bg-afk-olive-light disabled:opacity-50 text-afk-offwhite text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition shadow cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
          <span>{isSyncing ? "Pushing Snapshot..." : "Sync to Cloud Now"}</span>
        </button>
      </div>

      {syncSuccess && lastSyncResult && (
        <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/40 rounded-lg text-xs space-y-2 font-mono text-emerald-200 animate-in fade-in">
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Exact Local State Successfully Pushed to Cloud!</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-afk-offwhite pt-1">
            <div className="p-2 rounded bg-afk-surface/60 border border-afk-border">
              <span className="text-afk-muted block text-[10px]">Liquid Cash</span>
              <span className="font-semibold text-emerald-400">
                ৳{lastSyncResult.summary?.availableCash?.toLocaleString()}
              </span>
            </div>
            <div className="p-2 rounded bg-afk-surface/60 border border-afk-border">
              <span className="text-afk-muted block text-[10px]">Partner Stmts</span>
              <span className="font-semibold">
                {lastSyncResult.counts?.partnerStatements} Partners
              </span>
            </div>
            <div className="p-2 rounded bg-afk-surface/60 border border-afk-border">
              <span className="text-afk-muted block text-[10px]">Calendar Notes</span>
              <span className="font-semibold">
                {lastSyncResult.counts?.calendarNotes} Notes
              </span>
            </div>
            <div className="p-2 rounded bg-afk-surface/60 border border-afk-border">
              <span className="text-afk-muted block text-[10px]">Activity Feed</span>
              <span className="font-semibold">
                {lastSyncResult.counts?.activityFeed} Records
              </span>
            </div>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-afk-danger/10 border border-afk-danger/40 rounded text-xs text-afk-danger flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
