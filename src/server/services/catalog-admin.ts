import { db } from "@/db";
import {
  products,
  productVariants,
  inventoryLots,
  stockMovements,
  salesLines,
  purchaseLines,
  goodsReceiptLines,
  productionMaterialIssues,
  productionOrders,
  boms,
  bomLines,
  ventureProductLinks,
  auditLogs,
} from "@/db/schema";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { generateVariantSku } from "@/lib/catalog";
import { schedulePortalSync } from "./portal-autosync";

// =============================================================================
// Catalog administration: edit, rename, move, replace (merge) and delete styles
// and SKU variants.
//
// Rules that keep the books trustworthy:
//  * EDITING is always allowed. Everything in the ledger points at ids, so a new
//    name / colour / SKU / price never breaks an old order, lot or journal.
//  * DELETING is allowed only when nothing references the record. A SKU or style
//    with stock, sales or production history is protected.
//  * For protected SKUs, REPLACE moves every reference onto another SKU and then
//    removes the old one. For whole styles, ARCHIVE (status) hides them from
//    selling without touching history.
// =============================================================================

const VARIANT_REFS = [
  { key: "lots", label: "stock lot", table: inventoryLots, col: inventoryLots.variantId, prop: "variantId" },
  { key: "movements", label: "stock movement", table: stockMovements, col: stockMovements.variantId, prop: "variantId" },
  { key: "sales", label: "sales line", table: salesLines, col: salesLines.variantId, prop: "variantId" },
  { key: "purchases", label: "purchase line", table: purchaseLines, col: purchaseLines.variantId, prop: "variantId" },
  { key: "receipts", label: "goods-receipt line", table: goodsReceiptLines, col: goodsReceiptLines.variantId, prop: "variantId" },
  { key: "materialIssues", label: "material issue", table: productionMaterialIssues, col: productionMaterialIssues.variantId, prop: "variantId" },
  { key: "production", label: "production order", table: productionOrders, col: productionOrders.targetVariantId, prop: "targetVariantId" },
  { key: "boms", label: "bill of materials", table: boms, col: boms.variantId, prop: "variantId" },
  { key: "bomComponents", label: "BOM component line", table: bomLines, col: bomLines.componentVariantId, prop: "componentVariantId" },
] as const;

export type UsageKey = (typeof VARIANT_REFS)[number]["key"];
export type VariantUsage = Record<UsageKey, number> & { total: number };

const emptyUsage = (): VariantUsage => {
  const u: any = { total: 0 };
  for (const r of VARIANT_REFS) u[r.key] = 0;
  return u;
};

/** How many ledger / operational records point at each variant. */
export async function getVariantUsage(variantIds: string[]): Promise<Record<string, VariantUsage>> {
  const out: Record<string, VariantUsage> = {};
  for (const id of variantIds) out[id] = emptyUsage();
  if (variantIds.length === 0) return out;

  const results = await Promise.all(
    VARIANT_REFS.map((r) =>
      db
        .select({ id: r.col, n: sql<number>`count(*)::int` })
        .from(r.table as any)
        .where(inArray(r.col as any, variantIds))
        .groupBy(r.col as any)
    )
  );
  results.forEach((rows, i) => {
    const key = VARIANT_REFS[i].key;
    for (const row of rows as { id: string; n: number }[]) {
      if (!out[row.id]) continue;
      out[row.id][key] = row.n;
      out[row.id].total += row.n;
    }
  });
  return out;
}

export function describeUsage(u: VariantUsage): string {
  const parts: string[] = [];
  for (const r of VARIANT_REFS) {
    const n = u[r.key];
    if (n > 0) parts.push(`${n} ${r.label}${n === 1 ? "" : "s"}`);
  }
  return parts.join(", ");
}

/** Records that point at the style itself (not its SKUs). */
async function getStyleOwnUsage(productId: string) {
  const [[bomCount], [orderCount], [linkCount]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(boms).where(eq(boms.productId, productId)),
    db.select({ n: sql<number>`count(*)::int` }).from(productionOrders).where(eq(productionOrders.targetProductId, productId)),
    db.select({ n: sql<number>`count(*)::int` }).from(ventureProductLinks).where(eq(ventureProductLinks.productId, productId)),
  ]);
  return { boms: bomCount.n, productionOrders: orderCount.n, ventureLinks: linkCount.n };
}

