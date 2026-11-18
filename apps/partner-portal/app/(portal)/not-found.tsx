import Link from "next/link";
import { Compass } from "lucide-react";

export default function PortalNotFound() {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-afk-border bg-afk-card p-8 text-center">
      <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full border border-afk-border bg-afk-surface">
        <Compass className="h-6 w-6 text-afk-muted" />
      </span>
      <h1 className="text-lg font-bold text-afk-offwhite">Page not found</h1>
      <p className="mt-1.5 text-sm text-afk-secondary">That page does not exist or has moved.</p>
      <Link href="/" className="mt-5 inline-block rounded-lg bg-afk-olive px-4 py-2 text-sm font-semibold text-afk-offwhite transition hover:bg-afk-olive-light">
        Back to overview
      </Link>
    </div>
  );
}
