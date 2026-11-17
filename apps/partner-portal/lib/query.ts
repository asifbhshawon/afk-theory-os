/**
 * URL <-> filter helpers shared by the Sales and Money pages and their cached loaders.
 * Every filter lives in the query string, so each view is a plain link and cacheable.
 * Pure functions only (unit-tested).
 */

type Param = string | number | undefined | null;

/** Builds `/path?a=1&b=2`, dropping empty values. */
export function buildHref(basePath: string, params: Record<string, Param>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v).trim() !== "") qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${basePath}?${s}` : basePath;
}

/** First value of a possibly repeated search param. */
export function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function parsePage(v: string | string[] | undefined): number {
  const n = Math.floor(Number(first(v)));
  return Number.isFinite(n) && n >= 1 && n <= 10_000 ? n : 1;
}

/** Trims and caps free-text search so it can't bloat the cache or the query. */
export function parseSearch(v: string | string[] | undefined): string {
  return (first(v) ?? "").trim().slice(0, 60);
}

/** Escapes LIKE wildcards so user text is matched literally. */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export const ORDER_FILTERS = [
  { key: "all", label: "All", statuses: null },
  { key: "toship", label: "To ship", statuses: ["CONFIRMED", "PACKED"] },
  { key: "shipped", label: "With courier", statuses: ["SHIPPED"] },
  { key: "delivered", label: "Delivered", statuses: ["DELIVERED"] },
  { key: "closed", label: "Cancelled / returned", statuses: ["CANCELLED", "RETURNED"] },
] as const;

export type OrderFilterKey = (typeof ORDER_FILTERS)[number]["key"];

export function parseOrderFilter(v: string | string[] | undefined): OrderFilterKey {
  const k = first(v);
  return ORDER_FILTERS.some((f) => f.key === k) ? (k as OrderFilterKey) : "all";
}

export function statusesFor(key: OrderFilterKey): string[] | null {
  const f = ORDER_FILTERS.find((x) => x.key === key);
  return f && f.statuses ? [...f.statuses] : null;
}

/** Which tab an order status belongs to (for the per-tab counts). */
export function filterKeyForStatus(status: string): OrderFilterKey {
  if (status === "CONFIRMED" || status === "PACKED") return "toship";
  if (status === "SHIPPED") return "shipped";
  if (status === "DELIVERED") return "delivered";
  return "closed";
}

// ---------------------------------------------------------------------------
// Money ledger
// ---------------------------------------------------------------------------

export const LEDGER_FILTERS = [
  { key: "all", label: "Everything", kinds: null },
  { key: "in", label: "Deposits & loans", kinds: ["DEPOSIT", "LOAN"] },
  { key: "expenses", label: "Expenses", kinds: ["EXPENSE"] },
  { key: "payouts", label: "Courier payouts", kinds: ["SETTLEMENT"] },
  { key: "sales", label: "Sales & returns", kinds: ["SALE", "RETURN"] },
  { key: "partners", label: "Drawings & reimbursements", kinds: ["DRAWING", "REIMBURSEMENT"] },
  { key: "stock", label: "Stock & production", kinds: ["PURCHASE", "PRODUCTION", "PAYMENT"] },
  { key: "transfers", label: "Transfers & reversals", kinds: ["TRANSFER", "REVERSAL", "OTHER"] },
] as const;

export type LedgerFilterKey = (typeof LEDGER_FILTERS)[number]["key"];

export function parseLedgerFilter(v: string | string[] | undefined): LedgerFilterKey {
  const k = first(v);
  return LEDGER_FILTERS.some((f) => f.key === k) ? (k as LedgerFilterKey) : "all";
}

export function kindsFor(key: LedgerFilterKey): string[] | null {
  const f = LEDGER_FILTERS.find((x) => x.key === key);
  return f && f.kinds ? [...f.kinds] : null;
}

export const KIND_LABELS: Record<string, string> = {
  SALE: "Sale",
  RETURN: "Return",
  EXPENSE: "Expense",
  DEPOSIT: "Deposit",
  LOAN: "Partner loan",
  DRAWING: "Drawing",
  REIMBURSEMENT: "Reimbursement",
  SETTLEMENT: "Courier payout",
  TRANSFER: "Transfer",
  PURCHASE: "Stock purchase",
  PRODUCTION: "Production",
  PAYMENT: "Payment",
  REVERSAL: "Reversal",
  OTHER: "Adjustment",
};

export const PAGE_SIZE = 15;
