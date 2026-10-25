import { db } from "@/lib/db";
import {
  portalBusinessSummaries,
  portalPaymentAccounts,
  portalPartnerStatements,
  portalVentures,
  portalManufacturingBatches,
  portalInventoryAlerts,
  portalActivityFeed,
  portalCalendarEntries,
} from "@/lib/schema";
import { eq, desc, asc, and, gte, inArray } from "drizzle-orm";
import { getCurrentPartner, hasVentureAccess } from "@/lib/auth";
import { formatBdt, formatCompactBdt, formatDate, formatDateTime } from "@/lib/format";
import Link from "next/link";
import {
  TrendingUp,
  Wallet,
  Package,
  Factory,
  Truck,
  Briefcase,
  Calendar,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  DollarSign,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const partner = await getCurrentPartner();
  if (!partner) return null;

  // 1. Fetch latest business overview snapshot
  const [summary] = await db
    .select()
    .from(portalBusinessSummaries)
    .where(eq(portalBusinessSummaries.id, "latest"))
    .limit(1);

  // Fallback defaults if sync hasn't run yet
  const netRevenue = Number(summary?.netRevenue || 0);
  const grossRevenue = Number(summary?.grossRevenue || 0);
  const grossProfit = Number(summary?.grossProfit || 0);
  const operatingExpenses = Number(summary?.operatingExpenses || 0);
  const netProfit = Number(summary?.netProfit || 0);
  const availableCash = Number(summary?.availableCash || 0);
  const totalInventoryValue = Number(summary?.totalInventoryValue || 0);
  const courierCodReceivable = Number(summary?.courierCodReceivable || 0);
  const courierPendingSettlements = Number(summary?.courierPendingSettlements || 0);

  // 2. Fetch payment account wallet balances
  const wallets = await db
    .select()
    .from(portalPaymentAccounts)
    .where(eq(portalPaymentAccounts.isActive, true));

  // 3. Fetch personally scoped partner statement
  const [partnerStatement] = await db
    .select()
    .from(portalPartnerStatements)
    .where(eq(portalPartnerStatements.partnerId, partner.id))
    .limit(1);

  // 4. Fetch ventures permitted for this partner
  const allVentures = await db
    .select()
    .from(portalVentures)
    .orderBy(desc(portalVentures.updatedAt));

  const permittedVentures = allVentures.filter((v) =>
    hasVentureAccess(partner, v.ventureNumber)
  );

  // 5. Fetch active manufacturing batches
  const activeBatches = await db
    .select()
    .from(portalManufacturingBatches)
    .orderBy(asc(portalManufacturingBatches.targetDate))
    .limit(4);

  // 6. Fetch low-stock inventory alerts
  const inventoryAlerts = await db
    .select()
    .from(portalInventoryAlerts)
    .limit(4);

  // 7. Fetch business activity feed
  const recentActivities = await db
    .select()
    .from(portalActivityFeed)
    .orderBy(desc(portalActivityFeed.timestamp))
    .limit(6);

  // 8. Fetch upcoming deadlines / meetings from calendar
  const upcomingDeadlines = await db
    .select()
    .from(portalCalendarEntries)
    .where(
      and(
        eq(portalCalendarEntries.isArchived, false),
        gte(portalCalendarEntries.startDate, new Date())
      )
    )
    .orderBy(asc(portalCalendarEntries.startDate))
    .limit(4);

  return (
    <div className="space-y-6">
      {/* Top Welcome & Executive Summary Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-afk-border">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-afk-offwhite flex items-center gap-2">
            <span>Executive Business Overview</span>
            <span className="text-xs px-2 py-0.5 rounded bg-afk-surface border border-afk-border text-afk-secondary font-normal">
              {partner.name}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-afk-secondary mt-0.5">
            Synchronized cloud read model from AFK THEORY Business OS
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Link
            href="/calendar?action=new"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-afk-olive hover:bg-afk-olive-light text-afk-offwhite text-xs font-semibold shadow-sm transition"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>+ Calendar Note</span>
          </Link>
          <Link
            href="/my-investments"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-afk-surface hover:bg-afk-elevated border border-afk-border text-afk-offwhite text-xs font-semibold shadow-sm transition"
          >
            <Wallet className="w-3.5 h-3.5 text-afk-gold" />
            <span>My Financials</span>
          </Link>
        </div>
      </div>

      {/* Primary KPI Grid (High Contrast, Readable Numbers, BDT Currency) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Revenue */}
        <div className="bg-afk-card p-4 sm:p-5 rounded-xl border border-afk-border shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-afk-secondary">
            <span>Net Sales Revenue</span>
            <TrendingUp className="w-4 h-4 text-afk-success" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-afk-offwhite mt-2 tabular-nums">
            {formatBdt(netRevenue)}
          </p>
          <p className="text-2xs text-afk-muted mt-1">
            Gross Sales: {formatBdt(grossRevenue)}
          </p>
        </div>

        {/* Available Cash & Bank */}
        <div className="bg-afk-card p-4 sm:p-5 rounded-xl border border-afk-border shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-afk-secondary">
            <span>Available Liquid Cash</span>
            <Wallet className="w-4 h-4 text-afk-gold" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-afk-offwhite mt-2 tabular-nums text-afk-gold">
            {formatBdt(availableCash)}
          </p>
          <p className="text-2xs text-afk-muted mt-1">
            Across Cash, Bank, bKash & Nagad
          </p>
        </div>

        {/* Total Inventory Value */}
        <div className="bg-afk-card p-4 sm:p-5 rounded-xl border border-afk-border shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-afk-secondary">
            <span>Stock Valuation (Cost)</span>
            <Package className="w-4 h-4 text-afk-olive-accent" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-afk-offwhite mt-2 tabular-nums">
            {formatBdt(totalInventoryValue)}
          </p>
          <p className="text-2xs text-afk-muted mt-1">
            Materials, WIP & Finished Garments
          </p>
        </div>

        {/* Courier COD Pending */}
        <div className="bg-afk-card p-4 sm:p-5 rounded-xl border border-afk-border shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-afk-secondary">
            <span>Courier COD Receivable</span>
            <Truck className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-afk-offwhite mt-2 tabular-nums text-cyan-300">
            {formatBdt(courierCodReceivable)}
          </p>
          <p className="text-2xs text-afk-muted mt-1">
            Pending Steadfast & Pathao remittance
          </p>
        </div>
      </div>

      {/* Partner Personal Financial Position Preview */}
      <div className="bg-gradient-to-r from-afk-card via-afk-surface to-afk-card p-5 rounded-xl border border-afk-border shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-afk-borderLight">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-afk-olive/20 text-afk-olive-accent">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-afk-offwhite">
                My Financial Position ({partner.name})
              </h2>
              <p className="text-2xs text-afk-secondary">
                Authoritative personal equity statement derived from ERP posted journal entries
              </p>
            </div>
          </div>
          <Link
            href="/my-investments"
            className="flex items-center gap-1 text-xs text-afk-gold hover:text-amber-300 font-medium transition self-start sm:self-auto"
          >
            <span>View Detailed Statement</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 text-center">
          <div className="p-3 rounded-lg bg-afk-black/40 border border-afk-border">
            <span className="text-2xs text-afk-muted uppercase tracking-wider block">Capital Contributed</span>
            <span className="text-sm sm:text-base font-bold text-afk-offwhite block mt-1 tabular-nums">
              {formatBdt(partnerStatement?.capitalContributed || 0)}
            </span>
          </div>
          <div className="p-3 rounded-lg bg-afk-black/40 border border-afk-border">
            <span className="text-2xs text-afk-muted uppercase tracking-wider block">Due to Me (Loans)</span>
            <span className="text-sm sm:text-base font-bold text-emerald-400 block mt-1 tabular-nums">
              {formatBdt(partnerStatement?.loanBalanceOwed || 0)}
            </span>
          </div>
          <div className="p-3 rounded-lg bg-afk-black/40 border border-afk-border">
            <span className="text-2xs text-afk-muted uppercase tracking-wider block">Drawings / Withdrawals</span>
            <span className="text-sm sm:text-base font-bold text-amber-400 block mt-1 tabular-nums">
              {formatBdt(partnerStatement?.drawings || 0)}
            </span>
          </div>
          <div className="p-3 rounded-lg bg-afk-black/40 border border-afk-border">
            <span className="text-2xs text-afk-muted uppercase tracking-wider block">Share of Net Profit</span>
            <span className="text-sm sm:text-base font-bold text-afk-offwhite block mt-1 tabular-nums">
              {formatBdt(partnerStatement?.shareOfProfit || 0)}
            </span>
          </div>
          <div className="col-span-2 sm:col-span-1 p-3 rounded-lg bg-afk-olive-dark/40 border border-afk-olive/50">
            <span className="text-2xs text-afk-olive-accent font-semibold uppercase tracking-wider block">Total Net Equity</span>
            <span className="text-sm sm:text-base font-bold text-afk-gold block mt-1 tabular-nums">
              {formatBdt(partnerStatement?.totalEquity || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Two Column Grid: Permitted Ventures & Manufacturing Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Permitted Ventures Card */}
        <div className="bg-afk-card p-5 rounded-xl border border-afk-border shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-afk-border">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-afk-olive-accent" />
                <h3 className="text-sm font-bold text-afk-offwhite">
                  Permitted Ventures & Drops ({permittedVentures.length})
                </h3>
              </div>
              <Link
                href="/ventures"
                className="text-2xs text-afk-secondary hover:text-afk-offwhite flex items-center gap-0.5"
              >
                <span>View all</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="divide-y divide-afk-border mt-2">
              {permittedVentures.length === 0 ? (
                <p className="text-xs text-afk-muted py-6 text-center">
                  No active ventures assigned to this partner account.
                </p>
              ) : (
                permittedVentures.slice(0, 3).map((v) => (
                  <div key={v.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-afk-offwhite">
                          {v.title}
                        </span>
                        <span className="text-2xs font-mono text-afk-muted">
                          {v.ventureNumber}
                        </span>
                      </div>
                      <span className="text-2xs text-afk-secondary">
                        Budget: {formatBdt(v.targetBudget)} • Raised: {formatBdt(v.actualCashRaised)}
                      </span>
                    </div>
                    <span className="text-2xs px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide bg-afk-surface border border-afk-border text-afk-olive-accent">
                      {v.stage}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-afk-border mt-3">
            <span className="text-2xs text-afk-muted">
              Distributions strictly derived from ERP waterfall allocations.
            </span>
          </div>
        </div>

        {/* Manufacturing & Factory Production Progress */}
        <div className="bg-afk-card p-5 rounded-xl border border-afk-border shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-afk-border">
              <div className="flex items-center gap-2">
                <Factory className="w-4 h-4 text-afk-gold" />
                <h3 className="text-sm font-bold text-afk-offwhite">
                  Factory Manufacturing Batches
                </h3>
              </div>
              <span className="text-2xs px-2 py-0.5 rounded bg-afk-surface text-afk-secondary font-mono">
                {activeBatches.length} Active
              </span>
            </div>

            <div className="divide-y divide-afk-border mt-2">
              {activeBatches.length === 0 ? (
                <p className="text-xs text-afk-muted py-6 text-center">
                  No active manufacturing batches in factory production.
                </p>
              ) : (
                activeBatches.map((b) => (
                  <div key={b.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-afk-offwhite">
                          {b.productName}
                        </span>
                        <span className="text-2xs text-afk-muted font-mono">
                          {b.orderNumber}
                        </span>
                      </div>
                      <div className="text-2xs text-afk-secondary mt-0.5">
                        Planned: {b.plannedQuantity} pcs • Finished Good: {b.completedGoodQuantity} pcs
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-2xs px-2 py-0.5 rounded bg-afk-surface border border-afk-border text-afk-gold font-semibold uppercase">
                        {b.status}
                      </span>
                      {b.targetDate && (
                        <p className="text-2xs text-afk-muted mt-1">
                          Due {formatDate(b.targetDate)}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Low stock alerts indicator */}
          {inventoryAlerts.length > 0 && (
            <div className="pt-3 border-t border-afk-border mt-3 flex items-center gap-2 text-2xs text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>
                {inventoryAlerts.length} variant(s) below safety stock reorder level.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Business Activity Feed & Upcoming Shared Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Business Activity Feed (2 Cols) */}
        <div className="lg:col-span-2 bg-afk-card p-5 rounded-xl border border-afk-border shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-afk-border">
            <h3 className="text-sm font-bold text-afk-offwhite flex items-center gap-2">
              <span>Sanitized Business Activity Feed</span>
            </h3>
            <Link
              href="/updates"
              className="text-2xs text-afk-secondary hover:text-afk-offwhite flex items-center gap-0.5"
            >
              <span>View all updates</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="divide-y divide-afk-border mt-3">
            {recentActivities.length === 0 ? (
              <p className="text-xs text-afk-muted py-8 text-center">
                No recent business activities recorded.
              </p>
            ) : (
              recentActivities.map((act) => (
                <div key={act.id} className="py-3 flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-afk-surface border border-afk-border text-afk-olive-accent shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-afk-offwhite truncate">
                        {act.title}
                      </span>
                      <span className="text-2xs text-afk-muted shrink-0">
                        {formatDateTime(act.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs text-afk-secondary mt-0.5">
                      {act.description}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming Shared Deadlines & Meetings (1 Col) */}
        <div className="bg-afk-card p-5 rounded-xl border border-afk-border shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-afk-border">
              <h3 className="text-sm font-bold text-afk-offwhite flex items-center gap-2">
                <Calendar className="w-4 h-4 text-afk-olive-accent" />
                <span>Upcoming Activities</span>
              </h3>
              <Link
                href="/calendar"
                className="text-2xs text-afk-secondary hover:text-afk-offwhite"
              >
                Open Calendar
              </Link>
            </div>

            <div className="space-y-3 mt-3">
              {upcomingDeadlines.length === 0 ? (
                <p className="text-xs text-afk-muted py-6 text-center">
                  No upcoming deadlines or meetings scheduled.
                </p>
              ) : (
                upcomingDeadlines.map((e) => (
                  <div
                    key={e.id}
                    className="p-3 rounded-lg bg-afk-surface border border-afk-border space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-afk-offwhite truncate">
                        {e.title}
                      </span>
                      <span className="text-2xs font-mono text-afk-gold">
                        {e.entryType}
                      </span>
                    </div>
                    <p className="text-2xs text-afk-muted flex items-center gap-1">
                      <Clock className="w-3 h-3 text-afk-secondary" />
                      <span>{formatDateTime(e.startDate)}</span>
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-afk-border mt-3">
            <Link
              href="/calendar?action=new"
              className="w-full block py-2 text-center rounded-lg bg-afk-surface hover:bg-afk-elevated border border-afk-border text-xs font-medium text-afk-offwhite transition"
            >
              + Add Partner Note or Meeting
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
