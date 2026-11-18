import { createHash } from "crypto";
import { db } from "@/db";
import {
  salesOrders,
  salesLines,
  productVariants,
  products,
  contacts,
  stockMovements,
  locations,
  courierSettlementLines,
  courierSettlements,
  returnsAndExchanges,
  auditLogs,
  journalEntries,
  journalLines,
  accounts,
  partners,
  paymentAccounts,
} from "@/db/schema";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { makeCustomerRedactor } from "./portal-sync";
import { loadOrderTimelines } from "./order-timeline";

// =============================================================================
// Sales / money read model for the Partner Portal (cloud side).
//
// Rules:
//  * Never contains customer names, phones or addresses.
//  * Rows carry a content hash so a sync only writes what actually changed.
//  * Detail rows (orders, transactions) cover the last RETENTION_DAYS; daily
//    aggregates cover all time so charts stay cheap on the Vercel side.
// =============================================================================

export const RETENTION_DAYS = 365;
export const BUSINESS_TZ = "Asia/Dhaka";
// literal (not a bind parameter) so SELECT and GROUP BY expressions are identical
const TZ_SQL = sql.raw(`'${BUSINESS_TZ}'`);

/**
 * Cloud DDL. A copy lives in apps/partner-portal/lib/migrate.ts so the portal can
 * create the tables itself; tests/acceptance/24-* asserts both stay identical.
 */
