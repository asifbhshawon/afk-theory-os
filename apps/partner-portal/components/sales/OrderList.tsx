"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { ChevronRight, ShoppingBag, Truck, X } from "lucide-react";
import { EmptyState, Pill, orderStatusTone } from "@/components/ui/primitives";
import { formatBdt, formatCompactBdt, formatDate, formatDateTime } from "@/lib/format";
import type { SalesOrderView } from "@/lib/portal-data";

const CHANNEL_LABEL: Record<string, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  WHATSAPP: "WhatsApp",
  WEBSITE: "Website",
  IN_PERSON: "In person",
  MANUAL: "Other",
};

const TIMELINE_LABEL: Record<string, string> = {
  CONFIRMED: "Order placed",
  SHIPPED: "Handed to courier",
  DELIVERED: "Delivered to customer",
  SETTLED: "Courier payout received",
  RETURNED: "Returned",
  CANCELLED: "Cancelled",
};

function paymentNote(o: SalesOrderView): { text: string; tone: string } {
  if (o.status === "CANCELLED") return { text: "Void", tone: "text-afk-subtle" };
  if (o.status === "RETURNED") return { text: "Refunded", tone: "text-afk-danger" };
  if (o.paymentStatus === "PAID") return { text: "Settled", tone: "text-afk-olive-accent" };
  if (o.status === "DELIVERED") return { text: "Awaiting courier payout", tone: "text-afk-gold" };
  return { text: "COD pending", tone: "text-afk-muted" };
}

