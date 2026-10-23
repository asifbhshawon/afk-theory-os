"use client";

import React, { useState } from "react";
import { Receipt, Paperclip, ChevronDown, ChevronUp } from "lucide-react";
import { EvidenceUploader } from "./EvidenceUploader";
import { EvidenceGallery } from "./EvidenceGallery";
import { ViewerDocument } from "./EvidenceViewer";

interface FinanceEvidenceSectionProps {
  initialDocuments: ViewerDocument[];
  canVerify?: boolean;
}

export function FinanceEvidenceSection({
  initialDocuments,
  canVerify = false,
}: FinanceEvidenceSectionProps) {
  const [documents, setDocuments] = useState<ViewerDocument[]>(initialDocuments);
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="bg-afk-charcoal p-5 rounded-lg border border-afk-border space-y-4">
      <div
        className="flex items-center justify-between cursor-pointer select-none pb-2 border-b border-afk-border/60"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-emerald-400" />
          <div>
            <h3 className="text-sm font-semibold text-afk-offwhite">
              Voucher & Expense Supporting Evidence
            </h3>
            <p className="text-[11px] text-afk-muted">
              Paste screenshots (Ctrl+V) or upload bKash/Nagad slips, invoices, and bank deposit challans.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-afk-muted bg-afk-surface px-2 py-0.5 rounded border border-afk-border">
            {documents.length} attached
          </span>
          <button type="button" className="text-afk-muted hover:text-afk-offwhite p-1">
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="space-y-4">
          <EvidenceUploader
            module="FINANCE"
            defaultCategory="PAYMENT_PROOF"
            onUploadComplete={(newDocs) => {
              setDocuments((prev) => [...newDocs, ...prev]);
            }}
          />

          <EvidenceGallery
            documents={documents}
            canVerify={canVerify}
            emptyMessage="No finance transaction receipts or slips attached yet."
          />
        </div>
      )}
    </div>
  );
}
