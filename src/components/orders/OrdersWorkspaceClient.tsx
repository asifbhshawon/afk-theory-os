"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createSalesOrderAction,
  shipOrderAction,
  deliverOrderAction,
  returnOrderAction,
  settleCourierAction,
} from "@/app/orders/actions";
import {
  Printer,
  Truck,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShoppingBag,
  CreditCard,
  PackageCheck,
  AlertTriangle,
  ArrowRight,
  Sparkles,
} from "lucide-react";

interface SalesOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  shippingAddress: string;
  cityZone: string;
  subtotal: string;
  discount: string;
  deliveryCharge: string;
  totalAmount: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  orderDate: Date | string;
  courierId?: string | null;
  waybillNumber?: string | null;
}

interface VariantOption {
  id: string;
  sku: string;
  size: string;
  color: string;
  sellingPrice: string;
  costPrice?: string;
  productId: string;
  inStockWithoutCount?: boolean;
  productName: string;
  styleCode: string;
}

interface Contact {
  id: string;
  name: string;
  type: string;
}

interface PaymentAccount {
  id: string;
  name: string;
  type: string;
}

interface OrdersWorkspaceClientProps {
  orders: SalesOrder[];
  variants: VariantOption[];
  stockMap: Record<string, { currentQty: number; reservedQty: number; availableQty: number }>;
  couriers: Contact[];
  payAccounts: PaymentAccount[];
  canManage: boolean;
}

const CITY_ZONES = [
  { label: "Inside Dhaka (Redx / Steadfast / Pathao)", zone: "Inside Dhaka", defaultCharge: 80 },
  { label: "Dhaka Suburbs (Savar, Gazipur, Keraniganj)", zone: "Dhaka Suburbs", defaultCharge: 120 },
  { label: "Outside Dhaka / Nationwide Courier", zone: "Outside Dhaka", defaultCharge: 150 },
  { label: "Self Pickup / Showroom (Free)", zone: "Showroom", defaultCharge: 0 },
];

