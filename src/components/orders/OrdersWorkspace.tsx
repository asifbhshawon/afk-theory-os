"use client";

import React from "react";
import { QuickSaleForm } from "./QuickSaleForm";
import { OrdersTable } from "./OrdersTable";
import { CourierPayoutPanel } from "./CourierPayoutPanel";
import type { ViewerDocument } from "@/components/evidence/EvidenceViewer";
import { ToastStack, useToasts } from "./Toasts";
import {
  bdt,
  type CourierOption,
  type OrderRow,
  type PayAccountOption,
  type SellableVariant,
} from "./types";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-afk-card rounded-xl border border-afk-border px-4 py-3">
      <p className="text-xs text-afk-secondary">{label}</p>
      <p className="text-xl font-bold font-mono tabular-nums text-afk-offwhite mt-0.5">{value}</p>
      {hint && <p className="text-2xs text-afk-muted mt-0.5">{hint}</p>}
    </div>
  );
}

export function OrdersWorkspace({
  orders,
  evidence,
  variants,
  couriers,
  payAccounts,
  canWrite,
}: {
  orders: OrderRow[];
  evidence: Record<string, ViewerDocument[]>;
  variants: SellableVariant[];
  couriers: CourierOption[];
  payAccounts: PayAccountOption[];
  canWrite: boolean;
}) {
  const { toasts, push, dismiss } = useToasts();

  const today = new Date().toDateString();
  const todays = orders.filter(
    (o) => new Date(o.orderDate).toDateString() === today && o.status !== "CANCELLED"
  );
  const toShip = orders.filter((o) => o.status === "CONFIRMED" || o.status === "PACKED").length;
  const withCourier = orders.filter((o) => o.status === "SHIPPED");
  const awaitingPayout = orders.filter((o) => o.status === "DELIVERED" && o.paymentStatus !== "PAID");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          label="Booked today"
          value={bdt(todays.reduce((s, o) => s + o.total, 0))}
          hint={`${todays.length} order${todays.length === 1 ? "" : "s"}`}
        />
        <Stat label="To ship" value={String(toShip)} hint="confirmed, stock reserved" />
        <Stat
          label="With couriers"
          value={String(withCourier.length)}
          hint={`${bdt(withCourier.reduce((s, o) => s + o.total, 0))} COD in transit`}
        />
        <Stat
          label="Awaiting payout"
          value={bdt(awaitingPayout.reduce((s, o) => s + o.total, 0))}
          hint={`${awaitingPayout.length} delivered, not settled`}
        />
      </div>

      <p className="hidden md:flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-afk-muted" aria-label="Keyboard shortcuts">
        {[
          ["N", "new sale"],
          ["/", "search orders"],
          ["B", "board view"],
          ["L", "list view"],
          ["Esc", "close panel"],
        ].map(([key, what]) => (
          <span key={key} className="inline-flex items-center gap-1.5">
            <kbd className="rounded border border-afk-border bg-afk-surface px-1.5 py-0.5 font-mono text-afk-secondary">{key}</kbd>
            {what}
          </span>
        ))}
      </p>

      {canWrite ? (
        <QuickSaleForm variants={variants} orders={orders} notify={push} />
      ) : (
        <p className="text-xs text-afk-muted bg-afk-card border border-afk-border rounded-xl px-5 py-3">
          You have view-only access to sales. Ask an admin or sales operator to create orders.
        </p>
      )}

      <OrdersTable orders={orders} evidence={evidence} couriers={couriers} payAccounts={payAccounts} notify={push} canWrite={canWrite} />

      {canWrite && (
        <CourierPayoutPanel orders={orders} couriers={couriers} payAccounts={payAccounts} notify={push} />
      )}

      <ToastStack toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
