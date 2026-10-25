import { db } from "@/lib/db";
import { portalPartnerStatements, portalVentures } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getCurrentPartner } from "@/lib/auth";
import { formatBdt, formatDate, formatDateTime } from "@/lib/format";
import {
  Wallet,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Briefcase,
  Clock,
  CheckCircle2,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MyInvestmentsPage() {
  const partner = await getCurrentPartner();
  if (!partner) return null;

  const [statement] = await db
    .select()
    .from(portalPartnerStatements)
    .where(eq(portalPartnerStatements.partnerId, partner.id))
    .limit(1);

  const capitalContributed = Number(statement?.capitalContributed || 0);
  const loanBalanceOwed = Number(statement?.loanBalanceOwed || 0);
  const drawings = Number(statement?.drawings || 0);
  const shareOfProfit = Number(statement?.shareOfProfit || 0);
  const totalEquity = Number(statement?.totalEquity || 0);
  const ventureContributions = Number(statement?.ventureContributions || 0);
  const ventureEntitlements = Number(statement?.ventureEntitlements || 0);
  const ownershipPct = statement?.ownershipPct || "20.00";
  const profitSharePct = statement?.profitSharePct || "20.00";
  const settlementHistory = Array.isArray(statement?.settlementHistory)
    ? statement.settlementHistory
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-3 border-b border-afk-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-afk-offwhite flex items-center gap-2">
            <span>My Financial Position & Investments</span>
            <span className="text-xs px-2 py-0.5 rounded bg-afk-surface border border-afk-border text-afk-gold font-semibold">
              {partner.name}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-afk-secondary mt-0.5">
            Personal equity, company loans, venture allocations and distribution history
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-afk-surface border border-afk-border text-xs text-afk-secondary flex items-center gap-2">
            <span>Ownership Share:</span>
            <span className="font-bold text-afk-offwhite">{ownershipPct}%</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-afk-surface border border-afk-border text-xs text-afk-secondary flex items-center gap-2">
            <span>Profit Share:</span>
            <span className="font-bold text-afk-olive-accent">{profitSharePct}%</span>
          </div>
        </div>
      </div>

      {/* Distinction Alert: Corporate Equity vs Project Ventures */}
      <div className="p-4 rounded-xl bg-afk-surface border border-afk-borderLight text-xs text-afk-secondary flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-afk-gold shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-afk-offwhite">
            Authoritative Segregation of Company Ownership vs. Project Ventures
          </p>
          <p className="mt-0.5 text-afk-muted leading-relaxed">
            Company equity represents your 20.00% founding partnership in AFK THEORY operations.
            Venture-specific investments represent independent project pools with agreed waterfall allocations.
            All numbers reflect posted general ledger journal entries.
          </p>
        </div>
      </div>

      {/* Primary Financial Position Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Net Partner Equity */}
        <div className="bg-afk-card p-5 rounded-xl border border-afk-border shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-afk-secondary">
            <span>Total Net Partner Equity</span>
            <Wallet className="w-4 h-4 text-afk-gold" />
          </div>
          <p className="text-2xl font-bold text-afk-gold mt-2 tabular-nums">
            {formatBdt(totalEquity)}
          </p>
          <p className="text-2xs text-afk-muted mt-1">
            Capital ({formatBdt(capitalContributed)}) − Drawings ({formatBdt(drawings)}) + Profit ({formatBdt(shareOfProfit)})
          </p>
        </div>

        {/* Due to Partner (Loans & Advances) */}
        <div className="bg-afk-card p-5 rounded-xl border border-afk-border shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-afk-secondary">
            <span>Outstanding Loans Due to Me</span>
            <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-2 tabular-nums">
            {formatBdt(loanBalanceOwed)}
          </p>
          <p className="text-2xs text-afk-muted mt-1">
            Reimbursable personal expenses and loan advances owed by the company
          </p>
        </div>

        {/* Drawings / Withdrawals */}
        <div className="bg-afk-card p-5 rounded-xl border border-afk-border shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-afk-secondary">
            <span>Historical Partner Drawings</span>
            <ArrowUpRight className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-400 mt-2 tabular-nums">
            {formatBdt(drawings)}
          </p>
          <p className="text-2xs text-afk-muted mt-1">
            Personal cash drawings and profit advances disbursed
          </p>
        </div>
      </div>

      {/* Venture Participation Summary */}
      <div className="bg-afk-card p-5 rounded-xl border border-afk-border shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-afk-border">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-afk-olive-accent" />
            <h2 className="text-sm font-bold text-afk-offwhite">
              Venture-Specific Investments & Entitlements
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div className="p-4 rounded-lg bg-afk-surface border border-afk-border">
            <span className="text-xs text-afk-secondary block">
              Total Contributed to Dedicated Ventures
            </span>
            <span className="text-xl font-bold text-afk-offwhite block mt-1 tabular-nums">
              {formatBdt(ventureContributions)}
            </span>
            <span className="text-2xs text-afk-muted block mt-1">
              Direct cash contributions pledged and confirmed into segregated project pools
            </span>
          </div>

          <div className="p-4 rounded-lg bg-afk-surface border border-afk-border">
            <span className="text-xs text-afk-secondary block">
              Undistributed Venture Entitlements
            </span>
            <span className="text-xl font-bold text-afk-gold block mt-1 tabular-nums">
              {formatBdt(ventureEntitlements)}
            </span>
            <span className="text-2xs text-afk-muted block mt-1">
              Calculated waterfall profits and capital recovery ready for disbursement
            </span>
          </div>
        </div>
      </div>

      {/* Settlement & Payout History Table */}
      <div className="bg-afk-card p-5 rounded-xl border border-afk-border shadow-sm">
        <h2 className="text-sm font-bold text-afk-offwhite pb-3 border-b border-afk-border">
          Partner Settlement & Distribution History
        </h2>

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-afk-border text-afk-secondary">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Transaction / Description</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-afk-border">
              {settlementHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-afk-muted">
                    No individual distribution or settlement transactions recorded.
                  </td>
                </tr>
              ) : (
                settlementHistory.map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-afk-surface/40 transition">
                    <td className="py-3 px-3 text-afk-muted font-mono">
                      {formatDate(item.date)}
                    </td>
                    <td className="py-3 px-3 font-medium text-afk-offwhite">
                      {item.description || "Partner Settlement"}
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-2xs px-2 py-0.5 rounded bg-afk-surface border border-afk-border text-afk-secondary uppercase">
                        {item.type || "SETTLEMENT"}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-bold tabular-nums text-afk-offwhite">
                      {formatBdt(item.amount)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="text-2xs px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 font-medium">
                        {item.status || "CONFIRMED"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
