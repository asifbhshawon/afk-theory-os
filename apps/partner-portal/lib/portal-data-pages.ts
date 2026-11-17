import { unstable_cache } from "next/cache";
import { and, desc, gte, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "./db";
import { portalSalesOrders, portalTransactions } from "./schema";
import { PORTAL_DATA_TAG, type SalesOrderView, type TransactionView } from "./portal-data";
import { escapeLike, filterKeyForStatus, type OrderFilterKey } from "./query";

/**
 * Cached loaders for the Sales and Money pages. Same rules as portal-data.ts:
 * one cache tag, revalidated by the ERP after each push, plain JSON out.
 */
const TTL = 3600;
const n = (v: unknown) => Number(v ?? 0);
const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);
const sinceDays = (days: number) => new Date(Date.now() - days * 86_400_000);

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

function mapOrder(r: typeof portalSalesOrders.$inferSelect): SalesOrderView {
  return {
    id: r.id,
    orderNumber: r.orderNumber,
    orderDate: iso(r.orderDate)!,
    status: r.status,
    paymentStatus: r.paymentStatus,
    channel: r.channel,
    cityZone: r.cityZone,
    units: r.units,
    subtotal: n(r.subtotal),
    discount: n(r.discount),
    deliveryCharge: n(r.deliveryCharge),
    totalAmount: n(r.totalAmount),
    cogs: n(r.cogs),
    profit: n(r.profit),
    courierName: r.courierName,
    waybillNumber: r.waybillNumber,
    customerLabel: r.customerLabel,
    items: (r.items as SalesOrderView["items"]) ?? [],
    timeline: (r.timeline as SalesOrderView["timeline"]) ?? [],
  };
}

export interface OrderPage {
  rows: SalesOrderView[];
  total: number;
}

/** One page of orders for the Sales table: period + status tab + free-text search. */
export const getSalesOrderPage = unstable_cache(
  async (opts: {
    days: number;
    statuses: string[] | null;
    search: string;
    page: number;
    pageSize: number;
  }): Promise<OrderPage> => {
    const conditions: SQL[] = [gte(portalSalesOrders.orderDate, sinceDays(opts.days))];
    if (opts.statuses) conditions.push(inArray(portalSalesOrders.status, opts.statuses));
    if (opts.search) {
      const like = `%${escapeLike(opts.search)}%`;
      conditions.push(
        or(
          ilike(portalSalesOrders.orderNumber, like),
          ilike(portalSalesOrders.customerLabel, like),
          ilike(portalSalesOrders.waybillNumber, like),
          ilike(portalSalesOrders.courierName, like),
          ilike(portalSalesOrders.channel, like),
          sql`${portalSalesOrders.items}::text ILIKE ${like}`
        )!
      );
    }
    const where = and(...conditions);

    const [[{ total }], rows] = await Promise.all([
      db.select({ total: sql<number>`COUNT(*)::int` }).from(portalSalesOrders).where(where),
      db
        .select()
        .from(portalSalesOrders)
        .where(where)
        .orderBy(desc(portalSalesOrders.orderDate), desc(portalSalesOrders.orderNumber))
        .limit(opts.pageSize)
        .offset((opts.page - 1) * opts.pageSize),
    ]);
    return { rows: rows.map(mapOrder), total: Number(total) };
  },
  ["portal-sales-order-page"],
  { tags: [PORTAL_DATA_TAG], revalidate: TTL }
);

export interface SalesBreakdown {
  /** Orders in the period per tab (all / toship / shipped / delivered / closed) with their value. */
  tabs: Record<OrderFilterKey, { count: number; value: number }>;
  statuses: { status: string; count: number; value: number }[];
  zones: { zone: string; orders: number; value: number }[];
  products: { name: string; units: number; revenue: number }[];
}

