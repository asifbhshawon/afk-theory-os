import { describe, it, expect } from "vitest";
import { db } from "@/db";
import { products, productVariants, inventoryLots, salesLines, paymentAccounts, auditLogs } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { createProductWithVariants, receivePurchaseLot, getInventoryStockMap, deleteProductVariant } from "@/server/services/inventory";
import { createSalesOrder, listSellableVariants } from "@/server/services/sales";
import {
  updateProductStyle,
  updateProductVariant,
  replaceVariant,
  deleteVariant,
  deleteStyle,
  getVariantUsage,
  getStyleUsage,
} from "@/server/services/catalog-admin";

const tag = () => Math.random().toString(36).slice(2, 7).toUpperCase();

async function style(opts: { colors?: string[]; sizes?: string[]; code?: string } = {}) {
  const t = tag();
  const code = opts.code ?? `AFK-CE-${t}`;
  const colors = opts.colors ?? ["Black", "Maroon"];
  const sizes = opts.sizes ?? ["M", "L"];
  const { product, variants } = await createProductWithVariants({
    name: `Catalog Edit ${t}`,
    styleCode: code,
    category: "T-Shirts",
    retailPrice: 1000,
    costPrice: 400,
    variants: colors.flatMap((c, ci) =>
      sizes.map((s) => ({ sku: `${code}-${ci}-${s}`, size: s, color: c, costPrice: 400, sellingPrice: 1000 }))
    ),
  });
  return { t, code, product, variants };
}

const cash = async () => (await db.select().from(paymentAccounts).where(eq(paymentAccounts.type, "CASH")).limit(1))[0];

