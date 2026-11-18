"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import { Banknote, Loader2, Truck } from "lucide-react";
import { settleCourierBatchAction } from "@/app/orders/actions";
import { inputCls, labelCls, primaryBtn } from "./Modal";
import { ageLabel, bdt, isAwaitingPayout, type CourierOption, type Notify, type OrderRow, type PayAccountOption } from "./types";

const NONE = "__none__";

/**
 * Settle a courier's COD payout for many delivered orders at once.
 * Pick the courier, tick the parcels they paid for, adjust COD / fee where the
 * courier's statement differs, choose the account — one balanced journal.
 */
export function CourierPayoutPanel({
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
  const unsettled = useMemo(() => orders.filter(isAwaitingPayout), [orders]);

  const groups = useMemo(() => {
    const m = new Map<string, { key: string; name: string; orders: OrderRow[] }>();
    for (const o of unsettled) {
      const key = o.courierId ?? NONE;
      const g = m.get(key) ?? { key, name: o.courierName ?? "No courier recorded", orders: [] };
      g.orders.push(o);
      m.set(key, g);
    }
    // oldest delivery first inside each group
    for (const g of m.values()) g.orders.sort((a, b) => a.orderDate.localeCompare(b.orderDate));
    return [...m.values()].sort((a, b) => b.orders.length - a.orders.length);
  }, [unsettled]);

  const [courierKey, setCourierKey] = useState<string>("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [cod, setCod] = useState<Record<string, string>>({});
  const [feeOverride, setFeeOverride] = useState<Record<string, string>>({});
  const [batchFee, setBatchFee] = useState("");
  const [accountId, setAccountId] = useState("");
  const [paidBy, setPaidBy] = useState(""); // only for parcels with no courier recorded
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const group = groups.find((g) => g.key === courierKey) ?? null;

  // pick the busiest courier first, and recover if the selected group disappears after a payout
  useEffect(() => {
    if (!groups.length) {
      setCourierKey("");
      return;
    }
    if (!groups.some((g) => g.key === courierKey)) setCourierKey(groups[0].key);
  }, [groups, courierKey]);

  // new courier → tick everything, reset adjustments
  useEffect(() => {
    if (!group) return;
    setSelected(Object.fromEntries(group.orders.map((o) => [o.id, true])));
    setCod({});
    setFeeOverride({});
    setError(null);
  }, [courierKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = (group?.orders ?? []).map((o) => {
    const codNum = cod[o.id] !== undefined && cod[o.id] !== "" ? Number(cod[o.id]) : o.total;
    const feeRaw = feeOverride[o.id] !== undefined && feeOverride[o.id] !== "" ? feeOverride[o.id] : batchFee;
    return { order: o, checked: !!selected[o.id], cod: codNum, fee: Number(feeRaw) || 0 };
  });
  const chosen = rows.filter((r) => r.checked);
  const gross = chosen.reduce((s, r) => s + r.cod, 0);
  const fees = chosen.reduce((s, r) => s + r.fee, 0);
  const net = gross - fees;
  const effectiveCourier = courierKey === NONE ? paidBy : courierKey;

  const blocker =
    chosen.length === 0
      ? "Tick at least one parcel"
      : !effectiveCourier
      ? "Choose which courier paid out"
      : !accountId
      ? "Choose the account the money went into"
      : chosen.some((r) => !(r.cod > 0))
      ? "Every ticked parcel needs a COD amount"
      : chosen.some((r) => r.fee > r.cod)
      ? "A courier fee is higher than its COD amount"
      : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (blocker) {
      setError(blocker);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await settleCourierBatchAction({
        courierId: effectiveCourier,
        paymentAccountId: accountId,
        items: chosen.map((r) => ({ orderId: r.order.id, codAmount: r.cod, courierFee: r.fee })),
        notes,
      });
      if (res.ok) {
        notify({ type: "success", message: res.message });
        setNotes("");
        setBatchFee("");
      } else {
        setError(res.error);
        notify({ type: "error", message: res.error });
      }
    });
  }

  const allChecked = rows.length > 0 && rows.every((r) => r.checked);

  return (
    <form onSubmit={submit} className="bg-afk-card rounded-xl border border-afk-border shadow-sm" aria-label="Courier payout">
      <div className="flex flex-wrap items-center gap-2 px-5 py-3.5 border-b border-afk-border">
        <Banknote className="w-4 h-4 text-afk-olive-accent" />
        <h3 className="text-sm font-semibold text-afk-offwhite">Courier payouts</h3>
        <span className="text-xs text-afk-muted">
          {unsettled.length} parcel{unsettled.length === 1 ? "" : "s"} · {bdt(unsettled.reduce((s, o) => s + o.total, 0))} COD waiting
        </span>
      </div>

      {groups.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-afk-muted">
          Nothing is waiting for a payout — every delivered order has been settled.
        </p>
      ) : (
        <div className="p-5 space-y-4">
          {/* courier chips */}
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Courier">
            {groups.map((g) => (
              <button
                key={g.key}
                type="button"
                role="tab"
                aria-selected={g.key === courierKey}
                onClick={() => setCourierKey(g.key)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition ${
                  g.key === courierKey
                    ? "border-afk-olive/60 bg-afk-olive/25 text-afk-offwhite"
                    : "border-afk-border bg-afk-surface text-afk-secondary hover:text-afk-offwhite"
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span className="font-medium">{g.name}</span>
                <span className="font-mono text-afk-muted">
                  {g.orders.length} · {bdt(g.orders.reduce((s, o) => s + o.total, 0))}
                </span>
              </button>
            ))}
          </div>

          {courierKey === NONE && (
            <div className="max-w-xs">
              <label className={labelCls} htmlFor="pay-paidby">Paid out by</label>
              <select id="pay-paidby" value={paidBy} onChange={(e) => setPaidBy(e.target.value)} className={inputCls}>
                <option value="">Select courier…</option>
                {couriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* parcels */}
          <div className="rounded-lg border border-afk-border overflow-hidden">
            <div className="flex items-center justify-between gap-3 bg-afk-surface px-3.5 py-2 text-xs text-afk-secondary">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={(e) => setSelected(Object.fromEntries(rows.map((r) => [r.order.id, e.target.checked])))}
                  className="accent-[#5A7352] w-4 h-4"
                />
                Select all ({rows.length})
              </label>
              <label className="inline-flex items-center gap-2">
                <span className="text-afk-muted">Fee per parcel ৳</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={batchFee}
                  onChange={(e) => setBatchFee(e.target.value)}
                  placeholder="0"
                  aria-label="Courier fee per parcel"
                  className="w-20 bg-afk-input border border-afk-border rounded px-2 py-1 text-right font-mono text-afk-offwhite focus:outline-none focus:border-afk-olive"
                />
              </label>
            </div>

            <ul className="divide-y divide-afk-border/60 max-h-[340px] overflow-y-auto">
              {rows.map((r) => (
                <li
                  key={r.order.id}
                  className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-3.5 py-2.5 ${r.checked ? "" : "opacity-50"}`}
                >
                  <input
                    type="checkbox"
                    checked={r.checked}
                    onChange={(e) => setSelected((s) => ({ ...s, [r.order.id]: e.target.checked }))}
                    aria-label={`Include ${r.order.orderNumber}`}
                    className="accent-[#5A7352] w-4 h-4"
                  />
                  <div className="flex-1 min-w-[10rem]">
                    <p className="font-mono text-sm font-semibold text-afk-offwhite">{r.order.orderNumber}</p>
                    <p className="text-xs text-afk-muted truncate">
                      {r.order.customerName} · {r.order.waybillNumber ?? "no waybill"} · waiting {ageLabel(new Date(r.order.orderDate).getTime())}
                    </p>
                  </div>
                  <label className="text-2xs text-afk-muted">
                    COD ৳
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={cod[r.order.id] ?? ""}
                      onChange={(e) => setCod((c) => ({ ...c, [r.order.id]: e.target.value }))}
                      placeholder={String(r.order.total)}
                      aria-label={`COD collected for ${r.order.orderNumber}`}
                      className="ml-1.5 w-24 bg-afk-input border border-afk-border rounded px-2 py-1 text-right font-mono text-sm text-afk-offwhite focus:outline-none focus:border-afk-olive"
                    />
                  </label>
                  <label className="text-2xs text-afk-muted">
                    Fee ৳
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={feeOverride[r.order.id] ?? ""}
                      onChange={(e) => setFeeOverride((f) => ({ ...f, [r.order.id]: e.target.value }))}
                      placeholder={batchFee || "0"}
                      aria-label={`Courier fee for ${r.order.orderNumber}`}
                      className="ml-1.5 w-20 bg-afk-input border border-afk-border rounded px-2 py-1 text-right font-mono text-sm text-afk-offwhite focus:outline-none focus:border-afk-olive"
                    />
                  </label>
                </li>
              ))}
            </ul>
          </div>

          {/* deposit + totals */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className={labelCls} htmlFor="pay-account">Deposited into</label>
              <select id="pay-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputCls}>
                <option value="">Select account…</option>
                {payAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="pay-notes">Reference (optional)</label>
              <input
                id="pay-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Steadfast statement 14 Nov"
                className={inputCls}
              />
            </div>
            <dl className="text-xs text-afk-secondary space-y-0.5">
              <div className="flex justify-between gap-6">
                <dt>COD collected ({chosen.length})</dt>
                <dd className="font-mono tabular-nums">{bdt(gross)}</dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt>Courier fees</dt>
                <dd className="font-mono tabular-nums">−{bdt(fees)}</dd>
              </div>
              <div className="flex justify-between gap-6 border-t border-afk-border pt-1 text-sm font-semibold text-afk-offwhite">
                <dt>Lands in account</dt>
                <dd className="font-mono tabular-nums">{bdt(Math.max(0, net))}</dd>
              </div>
            </dl>
          </div>

          {error && (
            <p role="alert" className="text-xs text-afk-danger bg-afk-danger/10 border border-afk-danger/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex items-center justify-end gap-3">
            {blocker && !pending && <span className="text-xs text-afk-muted">{blocker}</span>}
            <button type="submit" disabled={pending || !!blocker} className={primaryBtn}>
              {pending && <Loader2 className="w-4 h-4 animate-spin" />}
              Post payout for {chosen.length} parcel{chosen.length === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
