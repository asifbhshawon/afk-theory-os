"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Check, Copy, PackageCheck, Paperclip, Phone, Printer, RotateCcw, Truck, X } from "lucide-react";
import { AddProofModal } from "@/components/evidence/AddProofModal";
import { EvidenceGallery } from "@/components/evidence/EvidenceGallery";
import type { ViewerDocument } from "@/components/evidence/EvidenceViewer";
import { ghostBtn, primaryBtn } from "./Modal";
import { useDialogFocus } from "./useDialogFocus";
import { STATUS_LABEL, STATUS_STYLE, bdt, paymentLabel, type OrderRow } from "./types";

export type DrawerAction = "ship" | "deliver" | "cancel" | "return";

const TIMELINE_LABEL: Record<string, string> = {
  CONFIRMED: "Order placed",
  SHIPPED: "Handed to courier",
  DELIVERED: "Delivered to customer",
  SETTLED: "Courier payout received",
  RETURNED: "Returned by customer",
  CANCELLED: "Cancelled",
};

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard unavailable (insecure context) */
        }
      }}
      aria-label={`Copy ${label}`}
      title={`Copy ${label}`}
      className="p-1 rounded text-afk-muted hover:text-afk-offwhite hover:bg-afk-surface transition"
    >
      {done ? <Check className="w-3.5 h-3.5 text-afk-success" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className={`flex items-center justify-between py-1.5 text-sm ${strong ? "border-t border-afk-border mt-1 pt-2.5 font-semibold" : ""}`}>
      <span className="text-afk-secondary">{label}</span>
      <span className={`font-mono tabular-nums ${tone ?? "text-afk-offwhite"}`}>{value}</span>
    </div>
  );
}

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-2xs font-semibold uppercase tracking-wider text-afk-subtle">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

const fmt = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

