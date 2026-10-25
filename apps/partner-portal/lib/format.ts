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

  if (abs >= 10_000_000) {
    // 1 Crore = 10,000,000 BDT
    return `৳${(num / 10_000_000).toFixed(2)} Cr`;
  }
  if (abs >= 100_000) {
    // 1 Lakh = 100,000 BDT
    return `৳${(num / 100_000).toFixed(2)} L`;
  }
  if (abs >= 1_000) {
    return `৳${(num / 1_000).toFixed(1)}k`;
  }
  return formatBdt(num);
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
