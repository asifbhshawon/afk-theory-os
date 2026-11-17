import Link from "next/link";
import clsx from "clsx";
import { ChevronRight } from "lucide-react";
import type { ReactNode, ComponentType } from "react";

type IconType = ComponentType<{ className?: string }>;

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={clsx("rounded-xl border border-afk-border bg-afk-card shadow-sm", className)}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  subtitle,
  icon: Icon,
  iconClass = "text-afk-olive-accent",
  href,
  linkLabel = "View all",
  right,
}: {
  title: string;
  subtitle?: string;
  icon?: IconType;
  iconClass?: string;
  href?: string;
  linkLabel?: string;
  right?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && (
          <span className="grid place-items-center w-8 h-8 rounded-lg bg-afk-surface border border-afk-border shrink-0">
            <Icon className={clsx("w-4 h-4", iconClass)} />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-afk-offwhite truncate">{title}</h2>
          {subtitle && <p className="text-2xs text-afk-muted truncate">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {right}
        {href && (
          <Link
            href={href}
            className="inline-flex items-center gap-0.5 text-xs font-medium text-afk-secondary hover:text-afk-offwhite transition"
          >
            {linkLabel}
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
    </header>
  );
}

const PILL_TONES = {
  neutral: "bg-afk-surface text-afk-secondary border-afk-border",
  olive: "bg-afk-olive/20 text-afk-olive-accent border-afk-olive/40",
  gold: "bg-afk-gold/15 text-afk-gold border-afk-gold/30",
  success: "bg-afk-success/15 text-afk-success border-afk-success/30",
  warning: "bg-afk-warning/15 text-afk-warning border-afk-warning/30",
  danger: "bg-afk-danger/15 text-afk-danger border-afk-danger/30",
  sky: "bg-sky-500/15 text-sky-300 border-sky-500/30",
} as const;

export type PillTone = keyof typeof PILL_TONES;

export function Pill({ tone = "neutral", children, className }: { tone?: PillTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-2xs font-semibold whitespace-nowrap",
        PILL_TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/** Order status → pill colour, shared by every page that shows orders. */
export function orderStatusTone(status: string): { tone: PillTone; label: string } {
  switch (status) {
    case "CONFIRMED":
    case "PACKED":
      return { tone: "neutral", label: "To ship" };
    case "SHIPPED":
      return { tone: "gold", label: "With courier" };
    case "DELIVERED":
      return { tone: "olive", label: "Delivered" };
    case "RETURNED":
      return { tone: "danger", label: "Returned" };
    case "CANCELLED":
      return { tone: "danger", label: "Cancelled" };
    default:
      return { tone: "neutral", label: status };
  }
}

export function EmptyState({
  icon: Icon,
  title,
  hint,
  className,
}: {
  icon?: IconType;
  title: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={clsx("flex flex-col items-center justify-center text-center px-6 py-10", className)}>
      {Icon && (
        <span className="grid place-items-center w-11 h-11 rounded-full bg-afk-surface border border-afk-border mb-3">
          <Icon className="w-5 h-5 text-afk-muted" />
        </span>
      )}
      <p className="text-sm font-medium text-afk-secondary">{title}</p>
      {hint && <p className="text-xs text-afk-muted mt-1 max-w-xs">{hint}</p>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-lg bg-afk-surface", className)} aria-hidden="true" />;
}

export function ProgressBar({
  value,
  tone = "olive",
  className,
}: {
  value: number; // 0–100
  tone?: "olive" | "gold" | "danger" | "sky";
  className?: string;
}) {
  const color = { olive: "bg-afk-olive-light", gold: "bg-afk-gold", danger: "bg-afk-danger", sky: "bg-sky-400" }[tone];
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={clsx("h-1.5 w-full rounded-full bg-afk-surfaceLight overflow-hidden", className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={clsx("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}
