import { db } from "@/db";
import {
  productionOrders,
  productionCosts,
  qcInspections,
  inventoryLots,
  stockMovements,
  locations,
  accounts,
  paymentAccounts,
  productVariants,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { postJournalEntry } from "./finance";
import { issueFabricToFactory } from "./inventory";

// Create production order
export async function createProductionOrder(data: {
  orderNumber: string;
  routeType: "FINISHED_PURCHASE" | "BLANK_CUSTOMIZATION" | "FABRIC_OUTSOURCED";
  targetProductId: string;
  targetVariantId: string;
  factoryContactId?: string;
  plannedQuantity: number;
  userId?: string;
  notes?: string;
}) {
  const [order] = await db
    .insert(productionOrders)
    .values({
      orderNumber: data.orderNumber,
      routeType: data.routeType,
      targetProductId: data.targetProductId,
      targetVariantId: data.targetVariantId,
      factoryContactId: data.factoryContactId,
      plannedQuantity: data.plannedQuantity,
      status: "PLANNED",
      notes: data.notes,
      createdByUserId: data.userId,
    })
    .returning();

  return order;
}

// Add direct production cost (CMT labor, printing, embroidery, washing, transport)
export async function addProductionCost(data: {
  productionOrderId: string;
  costType: string;
  amount: number;
  paymentAccountId?: string;
  partnerId?: string;
  notes?: string;
  userId?: string;
}) {
  const [order] = await db
    .select()
    .from(productionOrders)
    .where(eq(productionOrders.id, data.productionOrderId))
    .limit(1);
  if (!order) throw new Error("Production order not found.");

  const [wipAcc] = await db.select().from(accounts).where(eq(accounts.code, "1220")).limit(1);
  if (!wipAcc) throw new Error("WIP account not found.");

  let creditAccountId: string;
  let memo: string;

  if (data.paymentAccountId) {
    const [payAcc] = await db
      .select()
      .from(paymentAccounts)
      .where(eq(paymentAccounts.id, data.paymentAccountId))
      .limit(1);
    if (!payAcc) throw new Error("Payment account not found.");
    creditAccountId = payAcc.glAccountId;
    memo = `Production charge paid via ${payAcc.name}`;
  } else {
    // If not immediately paid, goes to Trade Payables
    const [tpAcc] = await db.select().from(accounts).where(eq(accounts.code, "2010")).limit(1);
    creditAccountId = tpAcc.id;
    memo = `Production charge credited to Trade Payables`;
  }

  return await db.transaction(async (tx) => {
    // 1. Record cost line
    const [cost] = await tx
      .insert(productionCosts)
      .values({
        productionOrderId: data.productionOrderId,
        costType: data.costType,
        amount: data.amount.toFixed(2),
        paymentAccountId: data.paymentAccountId,
        notes: data.notes,
      })
      .returning();

    // 2. Update order direct cost
    const newDirectCost = Number(order.totalDirectCost) + data.amount;
    await tx
      .update(productionOrders)
      .set({ totalDirectCost: newDirectCost.toFixed(2) })
      .where(eq(productionOrders.id, order.id));

    // 3. Post to GL: Debit WIP (1220), Credit Bank/Payables
    await postJournalEntry({
      date: new Date(),
      entryType: "PRODUCTION",
      description: `Production cost (${data.costType}) for order ${order.orderNumber}: ৳${data.amount.toFixed(2)}`,
      reference: `${order.orderNumber}-${data.costType}`,
      sourceModule: "MANUFACTURING",
      sourceId: order.id,
      userId: data.userId,
      lines: [
        {
          accountId: wipAcc.id,
          debit: data.amount,
          credit: 0,
          memo: `Direct production cost (${data.costType})`,
        },
        {
          accountId: creditAccountId,
          debit: 0,
          credit: data.amount,
          memo,
        },
      ],
    });

    return cost;
  });
}

// Complete production batch: QC inspection, lot valuation, and inventory transfer
export async function completeProductionOrder(data: {
  productionOrderId: string;
  finishedLotNumber: string;
  goodUnits: number;
  defectUnits?: number;
  returnedMaterialUnits?: number;
  materialLotId?: string; // If returning unused raw materials
  userId?: string;
  notes?: string;
}) {
  const [order] = await db
    .select()
    .from(productionOrders)
    .where(eq(productionOrders.id, data.productionOrderId))
    .limit(1);
  if (!order) throw new Error("Production order not found.");

  const targetVariantId = order.targetVariantId;
  if (!targetVariantId) throw new Error("Order has no target variant.");

  const [wipAcc] = await db.select().from(accounts).where(eq(accounts.code, "1220")).limit(1); // WIP
  const [finAcc] = await db.select().from(accounts).where(eq(accounts.code, "1230")).limit(1); // Finished Goods
  const [matAcc] = await db.select().from(accounts).where(eq(accounts.code, "1210")).limit(1); // Raw Materials
  const [wastageAcc] = await db.select().from(accounts).where(eq(accounts.code, "5020")).limit(1); // Wastage & Rejects

  const [mainWh] = await db.select().from(locations).where(eq(locations.code, "MAIN_WH")).limit(1);
  const [factoryLoc] = await db.select().from(locations).where(eq(locations.code, "FACTORY_WIP")).limit(1);
  const [damagedLoc] = await db.select().from(locations).where(eq(locations.code, "DAMAGED")).limit(1);

  return await db.transaction(async (tx) => {
    // 1. Record QC Inspection
    const totalInspected = data.goodUnits + (data.defectUnits || 0);
    await tx.insert(qcInspections).values({
      productionOrderId: order.id,
      inspectedByUserId: data.userId,
      totalInspected,
      goodUnits: data.goodUnits,
      rejectedUnits: data.defectUnits || 0,
      passStatus: (data.defectUnits || 0) > 0 ? "PASSED_WITH_DEFECTS" : "PASSED",
      notes: data.notes || "Final production batch QC inspection",
    });

    // 2. Calculate Costs
    const totalDirect = Number(order.totalDirectCost);
    const totalMaterial = Number(order.totalMaterialCost);
    const totalBatchCost = totalDirect + totalMaterial;

    if (data.goodUnits <= 0) {
      throw new Error("Must have at least one good finished unit to complete production.");
    }

    // Absorption costing: unit cost of good finished garments
    const perUnitCost = Math.round((totalBatchCost / data.goodUnits) * 100) / 100;
    const finishedStockValue = Math.round(data.goodUnits * perUnitCost * 100) / 100;

    // 3. Create Finished Goods Inventory Lot
    const [finishedLot] = await tx
      .insert(inventoryLots)
      .values({
        lotNumber: data.finishedLotNumber,
        variantId: targetVariantId,
        productionOrderId: order.id,
        initialQuantity: data.goodUnits,
        currentQuantity: data.goodUnits,
        reservedQuantity: 0,
        unitCost: perUnitCost.toFixed(2),
        totalCost: finishedStockValue.toFixed(2),
        status: "ACTIVE",
      })
      .returning();

    // 4. Record Stock Movement for Good Finished Garments (Factory WIP -> Main WH)
    await tx.insert(stockMovements).values({
      variantId: targetVariantId,
      lotId: finishedLot.id,
      fromLocationId: factoryLoc.id,
      toLocationId: mainWh.id,
      movementType: "PRODUCTION_RECEIPT",
      quantity: data.goodUnits,
      unitCost: perUnitCost.toFixed(2),
      referenceType: "PRODUCTION",
      referenceId: order.orderNumber,
      performedByUserId: data.userId,
      notes: `Finished garments received: ${data.goodUnits} pcs @ ৳${perUnitCost.toFixed(2)}`,
    });

    // 5. If defect units exist, record movement to Damaged Bin
    if (data.defectUnits && data.defectUnits > 0) {
      await tx.insert(stockMovements).values({
        variantId: targetVariantId,
        fromLocationId: factoryLoc.id,
        toLocationId: damagedLoc.id,
        movementType: "RETURN_DEFECT",
        quantity: data.defectUnits,
        unitCost: perUnitCost.toFixed(2),
        referenceType: "PRODUCTION",
        referenceId: order.orderNumber,
        performedByUserId: data.userId,
        notes: `Production defect scrap: ${data.defectUnits} pcs`,
      });
    }

    // 6. Handle return of unused raw materials if any
    let returnedMaterialCost = 0;
    if (data.returnedMaterialUnits && data.returnedMaterialUnits > 0 && data.materialLotId) {
      const [matLot] = await tx
        .select()
        .from(inventoryLots)
        .where(eq(inventoryLots.id, data.materialLotId))
        .limit(1);

      if (matLot) {
        const matUnitCost = Number(matLot.unitCost);
        returnedMaterialCost = Math.round(data.returnedMaterialUnits * matUnitCost * 100) / 100;

        // Restore material lot quantity
        await tx
          .update(inventoryLots)
          .set({
            currentQuantity: matLot.currentQuantity + data.returnedMaterialUnits,
            status: "ACTIVE",
          })
          .where(eq(inventoryLots.id, matLot.id));

        // Record stock movement (Factory WIP -> Main WH)
        await tx.insert(stockMovements).values({
          variantId: matLot.variantId,
          lotId: matLot.id,
          fromLocationId: factoryLoc.id,
          toLocationId: mainWh.id,
          movementType: "RETURN_RESTOCK",
          quantity: data.returnedMaterialUnits,
          unitCost: matUnitCost.toFixed(2),
          referenceType: "PRODUCTION",
          referenceId: order.orderNumber,
          performedByUserId: data.userId,
          notes: `Unused raw fabric returned from factory: ${data.returnedMaterialUnits} units`,
        });

        // Journal: Debit Raw Materials (1210), Credit WIP (1220)
        await postJournalEntry({
          date: new Date(),
          entryType: "PRODUCTION",
          description: `Unused fabric returned from factory for ${order.orderNumber}`,
          reference: order.orderNumber,
          sourceModule: "MANUFACTURING",
          sourceId: order.id,
          userId: data.userId,
          lines: [
            {
              accountId: matAcc.id,
              debit: returnedMaterialCost,
              credit: 0,
              memo: `Raw material returned to stock`,
            },
            {
              accountId: wipAcc.id,
              debit: 0,
              credit: returnedMaterialCost,
              memo: `WIP reduction for returned raw material`,
            },
          ],
        });
      }
    }

    // 7. Post GL Journal: Reconcile WIP to Finished Goods
    // Debit Finished Goods Inventory (1230), Credit WIP (1220)
    await postJournalEntry({
      date: new Date(),
      entryType: "PRODUCTION",
      description: `Production completed for ${order.orderNumber}: Lot ${finishedLot.lotNumber} (${data.goodUnits} pcs @ ৳${perUnitCost.toFixed(2)})`,
      reference: `${order.orderNumber}-COMPLETION`,
      sourceModule: "MANUFACTURING",
      sourceId: order.id,
      userId: data.userId,
      lines: [
        {
          accountId: finAcc.id,
          debit: finishedStockValue,
          credit: 0,
          memo: `Finished garments received into stock`,
        },
        {
          accountId: wipAcc.id,
          debit: 0,
          credit: finishedStockValue,
          memo: `WIP absorbed into finished goods inventory`,
        },
      ],
    });

    // 8. Update production order status to COMPLETED
    await tx
      .update(productionOrders)
      .set({
        completedGoodQuantity: data.goodUnits,
        completedDefectQuantity: data.defectUnits || 0,
        unitCostCalculated: perUnitCost.toFixed(2),
        status: "COMPLETED",
      })
      .where(eq(productionOrders.id, order.id));

    return {
      productionOrder: order,
      finishedLot,
      perUnitCost,
      finishedStockValue,
    };
  });
}
