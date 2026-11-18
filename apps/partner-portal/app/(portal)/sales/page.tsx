import { BarChart3, Boxes, MapPin, Megaphone, PackageCheck, Receipt, ShoppingBag, TrendingUp, Activity } from "lucide-react";
import { getCurrentPartner } from "@/lib/auth";
import { getDailyMetrics } from "@/lib/portal-data";
import { getSalesBreakdown, getSalesOrderPage } from "@/lib/portal-data-pages";
import {
  ORDER_FILTERS,
  PAGE_SIZE,
  buildHref,
  parseOrderFilter,
  parsePage,
  parseSearch,
  statusesFor,
} from "@/lib/query";
import { channelTotals, netProfitOf, parseRange, pctChange, revenueOf, splitPeriods, sumBy } from "@/lib/analytics";
import { formatBdt, formatCompactBdt } from "@/lib/format";
import { AreaChart } from "@/components/charts/AreaChart";
import { Donut } from "@/components/charts/Donut";
import { CATEGORY_PALETTE, CHART_COLORS } from "@/components/charts/chart-utils";
import { Card, CardHeader, EmptyState, PageHeader, Pill, orderStatusTone } from "@/components/ui/primitives";
import { StatCard } from "@/components/ui/StatCard";
import { PeriodPicker } from "@/components/ui/PeriodPicker";
import { BarRow, FilterTabs, Pagination, SearchBox } from "@/components/ui/ListControls";
import { OrderList } from "@/components/sales/OrderList";

export const dynamic = "force-dynamic";

const CHANNEL_LABEL: Record<string, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  WHATSAPP: "WhatsApp",
  WEBSITE: "Website",
  IN_PERSON: "In person",
  MANUAL: "Other",
};

