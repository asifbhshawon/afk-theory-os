"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

/** Shown instead of a blank crash when a portal page fails (e.g. the cloud database is briefly unreachable). */
export default function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[portal] page error", error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-md rounded-xl border border-afk-border bg-afk-card p-8 text-center">
      <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full border border-afk-warning/40 bg-afk-warning/10">
        <AlertTriangle className="h-6 w-6 text-afk-warning" />
      </span>
      <h1 className="text-lg font-bold text-afk-offwhite">This page could not be loaded</h1>
      <p className="mt-1.5 text-sm text-afk-secondary">
        The latest business data is temporarily unavailable. Your information is safe — try again in a moment.
      </p>
      {error.digest && <p className="mt-2 font-mono text-2xs text-afk-subtle">Reference: {error.digest}</p>}
      <div className="mt-5 flex items-center justify-center gap-2">
        <button
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-lg bg-afk-olive px-4 py-2 text-sm font-semibold text-afk-offwhite transition hover:bg-afk-olive-light"
        >
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
        <Link href="/" className="rounded-lg border border-afk-border bg-afk-surface px-4 py-2 text-sm font-medium text-afk-offwhite transition hover:bg-afk-elevated">
          Back to overview
        </Link>
      </div>
    </div>
  );
}
