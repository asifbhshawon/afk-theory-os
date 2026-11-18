import { Briefcase, CheckCircle2, Lock, Package, TrendingUp } from "lucide-react";
import { getCurrentPartner, hasVentureAccess } from "@/lib/auth";
import { getAllVentures } from "@/lib/portal-data-misc";
import { formatBdt, formatCompactBdt, formatDate } from "@/lib/format";
import { Card, EmptyState, PageHeader, Pill, ProgressBar } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function VenturesPage() {
  const partner = await getCurrentPartner();
  if (!partner) return null;

  const all = await getAllVentures();
  const ventures = all.filter((v) => hasVentureAccess(partner, v.ventureNumber));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ventures & projects"
        subtitle="Product drops, seasonal collections and investor agreements"
        badge={<Pill tone="olive">{ventures.length} yours</Pill>}
      >
        <p className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-afk-border bg-afk-surface px-3 py-1.5 text-2xs text-afk-muted">
          <Lock className="w-3.5 h-3.5 text-afk-gold" /> Restricted to your approved agreements
        </p>
      </PageHeader>

      {ventures.length === 0 ? (
        <Card>
          <EmptyState
            icon={Briefcase}
            title="No ventures assigned to your account"
            hint="Ask the managing partner to add you to a venture agreement and it will appear here after the next sync."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {ventures.map((v) => {
            const mine = v.participants.find(
              (p) => p.partnerId === partner.id || p.name?.toLowerCase() === partner.name?.toLowerCase()
            );
            const prod = v.productionProgress ?? {};
            const sales = v.salesProgress ?? {};
            const funded = v.targetBudget > 0 ? (v.actualCashRaised / v.targetBudget) * 100 : 0;
            const made = prod.plannedQty ? ((prod.completedQty ?? 0) / prod.plannedQty) * 100 : 0;

            return (
              <Card key={v.id} className="overflow-hidden flex flex-col">
                <header className="p-5 border-b border-afk-border bg-afk-surface/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-xs">
                        <span className="font-mono text-afk-gold">{v.ventureNumber}</span>
                        <Pill>{v.typeName}</Pill>
                      </p>
                      <h2 className="text-base font-bold text-afk-offwhite mt-1.5">{v.title}</h2>
                    </div>
                    <Pill tone="olive">{v.stage}</Pill>
                  </div>
                  {v.description && <p className="text-xs text-afk-secondary mt-2 line-clamp-2">{v.description}</p>}
                </header>

                <div className="p-5 space-y-5 flex-1">
                  <div>
                    <div className="flex items-baseline justify-between text-xs mb-1.5">
                      <span className="text-afk-secondary">Funding</span>
                      <span className="font-mono tabular-nums text-afk-offwhite">
                        {formatCompactBdt(v.actualCashRaised)} <span className="text-afk-muted">of {formatCompactBdt(v.targetBudget)}</span>
                      </span>
                    </div>
                    <ProgressBar value={funded} />
                  </div>

                  {mine && (
                    <div className="rounded-lg border border-afk-olive/40 bg-afk-olive-dark/40 p-3.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-afk-offwhite">
                          <CheckCircle2 className="w-3.5 h-3.5 text-afk-olive-accent" /> Your participation
                        </span>
                        <span className="font-mono text-2xs font-bold uppercase text-afk-gold">{mine.role || "INVESTOR"}</span>
                      </div>
                      <dl className="grid grid-cols-3 gap-2 pt-2.5 text-center">
                        {[
                          ["Invested", formatBdt(mine.actualCashContributed || mine.committedCapital || 0)],
                          ["Capital", `${mine.investmentPercentage ?? mine.investmentCommitment ?? "—"}%`],
                          ["Profit split", `${mine.profitSharingPercentage ?? mine.profitSharePct ?? "—"}%`],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <dt className="text-2xs text-afk-muted">{label}</dt>
                            <dd className="text-xs font-bold tabular-nums text-afk-offwhite mt-0.5">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}

                  {(prod.plannedQty || sales.unitsSold) && (
                    <div className="space-y-3 rounded-lg border border-afk-border bg-afk-surface p-3.5">
                      {prod.plannedQty ? (
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="inline-flex items-center gap-1.5 text-afk-secondary">
                              <Package className="w-3.5 h-3.5 text-afk-gold" /> Production
                            </span>
                            <span className="text-afk-offwhite">
                              {prod.completedQty ?? 0} / {prod.plannedQty} units · {prod.qcPassRate ?? 100}% QC pass
                            </span>
                          </div>
                          <ProgressBar value={made} tone="gold" />
                        </div>
                      ) : null}
                      {sales.unitsSold ? (
                        <p className="flex items-center justify-between text-xs">
                          <span className="inline-flex items-center gap-1.5 text-afk-secondary">
                            <TrendingUp className="w-3.5 h-3.5 text-afk-success" /> Sales
                          </span>
                          <span className="text-afk-offwhite">
                            {sales.unitsSold} sold · {formatBdt(sales.netSales ?? 0)}
                          </span>
                        </p>
                      ) : null}
                    </div>
                  )}

                  {v.performanceSummary && (
                    <p className="border-l-2 border-afk-olive pl-3 text-xs italic text-afk-muted">“{v.performanceSummary}”</p>
                  )}
                </div>

                <footer className="flex items-center justify-between border-t border-afk-border bg-afk-surface/20 px-5 py-3 text-2xs text-afk-muted">
                  <span>Start {formatDate(v.startDate)}</span>
                  <span>Target close {formatDate(v.targetDate)}</span>
                </footer>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