const STATUS_ORDER = ["CONFIRMED", "PACKED", "SHIPPED", "DELIVERED", "RETURNED", "CANCELLED"];
const STATUS_BAR: Record<string, string> = {
  CONFIRMED: "bg-afk-border-strong",
  PACKED: "bg-afk-border-strong",
  SHIPPED: "bg-afk-gold",
  DELIVERED: "bg-afk-olive-light",
  RETURNED: "bg-afk-danger",
  CANCELLED: "bg-afk-danger/60",
};

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const partner = await getCurrentPartner();
  if (!partner) return null;

  const sp = await searchParams;
  const days = parseRange(sp.range);
  const filter = parseOrderFilter(sp.status);
  const search = parseSearch(sp.q);
  const page = parsePage(sp.page);
  const now = new Date();

  const [daily, breakdown, orderPage] = await Promise.all([
    getDailyMetrics(days * 2),
    getSalesBreakdown(days),
    getSalesOrderPage({ days, statuses: statusesFor(filter), search, page, pageSize: PAGE_SIZE }),
  ]);

  const { current, previous } = splitPeriods(daily, days, now);
  const labels = current.map((d) => d.day);
  const hasData = daily.length > 0 || breakdown.tabs.all.count > 0;

  const revenue = sumBy(current, revenueOf);
  const revenuePrev = sumBy(previous, revenueOf);
  const orders = sumBy(current, (d) => d.ordersCount);
  const ordersPrev = sumBy(previous, (d) => d.ordersCount);
  const units = sumBy(current, (d) => d.unitsBooked);
  const booked = sumBy(current, (d) => d.bookedValue);
  const bookedPrev = sumBy(previous, (d) => d.bookedValue);
  const aov = orders ? booked / orders : 0;
  const aovPrev = ordersPrev ? bookedPrev / ordersPrev : 0;
  const grossProfit = revenue - sumBy(current, (d) => d.returns) - sumBy(current, (d) => d.cogs);
  const grossProfitPrev = revenuePrev - sumBy(previous, (d) => d.returns) - sumBy(previous, (d) => d.cogs);
  const margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const marginPrev = revenuePrev > 0 ? (grossProfitPrev / revenuePrev) * 100 : 0;
  const returns = sumBy(current, (d) => d.returns);

  const channels = channelTotals(current);
  const channelTotal = channels.reduce((s, c) => s + c.value, 0);
  const statuses = [...breakdown.statuses].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
  const maxStatus = Math.max(1, ...statuses.map((s) => s.count));
  const maxZone = Math.max(1, ...breakdown.zones.map((z) => z.value));
  const maxProduct = Math.max(1, ...breakdown.products.map((p) => p.revenue));

  const baseParams = { range: days, status: filter === "all" ? undefined : filter, q: search || undefined };
  const periodParams = { status: baseParams.status, q: baseParams.q };

  return (
    <div className="space-y-6">
      <PageHeader title="Sales" subtitle={`Orders, revenue and what is selling · last ${days} days`}>
        <PeriodPicker value={days} basePath="/sales" params={periodParams} />
      </PageHeader>

      {!hasData ? (
        <Card>
          <EmptyState
            icon={ShoppingBag}
            title="No sales data synced yet"
            hint="As soon as the local ERP pushes its first orders, they show up here automatically."
          />
        </Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
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
              label="Avg. order value"
              value={formatCompactBdt(aov)}
              delta={pctChange(aov, aovPrev)}
              icon={Receipt}
              spark={current.map((d) => (d.ordersCount ? d.bookedValue / d.ordersCount : 0))}
              sparkColor={CHART_COLORS.gold}
            />
            <StatCard
              label="Gross margin"
              value={`${margin.toFixed(1)}%`}
              delta={marginPrev ? Math.round((margin - marginPrev) * 10) / 10 : null}
              deltaHint="pts vs prev. period"
              icon={BarChart3}
              spark={current.map((d) => {
                const r = revenueOf(d);
                return r > 0 ? ((r - d.returns - d.cogs) / r) * 100 : 0;
              })}
              sparkColor={CHART_COLORS.mint}
            />
          </div>

          {/* Trend */}
          <Card>
            <CardHeader
              title="Orders booked vs revenue recognised"
              subtitle={`${units} units sold · ${formatCompactBdt(returns)} refunded · revenue is booked when a parcel is delivered`}
              icon={Activity}
              right={
                <ul className="hidden sm:flex items-center gap-3 text-2xs text-afk-secondary" aria-label="Legend">
                  {[
                    ["Booked", CHART_COLORS.sky],
                    ["Revenue", CHART_COLORS.olive],
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
              <AreaChart
                labels={labels}
                ariaLabel={`Daily booked order value and recognised revenue for the last ${days} days`}
                series={[
                  { key: "booked", name: "Booked orders", color: CHART_COLORS.sky, values: current.map((d) => d.bookedValue), fill: true },
                  { key: "revenue", name: "Revenue", color: CHART_COLORS.olive, values: current.map(revenueOf) },
                ]}
              />
            </div>
          </Card>

          {/* Breakdowns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader title="Order pipeline" subtitle="Where this period's orders stand" icon={PackageCheck} iconClass="text-afk-gold" />
              <div className="px-5 pb-5">
                {statuses.length === 0 ? (
                  <EmptyState icon={PackageCheck} title="No orders in this period" className="py-6" />
                ) : (
                  <ul className="space-y-3.5">
                    {statuses.map((s) => (
                      <BarRow
                        key={s.status}
                        label={orderStatusTone(s.status).label}
                        value={`${s.count} · ${formatCompactBdt(s.value)}`}
                        fraction={s.count / maxStatus}
                        barClass={STATUS_BAR[s.status] ?? "bg-afk-olive-light"}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="Sales channels" subtitle="Order value by where the sale came from" icon={Megaphone} iconClass="text-sky-300" />
              <div className="px-5 pb-5">
                {channels.length === 0 ? (
                  <EmptyState icon={Megaphone} title="No channel data yet" className="py-6" />
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <Donut
                      size={132}
                      thickness={16}
                      segments={channels.map((c, i) => ({
                        label: CHANNEL_LABEL[c.channel] ?? c.channel,
                        value: c.value,
                        color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length],
                      }))}
                      centerValue={String(orders)}
                      centerLabel="orders"
                    />
                    <ul className="w-full space-y-2.5">
                      {channels.map((c, i) => (
                        <li key={c.channel} className="flex items-center justify-between gap-3 text-xs">
                          <span className="flex items-center gap-2 min-w-0 text-afk-secondary">
                            <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length] }} />
                            <span className="truncate">{CHANNEL_LABEL[c.channel] ?? c.channel}</span>
                          </span>
                          <span className="shrink-0 flex items-baseline gap-2">
                            <span className="font-mono tabular-nums text-afk-offwhite">{formatCompactBdt(c.value)}</span>
                            <span className="text-2xs text-afk-muted w-9 text-right">{channelTotal ? Math.round((c.value / channelTotal) * 100) : 0}%</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="Top products" subtitle="By revenue, excluding cancelled and returned" icon={Boxes} iconClass="text-afk-olive-accent" />
              <div className="px-5 pb-5">
                {breakdown.products.length === 0 ? (
                  <EmptyState icon={Boxes} title="No product sales yet" className="py-6" />
                ) : (
                  <ul className="space-y-3.5">
                    {breakdown.products.map((p) => (
                      <BarRow
                        key={p.name}
                        label={p.name}
                        sub={`${p.units} unit${p.units === 1 ? "" : "s"}`}
                        value={formatCompactBdt(p.revenue)}
                        fraction={p.revenue / maxProduct}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="Delivery zones" subtitle="Order value by destination" icon={MapPin} iconClass="text-orange-300" />
              <div className="px-5 pb-5">
                {breakdown.zones.length === 0 ? (
                  <EmptyState icon={MapPin} title="No zone data yet" className="py-6" />
                ) : (
                  <ul className="space-y-3.5">
                    {breakdown.zones.map((z) => (
                      <BarRow
                        key={z.zone}
                        label={z.zone}
                        sub={`${z.orders} order${z.orders === 1 ? "" : "s"}`}
                        value={formatCompactBdt(z.value)}
                        fraction={z.value / maxZone}
                        barClass="bg-sky-400"
                      />
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          </div>

          {/* Orders */}
          <Card>
            <div className="px-5 pt-4 pb-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-afk-offwhite">Orders</h2>
                <p className="text-2xs text-afk-muted">
                  {search
                    ? `${orderPage.total} order${orderPage.total === 1 ? "" : "s"} match “${search}”`
                    : `${formatBdt(breakdown.tabs[filter].value)} across ${breakdown.tabs[filter].count} order${breakdown.tabs[filter].count === 1 ? "" : "s"} in this view`}
                </p>
              </div>
              <SearchBox
                basePath="/sales"
                params={{ range: days, status: baseParams.status }}
                value={search}
                placeholder="Search order, customer, SKU, courier…"
              />
            </div>
            <div className="px-5 pb-3">
              <FilterTabs
                active={filter}
                tabs={ORDER_FILTERS.map((f) => ({ key: f.key, label: f.label, count: breakdown.tabs[f.key].count }))}
                hrefFor={(key) => buildHref("/sales", { range: days, status: key === "all" ? undefined : key, q: search || undefined })}
              />
            </div>
            <div className="border-t border-afk-border">
              <OrderList
                orders={orderPage.rows}
                emptyHint={search ? "Try a different search term or clear the filters." : "Nothing in this status for the selected period."}
              />
            </div>
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={orderPage.total}
              hrefFor={(p) => buildHref("/sales", { ...baseParams, page: p })}
            />
          </Card>
        </>
      )}
    </div>
  );
}
