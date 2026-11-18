"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Ban, ChevronRight, KanbanSquare, List, PackageCheck, Printer, RotateCcw, Search, Truck } from "lucide-react";
import type { ViewerDocument } from "@/components/evidence/EvidenceViewer";
import { CancelModal, DeliverModal, ReturnModal, ShipModal } from "./OrderActionModals";
import { OrderDrawer, type DrawerAction } from "./OrderDrawer";
import { OrderBoard } from "./OrderBoard";
import {
  CHANNELS,
  STATUS_LABEL,
  STATUS_STYLE,
  bdt,
  inPeriod,
  isAwaitingPayout,
  paymentLabel,
  type CourierOption,
  type Notify,
  type OrderRow,
  type PayAccountOption,
  type PeriodKey,
} from "./types";

const TABS = [
  { key: "ALL", label: "All" },
  { key: "TOSHIP", label: "To ship" },
  { key: "SHIPPED", label: "With courier" },
  { key: "PAYOUT", label: "Awaiting payout" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "CLOSED", label: "Cancelled / returned" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function inTab(o: OrderRow, tab: TabKey) {
  switch (tab) {
    case "ALL":
      return true;
    case "TOSHIP":
      return o.status === "CONFIRMED" || o.status === "PACKED";
    case "SHIPPED":
      return o.status === "SHIPPED";
    case "PAYOUT":
      return isAwaitingPayout(o);
    case "DELIVERED":
      return o.status === "DELIVERED";
    case "CLOSED":
      return o.status === "CANCELLED" || o.status === "RETURNED";
  }
}

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "7", label: "Last 7 days" },
  { key: "30", label: "Last 30 days" },
];

type ModalState = { kind: DrawerAction; order: OrderRow } | null;

const selectCls =
  "bg-afk-input border border-afk-border rounded-lg px-2.5 py-2 text-xs text-afk-offwhite focus:outline-none focus:border-afk-olive";

