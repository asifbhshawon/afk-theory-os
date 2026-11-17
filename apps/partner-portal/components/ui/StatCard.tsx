import clsx from "clsx";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ComponentType } from "react";
import { Sparkline } from "@/components/charts/Sparkline";
import { formatPct } from "@/lib/format";

type IconType = ComponentType<{ className?: string }>;

/**
 * KPI tile: label, big number, period-over-period delta and an optional trend line.
 * `invertDelta` flips the colour logic for metrics where "up" is bad (e.g. expenses).
 */
export function StatCard({
  label,
  value,
  delta,
  invertDelta = false,
  deltaHint = "vs prev. period",
  hint,
  icon: Icon,
  spark,
  sparkColor,
  className,
}: {
  label: string;
  value: string;
  delta?: number | null;
  invertDelta?: boolean;
  deltaHint?: string;
  hint?: string;
  icon?: IconType;
  spark?: number[];
  sparkColor?: string;
  className?: string;
}) {
  const hasDelta = delta !== undefined && delta !== null;
  const good = hasDelta ? (invertDelta ? delta! < 0 : delta! > 0) : false;
  const bad = hasDelta ? (invertDelta ? delta! > 0 : delta! < 0) : false;
  const DeltaIcon = !hasDelta || delta === 0 ? Minus : delta! > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <div className={clsx("rounded-xl border border-afk-border bg-afk-card p-3.5 sm:p-5 shadow-sm flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-2 text-xs font-medium text-afk-secondary">
        <span className="truncate">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-afk-muted shrink-0" />}
      </div>

      <div className="flex items-end justify-between gap-3">
        <p className="text-xl sm:text-2xl font-bold tracking-tight text-afk-offwhite tabular-nums truncate">{value}</p>
        {spark && (
          <div className="hidden min-[430px]:block">
            <Sparkline values={spark} color={sparkColor} width={84} label={`${label} trend`} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-1.5 text-2xs min-h-[1rem] -mt-1.5">
        {hasDelta ? (
          <>
            <span
              className={clsx(
                "inline-flex items-center gap-0.5 font-semibold",
                good ? "text-afk-success" : bad ? "text-afk-danger" : "text-afk-muted"
              )}
            >
              <DeltaIcon className="w-3 h-3" />
              {formatPct(delta)}
            </span>
            <span className="text-afk-muted">{deltaHint}</span>
          </>
        ) : (
          hint && <span className="text-afk-muted">{hint}</span>
        )}
      </div>
    </div>
  );
}
