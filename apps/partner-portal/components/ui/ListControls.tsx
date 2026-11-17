import Link from "next/link";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { buildHref } from "@/lib/query";

type Params = Record<string, string | number | undefined>;

/** Plain GET form: the search term lives in the URL, so results are linkable and cacheable. */
export function SearchBox({
  basePath,
  params,
  value,
  placeholder,
}: {
  basePath: string;
  /** Other filters to keep when searching (range, status…). */
  params: Params;
  value: string;
  placeholder: string;
}) {
  return (
    <form action={basePath} method="get" role="search" className="relative w-full sm:w-72">
      {Object.entries(params).map(([k, v]) =>
        v !== undefined && v !== "" ? <input key={k} type="hidden" name={k} value={String(v)} /> : null
      )}
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-afk-muted pointer-events-none" />
      <input
        type="search"
        name="q"
        defaultValue={value}
        placeholder={placeholder}
        aria-label={placeholder}
        maxLength={60}
        className="w-full rounded-lg border border-afk-border bg-afk-input pl-9 pr-9 py-2 text-sm text-afk-offwhite placeholder:text-afk-subtle focus:outline-none focus:border-afk-olive focus:ring-1 focus:ring-afk-olive/40"
      />
      {value && (
        <Link
          href={buildHref(basePath, params)}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-afk-muted hover:text-afk-offwhite"
        >
          <X className="w-3.5 h-3.5" />
        </Link>
      )}
    </form>
  );
}

/** Horizontal filter tabs (links) with optional counts. */
export function FilterTabs({
  tabs,
  active,
  hrefFor,
}: {
  tabs: { key: string; label: string; count?: number }[];
  active: string;
  hrefFor: (key: string) => string;
}) {
  return (
    <nav className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-0.5" aria-label="Filter">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={hrefFor(t.key)}
          scroll={false}
          aria-current={t.key === active ? "true" : undefined}
          className={clsx(
            "whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium transition",
            t.key === active
              ? "border-afk-olive/60 bg-afk-olive/25 text-afk-offwhite"
              : "border-transparent text-afk-secondary hover:bg-afk-surface hover:text-afk-offwhite"
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 font-mono text-afk-muted">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  hrefFor,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  const btn = "inline-flex items-center gap-1 rounded-lg border border-afk-border bg-afk-surface px-3 py-1.5 text-xs font-medium transition";
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-afk-border text-xs text-afk-muted">
      <span>
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} scroll={false} className={clsx(btn, "text-afk-offwhite hover:bg-afk-elevated")}>
            <ChevronLeft className="w-3.5 h-3.5" /> Prev
          </Link>
        ) : (
          <span className={clsx(btn, "opacity-40")}>
            <ChevronLeft className="w-3.5 h-3.5" /> Prev
          </span>
        )}
        <span className="px-1">
          Page {Math.min(page, pages)} / {pages}
        </span>
        {page < pages ? (
          <Link href={hrefFor(page + 1)} scroll={false} className={clsx(btn, "text-afk-offwhite hover:bg-afk-elevated")}>
            Next <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        ) : (
          <span className={clsx(btn, "opacity-40")}>
            Next <ChevronRight className="w-3.5 h-3.5" />
          </span>
        )}
      </div>
    </div>
  );
}

/** Label + value + proportional bar; used for pipelines, zones and top products. */
export function BarRow({
  label,
  sub,
  value,
  fraction,
  barClass = "bg-afk-olive-light",
}: {
  label: string;
  sub?: string;
  value: string;
  /** 0–1, relative to the largest row. */
  fraction: number;
  barClass?: string;
}) {
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="truncate text-afk-offwhite font-medium">{label}</span>
        <span className="shrink-0 font-mono tabular-nums text-afk-offwhite">{value}</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-afk-surfaceLight overflow-hidden">
        <div className={clsx("h-full rounded-full", barClass)} style={{ width: `${Math.max(2, Math.min(100, fraction * 100))}%` }} />
      </div>
      {sub && <p className="mt-1 text-2xs text-afk-muted">{sub}</p>}
    </li>
  );
}
