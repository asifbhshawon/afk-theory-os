import Link from "next/link";
import { and, asc, eq, gte } from "drizzle-orm";
import {
  AlertTriangle,
  Banknote,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  Factory,
  PackageCheck,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Truck,
  Wallet,
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { db } from "@/lib/db";
import { portalCalendarEntries } from "@/lib/schema";
import { getCurrentPartner, hasVentureAccess } from "@/lib/auth";
import {
  getDailyMetrics,
  getOverviewSnapshot,
  getPartnerStatement,
  getSalesOrders,
  getTransactions,
} from "@/lib/portal-data";
import {
  balanceSeries,
  netProfitOf,
  parseRange,
  pctChange,
  revenueOf,
  splitPeriods,
  sumBy,
} from "@/lib/analytics";
import { formatBdt, formatCompactBdt, formatDate, formatDateTime } from "@/lib/format";
import { AreaChart } from "@/components/charts/AreaChart";
import { Donut } from "@/components/charts/Donut";
import { CATEGORY_PALETTE, CHART_COLORS } from "@/components/charts/chart-utils";
import { Card, CardHeader, EmptyState, Pill, ProgressBar, orderStatusTone } from "@/components/ui/primitives";
import { StatCard } from "@/components/ui/StatCard";
import { PeriodPicker } from "@/components/ui/PeriodPicker";

export const dynamic = "force-dynamic";

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Dhaka" }).format(new Date())
  );
  return hour < 5 ? "Good night" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  const partner = await getCurrentPartner();
  if (!partner) return null;

  const days = parseRange((await searchParams).range);
  const now = new Date();

  // Everything below except the calendar is served from the tagged cache
  const [snapshot, daily, statement, recentOrders, toShipOrders, recentMoney] = await Promise.all([
    getOverviewSnapshot(),
    getDailyMetrics(days * 2),
    getPartnerStatement(partner.id),
    getSalesOrders({ limit: 6 }),
    getSalesOrders({ status: "CONFIRMED", limit: 200 }),
    getTransactions({ limit: 6 }),
  ]);

  const summary = snapshot.summary;
  const hasDaily = daily.length > 0;
  const { current, previous } = splitPeriods(daily, days, now);
  const labels = current.map((d) => d.day);

  // ---- KPI figures: period-based when the new read model has data, all-time otherwise
  const revenue = sumBy(current, revenueOf);
  const revenuePrev = sumBy(previous, revenueOf);
  const orders = sumBy(current, (d) => d.ordersCount);
  const ordersPrev = sumBy(previous, (d) => d.ordersCount);
  const profit = sumBy(current, netProfitOf);
  const profitPrev = sumBy(previous, netProfitOf);
  const expenses = sumBy(current, (d) => d.expenses);
  const cash = summary?.availableCash ?? 0;
  const cashTrend = balanceSeries(cash, current);
  // balance at the very start of the period = end of day 1 minus day 1's movement
  const cashBefore = cashTrend.length ? cashTrend[0] - (current[0].cashIn - current[0].cashOut) : cash;

  // ---- attention list
  const outOfStock = snapshot.alerts.filter((a) => a.status === "OUT_OF_STOCK").length;
  const lowStock = snapshot.alerts.length - outOfStock;
  const overdueBatches = snapshot.batches.filter(
    (b) => b.targetDate && new Date(b.targetDate) < now && b.status !== "COMPLETED"
  ).length;
  const attention = [
    toShipOrders.length > 0 && {
      icon: PackageCheck,
      tone: "text-afk-gold",
      label: `${toShipOrders.length} order${toShipOrders.length === 1 ? "" : "s"} waiting to ship`,
      value: formatCompactBdt(toShipOrders.reduce((s, o) => s + o.totalAmount, 0)),
    },
    (summary?.courierPendingSettlements ?? 0) > 0 && {
      icon: Truck,
      tone: "text-sky-300",
      label: "COD with couriers",
      value: formatCompactBdt(summary!.courierPendingSettlements),
    },
    (summary?.courierCodReceivable ?? 0) > 0 && {
      icon: Banknote,
      tone: "text-afk-olive-accent",
      label: "Delivered, awaiting courier payout",
      value: formatCompactBdt(summary!.courierCodReceivable),
    },
    outOfStock > 0 && {
      icon: AlertTriangle,
      tone: "text-afk-danger",
      label: `${outOfStock} SKU${outOfStock === 1 ? "" : "s"} out of stock`,
      value: "Restock",
    },
    lowStock > 0 && {
      icon: AlertTriangle,
      tone: "text-afk-warning",
      label: `${lowStock} SKU${lowStock === 1 ? "" : "s"} below reorder level`,
      value: "Low",
    },
    overdueBatches > 0 && {
      icon: Factory,
      tone: "text-afk-warning",
      label: `${overdueBatches} production batch${overdueBatches === 1 ? "" : "es"} past target date`,
      value: "Overdue",
    },
  ].filter(Boolean) as { icon: typeof Truck; tone: string; label: string; value: string }[];

  const permittedVentures = snapshot.ventures.filter((v) => hasVentureAccess(partner, v.ventureNumber));

  const upcoming = await db
    .select()
    .from(portalCalendarEntries)
    .where(and(eq(portalCalendarEntries.isArchived, false), gte(portalCalendarEntries.startDate, now)))
    .orderBy(asc(portalCalendarEntries.startDate))
    .limit(4);

  const walletTotal = snapshot.wallets.reduce((s, w) => s + Math.max(0, w.balance), 0);

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-afk-offwhite">
            {greeting()}, {partner.name}
          </h1>
          <p className="text-sm text-afk-secondary mt-0.5">
            {formatDate(now, "EEEE, d MMMM yyyy")} · how AFK THEORY is doing
          </p>
        </div>
        <PeriodPicker value={days} />
      </div>

      {/* ── KPIs ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {hasDaily ? (
          <>
            <StatCard
              label="Revenue"
              value={formatCompactBdt(revenue)}
              delta={pctChange(revenue, revenuePrev)}
              icon={TrendingUp}
              spark={current.map(revenueOf)}
              sparkColor={CHART_COLORS.olive}
            />
            <StatCard
              label="Orders booked"
              value={String(orders)}
              delta={pctChange(orders, ordersPrev)}
              icon={ShoppingBag}
              spark={current.map((d) => d.ordersCount)}
              sparkColor={CHART_COLORS.sky}
            />
            <StatCard
              label="Net profit"
              value={formatCompactBdt(profit)}
              delta={pctChange(profit, profitPrev)}
              icon={Receipt}
              spark={current.map(netProfitOf)}
              sparkColor={profit >= 0 ? CHART_COLORS.gold : CHART_COLORS.danger}
            />
            <StatCard
              label="Cash & bank"
              value={formatCompactBdt(cash)}
              delta={pctChange(cash, cashBefore)}
              deltaHint={`vs ${days} days ago`}
              icon={Wallet}
              spark={cashTrend}
              sparkColor={CHART_COLORS.mint}
            />
          </>
        ) : (
          <>
            <StatCard label="Net sales revenue" value={formatCompactBdt(summary?.netRevenue ?? 0)} hint={`Gross ${formatCompactBdt(summary?.grossRevenue ?? 0)} · all time`} icon={TrendingUp} />
            <StatCard label="Gross profit" value={formatCompactBdt(summary?.grossProfit ?? 0)} hint="All time" icon={Receipt} />
            <StatCard label="Net profit" value={formatCompactBdt(summary?.netProfit ?? 0)} hint={`After ${formatCompactBdt(summary?.operatingExpenses ?? 0)} expenses · all time`} icon={ShoppingBag} />
            <StatCard label="Cash & bank balance" value={formatCompactBdt(cash)} hint="Cash, bank, bKash & Nagad" icon={Wallet} />
          </>
        )}
      </div>

      {/* ── Trend + wallets ──────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Revenue, expenses & cash in"
            subtitle={`Daily, last ${days} days${hasDaily ? ` · expenses ${formatCompactBdt(expenses)}` : ""}`}
            icon={Activity}
            right={
              <ul className="hidden sm:flex items-center gap-3 text-2xs text-afk-secondary" aria-label="Legend">
                {[
                  ["Revenue", CHART_COLORS.olive],
                  ["Expenses", CHART_COLORS.gold],
                  ["Cash in", CHART_COLORS.sky],
                ].map(([name, color]) => (
                  <li key={name} className="flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
                    {name}
                  </li>
                ))}
              </ul>
            }
          />
          <div className="px-3 pb-4 sm:px-5">
            {hasDaily ? (
              <AreaChart
                labels={labels}
                ariaLabel={`Daily revenue, expenses and cash in for the last ${days} days`}
                series={[
                  { key: "rev", name: "Revenue", color: CHART_COLORS.olive, values: current.map(revenueOf), fill: true },
                  { key: "exp", name: "Expenses", color: CHART_COLORS.gold, values: current.map((d) => d.expenses) },
                  { key: "cin", name: "Cash in", color: CHART_COLORS.sky, values: current.map((d) => d.cashIn) },
                ]}
              />
            ) : (
              <EmptyState icon={Activity} title="Trends appear after the first sync" hint="Once the local ERP pushes its daily figures, revenue, expenses and cash flow are charted here." />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Where the money sits" subtitle="Cash, bank & mobile wallets" icon={Wallet} iconClass="text-afk-gold" />
          <div className="px-5 pb-5">
            {snapshot.wallets.length === 0 ? (
              <EmptyState icon={Wallet} title="No wallet balances yet" />
            ) : (
              <div className="flex flex-col items-center gap-5">
                <Donut
                  segments={snapshot.wallets.map((w, i) => ({ label: w.name, value: w.balance, color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length] }))}
                  centerValue={formatCompactBdt(cash)}
                  centerLabel="Total"
                />
                <ul className="w-full space-y-2.5">
                  {snapshot.wallets.map((w, i) => (
                    <li key={w.id} className="flex items-center justify-between gap-3 text-xs">
                      <span className="flex items-center gap-2 min-w-0 text-afk-secondary">
                        <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length] }} />
                        <span className="truncate">{w.name}</span>
                      </span>
                      <span className="flex items-baseline gap-2 shrink-0">
                        <span className="font-mono tabular-nums text-afk-offwhite">{formatCompactBdt(w.balance)}</span>
                        {walletTotal > 0 && w.balance > 0 && (
                          <span className="text-2xs text-afk-muted w-8 text-right">{Math.round((w.balance / walletTotal) * 100)}%</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ── Attention · orders · money ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader title="Needs attention" subtitle="Things worth a look today" icon={AlertTriangle} iconClass="text-afk-warning" />
          <div className="px-5 pb-5">
            {attention.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="All clear" hint="No pending shipments, payouts, stock alerts or overdue batches." className="py-6" />
            ) : (
              <ul className="divide-y divide-afk-border/60">
                {attention.map((a) => (
                  <li key={a.label} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <a.icon className={`w-4 h-4 shrink-0 ${a.tone}`} />
                    <span className="flex-1 text-xs text-afk-secondary">{a.label}</span>
                    <span className="text-xs font-semibold font-mono tabular-nums text-afk-offwhite">{a.value}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Latest orders" subtitle="Newest first" icon={ShoppingBag} iconClass="text-sky-300" />
          <div className="px-5 pb-5">
            {recentOrders.length === 0 ? (
              <EmptyState icon={ShoppingBag} title="No orders synced yet" className="py-6" />
            ) : (
              <ul className="divide-y divide-afk-border/60">
                {recentOrders.map((o) => {
                  const st = orderStatusTone(o.status);
                  return (
                    <li key={o.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold font-mono text-afk-offwhite truncate">{o.orderNumber.replace("AFK-ORD-", "#")}</p>
                        <p className="text-2xs text-afk-muted truncate">
                          {o.customerLabel ?? "Customer"} · {o.units} item{o.units === 1 ? "" : "s"} · {formatDate(o.orderDate, "d MMM")}
                        </p>
                      </div>
                      <div className="text-right shrink-0 space-y-1">
                        <p className="text-xs font-mono tabular-nums font-semibold text-afk-offwhite">{formatCompactBdt(o.totalAmount)}</p>
                        <Pill tone={st.tone}>{st.label}</Pill>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Money movements" subtitle="Deposits, expenses, payouts" icon={Banknote} iconClass="text-afk-olive-accent" />
          <div className="px-5 pb-5">
            {recentMoney.length === 0 ? (
              <EmptyState icon={Banknote} title="No transactions synced yet" className="py-6" />
            ) : (
              <ul className="divide-y divide-afk-border/60">
                {recentMoney.map((t) => {
                  const Icon = t.direction === "IN" ? ArrowDownLeft : t.direction === "OUT" ? ArrowUpRight : Receipt;
                  const tone = t.direction === "IN" ? "text-afk-success" : t.direction === "OUT" ? "text-afk-danger" : "text-afk-secondary";
                  return (
                    <li key={t.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <span className={`grid place-items-center w-7 h-7 rounded-full bg-afk-surface border border-afk-border shrink-0 ${tone}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-medium text-afk-offwhite truncate ${t.isReversed ? "line-through opacity-60" : ""}`}>{t.title}</p>
                        <p className="text-2xs text-afk-muted truncate">
                          {formatDate(t.txnDate, "d MMM")}
                          {t.accountLabel ? ` · ${t.accountLabel}` : ""}
                        </p>
                      </div>
                      <p className={`text-xs font-mono tabular-nums font-semibold shrink-0 ${tone}`}>
                        {t.direction === "IN" ? "+" : t.direction === "OUT" ? "−" : ""}
                        {formatCompactBdt(t.amount)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>
      </div>

      {/* ── My position ──────────────────────────────────────── */}
      <Card>
        <CardHeader
          title={`My financial position · ${partner.name}`}
          subtitle="Personal equity statement from posted ledger entries"
          icon={Wallet}
          iconClass="text-afk-gold"
          href="/my-investments"
          linkLabel="Full statement"
        />
        <div className="px-5 pb-5 grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            ["Capital contributed", statement?.capitalContributed ?? 0, "text-afk-offwhite"],
            ["Loans due to me", statement?.loanBalanceOwed ?? 0, "text-afk-success"],
            ["Drawings", statement?.drawings ?? 0, "text-afk-warning"],
            ["Share of net profit", statement?.shareOfProfit ?? 0, "text-afk-offwhite"],
          ].map(([label, value, tone]) => (
            <div key={label as string} className="rounded-lg border border-afk-border bg-afk-surface px-4 py-3">
              <p className="text-2xs uppercase tracking-wider text-afk-muted">{label as string}</p>
              <p className={`text-base font-bold tabular-nums mt-1 ${tone}`}>{formatBdt(value as number)}</p>
            </div>
          ))}
          <div className="col-span-2 lg:col-span-1 rounded-lg border border-afk-olive/50 bg-afk-olive-dark/40 px-4 py-3">
            <p className="text-2xs uppercase tracking-wider text-afk-olive-accent font-semibold">Total net equity</p>
            <p className="text-base font-bold tabular-nums mt-1 text-afk-gold">{formatBdt(statement?.totalEquity ?? 0)}</p>
          </div>
        </div>
      </Card>

      {/* ── Ventures + production ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title={`Ventures & drops (${permittedVentures.length})`} icon={Briefcase} href="/ventures" />
          <div className="px-5 pb-5">
            {permittedVentures.length === 0 ? (
              <EmptyState icon={Briefcase} title="No ventures assigned to your account" className="py-6" />
            ) : (
              <ul className="space-y-4">
                {permittedVentures.slice(0, 4).map((v) => {
                  const pct = v.targetBudget > 0 ? (v.actualCashRaised / v.targetBudget) * 100 : 0;
                  return (
                    <li key={v.id}>
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <p className="text-xs font-semibold text-afk-offwhite truncate">
                          {v.title} <span className="font-mono text-2xs text-afk-muted font-normal">{v.ventureNumber}</span>
                        </p>
                        <Pill tone="olive">{v.stage}</Pill>
                      </div>
                      <ProgressBar value={pct} />
                      <p className="text-2xs text-afk-muted mt-1">
                        Raised {formatCompactBdt(v.actualCashRaised)} of {formatCompactBdt(v.targetBudget)} budget
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Factory batches"
            icon={Factory}
            iconClass="text-afk-gold"
            right={<Pill>{snapshot.batches.length} active</Pill>}
          />
          <div className="px-5 pb-5">
            {snapshot.batches.length === 0 ? (
              <EmptyState icon={Factory} title="No batches in production" className="py-6" />
            ) : (
              <ul className="space-y-4">
                {snapshot.batches.slice(0, 4).map((b) => {
                  const pct = b.plannedQuantity > 0 ? (b.completedGoodQuantity / b.plannedQuantity) * 100 : 0;
                  const late = b.targetDate && new Date(b.targetDate) < now && b.status !== "COMPLETED";
                  return (
                    <li key={b.id}>
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <p className="text-xs font-semibold text-afk-offwhite truncate">
                          {b.productName} <span className="font-mono text-2xs text-afk-muted font-normal">{b.orderNumber}</span>
                        </p>
                        <Pill tone={late ? "warning" : "gold"}>{b.status.replace(/_/g, " ")}</Pill>
                      </div>
                      <ProgressBar value={pct} tone={late ? "danger" : "gold"} />
                      <p className="text-2xs text-afk-muted mt-1">
                        {b.completedGoodQuantity} of {b.plannedQuantity} pcs
                        {b.targetDate ? ` · due ${formatDate(b.targetDate, "d MMM")}` : ""}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>
      </div>

      {/* ── Activity + calendar ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader title="Business activity" subtitle="Latest postings from the ERP" icon={Activity} href="/updates" linkLabel="All updates" />
          <div className="px-5 pb-5">
            {snapshot.activity.length === 0 ? (
              <EmptyState icon={Activity} title="No recent activity" className="py-6" />
            ) : (
              <ul className="divide-y divide-afk-border/60">
                {snapshot.activity.slice(0, 6).map((a) => (
                  <li key={a.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 text-afk-olive-accent shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold text-afk-offwhite truncate">{a.title}</p>
                        <span className="text-2xs text-afk-muted shrink-0">{formatDateTime(a.timestamp)}</span>
                      </div>
                      <p className="text-xs text-afk-secondary mt-0.5 break-words">{a.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Upcoming" subtitle="Shared calendar" icon={Calendar} href="/calendar" linkLabel="Open" />
          <div className="px-5 pb-5 space-y-2.5">
            {upcoming.length === 0 ? (
              <EmptyState icon={Calendar} title="Nothing scheduled" hint="Add a meeting, deadline or note for the partners." className="py-6" />
            ) : (
              upcoming.map((e) => (
                <div key={e.id} className="rounded-lg border border-afk-border bg-afk-surface px-3.5 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-afk-offwhite truncate">{e.title}</p>
                    <Pill tone="gold">{e.entryType}</Pill>
                  </div>
                  <p className="text-2xs text-afk-muted mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDateTime(e.startDate)}
                  </p>
                </div>
              ))
            )}
            <Link
              href="/calendar?action=new"
              className="block text-center rounded-lg border border-afk-border bg-afk-surface hover:bg-afk-elevated py-2 text-xs font-medium text-afk-offwhite transition"
            >
              + Add note or meeting
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
