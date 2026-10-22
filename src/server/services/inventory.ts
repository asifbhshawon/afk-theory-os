import { db } from "@/db";
import {
  products,
  productVariants,
  inventoryLots,
  stockMovements,
  locations,
  accounts,
  paymentAccounts,
  auditLogs,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { postJournalEntry } from "./finance";

// Create or find a product with variants
export async function createProductWithVariants(data: {
  name: string;
  styleCode: string;
  category: string;
  productType?: string;
  retailPrice: number;
  variants: {
    sku: string;
    size: string;
    color: string;
    costPrice: number;
    sellingPrice: number;
  }[];
}) {
  return await db.transaction(async (tx) => {
    let [product] = await tx
      .select()
      .from(products)
      .where(eq(products.styleCode, data.styleCode))
      .limit(1);

    if (!product) {
      [product] = await tx
        .insert(products)
        .values({
          name: data.name,
          styleCode: data.styleCode,
          category: data.category,
          productType: data.productType || "FINISHED_GARMENT",
          retailPrice: data.retailPrice.toFixed(2),
        })
        .returning();
    }

    const createdVariants = [];
    for (const v of data.variants) {
      let [variant] = await tx
        .select()
        .from(productVariants)
        .where(eq(productVariants.sku, v.sku))
        .limit(1);

      if (!variant) {
        [variant] = await tx
          .insert(productVariants)
          .values({
            productId: product.id,
            sku: v.sku,
            size: v.size,
            color: v.color,
            costPrice: v.costPrice.toFixed(2),
            sellingPrice: v.sellingPrice.toFixed(2),
          })
          .returning();
      }
      createdVariants.push(variant);
    }

    return { product, variants: createdVariants };
  });
}

// Purchase and receive an inventory lot with GL accounting entry
export async function receivePurchaseLot(data: {
  variantId: string;
  lotNumber: string;
  quantity: number;
  unitCost: number;
  paymentAccountId: string;
  locationId?: string;
  supplierId?: string;
  isRawMaterial?: boolean;
  userId?: string;
  reference?: string;
}) {
  const totalCost = Math.round(data.quantity * data.unitCost * 100) / 100;

  const [variant] = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.id, data.variantId))
    .limit(1);
  if (!variant) throw new Error("Product variant not found.");

  const [payAcc] = await db
    .select()
    .from(paymentAccounts)
    .where(eq(paymentAccounts.id, data.paymentAccountId))
    .limit(1);
  if (!payAcc) throw new Error("Payment account not found.");

  // Determine target inventory account (Materials Inventory 1210 vs Finished Goods 1230)
  const targetGlCode = data.isRawMaterial ? "1210" : "1230";
  const [invGlAcc] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.code, targetGlCode))
    .limit(1);
  if (!invGlAcc) throw new Error("Inventory GL account not found.");

  // Target warehouse location (default to MAIN_WH)
  let locId = data.locationId;
  if (!locId) {
    const [mainWh] = await db.select().from(locations).where(eq(locations.code, "MAIN_WH")).limit(1);
    locId = mainWh.id;
  }

  return await db.transaction(async (tx) => {
    // 1. Create Lot
    const [lot] = await tx
      .insert(inventoryLots)
      .values({
        lotNumber: data.lotNumber,
        variantId: data.variantId,
        supplierId: data.supplierId,
        initialQuantity: data.quantity,
        currentQuantity: data.quantity,
        reservedQuantity: 0,
        unitCost: data.unitCost.toFixed(2),
        totalCost: totalCost.toFixed(2),
        status: "ACTIVE",
      })
      .returning();

    // 2. Create Stock Movement
    await tx.insert(stockMovements).values({
      variantId: data.variantId,
      lotId: lot.id,
      toLocationId: locId,
      movementType: "PURCHASE_RECEIPT",
      quantity: data.quantity,
      unitCost: data.unitCost.toFixed(2),
      referenceType: "PURCHASE",
      referenceId: data.reference || data.lotNumber,
      performedByUserId: data.userId,
      notes: `Purchase received: ${data.quantity} units @ ৳${data.unitCost.toFixed(2)}`,
    });

    // 3. Post Balanced Double-Entry Journal:
    // Debit Inventory Asset (+), Credit Cash/Bank (-)
    await postJournalEntry({
      date: new Date(),
      entryType: "PURCHASE",
      description: `Purchase lot ${data.lotNumber}: ${variant.sku} (${data.quantity} units)`,
      reference: data.reference || data.lotNumber,
      sourceModule: "INVENTORY",
      sourceId: lot.id,
      userId: data.userId,
      lines: [
        {
          accountId: invGlAcc.id,
          debit: totalCost,
          credit: 0,
          memo: `Inventory asset received: ${variant.sku} (Lot ${data.lotNumber})`,
        },
        {
          accountId: payAcc.glAccountId,
          debit: 0,
          credit: totalCost,
          memo: `Payment from ${payAcc.name}`,
        },
      ],
    });

    return lot;
  });
}

