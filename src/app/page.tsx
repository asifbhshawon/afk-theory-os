import { db } from "@/db";
import {
  paymentAccounts,
  accounts,
  journalEntries,
  journalLines,
  inventoryLots,
  partners,
} from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { getFinancialStatements } from "@/server/services/finance";
import Link from "next/link";
import {
  TrendingUp,
  Wallet,
  Package,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Clock,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const statements = await getFinancialStatements();
  const payAccounts = await db.select().from(paymentAccounts);
  const allAccounts = await db.select().from(accounts);

  // Map GL balance to payment account
  const walletCards = payAccounts.map((pa) => {
    const gl = statements.balanceSheet.assetAccounts.find((a) => a.id === pa.glAccountId);
    return {
      id: pa.id,
      name: pa.name,
      type: pa.type,
      balance: gl?.balance || 0,
      accountNumber: pa.accountNumber,
    };
  });

  const totalCashBank = walletCards.reduce((s, w) => s + w.balance, 0);

  // Calculate inventory at cost
  const rawMatGl = statements.balanceSheet.assetAccounts.find((a) => a.code === "1210");
  const wipGl = statements.balanceSheet.assetAccounts.find((a) => a.code === "1220");
  const finishedGl = statements.balanceSheet.assetAccounts.find((a) => a.code === "1230");
  const totalInventoryAtCost =
    (rawMatGl?.balance || 0) + (wipGl?.balance || 0) + (finishedGl?.balance || 0);

  // Recent 6 posted journals
  const recentJournals = await db
    .select({
      id: journalEntries.id,
      entryNumber: journalEntries.entryNumber,
      date: journalEntries.date,
      description: journalEntries.description,
      entryType: journalEntries.entryType,
      reference: journalEntries.reference,
    })
    .from(journalEntries)
    .where(eq(journalEntries.status, "POSTED"))
    .orderBy(desc(journalEntries.date))
    .limit(6);

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-afk-border">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-afk-offwhite">Executive Dashboard</h2>
          <p className="text-xs text-afk-muted mt-0.5">
            Real-time financial position derived from authoritative PostgreSQL double-entry general ledger.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/finance"
            className="px-3.5 py-1.5 bg-afk-olive hover:bg-afk-olive-light text-afk-offwhite text-xs font-medium rounded transition shadow-sm"
          >
            + New Journal Entry
          </Link>
          <Link
            href="/orders"
            className="px-3.5 py-1.5 bg-afk-surface hover:bg-afk-surfaceLight border border-afk-border text-afk-offwhite text-xs font-medium rounded transition"
          >
            + New Sales Order
          </Link>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Net Revenue */}
        <div className="bg-afk-charcoal p-4 rounded-lg border border-afk-border shadow-sm">
          <div className="flex items-center justify-between text-xs text-afk-muted">
            <span>Net Sales Revenue</span>
            <TrendingUp className="w-4 h-4 text-afk-success" />
          </div>
          <p className="text-xl md:text-2xl font-bold font-mono text-afk-offwhite mt-2">
            ৳{statements.incomeStatement.netRevenue.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-afk-muted mt-1">
            Gross: ৳{statements.incomeStatement.totalGrossRevenue.toLocaleString("en-BD")}
          </p>
        </div>

        {/* Gross Margin */}
        <div className="bg-afk-charcoal p-4 rounded-lg border border-afk-border shadow-sm">
          <div className="flex items-center justify-between text-xs text-afk-muted">
            <span>Gross Profit</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-afk-olive-muted text-afk-olive-accent font-mono">
              {statements.incomeStatement.netRevenue > 0
                ? `${Math.round((statements.incomeStatement.grossProfit / statements.incomeStatement.netRevenue) * 100)}%`
                : "0%"}
            </span>
          </div>
          <p className="text-xl md:text-2xl font-bold font-mono text-afk-offwhite mt-2">
            ৳{statements.incomeStatement.grossProfit.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-afk-muted mt-1">
            COGS: ৳{statements.incomeStatement.totalCogs.toLocaleString("en-BD")}
          </p>
        </div>

        {/* Net Profit */}
        <div className="bg-afk-charcoal p-4 rounded-lg border border-afk-border shadow-sm">
          <div className="flex items-center justify-between text-xs text-afk-muted">
            <span>Net Profit</span>
            {statements.incomeStatement.netProfit >= 0 ? (
              <ArrowUpRight className="w-4 h-4 text-afk-success" />
            ) : (
              <ArrowDownRight className="w-4 h-4 text-afk-danger" />
            )}
          </div>
          <p
            className={`text-xl md:text-2xl font-bold font-mono mt-2 ${
              statements.incomeStatement.netProfit >= 0 ? "text-afk-success" : "text-afk-danger"
            }`}
          >
            ৳{statements.incomeStatement.netProfit.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-afk-muted mt-1">
            OpEx: ৳{statements.incomeStatement.totalOperatingExpenses.toLocaleString("en-BD")}
          </p>
        </div>

        {/* Stock at Cost */}
        <div className="bg-afk-charcoal p-4 rounded-lg border border-afk-border shadow-sm">
          <div className="flex items-center justify-between text-xs text-afk-muted">
            <span>Stock Valuation (Cost)</span>
            <Package className="w-4 h-4 text-afk-gold" />
          </div>
          <p className="text-xl md:text-2xl font-bold font-mono text-afk-offwhite mt-2">
            ৳{totalInventoryAtCost.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-afk-muted mt-1">
            FG: ৳{(finishedGl?.balance || 0).toLocaleString("en-BD")} · WIP: ৳{(wipGl?.balance || 0).toLocaleString("en-BD")}
          </p>
        </div>
      </div>

      {/* Wallets & Cashbox Balances */}
      <div className="bg-afk-charcoal rounded-lg border border-afk-border p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-afk-olive-accent" />
            <h3 className="text-sm font-semibold text-afk-offwhite">Liquid Cash & Merchant Wallets</h3>
          </div>
          <span className="text-xs font-mono text-afk-muted">
            Total Liquid: <strong className="text-afk-offwhite">৳{totalCashBank.toLocaleString("en-BD", { minimumFractionDigits: 2 })}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {walletCards.map((wallet) => (
            <div
              key={wallet.id}
              className="bg-afk-surface p-3.5 rounded border border-afk-border flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-afk-muted">{wallet.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-afk-border/50 text-afk-offwhite font-mono uppercase">
                  {wallet.type}
                </span>
              </div>
              <div className="mt-3">
                <p className="text-lg font-bold font-mono text-afk-offwhite">
                  ৳{wallet.balance.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                </p>
                {wallet.accountNumber && (
                  <p className="text-[11px] text-afk-muted font-mono mt-0.5">
                    A/C: {wallet.accountNumber}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two Column Section: Partners & Recent Journals */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Five Founding Partners Summary */}
        <div className="lg:col-span-5 bg-afk-charcoal rounded-lg border border-afk-border p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-afk-olive-accent" />
              <h3 className="text-sm font-semibold text-afk-offwhite">Founding Partners (20% Initial)</h3>
            </div>
            <Link href="/partners" className="text-xs text-afk-olive-accent hover:underline">
              View Statements →
            </Link>
          </div>

          <div className="space-y-2 mt-4">
            {statements.partnerStatements.map((p) => (
              <div
                key={p.partnerId}
                className="flex items-center justify-between p-2.5 rounded bg-afk-surface border border-afk-border/60 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-afk-offwhite">{p.name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-afk-olive-dark text-afk-olive-accent font-mono">
                      {p.ownershipPct}% Equity
                    </span>
                  </div>
                  <p className="text-[11px] text-afk-muted mt-0.5">
                    Capital: ৳{p.capitalContributed.toLocaleString("en-BD")}
                    {p.loanBalanceOwedByCompany > 0 && ` · Loan: ৳${p.loanBalanceOwedByCompany.toLocaleString("en-BD")}`}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-afk-offwhite">
                    ৳{p.totalEquity.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                  </span>
                  <p className="text-[10px] text-afk-muted">Total Equity</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Ledger Postings */}
        <div className="lg:col-span-7 bg-afk-charcoal rounded-lg border border-afk-border p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-afk-olive-accent" />
              <h3 className="text-sm font-semibold text-afk-offwhite">Recent Posted Journals</h3>
            </div>
            <Link href="/finance" className="text-xs text-afk-olive-accent hover:underline">
              Full General Ledger →
            </Link>
          </div>

          <div className="overflow-x-auto mt-2">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-afk-border text-afk-muted">
                  <th className="py-2 font-medium">Ref / Number</th>
                  <th className="py-2 font-medium">Type</th>
                  <th className="py-2 font-medium">Description</th>
                  <th className="py-2 font-medium text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-afk-border/50">
                {recentJournals.map((j) => (
                  <tr key={j.id} className="hover:bg-afk-surface/40 transition">
                    <td className="py-2.5 font-mono text-afk-offwhite font-medium">
                      {j.entryNumber}
                    </td>
                    <td className="py-2.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-afk-border text-afk-muted">
                        {j.entryType}
                      </span>
                    </td>
                    <td className="py-2.5 text-afk-offwhite max-w-xs truncate">
                      {j.description}
                    </td>
                    <td className="py-2.5 text-right font-mono text-afk-muted">
                      {new Date(j.date).toLocaleDateString("en-BD", { month: "short", day: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