export function OrdersWorkspaceClient({
  orders: initialOrders,
  variants,
  stockMap,
  couriers,
  payAccounts,
  canManage,
}: OrdersWorkspaceClientProps) {
  const router = useRouter();

  // Order creation form state
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [selectedZone, setSelectedZone] = useState("Inside Dhaka");
  const [deliveryCharge, setDeliveryCharge] = useState("80");
  const [selectedVariantId, setSelectedVariantId] = useState(variants[0]?.id || "");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState(variants[0]?.sellingPrice || "1450");
  const [discount, setDiscount] = useState("0");
  const [orderNotes, setOrderNotes] = useState("");
  const [allowBackorder, setAllowBackorder] = useState(false);

  // Submission feedback
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderAlert, setOrderAlert] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Action states for table items
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Ship Order Modal/Drawer state
  const [shippingOrderId, setShippingOrderId] = useState<string | null>(null);
  const [shipCourierId, setShipCourierId] = useState(couriers[0]?.id || "");
  const [shipWaybill, setShipWaybill] = useState("");

  // Settlement Form state
  const [settleOrderId, setSettleOrderId] = useState("");
  const [settleCourierId, setSettleCourierId] = useState(couriers[0]?.id || "");
  const [settleAccountId, setSettleAccountId] = useState(payAccounts[0]?.id || "");
  const [settleCodAmount, setSettleCodAmount] = useState("");
  const [settleCourierFee, setSettleCourierFee] = useState("120");
  const [isSubmittingSettle, setIsSubmittingSettle] = useState(false);
  const [settleMessage, setSettleMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Return Form state
  const [returnOrderId, setReturnOrderId] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [returnRefundAmount, setReturnRefundAmount] = useState("0");
  const [returnIsRestockable, setReturnIsRestockable] = useState(true);
  const [returnAccountId, setReturnAccountId] = useState(payAccounts[0]?.id || "");
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const [returnMessage, setReturnMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Selected variant details & live stock check
  const selectedVariant = useMemo(() => {
    return variants.find((v) => v.id === selectedVariantId);
  }, [variants, selectedVariantId]);

  const availableStock = selectedVariant ? stockMap[selectedVariant.id]?.availableQty || 0 : 0;
  const isOutOfStock = !selectedVariant?.inStockWithoutCount && availableStock < Number(quantity || 1);

  // Update unitPrice when variant changes
  const handleVariantSelect = (vId: string) => {
    setSelectedVariantId(vId);
    const v = variants.find((item) => item.id === vId);
    if (v && Number(v.sellingPrice) > 0) {
      setUnitPrice(String(Number(v.sellingPrice)));
    }
  };

  // Update delivery charge when zone changes
  const handleZoneSelect = (zoneName: string) => {
    setSelectedZone(zoneName);
    const z = CITY_ZONES.find((item) => item.zone === zoneName);
    if (z) {
      setDeliveryCharge(String(z.defaultCharge));
    }
  };

  // Price calculation
  const subtotal = Math.max(0, Number(quantity || 0) * Number(unitPrice || 0));
  const grandTotal = Math.max(0, subtotal + Number(deliveryCharge || 0) - Number(discount || 0));

  // Handle Order Submit
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderAlert(null);

    if (!selectedVariantId) {
      setOrderAlert({ type: "error", text: "Please select a product SKU variant." });
      return;
    }

    if (isOutOfStock && !allowBackorder) {
      setOrderAlert({
        type: "error",
        text: `Cannot place order: SKU "${selectedVariant?.sku}" has ${availableStock} in stock (Requested: ${quantity}). Check "Allow Pre-order / Backorder" to proceed without stock, or receive inventory first.`,
      });
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const res = await createSalesOrderAction({
        customerName,
        customerPhone,
        shippingAddress,
        cityZone: selectedZone,
        variantId: selectedVariantId,
        quantity: Number(quantity),
        unitPrice: Number(unitPrice),
        deliveryCharge: Number(deliveryCharge || 0),
        discount: Number(discount || 0),
        notes: orderNotes || undefined,
        allowBackorder,
      });

      if (res.success) {
        setOrderAlert({
          type: "success",
          text: `Sales Order ${res.orderNumber} confirmed successfully! Total COD: ৳${Number(res.totalAmount).toLocaleString("en-BD", { minimumFractionDigits: 2 })}.`,
        });
        setCustomerName("");
        setCustomerPhone("");
        setShippingAddress("");
        setOrderNotes("");
        router.refresh();
      } else {
        setOrderAlert({ type: "error", text: res.error || "Failed to create order." });
      }
    } catch (err: any) {
      setOrderAlert({ type: "error", text: err.message || "An unexpected error occurred." });
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Handle Ship Order Action
  const handleShipSubmit = async (orderId: string) => {
    setActionLoadingId(orderId);
    setActionError(null);
    try {
      const res = await shipOrderAction(orderId, shipCourierId, shipWaybill);
      if (res.success) {
        setShippingOrderId(null);
        setShipWaybill("");
        router.refresh();
      } else {
        setActionError(res.error || "Failed to ship order.");
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to ship order.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Deliver Order Action
  const handleDeliverOrder = async (orderId: string) => {
    if (!confirm("Confirm delivery and recognise sales revenue + COGS?")) return;
    setActionLoadingId(orderId);
    setActionError(null);
    try {
      const res = await deliverOrderAction(orderId);
      if (res.success) {
        router.refresh();
      } else {
        setActionError(res.error || "Failed to deliver order.");
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to deliver order.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Settle Courier Action
  const handleSettleCourierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettleMessage(null);
    setIsSubmittingSettle(true);
    try {
      const res = await settleCourierAction({
        orderId: settleOrderId,
        courierId: settleCourierId,
        paymentAccountId: settleAccountId,
        codAmount: Number(settleCodAmount),
        courierFee: Number(settleCourierFee || 0),
      });

      if (res.success) {
        setSettleMessage({
          type: "success",
          text: "Courier COD remittance settled successfully! Cash debited and receivables cleared in GL.",
        });
        setSettleOrderId("");
        setSettleCodAmount("");
        router.refresh();
      } else {
        setSettleMessage({ type: "error", text: res.error || "Failed to settle remittance." });
      }
    } catch (err: any) {
      setSettleMessage({ type: "error", text: err.message || "An unexpected error occurred." });
    } finally {
      setIsSubmittingSettle(false);
    }
  };

  // Handle Return Action
  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReturnMessage(null);
    setIsSubmittingReturn(true);
    try {
      const res = await returnOrderAction({
        orderId: returnOrderId,
        reason: returnReason,
        refundAmount: Number(returnRefundAmount || 0),
        isRestockable: returnIsRestockable,
        paymentAccountId: returnAccountId,
      });

      if (res.success) {
        setReturnMessage({
          type: "success",
          text: "Customer return processed successfully! Stock restored and refund accounted.",
        });
        setReturnOrderId("");
        setReturnReason("");
        router.refresh();
      } else {
        setReturnMessage({ type: "error", text: res.error || "Failed to process return." });
      }
    } catch (err: any) {
      setReturnMessage({ type: "error", text: err.message || "An unexpected error occurred." });
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  // Statistics
  const totalSalesRevenue = initialOrders
    .filter((o) => o.status === "DELIVERED")
    .reduce((sum, o) => sum + Number(o.totalAmount), 0);
  const pendingOrders = initialOrders.filter((o) => o.status === "CONFIRMED" || o.status === "SHIPPED").length;

  return (
    <div className="space-y-6">
      {/* Metric Cards Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-afk-card border border-afk-border p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-afk-muted">Total Orders</span>
            <ShoppingBag className="w-4 h-4 text-afk-olive-accent" />
          </div>
          <p className="text-xl font-bold font-mono text-afk-offwhite mt-1">{initialOrders.length}</p>
          <span className="text-[10px] text-afk-muted">All channels (COD / Direct)</span>
        </div>

        <div className="bg-afk-card border border-afk-border p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-afk-muted">Active Pipeline</span>
            <Truck className="w-4 h-4 text-afk-gold" />
          </div>
          <p className="text-xl font-bold font-mono text-afk-offwhite mt-1">{pendingOrders} orders</p>
          <span className="text-[10px] text-afk-muted">Confirmed or in courier transit</span>
        </div>

        <div className="bg-afk-card border border-afk-border p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-afk-muted">Delivered Revenue</span>
            <PackageCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl font-bold font-mono text-afk-offwhite mt-1">
            ৳{totalSalesRevenue.toLocaleString("en-BD", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
          <span className="text-[10px] text-afk-muted">Recognized GAAP revenue</span>
        </div>

        <div className="bg-afk-card border border-afk-border p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-afk-muted">Couriers Connected</span>
            <CreditCard className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-xl font-bold font-mono text-afk-offwhite mt-1">{couriers.length}</p>
          <span className="text-[10px] text-afk-muted">Steadfast, Redx, Pathao, etc.</span>
        </div>
      </div>

      {/* Create Sales Order Quick Form Card */}
      <div className="bg-afk-card p-6 rounded-xl border border-afk-border shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-afk-gold" />
          <h3 className="text-sm font-semibold text-afk-offwhite">Create Sales Order (Manual / Social / Website)</h3>
        </div>
        <p className="text-xs text-afk-muted mb-4">
          Reserve physical stock from inventory lots or record customer pre-orders. Generates sequential invoice and courier COD bill.
        </p>

        {orderAlert && (
          <div
            className={`p-3 rounded-lg text-xs mb-4 flex items-center gap-2 ${
              orderAlert.type === "success"
                ? "bg-emerald-950/40 text-emerald-300 border border-emerald-700/50"
                : "bg-red-950/40 text-red-300 border border-red-700/50"
            }`}
          >
            {orderAlert.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            )}
            <span>{orderAlert.text}</span>
          </div>
        )}

        <form onSubmit={handleCreateOrder} className="space-y-4 text-xs">
          {/* Customer & Address Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-afk-muted mb-1 font-medium">Customer Full Name *</label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Tanvir Ahmed"
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
              />
            </div>

            <div>
              <label className="block text-[11px] text-afk-muted mb-1 font-medium">Customer Mobile Number *</label>
              <input
                type="text"
                required
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="e.g. 01711223344"
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
              />
            </div>

            <div>
              <label className="block text-[11px] text-afk-muted mb-1 font-medium">Delivery Zone / City *</label>
              <select
                value={selectedZone}
                onChange={(e) => handleZoneSelect(e.target.value)}
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
              >
                {CITY_ZONES.map((cz) => (
                  <option key={cz.zone} value={cz.zone}>
                    {cz.label} (৳{cz.defaultCharge})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-afk-muted mb-1 font-medium">Shipping Address *</label>
            <input
              type="text"
              required
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              placeholder="Full delivery address, Thana, District"
              className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
            />
          </div>

          {/* Product Variant & Stock Selection Row */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-6">
              <label className="block text-[11px] text-afk-muted mb-1 font-medium">
                Product Style & SKU Variant *
              </label>
              <select
                value={selectedVariantId}
                onChange={(e) => handleVariantSelect(e.target.value)}
                required
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive font-mono"
              >
                <option value="">Select SKU Variant...</option>
                {variants.map((v) => {
                  const stock = stockMap[v.id]?.availableQty || 0;
                  return (
                    <option key={v.id} value={v.id}>
                      {v.sku} — {v.productName} ({v.color} / {v.size}) [Stock: {v.inStockWithoutCount ? "In Stock" : `${stock} pcs`}]
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] text-afk-muted mb-1 font-medium">Quantity *</label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] text-afk-muted mb-1 font-medium">Unit Price (৳) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] text-afk-muted mb-1 font-medium">Delivery (৳)</label>
              <input
                type="number"
                step="0.01"
                value={deliveryCharge}
                onChange={(e) => setDeliveryCharge(e.target.value)}
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
              />
            </div>
          </div>

          {/* Out of Stock Warning & Pre-Order Checkbox */}
          {selectedVariant && (
            <div
              className={`p-3 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                isOutOfStock
                  ? "bg-amber-950/40 border-amber-800/60 text-amber-300"
                  : "bg-emerald-950/30 border-emerald-800/40 text-emerald-300"
              }`}
            >
              <div className="flex items-center gap-2">
                {isOutOfStock ? (
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                )}
                <span>
                  {isOutOfStock ? (
                    <>
                      <strong>Stock Alert:</strong> Currently <strong>{availableStock} pcs</strong> in stock for{" "}
                      <span className="font-mono">{selectedVariant.sku}</span> (Requested: {quantity}).
                    </>
                  ) : selectedVariant.inStockWithoutCount ? (
                    <>
                      <strong>In Stock:</strong> Marked as In Stock (available for immediate order).
                    </>
                  ) : (
                    <>
                      <strong>In Stock:</strong> {availableStock} pcs available for immediate reservation.
                    </>
                  )}
                </span>
              </div>

              {isOutOfStock && (
                <label className="inline-flex items-center gap-2 cursor-pointer font-medium text-afk-offwhite self-start sm:self-auto">
                  <input
                    type="checkbox"
                    checked={allowBackorder}
                    onChange={(e) => setAllowBackorder(e.target.checked)}
                    className="rounded accent-afk-gold w-4 h-4"
                  />
                  <span>Allow Pre-order / Backorder (Proceed without physical lot stock)</span>
                </label>
              )}
            </div>
          )}

          {/* Pricing summary & Action Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-afk-border">
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="text-afk-muted">
                Items: <strong className="text-afk-offwhite">৳{subtotal.toFixed(2)}</strong>
              </span>
              <span className="text-afk-muted">
                Delivery: <strong className="text-afk-offwhite">+৳{Number(deliveryCharge || 0).toFixed(2)}</strong>
              </span>
              <span className="text-sm font-bold text-afk-gold">
                Total COD: ৳{grandTotal.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <button
              type="submit"
              disabled={isSubmittingOrder || (isOutOfStock && !allowBackorder)}
              className="px-6 py-2 bg-afk-olive hover:bg-afk-olive-light disabled:opacity-50 text-afk-offwhite text-xs font-semibold rounded transition shadow flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmittingOrder ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing order & stock...</span>
                </>
              ) : isOutOfStock && !allowBackorder ? (
                <span>⚠️ Out of stock (Check Backorder to allow)</span>
              ) : (
                <>
                  <span>Confirm Order & Generate Invoice</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Orders List Table Card */}
      <div className="bg-afk-card rounded-xl border border-afk-border p-6 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-afk-offwhite">Recent Sales Orders</h3>
          {actionError && <span className="text-xs text-red-400 font-medium">{actionError}</span>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-afk-border text-afk-muted">
                <th className="py-2.5 font-medium">Order Number</th>
                <th className="py-2.5 font-medium">Customer</th>
                <th className="py-2.5 font-medium">Phone</th>
                <th className="py-2.5 font-medium">Zone</th>
                <th className="py-2.5 font-medium text-right">Total Amount</th>
                <th className="py-2.5 font-medium text-center">Payment</th>
                <th className="py-2.5 font-medium text-center">Status</th>
                <th className="py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-afk-border/40">
              {initialOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-afk-muted">
                    No sales orders created yet. Use the form above to record your first order.
                  </td>
                </tr>
              ) : (
                initialOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-afk-surface/30 transition">
                    <td className="py-2.5 font-mono text-afk-offwhite font-bold">{o.orderNumber}</td>
                    <td className="py-2.5 text-afk-offwhite font-medium">{o.customerName}</td>
                    <td className="py-2.5 font-mono text-afk-muted">{o.customerPhone}</td>
                    <td className="py-2.5 text-afk-muted">{o.cityZone}</td>
                    <td className="py-2.5 text-right font-mono font-bold text-afk-offwhite">
                      ৳{Number(o.totalAmount).toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 text-center">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-afk-border text-afk-muted">
                        {o.paymentStatus}
                      </span>
                    </td>
                    <td className="py-2.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                          o.status === "DELIVERED"
                            ? "bg-afk-olive-dark text-afk-olive-accent"
                            : o.status === "SHIPPED"
                            ? "bg-afk-gold/20 text-afk-gold"
                            : o.status === "RETURNED"
                            ? "bg-afk-danger/20 text-afk-danger"
                            : "bg-afk-border text-afk-offwhite"
                        }`}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right space-x-1.5">
                      <Link
                        href={`/print/invoice/${o.id}`}
                        target="_blank"
                        title="Print Official Sales Invoice"
                        className="inline-block p-1 text-afk-muted hover:text-afk-offwhite hover:bg-afk-surface rounded border border-afk-border transition"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </Link>

                      {o.status === "CONFIRMED" && (
                        <button
                          type="button"
                          disabled={actionLoadingId === o.id}
                          onClick={() => setShippingOrderId(o.id)}
                          className="px-2 py-1 bg-afk-surface border border-afk-border hover:bg-afk-surfaceLight text-[11px] rounded text-afk-gold font-medium transition cursor-pointer"
                        >
                          Ship
                        </button>
                      )}

                      {o.status === "SHIPPED" && (
                        <button
                          type="button"
                          disabled={actionLoadingId === o.id}
                          onClick={() => handleDeliverOrder(o.id)}
                          className="px-2 py-1 bg-afk-olive hover:bg-afk-olive-light text-[11px] rounded text-afk-offwhite font-medium transition cursor-pointer"
                        >
                          Confirm Delivered
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Ship Modal / Drawer */}
      {shippingOrderId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-afk-card border border-afk-border rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-afk-border">
              <h4 className="text-sm font-semibold text-afk-offwhite">Dispatch Order with Courier</h4>
              <button
                type="button"
                onClick={() => setShippingOrderId(null)}
                className="text-afk-muted hover:text-afk-offwhite text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Courier Partner *</label>
                <select
                  value={shipCourierId}
                  onChange={(e) => setShipCourierId(e.target.value)}
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
                >
                  {couriers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Waybill / Consignment Number</label>
                <input
                  type="text"
                  value={shipWaybill}
                  onChange={(e) => setShipWaybill(e.target.value)}
                  placeholder="e.g. STDF-881923"
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShippingOrderId(null)}
                  className="px-3 py-1.5 bg-afk-surface border border-afk-border rounded text-afk-muted hover:text-afk-offwhite"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoadingId === shippingOrderId}
                  onClick={() => handleShipSubmit(shippingOrderId)}
                  className="px-4 py-1.5 bg-afk-olive hover:bg-afk-olive-light text-afk-offwhite rounded font-medium shadow flex items-center gap-1.5"
                >
                  {actionLoadingId === shippingOrderId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Confirm Dispatch</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Courier Settlement & Customer Returns Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Courier Settlement Form */}
        <div className="bg-afk-card p-6 rounded-xl border border-afk-border shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Truck className="w-4 h-4 text-afk-olive-accent" />
            <h3 className="text-sm font-semibold text-afk-offwhite">Courier COD Settlement Reconciliation</h3>
          </div>
          <p className="text-xs text-afk-muted mb-3">
            Reconciles collected COD cash against courier fees. Debits Bank/bKash (Net) and Courier Fee (Expense), credits Courier Receivables.
          </p>

          {settleMessage && (
            <div
              className={`p-3 rounded-lg text-xs mb-3 flex items-center gap-2 ${
                settleMessage.type === "success"
                  ? "bg-emerald-950/40 text-emerald-300 border border-emerald-700/50"
                  : "bg-red-950/40 text-red-300 border border-red-700/50"
              }`}
            >
              {settleMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              )}
              <span>{settleMessage.text}</span>
            </div>
          )}

          <form onSubmit={handleSettleCourierSubmit} className="space-y-3 text-xs">
            <div>
              <label className="block text-[11px] text-afk-muted mb-1 font-medium">Delivered Order *</label>
              <select
                value={settleOrderId}
                onChange={(e) => {
                  setSettleOrderId(e.target.value);
                  const ord = initialOrders.find((o) => o.id === e.target.value);
                  if (ord) setSettleCodAmount(String(Number(ord.totalAmount)));
                }}
                required
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
              >
                <option value="">Select Delivered Order...</option>
                {initialOrders
                  .filter((o) => o.status === "DELIVERED")
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.orderNumber} - {o.customerName} (COD: ৳{o.totalAmount})
                    </option>
                  ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Courier Partner *</label>
                <select
                  value={settleCourierId}
                  onChange={(e) => setSettleCourierId(e.target.value)}
                  required
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
                >
                  {couriers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Deposit Account (Net Cash) *</label>
                <select
                  value={settleAccountId}
                  onChange={(e) => setSettleAccountId(e.target.value)}
                  required
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
                >
                  {payAccounts.map((pa) => (
                    <option key={pa.id} value={pa.id}>
                      {pa.name} ({pa.type})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">COD Amount Collected (৳) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={settleCodAmount}
                  onChange={(e) => setSettleCodAmount(e.target.value)}
                  placeholder="e.g. 1530"
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
                />
              </div>

              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Courier Delivery Fee Deducted (৳)</label>
                <input
                  type="number"
                  step="0.01"
                  value={settleCourierFee}
                  onChange={(e) => setSettleCourierFee(e.target.value)}
                  placeholder="e.g. 120"
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmittingSettle}
              className="w-full py-2 bg-afk-surface hover:bg-afk-surfaceLight border border-afk-border text-afk-offwhite text-xs font-semibold rounded transition shadow flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmittingSettle ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Settling remittance...</span>
                </>
              ) : (
                <span>Reconcile COD Settlement & Post Journal</span>
              )}
            </button>
          </form>
        </div>

        {/* Customer Return / Exchange Form */}
        <div className="bg-afk-card p-6 rounded-xl border border-afk-border shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <RotateCcw className="w-4 h-4 text-afk-danger" />
            <h3 className="text-sm font-semibold text-afk-offwhite">Customer Returns & Exchanges</h3>
          </div>
          <p className="text-xs text-afk-muted mb-3">
            Process customer returns with automated inventory restocking and customer refund journal postings.
          </p>

          {returnMessage && (
            <div
              className={`p-3 rounded-lg text-xs mb-3 flex items-center gap-2 ${
                returnMessage.type === "success"
                  ? "bg-emerald-950/40 text-emerald-300 border border-emerald-700/50"
                  : "bg-red-950/40 text-red-300 border border-red-700/50"
              }`}
            >
              {returnMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              )}
              <span>{returnMessage.text}</span>
            </div>
          )}

          <form onSubmit={handleReturnSubmit} className="space-y-3 text-xs">
            <div>
              <label className="block text-[11px] text-afk-muted mb-1 font-medium">Order to Return *</label>
              <select
                value={returnOrderId}
                onChange={(e) => {
                  setReturnOrderId(e.target.value);
                  const ord = initialOrders.find((o) => o.id === e.target.value);
                  if (ord) setReturnRefundAmount(String(Number(ord.totalAmount)));
                }}
                required
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
              >
                <option value="">Select Order...</option>
                {initialOrders
                  .filter((o) => o.status === "DELIVERED" || o.status === "SHIPPED")
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.orderNumber} - {o.customerName} (৳{o.totalAmount})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-afk-muted mb-1 font-medium">Return Reason *</label>
              <input
                type="text"
                required
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="e.g. Size mismatch, exchanged for Size XL"
                className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Refund Amount (৳)</label>
                <input
                  type="number"
                  step="0.01"
                  value={returnRefundAmount}
                  onChange={(e) => setReturnRefundAmount(e.target.value)}
                  placeholder="0"
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
                />
              </div>

              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Refund Source Account</label>
                <select
                  value={returnAccountId}
                  onChange={(e) => setReturnAccountId(e.target.value)}
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
                >
                  {payAccounts.map((pa) => (
                    <option key={pa.id} value={pa.id}>
                      {pa.name} ({pa.type})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="restockableCheck"
                checked={returnIsRestockable}
                onChange={(e) => setReturnIsRestockable(e.target.checked)}
                className="rounded accent-afk-olive"
              />
              <label htmlFor="restockableCheck" className="text-afk-muted text-[11px] cursor-pointer">
                Item is in good condition: restock to inventory
              </label>
            </div>

            <button
              type="submit"
              disabled={isSubmittingReturn}
              className="w-full py-2 bg-afk-surface hover:bg-afk-surfaceLight border border-afk-border text-afk-danger text-xs font-semibold rounded transition shadow flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmittingReturn ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing return...</span>
                </>
              ) : (
                <span>Process Return & Rebalance Stock</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