describe("Catalog: edit, rename, replace and delete styles and SKUs", () => {
  it("edits a style: name, category, type, prices (and pushes prices to every SKU on request)", async () => {
    const { product, variants } = await style();
    const res = await updateProductStyle({
      productId: product.id,
      name: "Premium Hoodie",
      category: "Hoodie",
      productType: "FINISHED_GARMENT",
      retailPrice: 1450,
      targetCogs: 520,
      applyRetailToVariants: true,
      applyCostToVariants: true,
    });
    expect(res.product.name).toBe("Premium Hoodie");
    expect(res.product.category).toBe("Hoodie");
    expect(Number(res.product.retailPrice)).toBe(1450);
    const after = await db.select().from(productVariants).where(eq(productVariants.productId, product.id));
    expect(after).toHaveLength(variants.length);
    for (const v of after) {
      expect(Number(v.sellingPrice)).toBe(1450);
      expect(Number(v.costPrice)).toBe(520);
    }
  });

  it("changing the style code can regenerate every SKU; unchanged prices stay when not asked", async () => {
    const { product, code } = await style({ colors: ["Bottle Green"], sizes: ["M", "XL"] });
    const newCode = `AFK-NEW-${tag()}`;
    const res = await updateProductStyle({ productId: product.id, styleCode: newCode.toLowerCase(), regenerateSkus: true });
    expect(res.product.styleCode).toBe(newCode);
    const skus = (await db.select().from(productVariants).where(eq(productVariants.productId, product.id))).map((v) => v.sku).sort();
    expect(skus).toEqual([`${newCode}-BGR-M`, `${newCode}-BGR-XL`]);
    expect(res.skuChanges).toHaveLength(2);
    // old code no longer used anywhere
    expect(skus.some((s) => s.startsWith(code))).toBe(false);
  });

  it("renames a colourway across all sizes, and can swap two colours without colliding", async () => {
    const { product, code } = await style({ colors: ["Black", "White"], sizes: ["M", "L"] });
    // 1) plain rename
    await updateProductStyle({ productId: product.id, colorRenames: [{ from: "Black", to: "Lavender" }], regenerateSkus: true });
    let vs = await db.select().from(productVariants).where(eq(productVariants.productId, product.id));
    expect(vs.filter((v) => v.color === "Lavender")).toHaveLength(2);
    expect(vs.some((v) => v.color === "Black")).toBe(false);
    expect(vs.map((v) => v.sku)).toContain(`${code}-LAV-M`);

    // 2) swap Lavender <-> White in one save
    await updateProductStyle({
      productId: product.id,
      colorRenames: [
        { from: "Lavender", to: "White" },
        { from: "White", to: "Lavender" },
      ],
      regenerateSkus: true,
    });
    vs = await db.select().from(productVariants).where(eq(productVariants.productId, product.id));
    const bySku = Object.fromEntries(vs.map((v) => [v.sku, v.color]));
    expect(bySku[`${code}-LAV-M`]).toBe("Lavender");
    expect(bySku[`${code}-WHT-M`]).toBe("White");
    expect(vs).toHaveLength(4);
  });

  it("refuses edits that would duplicate a style code, a colour/size pair or a SKU", async () => {
    const a = await style();
    const b = await style();
    await expect(updateProductStyle({ productId: b.product.id, styleCode: a.code })).rejects.toThrow(/already used by another style/);
    // both colours renamed to the same value -> two identical colour/size SKUs
    await expect(
      updateProductStyle({ productId: a.product.id, colorRenames: [{ from: "Maroon", to: "Black" }] })
    ).rejects.toThrow(/two Black \/ M SKUs|two Black \/ L SKUs/);
    // SKU collides with another product's SKU
    const target = b.variants[0];
    await expect(updateProductVariant({ variantId: a.variants[0].id, sku: target.sku })).rejects.toThrow(/already exists/);
    // nothing changed on failure
    const still = await db.select().from(productVariants).where(eq(productVariants.id, a.variants[0].id));
    expect(still[0].sku).toBe(a.variants[0].sku);
  });

  it("edits a single SKU: colour, size, price, reorder level, barcode; regenerates the SKU on request", async () => {
    const { variants, code } = await style({ colors: ["Black"], sizes: ["M"] });
    const v = variants[0];
    const res = await updateProductVariant({
      variantId: v.id,
      color: "Desert Sand",
      size: "XXL",
      regenerateSku: true,
      sellingPrice: 1299,
      costPrice: 480,
      reorderLevel: 4,
      barcode: "8801234567890",
    });
    expect(res.sku).toBe(`${code}-SND-XXL`);
    expect(res.color).toBe("Desert Sand");
    expect(Number(res.sellingPrice)).toBe(1299);
    expect(res.reorderLevel).toBe(4);
    expect(res.barcode).toBe("8801234567890");
    await expect(updateProductVariant({ variantId: v.id, reorderLevel: -1 })).rejects.toThrow(/Reorder level/);
    await expect(updateProductVariant({ variantId: v.id, sellingPrice: -5 })).rejects.toThrow(/negative/);
  });

  it("moves a SKU to another style, but not onto an existing colour/size", async () => {
    const a = await style({ colors: ["Black"], sizes: ["M"] });
    const b = await style({ colors: ["Black"], sizes: ["L"] });
    // same colour/size already in target? b has Black/L, moving Black/M is fine
    const moved = await updateProductVariant({ variantId: a.variants[0].id, productId: b.product.id });
    expect(moved.productId).toBe(b.product.id);
    // now a third Black/L would clash in b
    const c = await style({ colors: ["Black"], sizes: ["L"] });
    await expect(updateProductVariant({ variantId: c.variants[0].id, productId: b.product.id })).rejects.toThrow(/already has a Black \/ L SKU/);
  });

  it("deletes an unused SKU and an unused style (with its SKUs); both are audit-logged", async () => {
    const s = await style({ colors: ["Black"], sizes: ["M", "L"] });
    await deleteVariant({ variantId: s.variants[0].id });
    expect(await db.select().from(productVariants).where(eq(productVariants.id, s.variants[0].id))).toHaveLength(0);

    const res = await deleteStyle({ productId: s.product.id });
    expect(res.deletedVariants).toBe(1);
    expect(await db.select().from(products).where(eq(products.id, s.product.id))).toHaveLength(0);
    expect(await db.select().from(productVariants).where(eq(productVariants.productId, s.product.id))).toHaveLength(0);

    const logs = await db.select().from(auditLogs).where(and(eq(auditLogs.entityType, "PRODUCT"), eq(auditLogs.entityId, s.product.id)));
    expect(logs.some((l) => /Deleted style/.test(l.details ?? ""))).toBe(true);
  });

  it("protects SKUs and styles that have stock or sales history, and explains why", async () => {
    const s = await style({ colors: ["Black"], sizes: ["M", "L"] });
    const [withStock, withSale] = s.variants;
    const acc = await cash();
    await receivePurchaseLot({ variantId: withStock.id, lotNumber: `LOT-CE-${tag()}`, quantity: 5, unitCost: 400, paymentAccountId: acc.id, isRawMaterial: false });
    await createSalesOrder({
      customerName: "Catalog Buyer",
      customerPhone: "01300000001",
      shippingAddress: "Dhaka",
      lines: [{ variantId: withSale.id, quantity: 1, unitPrice: 1000 }],
      allowBackorder: true,
    });

    await expect(deleteVariant({ variantId: withStock.id })).rejects.toThrow(/stock lot/);
    await expect(deleteProductVariant(withSale.id)).rejects.toThrow(/sales line/);
    await expect(deleteStyle({ productId: s.product.id })).rejects.toThrow(/Archive the style instead/);

    const usage = await getVariantUsage([withStock.id, withSale.id]);
    expect(usage[withStock.id].lots).toBe(1);
    expect(usage[withStock.id].total).toBeGreaterThanOrEqual(2); // lot + stock movement
    expect(usage[withSale.id].sales).toBe(1);
    const su = await getStyleUsage(s.product.id);
    expect(su.canDelete).toBe(false);
    expect(su.blockedBy.join(" ")).toMatch(/sales line/);
  });

  it("replaces a SKU with another: lots, movements and sales lines follow, the old SKU disappears", async () => {
    const dup = await style({ colors: ["Black"], sizes: ["M"] });
    const keep = await style({ colors: ["Black"], sizes: ["M"] });
    const acc = await cash();
    const lot = await receivePurchaseLot({ variantId: dup.variants[0].id, lotNumber: `LOT-RP-${tag()}`, quantity: 8, unitCost: 410, paymentAccountId: acc.id, isRawMaterial: false });
    const { order } = await createSalesOrder({
      customerName: "Replace Buyer",
      customerPhone: "01300000002",
      shippingAddress: "Dhaka",
      lines: [{ variantId: dup.variants[0].id, quantity: 2, unitPrice: 1000 }],
    });

    const res = await replaceVariant({ fromVariantId: dup.variants[0].id, toVariantId: keep.variants[0].id });
    expect(res.moved.lots).toBe(1);
    expect(res.moved.sales).toBe(1);
    expect(res.moved.movements).toBeGreaterThanOrEqual(1);

    expect(await db.select().from(productVariants).where(eq(productVariants.id, dup.variants[0].id))).toHaveLength(0);
    const [movedLot] = await db.select().from(inventoryLots).where(eq(inventoryLots.id, lot.id));
    expect(movedLot.variantId).toBe(keep.variants[0].id);
    expect(movedLot.reservedQuantity).toBe(2);
    const [line] = await db.select().from(salesLines).where(eq(salesLines.salesOrderId, order.id));
    expect(line.variantId).toBe(keep.variants[0].id);

    const map = await getInventoryStockMap();
    expect(map[keep.variants[0].id].currentQty).toBe(8);
    expect(map[keep.variants[0].id].availableQty).toBe(6);

    await expect(replaceVariant({ fromVariantId: keep.variants[0].id, toVariantId: keep.variants[0].id })).rejects.toThrow(/different SKU/);
  });

  it("archiving a style hides it from selling without touching history", async () => {
    const s = await style({ colors: ["Black"], sizes: ["M"] });
    expect((await listSellableVariants()).some((v) => v.id === s.variants[0].id)).toBe(true);
    await updateProductStyle({ productId: s.product.id, status: "ARCHIVED" });
    expect((await listSellableVariants()).some((v) => v.id === s.variants[0].id)).toBe(false);
    expect(await db.select().from(productVariants).where(eq(productVariants.id, s.variants[0].id))).toHaveLength(1);
    await updateProductStyle({ productId: s.product.id, status: "ACTIVE" });
    expect((await listSellableVariants()).some((v) => v.id === s.variants[0].id)).toBe(true);
  });

  it("legacy FINISHED_GOODS styles stay sellable, and new saves use the canonical product type", async () => {
    const s = await style({ colors: ["Black"], sizes: ["M"] });
    await db.update(products).set({ productType: "FINISHED_GOODS" }).where(eq(products.id, s.product.id));
    expect((await listSellableVariants()).some((v) => v.id === s.variants[0].id)).toBe(true);

    const saved = await createProductWithVariants({
      name: "Typed Style",
      styleCode: `AFK-TY-${tag()}`,
      category: "T-Shirts",
      productType: "FINISHED_GOODS",
      retailPrice: 900,
      variants: [{ sku: `AFK-TY-${tag()}-M`, size: "M", color: "Black", costPrice: 300, sellingPrice: 900 }],
    });
    expect(saved.product.productType).toBe("FINISHED_GARMENT");
  });
});
