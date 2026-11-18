import { db } from "@/db";
import {
  products,
  productVariants,
  inventoryLots,
  stockMovements,
  locations,
  accounts,
  paymentAccounts,
  productionOrders,
  auditLogs,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { postJournalEntry } from "./finance";

// Re-export pure catalog and SKU utilities
export { generateColorCode, generateVariantSku } from "@/lib/catalog";

// Get aggregate available stock mapped by variant ID
export async function getInventoryStockMap(): Promise<
  Record<string, { currentQty: number; reservedQty: number; availableQty: number }>
> {
  const lots = await db
    .select({
      variantId: inventoryLots.variantId,
      currentQuantity: inventoryLots.currentQuantity,
      reservedQuantity: inventoryLots.reservedQuantity,
      status: inventoryLots.status,
    })
    .from(inventoryLots)
    .where(eq(inventoryLots.status, "ACTIVE"));

  const stockMap: Record<string, { currentQty: number; reservedQty: number; availableQty: number }> = {};

  for (const lot of lots) {
    if (!stockMap[lot.variantId]) {
      stockMap[lot.variantId] = { currentQty: 0, reservedQty: 0, availableQty: 0 };
    }
    stockMap[lot.variantId].currentQty += lot.currentQuantity;
    stockMap[lot.variantId].reservedQty += lot.reservedQuantity;
    stockMap[lot.variantId].availableQty += Math.max(0, lot.currentQuantity - lot.reservedQuantity);
  }

  return stockMap;
}

// Create or find a product with variants (supports multi-color, multi-size matrix)
export async function createProductWithVariants(data: {
  productId?: string;
  name: string;
  styleCode: string;
  category: string;
  productType?: string;
  retailPrice: number;
  costPrice?: number;
  variants: {
    sku: string;
    size: string;
    color: string;
    costPrice: number;
    sellingPrice: number;
  }[];
}) {
  return await db.transaction(async (tx) => {
    let product: any = null;

    if (data.productId) {
      [product] = await tx
        .select()
        .from(products)
        .where(eq(products.id, data.productId))
        .limit(1);
    }

    if (!product) {
      [product] = await tx
        .select()
        .from(products)
        .where(eq(products.styleCode, data.styleCode.trim().toUpperCase()))
        .limit(1);
    }

    if (!product) {
      [product] = await tx
        .insert(products)
        .values({
          name: data.name.trim(),
          styleCode: data.styleCode.trim().toUpperCase(),
          category: data.category.trim(),
          productType: data.productType || "FINISHED_GARMENT",
          retailPrice: data.retailPrice.toFixed(2),
          targetCogs: (data.costPrice || 0).toFixed(2),
        })
        .returning();
    } else {
      if (data.retailPrice > 0) {
        await tx
          .update(products)
          .set({
            retailPrice: data.retailPrice.toFixed(2),
            targetCogs: data.costPrice !== undefined ? data.costPrice.toFixed(2) : product.targetCogs,
            name: data.name ? data.name.trim() : product.name,
            category: data.category ? data.category.trim() : product.category,
          })
          .where(eq(products.id, product.id));
      }
    }

    const createdVariants = [];
    for (const v of data.variants) {
      const cleanSku = v.sku.trim().toUpperCase();
      let [variant] = await tx
        .select()
        .from(productVariants)
        .where(eq(productVariants.sku, cleanSku))
        .limit(1);

      if (!variant) {
        [variant] = await tx
          .insert(productVariants)
          .values({
            productId: product.id,
            sku: cleanSku,
            size: v.size.trim(),
            color: v.color.trim(),
            costPrice: Number(v.costPrice || 0).toFixed(2),
            sellingPrice: Number(v.sellingPrice || data.retailPrice || 0).toFixed(2),
          })
          .returning();
      } else {
        if (v.sellingPrice > 0 || v.costPrice > 0) {
          [variant] = await tx
            .update(productVariants)
            .set({
              sellingPrice: Number(v.sellingPrice || product.retailPrice).toFixed(2),
              costPrice: Number(v.costPrice || 0).toFixed(2),
            })
            .where(eq(productVariants.id, variant.id))
            .returning();
        }
      }
      createdVariants.push(variant);
    }

    return { product, variants: createdVariants };
  });
}

// Safely delete a product variant if it has no transactional history
export async function deleteProductVariant(variantId: string) {
  const [lotCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(inventoryLots)
    .where(eq(inventoryLots.variantId, variantId));

  if (lotCount && lotCount.count > 0) {
    throw new Error("Cannot delete variant: it has associated inventory lots. Deactivate or deplete lots first.");
  }

  const [movementCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(stockMovements)
    .where(eq(stockMovements.variantId, variantId));

  if (movementCount && movementCount.count > 0) {
    throw new Error("Cannot delete variant: it has recorded stock movement transactions in the ledger.");
  }

  await db.delete(productVariants).where(eq(productVariants.id, variantId));
  return { success: true };
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

    // 3. Post Balanced Double-Entry Journal inside the same atomic transaction:
    // Debit Inventory Asset (+), Credit Cash/Bank (-)
    await postJournalEntry(
      {
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
      },
      tx
    );

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

    // 2. Automatically update production order WIP material cost if linked to an order
    if (data.productionOrderId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.productionOrderId);
      const [pOrder] = await tx
        .select()
        .from(productionOrders)
        .where(
          isUuid
            ? eq(productionOrders.id, data.productionOrderId)
            : eq(productionOrders.orderNumber, data.productionOrderId)
        )
        .for("update")
        .limit(1);

      if (pOrder) {
        const currentMaterialCost = Number(pOrder.totalMaterialCost || 0);
        const newMaterialCost = Math.round((currentMaterialCost + issueCost) * 100) / 100;
        await tx
          .update(productionOrders)
          .set({
            totalMaterialCost: newMaterialCost.toFixed(2),
            status: pOrder.status === "PLANNED" ? "FABRIC_ISSUED" : pOrder.status,
          })
          .where(eq(productionOrders.id, pOrder.id));
      }
    }

    // 3. Record Stock Movement from Main WH to Factory WIP
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

    // 4. Post Accounting Journal atomically inside the same transaction:
    // Debit Work In Progress (1220), Credit Materials Inventory (1210)
    await postJournalEntry(
      {
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
      },
      tx
    );

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

export interface UpdateVariantStockInput {
  variantId: string;
  targetStock?: number;
  inStockWithoutCount?: boolean;
  sellingPrice?: number;
  costPrice?: number;
  userId?: string;
  notes?: string;
}

// Update variant stock quantity and "In Stock without exact count" availability mode
export async function updateVariantStock(data: UpdateVariantStockInput) {
  return await db.transaction(async (tx) => {
    // 1. Fetch variant
    const [variant] = await tx
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, data.variantId))
      .limit(1);

    if (!variant) throw new Error("Product variant not found.");

    // 2. Update variant fields if provided
    const variantUpdate: {
      inStockWithoutCount?: boolean;
      sellingPrice?: string;
      costPrice?: string;
    } = {};

    if (data.inStockWithoutCount !== undefined) {
      variantUpdate.inStockWithoutCount = data.inStockWithoutCount;
    }
    if (data.sellingPrice !== undefined && data.sellingPrice >= 0) {
      variantUpdate.sellingPrice = data.sellingPrice.toFixed(2);
    }
    if (data.costPrice !== undefined && data.costPrice >= 0) {
      variantUpdate.costPrice = data.costPrice.toFixed(2);
    }

    if (Object.keys(variantUpdate).length > 0) {
      await tx
        .update(productVariants)
        .set(variantUpdate)
        .where(eq(productVariants.id, variant.id));
    }

    // 3. Handle stock count adjustment if targetStock is specified
    let finalAvailable = 0;
    if (data.targetStock !== undefined) {
      const target = Math.max(0, Math.floor(data.targetStock));

      // Lock all active lots for this variant
      const activeLots = await tx
        .select()
        .from(inventoryLots)
        .where(
          and(
            eq(inventoryLots.variantId, variant.id),
            eq(inventoryLots.status, "ACTIVE")
          )
        )
        .for("update");

      const currentAvailable = activeLots.reduce(
        (sum, lot) => sum + Math.max(0, lot.currentQuantity - lot.reservedQuantity),
        0
      );

      // Default warehouse location (MAIN_WH)
      const [mainWh] = await tx.select().from(locations).where(eq(locations.code, "MAIN_WH")).limit(1);
      const locId = mainWh?.id;
      const unitCost = Number(data.costPrice ?? variant.costPrice ?? 0);

      if (target === 0) {
        // Set all active lots to 0 quantity and mark DEPLETED
        for (const lot of activeLots) {
          await tx
            .update(inventoryLots)
            .set({
              currentQuantity: 0,
              status: "DEPLETED",
            })
            .where(eq(inventoryLots.id, lot.id));
        }

        if (currentAvailable > 0) {
          await tx.insert(stockMovements).values({
            variantId: variant.id,
            fromLocationId: locId,
            movementType: "ADJUSTMENT",
            quantity: currentAvailable,
            unitCost: unitCost.toFixed(2),
            referenceType: "AUDIT",
            referenceId: `ADJ-${variant.sku}`,
            performedByUserId: data.userId,
            notes: data.notes || `Stock count adjusted from ${currentAvailable} to 0 pcs`,
          });
        }
        finalAvailable = 0;
      } else if (target > currentAvailable) {
        const diff = target - currentAvailable;
        if (activeLots.length > 0) {
          const lotToInc = activeLots[0];
          await tx
            .update(inventoryLots)
            .set({
              currentQuantity: lotToInc.currentQuantity + diff,
              initialQuantity: lotToInc.initialQuantity + diff,
            })
            .where(eq(inventoryLots.id, lotToInc.id));
        } else {
          const lotNumber = `LOT-ADJ-${variant.sku}-${Date.now().toString(36).toUpperCase()}`;
          const totalCost = Math.round(diff * unitCost * 100) / 100;
          await tx.insert(inventoryLots).values({
            lotNumber,
            variantId: variant.id,
            initialQuantity: diff,
            currentQuantity: diff,
            reservedQuantity: 0,
            unitCost: unitCost.toFixed(2),
            totalCost: totalCost.toFixed(2),
            status: "ACTIVE",
          });
        }

        await tx.insert(stockMovements).values({
          variantId: variant.id,
          toLocationId: locId,
          movementType: "ADJUSTMENT",
          quantity: diff,
          unitCost: unitCost.toFixed(2),
          referenceType: "AUDIT",
          referenceId: `ADJ-${variant.sku}`,
          performedByUserId: data.userId,
          notes: data.notes || `Stock count adjusted from ${currentAvailable} to ${target} pcs (+${diff})`,
        });
        finalAvailable = target;
      } else if (target < currentAvailable) {
        let reductionNeeded = currentAvailable - target;
        for (const lot of activeLots) {
          if (reductionNeeded <= 0) break;
          const availableInLot = Math.max(0, lot.currentQuantity - lot.reservedQuantity);
          if (availableInLot <= 0) continue;

          const deduct = Math.min(reductionNeeded, availableInLot);
          const newQty = lot.currentQuantity - deduct;
          await tx
            .update(inventoryLots)
            .set({
              currentQuantity: newQty,
              status: newQty === 0 ? "DEPLETED" : "ACTIVE",
            })
            .where(eq(inventoryLots.id, lot.id));

          reductionNeeded -= deduct;
        }

        const diff = currentAvailable - target;
        await tx.insert(stockMovements).values({
          variantId: variant.id,
          fromLocationId: locId,
          movementType: "ADJUSTMENT",
          quantity: diff,
          unitCost: unitCost.toFixed(2),
          referenceType: "AUDIT",
          referenceId: `ADJ-${variant.sku}`,
          performedByUserId: data.userId,
          notes: data.notes || `Stock count adjusted from ${currentAvailable} to ${target} pcs (-${diff})`,
        });
        finalAvailable = target;
      } else {
        finalAvailable = currentAvailable;
      }
    }

    const [updatedVariant] = await tx
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, variant.id))
      .limit(1);

    return {
      variant: updatedVariant,
      availableStock: finalAvailable,
    };
  });
}

// Bulk update multiple variants stock or availability
export async function bulkUpdateVariantsStock(data: {
  variantIds: string[];
  inStockWithoutCount?: boolean;
  targetStock?: number;
  userId?: string;
  notes?: string;
}) {
  const results = [];
  for (const variantId of data.variantIds) {
    const res = await updateVariantStock({
      variantId,
      inStockWithoutCount: data.inStockWithoutCount,
      targetStock: data.targetStock,
      userId: data.userId,
      notes: data.notes,
    });
    results.push(res);
  }
  return results;
}

