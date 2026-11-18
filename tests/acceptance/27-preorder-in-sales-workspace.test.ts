import { describe, it, expect } from "vitest";
import { db } from "@/db";
import { paymentAccounts, contacts, productVariants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createProductWithVariants } from "@/server/services/inventory";
import {
  createSalesOrder,
  shipSalesOrder,
  deliverSalesOrderAndRecogniseRevenue,
  cancelSalesOrder,
  settleCourierRemittance,
  listSellableVariants,
  listRecentOrdersWithItems,
} from "@/server/services/sales";
import { buildLowStockAlerts } from "@/server/services/portal-sync";
import { getFinancialStatements } from "@/server/services/finance";

// The pre-order / "in stock without a count" capabilities (catalog work) must keep
// working inside the sales workspace flows: panel data, ship, deliver, payout, cancel, portal sync.
async function product(costPrice = 400) {
  const runId = Math.random().toString(36).slice(2, 8);
  const { variants } = await createProductWithVariants({
    name: `Preorder Tee ${runId}`,
    styleCode: `AFK-PO-${runId}`,
    category: "T-Shirt",
    retailPrice: 1500,
    variants: [{ sku: `AFK-PO-M-${runId}`, size: "M", color: "Black", costPrice, sellingPrice: 1500 }],
  });
  const [courier] = await db.insert(contacts).values({ name: `PO Courier ${runId}`, type: "COURIER" }).returning();
  const [bank] = await db.select().from(paymentAccounts).where(eq(paymentAccounts.type, "BANK")).limit(1);
  return { runId, variantId: variants[0].id, sku: `AFK-PO-M-${runId}`, courier, bank };
}

const cust = { customerName: "Preorder Buyer", customerPhone: "01577000123", shippingAddress: "Uttara, Dhaka" };

describe("Pre-orders and uncounted stock inside the sales workspace", () => {
  it("refuses a zero-stock sale without the pre-order flag, with a readable message", async () => {
    const { variantId, sku } = await product();
    await expect(
      createSalesOrder({ ...cust, lines: [{ variantId, quantity: 2, unitPrice: 1500 }] })
    ).rejects.toThrow(new RegExp(`Out of stock for SKU .*${sku}`, "i"));
  });

  it("a pre-order flows through ship, deliver and a batch payout; panel data shows cost fallback and a clean timeline", async () => {
    const { variantId, courier, bank } = await product(400);
    const { order } = await createSalesOrder({
      ...cust,
      lines: [{ variantId, quantity: 2, unitPrice: 1500 }],
      deliveryCharge: 100,
      allowBackorder: true,
    });

    let row = (await listRecentOrdersWithItems(300)).find((o) => o.id === order.id)!;
    expect(row.units).toBe(2);
    expect(row.cogs).toBe(800); // 2 × variant cost price (no lot to cost from)
    expect(row.profit).toBe(3100 - 100 - 800);

    await shipSalesOrder({ orderId: order.id, courierId: courier.id, waybillNumber: "WB-PO-1" });
    await deliverSalesOrderAndRecogniseRevenue({ orderId: order.id });
    await settleCourierRemittance({
      courierId: courier.id,
      paymentAccountId: bank.id,
      settlements: [{ salesOrderId: order.id, codAmount: 3100, courierFee: 100 }],
    });

    row = (await listRecentOrdersWithItems(300)).find((o) => o.id === order.id)!;
    expect(row.timeline.map((t) => t.status)).toEqual(["CONFIRMED", "SHIPPED", "DELIVERED", "SETTLED"]);
    expect(row.paymentStatus).toBe("PAID");
    expect((await getFinancialStatements()).trialBalance.isBalanced).toBe(true);
  });

  it("a pre-order that is cancelled before shipping needs no stock release and does not error", async () => {
    const { variantId } = await product();
    const { order } = await createSalesOrder({ ...cust, lines: [{ variantId, quantity: 1, unitPrice: 1500 }], allowBackorder: true });
    const res = await cancelSalesOrder({ orderId: order.id, reason: "Customer changed mind" });
    expect(res.releasedUnits).toBe(1);
    const row = (await listRecentOrdersWithItems(300)).find((o) => o.id === order.id)!;
    expect(row.status).toBe("CANCELLED");
  });

  it("variants flagged 'in stock without a count' are sellable without the pre-order flag and exposed to the picker", async () => {
    const { variantId } = await product();
    await db.update(productVariants).set({ inStockWithoutCount: true }).where(eq(productVariants.id, variantId));

    const listed = (await listSellableVariants()).find((v) => v.id === variantId)!;
    expect(listed.uncounted).toBe(true);
    expect(listed.available).toBe(0);

    const { order } = await createSalesOrder({ ...cust, lines: [{ variantId, quantity: 3, unitPrice: 1500 }] });
    expect(order.status).toBe("CONFIRMED");
  });

  it("portal low-stock alerts skip uncounted variants but still flag real out-of-stock ones", async () => {
    const uncounted = await product();
    await db.update(productVariants).set({ inStockWithoutCount: true }).where(eq(productVariants.id, uncounted.variantId));
    const counted = await product();

    const ids = (await buildLowStockAlerts(100_000)).map((a) => a.id);
    expect(ids).not.toContain(uncounted.variantId);
    expect(ids).toContain(counted.variantId); // zero stock, not flagged → real alert
  });
});
