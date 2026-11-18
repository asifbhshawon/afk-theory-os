import { Activity, ArrowDownLeft, ArrowUpRight, Banknote, Landmark, PieChart, Receipt, Scale, Wallet } from "lucide-react";
import { getCurrentPartner } from "@/lib/auth";
import { getDailyMetrics, getOverviewSnapshot } from "@/lib/portal-data";
import { getTransactionPage } from "@/lib/portal-data-pages";
import {
  LEDGER_FILTERS,
  PAGE_SIZE,
  buildHref,
  kindsFor,
  parseLedgerFilter,
  parsePage,
  parseSearch,
} from "@/lib/query";
import { categoryTotals, parseRange, pctChange, splitPeriods, sumBy } from "@/lib/analytics";
import { formatBdt, formatCompactBdt } from "@/lib/format";
import { AreaChart } from "@/components/charts/AreaChart";
import { Donut } from "@/components/charts/Donut";
import { CATEGORY_PALETTE, CHART_COLORS } from "@/components/charts/chart-utils";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { StatCard } from "@/components/ui/StatCard";
import { PeriodPicker } from "@/components/ui/PeriodPicker";
import { BarRow, FilterTabs, Pagination, SearchBox } from "@/components/ui/ListControls";
import { LedgerList } from "@/components/money/LedgerList";

export const dynamic = "force-dynamic";

