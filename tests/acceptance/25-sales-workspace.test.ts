import { describe, it, expect } from "vitest";
import { db } from "@/db";
import { paymentAccounts, contacts, courierSettlements, courierSettlementLines, journalLines } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createProductWithVariants, receivePurchaseLot } from "@/server/services/inventory";
import {
  createSalesOrder,
  shipSalesOrder,
  deliverSalesOrderAndRecogniseRevenue,
  cancelSalesOrder,
  settleCourierRemittance,
  listRecentOrdersWithItems,
} from "@/server/services/sales";
import { getFinancialStatements } from "@/server/services/finance";

async function setup(qty = 20) {
  const runId = Math.random().toString(36).slice(2, 8);
  const { variants } = await createProductWithVariants({
    name: `Workspace Tee ${runId}`,
    styleCode: `AFK-WS-${runId}`,
    category: "T-Shirt",
    retailPrice: 1000,
    variants: [{ sku: `AFK-WS-M-${runId}`, size: "M", color: "Black", costPrice: 250, sellingPrice: 1000 }],
  });
  const [cash] = await db.select().from(paymentAccounts).where(eq(paymentAccounts.type, "CASH")).limit(1);
  const [bank] = await db.select().from(paymentAccounts).where(eq(paymentAccounts.type, "BANK")).limit(1);
  await receivePurchaseLot({ variantId: variants[0].id, lotNumber: `LOT-WS-${runId}`, quantity: qty, unitCost: 250, paymentAccountId: cash.id, isRawMaterial: false });
  const [steadfast] = await db.insert(contacts).values({ name: `Steadfast ${runId}`, type: "COURIER" }).returning();
  const [pathao] = await db.insert(contacts).values({ name: `Pathao ${runId}`, type: "COURIER" }).returning();
  return { runId, variantId: variants[0].id, bank, steadfast, pathao };
}

const cust = { customerName: "Workspace Buyer", customerPhone: "01666000111", shippingAddress: "Banani, Dhaka" };

async function deliveredOrder(variantId: string, courierId: string, tag: string, qty = 1, delivery = 100) {
  const { order } = await createSalesOrder({
    ...cust,
    lines: [{ variantId, quantity: qty, unitPrice: 1000 }],
    deliveryCharge: delivery,
    notes: `note ${tag}`,
    idempotencyKey: `WS-${tag}`,
  });
  await shipSalesOrder({ orderId: order.id, courierId, waybillNumber: `WB-${tag}` });
  await deliverSalesOrderAndRecogniseRevenue({ orderId: order.id });
  return order;
}

