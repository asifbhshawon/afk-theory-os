import clsx from "clsx";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Banknote, Receipt, RotateCcw, Undo2 } from "lucide-react";
import type { ComponentType } from "react";
import { EmptyState, Pill } from "@/components/ui/primitives";
import { formatBdt, formatDate } from "@/lib/format";
import { KIND_LABELS } from "@/lib/query";
import type { TransactionView } from "@/lib/portal-data";

type IconType = ComponentType<{ className?: string }>;

function visual(t: TransactionView): { Icon: IconType; tone: string; sign: string } {
  if (t.kind === "REVERSAL") return { Icon: Undo2, tone: "text-afk-warning", sign: t.direction === "IN" ? "+" : t.direction === "OUT" ? "−" : "" };
  if (t.kind === "TRANSFER") return { Icon: ArrowLeftRight, tone: "text-sky-300", sign: "" };
  if (t.kind === "RETURN") return { Icon: RotateCcw, tone: t.direction === "OUT" ? "text-afk-danger" : "text-afk-secondary", sign: t.direction === "OUT" ? "−" : "" };
  if (t.direction === "IN") return { Icon: ArrowDownLeft, tone: "text-afk-success", sign: "+" };
  if (t.direction === "OUT") return { Icon: ArrowUpRight, tone: "text-afk-danger", sign: "−" };
  return { Icon: t.kind === "SALE" ? Banknote : Receipt, tone: "text-afk-secondary", sign: "" };
}

/** Responsive ledger rows (no horizontal scroll on phones). Server-rendered, no JS. */
export function LedgerList({ rows, emptyHint }: { rows: TransactionView[]; emptyHint: string }) {
  if (rows.length === 0) {
    return <EmptyState icon={Receipt} title="No transactions match" hint={emptyHint} />;
  }
  return (
    <ul className="divide-y divide-afk-border/60">
      {rows.map((t) => {
        const { Icon, tone, sign } = visual(t);
        const showDescription = t.description && t.description.trim() !== t.title.trim();
        return (
          <li key={t.id} className="flex items-start gap-3.5 px-5 py-3.5">
            <span className={clsx("mt-0.5 grid place-items-center w-8 h-8 rounded-full bg-afk-surface border border-afk-border shrink-0", tone)}>
              <Icon className="w-4 h-4" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className={clsx("text-sm font-medium text-afk-offwhite", t.isReversed && "line-through opacity-60")}>{t.title}</p>
                {t.isReversed && <Pill tone="warning">Reversed</Pill>}
              </div>
              <p className="text-2xs text-afk-muted mt-0.5">
                {KIND_LABELS[t.kind] ?? t.kind} · {formatDate(t.txnDate, "d MMM yyyy")}
                {t.accountLabel ? ` · ${t.accountLabel}` : ""}
                {t.partnerName ? ` · ${t.partnerName}` : ""}
                {t.category && t.category !== t.title ? ` · ${t.category}` : ""}
              </p>
              {showDescription && <p className="text-2xs text-afk-subtle mt-0.5 line-clamp-2 break-words">{t.description}</p>}
            </div>

            <div className="text-right shrink-0">
              <p className={clsx("text-sm font-mono font-semibold tabular-nums", tone, t.isReversed && "line-through opacity-60")}>
                {sign}
                {formatBdt(t.amount)}
              </p>
              <p className="text-2xs font-mono text-afk-subtle mt-0.5">{t.journalNo?.replace("AFK-JRN-", "JRN-")}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
