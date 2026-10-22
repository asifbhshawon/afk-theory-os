"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="px-3.5 py-1.5 bg-black hover:bg-gray-800 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition shadow"
    >
      <Printer className="w-3.5 h-3.5" />
      <span>Print / Save as PDF</span>
    </button>
  );
}