describe("Sales workspace: order panel data and batch courier payouts", () => {
  it("order panel data carries timeline, linked journals, cleaned notes and per-order profit", async () => {
    const { variantId, steadfast, bank } = await setup();
    const order = await deliveredOrder(variantId, steadfast.id, `a${Date.now()}`, 2);
    await settleCourierRemittance({
      courierId: steadfast.id,
      paymentAccountId: bank.id,
      settlements: [{ salesOrderId: order.id, codAmount: 2100, courierFee: 70 }],
    });

    const row = (await listRecentOrdersWithItems(300)).find((o) => o.id === order.id)!;
    expect(row.timeline.map((t) => t.status)).toEqual(["CONFIRMED", "SHIPPED", "DELIVERED", "SETTLED"]);
    expect(row.courierName).toBe(steadfast.name);
    expect(row.profit).toBe(2100 - 100 - 500);
    // revenue + COGS journals (sourceId) and the courier payout journal (via the settlement line)
    expect(row.journals.length).toBeGreaterThanOrEqual(3);
    expect(row.journals.some((j) => /Courier COD remittance/.test(j.description))).toBe(true);
    expect(row.journals.some((j) => /Sales revenue recognized/.test(j.description))).toBe(true);
    // the idempotency tag is bookkeeping, only the human note remains
    expect(row.notes).toMatch(/^note a/);
    expect(row.notes).not.toContain("IDEMPOTENCY");
  });

  it("a cancelled order shows a CANCELLED step in its timeline", async () => {
    const { variantId, steadfast } = await setup();
    const { order } = await createSalesOrder({ ...cust, lines: [{ variantId, quantity: 1, unitPrice: 1000 }] });
    await shipSalesOrder({ orderId: order.id, courierId: steadfast.id, waybillNumber: "WB-C" });
    await cancelSalesOrder({ orderId: order.id, reason: "Courier returned parcel" });
    const row = (await listRecentOrdersWithItems(300)).find((o) => o.id === order.id)!;
    expect(row.timeline.map((t) => t.status)).toEqual(["CONFIRMED", "SHIPPED", "CANCELLED"]);
  });

  it("settles several parcels of one courier in a single balanced journal", async () => {
    const { variantId, steadfast, bank } = await setup();
    const t = Date.now();
    const a = await deliveredOrder(variantId, steadfast.id, `b1-${t}`, 1, 100); // COD 1100
    const b = await deliveredOrder(variantId, steadfast.id, `b2-${t}`, 2, 100); // COD 2100
    const c = await deliveredOrder(variantId, steadfast.id, `b3-${t}`, 1, 0); //  COD 1000
    const before = await db.select().from(courierSettlements);

    const settlement = await settleCourierRemittance({
      courierId: steadfast.id,
      paymentAccountId: bank.id,
      settlements: [
        { salesOrderId: a.id, codAmount: 1100, courierFee: 60 },
        { salesOrderId: b.id, codAmount: 2100, courierFee: 60 },
        { salesOrderId: c.id, codAmount: 950, courierFee: 50 }, // courier short-paid this one
      ],
      notes: "Statement 14 Nov",
    });

    expect(Number(settlement.totalCodCollected)).toBe(4150);
    expect(Number(settlement.courierFeesDeducted)).toBe(170);
    expect(Number(settlement.netAmountReceived)).toBe(3980);
    expect((await db.select().from(courierSettlements)).length).toBe(before.length + 1);

    const lines = await db.select().from(courierSettlementLines).where(eq(courierSettlementLines.courierSettlementId, settlement.id));
    expect(lines).toHaveLength(3);
    const jl = await db.select().from(journalLines).where(eq(journalLines.journalEntryId, settlement.journalEntryId!));
    const dr = jl.reduce((s, l) => s + Number(l.debit), 0);
    const cr = jl.reduce((s, l) => s + Number(l.credit), 0);
    expect(dr).toBeCloseTo(cr, 2);
    expect(dr).toBeCloseTo(4150, 2);

    const rows = await listRecentOrdersWithItems(300);
    for (const o of [a, b, c]) expect(rows.find((r) => r.id === o.id)!.paymentStatus).toBe("PAID");
    expect((await getFinancialStatements()).trialBalance.isBalanced).toBe(true);
  });

  it("rejects a payout that mixes in another courier's parcel, and one that repeats a settled parcel", async () => {
    const { variantId, steadfast, pathao, bank } = await setup();
    const t = Date.now();
    const mine = await deliveredOrder(variantId, steadfast.id, `c1-${t}`);
    const theirs = await deliveredOrder(variantId, pathao.id, `c2-${t}`);

    await expect(
      settleCourierRemittance({
        courierId: steadfast.id,
        paymentAccountId: bank.id,
        settlements: [
          { salesOrderId: mine.id, codAmount: 1100, courierFee: 50 },
          { salesOrderId: theirs.id, codAmount: 1100, courierFee: 50 },
        ],
      })
    ).rejects.toThrow(/different courier/);

    // nothing was posted by the failed attempt
    const rows = await listRecentOrdersWithItems(300);
    expect(rows.find((r) => r.id === mine.id)!.paymentStatus).not.toBe("PAID");

    await settleCourierRemittance({
      courierId: steadfast.id,
      paymentAccountId: bank.id,
      settlements: [{ salesOrderId: mine.id, codAmount: 1100, courierFee: 50 }],
    });
    await expect(
      settleCourierRemittance({
        courierId: steadfast.id,
        paymentAccountId: bank.id,
        settlements: [{ salesOrderId: mine.id, codAmount: 1100, courierFee: 50 }],
      })
    ).rejects.toThrow(/already settled/);
  });
});