/** Everything the Sales page needs besides the daily series and the order list. */
export const getSalesBreakdown = unstable_cache(
  async (days: number): Promise<SalesBreakdown> => {
    const since = sinceDays(days);
    const [statusRows, zoneRows, productRes] = await Promise.all([
      db
        .select({
          status: portalSalesOrders.status,
          count: sql<number>`COUNT(*)::int`,
          value: sql<string>`COALESCE(SUM(${portalSalesOrders.totalAmount}), 0)`,
        })
        .from(portalSalesOrders)
        .where(gte(portalSalesOrders.orderDate, since))
        .groupBy(portalSalesOrders.status),
      db
        .select({
          zone: portalSalesOrders.cityZone,
          orders: sql<number>`COUNT(*)::int`,
          value: sql<string>`COALESCE(SUM(${portalSalesOrders.totalAmount}), 0)`,
        })
        .from(portalSalesOrders)
        .where(and(gte(portalSalesOrders.orderDate, since), sql`${portalSalesOrders.status} <> 'CANCELLED'`))
        .groupBy(portalSalesOrders.cityZone),
      db.execute(sql`
        SELECT it->>'name' AS name,
               COALESCE(SUM((it->>'qty')::int), 0)::int AS units,
               COALESCE(SUM((it->>'total')::numeric), 0) AS revenue
        FROM portal_sales_orders o, jsonb_array_elements(o.items) AS it
        WHERE o.order_date >= ${since.toISOString()}::timestamptz
          AND o.status NOT IN ('CANCELLED', 'RETURNED')
        GROUP BY 1
        ORDER BY revenue DESC
        LIMIT 8
      `),
    ]);

    const tabs = {
      all: { count: 0, value: 0 },
      toship: { count: 0, value: 0 },
      shipped: { count: 0, value: 0 },
      delivered: { count: 0, value: 0 },
      closed: { count: 0, value: 0 },
    } as SalesBreakdown["tabs"];
    for (const r of statusRows) {
      const key = filterKeyForStatus(r.status);
      tabs[key].count += r.count;
      tabs[key].value += n(r.value);
      tabs.all.count += r.count;
      tabs.all.value += n(r.value);
    }

    return {
      tabs,
      statuses: statusRows.map((r) => ({ status: r.status, count: r.count, value: n(r.value) })),
      zones: zoneRows
        .map((r) => ({ zone: r.zone ?? "Unspecified", orders: r.orders, value: n(r.value) }))
        .sort((a, b) => b.value - a.value),
      products: (productRes.rows as { name: string; units: number; revenue: string }[]).map((r) => ({
        name: r.name,
        units: Number(r.units),
        revenue: n(r.revenue),
      })),
    };
  },
  ["portal-sales-breakdown"],
  { tags: [PORTAL_DATA_TAG], revalidate: TTL }
);

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

export interface TransactionPage {
  rows: TransactionView[];
  total: number;
  /** Cash-moving totals of everything matching the filter (not only this page). */
  sumIn: number;
  sumOut: number;
}

export const getTransactionPage = unstable_cache(
  async (opts: {
    days: number;
    kinds: string[] | null;
    search: string;
    page: number;
    pageSize: number;
  }): Promise<TransactionPage> => {
    const conditions: SQL[] = [gte(portalTransactions.txnDate, sinceDays(opts.days))];
    if (opts.kinds) conditions.push(inArray(portalTransactions.kind, opts.kinds));
    if (opts.search) {
      const like = `%${escapeLike(opts.search)}%`;
      conditions.push(
        or(
          ilike(portalTransactions.title, like),
          ilike(portalTransactions.description, like),
          ilike(portalTransactions.category, like),
          ilike(portalTransactions.partnerName, like),
          ilike(portalTransactions.journalNo, like),
          ilike(portalTransactions.accountLabel, like)
        )!
      );
    }
    const where = and(...conditions);

    const [totals, rows] = await Promise.all([
      db
        .select({
          direction: portalTransactions.direction,
          count: sql<number>`COUNT(*)::int`,
          amount: sql<string>`COALESCE(SUM(${portalTransactions.amount}), 0)`,
        })
        .from(portalTransactions)
        .where(where)
        .groupBy(portalTransactions.direction),
      db
        .select()
        .from(portalTransactions)
        .where(where)
        .orderBy(desc(portalTransactions.txnDate), desc(portalTransactions.journalNo))
        .limit(opts.pageSize)
        .offset((opts.page - 1) * opts.pageSize),
    ]);

    const sum = (dir: string) => n(totals.find((t) => t.direction === dir)?.amount);
    return {
      total: totals.reduce((s, t) => s + t.count, 0),
      sumIn: sum("IN"),
      sumOut: sum("OUT"),
      rows: rows.map((r) => ({
        id: r.id,
        txnDate: iso(r.txnDate)!,
        kind: r.kind,
        direction: r.direction as TransactionView["direction"],
        title: r.title,
        description: r.description,
        category: r.category,
        amount: n(r.amount),
        accountLabel: r.accountLabel,
        partnerName: r.partnerName,
        journalNo: r.journalNo,
        isReversed: r.isReversed,
      })),
    };
  },
  ["portal-transaction-page"],
  { tags: [PORTAL_DATA_TAG], revalidate: TTL }
);
