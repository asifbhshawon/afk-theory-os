import { describe, it, expect } from "vitest";
import { db } from "@/db";
import { paymentAccounts, inventoryLots, contacts, salesOrders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createProductWithVariants, receivePurchaseLot } from "@/server/services/inventory";
import {
  createSalesOrder,
  shipSalesOrder,
  deliverSalesOrderAndRecogniseRevenue,
  cancelSalesOrder,
  settleCourierRemittance,
  processSalesReturn,
  listSellableVariants,
  listRecentOrdersWithItems,
} from "@/server/services/sales";
import { buildSanitizedPushPayload, buildLowStockAlerts } from "@/server/services/portal-sync";
import { getFinancialStatements } from "@/server/services/finance";

async function setup(qty: number) {
  const runId = Math.random().toString(36).slice(2, 8);
  const { variants } = await createProductWithVariants({
    name: `Workflow Tee ${runId}`,
    styleCode: `AFK-WF-${runId}`,
    category: "T-Shirt",
    retailPrice: 1000,
    variants: [
      { sku: `AFK-WF-M-${runId}`, size: "M", color: "Black", costPrice: 250, sellingPrice: 1000 },
      { sku: `AFK-WF-L-${runId}`, size: "L", color: "Black", costPrice: 250, sellingPrice: 1000 },
    ],
  });
  const [cash] = await db.select().from(paymentAccounts).where(eq(paymentAccounts.type, "CASH")).limit(1);
  const [bank] = await db.select().from(paymentAccounts).where(eq(paymentAccounts.type, "BANK")).limit(1);
  const lotM = await receivePurchaseLot({
    variantId: variants[0].id,
    lotNumber: `LOT-WF-M-${runId}`,
    quantity: qty,
    unitCost: 250,
    paymentAccountId: cash.id,
    isRawMaterial: false,
  });
  const lotL = await receivePurchaseLot({
    variantId: variants[1].id,
    lotNumber: `LOT-WF-L-${runId}`,
    quantity: qty,
    unitCost: 250,
    paymentAccountId: cash.id,
    isRawMaterial: false,
  });
  const [courier] = await db
    .insert(contacts)
    .values({ name: `Courier ${runId}`, type: "COURIER", phone: "01000000000" })
    .returning();
  return { runId, variants, lotM, lotL, courier, cash, bank };
}

const cust = { customerName: "Zubayer Quddus", customerPhone: "01955512345", shippingAddress: "Dhaka" };