export const READ_MODEL_DDL = `
CREATE TABLE IF NOT EXISTS portal_sales_orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  order_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'MANUAL',
  city_zone TEXT,
  units INTEGER NOT NULL DEFAULT 0,
  subtotal NUMERIC(18,2) NOT NULL DEFAULT 0.00,
  discount NUMERIC(18,2) NOT NULL DEFAULT 0.00,
  delivery_charge NUMERIC(18,2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(18,2) NOT NULL DEFAULT 0.00,
  cogs NUMERIC(18,2) NOT NULL DEFAULT 0.00,
  profit NUMERIC(18,2) NOT NULL DEFAULT 0.00,
  courier_name TEXT,
  waybill_number TEXT,
  customer_label TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  timeline JSONB NOT NULL DEFAULT '[]',
  row_hash TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS portal_sales_orders_date_idx ON portal_sales_orders (order_date DESC);
CREATE INDEX IF NOT EXISTS portal_sales_orders_status_idx ON portal_sales_orders (status);

CREATE TABLE IF NOT EXISTS portal_transactions (
  id TEXT PRIMARY KEY,
  txn_date TIMESTAMPTZ NOT NULL,
  kind TEXT NOT NULL,
  direction TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  amount NUMERIC(18,2) NOT NULL DEFAULT 0.00,
  account_label TEXT,
  partner_name TEXT,
  journal_no TEXT,
  source_module TEXT,
  is_reversed BOOLEAN NOT NULL DEFAULT false,
  row_hash TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS portal_transactions_date_idx ON portal_transactions (txn_date DESC);
CREATE INDEX IF NOT EXISTS portal_transactions_kind_idx ON portal_transactions (kind);

CREATE TABLE IF NOT EXISTS portal_daily_metrics (
  day DATE PRIMARY KEY,
  orders_count INTEGER NOT NULL DEFAULT 0,
  units_booked INTEGER NOT NULL DEFAULT 0,
  booked_value NUMERIC(18,2) NOT NULL DEFAULT 0.00,
  gross_sales NUMERIC(18,2) NOT NULL DEFAULT 0.00,
  delivery_income NUMERIC(18,2) NOT NULL DEFAULT 0.00,
  returns NUMERIC(18,2) NOT NULL DEFAULT 0.00,
  cogs NUMERIC(18,2) NOT NULL DEFAULT 0.00,
  expenses NUMERIC(18,2) NOT NULL DEFAULT 0.00,
  cash_in NUMERIC(18,2) NOT NULL DEFAULT 0.00,
  cash_out NUMERIC(18,2) NOT NULL DEFAULT 0.00,
  capital_deposits NUMERIC(18,2) NOT NULL DEFAULT 0.00,
  drawings NUMERIC(18,2) NOT NULL DEFAULT 0.00,
  by_channel JSONB NOT NULL DEFAULT '{}',
  by_category JSONB NOT NULL DEFAULT '{}',
  row_hash TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PortalOrderItem {
  sku: string;
  name: string;
  size: string;
  color: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface PortalOrderRow {
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
  customerLabel: string;
  items: PortalOrderItem[];
  timeline: { status: string; at: string }[];
}

export type TxnKind =
  | "SALE"
  | "RETURN"
  | "EXPENSE"
  | "DEPOSIT"
  | "LOAN"
  | "DRAWING"
  | "REIMBURSEMENT"
  | "SETTLEMENT"
  | "TRANSFER"
  | "PURCHASE"
  | "PRODUCTION"
  | "PAYMENT"
  | "REVERSAL"
  | "OTHER";

export interface PortalTxnRow {
  id: string;
  txnDate: string;
  kind: TxnKind;
  direction: "IN" | "OUT" | "NEUTRAL";
  title: string;
  description: string;
  category: string | null;
  amount: number;
  accountLabel: string | null;
  partnerName: string | null;
  journalNo: string;
  sourceModule: string | null;
  isReversed: boolean;
}

export interface PortalDailyRow {
  day: string; // YYYY-MM-DD in BUSINESS_TZ
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

export interface SalesReadModel {
  orders: PortalOrderRow[];
  transactions: PortalTxnRow[];
  daily: PortalDailyRow[];
  windowStart: string;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function rowHash(row: unknown): string {
  return createHash("sha256").update(JSON.stringify(row)).digest("hex").slice(0, 20);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Customer";
  return parts.map((p) => p[0]!.toUpperCase() + ".").join(" ");
}

function customerLabel(name: string, phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 3 ? `${initials(name)} · •••${digits.slice(-3)}` : initials(name);
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export async function buildPortalOrders(since: Date): Promise<PortalOrderRow[]> {
  const orders = await db.select().from(salesOrders).where(gte(salesOrders.orderDate, since));
  if (orders.length === 0) return [];

  const lineRows = await db
    .select({
      salesOrderId: salesLines.salesOrderId,
      quantity: salesLines.quantity,
      unitPrice: salesLines.unitPrice,
      totalPrice: salesLines.totalPrice,
      cogsUnitCost: salesLines.cogsUnitCost,
      sku: productVariants.sku,
      size: productVariants.size,
      color: productVariants.color,
      productName: products.name,
    })
    .from(salesLines)
    .innerJoin(salesOrders, eq(salesLines.salesOrderId, salesOrders.id))
    .innerJoin(productVariants, eq(salesLines.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(gte(salesOrders.orderDate, since));

  const couriers = await db.select({ id: contacts.id, name: contacts.name }).from(contacts).where(eq(contacts.type, "COURIER"));
  const courierName = new Map(couriers.map((c) => [c.id, c.name]));

  const timelines = await loadOrderTimelines(orders, since);

  return orders
    .map((o): PortalOrderRow => {
      const items: PortalOrderItem[] = lineRows
        .filter((l) => l.salesOrderId === o.id)
        .map((l) => ({
          sku: l.sku,
          name: l.productName,
          size: l.size,
          color: l.color,
          qty: l.quantity,
          unitPrice: Number(l.unitPrice),
          total: Number(l.totalPrice),
        }));
      const cogs = lineRows
        .filter((l) => l.salesOrderId === o.id)
        .reduce((s, l) => s + l.quantity * Number(l.cogsUnitCost), 0);
      const total = Number(o.totalAmount);
      const delivery = Number(o.deliveryCharge);

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        orderDate: o.orderDate.toISOString(),
        status: o.status,
        paymentStatus: o.paymentStatus,
        channel: o.channel,
        cityZone: o.cityZone,
        units: items.reduce((s, i) => s + i.qty, 0),
        subtotal: Number(o.subtotal),
        discount: Number(o.discount),
        deliveryCharge: delivery,
        totalAmount: total,
        cogs: r2(cogs),
        // goods profit: total less delivery income less cost
        profit: r2(total - delivery - cogs),
        courierName: o.courierId ? courierName.get(o.courierId) ?? null : null,
        waybillNumber: o.waybillNumber,
        customerLabel: customerLabel(o.customerName, o.customerPhone),
        items,
        timeline: timelines.get(o.id) ?? [],
      };
    })
    .sort((a, b) => b.orderDate.localeCompare(a.orderDate));
}

// ---------------------------------------------------------------------------
// Transactions (money ledger) — classified from posted journals
// ---------------------------------------------------------------------------

export interface JournalLineFacts {
  accountCode: string;
  accountName: string;
  accountGroup: string;
  debit: number;
  credit: number;
  partnerName: string | null;
}

export interface JournalFacts {
  id: string;
  entryNumber: string;
  date: Date;
  entryType: string;
  description: string;
  reference: string | null;
  sourceModule: string | null;
  status: string;
  lines: JournalLineFacts[];
}

const KIND_TITLES: Record<string, string> = {
  SALE: "Sale recognised",
  RETURN: "Customer return",
  EXPENSE: "Expense",
  DEPOSIT: "Partner capital deposit",
  LOAN: "Partner loan",
  DRAWING: "Partner drawing",
  REIMBURSEMENT: "Partner reimbursement",
  SETTLEMENT: "Courier COD payout",
  TRANSFER: "Wallet transfer",
  PURCHASE: "Stock purchase",
  PRODUCTION: "Production cost",
  PAYMENT: "Payment",
  REVERSAL: "Reversal",
  OTHER: "Adjustment",
};

/**
 * Pure classifier: turns one journal entry into a partner-facing money row, or
 * null for purely internal bookkeeping (COGS, inventory disposition, WIP moves).
 */
export function classifyJournal(j: JournalFacts, redact: (t: string) => string): PortalTxnRow | null {
  const ref = j.reference ?? "";
  if (/-COGS$/.test(ref) || /-INV$/.test(ref)) return null;

  const cashLines = j.lines.filter((l) => l.accountGroup === "CASH");
  const cashNet = r2(cashLines.reduce((s, l) => s + l.debit - l.credit, 0));
  const direction: PortalTxnRow["direction"] = cashNet > 0 ? "IN" : cashNet < 0 ? "OUT" : "NEUTRAL";
  const sum = (pred: (l: JournalLineFacts) => boolean, side: "debit" | "credit") =>
    r2(j.lines.filter(pred).reduce((s, l) => s + l[side], 0));
  const partnerName = j.lines.find((l) => l.partnerName)?.partnerName ?? null;
  const accountLabel = cashLines.length
    ? [...new Set(cashLines.map((l) => l.accountName))].join(" ↔ ")
    : null;
  const orderNo = ref.replace(/-(REV|COGS|INV)$/, "");

  let kind: TxnKind;
  let amount: number;
  let category: string | null = null;
  let title: string;

  switch (j.entryType) {
    case "SALES": {
      if (j.sourceModule === "RETURNS" || j.lines.some((l) => l.accountCode === "4020")) {
        kind = "RETURN";
        amount = sum((l) => l.accountCode === "4020", "debit");
        title = `Return · ${orderNo}`;
      } else if (j.lines.some((l) => l.accountGroup === "REVENUE")) {
        kind = "SALE";
        amount = r2(
          sum((l) => l.accountGroup === "REVENUE", "credit") - sum((l) => l.accountGroup === "REVENUE", "debit")
        );
        title = `Sale · ${orderNo}`;
        category = "Sales";
      } else {
        return null;
      }
      break;
    }
    case "SETTLEMENT": {
      kind = "SETTLEMENT";
      amount = Math.abs(cashNet);
      const fee = sum((l) => l.accountGroup === "EXPENSE", "debit");
      title = fee > 0 ? `Courier COD payout (fee ৳${fee})` : "Courier COD payout";
      category = "Courier";
      break;
    }
    case "CAPITAL_DEPOSIT":
      kind = "DEPOSIT";
      amount = Math.abs(cashNet) || sum((l) => l.accountGroup === "CAPITAL", "credit");
      title = partnerName ? `Capital deposit · ${partnerName}` : KIND_TITLES.DEPOSIT;
      category = "Capital";
      break;
    case "PARTNER_LOAN":
      kind = "LOAN";
      amount = Math.abs(cashNet) || sum(() => true, "debit");
      title = partnerName ? `Loan from ${partnerName}` : KIND_TITLES.LOAN;
      category = "Partner loan";
      break;
    case "DRAWING":
      kind = "DRAWING";
      amount = Math.abs(cashNet) || sum((l) => l.accountGroup === "DRAWINGS", "debit");
      title = partnerName ? `Drawing · ${partnerName}` : KIND_TITLES.DRAWING;
      category = "Drawings";
      break;
    case "PARTNER_REIMBURSEMENT":
      kind = "REIMBURSEMENT";
      amount = Math.abs(cashNet) || sum(() => true, "debit");
      title = partnerName ? `Reimbursed ${partnerName}` : KIND_TITLES.REIMBURSEMENT;
      category = "Reimbursement";
      break;
    case "EXPENSE": {
      kind = "EXPENSE";
      const exp = j.lines.filter((l) => l.accountGroup === "EXPENSE" && l.debit > 0);
      amount = sum((l) => l.accountGroup === "EXPENSE", "debit") || Math.abs(cashNet);
      const biggest = exp.sort((a, b) => b.debit - a.debit)[0];
      category = biggest?.accountName ?? "Expense";
      title = `${category}`;
      break;
    }
    case "TRANSFER":
      kind = "TRANSFER";
      amount = sum((l) => l.accountGroup === "CASH", "debit") || sum(() => true, "debit");
      title = KIND_TITLES.TRANSFER;
      category = "Transfer";
      return finish();
    case "PURCHASE":
      kind = "PURCHASE";
      amount = sum(() => true, "debit");
      title = KIND_TITLES.PURCHASE;
      category = "Inventory";
      break;
    case "PRODUCTION":
      // mostly internal WIP movements — only surface when real cash moved
      if (cashNet === 0) return null;
      kind = "PRODUCTION";
      amount = Math.abs(cashNet);
      title = KIND_TITLES.PRODUCTION;
      category = "Production";
      break;
    case "PAYMENT":
      if (cashNet === 0) return null;
      kind = "PAYMENT";
      amount = Math.abs(cashNet);
      title = KIND_TITLES.PAYMENT;
      break;
    case "REVERSAL":
      kind = "REVERSAL";
      amount = Math.abs(cashNet) || sum(() => true, "debit");
      title = `Reversal · ${ref || "entry"}`;
      category = "Reversal";
      break;
    default:
      if (cashNet === 0) return null;
      kind = "OTHER";
      amount = Math.abs(cashNet);
      title = KIND_TITLES.OTHER;
  }

  return finish();

  function finish(): PortalTxnRow | null {
    if (!(amount > 0)) return null;
    // NEUTRAL (non-cash) rows: sales on COD, expenses on credit, wallet transfers
    const dir = kind === "TRANSFER" ? "NEUTRAL" : kind === "SALE" ? "NEUTRAL" : direction;
    return {
      id: j.id,
      txnDate: j.date.toISOString(),
      kind,
      direction: dir,
      title: redact(title),
      description: redact(j.description),
      category,
      amount: r2(amount),
      accountLabel,
      partnerName,
      journalNo: j.entryNumber,
      sourceModule: j.sourceModule,
      isReversed: j.status === "REVERSED",
    };
  }
}

export async function buildPortalTransactions(since: Date): Promise<PortalTxnRow[]> {
  const rows = await db
    .select({
      jid: journalEntries.id,
      entryNumber: journalEntries.entryNumber,
      date: journalEntries.date,
      entryType: journalEntries.entryType,
      description: journalEntries.description,
      reference: journalEntries.reference,
      sourceModule: journalEntries.sourceModule,
      status: journalEntries.status,
      debit: journalLines.debit,
      credit: journalLines.credit,
      accountCode: accounts.code,
      accountName: accounts.name,
      accountGroup: accounts.group,
      partnerName: partners.name,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .leftJoin(partners, eq(journalLines.partnerId, partners.id))
    .where(and(inArray(journalEntries.status, ["POSTED", "REVERSED"]), gte(journalEntries.date, since)));

  const byJournal = new Map<string, JournalFacts>();
  for (const r of rows) {
    let j = byJournal.get(r.jid);
    if (!j) {
      j = {
        id: r.jid,
        entryNumber: r.entryNumber,
        date: r.date,
        entryType: r.entryType,
        description: r.description,
        reference: r.reference,
        sourceModule: r.sourceModule,
        status: r.status,
        lines: [],
      };
      byJournal.set(r.jid, j);
    }
    j.lines.push({
      accountCode: r.accountCode,
      accountName: r.accountName,
      accountGroup: r.accountGroup,
      debit: Number(r.debit),
      credit: Number(r.credit),
      partnerName: r.partnerName,
    });
  }

  const redact = await makeCustomerRedactor();
  const out: PortalTxnRow[] = [];
  for (const j of byJournal.values()) {
    const t = classifyJournal(j, redact);
    if (t) out.push(t);
  }
  return out.sort((a, b) => b.txnDate.localeCompare(a.txnDate) || b.journalNo.localeCompare(a.journalNo));
}

// ---------------------------------------------------------------------------
// Daily aggregates (all time) — what the portal charts read
// ---------------------------------------------------------------------------

export async function buildPortalDailyMetrics(): Promise<PortalDailyRow[]> {
  const day = sql`to_char((${journalEntries.date} AT TIME ZONE ${TZ_SQL})::date, 'YYYY-MM-DD')`;

  const gl = await db
    .select({
      day: sql<string>`${day}`,
      grossSales: sql<string>`COALESCE(SUM(CASE WHEN ${accounts.code} = '4010' THEN ${journalLines.credit} - ${journalLines.debit} ELSE 0 END), 0)`,
      deliveryIncome: sql<string>`COALESCE(SUM(CASE WHEN ${accounts.code} = '4030' THEN ${journalLines.credit} - ${journalLines.debit} ELSE 0 END), 0)`,
      returns: sql<string>`COALESCE(SUM(CASE WHEN ${accounts.group} = 'CONTRA_REVENUE' THEN ${journalLines.debit} - ${journalLines.credit} ELSE 0 END), 0)`,
      cogs: sql<string>`COALESCE(SUM(CASE WHEN ${accounts.group} = 'COGS' THEN ${journalLines.debit} - ${journalLines.credit} ELSE 0 END), 0)`,
      expenses: sql<string>`COALESCE(SUM(CASE WHEN ${accounts.group} = 'EXPENSE' THEN ${journalLines.debit} - ${journalLines.credit} ELSE 0 END), 0)`,
      capitalDeposits: sql<string>`COALESCE(SUM(CASE WHEN ${accounts.group} = 'CAPITAL' THEN ${journalLines.credit} - ${journalLines.debit} ELSE 0 END), 0)`,
      drawings: sql<string>`COALESCE(SUM(CASE WHEN ${accounts.group} = 'DRAWINGS' THEN ${journalLines.debit} - ${journalLines.credit} ELSE 0 END), 0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .where(inArray(journalEntries.status, ["POSTED", "REVERSED"]))
    .groupBy(day);

  // Real cash movement per day. Journals made only of wallet lines (pure
  // wallet-to-wallet transfers) are excluded so they don't inflate in/out.
  const cashRes = await db.execute(sql`
    WITH j AS (
      SELECT je.id,
             to_char((je.date AT TIME ZONE 'Asia/Dhaka')::date, 'YYYY-MM-DD') AS day,
             SUM(CASE WHEN a."group" = 'CASH' THEN jl.debit ELSE 0 END) AS cash_dr,
             SUM(CASE WHEN a."group" = 'CASH' THEN jl.credit ELSE 0 END) AS cash_cr,
             BOOL_OR(a."group" <> 'CASH') AS has_non_cash
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_entry_id
      JOIN accounts a ON a.id = jl.account_id
      WHERE je.status IN ('POSTED', 'REVERSED')
      GROUP BY je.id, je.date
    )
    SELECT day,
           COALESCE(SUM(CASE WHEN has_non_cash THEN cash_dr ELSE 0 END), 0) AS cash_in,
           COALESCE(SUM(CASE WHEN has_non_cash THEN cash_cr ELSE 0 END), 0) AS cash_out
    FROM j
    GROUP BY day
  `);

  const cats = await db
    .select({
      day: sql<string>`${day}`,
      name: accounts.name,
      amount: sql<string>`SUM(${journalLines.debit} - ${journalLines.credit})`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .where(and(inArray(journalEntries.status, ["POSTED", "REVERSED"]), eq(accounts.group, "EXPENSE")))
    .groupBy(day, accounts.name);

  const orderDay = sql`to_char((${salesOrders.orderDate} AT TIME ZONE ${TZ_SQL})::date, 'YYYY-MM-DD')`;
  const bookedRows = await db
    .select({
      day: sql<string>`${orderDay}`,
      channel: salesOrders.channel,
      orders: sql<number>`COUNT(*)::int`,
      value: sql<string>`COALESCE(SUM(${salesOrders.totalAmount}), 0)`,
    })
    .from(salesOrders)
    .where(sql`${salesOrders.status} <> 'CANCELLED'`)
    .groupBy(orderDay, salesOrders.channel);

  // units are summed from lines in a separate query (joining here would multiply order totals)
  const unitRows = await db
    .select({
      day: sql<string>`${orderDay}`,
      units: sql<number>`COALESCE(SUM(${salesLines.quantity}), 0)::int`,
    })
    .from(salesLines)
    .innerJoin(salesOrders, eq(salesLines.salesOrderId, salesOrders.id))
    .where(sql`${salesOrders.status} <> 'CANCELLED'`)
    .groupBy(orderDay);

  const days = new Map<string, PortalDailyRow>();
  const get = (d: string): PortalDailyRow => {
    let row = days.get(d);
    if (!row) {
      row = {
        day: d,
        ordersCount: 0,
        unitsBooked: 0,
        bookedValue: 0,
        grossSales: 0,
        deliveryIncome: 0,
        returns: 0,
        cogs: 0,
        expenses: 0,
        cashIn: 0,
        cashOut: 0,
        capitalDeposits: 0,
        drawings: 0,
        byChannel: {},
        byCategory: {},
      };
      days.set(d, row);
    }
    return row;
  };

  for (const g of gl) {
    const row = get(g.day);
    row.grossSales = r2(Number(g.grossSales));
    row.deliveryIncome = r2(Number(g.deliveryIncome));
    row.returns = r2(Number(g.returns));
    row.cogs = r2(Number(g.cogs));
    row.expenses = r2(Number(g.expenses));
    row.capitalDeposits = r2(Number(g.capitalDeposits));
    row.drawings = r2(Number(g.drawings));
  }
  for (const c of cashRes.rows as { day: string; cash_in: string; cash_out: string }[]) {
    const row = get(c.day);
    row.cashIn = r2(Number(c.cash_in));
    row.cashOut = r2(Number(c.cash_out));
  }
  for (const c of cats) {
    const amt = r2(Number(c.amount));
    if (amt !== 0) get(c.day).byCategory[c.name] = amt;
  }
  for (const b of bookedRows) {
    const row = get(b.day);
    row.ordersCount += b.orders;
    row.bookedValue = r2(row.bookedValue + Number(b.value));
    row.byChannel[b.channel] = { orders: b.orders, value: r2(Number(b.value)) };
  }

  for (const u of unitRows) get(u.day).unitsBooked = Number(u.units);

  return [...days.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export async function buildSalesReadModel(now: Date = new Date()): Promise<SalesReadModel> {
  const since = new Date(now.getTime() - RETENTION_DAYS * 86400_000);
  const [orders, transactions, daily] = await Promise.all([
    buildPortalOrders(since),
    buildPortalTransactions(since),
    buildPortalDailyMetrics(),
  ]);
  return { orders, transactions, daily, windowStart: since.toISOString() };
}

// ---------------------------------------------------------------------------
// Incremental apply (cloud Postgres)
// ---------------------------------------------------------------------------

interface Queryable {
  query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
}

interface TableSpec {
  table: string;
  key: string; // column
  keyExpr: string; // expression used to compare keys as text
  cols: { col: string; json: string; type: string }[];
}

const ORDER_SPEC: TableSpec = {
  table: "portal_sales_orders",
  key: "id",
  keyExpr: "id",
  cols: [
    { col: "id", json: "id", type: "text" },
    { col: "order_number", json: "orderNumber", type: "text" },
    { col: "order_date", json: "orderDate", type: "timestamptz" },
    { col: "status", json: "status", type: "text" },
    { col: "payment_status", json: "paymentStatus", type: "text" },
    { col: "channel", json: "channel", type: "text" },
    { col: "city_zone", json: "cityZone", type: "text" },
    { col: "units", json: "units", type: "integer" },
    { col: "subtotal", json: "subtotal", type: "numeric" },
    { col: "discount", json: "discount", type: "numeric" },
    { col: "delivery_charge", json: "deliveryCharge", type: "numeric" },
    { col: "total_amount", json: "totalAmount", type: "numeric" },
    { col: "cogs", json: "cogs", type: "numeric" },
    { col: "profit", json: "profit", type: "numeric" },
    { col: "courier_name", json: "courierName", type: "text" },
    { col: "waybill_number", json: "waybillNumber", type: "text" },
    { col: "customer_label", json: "customerLabel", type: "text" },
    { col: "items", json: "items", type: "jsonb" },
    { col: "timeline", json: "timeline", type: "jsonb" },
    { col: "row_hash", json: "hash", type: "text" },
  ],
};

const TXN_SPEC: TableSpec = {
  table: "portal_transactions",
  key: "id",
  keyExpr: "id",
  cols: [
    { col: "id", json: "id", type: "text" },
    { col: "txn_date", json: "txnDate", type: "timestamptz" },
    { col: "kind", json: "kind", type: "text" },
    { col: "direction", json: "direction", type: "text" },
    { col: "title", json: "title", type: "text" },
    { col: "description", json: "description", type: "text" },
    { col: "category", json: "category", type: "text" },
    { col: "amount", json: "amount", type: "numeric" },
    { col: "account_label", json: "accountLabel", type: "text" },
    { col: "partner_name", json: "partnerName", type: "text" },
    { col: "journal_no", json: "journalNo", type: "text" },
    { col: "source_module", json: "sourceModule", type: "text" },
    { col: "is_reversed", json: "isReversed", type: "boolean" },
    { col: "row_hash", json: "hash", type: "text" },
  ],
};

const DAILY_SPEC: TableSpec = {
  table: "portal_daily_metrics",
  key: "day",
  keyExpr: "day::text",
  cols: [
    { col: "day", json: "day", type: "date" },
    { col: "orders_count", json: "ordersCount", type: "integer" },
    { col: "units_booked", json: "unitsBooked", type: "integer" },
    { col: "booked_value", json: "bookedValue", type: "numeric" },
    { col: "gross_sales", json: "grossSales", type: "numeric" },
    { col: "delivery_income", json: "deliveryIncome", type: "numeric" },
    { col: "returns", json: "returns", type: "numeric" },
    { col: "cogs", json: "cogs", type: "numeric" },
    { col: "expenses", json: "expenses", type: "numeric" },
    { col: "cash_in", json: "cashIn", type: "numeric" },
    { col: "cash_out", json: "cashOut", type: "numeric" },
    { col: "capital_deposits", json: "capitalDeposits", type: "numeric" },
    { col: "drawings", json: "drawings", type: "numeric" },
    { col: "by_channel", json: "byChannel", type: "jsonb" },
    { col: "by_category", json: "byCategory", type: "jsonb" },
    { col: "row_hash", json: "hash", type: "text" },
  ],
};

export interface TableApplyResult {
  total: number;
  upserted: number;
  unchanged: number;
  deleted: number;
}

const CHUNK = 300;

async function applyTable(
  client: Queryable,
  spec: TableSpec,
  rows: (Record<string, any> & { hash: string })[],
  keyOf: (r: any) => string,
  now: Date
): Promise<TableApplyResult> {
  const existing = await client.query(`SELECT ${spec.keyExpr} AS k, row_hash FROM ${spec.table}`);
  const have = new Map<string, string | null>(existing.rows.map((r: any) => [String(r.k), r.row_hash]));

  const changed = rows.filter((r) => have.get(keyOf(r)) !== r.hash);

  const recordset = spec.cols.map((c) => `"${c.json}" ${c.type}`).join(", ");
  const insertCols = [...spec.cols.map((c) => c.col), "updated_at"].join(", ");
  const selectCols = [...spec.cols.map((c) => `x."${c.json}"`), "$2::timestamptz"].join(", ");
  const updateSet = [...spec.cols.filter((c) => c.col !== spec.key).map((c) => `${c.col} = EXCLUDED.${c.col}`), "updated_at = EXCLUDED.updated_at"].join(", ");
  const sqlText = `INSERT INTO ${spec.table} (${insertCols})
    SELECT ${selectCols} FROM jsonb_to_recordset($1::jsonb) AS x(${recordset})
    ON CONFLICT (${spec.key}) DO UPDATE SET ${updateSet}`;

  for (let i = 0; i < changed.length; i += CHUNK) {
    await client.query(sqlText, [JSON.stringify(changed.slice(i, i + CHUNK)), now]);
  }

  const keep = new Set(rows.map(keyOf));
  const gone = [...have.keys()].filter((k) => !keep.has(k));
  let deleted = 0;
  if (gone.length) {
    const res = await client.query(`DELETE FROM ${spec.table} WHERE ${spec.keyExpr} = ANY($1::text[])`, [gone]);
    deleted = res.rowCount ?? gone.length;
  }

  return { total: rows.length, upserted: changed.length, unchanged: rows.length - changed.length, deleted };
}

export interface ReadModelApplyResult {
  orders: TableApplyResult;
  transactions: TableApplyResult;
  daily: TableApplyResult;
}

/** Writes the model to the cloud DB, touching only rows whose content hash changed. */
export async function applySalesReadModel(
  client: Queryable,
  model: SalesReadModel,
  now: Date = new Date()
): Promise<ReadModelApplyResult> {
  await client.query(READ_MODEL_DDL);

  const withHash = <T extends object>(rows: T[]) => rows.map((r) => ({ ...r, hash: rowHash(r) }));

  const orders = await applyTable(client, ORDER_SPEC, withHash(model.orders), (r) => r.id, now);
  const transactions = await applyTable(client, TXN_SPEC, withHash(model.transactions), (r) => r.id, now);
  const daily = await applyTable(client, DAILY_SPEC, withHash(model.daily), (r) => r.day, now);
  return { orders, transactions, daily };
}
