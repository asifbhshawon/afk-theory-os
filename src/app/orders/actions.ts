"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import {
  createSalesOrder,
  shipSalesOrder,
  deliverSalesOrderAndRecogniseRevenue,
  cancelSalesOrder,
  processReturnOrExchange,
  settleCourierRemittance,
} from "@/server/services/sales";

// Every action returns a plain result (never throws to the client) so the UI
// can show an inline message / toast instead of the Next.js error page.
export type ActionResult<T = undefined> =
  | { ok: true; message: string; data?: T }
  | { ok: false; error: string };

const SALES_ROLES = ["ADMIN", "SALES_OP"];

function fail(err: unknown): { ok: false; error: string } {
  const msg = err instanceof Error ? err.message : "Something went wrong.";
  return { ok: false, error: msg };
}

function refresh() {
  revalidatePath("/orders");
  revalidatePath("/inventory");
  revalidatePath("/finance");
  revalidatePath("/");
}

export interface QuickSaleInput {
  customerName: string;
  customerPhone: string;
  shippingAddress: string;
  cityZone: string;
  channel: string;
  lines: { variantId: string; quantity: number; unitPrice: number }[];
  deliveryCharge: number;
  discount: number;
  notes?: string;
  /** sell without (enough) counted stock — pre-order / backorder */
  allowBackorder?: boolean;
  idempotencyKey: string;
}

export async function createOrderAction(
  input: QuickSaleInput
): Promise<ActionResult<{ orderId: string; orderNumber: string; total: number }>> {
  try {
    const user = await requireRole(SALES_ROLES);

    const customerName = input.customerName?.trim();
    const customerPhone = input.customerPhone?.trim();
    const shippingAddress = input.shippingAddress?.trim();
    if (!customerName) return { ok: false, error: "Customer name is required." };
    if (!customerPhone) return { ok: false, error: "Customer phone is required." };
    if (!shippingAddress) return { ok: false, error: "Shipping address is required." };
    if (!input.lines?.length) return { ok: false, error: "Add at least one item to the sale." };

    const res = await createSalesOrder({
      customerName,
      customerPhone,
      shippingAddress,
      cityZone: input.cityZone || "Inside Dhaka",
      channel: input.channel || "MANUAL",
      lines: input.lines.map((l) => ({
        variantId: l.variantId,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
      })),
      deliveryCharge: Number(input.deliveryCharge) || 0,
      discount: Number(input.discount) || 0,
      paymentMethod: "COD",
      notes: input.notes?.trim() || undefined,
      allowBackorder: !!input.allowBackorder,
      idempotencyKey: input.idempotencyKey,
      userId: user.id,
    });

    refresh();
    return {
      ok: true,
      message: res.isDuplicate
        ? `Order ${res.order.orderNumber} was already created.`
        : res.lines.some((l) => !l.lotId)
        ? `Order ${res.order.orderNumber} created as a pre-order — units without stock were not reserved.`
        : `Order ${res.order.orderNumber} created and stock reserved.`,
      data: {
        orderId: res.order.id,
        orderNumber: res.order.orderNumber,
        total: Number(res.order.totalAmount),
      },
    };
  } catch (err) {
    return fail(err);
  }
}

export async function shipOrderAction(input: {
  orderId: string;
  courierId: string;
  waybillNumber: string;
}): Promise<ActionResult> {
  try {
    const user = await requireRole(SALES_ROLES);
    if (!input.courierId) return { ok: false, error: "Choose the courier handling this parcel." };
    if (!input.waybillNumber?.trim()) return { ok: false, error: "Enter the courier waybill / tracking number." };

    await shipSalesOrder({
      orderId: input.orderId,
      courierId: input.courierId,
      waybillNumber: input.waybillNumber.trim(),
      userId: user.id,
    });
    refresh();
    return { ok: true, message: "Order marked as shipped." };
  } catch (err) {
    return fail(err);
  }
}