describe("Sales order workflow: multi-line, cancel, guards, sync accuracy", () => {
  it("creates a multi-item order, lists it with items/profit, and exposes live available stock", async () => {
    const { variants, lotM, lotL } = await setup(10);
    const { order } = await createSalesOrder({
      ...cust,
      channel: "FACEBOOK",
      lines: [
        { variantId: variants[0].id, quantity: 2, unitPrice: 1000 },
        { variantId: variants[1].id, quantity: 1, unitPrice: 900 },
      ],
      deliveryCharge: 80,
      discount: 100,
      notes: "call first",
      idempotencyKey: `K-${order_key()}`,
    });
    expect(Number(order.subtotal)).toBe(2900);
    expect(Number(order.totalAmount)).toBe(2900 + 80 - 100);
    expect(order.channel).toBe("FACEBOOK");
    expect(order.notes).toContain("call first");

    const sellable = await listSellableVariants();
    expect(sellable.find((v) => v.id === variants[0].id)?.available).toBe(8);
    expect(sellable.find((v) => v.id === variants[1].id)?.available).toBe(9);

    const listed = (await listRecentOrdersWithItems(200)).find((o) => o.id === order.id)!;
    expect(listed.items).toHaveLength(2);
    expect(listed.units).toBe(3);
    // profit = total - delivery - cogs = 2880 - 80 - 3*250
    expect(listed.profit).toBe(2880 - 80 - 750);

    const [m] = await db.select().from(inventoryLots).where(eq(inventoryLots.id, lotM.id));
    const [l] = await db.select().from(inventoryLots).where(eq(inventoryLots.id, lotL.id));
    expect(m.reservedQuantity).toBe(2);
    expect(l.reservedQuantity).toBe(1);
  });

  it("idempotency still works when a user note is stored alongside the key", async () => {
    const { variants } = await setup(5);
    const key = `IDEM-${order_key()}`;
    const input = { ...cust, lines: [{ variantId: variants[0].id, quantity: 1, unitPrice: 1000 }], notes: "gift", idempotencyKey: key };
    const a = await createSalesOrder(input);
    const b = await createSalesOrder(input);
    expect(a.isDuplicate).toBe(false);
    expect(b.isDuplicate).toBe(true);
    expect(b.order.id).toBe(a.order.id);
  });

  it("rejects invalid quantities, negative prices and over-selling with a readable SKU message", async () => {
    const { variants } = await setup(3);
    await expect(
      createSalesOrder({ ...cust, lines: [{ variantId: variants[0].id, quantity: 0, unitPrice: 1000 }] })
    ).rejects.toThrow(/whole number/);
    await expect(
      createSalesOrder({ ...cust, lines: [{ variantId: variants[0].id, quantity: 1, unitPrice: -5 }] })
    ).rejects.toThrow(/negative/);
    await expect(
      createSalesOrder({ ...cust, lines: [{ variantId: variants[0].id, quantity: 9, unitPrice: 1000 }] })
    ).rejects.toThrow(/Out of stock for SKU .*AFK-WF-M-/);
  });

  it("cancelling a CONFIRMED order releases the reservation and blocks further actions", async () => {
    const { variants, lotM, courier } = await setup(5);
    const { order } = await createSalesOrder({ ...cust, lines: [{ variantId: variants[0].id, quantity: 3, unitPrice: 1000 }] });

    await expect(cancelSalesOrder({ orderId: order.id, reason: "  " })).rejects.toThrow(/reason/);
    const res = await cancelSalesOrder({ orderId: order.id, reason: "Customer cancelled" });
    expect(res.releasedUnits).toBe(3);

    const [lot] = await db.select().from(inventoryLots).where(eq(inventoryLots.id, lotM.id));
    expect(lot.reservedQuantity).toBe(0);
    expect(lot.currentQuantity).toBe(5);

    const [row] = await db.select().from(salesOrders).where(eq(salesOrders.id, order.id));
    expect(row.status).toBe("CANCELLED");
    expect(row.paymentStatus).toBe("VOID");

    await expect(cancelSalesOrder({ orderId: order.id, reason: "again" })).rejects.toThrow(/already cancelled/);
    await expect(shipSalesOrder({ orderId: order.id, courierId: courier.id, waybillNumber: "X" })).rejects.toThrow(/cannot be shipped/);
    await expect(deliverSalesOrderAndRecogniseRevenue({ orderId: order.id })).rejects.toThrow(/only SHIPPED/);
    await expect(
      processSalesReturn({ salesOrderId: order.id, reason: "x", isRestockable: true, refundAmount: 0 })
    ).rejects.toThrow(/Only delivered orders/);

    // stock can be sold again
    const again = await createSalesOrder({ ...cust, lines: [{ variantId: variants[0].id, quantity: 5, unitPrice: 1000 }] });
    expect(again.isDuplicate).toBe(false);
  });

  it("cancelling a SHIPPED order brings stock back from transit and books no revenue", async () => {
    const { variants, lotM, courier } = await setup(5);
    const before = (await getFinancialStatements()).incomeStatement.totalGrossRevenue;
    const { order } = await createSalesOrder({ ...cust, lines: [{ variantId: variants[0].id, quantity: 2, unitPrice: 1000 }] });
    await shipSalesOrder({ orderId: order.id, courierId: courier.id, waybillNumber: "WB-1" });
    await cancelSalesOrder({ orderId: order.id, reason: "Courier returned parcel" });

    const [lot] = await db.select().from(inventoryLots).where(eq(inventoryLots.id, lotM.id));
    expect(lot.reservedQuantity).toBe(0);
    expect(lot.currentQuantity).toBe(5);
    const after = await getFinancialStatements();
    expect(after.incomeStatement.totalGrossRevenue).toBe(before);
    expect(after.trialBalance.isBalanced).toBe(true);
  });

  it("a delivered order cannot be cancelled, shipped twice or settled twice", async () => {
    const { variants, courier, bank } = await setup(5);
    const { order } = await createSalesOrder({ ...cust, lines: [{ variantId: variants[0].id, quantity: 1, unitPrice: 1000 }], deliveryCharge: 100 });
    await shipSalesOrder({ orderId: order.id, courierId: courier.id, waybillNumber: "WB-2" });
    await expect(shipSalesOrder({ orderId: order.id, courierId: courier.id, waybillNumber: "WB-2" })).rejects.toThrow(/cannot be shipped/);
    await deliverSalesOrderAndRecogniseRevenue({ orderId: order.id });
    await expect(cancelSalesOrder({ orderId: order.id, reason: "late" })).rejects.toThrow(/use "Return"/);

    const settle = () =>
      settleCourierRemittance({
        courierId: courier.id,
        paymentAccountId: bank.id,
        settlements: [{ salesOrderId: order.id, codAmount: 1100, courierFee: 60 }],
      });
    await expect(
      settleCourierRemittance({
        courierId: courier.id,
        paymentAccountId: bank.id,
        settlements: [{ salesOrderId: order.id, codAmount: 1100, courierFee: 2000 }],
      })
    ).rejects.toThrow(/fee/);
    await settle();
    await expect(settle()).rejects.toThrow(/already settled/);

    // refund cannot exceed order total
    await expect(
      processSalesReturn({ salesOrderId: order.id, reason: "x", isRestockable: true, refundAmount: 5000 })
    ).rejects.toThrow(/Refund must be/);
    expect((await getFinancialStatements()).trialBalance.isBalanced).toBe(true);
  });

  it("portal sync payload: low-stock alerts are per SKU across all lots and include out-of-stock items", async () => {
    // default reorder level 10: M has 2 in stock (low), L has 0 sellable after reserving all (out of stock)
    const { variants } = await setup(2);
    await createSalesOrder({ ...cust, lines: [{ variantId: variants[1].id, quantity: 2, unitPrice: 1000 }] });

    // uncapped list: the pushed list is capped at 50 and this database accumulates data across runs
    const alerts = await buildLowStockAlerts(100_000);
    const { payload } = await buildSanitizedPushPayload();
    const m = alerts.find((a: any) => a.id === variants[0].id);
    const l = alerts.find((a: any) => a.id === variants[1].id);
    expect(m?.status).toBe("LOW_STOCK");
    expect(m?.currentQuantity).toBe(2);
    expect(l?.status).toBe("OUT_OF_STOCK");
    expect(l?.currentQuantity).toBe(0);
    expect(typeof payload.businessSummary.courierPendingSettlements).toBe("number");
    // no customer PII in the payload
    const json = JSON.stringify(payload);
    expect(json).not.toContain("01955512345");
    expect(json).not.toContain("Zubayer");
  });
});

function order_key() {
  return Math.random().toString(36).slice(2, 10);
}