export interface StyleUsage {
  variantCount: number;
  variantRecords: number;
  own: { boms: number; productionOrders: number; ventureLinks: number };
  blockedBy: string[];
  canDelete: boolean;
}

export async function getStyleUsage(productId: string): Promise<StyleUsage> {
  const vars = await db.select({ id: productVariants.id }).from(productVariants).where(eq(productVariants.productId, productId));
  const usage = await getVariantUsage(vars.map((v) => v.id));
  const own = await getStyleOwnUsage(productId);
  const variantRecords = Object.values(usage).reduce((s, u) => s + u.total, 0);
  const blockedBy: string[] = [];
  if (variantRecords > 0) {
    const sum = emptyUsage();
    for (const u of Object.values(usage)) for (const r of VARIANT_REFS) sum[r.key] += u[r.key];
    blockedBy.push(describeUsage(sum));
  }
  if (own.boms) blockedBy.push(`${own.boms} bill(s) of materials`);
  if (own.productionOrders) blockedBy.push(`${own.productionOrders} production order(s)`);
  if (own.ventureLinks) blockedBy.push(`${own.ventureLinks} venture link(s)`);
  return { variantCount: vars.length, variantRecords, own, blockedBy, canDelete: blockedBy.length === 0 };
}

async function audit(
  tx: any,
  userId: string | undefined,
  entityType: "PRODUCT" | "VARIANT",
  entityId: string,
  action: "UPDATE" | "DELETE",
  details: string,
  oldValues?: unknown,
  newValues?: unknown
) {
  await tx.insert(auditLogs).values({ userId, action, entityType, entityId, details, oldValues: oldValues as any, newValues: newValues as any });
}

const clean = (s: string | undefined) => (s ?? "").trim();
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const money = (n: number) => Number(n).toFixed(2);

// -----------------------------------------------------------------------------
// Edit a style (name, code, category, type, prices, colours, sizes, status)
// -----------------------------------------------------------------------------

export interface UpdateStyleInput {
  productId: string;
  name?: string;
  styleCode?: string;
  category?: string;
  productType?: string;
  retailPrice?: number;
  targetCogs?: number;
  status?: "ACTIVE" | "ARCHIVED" | "PLANNING";
  /** set every SKU's selling price to the new retail price */
  applyRetailToVariants?: boolean;
  /** set every SKU's cost price to the new target cost */
  applyCostToVariants?: boolean;
  /** rewrite SKU codes to <STYLE>-<COLOUR CODE>-<SIZE> after any code/colour/size change */
  regenerateSkus?: boolean;
  colorRenames?: { from: string; to: string }[];
  sizeRenames?: { from: string; to: string }[];
  userId?: string;
}

