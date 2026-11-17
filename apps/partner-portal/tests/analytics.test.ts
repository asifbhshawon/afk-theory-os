import { describe, it, expect } from "vitest";
import {
  balanceSeries,
  categoryTotals,
  channelTotals,
  dayKeys,
  dhakaDay,
  fillDays,
  netProfitOf,
  parseRange,
  pctChange,
  revenueOf,
  splitPeriods,
  sumBy,
} from "../lib/analytics";
import type { DailyMetric } from "../lib/portal-data";

const row = (day: string, over: Partial<DailyMetric> = {}): DailyMetric => ({
  day,
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
  ...over,
});

describe("portal analytics helpers", () => {
  it("uses the Dhaka calendar day, not UTC", () => {
    // 20:00 UTC on the 1st is already 02:00 on the 2nd in Dhaka (UTC+6)
    expect(dhakaDay(new Date("2026-11-01T20:00:00Z"))).toBe("2026-11-02");
    expect(dhakaDay(new Date("2026-11-01T17:59:00Z"))).toBe("2026-11-01");
  });

  it("builds n consecutive day keys ending today, oldest first", () => {
    const keys = dayKeys(4, new Date("2026-11-17T10:00:00Z"));
    expect(keys).toEqual(["2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17"]);
  });

  it("zero-fills days without activity and keeps real rows", () => {
    const keys = ["2026-11-15", "2026-11-16", "2026-11-17"];
    const filled = fillDays([row("2026-11-16", { grossSales: 500 })], keys);
    expect(filled.map((d) => d.grossSales)).toEqual([0, 500, 0]);
    expect(filled.map((d) => d.day)).toEqual(keys);
  });

  it("splits current and previous periods of equal length", () => {
    const now = new Date("2026-11-17T10:00:00Z");
    const { current, previous } = splitPeriods(
      [row("2026-11-17", { grossSales: 300 }), row("2026-11-12", { grossSales: 100 })],
      3,
      now
    );
    expect(current.map((d) => d.day)).toEqual(["2026-11-15", "2026-11-16", "2026-11-17"]);
    expect(previous.map((d) => d.day)).toEqual(["2026-11-12", "2026-11-13", "2026-11-14"]);
    expect(sumBy(current, revenueOf)).toBe(300);
    expect(sumBy(previous, revenueOf)).toBe(100);
  });

  it("computes net profit = revenue − returns − cogs − expenses", () => {
    const d = row("2026-11-17", { grossSales: 1000, deliveryIncome: 100, returns: 100, cogs: 400, expenses: 250 });
    expect(revenueOf(d)).toBe(1100);
    expect(netProfitOf(d)).toBe(350);
  });

  it("pctChange handles growth, decline and no baseline", () => {
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(50, 100)).toBe(-50);
    expect(pctChange(10, 0)).toBeNull();
    expect(pctChange(-50, -100)).toBe(50); // loss halved = improvement
  });

  it("rebuilds the running cash balance backwards from today", () => {
    const rows = [
      row("d1", { cashIn: 1000, cashOut: 0 }), // +1000
      row("d2", { cashIn: 0, cashOut: 300 }), // −300
      row("d3", { cashIn: 200, cashOut: 100 }), // +100
    ];
    // balance today = 5000  → after d3 = 5000, after d2 = 4900, after d1 = 5200
    expect(balanceSeries(5000, rows)).toEqual([5200, 4900, 5000]);
  });

  it("merges channel and category breakdowns, largest first", () => {
    const rows = [
      row("a", { byChannel: { FACEBOOK: { orders: 2, value: 2000 }, WEBSITE: { orders: 1, value: 500 } }, byCategory: { Ads: 300, Packaging: 100 } }),
      row("b", { byChannel: { FACEBOOK: { orders: 1, value: 1000 } }, byCategory: { Ads: 200, Refunds: -50 } }),
    ];
    expect(channelTotals(rows)).toEqual([
      { channel: "FACEBOOK", orders: 3, value: 3000 },
      { channel: "WEBSITE", orders: 1, value: 500 },
    ]);
    expect(categoryTotals(rows)).toEqual([
      { name: "Ads", amount: 500 },
      { name: "Packaging", amount: 100 },
    ]);
  });

  it("parseRange only accepts supported periods", () => {
    expect(parseRange("7")).toBe(7);
    expect(parseRange(["90"])).toBe(90);
    expect(parseRange("14")).toBe(30);
    expect(parseRange(undefined)).toBe(30);
    expect(parseRange("abc", 7)).toBe(7);
  });
});
