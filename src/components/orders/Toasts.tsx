"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";
import type { ToastInput } from "./types";

interface ToastItem extends ToastInput {
  id: number;
}

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((t: ToastInput) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-3), { ...t, id }]);
  }, []);

  return { toasts, push, dismiss };
}

function ToastCard({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, toast.type === "error" ? 10000 : 6000);
    return () => clearTimeout(timer);
  }, [toast.type, onClose]);

  const isError = toast.type === "error";
  return (
    <div
      role={isError ? "alert" : "status"}
      className={`flex items-start gap-2.5 w-full sm:w-96 rounded-lg border px-3.5 py-3 shadow-xl backdrop-blur ${
        isError
          ? "bg-afk-danger/10 border-afk-danger/40 text-afk-offwhite"
          : "bg-afk-olive-dark border-afk-olive/50 text-afk-offwhite"
      }`}
    >
      {isError ? (
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-afk-danger" />
      ) : (
        <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-afk-olive-accent" />
      )}
      <div className="flex-1 text-sm leading-snug">
        <p>{toast.message}</p>
        {toast.link && (
          <Link
            href={toast.link.href}
            target="_blank"
            className="inline-block mt-1 text-xs font-semibold text-afk-olive-accent hover:underline"
          >
            {toast.link.label}
          </Link>
        )}
      </div>
      <button onClick={onClose} aria-label="Dismiss" className="text-afk-muted hover:text-afk-offwhite">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function ToastStack({ toasts, dismiss }: { toasts: ToastItem[]; dismiss: (id: number) => void }) {
  return (
    <div className="no-print fixed z-[60] bottom-4 right-4 left-4 sm:left-auto flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto w-full sm:w-auto">
          <ToastCard toast={t} onClose={() => dismiss(t.id)} />
        </div>
      ))}
    </div>
  );
}