// Issue raw materials/fabric to factory WIP
export async function issueFabricToFactory(data: {
  lotId: string;
  quantity: number;
  productionOrderId?: string;
  userId?: string;
  notes?: string;
}) {
  const [lot] = await db.select().from(inventoryLots).where(eq(inventoryLots.id, data.lotId)).limit(1);
  if (!lot) throw new Error("Inventory lot not found.");

  if (lot.currentQuantity < data.quantity) {
    throw new Error(
      `Insufficient lot quantity. Available: ${lot.currentQuantity}, Requested: ${data.quantity}`
    );
  }

  const [wipAcc] = await db.select().from(accounts).where(eq(accounts.code, "1220")).limit(1); // WIP
  const [matAcc] = await db.select().from(accounts).where(eq(accounts.code, "1210")).limit(1); // Materials Inventory
  const [factoryLoc] = await db.select().from(locations).where(eq(locations.code, "FACTORY_WIP")).limit(1);
  const [mainWh] = await db.select().from(locations).where(eq(locations.code, "MAIN_WH")).limit(1);

  const unitCost = Number(lot.unitCost);
  const issueCost = Math.round(data.quantity * unitCost * 100) / 100;

  return await db.transaction(async (tx) => {
    // 1. Decrement lot quantity
    const newQty = lot.currentQuantity - data.quantity;
    await tx
      .update(inventoryLots)
      .set({
        currentQuantity: newQty,
        status: newQty === 0 ? "DEPLETED" : "ACTIVE",
      })
      .where(eq(inventoryLots.id, lot.id));

    // 2. Record Stock Movement from Main WH to Factory WIP
    await tx.insert(stockMovements).values({
      variantId: lot.variantId,
      lotId: lot.id,
      fromLocationId: mainWh.id,
      toLocationId: factoryLoc.id,
      movementType: "PRODUCTION_ISSUE",
      quantity: data.quantity,
      unitCost: unitCost.toFixed(2),
      referenceType: "PRODUCTION",
      referenceId: data.productionOrderId || lot.lotNumber,
      performedByUserId: data.userId,
      notes: data.notes || `Issued ${data.quantity} units of fabric to factory WIP`,
    });

    // 3. Post Accounting Journal:
    // Debit Work In Progress (1220), Credit Materials Inventory (1210)
    await postJournalEntry({
      date: new Date(),
      entryType: "PRODUCTION",
      description: `Fabric issued to factory WIP: Lot ${lot.lotNumber} (${data.quantity} units)`,
      reference: data.productionOrderId,
      sourceModule: "MANUFACTURING",
      sourceId: data.productionOrderId,
      userId: data.userId,
      lines: [
        {
          accountId: wipAcc.id,
          debit: issueCost,
          credit: 0,
          memo: `Fabric in production custody at factory WIP`,
        },
        {
          accountId: matAcc.id,
          debit: 0,
          credit: issueCost,
          memo: `Fabric issued from materials inventory`,
        },
      ],
    });

    return { success: true, issuedQuantity: data.quantity, remainingInLot: newQty };
  });
}

// Concurrency-Safe Stock Reservation using Row-Level Locking
export async function reserveStock(variantId: string, quantity: number, orderId?: string) {
  return await db.transaction(async (tx) => {
    // Use SELECT ... FOR UPDATE to lock active lots for this variant
    const activeLots = await tx
      .select()
      .from(inventoryLots)
      .where(
        and(
          eq(inventoryLots.variantId, variantId),
          eq(inventoryLots.status, "ACTIVE")
        )
      )
      .for("update");

    let needed = quantity;
    const allocations: { lotId: string; quantity: number }[] = [];

    for (const lot of activeLots) {
      const availableInLot = lot.currentQuantity - lot.reservedQuantity;
      if (availableInLot <= 0) continue;

      const allocateFromThis = Math.min(needed, availableInLot);
      allocations.push({ lotId: lot.id, quantity: allocateFromThis });

      await tx
        .update(inventoryLots)
        .set({
          reservedQuantity: lot.reservedQuantity + allocateFromThis,
        })
        .where(eq(inventoryLots.id, lot.id));

      needed -= allocateFromThis;
      if (needed === 0) break;
    }

    if (needed > 0) {
      throw new Error(
        `Insufficient available stock for variant. Requested: ${quantity}, Shortfall: ${needed}`
      );
    }

    return allocations;
  });
}
