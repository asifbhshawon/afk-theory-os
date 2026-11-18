import { unstable_cache } from "next/cache";
import { and, desc, eq, gte, inArray, type SQL } from "drizzle-orm";
import { db } from "./db";
import {
  portalSalesOrders,
  portalTransactions,
  portalDailyMetrics,
  portalSyncMeta,
  portalBusinessSummaries,
  portalPaymentAccounts,
  portalPartnerStatements,
  portalVentures,
  portalManufacturingBatches,
  portalInventoryAlerts,
  portalActivityFeed,
} from "./schema";

/**
 * Cached read helpers for the sales / money read model.
 *
 *  - Every helper is wrapped in unstable_cache under ONE tag. The local ERP calls
 *    POST /api/sync/revalidate after each push, so pages are served from cache
 *    (zero database queries) until data actually changes.
 *  - A 1-hour TTL is a safety net if a revalidate ping is ever missed.
 *  - Return values are plain JSON (numbers / ISO strings) because the cache
 *    serialises them.
 */
export const PORTAL_DATA_TAG = "portal-data";
const TTL = 3600;

const n = (v: unknown) => Number(v ?? 0);
const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);

export interface DailyMetric {
  day: string;
  ordersCount: number;
  unitsBooked: number;
  bookedValue: number;
  grossSales: number;
  deliveryIncome: number;
  returns: number;
  cogs: number;
  expenses: number;
  cashIn: number;
  cashOut: number;
  capitalDeposits: number;
  drawings: number;
  byChannel: Record<string, { orders: number; value: number }>;
  byCategory: Record<string, number>;
}

export interface SalesOrderView {
  id: string;
  orderNumber: string;
  orderDate: string;
  status: string;
  paymentStatus: string;
  channel: string;
  cityZone: string | null;
  units: number;
  subtotal: number;
  discount: number;
  deliveryCharge: number;
  totalAmount: number;
  cogs: number;
  profit: number;
  courierName: string | null;
  waybillNumber: string | null;
  customerLabel: string | null;
  items: { sku: string; name: string; size: string; color: string; qty: number; unitPrice: number; total: number }[];
  timeline: { status: string; at: string }[];
}

export interface TransactionView {
  id: string;
  txnDate: string;
  kind: string;
  direction: "IN" | "OUT" | "NEUTRAL";
  title: string;
  description: string | null;
  category: string | null;
  amount: number;
  accountLabel: string | null;
  partnerName: string | null;
  journalNo: string | null;
  isReversed: boolean;
}

/** Daily aggregates for the last `days` days (oldest first) — what the charts read. */
export const getDailyMetrics = unstable_cache(
  async (days: number): Promise<DailyMetric[]> => {
    const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
    const rows = await db
      .select()
      .from(portalDailyMetrics)
      .where(gte(portalDailyMetrics.day, since))
      .orderBy(portalDailyMetrics.day);
    return rows.map((r) => ({
      day: r.day,
      ordersCount: r.ordersCount,
      unitsBooked: r.unitsBooked,
      bookedValue: n(r.bookedValue),
      grossSales: n(r.grossSales),
      deliveryIncome: n(r.deliveryIncome),
      returns: n(r.returns),
      cogs: n(r.cogs),
      expenses: n(r.expenses),
      cashIn: n(r.cashIn),
      cashOut: n(r.cashOut),
      capitalDeposits: n(r.capitalDeposits),
      drawings: n(r.drawings),
      byChannel: (r.byChannel as DailyMetric["byChannel"]) ?? {},
      byCategory: (r.byCategory as DailyMetric["byCategory"]) ?? {},
    }));
  },
  ["portal-daily-metrics"],
  { tags: [PORTAL_DATA_TAG], revalidate: TTL }
);

/** Newest orders first. `status` is optional ("ALL" / undefined = every status). */
export const getSalesOrders = unstable_cache(
  async (opts: { days?: number; status?: string; limit?: number } = {}): Promise<SalesOrderView[]> => {
    const conditions: SQL[] = [];
    if (opts.days) {
      conditions.push(gte(portalSalesOrders.orderDate, new Date(Date.now() - opts.days * 86400_000)));
    }
    if (opts.status && opts.status !== "ALL") conditions.push(eq(portalSalesOrders.status, opts.status));
    const rows = await db
      .select()
      .from(portalSalesOrders)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(portalSalesOrders.orderDate))
      .limit(opts.limit ?? 200);
    return rows.map((r) => ({
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
    }));
  },
  ["portal-sales-orders"],
  { tags: [PORTAL_DATA_TAG], revalidate: TTL }
);

/** Money ledger, newest first. Pass `kinds` to filter (e.g. ["EXPENSE"], ["DEPOSIT","LOAN"]). */
export const getTransactions = unstable_cache(
  async (opts: { days?: number; kinds?: string[]; limit?: number } = {}): Promise<TransactionView[]> => {
    const conditions: SQL[] = [];
    if (opts.days) {
      conditions.push(gte(portalTransactions.txnDate, new Date(Date.now() - opts.days * 86400_000)));
    }
    if (opts.kinds?.length) conditions.push(inArray(portalTransactions.kind, opts.kinds));
    const rows = await db
      .select()
      .from(portalTransactions)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(portalTransactions.txnDate), desc(portalTransactions.journalNo))
      .limit(opts.limit ?? 300);
    return rows.map((r) => ({
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
    }));
  },
  ["portal-transactions"],
  { tags: [PORTAL_DATA_TAG], revalidate: TTL }
);

