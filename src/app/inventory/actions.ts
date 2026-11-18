"use server";

import { requireRole } from "@/lib/auth";
import {
  createProductWithVariants,
  receivePurchaseLot,
  deleteProductVariant,
  updateVariantStock,
  bulkUpdateVariantsStock,
} from "@/server/services/inventory";
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
      productType: payload.productType || "FINISHED_GARMENT",
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

export async function deleteVariantAction(variantId: string) {
  try {
    await requireRole(["ADMIN", "INVENTORY_MGR"]);
    if (!variantId) {
      return { success: false, error: "Variant ID is required." };
    }

    await deleteProductVariant(variantId);

    revalidatePath("/inventory");
    revalidatePath("/orders");
    revalidatePath("/manufacturing");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete variant." };
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
