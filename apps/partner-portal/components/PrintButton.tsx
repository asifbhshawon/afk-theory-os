"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-afk-surface hover:bg-afk-elevated border border-afk-border text-afk-offwhite text-xs font-semibold shadow-sm transition"
    >
      <Printer className="w-3.5 h-3.5 text-afk-gold" />
      <span>Print / PDF Statement</span>
    </button>
  );
}
