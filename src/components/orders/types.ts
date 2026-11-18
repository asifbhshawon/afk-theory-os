import type { listRecentOrdersWithItems, listSellableVariants } from "@/server/services/sales";

export type OrderRow = Awaited<ReturnType<typeof listRecentOrdersWithItems>>[number];
export type SellableVariant = Awaited<ReturnType<typeof listSellableVariants>>[number];

export interface CourierOption {
  id: string;
  name: string;
}

export interface PayAccountOption {
  id: string;
  name: string;
  type: string;
}

export interface ToastInput {
  type: "success" | "error";
  message: string;
  link?: { href: string; label: string };
}

export type Notify = (t: ToastInput) => void;

export const bdt = (n: number) =>
  "৳" + n.toLocaleString("en-BD", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const CHANNELS = [
  { value: "FACEBOOK", label: "Facebook" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "WEBSITE", label: "Website" },
  { value: "IN_PERSON", label: "In person" },
  { value: "MANUAL", label: "Other" },
];

export const ZONES = ["Inside Dhaka", "Sub-Dhaka", "Outside Dhaka"];

export const STATUS_STYLE: Record<string, string> = {
  CONFIRMED: "bg-afk-border text-afk-offwhite",
  PACKED: "bg-afk-border text-afk-offwhite",
  SHIPPED: "bg-afk-gold/20 text-afk-gold",
  DELIVERED: "bg-afk-olive-dark text-afk-olive-accent",
  RETURNED: "bg-afk-danger/20 text-afk-danger",
  CANCELLED: "bg-afk-danger/15 text-afk-danger",
};

export const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: "To ship",
  PACKED: "Packed",
  SHIPPED: "With courier",
  DELIVERED: "Delivered",
  RETURNED: "Returned",
  CANCELLED: "Cancelled",
};

export function paymentLabel(o: Pick<OrderRow, "status" | "paymentStatus">): { text: string; cls: string } {
  if (o.status === "CANCELLED") return { text: "Void", cls: "text-afk-subtle" };
  if (o.status === "RETURNED") return { text: "Refunded", cls: "text-afk-danger" };
  if (o.paymentStatus === "PAID") return { text: "Settled", cls: "text-afk-olive-accent" };
  if (o.status === "DELIVERED") return { text: "Awaiting courier payout", cls: "text-afk-gold" };
  return { text: "COD pending", cls: "text-afk-secondary" };
}

/** Delivered but the courier has not paid out yet. */
export const isAwaitingPayout = (o: Pick<OrderRow, "status" | "paymentStatus">) =>
  o.status === "DELIVERED" && o.paymentStatus !== "PAID";

/** When the order last changed state (for "waiting 3 d" ageing). */
export function lastEventAt(o: Pick<OrderRow, "timeline" | "orderDate">): number {
  const last = o.timeline[o.timeline.length - 1];
  return new Date(last ? last.at : o.orderDate).getTime();
}

export function ageLabel(ms: number, now = Date.now()): string {
  const mins = Math.max(0, Math.floor((now - ms) / 60000));
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export type PeriodKey = "all" | "today" | "7" | "30";

export function inPeriod(iso: string, period: PeriodKey, now = new Date()): boolean {
  if (period === "all") return true;
  const t = new Date(iso).getTime();
  if (period === "today") return new Date(iso).toDateString() === now.toDateString();
  return t >= now.getTime() - Number(period) * 86_400_000;
}
