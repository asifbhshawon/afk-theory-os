"use client";

import React, { useEffect, useRef } from "react";
import { useDialogFocus } from "./useDialogFocus";
import { X } from "lucide-react";

export function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="no-print fixed inset-0 z-50 outline-none flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full sm:max-w-md bg-afk-card border border-afk-border rounded-t-2xl sm:rounded-xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-afk-border">
          <div>
            <h3 className="text-base font-semibold text-afk-offwhite">{title}</h3>
            {subtitle && <p className="text-xs text-afk-muted mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="text-afk-muted hover:text-afk-offwhite p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export const inputCls =
  "w-full bg-afk-input border border-afk-border rounded-lg px-3 py-2 text-sm text-afk-offwhite placeholder:text-afk-subtle focus:outline-none focus:border-afk-olive focus:ring-1 focus:ring-afk-olive/40";
export const labelCls = "block text-xs text-afk-secondary mb-1 font-medium";
export const primaryBtn =
  "inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-afk-olive hover:bg-afk-olive-light disabled:opacity-50 disabled:cursor-not-allowed text-afk-offwhite text-sm font-semibold transition";
export const ghostBtn =
  "inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-afk-surface hover:bg-afk-elevated border border-afk-border text-afk-offwhite text-sm font-medium transition disabled:opacity-50";
