"use client";

import React, { useState, useTransition } from "react";
import { Loader2, Truck } from "lucide-react";
import { settleCourierAction } from "@/app/orders/actions";
import { inputCls, labelCls, primaryBtn } from "./Modal";
import { bdt, type CourierOption, type Notify, type OrderRow, type PayAccountOption } from "./types";

export function CourierSettlementForm({
  orders,
  couriers,
  payAccounts,
  notify,
}: {
  orders: OrderRow[];
  couriers: CourierOption[];
  payAccounts: PayAccountOption[];
  notify: Notify;
}) {
  const unsettled = orders.filter((o) => o.status === "DELIVERED" && o.paymentStatus !== "PAID");

  const [orderId, setOrderId] = useState("");
  const [courierId, setCourierId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [cod, setCod] = useState("");
  const [fee, setFee] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function pickOrder(id: string) {
    setOrderId(id);
    const o = unsettled.find((x) => x.id === id);
    if (o) {
      setCod(String(o.total));
      if (o.courierId) setCourierId(o.courierId);
    }
  }

  const codNum = Number(cod) || 0;
  const feeNum = Number(fee) || 0;
  const net = codNum - feeNum;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await settleCourierAction({
        courierId,
        paymentAccountId: accountId,
        orderId,
        codAmount: codNum,
        courierFee: feeNum,
      });
      if (res.ok) {
        notify({ type: "success", message: res.message });
        setOrderId("");
        setCod("");
        setFee("");
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={submit} className="bg-afk-card rounded-xl border border-afk-border shadow-sm">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-afk-border">
        <Truck className="w-4 h-4 text-afk-olive-accent" />
        <h3 className="text-sm font-semibold text-afk-offwhite">Courier payout (COD settlement)</h3>
        <span className="ml-auto text-xs text-afk-muted">{unsettled.length} awaiting payout</span>
      </div>
      <div className="p-5 space-y-3">
        <div>
          <label className={labelCls} htmlFor="set-order">Delivered order</label>
          <select id="set-order" value={orderId} onChange={(e) => pickOrder(e.target.value)} className={inputCls} required>
            <option value="">{unsettled.length ? "Select order…" : "Nothing waiting for payout"}</option>
            {unsettled.map((o) => (
              <option key={o.id} value={o.id}>
                {o.orderNumber} · {o.customerName} · {bdt(o.total)}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="set-courier">Courier</label>
            <select id="set-courier" value={courierId} onChange={(e) => setCourierId(e.target.value)} className={inputCls} required>
              <option value="">Select courier…</option>
              {couriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="set-account">Deposited into</label>
            <select id="set-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputCls} required>
              <option value="">Select account…</option>
              {payAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="set-cod">COD collected (৳)</label>
            <input id="set-cod" type="number" min="0" step="0.01" value={cod} onChange={(e) => setCod(e.target.value)} className={`${inputCls} font-mono`} required />
          </div>
          <div>
            <label className={labelCls} htmlFor="set-fee">Courier fee deducted (৳)</label>
            <input id="set-fee" type="number" min="0" step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="0" className={`${inputCls} font-mono`} />
          </div>
        </div>
        {orderId && (
          <p className="text-xs text-afk-secondary">
            Bank receives <span className="font-mono font-semibold text-afk-offwhite">{bdt(Math.max(0, net))}</span> after the courier fee.
          </p>
        )}
        {error && (
          <p role="alert" className="text-xs text-afk-danger bg-afk-danger/10 border border-afk-danger/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <button type="submit" disabled={pending || !orderId} className={`${primaryBtn} w-full`}>
          {pending && <Loader2 className="w-4 h-4 animate-spin" />}
          Post settlement
        </button>
      </div>
    </form>
  );
}
