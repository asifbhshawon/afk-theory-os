"use server";

import { requireRole } from "@/lib/auth";
import {
  createProductWithVariants,
  receivePurchaseLot,
  deleteProductVariant,
  updateVariantStock,
  bulkUpdateVariantsStock,
} from "@/server/services/inventory";
import {
  updateProductStyle,
  updateProductVariant,
  replaceVariant,
  deleteVariant,
  deleteStyle,
  getVariantUsage,
  getStyleUsage,
  describeUsage,
  type UpdateStyleInput,
  type UpdateVariantInput,
} from "@/server/services/catalog-admin";
import { normalizeProductType } from "@/lib/catalog";
import { revalidatePath } from "next/cache";

export interface SaveProductPayload {
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
}

export async function saveProductStyleAndVariantsAction(payload: SaveProductPayload) {
  try {
    await requireRole(["ADMIN", "INVENTORY_MGR"]);

    if (!payload.styleCode || !payload.name || !payload.category) {
      return { success: false, error: "Style code, name, and category are required." };
    }

    if (!payload.variants || payload.variants.length === 0) {
      return { success: false, error: "At least one SKU variant must be specified." };
    }

    const result = await createProductWithVariants({
      productId: payload.productId,
      name: payload.name.trim(),
      styleCode: payload.styleCode.trim().toUpperCase(),
      category: payload.category.trim(),
      productType: normalizeProductType(payload.productType),
      retailPrice: Number(payload.retailPrice || 0),
      costPrice: Number(payload.costPrice || 0),
      variants: payload.variants.map((v) => ({
        sku: v.sku.trim().toUpperCase(),
        size: v.size.trim(),
        color: v.color.trim(),
        costPrice: Number(v.costPrice || 0),
        sellingPrice: Number(v.sellingPrice || payload.retailPrice || 0),
      })),
    });

    revalidatePath("/inventory");
    revalidatePath("/orders");
    revalidatePath("/manufacturing");

    return {
      success: true,
      productId: result.product.id,
      styleCode: result.product.styleCode,
      variantsCount: result.variants.length,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to save product and variants." };
  }
}

function refreshCatalog() {
  revalidatePath("/inventory");
  revalidatePath("/orders");
  revalidatePath("/manufacturing");
  revalidatePath("/");
}

const CATALOG_ROLES = ["ADMIN", "INVENTORY_MGR"];

function failure(err: unknown, fallback: string) {
  return { success: false as const, error: err instanceof Error ? err.message : fallback };
}

export async function deleteVariantAction(variantId: string) {
  try {
    const user = await requireRole(CATALOG_ROLES);
    if (!variantId) return { success: false as const, error: "SKU is required." };
    await deleteVariant({ variantId, userId: user.id });
    refreshCatalog();
    return { success: true as const };
  } catch (err) {
    return failure(err, "Failed to delete SKU.");
  }
}

export async function deleteStyleAction(productId: string) {
  try {
    const user = await requireRole(CATALOG_ROLES);
    if (!productId) return { success: false as const, error: "Style is required." };
    const res = await deleteStyle({ productId, userId: user.id });
    refreshCatalog();
    return { success: true as const, deletedVariants: res.deletedVariants };
  } catch (err) {
    return failure(err, "Failed to delete style.");
  }
}

export async function updateStyleAction(input: Omit<UpdateStyleInput, "userId">) {
  try {
    const user = await requireRole(CATALOG_ROLES);
    const res = await updateProductStyle({ ...input, userId: user.id });
    refreshCatalog();
    return { success: true as const, changedVariants: res.changedVariants, skuChanges: res.skuChanges };
  } catch (err) {
    return failure(err, "Failed to update style.");
  }
}

export async function updateVariantAction(input: Omit<UpdateVariantInput, "userId">) {
  try {
    const user = await requireRole(CATALOG_ROLES);
    const res = await updateProductVariant({ ...input, userId: user.id });
    refreshCatalog();
    return { success: true as const, sku: res.sku };
  } catch (err) {
    return failure(err, "Failed to update SKU.");
  }
}

export async function replaceVariantAction(input: { fromVariantId: string; toVariantId: string }) {
  try {
    const user = await requireRole(CATALOG_ROLES);
    const res = await replaceVariant({ ...input, userId: user.id });
    refreshCatalog();
    return { success: true as const, recordsMoved: res.total, from: res.from.sku, to: res.to.sku };
  } catch (err) {
    return failure(err, "Failed to replace SKU.");
  }
}

/** What would block deleting this SKU / style — shown in the confirmation dialogs. */
export async function getCatalogUsageAction(input: { variantId?: string; productId?: string }) {
  try {
    await requireRole(CATALOG_ROLES);
    if (input.variantId) {
      const u = (await getVariantUsage([input.variantId]))[input.variantId];
      return { success: true as const, canDelete: u.total === 0, summary: describeUsage(u) };
    }
    if (input.productId) {
      const u = await getStyleUsage(input.productId);
      return { success: true as const, canDelete: u.canDelete, summary: u.blockedBy.join("; "), variantCount: u.variantCount };
    }
    return { success: false as const, error: "Nothing to check." };
  } catch (err) {
    return failure(err, "Could not check usage.");
  }
}

export async function receiveLotAction(data: {
  variantId: string;
  lotNumber: string;
  quantity: number;
  unitCost: number;
  paymentAccountId: string;
  isRawMaterial: boolean;
}) {
  try {
    const user = await requireRole(["ADMIN", "INVENTORY_MGR"]);

    if (
      !data.variantId ||
      !data.lotNumber ||
      !data.quantity ||
      data.quantity <= 0 ||
      !data.unitCost ||
      data.unitCost <= 0 ||
      !data.paymentAccountId
    ) {
      return { success: false, error: "All lot receipt fields are required with valid positive amounts." };
    }

    const lot = await receivePurchaseLot({
      variantId: data.variantId,
      lotNumber: data.lotNumber.trim().toUpperCase(),
      quantity: data.quantity,
      unitCost: data.unitCost,
      paymentAccountId: data.paymentAccountId,
      isRawMaterial: data.isRawMaterial,
      userId: user.id,
    });

    revalidatePath("/inventory");
    revalidatePath("/orders");
    revalidatePath("/finance");
    revalidatePath("/");

    return { success: true, lotNumber: lot.lotNumber, quantity: lot.currentQuantity };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to receive goods lot." };
  }
}

export async function updateVariantStockAction(data: {
  variantId: string;
  targetStock?: number;
  inStockWithoutCount?: boolean;
  sellingPrice?: number;
  costPrice?: number;
  notes?: string;
  applyToVariantIds?: string[];
}) {
  try {
    const user = await requireRole(["ADMIN", "INVENTORY_MGR"]);

    if (!data.variantId) {
      return { success: false, error: "Variant ID is required." };
    }

    const res = await updateVariantStock({
      variantId: data.variantId,
      targetStock: data.targetStock,
      inStockWithoutCount: data.inStockWithoutCount,
      sellingPrice: data.sellingPrice,
      costPrice: data.costPrice,
      userId: user.id,
      notes: data.notes,
    });

    if (data.applyToVariantIds && data.applyToVariantIds.length > 0) {
      for (const extraId of data.applyToVariantIds) {
        if (extraId !== data.variantId) {
          await updateVariantStock({
            variantId: extraId,
            inStockWithoutCount: data.inStockWithoutCount,
            userId: user.id,
            notes: data.notes ? `${data.notes} (bulk apply)` : "Bulk apply availability",
          });
        }
      }
    }

    revalidatePath("/inventory");
    revalidatePath("/orders");
    revalidatePath("/manufacturing");
    revalidatePath("/");

    return {
      success: true,
      variant: res.variant,
      availableStock: res.availableStock,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update variant stock." };
  }
}
