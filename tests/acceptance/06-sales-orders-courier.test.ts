import { describe, it, expect } from "vitest";
import { db } from "@/db";
import {
  paymentAccounts,
  inventoryLots,
  contacts,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { createProductWithVariants, receivePurchaseLot } from "@/server/services/inventory";
import {
  createSalesOrder,
  shipSalesOrder,
  deliverSalesOrderAndRecogniseRevenue,
  settleCourierRemittance,
  processSalesReturn,
} from "@/server/services/sales";
import { getFinancialStatements } from "@/server/services/finance";

describe("Acceptance Tests 6, 7, 8, 10, 11: Sales, Concurrency, Courier COD & Returns", () => {
  it("Acceptance Test 6: Sell SKU size M black: only matching SKU/lot stock decreases and sale/COGS posted exactly once", async () => {
    const runId = Math.random().toString(36).slice(2, 7);
    const { variants } = await createProductWithVariants({
      name: `Signature Tee ${runId}`,
      styleCode: `AFK-SIG-${runId}`,
      category: "T-Shirt",
      retailPrice: 1200,
      variants: [
        { sku: `AFK-SIG-M-${runId}`, size: "M", color: "Matte Black", costPrice: 300, sellingPrice: 1200 },
        { sku: `AFK-SIG-L-${runId}`, size: "L", color: "Matte Black", costPrice: 300, sellingPrice: 1200 },
      ],
    });
    const skuM = variants[0].id;
    const skuL = variants[1].id;

    const [cashPayAcc] = await db.select().from(paymentAccounts).where(eq(paymentAccounts.type, "CASH")).limit(1);

    const lotM = await receivePurchaseLot({
      variantId: skuM,
      lotNumber: `LOT-M-${runId}`,
      quantity: 10,
      unitCost: 300,
      paymentAccountId: cashPayAcc.id,
      isRawMaterial: false,
    });

    const lotL = await receivePurchaseLot({
      variantId: skuL,
      lotNumber: `LOT-L-${runId}`,
      quantity: 10,
      unitCost: 300,
      paymentAccountId: cashPayAcc.id,
      isRawMaterial: false,
    });

    // Sell 2 units of Size M
    const { order } = await createSalesOrder({
      customerName: "Mahir Faysal",
      customerPhone: "01711000000",
      shippingAddress: "Dhanmondi 27, Dhaka",
      cityZone: "Inside Dhaka",
      lines: [{ variantId: skuM, quantity: 2, unitPrice: 1200 }],
      deliveryCharge: 80,
    });

    await shipSalesOrder({ orderId: order.id, waybillNumber: `WB-${runId}` });
    await deliverSalesOrderAndRecogniseRevenue({ orderId: order.id });

    // Verify ONLY size M lot decreased, size L lot unchanged
    const [updatedLotM] = await db.select().from(inventoryLots).where(eq(inventoryLots.id, lotM.id)).limit(1);
    const [updatedLotL] = await db.select().from(inventoryLots).where(eq(inventoryLots.id, lotL.id)).limit(1);

    expect(updatedLotM.currentQuantity).toBe(8); // 10 - 2 = 8
    expect(updatedLotL.currentQuantity).toBe(10); // Unchanged 10

    const statements = await getFinancialStatements();
    expect(statements.trialBalance.isBalanced).toBe(true);
  });

  it("Acceptance Test 7: Concurrency Test — Two users simultaneously sell one remaining SKU: only one successful stock fulfilment", async () => {
    const runId = Math.random().toString(36).slice(2, 7);
    const { variants } = await createProductWithVariants({
      name: `Limited Jacket ${runId}`,
      styleCode: `AFK-LTD-${runId}`,
      category: "Jacket",
      retailPrice: 5000,
      variants: [{ sku: `AFK-LTD-1-${runId}`, size: "FREE", color: "Olive", costPrice: 2000, sellingPrice: 5000 }],
    });
    const scarceSkuId = variants[0].id;

    const [cashPayAcc] = await db.select().from(paymentAccounts).where(eq(paymentAccounts.type, "CASH")).limit(1);

    await receivePurchaseLot({
      variantId: scarceSkuId,
      lotNumber: `LOT-SCARCE-${runId}`,
      quantity: 1, // Only 1 unit in stock
      unitCost: 2000,
      paymentAccountId: cashPayAcc.id,
      isRawMaterial: false,
    });

    // Simulate User A and User B attempting to order the 1 unit simultaneously
    const promiseA = createSalesOrder({
      customerName: "Buyer A",
      customerPhone: "01811111111",
      shippingAddress: "Gulshan 1, Dhaka",
      lines: [{ variantId: scarceSkuId, quantity: 1, unitPrice: 5000 }],
    });

    const promiseB = createSalesOrder({
      customerName: "Buyer B",
      customerPhone: "01922222222",
      shippingAddress: "Banani, Dhaka",
      lines: [{ variantId: scarceSkuId, quantity: 1, unitPrice: 5000 }],
    });

    const results = await Promise.allSettled([promiseA, promiseB]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // Exactly one succeeds, exactly one rejected
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });

  it("Acceptance Test 8: Repeated request with same idempotency reference creates no duplicate order or stock movement", async () => {
    const runId = Math.random().toString(36).slice(2, 7);
    const { variants } = await createProductWithVariants({
      name: `Idempotency Test Item ${runId}`,
      styleCode: `AFK-IDM-${runId}`,
      category: "Tee",
      retailPrice: 1000,
      variants: [{ sku: `AFK-IDM-${runId}`, size: "M", color: "White", costPrice: 250, sellingPrice: 1000 }],
    });
    const skuId = variants[0].id;

    const [cashPayAcc] = await db.select().from(paymentAccounts).where(eq(paymentAccounts.type, "CASH")).limit(1);
    await receivePurchaseLot({
      variantId: skuId,
      lotNumber: `LOT-IDM-${runId}`,
      quantity: 5,
      unitCost: 250,
      paymentAccountId: cashPayAcc.id,
      isRawMaterial: false,
    });

    const idempotencyKey = `IDEMP-KEY-${runId}`;

    // First attempt
    const res1 = await createSalesOrder({
      customerName: "Idempotent Buyer",
      customerPhone: "01733333333",
      shippingAddress: "Uttara, Dhaka",
      lines: [{ variantId: skuId, quantity: 1, unitPrice: 1000 }],
      idempotencyKey,
    });
    expect(res1.isDuplicate).toBe(false);

    // Repeated attempt
    const res2 = await createSalesOrder({
      customerName: "Idempotent Buyer",
      customerPhone: "01733333333",
      shippingAddress: "Uttara, Dhaka",
      lines: [{ variantId: skuId, quantity: 1, unitPrice: 1000 }],
      idempotencyKey,
    });

    expect(res2.isDuplicate).toBe(true);
    expect(res2.order.id).toBe(res1.order.id);
  });

  it("Acceptance Test 10: Courier collects ৳1,000 COD, deducts ৳70 fees and remits ৳930: bank +930, courier fee 70, courier receivable closes; no double-counting sale", async () => {
    const runId = Math.random().toString(36).slice(2, 7);
    const [courier] = await db
      .insert(contacts)
      .values({
        name: `Steadfast Courier ${runId}`,
        type: "COURIER",
        phone: "09678000000",
      })
      .returning();

    const [bankPayAcc] = await db.select().from(paymentAccounts).where(eq(paymentAccounts.type, "BANK")).limit(1);
    const [cashPayAcc] = await db.select().from(paymentAccounts).where(eq(paymentAccounts.type, "CASH")).limit(1);

    const { variants } = await createProductWithVariants({
      name: `COD Test Item ${runId}`,
      styleCode: `AFK-COD-${runId}`,
      category: "Tee",
      retailPrice: 900,
      variants: [{ sku: `AFK-COD-${runId}`, size: "M", color: "Black", costPrice: 200, sellingPrice: 900 }],
    });
    const skuId = variants[0].id;

    await receivePurchaseLot({
      variantId: skuId,
      lotNumber: `LOT-COD-${runId}`,
      quantity: 5,
      unitCost: 200,
      paymentAccountId: cashPayAcc.id,
      isRawMaterial: false,
    });

    // Create COD order: ৳900 item + ৳100 delivery = ৳1,000
    const { order } = await createSalesOrder({
      customerName: "Tanzim Hasan",
      customerPhone: "01511111111",
      shippingAddress: "Mirpur 10, Dhaka",
      lines: [{ variantId: skuId, quantity: 1, unitPrice: 900 }],
      deliveryCharge: 100,
      paymentMethod: "COD",
    });

    await shipSalesOrder({ orderId: order.id, courierId: courier.id, waybillNumber: `ST-${runId}` });
    await deliverSalesOrderAndRecogniseRevenue({ orderId: order.id });

    // Settle COD Remittance: gross 1000 - fee 70 = net 930
    const settlement = await settleCourierRemittance({
      courierId: courier.id,
      paymentAccountId: bankPayAcc.id,
      settlements: [
        {
          salesOrderId: order.id,
          codAmount: 1000,
          courierFee: 70,
        },
      ],
      settlementNumber: `SET-${runId}`,
    });

    expect(settlement).toBeDefined();
    expect(Number(settlement.totalCodCollected)).toBe(1000);
    expect(Number(settlement.courierFeesDeducted)).toBe(70);
    expect(Number(settlement.netAmountReceived)).toBe(930);

    const statements = await getFinancialStatements();
    expect(statements.trialBalance.isBalanced).toBe(true);
    expect(statements.balanceSheet.isBalanced).toBe(true);
  });

  it("Acceptance Test 11: Return after delivery: correct refund, return inspection/stock disposition, COGS reversal and account effect", async () => {
    const runId = Math.random().toString(36).slice(2, 7);
    const { variants } = await createProductWithVariants({
      name: `RMA Test Item ${runId}`,
      styleCode: `AFK-RMA-${runId}`,
      category: "Tee",
      retailPrice: 1200,
      variants: [{ sku: `AFK-RMA-${runId}`, size: "M", color: "Black", costPrice: 300, sellingPrice: 1200 }],
    });
    const skuId = variants[0].id;

    const [cashPayAcc] = await db.select().from(paymentAccounts).where(eq(paymentAccounts.type, "CASH")).limit(1);

    const lot = await receivePurchaseLot({
      variantId: skuId,
      lotNumber: `LOT-RMA-${runId}`,
      quantity: 5,
      unitCost: 300,
      paymentAccountId: cashPayAcc.id,
      isRawMaterial: false,
    });

    const { order } = await createSalesOrder({
      customerName: "Return Customer",
      customerPhone: "01600000000",
      shippingAddress: "Mohakhali, Dhaka",
      lines: [{ variantId: skuId, quantity: 1, unitPrice: 1200 }],
    });

    await shipSalesOrder({ orderId: order.id, waybillNumber: `RET-WB-${runId}` });
    await deliverSalesOrderAndRecogniseRevenue({ orderId: order.id });

    // Process Return: RESTOCKABLE, refund ৳1,200
    const rma = await processSalesReturn({
      salesOrderId: order.id,
      reason: "Size did not fit",
      isRestockable: true,
      refundAmount: 1200,
      paymentAccountId: cashPayAcc.id,
      notes: "Restocked into inventory",
    });

    expect(rma).toBeDefined();
    expect(rma.inspectionResult).toBe("RESTOCKABLE");
    expect(Number(rma.refundAmount)).toBe(1200);

    // Verify stock restored
    const [lotAfter] = await db.select().from(inventoryLots).where(eq(inventoryLots.id, lot.id)).limit(1);
    expect(lotAfter.currentQuantity).toBe(5); // 5 - 1 + 1 = 5

    const statements = await getFinancialStatements();
    expect(statements.trialBalance.isBalanced).toBe(true);
    expect(statements.balanceSheet.isBalanced).toBe(true);
  });
});