export async function updateProductStyle(input: UpdateStyleInput) {
  const result = await db.transaction(async (tx) => {
    const [product] = await tx.select().from(products).where(eq(products.id, input.productId)).limit(1);
    if (!product) throw new Error("Style not found.");

    const patch: Partial<typeof products.$inferInsert> = {};
    if (input.name !== undefined) {
      if (!clean(input.name)) throw new Error("Style name cannot be empty.");
      patch.name = clean(input.name);
    }
    if (input.category !== undefined) {
      if (!clean(input.category)) throw new Error("Category cannot be empty.");
      patch.category = clean(input.category);
    }
    if (input.productType !== undefined) patch.productType = input.productType;
    if (input.status !== undefined) patch.status = input.status;
    if (input.retailPrice !== undefined) {
      if (!(input.retailPrice >= 0)) throw new Error("Retail price cannot be negative.");
      patch.retailPrice = money(input.retailPrice);
    }
    if (input.targetCogs !== undefined) {
      if (!(input.targetCogs >= 0)) throw new Error("Target cost cannot be negative.");
      patch.targetCogs = money(input.targetCogs);
    }

    let newStyleCode = product.styleCode;
    if (input.styleCode !== undefined) {
      newStyleCode = clean(input.styleCode).toUpperCase();
      if (!newStyleCode) throw new Error("Style code cannot be empty.");
      if (newStyleCode !== product.styleCode) {
        const [clash] = await tx
          .select({ id: products.id })
          .from(products)
          .where(and(eq(products.styleCode, newStyleCode), ne(products.id, product.id)))
          .limit(1);
        if (clash) throw new Error(`Style code ${newStyleCode} is already used by another style.`);
        patch.styleCode = newStyleCode;
      }
    }

    // ---- plan SKU changes ---------------------------------------------------
    const vars = await tx.select().from(productVariants).where(eq(productVariants.productId, product.id));
    const colorMap = new Map((input.colorRenames ?? []).filter((r) => clean(r.to)).map((r) => [r.from.toLowerCase(), clean(r.to)]));
    const sizeMap = new Map((input.sizeRenames ?? []).filter((r) => clean(r.to)).map((r) => [r.from.toLowerCase(), clean(r.to)]));
    const mustRegenerate = input.regenerateSkus || false;

    const planned = vars.map((v) => {
      const color = colorMap.get(v.color.toLowerCase()) ?? v.color;
      const size = sizeMap.get(v.size.toLowerCase()) ?? v.size;
      const sku = mustRegenerate ? generateVariantSku(newStyleCode, color, size) : v.sku;
      const set: Partial<typeof productVariants.$inferInsert> = {};
      if (color !== v.color) set.color = color;
      if (size !== v.size) set.size = size;
      if (sku !== v.sku) set.sku = sku;
      if (input.applyRetailToVariants && input.retailPrice !== undefined) set.sellingPrice = money(input.retailPrice);
      if (input.applyCostToVariants && input.targetCogs !== undefined) set.costPrice = money(input.targetCogs);
      return { v, color, size, sku, set };
    });

    // two SKUs of the style would end up identical (colour + size)
    const seen = new Map<string, string>();
    for (const p of planned) {
      const key = `${p.color.toLowerCase()}|${p.size.toLowerCase()}`;
      if (seen.has(key)) {
        throw new Error(`That would create two ${p.color} / ${p.size} SKUs in this style. Use "Replace with another SKU" to merge them instead.`);
      }
      seen.set(key, p.v.id);
    }

    const changing = planned.filter((p) => p.set.sku !== undefined);
    if (changing.length > 0) {
      const finals = new Set<string>();
      for (const p of changing) {
        if (finals.has(p.sku)) throw new Error(`Two SKUs would both become ${p.sku}.`);
        finals.add(p.sku);
      }
      const changingIds = changing.map((p) => p.v.id);
      const clashes = await tx
        .select({ sku: productVariants.sku })
        .from(productVariants)
        .where(and(inArray(productVariants.sku, [...finals]), sql`${productVariants.id} NOT IN (${sql.join(changingIds.map((i) => sql`${i}`), sql`, `)})`));
      if (clashes.length > 0) throw new Error(`SKU ${clashes[0].sku} already exists on another product.`);
    }

    // ---- apply ----------------------------------------------------------------
    if (Object.keys(patch).length > 0) await tx.update(products).set(patch).where(eq(products.id, product.id));

    // park changing SKUs on a temporary value first so colour swaps (A<->B) never collide mid-way
    for (const p of changing) {
      await tx.update(productVariants).set({ sku: `__tmp__${p.v.id}` }).where(eq(productVariants.id, p.v.id));
    }
    for (const p of planned) {
      if (Object.keys(p.set).length === 0) continue;
      await tx.update(productVariants).set(p.set).where(eq(productVariants.id, p.v.id));
    }

    const changedVariants = planned.filter((p) => Object.keys(p.set).length > 0).length;
    await audit(
      tx,
      input.userId,
      "PRODUCT",
      product.id,
      "UPDATE",
      `Edited style ${product.styleCode}${newStyleCode !== product.styleCode ? ` → ${newStyleCode}` : ""} (${changedVariants} SKU${changedVariants === 1 ? "" : "s"} changed)`,
      { name: product.name, styleCode: product.styleCode, category: product.category, retailPrice: product.retailPrice, status: product.status },
      patch
    );

    const [updated] = await tx.select().from(products).where(eq(products.id, product.id));
    return { product: updated, changedVariants, skuChanges: changing.map((p) => ({ from: p.v.sku, to: p.sku })) };
  });
  schedulePortalSync("catalog");
  return result;
}

