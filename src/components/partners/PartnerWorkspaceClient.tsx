"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  EvidenceUploader,
  StagedFile,
} from "@/components/evidence/EvidenceUploader";
import { EvidenceViewer, ViewerDocument } from "@/components/evidence/EvidenceViewer";
import { AddProofModal } from "@/components/evidence/AddProofModal";
import { ReverseTransactionModal } from "@/components/finance/ReverseTransactionModal";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Paperclip,
  ExternalLink,
  PlusCircle,
  FileText,
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  Receipt,
  Eye,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";

interface Partner {
  id: string;
  name: string;
  ownershipPct: string;
  profitSharePct: string;
}

interface PaymentAccount {
  id: string;
  name: string;
  type: string;
}

interface TransactionHistoryItem {
  id: string;
  entryNumber: string;
  date: string | Date;
  entryType: string;
  description: string;
  reference?: string | null;
  status: string;
  partnerId?: string | null;
  partnerName?: string | null;
  amount: number;
  evidence: ViewerDocument[];
}

interface PartnerWorkspaceClientProps {
  partners: Partner[];
  paymentAccounts: PaymentAccount[];
  initialHistory: TransactionHistoryItem[];
}

export function PartnerWorkspaceClient({
  partners,
  paymentAccounts,
  initialHistory,
}: PartnerWorkspaceClientProps) {
  const router = useRouter();

  // History state
  const [history, setHistory] = useState<TransactionHistoryItem[]>(initialHistory);

  // Success and Error banners
  const [successInfo, setSuccessInfo] = useState<{
    message: string;
    entryNumber: string;
    journalId: string;
    attachedCount: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active form tab: "CONTRIBUTION" | "LOAN" | "DRAWING" | "REIMBURSEMENT"
  const [activeTab, setActiveTab] = useState<
    "CONTRIBUTION" | "LOAN" | "DRAWING" | "REIMBURSEMENT"
  >("CONTRIBUTION");

  // Table view filter: "ACTIVE" vs "ALL"
  const [viewMode, setViewMode] = useState<"ACTIVE" | "ALL">("ACTIVE");
  const [correctionNotice, setCorrectionNotice] = useState<string | null>(null);

  const handleLoadForCorrection = (tx: TransactionHistoryItem) => {
    setCorrectionNotice(
      `Loaded details from ${tx.entryNumber}. Adjust amounts or accounts and save to post your correction.`
    );
    if (tx.entryType === "PARTNER_LOAN") {
      setActiveTab("LOAN");
      if (tx.partnerId) setLoanPartnerId(tx.partnerId);
      if (tx.amount) setLoanAmount(tx.amount.toString());
      if (tx.reference) setLoanReference(tx.reference);
      if (tx.description) setLoanDescription(tx.description);
    } else {
      setActiveTab("CONTRIBUTION");
      if (tx.partnerId) setContribPartnerId(tx.partnerId);
      if (tx.amount) setContribAmount(tx.amount.toString());
      if (tx.reference) setContribReference(tx.reference);
      if (tx.description) setContribDescription(tx.description);
    }
    window.scrollTo({ top: 200, behavior: "smooth" });
  };

  // Form states:
  // Form 1: Capital Contribution
  const [contribPartnerId, setContribPartnerId] = useState("");
  const [contribAccountId, setContribAccountId] = useState("");
  const [contribAmount, setContribAmount] = useState("");
  const [contribReference, setContribReference] = useState("");
  const [contribDescription, setContribDescription] = useState("");
  const [contribStagedFiles, setContribStagedFiles] = useState<StagedFile[]>([]);
  const [isSubmittingContrib, setIsSubmittingContrib] = useState(false);

  // Form 2: Partner Loan Advance
  const [loanPartnerId, setLoanPartnerId] = useState("");
  const [loanAccountId, setLoanAccountId] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [loanReference, setLoanReference] = useState("");
  const [loanDescription, setLoanDescription] = useState("");
  const [loanStagedFiles, setLoanStagedFiles] = useState<StagedFile[]>([]);
  const [isSubmittingLoan, setIsSubmittingLoan] = useState(false);

  // Form 3: Partner Drawings
  const [drawingPartnerId, setDrawingPartnerId] = useState("");
  const [drawingAccountId, setDrawingAccountId] = useState("");
  const [drawingAmount, setDrawingAmount] = useState("");
  const [drawingReference, setDrawingReference] = useState("");
  const [drawingDescription, setDrawingDescription] = useState("");
  const [drawingStagedFiles, setDrawingStagedFiles] = useState<StagedFile[]>([]);
  const [isSubmittingDrawing, setIsSubmittingDrawing] = useState(false);

  // Form 4: Loan Repayment / Reimbursement
  const [repayPartnerId, setRepayPartnerId] = useState("");
  const [repayAccountId, setRepayAccountId] = useState("");
  const [repayAmount, setRepayAmount] = useState("");
  const [repayReference, setRepayReference] = useState("");
  const [repayDescription, setRepayDescription] = useState("");
  const [repayStagedFiles, setRepayStagedFiles] = useState<StagedFile[]>([]);
  const [isSubmittingRepay, setIsSubmittingRepay] = useState(false);

  // Lightbox viewer modal state
  const [viewerDocs, setViewerDocs] = useState<ViewerDocument[]>([]);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);

  // Mode B: Add Proof Modal for existing transaction
  const [addProofTx, setAddProofTx] = useState<TransactionHistoryItem | null>(null);

  // Reversal Modal state
  const [reversingTx, setReversingTx] = useState<TransactionHistoryItem | null>(null);

  const openViewerForTransaction = (docs: ViewerDocument[], initialIdx = 0) => {
    setViewerDocs(docs);
    setViewerInitialIndex(initialIdx);
    setIsViewerOpen(true);
  };

  // Generic submission handler coordinating financial data and staged files
  const submitTransaction = async (
    action:
      | "PARTNER_CONTRIBUTION"
      | "PARTNER_LOAN"
      | "PARTNER_DRAWING"
      | "PARTNER_REIMBURSEMENT",
    params: {
      partnerId: string;
      paymentAccountId: string;
      amount: string;
      reference: string;
      description?: string;
      stagedFiles: StagedFile[];
    },
    setSubmitting: (val: boolean) => void,
    resetForm: () => void
  ) => {
    setErrorMessage(null);
    setSuccessInfo(null);

    const numAmount = parseFloat(params.amount);
    if (!params.partnerId || !params.paymentAccountId || isNaN(numAmount) || numAmount <= 0) {
      setErrorMessage("Please complete all required fields (Partner, Account, Amount).");
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("action", action);
      formData.append("partnerId", params.partnerId);
      formData.append("paymentAccountId", params.paymentAccountId);
      formData.append("amount", numAmount.toString());
      if (params.reference) formData.append("reference", params.reference.trim());
      if (params.description) formData.append("description", params.description.trim());

      // Idempotency key
      formData.append(
        "idempotencyKey",
        `PARTNER_${action}_${params.partnerId}_${Date.now()}`
      );

      // Append staged files
      for (const staged of params.stagedFiles) {
        formData.append("files", staged.file);
      }

      const res = await fetch("/api/finance/entry-with-evidence", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to record transaction");
      }

      const attachedCount = data.documents?.length || 0;
      setSuccessInfo({
        message:
          action === "PARTNER_CONTRIBUTION"
            ? "Capital Contribution recorded successfully!"
            : action === "PARTNER_LOAN"
            ? "Partner Loan Advance recorded successfully!"
            : action === "PARTNER_DRAWING"
            ? "Partner Drawings recorded successfully!"
            : "Partner Reimbursement / Repayment recorded successfully!",
        entryNumber: data.journal.entryNumber,
        journalId: data.journal.id,
        attachedCount,
      });

      // Reset form
      resetForm();

      // Refresh page data
      router.refresh();

      // Dynamically prepend new transaction to history list
      const partnerObj = partners.find((p) => p.id === params.partnerId);
      const newHistoryItem: TransactionHistoryItem = {
        id: data.journal.id,
        entryNumber: data.journal.entryNumber,
        date: new Date(),
        entryType: data.journal.entryType,
        description: data.journal.description,
        reference: params.reference || null,
        status: "POSTED",
        partnerId: params.partnerId,
        partnerName: partnerObj?.name || null,
        amount: numAmount,
        evidence: data.documents || [],
      };
      setHistory((prev) => [newHistoryItem, ...prev]);
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Global Success Banner */}
      {successInfo && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-emerald-400">
                {successInfo.message}
              </h4>
              <p className="text-xs text-afk-offwhite">
                Voucher Reference:{" "}
                <span className="font-mono font-bold text-afk-olive">
                  {successInfo.entryNumber}
                </span>{" "}
                · {successInfo.attachedCount} proof {successInfo.attachedCount === 1 ? "document" : "documents"} converted to WebP and securely linked.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/print/voucher/${successInfo.journalId}`}
              target="_blank"
              className="px-3 py-1.5 rounded-lg bg-afk-surface hover:bg-afk-border text-afk-offwhite text-xs font-medium border border-afk-border flex items-center gap-1.5 transition"
            >
              <span>View Voucher</span>
              <ExternalLink className="w-3 h-3 text-afk-olive" />
            </Link>
            <button
              type="button"
              onClick={() => setSuccessInfo(null)}
              className="text-afk-muted hover:text-afk-offwhite text-xs p-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-400 hover:text-red-300 font-bold px-2 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Correction Notice Banner if loaded from a previous mistake */}
      {correctionNotice && (
        <div className="p-3 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs flex items-center justify-between gap-2 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 shrink-0 text-amber-400" />
            <span>{correctionNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setCorrectionNotice(null)}
            className="px-2 py-0.5 rounded text-[11px] bg-afk-surface hover:bg-afk-border text-afk-muted hover:text-afk-offwhite border border-afk-border cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Transaction Action Forms Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* FORM 1: Equity Contribution */}
        <div className="bg-afk-card p-6 rounded-xl border border-afk-border shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 pb-2 border-b border-afk-border/60">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <div>
                <h3 className="text-sm font-semibold text-afk-offwhite">
                  Record Partner Equity Contribution
                </h3>
                <p className="text-[11px] text-afk-muted">
                  Credits Partner Capital account and debits Bank/Cash.
                </p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitTransaction(
                  "PARTNER_CONTRIBUTION",
                  {
                    partnerId: contribPartnerId,
                    paymentAccountId: contribAccountId,
                    amount: contribAmount,
                    reference: contribReference,
                    description: contribDescription || "Partner capital contribution",
                    stagedFiles: contribStagedFiles,
                  },
                  setIsSubmittingContrib,
                  () => {
                    setContribAmount("");
                    setContribReference("");
                    setContribDescription("");
                    setContribStagedFiles([]);
                  }
                );
              }}
              className="space-y-3 pt-3 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-afk-muted mb-1 font-medium">Partner</label>
                  <select
                    value={contribPartnerId}
                    onChange={(e) => setContribPartnerId(e.target.value)}
                    required
                    className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
                  >
                    <option value="">Select Partner...</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.ownershipPct}% Ownership)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-afk-muted mb-1 font-medium">Receiving Account</label>
                  <select
                    value={contribAccountId}
                    onChange={(e) => setContribAccountId(e.target.value)}
                    required
                    className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
                  >
                    <option value="">Select Account...</option>
                    {paymentAccounts.map((pa) => (
                      <option key={pa.id} value={pa.id}>
                        {pa.name} ({pa.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-afk-muted mb-1 font-medium">Amount (BDT ৳)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="100"
                    required
                    value={contribAmount}
                    onChange={(e) => setContribAmount(e.target.value)}
                    placeholder="e.g. 10000"
                    className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-afk-muted mb-1 font-medium">Reference Number</label>
                  <input
                    type="text"
                    value={contribReference}
                    onChange={(e) => setContribReference(e.target.value)}
                    placeholder="e.g. 1054356120001 / Bank slip"
                    className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Description</label>
                <input
                  type="text"
                  value={contribDescription}
                  onChange={(e) => setContribDescription(e.target.value)}
                  placeholder="e.g. Initial capital contribution"
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
                />
              </div>

              {/* Integrated Payment Proof Uploader (Mode A) */}
              <div className="pt-1 border-t border-afk-border/50">
                <EvidenceUploader
                  mode="form"
                  label="Payment Proof (Optional)"
                  helperText="Attach bank deposit slip, cash receipt or transfer screenshot."
                  defaultCategory="PAYMENT_PROOF"
                  stagedFiles={contribStagedFiles}
                  onStagedFilesChange={setContribStagedFiles}
                  compact
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingContrib}
                className="w-full py-2.5 bg-afk-olive hover:bg-afk-olive-light text-afk-offwhite font-semibold rounded-lg transition flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50 mt-2"
              >
                {isSubmittingContrib ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing & Converting WebP...</span>
                  </>
                ) : (
                  <span>Review & Save Contribution</span>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* FORM 2: Partner Loan Advance */}
        <div className="bg-afk-card p-6 rounded-xl border border-afk-border shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 pb-2 border-b border-afk-border/60">
              <ArrowDownLeft className="w-4 h-4 text-amber-400" />
              <div>
                <h3 className="text-sm font-semibold text-afk-offwhite">
                  Record Partner Loan Advance
                </h3>
                <p className="text-[11px] text-afk-muted">
                  Credits Due to Partner (Liability) and debits Bank/Cash.
                </p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitTransaction(
                  "PARTNER_LOAN",
                  {
                    partnerId: loanPartnerId,
                    paymentAccountId: loanAccountId,
                    amount: loanAmount,
                    reference: loanReference,
                    description: loanDescription || "Partner loan advance",
                    stagedFiles: loanStagedFiles,
                  },
                  setIsSubmittingLoan,
                  () => {
                    setLoanAmount("");
                    setLoanReference("");
                    setLoanDescription("");
                    setLoanStagedFiles([]);
                  }
                );
              }}
              className="space-y-3 pt-3 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-afk-muted mb-1 font-medium">Partner</label>
                  <select
                    value={loanPartnerId}
                    onChange={(e) => setLoanPartnerId(e.target.value)}
                    required
                    className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
                  >
                    <option value="">Select Partner...</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-afk-muted mb-1 font-medium">Receiving Account</label>
                  <select
                    value={loanAccountId}
                    onChange={(e) => setLoanAccountId(e.target.value)}
                    required
                    className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
                  >
                    <option value="">Select Account...</option>
                    {paymentAccounts.map((pa) => (
                      <option key={pa.id} value={pa.id}>
                        {pa.name} ({pa.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-afk-muted mb-1 font-medium">Amount (BDT ৳)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="100"
                    required
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(e.target.value)}
                    placeholder="e.g. 25000"
                    className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-afk-muted mb-1 font-medium">Reference Number</label>
                  <input
                    type="text"
                    value={loanReference}
                    onChange={(e) => setLoanReference(e.target.value)}
                    placeholder="e.g. Loan agreement / deposit slip"
                    className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Description / Reason</label>
                <input
                  type="text"
                  value={loanDescription}
                  onChange={(e) => setLoanDescription(e.target.value)}
                  placeholder="e.g. Temporary liquidity advance"
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
                />
              </div>

              {/* Integrated Payment Proof Uploader (Mode A) */}
              <div className="pt-1 border-t border-afk-border/50">
                <EvidenceUploader
                  mode="form"
                  label="Loan Proof (Optional)"
                  helperText="Attach bank slip, cheque copy or agreement reference."
                  defaultCategory="PAYMENT_PROOF"
                  stagedFiles={loanStagedFiles}
                  onStagedFilesChange={setLoanStagedFiles}
                  compact
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingLoan}
                className="w-full py-2.5 bg-afk-surface hover:bg-afk-border/80 border border-afk-border text-afk-offwhite font-semibold rounded-lg transition flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50 mt-2"
              >
                {isSubmittingLoan ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing & Converting WebP...</span>
                  </>
                ) : (
                  <span>Review & Save Partner Loan</span>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* FORM 3: Partner Drawings (Withdrawal) */}
        <div className="bg-afk-card p-6 rounded-xl border border-afk-border shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 pb-2 border-b border-afk-border/60">
              <ArrowUpRight className="w-4 h-4 text-purple-400" />
              <div>
                <h3 className="text-sm font-semibold text-afk-offwhite">
                  Record Partner Drawings (Withdrawal)
                </h3>
                <p className="text-[11px] text-afk-muted">
                  Debits Partner Drawings (Equity contra) and credits Cash/Bank.
                </p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitTransaction(
                  "PARTNER_DRAWING",
                  {
                    partnerId: drawingPartnerId,
                    paymentAccountId: drawingAccountId,
                    amount: drawingAmount,
                    reference: drawingReference,
                    description: drawingDescription || "Partner drawings withdrawal",
                    stagedFiles: drawingStagedFiles,
                  },
                  setIsSubmittingDrawing,
                  () => {
                    setDrawingAmount("");
                    setDrawingReference("");
                    setDrawingDescription("");
                    setDrawingStagedFiles([]);
                  }
                );
              }}
              className="space-y-3 pt-3 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-afk-muted mb-1 font-medium">Partner</label>
                  <select
                    value={drawingPartnerId}
                    onChange={(e) => setDrawingPartnerId(e.target.value)}
                    required
                    className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
                  >
                    <option value="">Select Partner...</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-afk-muted mb-1 font-medium">Disbursing Account</label>
                  <select
                    value={drawingAccountId}
                    onChange={(e) => setDrawingAccountId(e.target.value)}
                    required
                    className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
                  >
                    <option value="">Select Account...</option>
                    {paymentAccounts.map((pa) => (
                      <option key={pa.id} value={pa.id}>
                        {pa.name} ({pa.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-afk-muted mb-1 font-medium">Withdrawal Amount (BDT ৳)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="100"
                    required
                    value={drawingAmount}
                    onChange={(e) => setDrawingAmount(e.target.value)}
                    placeholder="e.g. 10000"
                    className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-afk-muted mb-1 font-medium">Reference / Note</label>
                  <input
                    type="text"
                    value={drawingReference}
                    onChange={(e) => setDrawingReference(e.target.value)}
                    placeholder="e.g. Cheque #4521 / MFS Trx"
                    className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Purpose</label>
                <input
                  type="text"
                  value={drawingDescription}
                  onChange={(e) => setDrawingDescription(e.target.value)}
                  placeholder="e.g. Monthly drawings disbursement"
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
                />
              </div>

              {/* Integrated Payment Proof Uploader (Mode A) */}
              <div className="pt-1 border-t border-afk-border/50">
                <EvidenceUploader
                  mode="form"
                  label="Disbursement Proof (Optional)"
                  helperText="Attach signed voucher, bank transfer receipt or payout screenshot."
                  defaultCategory="RECEIPT"
                  stagedFiles={drawingStagedFiles}
                  onStagedFilesChange={setDrawingStagedFiles}
                  compact
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingDrawing}
                className="w-full py-2.5 bg-afk-olive hover:bg-afk-olive-light text-afk-offwhite font-semibold rounded-lg transition flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50 mt-2"
              >
                {isSubmittingDrawing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing & Converting WebP...</span>
                  </>
                ) : (
                  <span>Review & Save Drawings</span>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* FORM 4: Loan Repayment / Reimbursement */}
        <div className="bg-afk-card p-6 rounded-xl border border-afk-border shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 pb-2 border-b border-afk-border/60">
              <Receipt className="w-4 h-4 text-sky-400" />
              <div>
                <h3 className="text-sm font-semibold text-afk-offwhite">
                  Repay Partner Loan / Reimbursement
                </h3>
                <p className="text-[11px] text-afk-muted">
                  Debits Due to Partner (Liability) and credits Cash/Bank.
                </p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitTransaction(
                  "PARTNER_REIMBURSEMENT",
                  {
                    partnerId: repayPartnerId,
                    paymentAccountId: repayAccountId,
                    amount: repayAmount,
                    reference: repayReference,
                    description: repayDescription || "Partner loan repayment",
                    stagedFiles: repayStagedFiles,
                  },
                  setIsSubmittingRepay,
                  () => {
                    setRepayAmount("");
                    setRepayReference("");
                    setRepayDescription("");
                    setRepayStagedFiles([]);
                  }
                );
              }}
              className="space-y-3 pt-3 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-afk-muted mb-1 font-medium">Partner</label>
                  <select
                    value={repayPartnerId}
                    onChange={(e) => setRepayPartnerId(e.target.value)}
                    required
                    className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
                  >
                    <option value="">Select Partner...</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-afk-muted mb-1 font-medium">Disbursing Account</label>
                  <select
                    value={repayAccountId}
                    onChange={(e) => setRepayAccountId(e.target.value)}
                    required
                    className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
                  >
                    <option value="">Select Account...</option>
                    {paymentAccounts.map((pa) => (
                      <option key={pa.id} value={pa.id}>
                        {pa.name} ({pa.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-afk-muted mb-1 font-medium">Repayment Amount (BDT ৳)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="100"
                    required
                    value={repayAmount}
                    onChange={(e) => setRepayAmount(e.target.value)}
                    placeholder="e.g. 15000"
                    className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-afk-muted mb-1 font-medium">Reference Number</label>
                  <input
                    type="text"
                    value={repayReference}
                    onChange={(e) => setRepayReference(e.target.value)}
                    placeholder="e.g. Bank Trx #10291"
                    className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Reason / Settlement Note</label>
                <input
                  type="text"
                  value={repayDescription}
                  onChange={(e) => setRepayDescription(e.target.value)}
                  placeholder="e.g. Reimbursement for fabric factory advance"
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
                />
              </div>

              {/* Integrated Payment Proof Uploader (Mode A) */}
              <div className="pt-1 border-t border-afk-border/50">
                <EvidenceUploader
                  mode="form"
                  label="Repayment Proof (Optional)"
                  helperText="Attach bank/bKash transfer slip or expense receipts."
                  defaultCategory="PAYMENT_PROOF"
                  stagedFiles={repayStagedFiles}
                  onStagedFilesChange={setRepayStagedFiles}
                  compact
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingRepay}
                className="w-full py-2.5 bg-afk-surface hover:bg-afk-border/80 border border-afk-border text-afk-offwhite font-semibold rounded-lg transition flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50 mt-2"
              >
                {isSubmittingRepay ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing & Converting WebP...</span>
                  </>
                ) : (
                  <span>Review & Save Reimbursement</span>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* PARTNER FINANCIAL HISTORY & TRANSACTION PROOF SECTION */}
      <div className="bg-afk-card p-6 rounded-xl border border-afk-border shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-afk-border/60">
          <div>
            <h3 className="text-sm font-semibold text-afk-offwhite flex items-center gap-2">
              <Receipt className="w-4 h-4 text-afk-olive" />
              <span>Partner Financial History & Supporting Evidence</span>
            </h3>
            <p className="text-[11px] text-afk-muted mt-0.5">
              Verified double-entry partner capital, loan, drawing and repayment transactions with linked proof attachments.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-afk-surface p-0.5 rounded-lg border border-afk-border text-xs">
              <button
                type="button"
                onClick={() => setViewMode("ACTIVE")}
                className={`px-3 py-1 rounded font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === "ACTIVE"
                    ? "bg-afk-charcoal text-afk-offwhite font-bold shadow-sm"
                    : "text-afk-muted hover:text-afk-offwhite"
                }`}
              >
                <span>Active</span>
                <span className="px-1.5 py-0.2 rounded-full bg-afk-olive/20 text-afk-olive-light text-[10px]">
                  {history.filter((h) => h.status !== "REVERSED" && h.entryType !== "REVERSAL").length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode("ALL")}
                className={`px-3 py-1 rounded font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === "ALL"
                    ? "bg-afk-charcoal text-afk-offwhite font-bold shadow-sm"
                    : "text-afk-muted hover:text-afk-offwhite"
                }`}
              >
                <span>Audit Trail</span>
                <span className="px-1.5 py-0.2 rounded-full bg-afk-border text-afk-muted text-[10px]">
                  {history.length}
                </span>
              </button>
            </div>
          </div>
        </div>

        {viewMode === "ACTIVE" && history.some((h) => h.status === "REVERSED" || h.entryType === "REVERSAL") && (
          <div className="p-2.5 rounded bg-afk-surface/60 border border-afk-border text-[11px] text-afk-muted flex items-center justify-between">
            <span>
              💡 Cancelled and offset reversal transactions are hidden in Active View to keep your partner records clean.
            </span>
            <button
              type="button"
              onClick={() => setViewMode("ALL")}
              className="text-amber-400 hover:text-amber-300 font-medium cursor-pointer underline ml-2 shrink-0"
            >
              View Full Audit Trail
            </button>
          </div>
        )}

        {/* History Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-afk-border text-afk-muted">
                <th className="py-2.5 font-medium">Date</th>
                <th className="py-2.5 font-medium">Partner</th>
                <th className="py-2.5 font-medium">Transaction Type</th>
                <th className="py-2.5 font-medium">Description</th>
                <th className="py-2.5 font-medium">Reference</th>
                <th className="py-2.5 font-medium text-right">Amount (BDT)</th>
                <th className="py-2.5 font-medium text-center">Supporting Proof</th>
                <th className="py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-afk-border/40">
              {(() => {
                const displayedHistory =
                  viewMode === "ACTIVE"
                    ? history.filter((h) => h.status !== "REVERSED" && h.entryType !== "REVERSAL")
                    : history;

                if (displayedHistory.length === 0) {
                  return (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-afk-muted font-sans">
                        No transactions to display in this view.
                      </td>
                    </tr>
                  );
                }

                return displayedHistory.map((tx) => {
                  const isReversal = tx.entryType === "REVERSAL";
                  const isReversed = tx.status === "REVERSED";

                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-afk-surface/40 transition-colors ${
                        isReversed ? "opacity-60 bg-red-500/[0.02]" : isReversal ? "bg-amber-500/[0.02]" : ""
                      }`}
                    >
                      <td className="py-2.5 text-afk-muted">
                        {new Date(tx.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>

                      <td className="py-2.5 font-sans font-semibold text-afk-offwhite">
                        {tx.partnerName || "—"}
                      </td>

                      <td className="py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold border ${
                            isReversal
                              ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                              : tx.entryType === "CAPITAL_DEPOSIT"
                              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                              : tx.entryType === "PARTNER_LOAN"
                              ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                              : tx.entryType === "PARTNER_DRAWINGS"
                              ? "bg-purple-500/15 text-purple-400 border-purple-500/30"
                              : "bg-sky-500/15 text-sky-400 border-sky-500/30"
                          }`}
                        >
                          {isReversal ? "OFFSET / REVERSAL" : tx.entryType.replace(/_/g, " ")}
                        </span>
                      </td>

                      <td
                        className={`py-2.5 font-sans max-w-xs truncate ${
                          isReversed
                            ? "line-through text-afk-muted"
                            : isReversal
                            ? "text-amber-300/90"
                            : "text-afk-offwhite"
                        }`}
                        title={tx.description}
                      >
                        {tx.description}
                      </td>

                      <td className="py-2.5 text-afk-muted font-sans text-[11px]">
                        {tx.reference || "—"}
                      </td>

                      <td className="py-2.5 text-right font-bold text-afk-offwhite">
                        ৳{tx.amount.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                      </td>

                      {/* Supporting Proof indicator */}
                      <td className="py-2.5 text-center font-sans">
                        {tx.evidence && tx.evidence.length > 0 ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openViewerForTransaction(tx.evidence)}
                              className="px-2 py-0.5 rounded-full bg-afk-surface hover:bg-afk-border text-afk-olive hover:text-afk-olive-light text-[10px] font-medium border border-afk-border flex items-center gap-1 transition cursor-pointer"
                              title="Click to view attached proof in lightbox"
                            >
                              <Paperclip className="w-3 h-3 text-afk-olive" />
                              <span>
                                {tx.evidence.length} {tx.evidence.length === 1 ? "proof" : "proofs"}
                              </span>
                            </button>

                            {/* Quick thumbnail badge if first is image */}
                            {tx.evidence[0]?.thumbnailUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={tx.evidence[0].thumbnailUrl}
                                alt="Proof thumb"
                                onClick={() => openViewerForTransaction(tx.evidence)}
                                className="w-5 h-5 rounded object-cover border border-afk-border cursor-pointer hover:scale-110 transition"
                                title="Click to view full size"
                              />
                            )}
                          </div>
                        ) : (
                          <span className="text-afk-muted text-[10px] italic">No proof</span>
                        )}
                      </td>

                      {/* Actions: Add Proof, Voucher, Re-enter, Reverse */}
                      <td className="py-2.5 text-right font-sans">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isReversed && !isReversal && (
                            <button
                              type="button"
                              onClick={() => setAddProofTx(tx)}
                              className="px-2 py-1 rounded bg-afk-surface hover:bg-afk-border text-afk-muted hover:text-afk-offwhite text-[11px] font-medium border border-afk-border flex items-center gap-1 transition cursor-pointer"
                              title="Attach proof to this transaction"
                            >
                              <Paperclip className="w-3 h-3 text-afk-olive" />
                              <span>Add Proof</span>
                            </button>
                          )}

                          <Link
                            href={`/print/voucher/${tx.id}`}
                            target="_blank"
                            className="px-2 py-1 rounded bg-afk-surface hover:bg-afk-border text-afk-muted hover:text-afk-offwhite text-[11px] font-medium border border-afk-border flex items-center gap-1 transition"
                            title="Open printable voucher"
                          >
                            <FileText className="w-3 h-3 text-afk-olive-accent" />
                            <span>Voucher</span>
                          </Link>

                          {isReversal ? (
                            <span className="px-2 py-0.5 rounded text-[10px] text-amber-300/70 bg-amber-500/10 border border-amber-500/20 font-medium">
                              Offset
                            </span>
                          ) : isReversed ? (
                            <div className="flex items-center gap-1">
                              <span className="px-2 py-0.5 rounded text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 font-medium">
                                Reversed
                              </span>
                              <button
                                type="button"
                                onClick={() => handleLoadForCorrection(tx)}
                                className="px-2 py-1 rounded bg-afk-surface hover:bg-amber-500/15 text-afk-muted hover:text-amber-400 text-[11px] font-medium border border-afk-border hover:border-amber-500/40 flex items-center gap-1 transition cursor-pointer"
                                title="Load this transaction's details into the form to make corrections"
                              >
                                <RotateCcw className="w-3 h-3 text-amber-400" />
                                <span>Re-enter / Correct</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setReversingTx(tx)}
                              className="px-2 py-1 rounded bg-afk-surface hover:bg-amber-500/15 text-afk-muted hover:text-amber-400 text-[11px] font-medium border border-afk-border hover:border-amber-500/40 flex items-center gap-1 transition cursor-pointer"
                              title="Reverse this transaction and cancel accounting impact"
                            >
                              <RotateCcw className="w-3 h-3 text-amber-400" />
                              <span>Reverse</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lightbox Viewer */}
      <EvidenceViewer
        documents={viewerDocs}
        initialIndex={viewerInitialIndex}
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
      />

      {/* Mode B: Add Proof Modal */}
      {addProofTx && (
        <AddProofModal
          isOpen={!!addProofTx}
          onClose={() => setAddProofTx(null)}
          entityType="JOURNAL_ENTRY"
          entityId={addProofTx.id}
          referenceId={addProofTx.entryNumber}
          title={`Attach Proof to ${addProofTx.entryNumber}`}
          module="PARTNERS"
          defaultCategory="PAYMENT_PROOF"
          onSuccess={(newDocs) => {
            // Update history item with newly attached documents
            setHistory((prev) =>
              prev.map((item) =>
                item.id === addProofTx.id
                  ? { ...item, evidence: [...newDocs, ...(item.evidence || [])] }
                  : item
              )
            );
            router.refresh();
          }}
        />
      )}

      {/* Reverse Transaction Modal */}
      {reversingTx && (
        <ReverseTransactionModal
          isOpen={!!reversingTx}
          onClose={() => setReversingTx(null)}
          transaction={reversingTx}
          onSuccess={(reversal) => {
            setSuccessInfo({
              message: `Transaction ${reversingTx.entryNumber} reversed successfully! Offset entry posted: ${reversal.entryNumber}`,
              entryNumber: reversal.entryNumber,
              journalId: reversal.id,
              attachedCount: 0,
            });
            setHistory((prev) => [
              {
                id: reversal.id,
                entryNumber: reversal.entryNumber,
                date: new Date(),
                entryType: "REVERSAL",
                description: reversal.description,
                reference: reversingTx.entryNumber,
                status: "POSTED",
                amount: reversingTx.amount,
                partnerId: reversingTx.partnerId,
                partnerName: reversingTx.partnerName,
                evidence: [],
              },
              ...prev.map((item) =>
                item.id === reversingTx.id ? { ...item, status: "REVERSED" } : item
              ),
            ]);
            router.refresh();
          }}
          onCorrect={(tx) => {
            handleLoadForCorrection(tx);
          }}
        />
      )}
    </div>
  );
}
