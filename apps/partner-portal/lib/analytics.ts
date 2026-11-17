import type { DailyMetric } from "./portal-data";

/** Pure helpers that turn the per-day aggregates into chart-ready series. No I/O. */

export const BUSINESS_TZ = "Asia/Dhaka";
export const RANGE_OPTIONS = [7, 30, 90] as const;
export type RangeDays = (typeof RANGE_OPTIONS)[number];

export function parseRange(value: string | string[] | undefined, fallback: RangeDays = 30): RangeDays {
  const v = Number(Array.isArray(value) ? value[0] : value);
  return (RANGE_OPTIONS as readonly number[]).includes(v) ? (v as RangeDays) : fallback;
}

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** YYYY-MM-DD of an instant in the business time zone (Dhaka has no DST). */
export function dhakaDay(date: Date): string {
  return dayFormatter.format(date);
}

/** The last `n` calendar days ending today (Dhaka), oldest first. */
export function dayKeys(n: number, now: Date = new Date()): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) keys.push(dhakaDay(new Date(now.getTime() - i * 86_400_000)));
  return keys;
}

const ZERO: Omit<DailyMetric, "day"> = {
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

/** One row per key, zero-filled where the business had no activity. */
export function fillDays(daily: DailyMetric[], keys: string[]): DailyMetric[] {
  const byDay = new Map(daily.map((d) => [d.day, d]));
  return keys.map((day) => byDay.get(day) ?? { day, ...ZERO });
}

export const revenueOf = (d: DailyMetric) => d.grossSales + d.deliveryIncome;
export const netProfitOf = (d: DailyMetric) => revenueOf(d) - d.returns - d.cogs - d.expenses;

export function sumBy(rows: DailyMetric[], pick: (d: DailyMetric) => number): number {
  return Math.round(rows.reduce((s, d) => s + pick(d), 0) * 100) / 100;
}

/** % change vs the previous period; null when there is nothing to compare with. */
export function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

/**
 * Splits `2 * days` of data into the current and the previous period, each
 * zero-filled to exactly `days` rows.
 */
export function splitPeriods(daily: DailyMetric[], days: number, now: Date = new Date()) {
  const keys = dayKeys(days * 2, now);
  const all = fillDays(daily, keys);
  return { previous: all.slice(0, days), current: all.slice(days) };
}

/**
 * Reconstructs the running cash balance for each day by walking backwards from
 * today's known balance (balance[t] = today − net cash movement after t).
 */
export function balanceSeries(currentBalance: number, rows: DailyMetric[]): number[] {
  const out = new Array<number>(rows.length);
  let balance = currentBalance;
  for (let i = rows.length - 1; i >= 0; i--) {
    out[i] = Math.round(balance * 100) / 100;
    balance -= rows[i].cashIn - rows[i].cashOut;
  }
  return out;
}

/** Merges the by-channel breakdown of many days into totals, biggest first. */
export function channelTotals(rows: DailyMetric[]) {
  const totals = new Map<string, { orders: number; value: number }>();
  for (const r of rows) {
    for (const [channel, v] of Object.entries(r.byChannel)) {
      const t = totals.get(channel) ?? { orders: 0, value: 0 };
      t.orders += v.orders;
      t.value += v.value;
      totals.set(channel, t);
    }
  }
  return [...totals.entries()]
    .map(([channel, v]) => ({ channel, ...v }))
    .sort((a, b) => b.value - a.value);
}

/** Merges expense-by-category across days, biggest first. */
export function categoryTotals(rows: DailyMetric[]) {
  const totals = new Map<string, number>();
  for (const r of rows) {
    for (const [name, amount] of Object.entries(r.byCategory)) {
      totals.set(name, (totals.get(name) ?? 0) + amount);
    }
  }
  return [...totals.entries()]
    .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}