// -----------------------------------------------------------------------------
// Edit one SKU
// -----------------------------------------------------------------------------

export interface UpdateVariantInput {
  variantId: string;
  /** move the SKU under another style */
  productId?: string;
  color?: string;
  size?: string;
  sku?: string;
  /** derive the SKU from style + colour + size instead of typing it */
  regenerateSku?: boolean;
  sellingPrice?: number;
  costPrice?: number;
  reorderLevel?: number;
  barcode?: string | null;
  fit?: string | null;
  userId?: string;
}

export async function updateProductVariant(input: UpdateVariantInput) {
  const result = await db.transaction(async (tx) => {
    const [variant] = await tx.select().from(productVariants).where(eq(productVariants.id, input.variantId)).limit(1);
    if (!variant) throw new Error("SKU not found.");

    const targetProductId = input.productId ?? variant.productId;
    const [style] = await tx.select().from(products).where(eq(products.id, targetProductId)).limit(1);
    if (!style) throw new Error("Target style not found.");

    const color = input.color !== undefined ? clean(input.color) : variant.color;
    const size = input.size !== undefined ? clean(input.size) : variant.size;
    if (!color || !size) throw new Error("Colour and size cannot be empty.");

    let sku = variant.sku;
    if (input.regenerateSku) sku = generateVariantSku(style.styleCode, color, size);
    else if (input.sku !== undefined) sku = clean(input.sku).toUpperCase();
    if (!sku) throw new Error("SKU cannot be empty.");

    const patch: Partial<typeof productVariants.$inferInsert> = {};
    if (targetProductId !== variant.productId) patch.productId = targetProductId;
    if (color !== variant.color) patch.color = color;
    if (size !== variant.size) patch.size = size;
    if (sku !== variant.sku) patch.sku = sku;
    if (input.sellingPrice !== undefined) {
      if (!(input.sellingPrice >= 0)) throw new Error("Selling price cannot be negative.");
      patch.sellingPrice = money(input.sellingPrice);
    }
    if (input.costPrice !== undefined) {
      if (!(input.costPrice >= 0)) throw new Error("Cost price cannot be negative.");
      patch.costPrice = money(input.costPrice);
    }
    if (input.reorderLevel !== undefined) {
      if (!Number.isInteger(input.reorderLevel) || input.reorderLevel < 0) throw new Error("Reorder level must be a whole number, zero or more.");
      patch.reorderLevel = input.reorderLevel;
    }
    if (input.barcode !== undefined) patch.barcode = clean(input.barcode ?? "") || null;
    if (input.fit !== undefined) patch.fit = clean(input.fit ?? "") || null;

    if (patch.sku) {
      const [clash] = await tx
        .select({ id: productVariants.id })
        .from(productVariants)
        .where(and(eq(productVariants.sku, sku), ne(productVariants.id, variant.id)))
        .limit(1);
      if (clash) throw new Error(`SKU ${sku} already exists. Use "Replace with another SKU" to merge them.`);
    }
    if (patch.productId || patch.color || patch.size) {
      const siblings = await tx
        .select()
        .from(productVariants)
        .where(and(eq(productVariants.productId, targetProductId), ne(productVariants.id, variant.id)));
      if (siblings.some((s) => same(s.color, color) && same(s.size, size))) {
        throw new Error(`${style.styleCode} already has a ${color} / ${size} SKU. Use "Replace with another SKU" to merge them.`);
      }
    }

    if (Object.keys(patch).length > 0) {
      await tx.update(productVariants).set(patch).where(eq(productVariants.id, variant.id));
      await audit(tx, input.userId, "VARIANT", variant.id, "UPDATE", `Edited SKU ${variant.sku}${patch.sku ? ` → ${patch.sku}` : ""}`, {
        sku: variant.sku, color: variant.color, size: variant.size, sellingPrice: variant.sellingPrice, costPrice: variant.costPrice, productId: variant.productId,
      }, patch);
    }
    const [updated] = await tx.select().from(productVariants).where(eq(productVariants.id, variant.id));
    return updated;
  });
  schedulePortalSync("catalog");
  return result;
}

