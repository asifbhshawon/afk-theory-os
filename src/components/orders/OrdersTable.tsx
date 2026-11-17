"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Ban, ChevronDown, PackageCheck, Printer, RotateCcw, Search, Truck } from "lucide-react";
import { CancelModal, DeliverModal, ReturnModal, ShipModal } from "./OrderActionModals";
import { bdt, type CourierOption, type Notify, type OrderRow, type PayAccountOption } from "./types";

const TABS = [
  { key: "ALL", label: "All" },
  { key: "CONFIRMED", label: "To ship" },
  { key: "SHIPPED", label: "With courier" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "CLOSED", label: "Cancelled / returned" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const STATUS_STYLE: Record<string, string> = {
  CONFIRMED: "bg-afk-border text-afk-offwhite",
  PACKED: "bg-afk-border text-afk-offwhite",
  SHIPPED: "bg-afk-gold/20 text-afk-gold",
  DELIVERED: "bg-afk-olive-dark text-afk-olive-accent",
  RETURNED: "bg-afk-danger/20 text-afk-danger",
  CANCELLED: "bg-afk-danger/15 text-afk-danger",
};

const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: "To ship",
  PACKED: "Packed",
  SHIPPED: "With courier",
  DELIVERED: "Delivered",
  RETURNED: "Returned",
  CANCELLED: "Cancelled",
};

function paymentLabel(o: OrderRow): { text: string; cls: string } {
  if (o.status === "CANCELLED") return { text: "Void", cls: "text-afk-subtle" };
  if (o.status === "RETURNED") return { text: "Refunded", cls: "text-afk-danger" };
  if (o.paymentStatus === "PAID") return { text: "Settled", cls: "text-afk-olive-accent" };
  if (o.status === "DELIVERED") return { text: "Awaiting courier payout", cls: "text-afk-gold" };
  return { text: "COD pending", cls: "text-afk-secondary" };
}

function inTab(o: OrderRow, tab: TabKey) {
  if (tab === "ALL") return true;
  if (tab === "CONFIRMED") return o.status === "CONFIRMED" || o.status === "PACKED";
  if (tab === "CLOSED") return o.status === "CANCELLED" || o.status === "RETURNED";
  return o.status === tab;
}

type ModalState =
  | { kind: "ship" | "deliver" | "cancel" | "return"; order: OrderRow }
  | null;

export function OrdersTable({
  orders,
  couriers,
  payAccounts,
  notify,
  canWrite,
}: {
  orders: OrderRow[];
  couriers: CourierOption[];
  payAccounts: PayAccountOption[];
  notify: Notify;
  canWrite: boolean;
}) {
  const [tab, setTab] = useState<TabKey>("ALL");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);

  const counts = useMemo(() => {
    const c = {} as Record<TabKey, number>;
    for (const t of TABS) c[t.key] = orders.filter((o) => inTab(o, t.key)).length;
    return c;
  }, [orders]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter(
      (o) =>
        inTab(o, tab) &&
        (!q ||
          `${o.orderNumber} ${o.customerName} ${o.customerPhone} ${o.waybillNumber ?? ""} ${o.items
            .map((i) => i.sku)
            .join(" ")}`
            .toLowerCase()
            .includes(q))
    );
  }, [orders, tab, search]);

  const close = () => setModal(null);

  return (
    <div className="bg-afk-card rounded-xl border border-afk-border shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-5 py-3.5 border-b border-afk-border">
        <div className="flex gap-1 overflow-x-auto -mx-1 px-1" role="tablist" aria-label="Order status">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                tab === t.key
                  ? "bg-afk-olive/25 text-afk-offwhite border border-afk-olive/60"
                  : "text-afk-secondary hover:text-afk-offwhite hover:bg-afk-surface border border-transparent"
              }`}
            >
              {t.label}
              <span className="ml-1.5 font-mono text-afk-muted">{counts[t.key]}</span>
            </button>
          ))}
        </div>
        <div className="relative lg:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-afk-muted pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order, customer, phone, waybill…"
            aria-label="Search orders"
            className="w-full bg-afk-input border border-afk-border rounded-lg pl-9 pr-3 py-2 text-sm text-afk-offwhite placeholder:text-afk-subtle focus:outline-none focus:border-afk-olive"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-afk-muted">
          {orders.length === 0 ? "No orders yet — create your first sale above." : "No orders match this view."}
        </p>
      ) : (
        <ul className="divide-y divide-afk-border/50">
          {visible.map((o) => {
            const pay = paymentLabel(o);
            const isOpen = expanded === o.id;
            return (
              <li key={o.id}>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 hover:bg-afk-surface/30 transition">
                  <button
                    onClick={() => setExpanded(isOpen ? null : o.id)}
                    aria-expanded={isOpen}
                    aria-label={`Toggle details for ${o.orderNumber}`}
                    className="flex items-center gap-3 flex-1 min-w-[14rem] text-left"
                  >
                    <ChevronDown className={`w-4 h-4 shrink-0 text-afk-muted transition ${isOpen ? "rotate-180" : ""}`} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-afk-offwhite">{o.orderNumber}</span>
                        <span className={`px-2 py-0.5 rounded text-2xs font-medium ${STATUS_STYLE[o.status] ?? "bg-afk-border"}`}>
                          {STATUS_LABEL[o.status] ?? o.status}
                        </span>
                      </span>
                      <span className="block text-xs text-afk-secondary truncate">
                        {o.customerName} · {o.customerPhone} · {o.units} item{o.units === 1 ? "" : "s"}
                      </span>
                    </span>
                  </button>

                  <div className="text-right w-28">
                    <p className="font-mono text-sm font-semibold tabular-nums text-afk-offwhite">{bdt(o.total)}</p>
                    <p className={`text-2xs ${pay.cls}`}>{pay.text}</p>
                  </div>

                  <div className="flex items-center gap-1.5 justify-end ml-auto">
                    <Link
                      href={`/print/invoice/${o.id}`}
                      target="_blank"
                      title="Print invoice"
                      aria-label={`Print invoice ${o.orderNumber}`}
                      className="p-2 text-afk-muted hover:text-afk-offwhite hover:bg-afk-surface rounded-lg border border-afk-border transition"
                    >
                      <Printer className="w-4 h-4" />
                    </Link>
                    {canWrite && (o.status === "CONFIRMED" || o.status === "PACKED") && (
                      <button
                        onClick={() => setModal({ kind: "ship", order: o })}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-afk-surface hover:bg-afk-elevated border border-afk-border text-xs font-semibold text-afk-gold transition"
                      >
                        <Truck className="w-3.5 h-3.5" /> Ship
                      </button>
                    )}
                    {canWrite && o.status === "SHIPPED" && (
                      <button
                        onClick={() => setModal({ kind: "deliver", order: o })}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-afk-olive hover:bg-afk-olive-light text-xs font-semibold text-afk-offwhite transition"
                      >
                        <PackageCheck className="w-3.5 h-3.5" /> Delivered
                      </button>
                    )}
                    {canWrite && o.status === "DELIVERED" && (
                      <button
                        onClick={() => setModal({ kind: "return", order: o })}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-afk-surface hover:bg-afk-elevated border border-afk-border text-xs font-medium text-afk-secondary hover:text-afk-offwhite transition"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Return
                      </button>
                    )}
                    {canWrite && (o.status === "CONFIRMED" || o.status === "PACKED" || o.status === "SHIPPED") && (
                      <button
                        onClick={() => setModal({ kind: "cancel", order: o })}
                        title="Cancel order"
                        aria-label={`Cancel ${o.orderNumber}`}
                        className="p-2 text-afk-muted hover:text-afk-danger hover:bg-afk-danger/10 rounded-lg border border-afk-border transition"
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {isOpen && (
                  <div className="px-5 pb-4 pl-12 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="font-semibold text-afk-secondary mb-1.5">Items</p>
                      <ul className="space-y-1">
                        {o.items.map((i, idx) => (
                          <li key={idx} className="flex justify-between gap-3 text-afk-offwhite">
                            <span className="truncate">
                              {i.quantity} × {i.name} <span className="text-afk-muted">({i.size}/{i.color})</span>
                            </span>
                            <span className="font-mono tabular-nums">{bdt(i.total)}</span>
                          </li>
                        ))}
                        {o.discount > 0 && (
                          <li className="flex justify-between text-afk-muted">
                            <span>Discount</span>
                            <span className="font-mono">−{bdt(o.discount)}</span>
                          </li>
                        )}
                        {o.deliveryCharge > 0 && (
                          <li className="flex justify-between text-afk-muted">
                            <span>Delivery</span>
                            <span className="font-mono">+{bdt(o.deliveryCharge)}</span>
                          </li>
                        )}
                        <li className="flex justify-between border-t border-afk-border pt-1 text-afk-secondary">
                          <span>Est. gross profit</span>
                          <span className={`font-mono ${o.profit < 0 ? "text-afk-danger" : ""}`}>{bdt(o.profit)}</span>
                        </li>
                      </ul>
                    </div>
                    <div className="space-y-1 text-afk-secondary">
                      <p className="font-semibold mb-1.5">Delivery</p>
                      <p>{o.shippingAddress}</p>
                      <p className="text-afk-muted">
                        {o.cityZone} · via {o.channel.replace("_", " ").toLowerCase()} ·{" "}
                        {new Date(o.orderDate).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                      </p>
                      {(o.courierName || o.waybillNumber) && (
                        <p>
                          <span className="text-afk-muted">Courier:</span> {o.courierName ?? "—"}{" "}
                          <span className="font-mono">{o.waybillNumber}</span>
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {modal?.kind === "ship" && <ShipModal order={modal.order} couriers={couriers} notify={notify} onClose={close} />}
      {modal?.kind === "deliver" && <DeliverModal order={modal.order} notify={notify} onClose={close} />}
      {modal?.kind === "cancel" && <CancelModal order={modal.order} notify={notify} onClose={close} />}
      {modal?.kind === "return" && (
        <ReturnModal order={modal.order} payAccounts={payAccounts} notify={notify} onClose={close} />
      )}
    </div>
  );
}
