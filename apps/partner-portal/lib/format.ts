import { format as dateFnsFormat } from "date-fns";

const BENGALI_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

export function toBengaliDigits(num: number | string): string {
  return String(num).replace(/[0-9]/g, (digit) => BENGALI_DIGITS[parseInt(digit, 10)] || digit);
}

export function formatBdt(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return "৳0.00";
  }
  const numericAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  return `৳${numericAmount.toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatCompactBdt(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return "৳0";
  }
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  const abs = Math.abs(num);
  const sign = num < 0 ? "−" : "";

  if (abs >= 10_000_000) {
    // 1 Crore = 10,000,000 BDT
    return `${sign}৳${(abs / 10_000_000).toFixed(2)} Cr`;
  }
  if (abs >= 100_000) {
    // 1 Lakh = 100,000 BDT
    return `${sign}৳${(abs / 100_000).toFixed(2)} L`;
  }
  if (abs >= 1_000) {
    return `${sign}৳${(abs / 1_000).toFixed(1)}k`;
  }
  return num < 0 ? `${sign}${formatBdt(abs)}` : formatBdt(num);
}

export function formatDate(date: Date | string | null | undefined, fmt = "dd MMM yyyy"): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return dateFnsFormat(d, fmt);
}

export function formatDateTime(date: Date | string | null | undefined): string {
  return formatDate(date, "dd MMM yyyy, hh:mm a");
}

export function formatRelativeSyncTime(date: Date | string | null | undefined): string {
  if (!date) return "Never synced";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "Unknown";
  
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return formatDate(d, "dd MMM, hh:mm a");
}

/** Compact number for chart axes: 950, 12k, 1.2L, 3.4Cr (no currency symbol). */
export function formatAxis(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 10_000_000) return `${sign}${trim(abs / 10_000_000)}Cr`;
  if (abs >= 100_000) return `${sign}${trim(abs / 100_000)}L`;
  if (abs >= 1_000) return `${sign}${trim(abs / 1_000)}k`;
  return `${sign}${Math.round(abs)}`;
}

function trim(n: number): string {
  return n >= 10 ? String(Math.round(n)) : String(Math.round(n * 10) / 10);
}

/** "+12.5%" / "−3%" for period-over-period deltas. */
export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !isFinite(value)) return "—";
  const abs = Math.abs(value);
  const text = abs >= 100 ? Math.round(abs).toString() : abs.toFixed(1).replace(/\.0$/, "");
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${text}%`;
}
