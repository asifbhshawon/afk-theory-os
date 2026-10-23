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
  const [entries, setEntries] = useState<JournalEntryItem[]>(initialEntries);

  // Success & Error alerts
  const [successInfo, setSuccessInfo] = useState<{
    message: string;
    entryNumber: string;
    journalId: string;
    attachedCount: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form 1: Business Expense
  const [expenseAccountId, setExpenseAccountId] = useState("");
  const [customCategoryName, setCustomCategoryName] = useState("");
  const [fundingSource, setFundingSource] = useState("");
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

  // Submit Business Expense with Evidence
  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessInfo(null);

    const numAmount = parseFloat(expenseAmount);
    if (
      (!expenseAccountId && !customCategoryName) ||
      !fundingSource ||
      isNaN(numAmount) ||
      numAmount <= 0 ||
      !expenseDescription
    ) {
      setErrorMessage("Please fill all required fields (Category, Funding Source, Amount, Description).");
      return;
    }

    let paymentAccountId: string | undefined;
    let partnerId: string | undefined;

    if (fundingSource.startsWith("partner_")) {
      partnerId = fundingSource.replace("partner_", "");
    } else if (fundingSource.startsWith("pay_")) {
      paymentAccountId = fundingSource.replace("pay_", "");
    } else {
      paymentAccountId = fundingSource;
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
      if (paymentAccountId) formData.append("paymentAccountId", paymentAccountId);
      if (partnerId) formData.append("partnerId", partnerId);
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
        message: "Business Expense posted successfully!",
        entryNumber: data.journal.entryNumber,
        journalId: data.journal.id,
        attachedCount,
      });

      // Reset form
      setExpenseAccountId("");
      setCustomCategoryName("");
      setFundingSource("");
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
        <div className="bg-afk-charcoal p-5 rounded-xl border border-afk-border flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 pb-2 border-b border-afk-border/60">
              <Receipt className="w-4 h-4 text-afk-olive" />
              <div>
                <h3 className="text-sm font-semibold text-afk-offwhite">
                  Record Business Expense Quick Form
                </h3>
                <p className="text-[11px] text-afk-muted">
                  Operating expenses, factory advances, studio rent or partner reimbursables with receipts.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitExpense} className="space-y-3 pt-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-afk-muted mb-1 font-medium">Expense Category</label>
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
                  <label className="block text-[11px] text-afk-muted mb-1 font-medium">Paid From / Reimbursable</label>
                  <select
                    value={fundingSource}
                    onChange={(e) => setFundingSource(e.target.value)}
                    required
                    className="w-full bg-afk-surface border border-afk-border rounded px-3 py-1.5 text-afk-offwhite focus:outline-none focus:border-afk-olive"
                  >
                    <option value="">Select Funding Source...</option>
                    <optgroup label="Company Cash & Accounts">
                      {paymentAccounts.map((pa) => (
                        <option key={pa.id} value={`pay_${pa.id}`}>
                          {pa.name} ({pa.type})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Paid Personally by Partner (Reimbursable)">
                      {partners.map((p) => (
                        <option key={p.id} value={`partner_${p.id}`}>
                          Paid by {p.name} (Due to Partner)
                        </option>
                      ))}
                    </optgroup>
                  </select>
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
        <div className="bg-afk-charcoal p-5 rounded-xl border border-afk-border flex flex-col justify-between space-y-4">
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
      <div className="bg-afk-charcoal rounded-xl border border-afk-border p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-afk-border/60">
          <div>
            <h3 className="text-sm font-semibold text-afk-offwhite">
              General Ledger Journal Entries
            </h3>
            <p className="text-[11px] text-afk-muted">
              Balanced transactions with audit trail and linked supporting documentation.
            </p>
          </div>
          <span className="text-xs font-mono text-afk-muted">
            {entries.length} posted entries
          </span>
        </div>

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
            <tbody className="divide-y divide-afk-border/40 font-mono">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-afk-muted font-sans">
                    No journal entries recorded yet. Record an expense or receive goods to start posting.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-afk-surface/30 transition-colors">
                    <td className="py-2.5 font-bold text-afk-offwhite">{entry.entryNumber}</td>
                    <td className="py-2.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold bg-afk-surface border border-afk-border text-afk-muted">
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
                    <td className="py-2.5 text-afk-offwhite font-sans max-w-xs truncate" title={entry.description}>
                      {entry.description}
                    </td>
                    <td className="py-2.5 text-afk-muted">{entry.reference || "—"}</td>
                    <td className="py-2.5 text-center">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold ${
                          entry.status === "POSTED"
                            ? "text-afk-success bg-afk-olive-dark border border-afk-olive"
                            : "text-afk-danger bg-afk-danger/20"
                        }`}
                      >
                        {entry.status}
                      </span>
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

                    {/* Actions: Add Proof, Voucher, Reverse */}
                    <td className="py-2.5 text-right font-sans">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setAddProofEntry(entry)}
                          className="px-2 py-1 rounded bg-afk-surface hover:bg-afk-border text-afk-muted hover:text-afk-offwhite text-[11px] font-medium border border-afk-border flex items-center gap-1 transition cursor-pointer"
                          title="Attach proof to this journal entry"
                        >
                          <Paperclip className="w-3 h-3 text-afk-olive" />
                          <span>Add Proof</span>
                        </button>

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
                          entry.status === "REVERSED" ? (
                            <span className="px-2 py-0.5 rounded text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 font-medium">
                              Reversed
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setReversingEntry(entry)}
                              className="px-2 py-1 rounded bg-afk-surface hover:bg-amber-500/15 text-afk-muted hover:text-amber-400 text-[11px] font-medium border border-afk-border hover:border-amber-500/40 flex items-center gap-1 transition cursor-pointer"
                              title="Reverse this journal entry"
                            >
                              <RotateCcw className="w-3 h-3 text-amber-400" />
                              <span>Reverse</span>
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
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
              message: `Journal entry ${reversingEntry.entryNumber} reversed successfully! Reversing entry posted: ${reversal.entryNumber}`,
              entryNumber: reversal.entryNumber,
              journalId: reversal.id,
              attachedCount: 0,
            });
            setEntries((prev) =>
              prev.map((item) =>
                item.id === reversingEntry.id ? { ...item, status: "REVERSED" } : item
              )
            );
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