/** Slide-over with everything about one order and its next actions. */
export function OrderDrawer({
  order: o,
  documents,
  canWrite,
  onAction,
  onClose,
}: {
  order: OrderRow;
  documents: ViewerDocument[];
  canWrite: boolean;
  onAction: (kind: DrawerAction) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [proofOpen, setProofOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // let a modal on top handle its own Escape
      if (e.key === "Escape" && !proofOpen && document.querySelectorAll('[role="dialog"]').length <= 1) onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, proofOpen]);

  const pay = paymentLabel(o);
  const goods = o.subtotal - o.discount;
  const margin = goods > 0 ? Math.round((o.profit / goods) * 1000) / 10 : 0;
  const canShip = o.status === "CONFIRMED" || o.status === "PACKED";
  const canCancel = canShip || o.status === "SHIPPED";

  return (
    <div ref={dialogRef} tabIndex={-1} className="no-print fixed inset-0 z-40 outline-none" role="dialog" aria-modal="true" aria-label={`Order ${o.orderNumber}`}>
      <button className="absolute inset-0 bg-black/70" aria-label="Close order panel" onClick={onClose} />
      <aside className="absolute bottom-0 inset-x-0 max-h-[92vh] md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[480px] overflow-y-auto rounded-t-2xl md:rounded-none border-t md:border-t-0 md:border-l border-afk-borderLight bg-afk-card shadow-2xl">
        <header className="sticky top-0 z-10 border-b border-afk-border bg-afk-card/95 backdrop-blur px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-base font-bold text-afk-offwhite">{o.orderNumber}</p>
              <p className="text-xs text-afk-muted mt-0.5">{fmt(o.orderDate)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-2xs font-medium ${STATUS_STYLE[o.status] ?? "bg-afk-border"}`}>
                {STATUS_LABEL[o.status] ?? o.status}
              </span>
              <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-afk-muted hover:text-afk-offwhite hover:bg-afk-surface">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            {canWrite && canShip && (
              <button onClick={() => onAction("ship")} className={primaryBtn}>
                <Truck className="w-4 h-4" /> Ship
              </button>
            )}
            {canWrite && o.status === "SHIPPED" && (
              <button onClick={() => onAction("deliver")} className={primaryBtn}>
                <PackageCheck className="w-4 h-4" /> Mark delivered
              </button>
            )}
            {canWrite && o.status === "DELIVERED" && (
              <button onClick={() => onAction("return")} className={ghostBtn}>
                <RotateCcw className="w-4 h-4" /> Return
              </button>
            )}
            {canWrite && canCancel && (
              <button onClick={() => onAction("cancel")} className={`${ghostBtn} hover:text-afk-danger`}>
                <Ban className="w-4 h-4" /> Cancel
              </button>
            )}
            <Link href={`/print/invoice/${o.id}`} target="_blank" className={ghostBtn}>
              <Printer className="w-4 h-4" /> Invoice
            </Link>
          </div>
        </header>

        <div className="px-5 py-5 space-y-6">
          <Section title="Customer">
            <div className="rounded-lg border border-afk-border bg-afk-surface px-3.5 py-3 space-y-2 text-sm">
              <p className="font-medium text-afk-offwhite">{o.customerName}</p>
              <div className="flex items-center justify-between gap-2">
                <a href={`tel:${o.customerPhone}`} className="inline-flex items-center gap-1.5 font-mono text-afk-secondary hover:text-afk-offwhite">
                  <Phone className="w-3.5 h-3.5" />
                  {o.customerPhone}
                </a>
                <CopyButton value={o.customerPhone} label="phone number" />
              </div>
              <div className="flex items-start justify-between gap-2">
                <p className="text-afk-secondary">
                  {o.shippingAddress}
                  <span className="block text-xs text-afk-muted">
                    {o.cityZone} · via {o.channel.replace("_", " ").toLowerCase()}
                  </span>
                </p>
                <CopyButton value={`${o.customerName}, ${o.customerPhone}, ${o.shippingAddress}`} label="delivery details" />
              </div>
            </div>
            {o.notes && <p className="mt-2 text-xs text-afk-secondary bg-afk-gold/10 border border-afk-gold/30 rounded-lg px-3 py-2">Note: {o.notes}</p>}
          </Section>

          <Section title="Items">
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
                    <p className="text-sm font-mono tabular-nums text-afk-offwhite">{bdt(i.total)}</p>
                    <p className="text-2xs text-afk-muted">
                      {i.quantity} × {bdt(i.unitPrice)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Money">
            <Row label="Items" value={bdt(o.subtotal)} />
            {o.discount > 0 && <Row label="Discount" value={`−${bdt(o.discount)}`} />}
            {o.deliveryCharge > 0 && <Row label="Delivery charge" value={`+${bdt(o.deliveryCharge)}`} />}
            <Row label="Customer pays (COD)" value={bdt(o.total)} strong />
            <p className={`text-right text-2xs -mt-0.5 ${pay.cls}`}>{pay.text}</p>
            <div className="mt-3 rounded-lg border border-afk-border bg-afk-surface px-3.5 py-2.5">
              <Row label="Cost of goods" value={bdt(o.cogs)} />
              <Row
                label={`Gross profit${goods > 0 ? ` · ${margin}%` : ""}`}
                value={bdt(o.profit)}
                tone={o.profit < 0 ? "text-afk-danger" : "text-afk-success"}
              />
            </div>
          </Section>

          <Section title="Courier">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-2xs text-afk-muted">Courier</dt>
                <dd className="text-afk-offwhite">{o.courierName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-2xs text-afk-muted">Waybill</dt>
                <dd className="font-mono text-afk-offwhite flex items-center gap-1">
                  {o.waybillNumber ?? "—"}
                  {o.waybillNumber && <CopyButton value={o.waybillNumber} label="waybill" />}
                </dd>
              </div>
            </dl>
          </Section>

          <Section title="Timeline">
            <ol className="relative space-y-4 border-l border-afk-border ml-1.5 pl-5">
              {o.timeline.map((t, idx) => {
                const last = idx === o.timeline.length - 1;
                const bad = t.status === "CANCELLED" || t.status === "RETURNED";
                return (
                  <li key={`${t.status}-${idx}`} className="relative">
                    <span
                      className={`absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full border-2 ${
                        bad
                          ? "border-afk-danger bg-afk-danger/30"
                          : last
                          ? "border-afk-olive-accent bg-afk-olive-accent"
                          : "border-afk-olive-accent bg-afk-card"
                      }`}
                    />
                    <p className="text-sm text-afk-offwhite">{TIMELINE_LABEL[t.status] ?? t.status}</p>
                    <p className="text-2xs text-afk-muted">{fmt(t.at)}</p>
                  </li>
                );
              })}
            </ol>
          </Section>

          {o.journals.length > 0 && (
            <Section title="Ledger entries">
              <ul className="space-y-1.5">
                {o.journals.map((j) => (
                  <li key={j.number} className="rounded-lg border border-afk-border bg-afk-surface px-3 py-2">
                    <p className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-mono font-semibold text-afk-offwhite">{j.number}</span>
                      <span className="text-afk-muted">{fmt(j.date)}</span>
                    </p>
                    <p className="text-2xs text-afk-secondary mt-0.5">{j.description}</p>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section
            title={`Proof & documents (${documents.length})`}
            right={
              canWrite && (
                <button
                  onClick={() => setProofOpen(true)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-afk-olive-accent hover:text-afk-offwhite"
                >
                  <Paperclip className="w-3.5 h-3.5" /> Add proof
                </button>
              )
            }
          >
            <EvidenceGallery documents={documents} showTitle={false} emptyMessage="No courier slips or delivery photos attached yet." />
          </Section>
        </div>
      </aside>

      <AddProofModal
        isOpen={proofOpen}
        onClose={() => setProofOpen(false)}
        entityType="SALES_ORDER"
        entityId={o.id}
        referenceId={o.orderNumber}
        title={`Attach proof to ${o.orderNumber}`}
        module="SALES"
        defaultCategory="DELIVERY_PROOF"
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
