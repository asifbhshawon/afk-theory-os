"use client";

import React, { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Loader2, Minus, Plus, Search, ShoppingBag, Trash2, UserCheck } from "lucide-react";
import { createOrderAction } from "@/app/orders/actions";
import { inputCls, labelCls, primaryBtn } from "./Modal";
import { CHANNELS, ZONES, bdt, type Notify, type OrderRow, type SellableVariant } from "./types";

interface CartLine {
  variantId: string;
  qty: number;
  price: number;
}

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function readZoneCharge(zone: string): string {
  try {
    return localStorage.getItem(`afk_delivery_${zone}`) ?? "";
  } catch {
    return "";
  }
}

export function QuickSaleForm({
  variants,
  orders,
  notify,
}: {
  variants: SellableVariant[];
  orders: OrderRow[];
  notify: Notify;
}) {
  const [pending, startTransition] = useTransition();
  const idemKey = useRef(newKey());

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [zone, setZone] = useState(ZONES[0]);
  const [channel, setChannel] = useState("FACEBOOK");
  const [delivery, setDelivery] = useState("");
  const [discount, setDiscount] = useState("");
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [allowBackorder, setAllowBackorder] = useState(false);

  // "N" jumps to a fresh sale from anywhere on the page (ignored while typing or in a dialog)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      const phone = document.getElementById("qs-phone");
      phone?.scrollIntoView({ block: "center", behavior: "smooth" });
      phone?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const variantById = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants]);

  // Returning customers, derived from recent orders (newest first wins)
  const knownCustomers = useMemo(() => {
    const m = new Map<string, { name: string; address: string; zone: string; orders: number }>();
    for (const o of orders) {
      const key = o.customerPhone.replace(/\s+/g, "");
      const prev = m.get(key);
      if (prev) prev.orders += 1;
      else m.set(key, { name: o.customerName, address: o.shippingAddress, zone: o.cityZone, orders: 1 });
    }
    return m;
  }, [orders]);
  const returning = knownCustomers.get(phone.replace(/\s+/g, ""));

  function onPhoneChange(value: string) {
    setPhone(value);
    const hit = knownCustomers.get(value.replace(/\s+/g, ""));
    if (hit) {
      if (!name.trim()) setName(hit.name);
      if (!address.trim()) setAddress(hit.address);
      if (ZONES.includes(hit.zone)) changeZone(hit.zone);
    }
  }

  function changeZone(z: string) {
    setZone(z);
    const saved = readZoneCharge(z);
    if (saved !== "") setDelivery(saved);
  }

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? variants.filter((v) =>
          `${v.sku} ${v.productName} ${v.size} ${v.color}`.toLowerCase().includes(q)
        )
      : variants;
    return list.slice(0, 8);
  }, [variants, query]);

  // units that can be sold without a pre-order: counted stock, or unlimited for "in stock without a count" items
  const maxQty = (v: SellableVariant) => (v.uncounted || allowBackorder ? 9999 : Math.max(1, v.available));
  const shortBy = (l: CartLine) => {
    const v = variantById.get(l.variantId);
    return !v || v.uncounted ? 0 : Math.max(0, l.qty - v.available);
  };

  function addVariant(v: SellableVariant) {
    setCart((prev) => {
      const existing = prev.find((l) => l.variantId === v.id);
      if (existing) {
        return prev.map((l) =>
          l.variantId === v.id ? { ...l, qty: Math.min(maxQty(v), l.qty + 1) } : l
        );
      }
      return [...prev, { variantId: v.id, qty: 1, price: v.price }];
    });
    setQuery("");
    setPickerOpen(false);
    setFormError(null);
  }

  function updateLine(variantId: string, patch: Partial<CartLine>) {
    setCart((prev) => prev.map((l) => (l.variantId === variantId ? { ...l, ...patch } : l)));
  }

  const subtotal = cart.reduce((s, l) => s + l.qty * l.price, 0);
  const cost = cart.reduce((s, l) => s + l.qty * (variantById.get(l.variantId)?.cost ?? 0), 0);
  const deliveryNum = Number(delivery) || 0;
  const discountNum = Number(discount) || 0;
  const total = Math.max(0, subtotal + deliveryNum - discountNum);
  const profit = subtotal - discountNum - cost;

  const needsBackorder = cart.some((l) => shortBy(l) > 0);
  const missing =
    cart.length === 0
      ? "Add at least one item"
      : !name.trim() || !phone.trim() || !address.trim()
      ? "Customer name, phone and address are required"
      : needsBackorder && !allowBackorder
      ? "Some items are not in stock — tick “Allow pre-order” below to sell them anyway"
      : null;

  function reset() {
    setName("");
    setPhone("");
    setAddress("");
    setDiscount("");
    setNotes("");
    setCart([]);
    setAllowBackorder(false);
    setFormError(null);
    idemKey.current = newKey();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (missing) {
      setFormError(missing);
      return;
    }
    setFormError(null);
    startTransition(async () => {
      const res = await createOrderAction({
        customerName: name,
        customerPhone: phone,
        shippingAddress: address,
        cityZone: zone,
        channel,
        lines: cart.map((l) => ({ variantId: l.variantId, quantity: l.qty, unitPrice: l.price })),
        deliveryCharge: deliveryNum,
        discount: discountNum,
        notes,
        allowBackorder: needsBackorder && allowBackorder,
        idempotencyKey: idemKey.current,
      });
      if (res.ok) {
        try {
          localStorage.setItem(`afk_delivery_${zone}`, String(deliveryNum));
        } catch {
          /* ignore */
        }
        notify({
          type: "success",
          message: res.message,
          link: res.data ? { href: `/print/invoice/${res.data.orderId}`, label: "Print invoice" } : undefined,
        });
        reset();
      } else {
        setFormError(res.error);
        notify({ type: "error", message: res.error });
      }
    });
  }

  return (
    <form
      id="new-order"
      onSubmit={submit}
      className="bg-afk-card rounded-xl border border-afk-border shadow-sm scroll-mt-24"
    >
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-afk-border">
        <ShoppingBag className="w-4 h-4 text-afk-olive-accent" />
        <h3 className="text-sm font-semibold text-afk-offwhite whitespace-nowrap">New Sale</h3>
        <span className="hidden sm:inline text-xs text-afk-muted">Reserves stock instantly · cash on delivery</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-0">
        {/* Left: customer */}
        <div className="lg:col-span-2 p-5 space-y-3 lg:border-r border-afk-border">
          <div>
            <label className={labelCls} htmlFor="qs-phone">Customer phone</label>
            <input
              id="qs-phone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value)}
              placeholder="01711223344"
              className={`${inputCls} font-mono`}
            />
            {returning && (
              <p className="mt-1 flex items-center gap-1 text-xs text-afk-olive-accent">
                <UserCheck className="w-3 h-3" /> Returning customer · {returning.orders} previous order
                {returning.orders > 1 ? "s" : ""}
              </p>
            )}
          </div>
          <div>
            <label className={labelCls} htmlFor="qs-name">Customer name</label>
            <input
              id="qs-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Tanvir Ahmed"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="qs-address">Delivery address</label>
            <textarea
              id="qs-address"
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="House, road, area, city"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="qs-zone">Delivery zone</label>
              <select id="qs-zone" value={zone} onChange={(e) => changeZone(e.target.value)} className={inputCls}>
                {ZONES.map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="qs-channel">Sold via</label>
              <select id="qs-channel" value={channel} onChange={(e) => setChannel(e.target.value)} className={inputCls}>
                {CHANNELS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Right: items */}
        <div className="lg:col-span-3 p-5 space-y-3">
          <div className="relative">
            <label className={labelCls} htmlFor="qs-search">Add item</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-afk-muted pointer-events-none" />
              <input
                id="qs-search"
                value={query}
                autoComplete="off"
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPickerOpen(true);
                }}
                onFocus={() => setPickerOpen(true)}
                onBlur={() => setTimeout(() => setPickerOpen(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const first = matches.find((v) => v.uncounted || v.available > 0) ?? matches[0];
                    if (first) addVariant(first);
                  }
                }}
                placeholder="Search by name, SKU, size or colour…"
                className={`${inputCls} pl-9`}
              />
            </div>
            {pickerOpen && (
              <ul className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto bg-afk-elevated border border-afk-borderLight rounded-lg shadow-2xl divide-y divide-afk-border/60">
                {matches.length === 0 && (
                  <li className="px-3 py-3 text-xs text-afk-muted">No matching products.</li>
                )}
                {matches.map((v) => {
                  const out = v.available <= 0 && !v.uncounted;
                  return (
                    <li key={v.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => addVariant(v)}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-afk-surfaceLight"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm text-afk-offwhite truncate">{v.productName}</span>
                          <span className="block text-xs text-afk-muted font-mono truncate">
                            {v.sku} · {v.size} / {v.color}
                          </span>
                        </span>
                        <span className="text-right shrink-0">
                          <span className="block text-sm font-mono text-afk-offwhite">{bdt(v.price)}</span>
                          <span
                            className={`block text-xs ${
                              out ? "text-afk-warning" : v.uncounted || v.available > 3 ? "text-afk-olive-accent" : "text-afk-warning"
                            }`}
                          >
                            {out ? "Out of stock · pre-order" : v.uncounted ? "In stock" : `${v.available} in stock`}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Cart */}
          <div className="rounded-lg border border-afk-border overflow-hidden">
            {cart.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-afk-muted">
                No items yet — search above to add products. Prices fill in automatically.
              </p>
            ) : (
              <ul className="divide-y divide-afk-border/60">
                {cart.map((l) => {
                  const v = variantById.get(l.variantId);
                  if (!v) return null;
                  const short = shortBy(l);
                  return (
                    <li key={l.variantId} className="px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                      <div className="flex-1 min-w-[10rem]">
                        <p className="text-sm text-afk-offwhite leading-tight">{v.productName}</p>
                        <p className="text-xs text-afk-muted font-mono">
                          {v.sku} · {v.size}/{v.color} ·{" "}
                          <span className={short > 0 ? (allowBackorder ? "text-afk-warning" : "text-afk-danger") : ""}>
                            {v.uncounted ? "in stock" : short > 0 ? `${v.available} in stock · ${short} pre-order` : `${v.available} available`}
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center rounded-lg border border-afk-border bg-afk-input">
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          onClick={() => updateLine(l.variantId, { qty: Math.max(1, l.qty - 1) })}
                          className="p-2 text-afk-secondary hover:text-afk-offwhite"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm font-mono tabular-nums">{l.qty}</span>
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          onClick={() => updateLine(l.variantId, { qty: Math.min(maxQty(v), l.qty + 1) })}
                          className="p-2 text-afk-secondary hover:text-afk-offwhite"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="w-24">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          aria-label="Unit price"
                          value={l.price}
                          onChange={(e) => updateLine(l.variantId, { price: Number(e.target.value) })}
                          className={`${inputCls} font-mono text-right py-1.5`}
                        />
                      </div>
                      <div className="w-20 text-right text-sm font-mono font-semibold tabular-nums text-afk-offwhite">
                        {bdt(l.qty * l.price)}
                      </div>
                      <button
                        type="button"
                        aria-label="Remove item"
                        onClick={() => setCart((prev) => prev.filter((x) => x.variantId !== l.variantId))}
                        className="p-1.5 text-afk-muted hover:text-afk-danger"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls} htmlFor="qs-delivery">Delivery charge (৳)</label>
              <input
                id="qs-delivery"
                type="number"
                min="0"
                value={delivery}
                onChange={(e) => setDelivery(e.target.value)}
                placeholder="0"
                className={`${inputCls} font-mono`}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="qs-discount">Discount (৳)</label>
              <input
                id="qs-discount"
                type="number"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0"
                className={`${inputCls} font-mono`}
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls} htmlFor="qs-notes">Note (optional)</label>
              <input
                id="qs-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. call before delivery"
                className={inputCls}
              />
            </div>
          </div>

          {needsBackorder && (
            <label className="flex items-start gap-2.5 rounded-lg border border-afk-warning/40 bg-afk-warning/10 px-3.5 py-3 text-xs text-afk-offwhite cursor-pointer">
              <input
                type="checkbox"
                checked={allowBackorder}
                onChange={(e) => setAllowBackorder(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[#E59E27]"
              />
              <span>
                <span className="font-semibold">Allow pre-order / backorder</span>
                <span className="block text-afk-secondary mt-0.5">
                  The missing units are sold without reserving stock (cost falls back to the product cost price). Receive the
                  inventory before shipping.
                </span>
              </span>
            </label>
          )}

          {/* Totals + submit */}
          <div className="flex flex-wrap items-end justify-between gap-4 pt-1">
            <dl className="text-xs text-afk-secondary space-y-0.5">
              <div className="flex gap-6 justify-between">
                <dt>Items</dt>
                <dd className="font-mono tabular-nums">{bdt(subtotal)}</dd>
              </div>
              {deliveryNum > 0 && (
                <div className="flex gap-6 justify-between">
                  <dt>Delivery</dt>
                  <dd className="font-mono tabular-nums">+{bdt(deliveryNum)}</dd>
                </div>
              )}
              {discountNum > 0 && (
                <div className="flex gap-6 justify-between">
                  <dt>Discount</dt>
                  <dd className="font-mono tabular-nums">−{bdt(discountNum)}</dd>
                </div>
              )}
              <div className="flex gap-6 justify-between text-sm text-afk-offwhite font-semibold pt-1 border-t border-afk-border">
                <dt>COD to collect</dt>
                <dd className="font-mono tabular-nums">{bdt(total)}</dd>
              </div>
              {cart.length > 0 && (
                <div className="flex gap-6 justify-between text-afk-muted">
                  <dt>Est. profit</dt>
                  <dd className={`font-mono tabular-nums ${profit < 0 ? "text-afk-danger" : ""}`}>{bdt(profit)}</dd>
                </div>
              )}
            </dl>
            <div className="flex flex-col items-end gap-1.5 w-full sm:w-auto">
              {formError && (
                <p role="alert" className="text-xs text-afk-danger max-w-xs text-right">
                  {formError}
                </p>
              )}
              <button type="submit" disabled={pending || !!missing} className={`${primaryBtn} w-full sm:w-auto`}>
                {pending && <Loader2 className="w-4 h-4 animate-spin" />}
                {pending ? "Saving…" : "Confirm & reserve stock"}
              </button>
              {missing && !pending && <p className="text-xs text-afk-muted">{missing}</p>}
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
