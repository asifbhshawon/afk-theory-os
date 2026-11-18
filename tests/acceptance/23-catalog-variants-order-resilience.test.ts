import { describe, it, expect } from "vitest";
import { db } from "@/db";
import { products, productVariants, inventoryLots, salesOrders, salesLines, paymentAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  createProductWithVariants,
  receivePurchaseLot,
  getInventoryStockMap,
  deleteProductVariant,
} from "@/server/services/inventory";
import { generateColorCode, generateVariantSku } from "@/lib/catalog";
import { createSalesOrder } from "@/server/services/sales";

describe("Acceptance Test 23: Apparel Catalog Multi-Color & Multi-Size Matrix + Resilient Orders", () => {
  it("Requirement 1: Generates accurate 3-letter apparel color codes and standardized SKUs", () => {
    expect(generateColorCode("Washed Black")).toBe("BLK");
    expect(generateColorCode("Charcoal Grey")).toBe("CHA");
    expect(generateColorCode("Bottle Green")).toBe("BGR");
    expect(generateColorCode("Forest Green")).toBe("BGR");
    expect(generateColorCode("Maroon")).toBe("MAR");
    expect(generateColorCode("Vintage White")).toBe("WHT");
    expect(generateColorCode("Navy Blue")).toBe("NVY");
    expect(generateColorCode("Desert Sand")).toBe("SND");
    expect(generateColorCode("Olive Green")).toBe("OLV");
    expect(generateColorCode("Mocha Brown")).toBe("BRN");

    expect(generateVariantSku("AFK-TS-001", "Bottle Green", "XL")).toBe("AFK-TS-001-BGR-XL");
    expect(generateVariantSku("AFK-HDS-001", "Washed Black", "M")).toBe("AFK-HDS-001-BLK-M");
  });

  it("Requirement 2: Creates a product style with a multi-color and multi-size variant matrix", async () => {
    const runId = Math.random().toString(36).slice(2, 7).toUpperCase();
    const styleCode = `AFK-TEST-${runId}`;
    const colors = ["Washed Black", "Bottle Green", "Maroon"];
    const sizes = ["M", "L", "XL", "XXL"];

    const variantsPayload = [];
    for (const color of colors) {
      for (const size of sizes) {
        variantsPayload.push({
          sku: generateVariantSku(styleCode, color, size),
          color,
          size,
          sellingPrice: 1550,
          costPrice: 450,
        });
      }
    }

    expect(variantsPayload.length).toBe(12);

    const { product, variants } = await createProductWithVariants({
      name: `Heavyweight Matrix Tee ${runId}`,
      styleCode,
      category: "T-Shirts",
      productType: "FINISHED_GARMENT",
      retailPrice: 1550,
      costPrice: 450,
      variants: variantsPayload,
    });

    expect(product.styleCode).toBe(styleCode);
    expect(variants.length).toBe(12);

    // Verify all 12 variants exist in DB
    const saved = await db.select().from(productVariants).where(eq(productVariants.productId, product.id));
    expect(saved.length).toBe(12);

    const savedSkus = saved.map((s) => s.sku);
    expect(savedSkus).toContain(`${styleCode}-BLK-M`);
    expect(savedSkus).toContain(`${styleCode}-BGR-L`);
    expect(savedSkus).toContain(`${styleCode}-MAR-XXL`);
  });

  it("Requirement 3: Adds new colors and sizes to an existing style without duplicating", async () => {
    const runId = Math.random().toString(36).slice(2, 7).toUpperCase();
    const styleCode = `AFK-BASE-${runId}`;

    const { product } = await createProductWithVariants({
      name: `Drop Shoulder Crew ${runId}`,
      styleCode,
      category: "Sweatshirts",
      retailPrice: 1800,
      variants: [
        { sku: `${styleCode}-BLK-M`, color: "Washed Black", size: "M", sellingPrice: 1800, costPrice: 500 },
      ],
    });

    // Add a new color (Charcoal Grey) in sizes M & L
    const { variants: updatedVariants } = await createProductWithVariants({
      productId: product.id,
      name: product.name,
      styleCode: product.styleCode,
      category: product.category,
      retailPrice: 1800,
      variants: [
        { sku: `${styleCode}-BLK-M`, color: "Washed Black", size: "M", sellingPrice: 1800, costPrice: 500 }, // existing
        { sku: `${styleCode}-CHA-M`, color: "Charcoal Grey", size: "M", sellingPrice: 1800, costPrice: 500 }, // new
        { sku: `${styleCode}-CHA-L`, color: "Charcoal Grey", size: "L", sellingPrice: 1800, costPrice: 500 }, // new
      ],
    });

    expect(updatedVariants.length).toBe(3);
    const inDb = await db.select().from(productVariants).where(eq(productVariants.productId, product.id));
    expect(inDb.length).toBe(3);
  });

  it("Requirement 4: Out of stock order throws descriptive error when backorders not allowed", async () => {
    const runId = Math.random().toString(36).slice(2, 7).toUpperCase();
    const { variants } = await createProductWithVariants({
      name: `Limited Edition Jacket ${runId}`,
      styleCode: `AFK-JKT-${runId}`,
      category: "Jackets",
      retailPrice: 3500,
      variants: [
        { sku: `AFK-JKT-${runId}-BLK-L`, color: "Washed Black", size: "L", sellingPrice: 3500, costPrice: 1200 },
      ],
    });

    const targetVariant = variants[0];

    // Attempting order with 0 stock and allowBackorder: false throws informative error
    await expect(
      createSalesOrder({
        customerName: "Imran Khan",
        customerPhone: "01819999999",
        shippingAddress: "Gulshan 1, Dhaka",
        lines: [{ variantId: targetVariant.id, quantity: 2, unitPrice: 3500 }],
        allowBackorder: false,
      })
    ).rejects.toThrow(/Out of stock for SKU/);
  });

  it("Requirement 5: Pre-order / Backorder places successfully when allowBackorder is enabled", async () => {
    const runId = Math.random().toString(36).slice(2, 7).toUpperCase();
    const { variants } = await createProductWithVariants({
      name: `Upcoming Winter Drop Hoodie ${runId}`,
      styleCode: `AFK-W26-${runId}`,
      category: "Hoodies",
      retailPrice: 2200,
      variants: [
        { sku: `AFK-W26-${runId}-MAR-XL`, color: "Maroon", size: "XL", sellingPrice: 2200, costPrice: 700 },
      ],
    });

    const targetVariant = variants[0];

    // Order placed as pre-order / backorder without lot reservation
    const { order, lines } = await createSalesOrder({
      customerName: "Fariha Tasnim",
      customerPhone: "01912345678",
      shippingAddress: "Banani DOHS, Dhaka",
      cityZone: "Inside Dhaka",
      deliveryCharge: 80,
      lines: [{ variantId: targetVariant.id, quantity: 1, unitPrice: 2200 }],
      allowBackorder: true,
    });

    expect(order.id).toBeDefined();
    expect(order.orderNumber).toContain("AFK-ORD-");
    expect(Number(order.totalAmount)).toBe(2280); // 2200 + 80 delivery
    expect(lines.length).toBe(1);
    expect(lines[0].lotId).toBeNull();
    expect(Number(lines[0].cogsUnitCost)).toBe(700); // Fell back to variant cost price
  });

  it("Requirement 6: Tracks stock levels accurately in getInventoryStockMap", async () => {
    const runId = Math.random().toString(36).slice(2, 7).toUpperCase();
    const { variants } = await createProductWithVariants({
      name: `Tracked Polo ${runId}`,
      styleCode: `AFK-POLO-${runId}`,
      category: "Polos",
      retailPrice: 1400,
      variants: [
        { sku: `AFK-POLO-${runId}-NVY-M`, color: "Navy Blue", size: "M", sellingPrice: 1400, costPrice: 400 },
      ],
    });

    const vId = variants[0].id;

    // Initially 0
    let map = await getInventoryStockMap();
    expect(map[vId]?.availableQty || 0).toBe(0);

    const [cashAcc] = await db.select().from(paymentAccounts).where(eq(paymentAccounts.type, "CASH")).limit(1);

    // Receive 20 units
    await receivePurchaseLot({
      variantId: vId,
      lotNumber: `LOT-POLO-${runId}`,
      quantity: 20,
      unitCost: 400,
      paymentAccountId: cashAcc.id,
      isRawMaterial: false,
    });

    map = await getInventoryStockMap();
    expect(map[vId].availableQty).toBe(20);

    // Place an order for 5 units (reserving stock)
    await createSalesOrder({
      customerName: "Shafiqul Islam",
      customerPhone: "01755555555",
      shippingAddress: "Mirpur 10, Dhaka",
      lines: [{ variantId: vId, quantity: 5, unitPrice: 1400 }],
      allowBackorder: false,
    });

    map = await getInventoryStockMap();
    expect(map[vId].currentQty).toBe(20);
    expect(map[vId].reservedQty).toBe(5);
    expect(map[vId].availableQty).toBe(15);
  });
});
