"use client";

import React, { useState } from "react";
import { RotateCcw, X, AlertTriangle, Loader2 } from "lucide-react";

interface ReverseTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: {
    id: string;
    entryNumber: string;
    description: string;
    amount?: number;
    entryType?: string;
  } | null;
  onSuccess: (reversal: any) => void;
}

export function ReverseTransactionModal({
  isOpen,
  onClose,
  transaction,
  onSuccess,
}: ReverseTransactionModalProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !transaction) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/finance/reverse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journalEntryId: transaction.id,
          reason: reason.trim() || "Manual operational reversal",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to reverse transaction");
      }

      onSuccess(data.reversal);
      onClose();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-afk-charcoal border border-afk-border rounded-xl shadow-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-afk-border">
          <div className="flex items-center gap-2 text-amber-400">
            <RotateCcw className="w-4 h-4" />
            <h3 className="text-sm font-semibold text-afk-offwhite">Reverse Transaction</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-afk-muted hover:text-afk-offwhite p-1 rounded hover:bg-afk-surface"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs space-y-1.5 text-afk-offwhite">
          <div className="flex justify-between items-center">
            <span className="text-afk-muted font-medium">Entry Number:</span>
            <span className="font-mono font-bold text-amber-400">{transaction.entryNumber}</span>
          </div>
          {transaction.entryType && (
            <div className="flex justify-between items-center">
              <span className="text-afk-muted font-medium">Type:</span>
              <span className="font-mono text-afk-offwhite text-[11px]">{transaction.entryType}</span>
            </div>
          )}
          {transaction.amount !== undefined && (
            <div className="flex justify-between items-center">
              <span className="text-afk-muted font-medium">Amount:</span>
              <span className="font-mono font-bold text-afk-offwhite">
                ৳{transaction.amount.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
          <div className="pt-1 border-t border-amber-500/20 text-afk-muted text-[11px]">
            {transaction.description}
          </div>
        </div>

        <p className="text-xs text-afk-muted">
          Reversing this transaction will post an equal and opposite double-entry journal entry, cancelling out its financial impact on ledger balances while preserving an audit trail.
        </p>

        {error && (
          <div className="p-2.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-afk-muted mb-1">
              Reason for Reversal *
            </label>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Accidental duplicate entry / wrong amount"
              className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-xs text-afk-offwhite focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3 py-1.5 rounded text-xs text-afk-muted hover:text-afk-offwhite bg-afk-surface hover:bg-afk-border border border-afk-border transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded text-xs font-semibold text-black bg-amber-400 hover:bg-amber-300 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Reversing...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Confirm Reversal</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