/** Paged order rows; tapping a row opens the detail drawer. Data arrives already filtered by the server. */
export function OrderList({ orders, emptyHint }: { orders: SalesOrderView[]; emptyHint: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = orders.find((o) => o.id === openId) ?? null;

  if (orders.length === 0) {
    return <EmptyState icon={ShoppingBag} title="No orders match" hint={emptyHint} />;
  }

  return (
    <>
      <ul className="divide-y divide-afk-border/60">
        {orders.map((o) => {
          const st = orderStatusTone(o.status);
          const pay = paymentNote(o);
          return (
            <li key={o.id}>
              <button
                onClick={() => setOpenId(o.id)}
                className="w-full text-left px-5 py-3.5 grid grid-cols-[1fr_auto] md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.9fr)_9rem_1rem] items-center gap-x-4 gap-y-1 hover:bg-afk-surface/60 transition focus-visible:bg-afk-surface/60"
                aria-label={`Open order ${o.orderNumber}`}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-afk-offwhite">{o.orderNumber.replace("AFK-ORD-", "#")}</span>
                    <Pill tone={st.tone}>{st.label}</Pill>
                  </span>
                  <span className="block text-xs text-afk-muted truncate mt-0.5">
                    {o.customerLabel ?? "Customer"} · {o.units} item{o.units === 1 ? "" : "s"} · {formatDate(o.orderDate, "d MMM, h:mm a")}
                  </span>
                </span>

                <span className="text-right md:text-left md:min-w-0">
                  <span className="block text-sm font-mono font-semibold tabular-nums text-afk-offwhite md:hidden">{formatCompactBdt(o.totalAmount)}</span>
                  <span className="hidden md:block text-xs text-afk-secondary truncate">
                    {CHANNEL_LABEL[o.channel] ?? o.channel}
                    {o.cityZone ? ` · ${o.cityZone}` : ""}
                  </span>
                </span>

                <span className="hidden md:block text-xs text-afk-secondary truncate">
                  {o.courierName ? (
                    <span className="inline-flex items-center gap-1">
                      <Truck className="w-3 h-3 text-afk-muted" />
                      {o.courierName}
                    </span>
                  ) : (
                    <span className="text-afk-subtle">—</span>
                  )}
                </span>

                <span className="hidden md:block text-right">
                  <span className="block text-sm font-mono font-semibold tabular-nums text-afk-offwhite">{formatBdt(o.totalAmount)}</span>
                  <span className={clsx("block text-2xs", pay.tone)}>{pay.text}</span>
                </span>

                <ChevronRight className="hidden md:block w-4 h-4 text-afk-muted" />
              </button>
            </li>
          );
        })}
      </ul>
      {open && <OrderDrawer order={open} onClose={() => setOpenId(null)} />}
    </>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className={clsx("flex items-center justify-between py-1.5 text-sm", strong && "border-t border-afk-border mt-1 pt-2.5 font-semibold")}>
      <span className="text-afk-secondary">{label}</span>
      <span className={clsx("font-mono tabular-nums", tone ?? "text-afk-offwhite")}>{value}</span>
    </div>
  );
}

function OrderDrawer({ order: o, onClose }: { order: SalesOrderView; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const st = orderStatusTone(o.status);
  const pay = paymentNote(o);
  const goods = o.subtotal - o.discount;
  const margin = goods > 0 ? Math.round((o.profit / goods) * 1000) / 10 : 0;

  return (
    <div className="no-print fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Order ${o.orderNumber}`}>
      <button className="absolute inset-0 bg-black/70" aria-label="Close order details" onClick={onClose} />
      <aside className="absolute bottom-0 inset-x-0 max-h-[92vh] md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[440px] overflow-y-auto rounded-t-2xl md:rounded-none border-t md:border-t-0 md:border-l border-afk-borderLight bg-afk-card shadow-2xl pb-[env(safe-area-inset-bottom)]">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-afk-border bg-afk-card/95 backdrop-blur px-5 py-4">
          <div>
            <p className="font-mono text-base font-bold text-afk-offwhite">{o.orderNumber}</p>
            <p className="text-xs text-afk-muted mt-0.5">{formatDateTime(o.orderDate)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Pill tone={st.tone}>{st.label}</Pill>
            <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-afk-muted hover:text-afk-offwhite hover:bg-afk-surface">
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="px-5 py-5 space-y-6">
          <section aria-label="Items">
            <h3 className="text-2xs font-semibold uppercase tracking-wider text-afk-subtle mb-2">Items</h3>
            <ul className="divide-y divide-afk-border/60 rounded-lg border border-afk-border bg-afk-surface">
              {o.items.map((i, idx) => (
                <li key={idx} className="flex items-start justify-between gap-3 px-3.5 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm text-afk-offwhite">{i.name}</p>
                    <p className="text-2xs text-afk-muted font-mono">
                      {i.sku} · {i.size}/{i.color}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-mono tabular-nums text-afk-offwhite">{formatBdt(i.total)}</p>
                    <p className="text-2xs text-afk-muted">
                      {i.qty} × {formatBdt(i.unitPrice)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section aria-label="Amounts">
            <h3 className="text-2xs font-semibold uppercase tracking-wider text-afk-subtle mb-1">Amounts</h3>
            <Row label="Items" value={formatBdt(o.subtotal)} />
            {o.discount > 0 && <Row label="Discount" value={`−${formatBdt(o.discount)}`} />}
            {o.deliveryCharge > 0 && <Row label="Delivery charge" value={`+${formatBdt(o.deliveryCharge)}`} />}
            <Row label="Customer pays (COD)" value={formatBdt(o.totalAmount)} strong />
            <p className={clsx("text-right text-2xs -mt-0.5", pay.tone)}>{pay.text}</p>
            <div className="mt-3 rounded-lg border border-afk-border bg-afk-surface px-3.5 py-2.5">
              <Row label="Cost of goods" value={formatBdt(o.cogs)} />
              <Row
                label={`Gross profit${goods > 0 ? ` · ${margin}%` : ""}`}
                value={formatBdt(o.profit)}
                tone={o.profit < 0 ? "text-afk-danger" : "text-afk-success"}
              />
            </div>
          </section>

          <section aria-label="Delivery">
            <h3 className="text-2xs font-semibold uppercase tracking-wider text-afk-subtle mb-2">Delivery</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
              <div>
                <dt className="text-2xs text-afk-muted">Customer</dt>
                <dd className="text-afk-offwhite">{o.customerLabel ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-2xs text-afk-muted">Sold via</dt>
                <dd className="text-afk-offwhite">{CHANNEL_LABEL[o.channel] ?? o.channel}</dd>
              </div>
              <div>
                <dt className="text-2xs text-afk-muted">Zone</dt>
                <dd className="text-afk-offwhite">{o.cityZone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-2xs text-afk-muted">Courier</dt>
                <dd className="text-afk-offwhite">{o.courierName ?? "—"}</dd>
              </div>
              {o.waybillNumber && (
                <div className="col-span-2">
                  <dt className="text-2xs text-afk-muted">Waybill</dt>
                  <dd className="font-mono text-afk-offwhite">{o.waybillNumber}</dd>
                </div>
              )}
            </dl>
          </section>

          <section aria-label="Timeline">
            <h3 className="text-2xs font-semibold uppercase tracking-wider text-afk-subtle mb-3">Timeline</h3>
            <ol className="relative space-y-4 border-l border-afk-border ml-1.5 pl-5">
              {o.timeline.map((t, idx) => {
                const last = idx === o.timeline.length - 1;
                const bad = t.status === "CANCELLED" || t.status === "RETURNED";
                return (
                  <li key={`${t.status}-${idx}`} className="relative">
                    <span
                      className={clsx(
                        "absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full border-2",
                        bad ? "border-afk-danger bg-afk-danger/30" : last ? "border-afk-olive-accent bg-afk-olive-accent" : "border-afk-olive-accent bg-afk-card"
                      )}
                    />
                    <p className="text-sm text-afk-offwhite">{TIMELINE_LABEL[t.status] ?? t.status}</p>
                    <p className="text-2xs text-afk-muted">{formatDateTime(t.at)}</p>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      </aside>
    </div>
  );
}
