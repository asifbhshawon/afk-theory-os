import { db } from "@/db";
import {
  paymentAccounts,
  accounts,
  journalEntries,
  productionOrders,
  partners,
} from "@/db/schema";
import { eq, desc, asc, and } from "drizzle-orm";
import { getFinancialStatements } from "@/server/services/finance";
import { getUpcomingDeadlinesAndTasks } from "@/server/services/calendar";
import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";
import {
  TrendingUp,
  Wallet,
  Package,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Calendar,
  AlertCircle,
  CheckSquare,
  Factory,
  PlusCircle,
  ChevronRight,
  ShoppingBag,
} from "lucide-react";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const statements = await getFinancialStatements();
  const payAccounts = await db.select().from(paymentAccounts);
  const calendarSummary = await getUpcomingDeadlinesAndTasks(user?.id);

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

  // Active production batches in factory
  const activeProduction = await db
    .select({
      id: productionOrders.id,
      orderNumber: productionOrders.orderNumber,
      routeType: productionOrders.routeType,
      status: productionOrders.status,
      plannedQuantity: productionOrders.plannedQuantity,
      completedGoodQuantity: productionOrders.completedGoodQuantity,
      targetDate: productionOrders.targetDate,
    })
    .from(productionOrders)
    .where(eq(productionOrders.status, "IN_PRODUCTION"))
    .orderBy(asc(productionOrders.targetDate))
    .limit(4);

  // Recent 5 posted journals
  const recentJournals = await db
    .select({
      id: journalEntries.id,
      entryNumber: journalEntries.entryNumber,
      date: journalEntries.date,
      description: journalEntries.description,
      entryType: journalEntries.entryType,
    })
    .from(journalEntries)
    .where(eq(journalEntries.status, "POSTED"))
    .orderBy(desc(journalEntries.date))
    .limit(5);

  return (
    <div className="space-y-6 select-none">
      {/* Top Banner & Quick Operations Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-afk-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-afk-offwhite">
            Executive Business Dashboard
          </h1>
          <p className="text-sm text-afk-secondary mt-0.5">
            Real-time financial position, drops schedule, factory production & liquid cash
          </p>
        </div>

        {/* Quick Actions Launcher */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href="/calendar?action=new"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-afk-olive hover:bg-afk-olive-light text-afk-offwhite text-xs font-semibold rounded-lg shadow-sm transition"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>+ Calendar Activity</span>
          </Link>
          <Link
            href="/finance?action=new-expense"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-afk-surface hover:bg-afk-elevated border border-afk-border text-afk-offwhite text-xs font-semibold rounded-lg shadow-sm transition"
          >
            <Wallet className="w-3.5 h-3.5 text-afk-gold" />
            <span>+ Record Expense</span>
          </Link>
          <Link
            href="/orders#new-order"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-afk-surface hover:bg-afk-elevated border border-afk-border text-afk-offwhite text-xs font-semibold rounded-lg shadow-sm transition"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
            <span>+ Sales Order</span>
          </Link>
        </div>
      </div>

      {/* Primary KPI Grid (High Contrast, Readable Fonts, Tabular Numbers) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Revenue */}
        <div className="bg-afk-card p-5 rounded-xl border border-afk-border shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-afk-secondary">
            <span>Net Sales Revenue</span>
            <TrendingUp className="w-4 h-4 text-afk-success" />
          </div>
          <p className="text-2xl font-bold tabular-nums text-afk-offwhite mt-2">
            ৳{statements.incomeStatement.netRevenue.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-afk-muted mt-1">
            Gross: ৳{statements.incomeStatement.totalGrossRevenue.toLocaleString("en-BD")}
          </p>
        </div>

        {/* Gross Margin */}
        <div className="bg-afk-card p-5 rounded-xl border border-afk-border shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-afk-secondary">
            <span>Gross Profit</span>
            <span className="text-xs px-2 py-0.5 rounded-md bg-afk-olive-muted text-afk-olive-accent font-semibold font-mono">
              {statements.incomeStatement.netRevenue > 0
                ? `${Math.round((statements.incomeStatement.grossProfit / statements.incomeStatement.netRevenue) * 100)}%`
                : "0%"}
            </span>
          </div>
          <p className="text-2xl font-bold tabular-nums text-afk-offwhite mt-2">
            ৳{statements.incomeStatement.grossProfit.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-afk-muted mt-1">
            COGS: ৳{statements.incomeStatement.totalCogs.toLocaleString("en-BD")}
          </p>
        </div>

        {/* Net Profit */}
        <div className="bg-afk-card p-5 rounded-xl border border-afk-border shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-afk-secondary">
            <span>Net Profit</span>
            {statements.incomeStatement.netProfit >= 0 ? (
              <ArrowUpRight className="w-4 h-4 text-afk-success" />
            ) : (
              <ArrowDownRight className="w-4 h-4 text-afk-danger" />
            )}
          </div>
          <p
            className={`text-2xl font-bold tabular-nums mt-2 ${
              statements.incomeStatement.netProfit >= 0 ? "text-afk-success" : "text-afk-danger"
            }`}
          >
            ৳{statements.incomeStatement.netProfit.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-afk-muted mt-1">
            OpEx: ৳{statements.incomeStatement.totalOperatingExpenses.toLocaleString("en-BD")}
          </p>
        </div>

        {/* Stock Valuation */}
        <div className="bg-afk-card p-5 rounded-xl border border-afk-border shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-afk-secondary">
            <span>Stock Valuation (Cost)</span>
            <Package className="w-4 h-4 text-afk-gold" />
          </div>
          <p className="text-2xl font-bold tabular-nums text-afk-offwhite mt-2">
            ৳{totalInventoryAtCost.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-afk-muted mt-1">
            FG: ৳{(finishedGl?.balance || 0).toLocaleString("en-BD")} · WIP: ৳{(wipGl?.balance || 0).toLocaleString("en-BD")}
          </p>
        </div>
      </div>

      {/* Two-Column Section: Schedule/Deadlines & Liquid Wallets */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Today's Schedule & Approaching Deadlines */}
        <div className="lg:col-span-7 bg-afk-card rounded-xl border border-afk-border p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-afk-border pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-afk-olive-accent" />
              <h2 className="text-base font-bold text-afk-offwhite">
                Today&apos;s Schedule & Deadlines
              </h2>
            </div>
            <Link
              href="/calendar"
              className="text-xs font-semibold text-afk-olive-accent hover:underline flex items-center gap-1"
            >
              <span>Full Calendar & Planner</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Today's Agenda */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-afk-muted mb-2">
              Today&apos;s Activities ({calendarSummary.todayEntries.length})
            </h3>
            {calendarSummary.todayEntries.length === 0 ? (
              <div className="p-3.5 rounded-lg bg-afk-surface/60 border border-afk-border text-xs text-afk-muted flex items-center justify-between">
                <span>No activities scheduled for today.</span>
                <Link
                  href="/calendar?action=new"
                  className="text-afk-olive-accent font-semibold hover:underline"
                >
                  + Add note
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {calendarSummary.todayEntries.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg bg-afk-surface border border-afk-border flex items-center justify-between"
                    style={{
                      borderLeftWidth: "3px",
                      borderLeftColor: item.categoryColor || "#7D9472",
                    }}
                  >
                    <div>
                      <p className="text-sm font-semibold text-afk-offwhite">{item.title}</p>
                      <p className="text-xs text-afk-muted mt-0.5">
                        {item.categoryName || "General"} · {item.entryType}
                      </p>
                    </div>
                    {!item.isAllDay && (
                      <span className="font-mono text-xs text-afk-secondary">
                        {format(new Date(item.startDate), "HH:mm")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming 7-Day Deadlines */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-afk-muted mb-2">
              Approaching Deadlines (Next 7 Days)
            </h3>
            {calendarSummary.upcomingDeadlines.length === 0 ? (
              <p className="text-xs text-afk-muted italic">No upcoming deadlines.</p>
            ) : (
              <div className="space-y-2">
                {calendarSummary.upcomingDeadlines.slice(0, 3).map((dl) => (
                  <div
                    key={dl.id}
                    className="p-2.5 rounded-lg bg-afk-surface/80 border border-afk-border flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-afk-warning shrink-0" />
                      <span className="text-xs font-semibold text-afk-offwhite">{dl.title}</span>
                    </div>
                    <span className="text-xs font-mono text-afk-secondary">
                      {format(new Date(dl.startDate), "EEE, MMM d")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (5 cols): Liquid Cash & Wallets */}
        <div className="lg:col-span-5 bg-afk-card rounded-xl border border-afk-border p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-afk-border pb-3">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-afk-olive-accent" />
              <h2 className="text-base font-bold text-afk-offwhite">Liquid Wallets</h2>
            </div>
            <span className="text-xs font-semibold text-afk-secondary">
              Total: <strong className="text-afk-offwhite tabular-nums">৳{totalCashBank.toLocaleString("en-BD", { minimumFractionDigits: 2 })}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {walletCards.map((wallet) => (
              <div
                key={wallet.id}
                className="bg-afk-surface p-3.5 rounded-lg border border-afk-border flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-afk-secondary truncate">{wallet.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-afk-border text-afk-muted font-mono uppercase">
                    {wallet.type}
                  </span>
                </div>
                <div className="mt-2.5">
                  <p className="text-lg font-bold tabular-nums text-afk-offwhite">
                    ৳{wallet.balance.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                  </p>
                  {wallet.accountNumber && (
                    <p className="text-[11px] text-afk-muted font-mono mt-0.5">
                      {wallet.accountNumber}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Quick link to finance */}
          <div className="pt-2">
            <Link
              href="/finance"
              className="text-xs text-afk-olive-accent font-semibold hover:underline flex items-center gap-1"
            >
              <span>Manage general ledger & transfers →</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Lower Two-Column Section: Manufacturing WIP & Recent Ledger Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Production WIP Batches */}
        <div className="lg:col-span-5 bg-afk-card rounded-xl border border-afk-border p-5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between border-b border-afk-border pb-3">
            <div className="flex items-center gap-2">
              <Factory className="w-5 h-5 text-afk-olive-accent" />
              <h2 className="text-base font-bold text-afk-offwhite">Production Due Soon</h2>
            </div>
            <Link href="/manufacturing" className="text-xs text-afk-olive-accent font-semibold hover:underline">
              Factory WIP →
            </Link>
          </div>

          {activeProduction.length === 0 ? (
            <p className="text-xs text-afk-muted italic py-3">No active manufacturing batches in WIP.</p>
          ) : (
            <div className="space-y-2.5">
              {activeProduction.map((batch) => (
                <div
                  key={batch.id}
                  className="p-3 rounded-lg bg-afk-surface border border-afk-border flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-afk-offwhite font-mono">{batch.orderNumber}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-afk-border text-afk-muted">
                        {batch.routeType}
                      </span>
                    </div>
                    <p className="text-[11px] text-afk-secondary mt-0.5">
                      Progress: {batch.completedGoodQuantity} / {batch.plannedQuantity} units
                    </p>
                  </div>
                  {batch.targetDate && (
                    <span className="font-mono text-afk-secondary text-right">
                      Due {format(new Date(batch.targetDate), "MMM d")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Posted Journals */}
        <div className="lg:col-span-7 bg-afk-card rounded-xl border border-afk-border p-5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between border-b border-afk-border pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-afk-olive-accent" />
              <h2 className="text-base font-bold text-afk-offwhite">Recent Posted Journals</h2>
            </div>
            <Link href="/finance" className="text-xs text-afk-olive-accent font-semibold hover:underline">
              Full General Ledger →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-afk-border text-afk-muted">
                  <th className="py-2.5 font-medium">Ref Number</th>
                  <th className="py-2.5 font-medium">Type</th>
                  <th className="py-2.5 font-medium">Description</th>
                  <th className="py-2.5 font-medium text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-afk-border/40">
                {recentJournals.map((j) => (
                  <tr key={j.id} className="hover:bg-afk-surface/40 transition">
                    <td className="py-2.5 font-mono text-afk-offwhite font-medium">
                      {j.entryNumber}
                    </td>
                    <td className="py-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-afk-surface border border-afk-border text-afk-secondary">
                        {j.entryType}
                      </span>
                    </td>
                    <td className="py-2.5 text-afk-offwhite max-w-xs truncate">
                      {j.description}
                    </td>
                    <td className="py-2.5 text-right font-mono text-afk-secondary">
                      {format(new Date(j.date), "MMM d")}
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
