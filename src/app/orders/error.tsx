"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function OrdersError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[orders] page error", error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-md rounded-xl border border-afk-border bg-afk-card p-8 text-center">
      <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full border border-afk-warning/40 bg-afk-warning/10">
        <AlertTriangle className="h-6 w-6 text-afk-warning" />
      </span>
      <h1 className="text-lg font-bold text-afk-offwhite">Orders could not be loaded</h1>
      <p className="mt-1.5 text-sm text-afk-secondary">
        Nothing was changed. Check that the database is running, then try again.
      </p>
      {error.digest && <p className="mt-2 font-mono text-2xs text-afk-subtle">Reference: {error.digest}</p>}
      <button
        onClick={reset}
        className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-afk-olive px-4 py-2 text-sm font-semibold text-afk-offwhite transition hover:bg-afk-olive-light"
      >
        <RefreshCw className="h-4 w-4" /> Try again
      </button>
    </div>
  );
}
