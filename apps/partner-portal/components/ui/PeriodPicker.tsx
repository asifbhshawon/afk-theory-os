import Link from "next/link";
import clsx from "clsx";
import { RANGE_OPTIONS, type RangeDays } from "@/lib/analytics";
import { buildHref } from "@/lib/query";

/**
 * 7 / 30 / 90 day switcher driven by `?range=` so every view is a plain, cacheable link.
 * `params` carries the page's other filters across (the page number is deliberately dropped).
 */
export function PeriodPicker({
  value,
  basePath = "/",
  params = {},
}: {
  value: RangeDays;
  basePath?: string;
  params?: Record<string, string | number | undefined>;
}) {
  return (
    <nav aria-label="Time period" className="inline-flex rounded-lg border border-afk-border bg-afk-surface p-0.5">
      {RANGE_OPTIONS.map((r) => (
        <Link
          key={r}
          href={buildHref(basePath, { ...params, page: undefined, range: r })}
          scroll={false}
          aria-current={r === value ? "true" : undefined}
          className={clsx(
            "px-3 py-1.5 rounded-md text-xs font-semibold transition",
            r === value
              ? "bg-afk-olive text-afk-offwhite shadow-sm"
              : "text-afk-secondary hover:text-afk-offwhite hover:bg-afk-elevated"
          )}
        >
          {r}d
        </Link>
      ))}
    </nav>
  );
}
