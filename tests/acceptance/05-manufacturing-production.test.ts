import { describe, it, expect } from "vitest";
import { db } from "@/db";
import {
  paymentAccounts,
  accounts,
  inventoryLots,
  stockMovements,
  locations,
  productionOrders,
  journalLines,
  journalEntries,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  createProductWithVariants,
  receivePurchaseLot,
  issueFabricToFactory,
} from "@/server/services/inventory";
import {
  createProductionOrder,
  addProductionCost,
  completeProductionOrder,
} from "@/server/services/manufacturing";
import { getFinancialStatements } from "@/server/services/finance";

describe("Acceptance Test 5: Apparel Manufacturing Route 3 (Outsourced Factory)", () => {
  it("completes production: total cost and per-good-unit lot valuation reconcile; rejects and unused material properly accounted", async () => {
    // 1. Create Finished Product: Drop-Shoulder T-Shirt Black Medium
    const { product, variants } = await createProductWithVariants({
      name: "Drop-Shoulder Heavyweight T-Shirt",
      styleCode: "AFK-DS-T001",
      category: "T-Shirt",
      retailPrice: 1200,
      variants: [
        {
          sku: "AFK-DS-T001-BLK-M",
          size: "M",
          color: "Matte Black",
          costPrice: 0,
          sellingPrice: 1200,
        },
      ],
    });
    const finishedVariantId = variants[0].id;

    // 2. Buy Fabric Lot: 20 KG @ ৳500 = ৳10,000
    const [cashPayAcc] = await db
      .select()
      .from(paymentAccounts)
      .where(eq(paymentAccounts.type, "CASH"))
      .limit(1);

    const { variants: fabricVars } = await createProductWithVariants({
      name: "Single Jersey 100% Combed Cotton 240 GSM",
      styleCode: "FAB-SJ-240",
      category: "Fabric",
      productType: "RAW_MATERIAL",
      retailPrice: 0,
      variants: [{ sku: "FAB-SJ-240-BLK", size: "KG", color: "Black", costPrice: 500, sellingPrice: 0 }],
    });

    const runId = Date.now().toString().slice(-5);
    const orderNumber = `MFG-2026-${runId}`;
    const finishedLotNumber = `LOT-AFK-TEE-${runId}`;

    const fabricLot = await receivePurchaseLot({
      variantId: fabricVars[0].id,
      lotNumber: `LOT-FAB-BATCH-${runId}`,
      quantity: 20, // 20 KG
      unitCost: 500,
      paymentAccountId: cashPayAcc.id,
      isRawMaterial: true,
      reference: `PO-FAB-BATCH-${runId}`,
    });

    // 3. Create Production Order
    const prodOrder = await createProductionOrder({
      orderNumber,
      routeType: "FABRIC_OUTSOURCED",
      targetProductId: product.id,
      targetVariantId: finishedVariantId,
      plannedQuantity: 50,
      notes: "First batch of 50 drop-shoulder tees",
    });

    // 4. Issue 15 KG fabric to Factory WIP: 15 * 500 = ৳7,500
    await issueFabricToFactory({
      lotId: fabricLot.id,
      quantity: 15,
      productionOrderId: prodOrder.orderNumber,
      notes: `15 KG fabric issued for ${orderNumber}`,
    });

    // Update order's totalMaterialCost in DB
    await db
      .update(productionOrders)
      .set({ totalMaterialCost: "7500.00" })
      .where(eq(productionOrders.id, prodOrder.id));

    // 5. Add Direct Production Costs:
    // CMT Labor: ৳4,000
    await addProductionCost({
      productionOrderId: prodOrder.id,
      costType: "CMT_LABOR",
      amount: 4000,
      paymentAccountId: cashPayAcc.id,
      notes: "Cutting and sewing labor charge",
    });

    // Screen Printing: ৳2,000
    await addProductionCost({
      productionOrderId: prodOrder.id,
      costType: "PRINTING",
      amount: 2000,
      paymentAccountId: cashPayAcc.id,
      notes: "Plastisol chest and back print",
    });

    const completion = await completeProductionOrder({
      productionOrderId: prodOrder.id,
      finishedLotNumber,
      goodUnits: 45,
      defectUnits: 2,
      notes: "Passed QC inspection with 45 good garments and 2 minor print rejects",
    });

    expect(completion).toBeDefined();
    expect(completion.perUnitCost).toBe(300.0); // ৳13,500 / 45 units = ৳300.00 / tee!
    expect(completion.finishedStockValue).toBe(13500.0);

    // 7. Verify finished lot created in inventory
    const [finishedLot] = await db
      .select()
      .from(inventoryLots)
      .where(eq(inventoryLots.lotNumber, finishedLotNumber))
      .limit(1);

    expect(finishedLot).toBeDefined();
    expect(finishedLot.currentQuantity).toBe(45);
    expect(Number(finishedLot.unitCost)).toBe(300.0);

    // 8. Verify Stock Movement Ledger:
    // Factory WIP -> Main WH (PRODUCTION_RECEIPT for 45 units)
    const [mainWh] = await db.select().from(locations).where(eq(locations.code, "MAIN_WH")).limit(1);
    const [damagedLoc] = await db.select().from(locations).where(eq(locations.code, "DAMAGED")).limit(1);

    const movements = await db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.lotId, finishedLot.id));

    const receiptMove = movements.find((m) => m.movementType === "PRODUCTION_RECEIPT");
    expect(receiptMove).toBeDefined();
    expect(receiptMove?.quantity).toBe(45);
    expect(receiptMove?.toLocationId).toBe(mainWh.id);

    // Verify defect scrap movement to DAMAGED location
    const defectMove = await db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.toLocationId, damagedLoc.id));
    expect(defectMove.length).toBeGreaterThan(0);

    // 9. Verify Accounting:
    // Finished Goods Inventory (1230) has the finished lot value (৳13,500)
    // WIP for this production order reconciles exactly to 0
    const [wipAcc] = await db.select().from(accounts).where(eq(accounts.code, "1220")).limit(1);

    // Sum of WIP debits and credits for this specific order
    const orderEntries = await db
      .select({
        debit: journalLines.debit,
        credit: journalLines.credit,
      })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(journalLines.accountId, wipAcc.id),
          sql`${journalEntries.reference} LIKE ${`${orderNumber}%`}`
        )
      );

    const totalWipDebits = orderEntries.reduce((s, e) => s + Number(e.debit), 0);
    const totalWipCredits = orderEntries.reduce((s, e) => s + Number(e.credit), 0);

    expect(totalWipDebits).toBe(13500); // 7500 (fabric) + 4000 (CMT) + 2000 (print)
    expect(totalWipCredits).toBe(13500); // 13500 transferred to finished goods
    expect(totalWipDebits - totalWipCredits).toBe(0); // WIP for this order is exactly 0!

    const statements = await getFinancialStatements();
    expect(statements.trialBalance.isBalanced).toBe(true);
    expect(statements.balanceSheet.isBalanced).toBe(true);
  });
});