export async function deliverOrderAction(input: { orderId: string }): Promise<ActionResult> {
  try {
    const user = await requireRole(SALES_ROLES);
    const res = await deliverSalesOrderAndRecogniseRevenue({ orderId: input.orderId, userId: user.id });
    refresh();
    return { ok: true, message: `Delivered — revenue recognised for ${res.order.orderNumber}.` };
  } catch (err) {
    return fail(err);
  }
}

export async function cancelOrderAction(input: { orderId: string; reason: string }): Promise<ActionResult> {
  try {
    const user = await requireRole(SALES_ROLES);
    const res = await cancelSalesOrder({ orderId: input.orderId, reason: input.reason, userId: user.id });
    refresh();
    return {
      ok: true,
      message: `${res.orderNumber} cancelled — ${res.releasedUnits} unit(s) released back to stock.`,
    };
  } catch (err) {
    return fail(err);
  }
}

export async function returnOrderAction(input: {
  orderId: string;
  reason: string;
  refundAmount: number;
  isRestockable: boolean;
  paymentAccountId?: string;
}): Promise<ActionResult> {
  try {
    const user = await requireRole(SALES_ROLES);
    await processReturnOrExchange({
      orderId: input.orderId,
      reason: input.reason,
      refundAmount: Number(input.refundAmount),
      isRestockable: input.isRestockable,
      paymentAccountId: input.paymentAccountId || undefined,
      userId: user.id,
    });
    refresh();
    return { ok: true, message: "Return processed and revenue reversed." };
  } catch (err) {
    return fail(err);
  }
}

export async function settleCourierAction(input: {
  courierId: string;
  paymentAccountId: string;
  orderId: string;
  codAmount: number;
  courierFee: number;
}): Promise<ActionResult> {
  try {
    const user = await requireRole(SALES_ROLES);
    if (!input.courierId) return { ok: false, error: "Choose the courier." };
    if (!input.paymentAccountId) return { ok: false, error: "Choose the account the money was deposited into." };
    if (!input.orderId) return { ok: false, error: "Choose a delivered order." };

    await settleCourierRemittance({
      courierId: input.courierId,
      paymentAccountId: input.paymentAccountId,
      settlements: [
        {
          salesOrderId: input.orderId,
          codAmount: Number(input.codAmount),
          courierFee: Number(input.courierFee) || 0,
        },
      ],
      userId: user.id,
    });
    refresh();
    return { ok: true, message: "Courier settlement posted." };
  } catch (err) {
    return fail(err);
  }
}

/** Settles several delivered orders of one courier in a single payout journal. */
export async function settleCourierBatchAction(input: {
  courierId: string;
  paymentAccountId: string;
  items: { orderId: string; codAmount: number; courierFee: number }[];
  notes?: string;
}): Promise<ActionResult<{ settlementNumber: string; net: number; orders: number }>> {
  try {
    const user = await requireRole(SALES_ROLES);
    if (!input.courierId) return { ok: false, error: "Choose the courier who paid out." };
    if (!input.paymentAccountId) return { ok: false, error: "Choose the account the money was deposited into." };
    if (!input.items?.length) return { ok: false, error: "Tick at least one delivered order." };

    const settlement = await settleCourierRemittance({
      courierId: input.courierId,
      paymentAccountId: input.paymentAccountId,
      settlements: input.items.map((i) => ({
        salesOrderId: i.orderId,
        codAmount: Number(i.codAmount),
        courierFee: Number(i.courierFee) || 0,
      })),
      notes: input.notes?.trim() || undefined,
      userId: user.id,
    });
    refresh();
    return {
      ok: true,
      message: `${settlement.settlementNumber} posted — ${input.items.length} order${input.items.length === 1 ? "" : "s"}, net ${Number(
        settlement.netAmountReceived
      ).toLocaleString("en-BD")} deposited.`,
      data: {
        settlementNumber: settlement.settlementNumber,
        net: Number(settlement.netAmountReceived),
        orders: input.items.length,
      },
    };
  } catch (err) {
    return fail(err);
  }
}
