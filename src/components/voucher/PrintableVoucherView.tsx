"use client";

import React, { useState } from "react";
import { PrintButton } from "@/components/PrintButton";
import { EvidenceViewer, ViewerDocument } from "@/components/evidence/EvidenceViewer";
import { AddProofModal } from "@/components/evidence/AddProofModal";
import { Paperclip, Eye, ExternalLink, PlusCircle, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

interface PrintableVoucherViewProps {
  entry: {
    id: string;
    entryNumber: string;
    date: Date | string;
    description: string;
    reference?: string | null;
  };
  lines: Array<{
    id: string;
    debit: string;
    credit: string;
    memo?: string | null;
    accountCode: string;
    accountName: string;
  }>;
  totalDebit: number;
  totalCredit: number;
  initialEvidence: ViewerDocument[];
  canManage?: boolean;
}

export function PrintableVoucherView({
  entry,
  lines,
  totalDebit,
  totalCredit,
  initialEvidence,
  canManage = true,
}: PrintableVoucherViewProps) {
  const router = useRouter();
  const [evidenceList, setEvidenceList] = useState<ViewerDocument[]>(initialEvidence);

  // Print settings
  const [includePrintAppendix, setIncludePrintAppendix] = useState(false);

  // Lightbox
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [selectedDocIndex, setSelectedDocIndex] = useState(0);

  // Add proof modal
  const [isAddProofOpen, setIsAddProofOpen] = useState(false);

  const openDoc = (index: number) => {
    setSelectedDocIndex(index);
    setIsViewerOpen(true);
  };

  return (
    <div>
      {/* Top action bar (hidden on print) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 font-medium">Official A4 Voucher Preview</span>
          {canManage && (
            <button
              type="button"
              onClick={() => setIsAddProofOpen(true)}
              className="px-2.5 py-1 text-xs font-semibold text-gray-800 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded flex items-center gap-1.5 transition cursor-pointer"
            >
              <Paperclip className="w-3.5 h-3.5 text-black" />
              <span>+ Attach Missing Proof</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 text-xs text-gray-600 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={includePrintAppendix}
              onChange={(e) => setIncludePrintAppendix(e.target.checked)}
              className="rounded border-gray-300 text-black focus:ring-black"
            />
            <span>Include full-size evidence pages in printout</span>
          </label>
          <PrintButton />
        </div>
      </div>

      {/* Official Letterhead */}
      <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-black tracking-widest uppercase">AFK THEORY</h1>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-600 mt-0.5">
            Apparel Manufacturing & Retail Operations
          </p>
          <p className="text-xs text-gray-500">Dhaka, Bangladesh · Currency: BDT (৳)</p>
        </div>
        <div className="text-right">
          <span className="inline-block px-3 py-1 bg-black text-white text-xs font-bold uppercase tracking-wider">
            PAYMENT / JOURNAL VOUCHER
          </span>
          <p className="text-xs font-mono font-bold mt-2">Voucher #: {entry.entryNumber}</p>
          <p className="text-xs text-gray-600 font-mono">
            Date:{" "}
            {new Date(entry.date).toLocaleDateString("en-BD", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Description & Reference */}
      <div className="grid grid-cols-2 gap-4 mb-6 text-xs bg-gray-50 p-3 rounded border border-gray-200">
        <div>
          <span className="font-bold text-gray-700">Description / Narration:</span>
          <p className="mt-0.5 font-medium">{entry.description}</p>
        </div>
        <div>
          <span className="font-bold text-gray-700">Source Reference / Doc:</span>
          <p className="mt-0.5 font-mono">{entry.reference || "None"}</p>
        </div>
      </div>

      {/* Accounting Breakdown Table */}
      <table className="w-full text-xs border-collapse mb-8">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-2 font-bold">Code</th>
            <th className="py-2 font-bold">Account Title</th>
            <th className="py-2 font-bold">Particulars / Memo</th>
            <th className="py-2 font-bold text-right">Debit (৳)</th>
            <th className="py-2 font-bold text-right">Credit (৳)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 font-mono">
          {lines.map((l) => (
            <tr key={l.id}>
              <td className="py-2.5 font-bold">{l.accountCode}</td>
              <td className="py-2.5 font-sans font-medium">{l.accountName}</td>
              <td className="py-2.5 text-gray-600 font-sans">{l.memo || "—"}</td>
              <td className="py-2.5 text-right font-bold">
                {Number(l.debit) > 0
                  ? Number(l.debit).toLocaleString("en-BD", { minimumFractionDigits: 2 })
                  : "—"}
              </td>
              <td className="py-2.5 text-right font-bold">
                {Number(l.credit) > 0
                  ? Number(l.credit).toLocaleString("en-BD", { minimumFractionDigits: 2 })
                  : "—"}
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-black font-bold text-sm">
            <td colSpan={3} className="py-2.5 font-sans">
              TOTAL BDT (৳)
            </td>
            <td className="py-2.5 text-right">
              ৳{totalDebit.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
            </td>
            <td className="py-2.5 text-right">
              ৳{totalCredit.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Supporting Evidence Appendix Summary */}
      <div className="mb-8 p-3.5 rounded border border-gray-300 bg-gray-50 text-xs">
        <div className="flex items-center justify-between border-b border-gray-300 pb-2 mb-2 font-bold">
          <span className="uppercase tracking-wider">Supporting Proof & Evidence Appendix</span>
          <span className="font-mono text-[11px] bg-black text-white px-2 py-0.5 rounded">
            Attached Documents: {evidenceList.length}
          </span>
        </div>

        {evidenceList.length > 0 ? (
          <div className="space-y-2">
            {evidenceList.map((ev, index) => (
              <div
                key={ev.id}
                className="flex items-center justify-between text-[11px] border-b border-gray-200 pb-2 last:border-0 last:pb-0"
              >
                <div className="flex items-center gap-2.5">
                  {ev.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ev.thumbnailUrl}
                      alt="Thumbnail"
                      onClick={() => openDoc(index)}
                      className="w-8 h-8 rounded object-cover border border-gray-300 cursor-pointer hover:opacity-80"
                      title="Click to preview"
                    />
                  )}
                  <div>
                    <button
                      type="button"
                      onClick={() => openDoc(index)}
                      className="font-semibold text-black hover:underline cursor-pointer text-left"
                    >
                      {ev.displayTitle || ev.originalName}
                    </button>
                    <span className="text-gray-500 font-mono ml-2">[{ev.category}]</span>
                    <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                      SHA256: {ev.fileHash.substring(0, 16)}... ·{" "}
                      {(ev.fileSizeBytes / 1024).toFixed(0)} KB WebP
                    </p>
                  </div>
                </div>

                <div className="text-right flex items-center gap-2">
                  <span
                    className={`font-bold px-1.5 py-0.5 rounded text-[10px] uppercase font-mono ${
                      ev.verificationStatus === "VERIFIED"
                        ? "bg-green-100 text-green-800"
                        : ev.verificationStatus === "REJECTED"
                        ? "bg-red-100 text-red-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {ev.verificationStatus}
                  </span>

                  <button
                    type="button"
                    onClick={() => openDoc(index)}
                    className="no-print p-1 text-gray-500 hover:text-black rounded hover:bg-gray-200 transition cursor-pointer"
                    title="View high resolution evidence in lightbox"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 italic text-[11px]">
            No electronic evidence documents attached to this transaction voucher.
          </p>
        )}
      </div>

      {/* Signatures & Approvals Block */}
      <div className="grid grid-cols-3 gap-6 pt-12 border-t border-gray-300 text-center text-xs">
        <div>
          <div className="border-b border-black pb-1 mb-1 font-semibold">Shawon</div>
          <p className="text-gray-500">Prepared By</p>
        </div>
        <div>
          <div className="border-b border-black pb-1 mb-1 font-semibold">Rafi</div>
          <p className="text-gray-500">Checked / Reviewed</p>
        </div>
        <div>
          <div className="border-b border-black pb-1 mb-1 font-semibold">Partner Approver</div>
          <p className="text-gray-500">Authorised Signatory</p>
        </div>
      </div>

      {/* Optional Full-size Evidence Print Appendix (rendered only when checked or printed) */}
      {includePrintAppendix && evidenceList.length > 0 && (
        <div className="mt-12 pt-8 border-t-2 border-black page-break-before space-y-8">
          <div className="border-b-2 border-black pb-2">
            <h2 className="text-lg font-black uppercase tracking-wider">
              Documentary Proof Appendix · Voucher #{entry.entryNumber}
            </h2>
            <p className="text-xs text-gray-600">
              Attached original screenshots, bank deposit challans, and transaction receipts.
            </p>
          </div>

          {evidenceList.map((ev, idx) => (
            <div key={ev.id} className="space-y-2 border border-gray-300 p-4 rounded page-break-inside-avoid">
              <div className="flex justify-between items-center text-xs font-mono border-b pb-1">
                <span className="font-bold">
                  Evidence #{idx + 1}: {ev.displayTitle || ev.originalName}
                </span>
                <span className="text-gray-500">
                  {ev.category} · {(ev.fileSizeBytes / 1024).toFixed(0)} KB WebP
                </span>
              </div>

              {ev.url && (
                <div className="flex justify-center py-2 bg-gray-50 rounded">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ev.url}
                    alt={ev.originalName}
                    className="max-h-[500px] object-contain border border-gray-200"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Viewer */}
      <EvidenceViewer
        documents={evidenceList}
        initialIndex={selectedDocIndex}
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
      />

      {/* Mode B: Add Proof Modal */}
      {isAddProofOpen && (
        <AddProofModal
          isOpen={isAddProofOpen}
          onClose={() => setIsAddProofOpen(false)}
          entityType="JOURNAL_ENTRY"
          entityId={entry.id}
          referenceId={entry.entryNumber}
          title={`Attach Proof to ${entry.entryNumber}`}
          module="FINANCE"
          onSuccess={(newDocs) => {
            setEvidenceList((prev) => [...newDocs, ...prev]);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
