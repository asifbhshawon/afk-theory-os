"use client";

import React from "react";
import { AlertCircle, Truck } from "lucide-react";
import { ageLabel, bdt, isAwaitingPayout, lastEventAt, type OrderRow } from "./types";

interface Column {
  key: string;
  title: string;
  hint: string;
  accent: string;
  orders: OrderRow[];
  /** age (hours) after which a card is flagged as stuck */
  staleHours?: number;
}

function buildColumns(orders: OrderRow[]): Column[] {
  const by = (pred: (o: OrderRow) => boolean) => orders.filter(pred);
  return [
    {
      key: "toship",
      title: "To ship",
      hint: "Stock reserved",
      accent: "border-t-afk-borderStrong",
      staleHours: 48,
      orders: by((o) => o.status === "CONFIRMED" || o.status === "PACKED"),
    },
    {
      key: "shipped",
      title: "With courier",
      hint: "On the way",
      accent: "border-t-afk-gold",
      staleHours: 24 * 5,
      orders: by((o) => o.status === "SHIPPED"),
    },
    {
      key: "payout",
      title: "Awaiting payout",
      hint: "Delivered, COD not received",
      accent: "border-t-sky-400",
      staleHours: 24 * 10,
      orders: by(isAwaitingPayout),
    },
    {
      key: "settled",
      title: "Settled",
      hint: "Money in the account",
      accent: "border-t-afk-olive-light",
      orders: by((o) => o.status === "DELIVERED" && o.paymentStatus === "PAID"),
    },
    {
      key: "closed",
      title: "Cancelled / returned",
      hint: "No revenue",
      accent: "border-t-afk-danger",
      orders: by((o) => o.status === "CANCELLED" || o.status === "RETURNED"),
    },
  ];
}

/** Kanban-style overview: where every order stands, oldest (most urgent) first. */
export function OrderBoard({ orders, onOpen }: { orders: OrderRow[]; onOpen: (o: OrderRow) => void }) {
  const now = Date.now();
  const columns = buildColumns(orders);

  return (
    <div className="flex gap-3 overflow-x-auto px-5 pb-5 pt-1 snap-x" role="list" aria-label="Order board">
      {columns.map((col) => {
        const total = col.orders.reduce((s, o) => s + o.total, 0);
        // oldest activity first — those need attention soonest (closed: newest first)
        const sorted = [...col.orders].sort((a, b) =>
          col.key === "closed" || col.key === "settled" ? lastEventAt(b) - lastEventAt(a) : lastEventAt(a) - lastEventAt(b)
        );
        return (
          <section
            key={col.key}
            role="listitem"
            aria-label={col.title}
            className={`snap-start shrink-0 w-[260px] rounded-xl border border-afk-border border-t-2 ${col.accent} bg-afk-surface/60`}
          >
            <header className="px-3.5 pt-3 pb-2">
              <div className="flex items-baseline justify-between">
                <h4 className="text-sm font-semibold text-afk-offwhite">{col.title}</h4>
                <span className="text-xs font-mono text-afk-muted">{col.orders.length}</span>
              </div>
              <p className="text-2xs text-afk-muted">
                {col.hint} · <span className="font-mono">{bdt(total)}</span>
              </p>
            </header>

            <ul className="px-2.5 pb-2.5 space-y-2 max-h-[520px] overflow-y-auto">
              {sorted.length === 0 && <li className="px-2 py-6 text-center text-xs text-afk-subtle">Nothing here</li>}
              {sorted.map((o) => {
                const ageMs = lastEventAt(o);
                const stale = col.staleHours ? now - ageMs > col.staleHours * 3_600_000 : false;
                return (
                  <li key={o.id}>
                    <button
                      onClick={() => onOpen(o)}
                      aria-label={`Open order ${o.orderNumber}`}
                      className="w-full text-left rounded-lg border border-afk-border bg-afk-card hover:border-afk-olive/60 hover:bg-afk-elevated transition px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-afk-offwhite">{o.orderNumber.replace("AFK-ORD-", "#")}</span>
                        <span
                          className={`inline-flex items-center gap-1 text-2xs font-mono ${stale ? "text-afk-warning" : "text-afk-muted"}`}
                          title={stale ? "No movement for a while" : "Time since last update"}
                        >
                          {stale && <AlertCircle className="w-3 h-3" />}
                          {ageLabel(ageMs, now)}
                        </span>
                      </div>
                      <p className="text-xs text-afk-secondary truncate mt-0.5">{o.customerName}</p>
                      <div className="flex items-center justify-between gap-2 mt-1.5">
                        <span className="text-2xs text-afk-muted truncate">
                          {o.units} item{o.units === 1 ? "" : "s"}
                          {o.courierName && (
                            <>
                              {" · "}
                              <Truck className="inline w-3 h-3 -mt-0.5" /> {o.courierName}
                            </>
                          )}
                        </span>
                        <span className="text-xs font-mono font-semibold tabular-nums text-afk-offwhite">{bdt(o.total)}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
