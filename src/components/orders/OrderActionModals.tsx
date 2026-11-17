"use client";

import React, { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  cancelOrderAction,
  deliverOrderAction,
  returnOrderAction,
  shipOrderAction,
} from "@/app/orders/actions";
import { Modal, ghostBtn, inputCls, labelCls, primaryBtn } from "./Modal";
import { bdt, type CourierOption, type Notify, type OrderRow, type PayAccountOption } from "./types";

type Result = { ok: true; message: string } | { ok: false; error: string };

function useRun(notify: Notify, onDone: () => void) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<Result>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        notify({ type: "success", message: res.message });
        onDone();
      } else {
        setError(res.error);
      }
    });
  };
  return { pending, error, run };
}

function Footer({
  pending,
  error,
  label,
  onClose,
  danger,
  disabled,
}: {
  pending: boolean;
  error: string | null;
  label: string;
  onClose: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="pt-1 space-y-3">
      {error && (
        <p role="alert" className="text-xs text-afk-danger bg-afk-danger/10 border border-afk-danger/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={ghostBtn} disabled={pending}>
          Back
        </button>
        <button
          type="submit"
          disabled={pending || disabled}
          className={
            danger
              ? "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-afk-danger/90 hover:bg-afk-danger disabled:opacity-50 text-white text-sm font-semibold transition"
              : primaryBtn
          }
        >
          {pending && <Loader2 className="w-4 h-4 animate-spin" />}
          {label}
        </button>
      </div>
    </div>
  );
}

export function ShipModal({
  order,
  couriers,
  notify,
  onClose,
}: {
  order: OrderRow;
  couriers: CourierOption[];
  notify: Notify;
  onClose: () => void;
}) {
  const [courierId, setCourierId] = useState(couriers.length === 1 ? couriers[0].id : "");
  const [waybill, setWaybill] = useState("");
  const { pending, error, run } = useRun(notify, onClose);

  return (
    <Modal title={`Ship ${order.orderNumber}`} subtitle={`${order.customerName} · COD ${bdt(order.total)}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => shipOrderAction({ orderId: order.id, courierId, waybillNumber: waybill }));
        }}
      >
        {couriers.length === 0 && (
          <p className="text-xs text-afk-warning bg-afk-warning/10 border border-afk-warning/30 rounded-lg px-3 py-2">
            No courier contacts exist yet. Add a contact of type COURIER first.
          </p>
        )}
        <div>
          <label className={labelCls} htmlFor="ship-courier">Courier</label>
          <select id="ship-courier" value={courierId} onChange={(e) => setCourierId(e.target.value)} className={inputCls} required>
            <option value="">Select courier…</option>
            {couriers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="ship-waybill">Waybill / tracking number</label>
          <input
            id="ship-waybill"
            value={waybill}
            onChange={(e) => setWaybill(e.target.value)}
            className={`${inputCls} font-mono`}
            placeholder="e.g. STD-4839201"
            required
            autoFocus
          />
        </div>
        <p className="text-xs text-afk-muted">Stock moves to Courier In-Transit. Revenue is recorded only when the order is delivered.</p>
        <Footer pending={pending} error={error} label="Mark as shipped" onClose={onClose} />
      </form>
    </Modal>
  );
}

export function DeliverModal({
  order,
  notify,
  onClose,
}: {
  order: OrderRow;
  notify: Notify;
  onClose: () => void;
}) {
  const { pending, error, run } = useRun(notify, onClose);
  return (
    <Modal title={`Confirm delivery · ${order.orderNumber}`} subtitle={order.customerName} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => deliverOrderAction({ orderId: order.id }));
        }}
      >
        <dl className="text-sm space-y-1.5 bg-afk-surface rounded-lg border border-afk-border p-3">
          <div className="flex justify-between">
            <dt className="text-afk-secondary">Sales revenue</dt>
            <dd className="font-mono">{bdt(order.subtotal - order.discount)}</dd>
          </div>
          {order.deliveryCharge > 0 && (
            <div className="flex justify-between">
              <dt className="text-afk-secondary">Delivery income</dt>
              <dd className="font-mono">{bdt(order.deliveryCharge)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-afk-border pt-1.5 font-semibold">
            <dt>COD receivable from courier</dt>
            <dd className="font-mono">{bdt(order.total)}</dd>
          </div>
        </dl>
        <p className="text-xs text-afk-muted">
          Posts the revenue and cost-of-goods journals and removes the units from stock. It can only be reversed
          through a return.
        </p>
        <Footer pending={pending} error={error} label="Confirm delivered" onClose={onClose} />
      </form>
    </Modal>
  );
}

const CANCEL_REASONS = ["Customer cancelled", "Customer unreachable", "Wrong item / size", "Duplicate order", "Courier returned parcel"];

export function CancelModal({
  order,
  notify,
  onClose,
}: {
  order: OrderRow;
  notify: Notify;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const { pending, error, run } = useRun(notify, onClose);
  return (
    <Modal title={`Cancel ${order.orderNumber}`} subtitle={`${order.customerName} · ${order.units} unit(s)`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => cancelOrderAction({ orderId: order.id, reason }));
        }}
      >
        <div>
          <label className={labelCls} htmlFor="cancel-reason">Reason</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {CANCEL_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`px-2.5 py-1 rounded-full text-xs border transition ${
                  reason === r
                    ? "bg-afk-olive/30 border-afk-olive text-afk-offwhite"
                    : "bg-afk-surface border-afk-border text-afk-secondary hover:text-afk-offwhite"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <input
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={inputCls}
            placeholder="Why is this order being cancelled?"
            required
          />
        </div>
        <p className="text-xs text-afk-muted">
          {order.status === "SHIPPED"
            ? "The parcel is with the courier — its stock is brought back to the main warehouse."
            : "The reserved stock is released immediately and can be sold again."}{" "}
          No revenue was booked, so no journal is needed.
        </p>
        <Footer pending={pending} error={error} label="Cancel order" onClose={onClose} danger />
      </form>
    </Modal>
  );
}

export function ReturnModal({
  order,
  payAccounts,
  notify,
  onClose,
}: {
  order: OrderRow;
  payAccounts: PayAccountOption[];
  notify: Notify;
  onClose: () => void;
}) {
  const [refund, setRefund] = useState(String(order.total));
  const [restock, setRestock] = useState("true");
  const [account, setAccount] = useState("");
  const [reason, setReason] = useState("");
  const { pending, error, run } = useRun(notify, onClose);

  return (
    <Modal title={`Return ${order.orderNumber}`} subtitle={`${order.customerName} · order total ${bdt(order.total)}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(() =>
            returnOrderAction({
              orderId: order.id,
              reason,
              refundAmount: Number(refund),
              isRestockable: restock === "true",
              paymentAccountId: account || undefined,
            })
          );
        }}
      >
        <ul className="text-xs text-afk-secondary bg-afk-surface rounded-lg border border-afk-border p-3 space-y-1">
          {order.items.map((i, idx) => (
            <li key={idx} className="flex justify-between gap-3">
              <span className="truncate">
                {i.quantity} × {i.name} ({i.size}/{i.color})
              </span>
              <span className="font-mono">{bdt(i.total)}</span>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="ret-refund">Refund (৳)</label>
            <input
              id="ret-refund"
              type="number"
              min="0"
              max={order.total}
              step="0.01"
              value={refund}
              onChange={(e) => setRefund(e.target.value)}
              className={`${inputCls} font-mono`}
              required
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="ret-account">Refunded from</label>
            <select id="ret-account" value={account} onChange={(e) => setAccount(e.target.value)} className={inputCls}>
              <option value="">Not paid out yet</option>
              {payAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls} htmlFor="ret-cond">Item condition</label>
          <select id="ret-cond" value={restock} onChange={(e) => setRestock(e.target.value)} className={inputCls}>
            <option value="true">Restockable — back to finished goods</option>
            <option value="false">Defective — send to damage bin</option>
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="ret-reason">Reason</label>
          <input
            id="ret-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={inputCls}
            placeholder="e.g. size exchange, defective print"
            required
          />
        </div>
        <Footer pending={pending} error={error} label="Process return" onClose={onClose} />
      </form>
    </Modal>
  );
}
