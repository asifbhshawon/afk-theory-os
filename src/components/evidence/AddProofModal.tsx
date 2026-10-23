"use client";

import React from "react";
import { X, Paperclip } from "lucide-react";
import { EvidenceUploader } from "./EvidenceUploader";
import { EvidenceCategory } from "@/types/evidence";

interface AddProofModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: string;
  entityId: string;
  referenceId?: string;
  title?: string;
  module?: string;
  defaultCategory?: EvidenceCategory;
  onSuccess?: (uploadedDocs: any[]) => void;
}

export function AddProofModal({
  isOpen,
  onClose,
  entityType,
  entityId,
  referenceId,
  title = "Attach Supporting Evidence",
  module = "FINANCE",
  defaultCategory = "PAYMENT_PROOF",
  onSuccess,
}: AddProofModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-afk-charcoal border border-afk-border rounded-xl shadow-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-afk-border">
          <div className="flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-afk-olive" />
            <div>
              <h3 className="text-sm font-semibold text-afk-offwhite">{title}</h3>
              {referenceId && (
                <p className="text-[10px] text-afk-muted font-mono mt-0.5">
                  Ref: {referenceId}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-afk-muted hover:text-afk-offwhite rounded hover:bg-afk-surface"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <EvidenceUploader
          mode="standalone"
          entityType={entityType}
          entityId={entityId}
          referenceId={referenceId}
          module={module}
          defaultCategory={defaultCategory}
          onUploadComplete={(docs) => {
            if (onSuccess) onSuccess(docs);
            onClose();
          }}
        />

        <div className="pt-2 border-t border-afk-border/60 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-afk-muted hover:text-afk-offwhite bg-afk-surface hover:bg-afk-border/60 rounded border border-afk-border transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
