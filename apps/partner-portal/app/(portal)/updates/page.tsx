import { Bell, Briefcase, CheckCircle2, DollarSign, Factory, ShieldCheck, Truck } from "lucide-react";
import type { ComponentType } from "react";
import { getCurrentPartner } from "@/lib/auth";
import { getActivityPage } from "@/lib/portal-data-misc";
import { buildHref, first, parsePage } from "@/lib/query";
import { formatDateTime } from "@/lib/format";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { FilterTabs, Pagination } from "@/components/ui/ListControls";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

const CATEGORIES = [
  { key: "ALL", label: "All updates" },
  { key: "FINANCE", label: "Finance & capital" },
  { key: "PRODUCTION", label: "Manufacturing & QC" },
  { key: "VENTURE", label: "Ventures" },
  { key: "LOGISTICS", label: "Courier & delivery" },
  { key: "GOVERNANCE", label: "Governance" },
];

const ICONS: Record<string, { Icon: ComponentType<{ className?: string }>; tone: string }> = {
  FINANCE: { Icon: DollarSign, tone: "text-afk-success" },
  PRODUCTION: { Icon: Factory, tone: "text-afk-gold" },
  VENTURE: { Icon: Briefcase, tone: "text-afk-olive-accent" },
  LOGISTICS: { Icon: Truck, tone: "text-sky-300" },
  GOVERNANCE: { Icon: ShieldCheck, tone: "text-violet-300" },
};

export default async function UpdatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const partner = await getCurrentPartner();
  if (!partner) return null;

  const sp = await searchParams;
  const requested = first(sp.category);
  const category = CATEGORIES.some((c) => c.key === requested) ? (requested as string) : "ALL";
  const page = parsePage(sp.page);

  const { rows, total } = await getActivityPage({
    category: category === "ALL" ? null : category,
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business updates"
        subtitle="Milestones, production, courier payouts and approvals posted in the ERP"
      />

      <FilterTabs
        tabs={CATEGORIES.map((c) => ({ key: c.key, label: c.label }))}
        active={category}
        hrefFor={(key) => buildHref("/updates", { category: key === "ALL" ? undefined : key })}
      />

      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={Bell} title="No updates in this category" hint="New postings appear here after the ERP syncs." />
        ) : (
          <ol className="relative px-5 py-5 pl-11 space-y-4 before:absolute before:left-[1.65rem] before:top-6 before:bottom-6 before:w-px before:bg-afk-border">
            {rows.map((a) => {
              const { Icon, tone } = ICONS[a.category] ?? { Icon: CheckCircle2, tone: "text-afk-secondary" };
              return (
                <li key={a.id} className="relative">
                  <span className="absolute -left-[2.35rem] top-1.5 grid place-items-center w-6 h-6 rounded-full border border-afk-border bg-afk-surface">
                    <Icon className={`w-3.5 h-3.5 ${tone}`} />
                  </span>
                  <div className="rounded-xl border border-afk-border bg-afk-surface/60 p-4 hover:border-afk-borderLight transition">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <p className="text-sm font-semibold text-afk-offwhite">{a.title}</p>
                      <time dateTime={a.timestamp} className="text-2xs font-mono text-afk-muted">
                        {formatDateTime(a.timestamp)}
                      </time>
                    </div>
                    <p className="text-xs text-afk-secondary leading-relaxed mt-1 break-words">{a.description}</p>
                    {a.actorName && <p className="text-2xs text-afk-muted mt-1.5">Logged by {a.actorName}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          hrefFor={(p) => buildHref("/updates", { category: category === "ALL" ? undefined : category, page: p })}
        />
      </Card>
    </div>
  );
}
