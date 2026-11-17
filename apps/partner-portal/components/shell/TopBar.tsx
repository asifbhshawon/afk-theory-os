"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Plus } from "lucide-react";
import { formatRelativeSyncTime } from "@/lib/format";
import type { PortalPartner } from "@/lib/constants";

/**
 * Freshness of the data the partner is looking at.
 * The ERP pushes when something changes, so a quiet day is normal — only a
 * multi-day silence is flagged.
 */
function SyncPill({ lastPushedAt }: { lastPushedAt: string | null }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const ageMin = lastPushedAt ? (Date.now() - new Date(lastPushedAt).getTime()) / 60_000 : Infinity;
  const state = !lastPushedAt ? "none" : ageMin < 30 ? "live" : ageMin < 60 * 48 ? "ok" : "stale";

  const dot = { live: "bg-emerald-400", ok: "bg-afk-olive-accent", stale: "bg-amber-400", none: "bg-afk-subtle" }[state];
  const label = { live: "Live", ok: "Updated", stale: "Last update", none: "Awaiting first sync" }[state];

  return (
    <div
      suppressHydrationWarning
      className={clsx(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs",
        state === "stale" ? "border-amber-500/40 bg-amber-500/10" : "border-afk-border bg-afk-surface"
      )}
      title={lastPushedAt ? `Last pushed from the ERP: ${new Date(lastPushedAt).toLocaleString()}` : "The local ERP has not pushed data yet"}
    >
      <span className="relative flex h-2 w-2">
        {state === "live" && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
        <span suppressHydrationWarning className={clsx("relative inline-flex h-2 w-2 rounded-full", dot)} />
      </span>
      <span suppressHydrationWarning className="font-medium text-afk-offwhite">{label}</span>
      {lastPushedAt && (
        <span className="text-afk-muted hidden sm:inline" suppressHydrationWarning>
          {formatRelativeSyncTime(lastPushedAt)}
        </span>
      )}
    </div>
  );
}

export function TopBar({ partner, lastPushedAt }: { partner: PortalPartner; lastPushedAt: string | null }) {
  return (
    <header className="no-print sticky top-0 z-30 h-14 border-b border-afk-border bg-afk-black/85 backdrop-blur-md">
      <div className="h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
        <Link href="/" className="lg:hidden flex items-center gap-2">
          <span className="grid place-items-center w-8 h-8 rounded-lg bg-afk-surface border border-afk-border text-2xs font-bold tracking-wider text-afk-gold">
            AFK
          </span>
          <span className="text-sm font-bold tracking-tight">Partner Portal</span>
        </Link>
        <p className="hidden lg:block text-xs text-afk-muted">
          Welcome back, <span className="text-afk-secondary font-medium">{partner.name}</span>
        </p>

        <div className="flex items-center gap-2.5">
          <SyncPill lastPushedAt={lastPushedAt} />
          <Link
            href="/calendar?action=new"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-afk-olive hover:bg-afk-olive-light px-3 py-1.5 text-xs font-semibold text-afk-offwhite shadow-sm transition"
          >
            <Plus className="w-3.5 h-3.5" />
            New note
          </Link>
          <span className="lg:hidden grid place-items-center w-8 h-8 rounded-full bg-afk-olive-dark border border-afk-olive/50 text-xs font-bold">
            {partner.name.charAt(0)}
          </span>
        </div>
      </div>
    </header>
  );
}
