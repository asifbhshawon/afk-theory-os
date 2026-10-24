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
import Link from "next/link";
import {
  Receipt,
  ArrowRightLeft,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  RotateCcw,
  PlusCircle,
  Tag,
  Sparkles,
  ExternalLink,
} from "lucide-react";

interface Account {
  id: string;
  code: string;
  name: string;
  group: string;
  isSystem: boolean;
}

interface PaymentAccount {
  id: string;
  name: string;
  type: string;
}

interface Partner {
  id: string;
  name: string;
}

interface JournalEntryItem {
  id: string;
  entryNumber: string;
  date: string | Date;
  entryType: string;
  description: string;
  reference?: string | null;
  status: string;
  amount?: number;
  expenseAccountId?: string;
  partnerId?: string | null;
  paymentAccountId?: string | null;
  isSupplierPayable?: boolean;
  evidence: ViewerDocument[];
}

interface FinanceWorkspaceClientProps {
  expenseAccounts: Account[];
  paymentAccounts: PaymentAccount[];
  partners: Partner[];
  journalEntries: JournalEntryItem[];
  canManage: boolean;
}

export function FinanceWorkspaceClient({
  expenseAccounts,
  paymentAccounts,
  partners,
  journalEntries: initialEntries,
  canManage,
}: FinanceWorkspaceClientProps) {
  const router = useRouter();
  const formRef = React.useRef<HTMLDivElement>(null);
  const [entries, setEntries] = useState<JournalEntryItem[]>(initialEntries);

  // Success & Error alerts
  const [successInfo, setSuccessInfo] = useState<{
    message: string;
    entryNumber: string;
    journalId: string;
    attachedCount: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [correctionNotice, setCorrectionNotice] = useState<string | null>(null);

  // Form 1: Business Expense
  const [expenseAccountId, setExpenseAccountId] = useState("");
  const [customCategoryName, setCustomCategoryName] = useState("");
  const [fundingMode, setFundingMode] = useState<"COMPANY" | "PARTNER" | "SUPPLIER">("COMPANY");
  const [selectedCompanyAccountId, setSelectedCompanyAccountId] = useState(paymentAccounts[0]?.id || "");
  const [selectedPartnerId, setSelectedPartnerId] = useState(partners[0]?.id || "");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseReference, setExpenseReference] = useState("");
  const [expenseStagedFiles, setExpenseStagedFiles] = useState<StagedFile[]>([]);
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  // Form 2: Fund Transfer
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferReference, setTransferReference] = useState("");
  const [transferStagedFiles, setTransferStagedFiles] = useState<StagedFile[]>([]);
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);

  // Table view filter: "ACTIVE" (hides reversed & offsets) vs "ALL" (full GAAP audit trail)
  const [viewMode, setViewMode] = useState<"ACTIVE" | "ALL">("ACTIVE");

  // Lightbox viewer modal state
  const [viewerDocs, setViewerDocs] = useState<ViewerDocument[]>([]);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);

  // Mode B: Add Proof Modal
  const [addProofEntry, setAddProofEntry] = useState<JournalEntryItem | null>(null);

  // Reversal Modal state
  const [reversingEntry, setReversingEntry] = useState<JournalEntryItem | null>(null);

  const openViewerForEntry = (docs: ViewerDocument[], initialIdx = 0) => {
    setViewerDocs(docs);
    setViewerInitialIndex(initialIdx);
    setIsViewerOpen(true);
  };

  // Pre-fill form from a transaction to make quick correction
  const handleLoadForCorrection = (tx: JournalEntryItem) => {
    setCorrectionNotice(
      `Loaded details from ${tx.entryNumber}. Adjust the funding source / amount and click "Review & Post Expense" to post your corrected entry.`
    );
    if (tx.amount) {
      setExpenseAmount(tx.amount.toString());
    }
    if (tx.description) {
      setExpenseDescription(tx.description);
    }
    if (tx.reference) {
      setExpenseReference(tx.reference);
    }
    if (tx.expenseAccountId) {
      setExpenseAccountId(tx.expenseAccountId);
    }
    if (tx.partnerId) {
      setFundingMode("PARTNER");
      setSelectedPartnerId(tx.partnerId);
    } else if (tx.isSupplierPayable) {
      setFundingMode("SUPPLIER");
    } else if (tx.paymentAccountId) {
      setFundingMode("COMPANY");
      setSelectedCompanyAccountId(tx.paymentAccountId);
    }
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Submit Business Expense with Evidence
  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessInfo(null);

    const numAmount = parseFloat(expenseAmount);
    if (
      (!expenseAccountId && !customCategoryName) ||
      isNaN(numAmount) ||
      numAmount <= 0 ||
      !expenseDescription
    ) {
      setErrorMessage("Please fill all required fields (Category, Amount, Description).");
      return;
    }

    if (fundingMode === "COMPANY" && !selectedCompanyAccountId) {
      setErrorMessage("Please select a company payment account.");
      return;
    }

    if (fundingMode === "PARTNER" && !selectedPartnerId) {
      setErrorMessage("Please select the partner who paid personally.");
      return;
    }

    setIsSubmittingExpense(true);

    try {
      const formData = new FormData();
      formData.append("action", "EXPENSE");
      if (expenseAccountId === "NEW_CUSTOM") {
        formData.append("customCategoryName", customCategoryName || expenseDescription);
      } else if (expenseAccountId) {
        formData.append("expenseAccountId", expenseAccountId);
      }

      if (fundingMode === "PARTNER") {
        formData.append("partnerId", selectedPartnerId);
      } else if (fundingMode === "SUPPLIER") {
        formData.append("isSupplierPayable", "true");
      } else {
        formData.append("paymentAccountId", selectedCompanyAccountId);
      }

      formData.append("amount", numAmount.toString());
      formData.append("description", expenseDescription.trim());
      if (expenseReference) formData.append("reference", expenseReference.trim());

      formData.append("idempotencyKey", `EXP_${Date.now()}`);

      for (const staged of expenseStagedFiles) {
        formData.append("files", staged.file);
      }

      const res = await fetch("/api/finance/entry-with-evidence", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to record business expense");
      }

      const attachedCount = data.documents?.length || 0;
      setSuccessInfo({
        message: correctionNotice
          ? "Corrected Business Expense posted successfully!"
          : "Business Expense posted successfully!",
        entryNumber: data.journal.entryNumber,
        journalId: data.journal.id,
        attachedCount,
      });

      // Reset form & correction notice
      setCorrectionNotice(null);
      setExpenseAccountId("");
      setCustomCategoryName("");
      setExpenseAmount("");
      setExpenseDescription("");
      setExpenseReference("");
      setExpenseStagedFiles([]);

      router.refresh();

      // Prepend to entries
      const newEntry: JournalEntryItem = {
        id: data.journal.id,
        entryNumber: data.journal.entryNumber,
        date: new Date(),
        entryType: "EXPENSE",
        description: expenseDescription,
        reference: expenseReference || null,
        status: "POSTED",
        amount: numAmount,
        expenseAccountId,
        partnerId: fundingMode === "PARTNER" ? selectedPartnerId : null,
        paymentAccountId: fundingMode === "COMPANY" ? selectedCompanyAccountId : null,
        isSupplierPayable: fundingMode === "SUPPLIER",
        evidence: data.documents || [],
      };
      setEntries((prev) => [newEntry, ...prev]);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to post business expense");
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  // Submit Inter-Account Transfer with Evidence
  const handleSubmitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessInfo(null);

    const numAmount = parseFloat(transferAmount);
    if (!fromAccountId || !toAccountId || isNaN(numAmount) || numAmount <= 0) {
      setErrorMessage("Please specify source, destination, and transfer amount.");
      return;
    }

    if (fromAccountId === toAccountId) {
      setErrorMessage("Source and destination accounts must be different.");
      return;
    }

    setIsSubmittingTransfer(true);

    try {
      const formData = new FormData();
      formData.append("action", "TRANSFER");
      formData.append("fromPaymentAccountId", fromAccountId);
      formData.append("toPaymentAccountId", toAccountId);
      formData.append("amount", numAmount.toString());
      if (transferReference) formData.append("reference", transferReference.trim());

      formData.append("idempotencyKey", `TRF_${Date.now()}`);

      for (const staged of transferStagedFiles) {
        formData.append("files", staged.file);
      }

      const res = await fetch("/api/finance/entry-with-evidence", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to transfer funds");
      }

      const attachedCount = data.documents?.length || 0;
      setSuccessInfo({
        message: "Inter-Account Transfer completed successfully!",
        entryNumber: data.journal.entryNumber,
        journalId: data.journal.id,
        attachedCount,
      });

      setFromAccountId("");
      setToAccountId("");
      setTransferAmount("");
      setTransferReference("");
      setTransferStagedFiles([]);

      router.refresh();

      const newEntry: JournalEntryItem = {
        id: data.journal.id,
        entryNumber: data.journal.entryNumber,
        date: new Date(),
        entryType: "TRANSFER",
        description: data.journal.description,
        reference: transferReference || null,
        status: "POSTED",
        evidence: data.documents || [],
      };
      setEntries((prev) => [newEntry, ...prev]);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to execute transfer");
    } finally {
      setIsSubmittingTransfer(false);
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

      {/* Action Forms Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Record Business Expense Quick Form */}
        <div ref={formRef} className="bg-afk-card p-6 rounded-xl border border-afk-border shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 pb-2 border-b border-afk-border/60">
              <Receipt className="w-4 h-4 text-afk-olive" />
              <div>
                <h3 className="text-sm font-semibold text-afk-offwhite">
                  Record Business Expense Quick Form
                </h3>
                <p className="text-[11px] text-afk-muted">
                  Operating expenses, factory advances, studio rent, partner reimbursables, or supplier bills with receipts.
                </p>
              </div>
            </div>

            {/* Correction Banner if loaded from a previous mistake */}
            {correctionNotice && (
              <div className="p-3 my-3 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs flex items-center justify-between gap-2 animate-in fade-in duration-200">
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

            <form onSubmit={handleSubmitExpense} className="space-y-3 pt-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-afk-muted mb-1 font-medium">Expense Category *</label>
                  <select
                    value={expenseAccountId}
                    onChange={(e) => setExpenseAccountId(e.target.value)}
                    required
                    className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
                  >
                    <option value="">Select Category...</option>
                    {expenseAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        [{a.code}] {a.name} {!a.isSystem ? "★" : ""}
                      </option>
                    ))}
                    <option value="NEW_CUSTOM">➕ New Custom Category...</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-afk-muted mb-1 font-medium">Payment / Due Source *</label>
                  <div className="grid grid-cols-3 gap-1 p-0.5 bg-afk-surface/80 border border-afk-border rounded mb-2">
                    <button
                      type="button"
                      onClick={() => setFundingMode("COMPANY")}
                      className={`py-1 px-1 rounded text-[10px] font-medium transition cursor-pointer text-center ${
                        fundingMode === "COMPANY"
                          ? "bg-afk-olive/25 text-afk-olive-light border border-afk-olive/50 font-bold"
                          : "text-afk-muted hover:text-afk-offwhite"
                      }`}
                      title="Paid immediately from company bank or cash"
                    >
                      🏢 Company
                    </button>
                    <button
                      type="button"
                      onClick={() => setFundingMode("PARTNER")}
                      className={`py-1 px-1 rounded text-[10px] font-medium transition cursor-pointer text-center ${
                        fundingMode === "PARTNER"
                          ? "bg-amber-500/25 text-amber-300 border border-amber-500/50 font-bold"
                          : "text-afk-muted hover:text-afk-offwhite"
                      }`}
                      title="Paid personally by partner (Due to Partner)"
                    >
                      👤 Due to Partner
                    </button>
                    <button
                      type="button"
                      onClick={() => setFundingMode("SUPPLIER")}
                      className={`py-1 px-1 rounded text-[10px] font-medium transition cursor-pointer text-center ${
                        fundingMode === "SUPPLIER"
                          ? "bg-blue-500/25 text-blue-300 border border-blue-500/50 font-bold"
                          : "text-afk-muted hover:text-afk-offwhite"
                      }`}
                      title="Recorded as an unpaid supplier invoice"
                    >
                      ⏳ Due / Baki
                    </button>
                  </div>

                  {fundingMode === "COMPANY" && (
                    <div>
                      <select
                        value={selectedCompanyAccountId}
                        onChange={(e) => setSelectedCompanyAccountId(e.target.value)}
                        required
                        className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
                      >
                        <option value="">Select Company Account...</option>
                        {paymentAccounts.map((pa) => (
                          <option key={pa.id} value={pa.id}>
                            {pa.name} ({pa.type})
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-afk-muted mt-1">Deducted from company bank/cash balance.</p>
                    </div>
                  )}

                  {fundingMode === "PARTNER" && (
                    <div>
                      <select
                        value={selectedPartnerId}
                        onChange={(e) => setSelectedPartnerId(e.target.value)}
                        required
                        className="w-full bg-afk-surface border border-amber-500/50 rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-amber-400"
                      >
                        <option value="">Select Partner who paid personally...</option>
                        {partners.map((p) => (
                          <option key={p.id} value={p.id}>
                            Paid by {p.name} (Due to {p.name})
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-amber-300/90 mt-1">
                        Company owes this to partner (Liability / Due to Partner). No bank/cash deducted.
                      </p>
                    </div>
                  )}

                  {fundingMode === "SUPPLIER" && (
                    <div className="p-2 rounded bg-blue-500/10 border border-blue-500/30 text-[11px] text-blue-300">
                      Recorded as an unpaid supplier bill (Trade Payables 2010). Company bank/cash is not deducted.
                    </div>
                  )}
                </div>
              </div>

              {expenseAccountId === "NEW_CUSTOM" && (
                <div>
                  <label className="block text-[11px] text-afk-olive mb-1 font-medium">Custom Category Name</label>
                  <input
                    type="text"
                    value={customCategoryName}
                    onChange={(e) => setCustomCategoryName(e.target.value)}
                    required
                    placeholder="e.g. Studio Lighting / Photo Shoot Equipment"
                    className="w-full bg-afk-surface border border-afk-olive rounded px-3 py-1.5 text-afk-offwhite focus:outline-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-afk-muted mb-1 font-medium">Amount (BDT ৳)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-afk-muted mb-1 font-medium">Invoice / Ref Number</label>
                  <input
                    type="text"
                    value={expenseReference}
                    onChange={(e) => setExpenseReference(e.target.value)}
                    placeholder="e.g. INV-9982 / Receipt #44"
                    className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-afk-muted mb-1 font-medium">Expense Description</label>
                <input
                  type="text"
                  required
                  value={expenseDescription}
                  onChange={(e) => setExpenseDescription(e.target.value)}
                  placeholder="e.g. Rib fabric sample purchase from Islampur"
                  className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
                />
              </div>

              {/* Integrated Evidence Uploader (Mode A) */}
              <div className="pt-1 border-t border-afk-border/50">
                <EvidenceUploader
                  mode="form"
                  label="Expense Receipts / Bills (Optional)"
                  helperText="Attach invoice, cash memo, or payment voucher screenshots."
                  defaultCategory="RECEIPT"
                  stagedFiles={expenseStagedFiles}
                  onStagedFilesChange={setExpenseStagedFiles}
                  compact
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingExpense}
                className="w-full py-2.5 bg-afk-olive hover:bg-afk-olive-light text-afk-offwhite font-semibold rounded-lg transition flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50 mt-2"
              >
                {isSubmittingExpense ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing & Converting WebP...</span>
                  </>
                ) : (
                  <span>Review & Post Expense</span>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Transfer Funds Between Payment Accounts Form */}
        <div className="bg-afk-card p-6 rounded-xl border border-afk-border shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 pb-2 border-b border-afk-border/60">
              <ArrowRightLeft className="w-4 h-4 text-afk-olive-accent" />
              <div>
                <h3 className="text-sm font-semibold text-afk-offwhite">
                  Inter-Account Fund Transfer
                </h3>
                <p className="text-[11px] text-afk-muted">
                  Move funds between Bank, Cash on Hand, bKash, and Nagad.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitTransfer} className="space-y-3 pt-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-afk-muted mb-1 font-medium">Source Account (From)</label>
                  <select
                    value={fromAccountId}
                    onChange={(e) => setFromAccountId(e.target.value)}
                    required
                    className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
                  >
                    <option value="">Select Source...</option>
                    {paymentAccounts.map((pa) => (
                      <option key={pa.id} value={pa.id}>
                        {pa.name} ({pa.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-afk-muted mb-1 font-medium">Destination Account (To)</label>
                  <select
                    value={toAccountId}
                    onChange={(e) => setToAccountId(e.target.value)}
                    required
                    className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
                  >
                    <option value="">Select Destination...</option>
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
                  <label className="block text-[11px] text-afk-muted mb-1 font-medium">Transfer Amount (BDT ৳)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite font-mono focus:outline-none focus:border-afk-olive"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-afk-muted mb-1 font-medium">Transfer Reference</label>
                  <input
                    type="text"
                    value={transferReference}
                    onChange={(e) => setTransferReference(e.target.value)}
                    placeholder="e.g. Bank Challan #9981 / Trx ID"
                    className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
                  />
                </div>
              </div>

              {/* Integrated Evidence Uploader (Mode A) */}
              <div className="pt-1 border-t border-afk-border/50">
                <EvidenceUploader
                  mode="form"
                  label="Transfer Confirmation Proof (Optional)"
                  helperText="Attach bank deposit receipt or MFS transaction screenshot."
                  defaultCategory="PAYMENT_PROOF"
                  stagedFiles={transferStagedFiles}
                  onStagedFilesChange={setTransferStagedFiles}
                  compact
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingTransfer}
                className="w-full py-2.5 bg-afk-surface hover:bg-afk-border/80 border border-afk-border text-afk-offwhite font-semibold rounded-lg transition flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50 mt-2"
              >
                {isSubmittingTransfer ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing & Converting WebP...</span>
                  </>
                ) : (
                  <span>Review & Transfer Funds</span>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Posted Journal Entries Table with Evidence Badges and Add Proof */}
      <div className="bg-afk-card rounded-xl border border-afk-border p-6 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-afk-border/60">
          <div>
            <h3 className="text-sm font-semibold text-afk-offwhite">
              General Ledger Journal Entries
            </h3>
            <p className="text-[11px] text-afk-muted">
              Balanced transactions with audit trail and linked supporting documentation.
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
                  {entries.filter((e) => e.status !== "REVERSED" && e.entryType !== "REVERSAL").length}
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
                  {entries.length}
                </span>
              </button>
            </div>
          </div>
        </div>

        {viewMode === "ACTIVE" && entries.some((e) => e.status === "REVERSED" || e.entryType === "REVERSAL") && (
          <div className="p-2.5 rounded bg-afk-surface/60 border border-afk-border text-[11px] text-afk-muted flex items-center justify-between">
            <span>
              💡 Cancelled and offset reversal transactions are hidden in Active View to keep your financial ledger clean.
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

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-afk-border text-afk-muted">
                <th className="py-2.5 font-medium">Entry Number</th>
                <th className="py-2.5 font-medium">Type</th>
                <th className="py-2.5 font-medium">Date</th>
                <th className="py-2.5 font-medium">Description</th>
                <th className="py-2.5 font-medium">Reference</th>
                <th className="py-2.5 font-medium text-center">Status</th>
                <th className="py-2.5 font-medium text-center">Supporting Proof</th>
                <th className="py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-afk-border/40">
              {(() => {
                const displayedEntries =
                  viewMode === "ACTIVE"
                    ? entries.filter((e) => e.status !== "REVERSED" && e.entryType !== "REVERSAL")
                    : entries;

                if (displayedEntries.length === 0) {
                  return (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-afk-muted font-sans">
                        No transactions to display in this view.
                      </td>
                    </tr>
                  );
                }

                return displayedEntries.map((entry) => {
                  const isReversal = entry.entryType === "REVERSAL";
                  const isReversed = entry.status === "REVERSED";

                  return (
                    <tr
                      key={entry.id}
                      className={`hover:bg-afk-surface/30 transition-colors ${
                        isReversed ? "opacity-60 bg-red-500/[0.02]" : isReversal ? "bg-amber-500/[0.02]" : ""
                      }`}
                    >
                      <td className="py-2.5 font-bold text-afk-offwhite flex items-center gap-1.5">
                        <span>{entry.entryNumber}</span>
                      </td>

                      <td className="py-2.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold border ${
                            isReversal
                              ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                              : "bg-afk-surface border-afk-border text-afk-muted"
                          }`}
                        >
                          {entry.entryType}
                        </span>
                      </td>

                      <td className="py-2.5 text-afk-muted">
                        {new Date(entry.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>

                      <td
                        className={`py-2.5 font-sans max-w-xs truncate ${
                          isReversed
                            ? "line-through text-afk-muted"
                            : isReversal
                            ? "text-amber-300/90"
                            : "text-afk-offwhite"
                        }`}
                        title={entry.description}
                      >
                        {entry.description}
                      </td>

                      <td className="py-2.5 text-afk-muted">{entry.reference || "—"}</td>

                      <td className="py-2.5 text-center">
                        {isReversal ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold text-amber-300 bg-amber-500/15 border border-amber-500/30">
                            OFFSET
                          </span>
                        ) : isReversed ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold text-red-400 bg-red-500/15 border border-red-500/30">
                            REVERSED
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold text-afk-success bg-afk-olive-dark border border-afk-olive">
                            {entry.status}
                          </span>
                        )}
                      </td>

                      {/* Supporting Proof indicator */}
                      <td className="py-2.5 text-center font-sans">
                        {entry.evidence && entry.evidence.length > 0 ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openViewerForEntry(entry.evidence)}
                              className="px-2 py-0.5 rounded-full bg-afk-surface hover:bg-afk-border text-afk-olive hover:text-afk-olive-light text-[10px] font-medium border border-afk-border flex items-center gap-1 transition cursor-pointer"
                              title="Click to view attached evidence in lightbox"
                            >
                              <Paperclip className="w-3 h-3 text-afk-olive" />
                              <span>{entry.evidence.length}</span>
                            </button>

                            {entry.evidence[0]?.thumbnailUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={entry.evidence[0].thumbnailUrl}
                                alt="Proof thumb"
                                onClick={() => openViewerForEntry(entry.evidence)}
                                className="w-5 h-5 rounded object-cover border border-afk-border cursor-pointer hover:scale-110 transition"
                              />
                            )}
                          </div>
                        ) : (
                          <span className="text-afk-muted text-[10px] italic">None</span>
                        )}
                      </td>

                      {/* Actions: Add Proof, Voucher, Re-enter, Reverse */}
                      <td className="py-2.5 text-right font-sans">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isReversed && !isReversal && (
                            <button
                              type="button"
                              onClick={() => setAddProofEntry(entry)}
                              className="px-2 py-1 rounded bg-afk-surface hover:bg-afk-border text-afk-muted hover:text-afk-offwhite text-[11px] font-medium border border-afk-border flex items-center gap-1 transition cursor-pointer"
                              title="Attach proof to this journal entry"
                            >
                              <Paperclip className="w-3 h-3 text-afk-olive" />
                              <span>Add Proof</span>
                            </button>
                          )}

                          <Link
                            href={`/print/voucher/${entry.id}`}
                            target="_blank"
                            className="px-2 py-1 rounded bg-afk-surface hover:bg-afk-border text-afk-muted hover:text-afk-offwhite text-[11px] font-medium border border-afk-border flex items-center gap-1 transition"
                            title="Print official voucher"
                          >
                            <FileText className="w-3 h-3 text-afk-olive-accent" />
                            <span>Voucher</span>
                          </Link>

                          {canManage && (
                            isReversal ? (
                              <span className="px-2 py-0.5 rounded text-[10px] text-amber-300/70 bg-amber-500/10 border border-amber-500/20 font-medium">
                                Offset Entry
                              </span>
                            ) : isReversed ? (
                              <div className="flex items-center gap-1">
                                <span className="px-2 py-0.5 rounded text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 font-medium">
                                  Reversed
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleLoadForCorrection(entry)}
                                  className="px-2 py-1 rounded bg-afk-surface hover:bg-amber-500/15 text-afk-muted hover:text-amber-400 text-[11px] font-medium border border-afk-border hover:border-amber-500/40 flex items-center gap-1 transition cursor-pointer"
                                  title="Load this entry's details into the form to make corrections"
                                >
                                  <RotateCcw className="w-3 h-3 text-amber-400" />
                                  <span>Re-enter / Correct</span>
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setReversingEntry(entry)}
                                className="px-2 py-1 rounded bg-afk-surface hover:bg-amber-500/15 text-afk-muted hover:text-amber-400 text-[11px] font-medium border border-afk-border hover:border-amber-500/40 flex items-center gap-1 transition cursor-pointer"
                                title="Reverse or correct this journal entry"
                              >
                                <RotateCcw className="w-3 h-3 text-amber-400" />
                                <span>Reverse</span>
                              </button>
                            )
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
      {addProofEntry && (
        <AddProofModal
          isOpen={!!addProofEntry}
          onClose={() => setAddProofEntry(null)}
          entityType="JOURNAL_ENTRY"
          entityId={addProofEntry.id}
          referenceId={addProofEntry.entryNumber}
          title={`Attach Evidence to ${addProofEntry.entryNumber}`}
          module="FINANCE"
          defaultCategory="RECEIPT"
          onSuccess={(newDocs) => {
            setEntries((prev) =>
              prev.map((item) =>
                item.id === addProofEntry.id
                  ? { ...item, evidence: [...newDocs, ...(item.evidence || [])] }
                  : item
              )
            );
            router.refresh();
          }}
        />
      )}

      {/* Reverse Transaction Modal */}
      {reversingEntry && (
        <ReverseTransactionModal
          isOpen={!!reversingEntry}
          onClose={() => setReversingEntry(null)}
          transaction={reversingEntry}
          onSuccess={(reversal) => {
            setSuccessInfo({
              message: `Journal entry ${reversingEntry.entryNumber} reversed successfully! Offset entry posted: ${reversal.entryNumber}`,
              entryNumber: reversal.entryNumber,
              journalId: reversal.id,
              attachedCount: 0,
            });
            setEntries((prev) => [
              {
                id: reversal.id,
                entryNumber: reversal.entryNumber,
                date: new Date(),
                entryType: "REVERSAL",
                description: reversal.description,
                reference: reversingEntry.entryNumber,
                status: "POSTED",
                evidence: [],
              },
              ...prev.map((item) =>
                item.id === reversingEntry.id ? { ...item, status: "REVERSED" } : item
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