export function OrdersTable({
  orders,
  evidence,
  couriers,
  payAccounts,
  notify,
  canWrite,
}: {
  orders: OrderRow[];
  evidence: Record<string, ViewerDocument[]>;
  couriers: CourierOption[];
  payAccounts: PayAccountOption[];
  notify: Notify;
  canWrite: boolean;
}) {
  const [view, setView] = useState<"list" | "board">("list");
  const [tab, setTab] = useState<TabKey>("ALL");
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("ALL");
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // remember the preferred view
  useEffect(() => {
    try {
      const saved = localStorage.getItem("afk_orders_view");
      if (saved === "board" || saved === "list") setView(saved);
    } catch {
      /* ignore */
    }
  }, []);
  const changeView = (v: "list" | "board") => {
    setView(v);
    try {
      localStorage.setItem("afk_orders_view", v);
    } catch {
      /* ignore */
    }
  };

  // keyboard: "/" search, "B" board, "L" list (ignored while typing or when a dialog is open)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      } else if (e.key.toLowerCase() === "b") changeView("board");
      else if (e.key.toLowerCase() === "l") changeView("list");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // search + channel + period apply to both views; the status tabs only to the list
  const base = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter(
      (o) =>
        (channel === "ALL" || o.channel === channel) &&
        inPeriod(o.orderDate, period) &&
        (!q ||
          `${o.orderNumber} ${o.customerName} ${o.customerPhone} ${o.waybillNumber ?? ""} ${o.courierName ?? ""} ${o.items
            .map((i) => `${i.sku} ${i.name}`)
            .join(" ")}`
            .toLowerCase()
            .includes(q))
    );
  }, [orders, search, channel, period]);

  const counts = useMemo(() => {
    const c = {} as Record<TabKey, number>;
    for (const t of TABS) c[t.key] = base.filter((o) => inTab(o, t.key)).length;
    return c;
  }, [base]);

  const visible = useMemo(() => base.filter((o) => inTab(o, tab)), [base, tab]);
  const open = orders.find((o) => o.id === openId) ?? null; // stays fresh after an action refreshes props
  const filtersActive = channel !== "ALL" || period !== "all" || search.trim() !== "";

  const closeModal = () => setModal(null);

  return (
    <div className="bg-afk-card rounded-xl border border-afk-border shadow-sm">
      {/* toolbar */}
      <div className="px-5 py-3.5 border-b border-afk-border space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-afk-offwhite">Orders</h3>
            <div className="inline-flex rounded-lg border border-afk-border bg-afk-surface p-0.5" role="group" aria-label="View">
              {(
                [
                  ["list", "List", List],
                  ["board", "Board", KanbanSquare],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  onClick={() => changeView(key)}
                  aria-pressed={view === key}
                  title={`${label} view (${key === "list" ? "L" : "B"})`}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition ${
                    view === key ? "bg-afk-olive text-afk-offwhite" : "text-afk-secondary hover:text-afk-offwhite"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[12rem] lg:w-64 lg:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-afk-muted pointer-events-none" />
              <input
                id="orders-search"
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search  ( / )"
                aria-label="Search orders"
                className="w-full bg-afk-input border border-afk-border rounded-lg pl-9 pr-3 py-2 text-sm text-afk-offwhite placeholder:text-afk-subtle focus:outline-none focus:border-afk-olive"
              />
            </div>
            <select value={channel} onChange={(e) => setChannel(e.target.value)} className={selectCls} aria-label="Channel">
              <option value="ALL">All channels</option>
              {CHANNELS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <select value={period} onChange={(e) => setPeriod(e.target.value as PeriodKey)} className={selectCls} aria-label="Period">
              {PERIODS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
            {filtersActive && (
              <button
                onClick={() => {
                  setSearch("");
                  setChannel("ALL");
                  setPeriod("all");
                }}
                className="text-xs text-afk-muted hover:text-afk-offwhite underline underline-offset-2"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {view === "list" && (
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
        )}
      </div>

      {/* body */}
      {orders.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-afk-muted">No orders yet — create your first sale above.</p>
      ) : view === "board" ? (
        <div className="pt-4">
          <OrderBoard orders={base} onOpen={(o) => setOpenId(o.id)} />
        </div>
      ) : visible.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-afk-muted">No orders match this view.</p>
      ) : (
        <ul className="divide-y divide-afk-border/50">
          {visible.map((o) => {
            const pay = paymentLabel(o);
            return (
              <li key={o.id}>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 hover:bg-afk-surface/30 transition">
                  <button
                    onClick={() => setOpenId(o.id)}
                    aria-label={`Open order ${o.orderNumber}`}
                    className="flex items-center gap-3 flex-1 min-w-[14rem] text-left"
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-afk-offwhite">{o.orderNumber}</span>
                        <span className={`px-2 py-0.5 rounded text-2xs font-medium ${STATUS_STYLE[o.status] ?? "bg-afk-border"}`}>
                          {STATUS_LABEL[o.status] ?? o.status}
                        </span>
                      </span>
                      <span className="block text-xs text-afk-secondary truncate">
                        {o.customerName} · {o.customerPhone} · {o.units} item{o.units === 1 ? "" : "s"}
                        {o.courierName ? ` · ${o.courierName}` : ""}
                      </span>
                    </span>
                  </button>

                  <div className="flex w-full items-center justify-between gap-3 sm:ml-auto sm:w-auto">
                  <div className="text-left sm:w-28 sm:text-right">
                    <p className="font-mono text-sm font-semibold tabular-nums text-afk-offwhite">{bdt(o.total)}</p>
                    <p className={`text-2xs ${pay.cls}`}>{pay.text}</p>
                  </div>

                  <div className="flex items-center gap-1.5 justify-end">
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
                    <button
                      onClick={() => setOpenId(o.id)}
                      aria-label={`Details for ${o.orderNumber}`}
                      className="p-2 text-afk-muted hover:text-afk-offwhite rounded-lg"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {open && (
        <OrderDrawer
          order={open}
          documents={evidence[open.id] ?? []}
          canWrite={canWrite}
          onAction={(kind) => setModal({ kind, order: open })}
          onClose={() => setOpenId(null)}
        />
      )}

      {modal?.kind === "ship" && <ShipModal order={modal.order} couriers={couriers} notify={notify} onClose={closeModal} />}
      {modal?.kind === "deliver" && <DeliverModal order={modal.order} notify={notify} onClose={closeModal} />}
      {modal?.kind === "cancel" && <CancelModal order={modal.order} notify={notify} onClose={closeModal} />}
      {modal?.kind === "return" && (
        <ReturnModal order={modal.order} payAccounts={payAccounts} notify={notify} onClose={closeModal} />
      )}
    </div>
  );
}