/** When the local ERP last pushed — drives the "Live · synced 2 min ago" pill. */
export const getSyncFreshness = unstable_cache(
  async () => {
    const [meta] = await db.select().from(portalSyncMeta).where(eq(portalSyncMeta.id, "singleton")).limit(1);
    return {
      lastPushedAt: iso(meta?.lastPushedAt),
      status: meta?.lastPushStatus ?? "NEVER_SYNCED",
    };
  },
  ["portal-sync-freshness"],
  { tags: [PORTAL_DATA_TAG], revalidate: 300 }
);

// ---------------------------------------------------------------------------
// Overview snapshot — the global (not partner-specific) read model, one cached call
// ---------------------------------------------------------------------------

export interface OverviewSnapshot {
  summary: {
    netRevenue: number;
    grossRevenue: number;
    salesReturns: number;
    totalCogs: number;
    grossProfit: number;
    operatingExpenses: number;
    netProfit: number;
    availableCash: number;
    totalInventoryValue: number;
    courierCodReceivable: number;
    courierPendingSettlements: number;
    updatedAt: string | null;
  } | null;
  wallets: { id: string; name: string; type: string; balance: number }[];
  ventures: {
    id: string;
    ventureNumber: string;
    title: string;
    stage: string;
    targetBudget: number;
    actualCashRaised: number;
  }[];
  batches: {
    id: string;
    orderNumber: string;
    productName: string;
    status: string;
    plannedQuantity: number;
    completedGoodQuantity: number;
    targetDate: string | null;
  }[];
  alerts: {
    id: string;
    sku: string;
    productName: string;
    size: string | null;
    color: string | null;
    currentQuantity: number;
    reorderLevel: number;
    status: string;
  }[];
  activity: { id: string; category: string; title: string; description: string; timestamp: string }[];
}

export const getOverviewSnapshot = unstable_cache(
  async (): Promise<OverviewSnapshot> => {
    const [[summary], wallets, ventures, batches, alerts, activity] = await Promise.all([
      db.select().from(portalBusinessSummaries).where(eq(portalBusinessSummaries.id, "latest")).limit(1),
      db.select().from(portalPaymentAccounts).where(eq(portalPaymentAccounts.isActive, true)),
      db.select().from(portalVentures).orderBy(desc(portalVentures.updatedAt)),
      db.select().from(portalManufacturingBatches).orderBy(portalManufacturingBatches.targetDate).limit(8),
      db.select().from(portalInventoryAlerts).orderBy(portalInventoryAlerts.currentQuantity).limit(50),
      db.select().from(portalActivityFeed).orderBy(desc(portalActivityFeed.timestamp)).limit(8),
    ]);

    return {
      summary: summary
        ? {
            netRevenue: n(summary.netRevenue),
            grossRevenue: n(summary.grossRevenue),
            salesReturns: n(summary.salesReturns),
            totalCogs: n(summary.totalCogs),
            grossProfit: n(summary.grossProfit),
            operatingExpenses: n(summary.operatingExpenses),
            netProfit: n(summary.netProfit),
            availableCash: n(summary.availableCash),
            totalInventoryValue: n(summary.totalInventoryValue),
            courierCodReceivable: n(summary.courierCodReceivable),
            courierPendingSettlements: n(summary.courierPendingSettlements),
            updatedAt: iso(summary.updatedAt),
          }
        : null,
      wallets: wallets.map((w) => ({ id: w.id, name: w.name, type: w.type, balance: n(w.balance) })),
      ventures: ventures.map((v) => ({
        id: v.id,
        ventureNumber: v.ventureNumber,
        title: v.title,
        stage: v.stage,
        targetBudget: n(v.targetBudget),
        actualCashRaised: n(v.actualCashRaised),
      })),
      batches: batches.map((b) => ({
        id: b.id,
        orderNumber: b.orderNumber,
        productName: b.productName,
        status: b.status,
        plannedQuantity: b.plannedQuantity,
        completedGoodQuantity: b.completedGoodQuantity,
        targetDate: iso(b.targetDate),
      })),
      alerts: alerts.map((a) => ({
        id: a.id,
        sku: a.sku,
        productName: a.productName,
        size: a.size,
        color: a.color,
        currentQuantity: a.currentQuantity,
        reorderLevel: a.reorderLevel,
        status: a.status,
      })),
      activity: activity.map((a) => ({
        id: a.id,
        category: a.category,
        title: a.title,
        description: a.description,
        timestamp: iso(a.timestamp)!,
      })),
    };
  },
  ["portal-overview-snapshot"],
  { tags: [PORTAL_DATA_TAG], revalidate: TTL }
);

export interface PartnerStatementView {
  capitalContributed: number;
  loanBalanceOwed: number;
  drawings: number;
  shareOfProfit: number;
  totalEquity: number;
}

/** One partner's own position. The partner id is part of the cache key. */
export const getPartnerStatement = unstable_cache(
  async (partnerId: string): Promise<PartnerStatementView | null> => {
    const [row] = await db
      .select()
      .from(portalPartnerStatements)
      .where(eq(portalPartnerStatements.partnerId, partnerId))
      .limit(1);
    if (!row) return null;
    return {
      capitalContributed: n(row.capitalContributed),
      loanBalanceOwed: n(row.loanBalanceOwed),
      drawings: n(row.drawings),
      shareOfProfit: n(row.shareOfProfit),
      totalEquity: n(row.totalEquity),
    };
  },
  ["portal-partner-statement"],
  { tags: [PORTAL_DATA_TAG], revalidate: TTL }
);
