"use server";

import { requireRole } from "@/lib/auth";
import {
  createSalesOrder,
  shipSalesOrder,
  deliverSalesOrderAndRecogniseRevenue,
  processReturnOrExchange,
  settleCourierRemittance,
} from "@/server/services/sales";
import { revalidatePath } from "next/cache";

export interface CreateOrderPayload {
  customerName: string;
  customerPhone: string;
  shippingAddress: string;
  cityZone: string;
  variantId: string;
  quantity: number;
  unitPrice: number;
  deliveryCharge: number;
  discount?: number;
  notes?: string;
  allowBackorder?: boolean;
}

export async function createSalesOrderAction(payload: CreateOrderPayload) {
  try {
    const user = await requireRole(["ADMIN", "SALES_OP"]);

    const customerName = payload.customerName?.trim();
    const customerPhone = payload.customerPhone?.trim();
    const shippingAddress = payload.shippingAddress?.trim();
    const cityZone = payload.cityZone?.trim() || "Inside Dhaka";
    const variantId = payload.variantId?.trim();
    const quantity = Number(payload.quantity);
    const unitPrice = Number(payload.unitPrice);
    const deliveryCharge = Number(payload.deliveryCharge || 0);
    const discount = Number(payload.discount || 0);

    if (!customerName || !customerPhone || !shippingAddress || !variantId) {
      return {
        success: false,
        error: "Customer Name, Phone Number, Shipping Address, and Item Variant are all required.",
      };
    }

    if (!quantity || quantity <= 0) {
      return { success: false, error: "Quantity must be at least 1 unit." };
    }

    if (unitPrice < 0 || isNaN(unitPrice)) {
      return { success: false, error: "Unit Price must be a valid non-negative amount." };
    }

    const result = await createSalesOrder({
      customerName,
      customerPhone,
      shippingAddress,
      cityZone,
      lines: [
        {
          variantId,
          quantity,
          unitPrice,
          discount: 0,
        },
      ],
      deliveryCharge,
      discount,
      paymentMethod: "COD",
      notes: payload.notes || undefined,
      allowBackorder: Boolean(payload.allowBackorder),
      userId: user.id,
    });

    revalidatePath("/orders");
    revalidatePath("/inventory");
    revalidatePath("/finance");
    revalidatePath("/");

    return {
      success: true,
      orderId: result.order.id,
      orderNumber: result.order.orderNumber,
      totalAmount: result.order.totalAmount,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to create sales order. Please verify details and try again.",
    };
  }
}

export async function shipOrderAction(orderId: string, courierId?: string, waybillNumber?: string) {
  try {
    const user = await requireRole(["ADMIN", "SALES_OP"]);

    if (!orderId) {
      return { success: false, error: "Order ID is required." };
    }

    await shipSalesOrder({
      orderId,
      courierId: courierId || undefined,
      waybillNumber: waybillNumber || undefined,
      userId: user.id,
    });

    revalidatePath("/orders");
    revalidatePath("/inventory");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to mark order as shipped." };
  }
}

export async function deliverOrderAction(orderId: string) {
  try {
    const user = await requireRole(["ADMIN", "SALES_OP"]);

    if (!orderId) {
      return { success: false, error: "Order ID is required." };
    }

    await deliverSalesOrderAndRecogniseRevenue({ orderId, userId: user.id });

    revalidatePath("/orders");
    revalidatePath("/inventory");
    revalidatePath("/finance");
    revalidatePath("/");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to confirm delivery and recognize revenue." };
  }
}

export async function returnOrderAction(data: {
  orderId: string;
  reason: string;
  refundAmount?: number;
  isRestockable?: boolean;
  paymentAccountId?: string;
}) {
  try {
    const user = await requireRole(["ADMIN", "SALES_OP"]);

    if (!data.orderId || !data.reason) {
      return { success: false, error: "Order ID and Return Reason are required." };
    }

    await processReturnOrExchange({
      orderId: data.orderId,
      reason: data.reason,
      refundAmount: Number(data.refundAmount || 0),
      isRestockable: Boolean(data.isRestockable),
      paymentAccountId: data.paymentAccountId || undefined,
      userId: user.id,
    });

    revalidatePath("/orders");
    revalidatePath("/inventory");
    revalidatePath("/finance");
    revalidatePath("/");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to process customer return." };
  }
}

export async function settleCourierAction(data: {
  courierId: string;
  paymentAccountId: string;
  orderId: string;
  codAmount: number;
  courierFee: number;
}) {
  try {
    const user = await requireRole(["ADMIN", "SALES_OP"]);

    if (!data.courierId || !data.paymentAccountId || !data.orderId || !data.codAmount) {
      return { success: false, error: "Courier, Deposit Account, Order, and COD amount are required." };
    }

    await settleCourierRemittance({
      courierId: data.courierId,
      paymentAccountId: data.paymentAccountId,
      settlements: [
        {
          salesOrderId: data.orderId,
          codAmount: data.codAmount,
          courierFee: data.courierFee || 0,
        },
      ],
      userId: user.id,
    });

    revalidatePath("/orders");
    revalidatePath("/finance");
    revalidatePath("/");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to record courier COD settlement." };
  }
}