export default async function MoneyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const partner = await getCurrentPartner();
  if (!partner) return null;

  const sp = await searchParams;
  const days = parseRange(sp.range);
  const filter = parseLedgerFilter(sp.type);
  const search = parseSearch(sp.q);
  const page = parsePage(sp.page);
  const now = new Date();

  const [snapshot, daily, ledger] = await Promise.all([
    getOverviewSnapshot(),
    getDailyMetrics(days * 2),
    getTransactionPage({ days, kinds: kindsFor(filter), search, page, pageSize: PAGE_SIZE }),
  ]);

  const { current, previous } = splitPeriods(daily, days, now);
  const labels = current.map((d) => d.day);
  const hasData = daily.length > 0 || ledger.total > 0 || snapshot.wallets.length > 0;

  const cashIn = sumBy(current, (d) => d.cashIn);
  const cashInPrev = sumBy(previous, (d) => d.cashIn);
  const cashOut = sumBy(current, (d) => d.cashOut);
  const cashOutPrev = sumBy(previous, (d) => d.cashOut);
  const net = cashIn - cashOut;
  const netPrev = cashInPrev - cashOutPrev;
  const expenses = sumBy(current, (d) => d.expenses);
  const expensesPrev = sumBy(previous, (d) => d.expenses);
  const capitalIn = sumBy(current, (d) => d.capitalDeposits);
  const drawings = sumBy(current, (d) => d.drawings);

  const cats = categoryTotals(current);
  const topCats = cats.slice(0, 5);
  const otherTotal = cats.slice(5).reduce((s, c) => s + c.amount, 0);
  const catSegments = [...topCats, ...(otherTotal > 0 ? [{ name: "Other", amount: otherTotal }] : [])];
  const catTotal = catSegments.reduce((s, c) => s + c.amount, 0);

  const walletTotal = snapshot.wallets.reduce((s, w) => s + Math.max(0, w.balance), 0);
  const cash = snapshot.summary?.availableCash ?? 0;
  const maxWallet = Math.max(1, ...snapshot.wallets.map((w) => Math.abs(w.balance)));

  const baseParams = { range: days, type: filter === "all" ? undefined : filter, q: search || undefined };

  return (
    <div className="space-y-6">
      <PageHeader title="Money & cash flow" subtitle={`Deposits, expenses, payouts and balances · last ${days} days`}>
        <PeriodPicker value={days} basePath="/money" params={{ type: baseParams.type, q: baseParams.q }} />
      </PageHeader>

      {!hasData ? (
        <Card>
          <EmptyState icon={Banknote} title="No money data synced yet" hint="Deposits, expenses and payouts appear here after the local ERP's first push." />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              label="Money in"
              value={formatCompactBdt(cashIn)}
              delta={pctChange(cashIn, cashInPrev)}
              icon={ArrowDownLeft}
              spark={current.map((d) => d.cashIn)}
              sparkColor={CHART_COLORS.olive}
            />
            <StatCard
              label="Money out"
              value={formatCompactBdt(cashOut)}
              delta={pctChange(cashOut, cashOutPrev)}
              invertDelta
              icon={ArrowUpRight}
              spark={current.map((d) => d.cashOut)}
              sparkColor={CHART_COLORS.coral}
            />
            <StatCard
              label="Net cash flow"
              value={formatCompactBdt(net)}
              delta={pctChange(net, netPrev)}
              icon={Scale}
              spark={current.map((d) => d.cashIn - d.cashOut)}
              sparkColor={net >= 0 ? CHART_COLORS.mint : CHART_COLORS.danger}
            />
            <StatCard
              label="Expenses"
              value={formatCompactBdt(expenses)}
              delta={pctChange(expenses, expensesPrev)}
              invertDelta
              icon={Receipt}
              spark={current.map((d) => d.expenses)}
              sparkColor={CHART_COLORS.gold}
            />
          </div>

          <Card>
            <CardHeader
              title="Cash in vs cash out"
              subtitle="Real money moving through cash, bank, bKash and Nagad"
              icon={Activity}
              right={
                <ul className="hidden sm:flex items-center gap-3 text-2xs text-afk-secondary" aria-label="Legend">
                  {[
                    ["In", CHART_COLORS.olive],
                    ["Out", CHART_COLORS.coral],
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
                ariaLabel={`Daily cash in and cash out for the last ${days} days`}
                series={[
                  { key: "in", name: "Cash in", color: CHART_COLORS.olive, values: current.map((d) => d.cashIn), fill: true },
                  { key: "out", name: "Cash out", color: CHART_COLORS.coral, values: current.map((d) => d.cashOut) },
                ]}
              />
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader title="Where the expenses go" subtitle={`${formatCompactBdt(expenses)} in the period`} icon={PieChart} iconClass="text-afk-gold" />
              <div className="px-5 pb-5">
                {catSegments.length === 0 ? (
                  <EmptyState icon={PieChart} title="No expenses in this period" className="py-6" />
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <Donut
                      size={132}
                      thickness={16}
                      segments={catSegments.map((c, i) => ({ label: c.name, value: c.amount, color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length] }))}
                      centerValue={formatCompactBdt(catTotal)}
                      centerLabel="spent"
                    />
                    <ul className="w-full space-y-2.5">
                      {catSegments.map((c, i) => (
                        <li key={c.name} className="flex items-center justify-between gap-3 text-xs">
                          <span className="flex items-center gap-2 min-w-0 text-afk-secondary">
                            <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length] }} />
                            <span className="truncate">{c.name}</span>
                          </span>
                          <span className="shrink-0 flex items-baseline gap-2">
                            <span className="font-mono tabular-nums text-afk-offwhite">{formatCompactBdt(c.amount)}</span>
                            <span className="text-2xs text-afk-muted w-9 text-right">{catTotal ? Math.round((c.amount / catTotal) * 100) : 0}%</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="Balances" subtitle={`${formatCompactBdt(cash)} across all wallets`} icon={Wallet} iconClass="text-afk-gold" />
              <div className="px-5 pb-5">
                {snapshot.wallets.length === 0 ? (
                  <EmptyState icon={Wallet} title="No wallet balances yet" className="py-6" />
                ) : (
                  <ul className="space-y-3.5">
                    {snapshot.wallets.map((w) => (
                      <BarRow
                        key={w.id}
                        label={w.name}
                        sub={walletTotal > 0 && w.balance > 0 ? `${Math.round((w.balance / walletTotal) * 100)}% of positive balances` : w.balance < 0 ? "Overdrawn" : undefined}
                        value={formatBdt(w.balance)}
                        fraction={Math.abs(w.balance) / maxWallet}
                        barClass={w.balance < 0 ? "bg-afk-danger" : "bg-afk-olive-light"}
                      />
                    ))}
                  </ul>
                )}
                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-afk-border pt-4">
                  <div>
                    <p className="flex items-center gap-1.5 text-2xs uppercase tracking-wider text-afk-muted">
                      <Landmark className="w-3 h-3" /> Partner capital in
                    </p>
                    <p className="text-sm font-bold font-mono tabular-nums text-afk-success mt-1">{formatCompactBdt(capitalIn)}</p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1.5 text-2xs uppercase tracking-wider text-afk-muted">
                      <ArrowUpRight className="w-3 h-3" /> Drawings out
                    </p>
                    <p className="text-sm font-bold font-mono tabular-nums text-afk-warning mt-1">{formatCompactBdt(drawings)}</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <Card>
            <div className="px-5 pt-4 pb-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-afk-offwhite">Ledger</h2>
                <p className="text-2xs text-afk-muted">Every money event posted in the ERP — {ledger.total} in this view</p>
              </div>
              <SearchBox
                basePath="/money"
                params={{ range: days, type: baseParams.type }}
                value={search}
                placeholder="Search title, partner, account, journal…"
              />
            </div>
            <div className="px-5 pb-3">
              <FilterTabs
                active={filter}
                tabs={LEDGER_FILTERS.map((f) => ({ key: f.key, label: f.label }))}
                hrefFor={(key) => buildHref("/money", { range: days, type: key === "all" ? undefined : key, q: search || undefined })}
              />
            </div>
            <div className="border-t border-afk-border">
              <LedgerList
                rows={ledger.rows}
                emptyHint={search ? "Try a different search term or clear the filters." : "Nothing of this kind in the selected period."}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-afk-border px-5 py-3 text-xs">
              <span className="text-afk-muted">Cash movement in this view</span>
              <span className="flex items-center gap-5 font-mono tabular-nums">
                <span className="text-afk-success">+{formatBdt(ledger.sumIn)}</span>
                <span className="text-afk-danger">−{formatBdt(ledger.sumOut)}</span>
                <span className="text-afk-offwhite font-semibold">{formatBdt(ledger.sumIn - ledger.sumOut)}</span>
              </span>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={ledger.total} hrefFor={(p) => buildHref("/money", { ...baseParams, page: p })} />
          </Card>
        </>
      )}
    </div>
  );
}