// -----------------------------------------------------------------------------
// Replace (merge) one SKU into another: all history follows, the old SKU goes
// -----------------------------------------------------------------------------

export async function replaceVariant(input: { fromVariantId: string; toVariantId: string; userId?: string }) {
  if (input.fromVariantId === input.toVariantId) throw new Error("Choose a different SKU to replace it with.");
  const result = await db.transaction(async (tx) => {
    const [from] = await tx.select().from(productVariants).where(eq(productVariants.id, input.fromVariantId)).limit(1);
    const [to] = await tx.select().from(productVariants).where(eq(productVariants.id, input.toVariantId)).limit(1);
    if (!from || !to) throw new Error("SKU not found.");

    const moved: Record<string, number> = {};
    for (const r of VARIANT_REFS) {
      const res = await tx
        .update(r.table as any)
        .set({ [r.prop]: to.id } as any)
        .where(eq(r.col as any, from.id))
        .returning({ id: (r.table as any).id });
      moved[r.key] = res.length;
    }
    await tx.delete(productVariants).where(eq(productVariants.id, from.id));

    const total = Object.values(moved).reduce((s, n) => s + n, 0);
    await audit(
      tx,
      input.userId,
      "VARIANT",
      from.id,
      "DELETE",
      `Replaced SKU ${from.sku} with ${to.sku} (${total} record${total === 1 ? "" : "s"} moved)`,
      { sku: from.sku, color: from.color, size: from.size },
      { replacedBy: to.sku, moved }
    );
    return { from, to, moved, total };
  });
  schedulePortalSync("catalog");
  return result;
}

// -----------------------------------------------------------------------------
// Delete
// -----------------------------------------------------------------------------

export async function deleteVariant(input: { variantId: string; userId?: string }) {
  const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, input.variantId)).limit(1);
  if (!variant) throw new Error("SKU not found.");

  const usage = (await getVariantUsage([variant.id]))[variant.id];
  if (usage.total > 0) {
    throw new Error(
      `Cannot delete ${variant.sku}: it is used by ${describeUsage(usage)}. Use “Replace with another SKU” to move that history onto a different SKU, then it can be removed.`
    );
  }
  await db.transaction(async (tx) => {
    await tx.delete(productVariants).where(eq(productVariants.id, variant.id));
    await audit(tx, input.userId, "VARIANT", variant.id, "DELETE", `Deleted SKU ${variant.sku}`, { sku: variant.sku, color: variant.color, size: variant.size });
  });
  schedulePortalSync("catalog");
  return { success: true as const };
}

export async function deleteStyle(input: { productId: string; userId?: string }) {
  const [product] = await db.select().from(products).where(eq(products.id, input.productId)).limit(1);
  if (!product) throw new Error("Style not found.");

  const usage = await getStyleUsage(product.id);
  if (!usage.canDelete) {
    throw new Error(
      `Cannot delete ${product.styleCode}: it is used by ${usage.blockedBy.join("; ")}. Archive the style instead — it is hidden from selling but its history stays intact.`
    );
  }
  await db.transaction(async (tx) => {
    await tx.delete(productVariants).where(eq(productVariants.productId, product.id));
    await tx.delete(products).where(eq(products.id, product.id));
    await audit(tx, input.userId, "PRODUCT", product.id, "DELETE", `Deleted style ${product.styleCode} (${usage.variantCount} SKU${usage.variantCount === 1 ? "" : "s"})`, {
      styleCode: product.styleCode,
      name: product.name,
    });
  });
  schedulePortalSync("catalog");
  return { success: true as const, deletedVariants: usage.variantCount };
}
