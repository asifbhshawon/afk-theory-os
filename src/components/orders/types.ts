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
