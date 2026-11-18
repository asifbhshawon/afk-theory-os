import { describe, it, expect } from "vitest";
import { db } from "@/db";
import { products, productVariants, inventoryLots, stockMovements } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  createProductWithVariants,
  updateVariantStock,
  bulkUpdateVariantsStock,
  getInventoryStockMap,
} from "@/server/services/inventory";
import { createSalesOrder } from "@/server/services/sales";
import { generateVariantSku } from "@/lib/catalog";

describe("Acceptance Test 24: Edit Stock & Uncounted In-Stock Availability Option", () => {
  it("Requirement 1: User can edit stock count up and down directly", async () => {
    const runId = Math.random().toString(36).slice(2, 7).toUpperCase();
    const styleCode = `AFK-EDIT-${runId}`;

    const { variants } = await createProductWithVariants({
      name: `Stock Edit Test Shirt ${runId}`,
      styleCode,
      category: "T-Shirts",
      retailPrice: 1250,
      variants: [
        {
          sku: `${styleCode}-BLK-M`,
          color: "Washed Black",
          size: "M",
          sellingPrice: 1250,
          costPrice: 400,
        },
      ],
    });

    const targetVariant = variants[0];

    // Initial stock is 0
    let stockMap = await getInventoryStockMap();
    expect(stockMap[targetVariant.id]?.availableQty || 0).toBe(0);

    // 1. Edit stock count: Set stock to 35 pcs
    const res1 = await updateVariantStock({
      variantId: targetVariant.id,
      targetStock: 35,
      notes: "Initial inventory count audit",
    });

    expect(res1.availableStock).toBe(35);
    stockMap = await getInventoryStockMap();
    expect(stockMap[targetVariant.id]?.availableQty).toBe(35);

    // Verify stock movement ledger recorded ADJUSTMENT
    const [movement1] = await db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.variantId, targetVariant.id))
      .orderBy(stockMovements.createdAt);
    expect(movement1.movementType).toBe("ADJUSTMENT");
    expect(movement1.quantity).toBe(35);

    // 2. Edit stock count: Reduce stock to 20 pcs
    const res2 = await updateVariantStock({
      variantId: targetVariant.id,
      targetStock: 20,
      notes: "Physical recount adjustment",
    });

    expect(res2.availableStock).toBe(20);
    stockMap = await getInventoryStockMap();
    expect(stockMap[targetVariant.id]?.availableQty).toBe(20);
  });

  it("Requirement 2: When stock count is zero, the option 'say in stock without any exact number' can be enabled", async () => {
    const runId = Math.random().toString(36).slice(2, 7).toUpperCase();
    const styleCode = `AFK-ZERO-${runId}`;

    const { variants } = await createProductWithVariants({
      name: `Zero Stock Option Tee ${runId}`,
      styleCode,
      category: "T-Shirts",
      retailPrice: 1350,
      variants: [
        {
          sku: `${styleCode}-GRN-L`,
          color: "Bottle Green",
          size: "L",
          sellingPrice: 1350,
          costPrice: 380,
        },
      ],
    });

    const targetVariant = variants[0];

    // Give it initial stock of 15
    await updateVariantStock({
      variantId: targetVariant.id,
      targetStock: 15,
    });

    let stockMap = await getInventoryStockMap();
    expect(stockMap[targetVariant.id]?.availableQty).toBe(15);

    // User edits stock: sets stock count to ZERO, and enables "inStockWithoutCount"
    const result = await updateVariantStock({
      variantId: targetVariant.id,
      targetStock: 0,
      inStockWithoutCount: true,
      notes: "Stock zeroed out but marked as generally In Stock",
    });

    expect(result.availableStock).toBe(0);
    expect(result.variant.inStockWithoutCount).toBe(true);

    // Verify DB variant record has inStockWithoutCount set to true
    const [savedVariant] = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, targetVariant.id))
      .limit(1);

    expect(savedVariant.inStockWithoutCount).toBe(true);

    // Active lots should be depleted / 0
    stockMap = await getInventoryStockMap();
    expect(stockMap[targetVariant.id]?.availableQty || 0).toBe(0);
  });

  it("Requirement 3: When stock count is zero and 'inStockWithoutCount' is false, it stays regular out-of-stock", async () => {
    const runId = Math.random().toString(36).slice(2, 7).toUpperCase();
    const styleCode = `AFK-OOS-${runId}`;

    const { variants } = await createProductWithVariants({
      name: `OOS Test Polo ${runId}`,
      styleCode,
      category: "Polos",
      retailPrice: 1500,
      variants: [
        {
          sku: `${styleCode}-CHA-M`,
          color: "Charcoal Grey",
          size: "M",
          sellingPrice: 1500,
          costPrice: 420,
        },
      ],
    });

    const targetVariant = variants[0];

    const result = await updateVariantStock({
      variantId: targetVariant.id,
      targetStock: 0,
      inStockWithoutCount: false,
    });

    expect(result.availableStock).toBe(0);
    expect(result.variant.inStockWithoutCount).toBe(false);

    // Attempting to place an order without allowBackorder fails because inStockWithoutCount is false and stock is 0
    await expect(
      createSalesOrder({
        customerName: "Mahfuz Rahman",
        customerPhone: "01711111111",
        shippingAddress: "Dhanmondi 27, Dhaka",
        lines: [{ variantId: targetVariant.id, quantity: 1, unitPrice: 1500 }],
        allowBackorder: false,
      })
    ).rejects.toThrow(/Out of stock for SKU/);
  });

  it("Requirement 4: An item with stock count zero but 'inStockWithoutCount' enabled allows order placement", async () => {
    const runId = Math.random().toString(36).slice(2, 7).toUpperCase();
    const styleCode = `AFK-AVAIL-${runId}`;

    const { variants } = await createProductWithVariants({
      name: `Always In Stock Shirt ${runId}`,
      styleCode,
      category: "Shirts",
      retailPrice: 1650,
      variants: [
        {
          sku: `${styleCode}-WHT-XL`,
          color: "Vintage White",
          size: "XL",
          sellingPrice: 1650,
          costPrice: 450,
        },
      ],
    });

    const targetVariant = variants[0];

    // Set stock count to 0, but set inStockWithoutCount: true
    await updateVariantStock({
      variantId: targetVariant.id,
      targetStock: 0,
      inStockWithoutCount: true,
    });

    // Order should place smoothly without throwing out of stock error
    const orderRes = await createSalesOrder({
      customerName: "Nusrat Jahan",
      customerPhone: "01722222222",
      shippingAddress: "Uttara Sector 4, Dhaka",
      lines: [{ variantId: targetVariant.id, quantity: 2, unitPrice: 1650 }],
      allowBackorder: false, // Notice allowBackorder is false, but inStockWithoutCount allows it!
    });

    expect(orderRes.order.id).toBeDefined();
    expect(orderRes.order.orderNumber).toContain("AFK-ORD-");
  });

  it("Requirement 5: Bulk updating multiple variants in a color group", async () => {
    const runId = Math.random().toString(36).slice(2, 7).toUpperCase();
    const styleCode = `AFK-BULK-${runId}`;

    const { variants } = await createProductWithVariants({
      name: `Bulk Colorway Drop ${runId}`,
      styleCode,
      category: "T-Shirts",
      retailPrice: 1400,
      variants: [
        { sku: `${styleCode}-MAR-M`, color: "Maroon", size: "M", sellingPrice: 1400, costPrice: 400 },
        { sku: `${styleCode}-MAR-L`, color: "Maroon", size: "L", sellingPrice: 1400, costPrice: 400 },
        { sku: `${styleCode}-MAR-XL`, color: "Maroon", size: "XL", sellingPrice: 1400, costPrice: 400 },
      ],
    });

    const variantIds = variants.map((v) => v.id);

    // Bulk set all Maroon variants to inStockWithoutCount: true
    await bulkUpdateVariantsStock({
      variantIds,
      inStockWithoutCount: true,
      notes: "All maroon sizes marked in stock",
    });

    const updatedVariants = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, variants[0].productId));

    expect(updatedVariants.length).toBe(3);
    for (const v of updatedVariants) {
      expect(v.inStockWithoutCount).toBe(true);
    }
  });
});
