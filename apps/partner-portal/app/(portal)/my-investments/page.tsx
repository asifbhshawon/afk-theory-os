import { ArrowDownLeft, ArrowUpRight, Briefcase, ShieldCheck, Wallet } from "lucide-react";
import { getCurrentPartner } from "@/lib/auth";
import { getAllPartnerStatements } from "@/lib/portal-data-misc";
import { formatBdt } from "@/lib/format";
import { Card, CardHeader, PageHeader, Pill } from "@/components/ui/primitives";
import { StatCard } from "@/components/ui/StatCard";
import { PartnerSettlementHistoryView } from "@/components/PartnerSettlementHistoryView";

export const dynamic = "force-dynamic";

export default async function MyInvestmentsPage() {
  const partner = await getCurrentPartner();
  if (!partner) return null;

  // Cached for the whole portal: one query per sync, not per page view
  const allStatements = await getAllPartnerStatements();
  const statement = allStatements.find((s) => s.partnerId === partner.id) ?? allStatements[0];

  const capital = Number(statement?.capitalContributed ?? 0);
  const loans = Number(statement?.loanBalanceOwed ?? 0);
  const drawings = Number(statement?.drawings ?? 0);
  const profit = Number(statement?.shareOfProfit ?? 0);
  const equity = Number(statement?.totalEquity ?? 0);
  const ventureIn = Number(statement?.ventureContributions ?? 0);
  const ventureDue = Number(statement?.ventureEntitlements ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My investments"
        subtitle="Your equity, company loans, venture allocations and distribution history"
        badge={<Pill tone="gold">{partner.name}</Pill>}
      >
        <div className="flex items-center gap-2">
          <Pill>Ownership {statement?.ownershipPct ?? "20.00"}%</Pill>
          <Pill tone="olive">Profit share {statement?.profitSharePct ?? "20.00"}%</Pill>
        </div>
      </PageHeader>

      <div className="flex items-start gap-3 rounded-xl border border-afk-borderLight bg-afk-surface p-4 text-xs text-afk-secondary">
        <ShieldCheck className="w-5 h-5 text-afk-gold shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-afk-offwhite">Company ownership and project ventures are kept separate</p>
          <p className="mt-0.5 text-afk-muted leading-relaxed">
            Company equity is your founding partnership in AFK THEORY. Venture investments are independent project pools with their own
            profit-sharing rules. Every figure comes from posted ledger entries.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          label="Total net equity"
          value={formatBdt(equity)}
          hint={`Capital ${formatBdt(capital)} − drawings ${formatBdt(drawings)} + profit ${formatBdt(profit)}`}
          icon={Wallet}
        />
        <StatCard label="Loans due to me" value={formatBdt(loans)} hint="Reimbursable expenses and advances owed by the company" icon={ArrowDownLeft} />
        <StatCard label="Drawings to date" value={formatBdt(drawings)} hint="Cash drawings and profit advances taken" icon={ArrowUpRight} />
      </div>

      <Card>
        <CardHeader title="Venture investments & entitlements" subtitle="Segregated project pools" icon={Briefcase} />
        <dl className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-lg border border-afk-border bg-afk-surface p-4">
            <dt className="text-xs text-afk-secondary">Contributed to ventures</dt>
            <dd className="text-xl font-bold tabular-nums text-afk-offwhite mt-1">{formatBdt(ventureIn)}</dd>
            <p className="text-2xs text-afk-muted mt-1">Confirmed cash put into dedicated project pools</p>
          </div>
          <div className="rounded-lg border border-afk-border bg-afk-surface p-4">
            <dt className="text-xs text-afk-secondary">Undistributed entitlements</dt>
            <dd className="text-xl font-bold tabular-nums text-afk-gold mt-1">{formatBdt(ventureDue)}</dd>
            <p className="text-2xs text-afk-muted mt-1">Waterfall profit and capital recovery ready to pay out</p>
          </div>
        </dl>
      </Card>

      <PartnerSettlementHistoryView currentPartner={partner} allStatements={allStatements as any} />
    </div>
  );
}
