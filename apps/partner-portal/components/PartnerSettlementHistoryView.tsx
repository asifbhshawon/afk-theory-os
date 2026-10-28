"use client";

import { useState } from "react";
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Search,
  Filter,
  Printer,
  ChevronDown,
  ChevronUp,
  FileText,
  CheckCircle2,
  Calendar,
  Layers,
  User,
  ExternalLink,
  Coins,
} from "lucide-react";
import { formatBdt, formatDate, formatDateTime } from "@/lib/format";
import { PortalPartner } from "@/lib/auth";

export interface SettlementTransaction {
  id: string;
  date: string;
  partnerId: string;
  partnerName: string;
  type: string;
  typeLabel?: string;
  description: string;
  memo?: string;
  journalNumber?: string;
  accountName?: string;
  paymentMethod?: string;
  amount: number;
  isCredit?: boolean;
  status: string;
  hasEvidence?: boolean;
}

export interface PartnerStatementData {
  partnerId: string;
  name: string;
  email: string;
  ownershipPct: string;
  profitSharePct: string;
  capitalContributed: string | number;
  drawings: string | number;
  loanBalanceOwed: string | number;
  shareOfProfit: string | number;
  totalEquity: string | number;
  ventureContributions?: string | number;
  ventureEntitlements?: string | number;
  settlementHistory?: SettlementTransaction[];
}

export function PartnerSettlementHistoryView({
  currentPartner,
  allStatements,
}: {
  currentPartner: PortalPartner;
  allStatements: PartnerStatementData[];
}) {
  // Extract all transactions across all statements
  const allTransactions: SettlementTransaction[] = allStatements.flatMap((s) => {
    const history = Array.isArray(s.settlementHistory) ? s.settlementHistory : [];
    return history.map((item) => ({
      ...item,
      partnerId: item.partnerId || s.partnerId,
      partnerName: item.partnerName || s.name,
    }));
  });

  // Sort by date DESC
  allTransactions.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const [activeTab, setActiveTab] = useState<"MY_HISTORY" | "ALL_PARTNERS">("MY_HISTORY");
  const [selectedPartnerFilter, setSelectedPartnerFilter] = useState<string>("ALL");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Compute transactions based on tab and filters
  const currentPartnerHistory = allTransactions.filter(
    (t) => t.partnerId === currentPartner.id
  );

  const baseTransactions =
    activeTab === "MY_HISTORY" ? currentPartnerHistory : allTransactions;

  const filteredTransactions = baseTransactions.filter((item) => {
    if (activeTab === "ALL_PARTNERS" && selectedPartnerFilter !== "ALL") {
      if (item.partnerId !== selectedPartnerFilter) return false;
    }
    if (selectedTypeFilter !== "ALL" && item.type !== selectedTypeFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchDesc = item.description?.toLowerCase().includes(q);
      const matchMemo = item.memo?.toLowerCase().includes(q);
      const matchPartner = item.partnerName?.toLowerCase().includes(q);
      const matchJournal = item.journalNumber?.toLowerCase().includes(q);
      const matchMethod = item.paymentMethod?.toLowerCase().includes(q);
      if (!matchDesc && !matchMemo && !matchPartner && !matchJournal && !matchMethod) {
        return false;
      }
    }
    return true;
  });

  // Calculate summary KPI values
  const currentStatement = allStatements.find((s) => s.partnerId === currentPartner.id);

  const summaryCapital =
    activeTab === "MY_HISTORY"
      ? Number(currentStatement?.capitalContributed || 0)
      : allStatements.reduce((sum, s) => sum + Number(s.capitalContributed || 0), 0);

  const summaryDrawings =
    activeTab === "MY_HISTORY"
      ? Number(currentStatement?.drawings || 0)
      : allStatements.reduce((sum, s) => sum + Number(s.drawings || 0), 0);

  const summaryLoans =
    activeTab === "MY_HISTORY"
      ? Number(currentStatement?.loanBalanceOwed || 0)
      : allStatements.reduce((sum, s) => sum + Number(s.loanBalanceOwed || 0), 0);

  const summaryEquity =
    activeTab === "MY_HISTORY"
      ? Number(currentStatement?.totalEquity || 0)
      : allStatements.reduce((sum, s) => sum + Number(s.totalEquity || 0), 0);

  const handlePrint = () => {
    window.print();
  };

  const toggleRow = (id: string) => {
    setExpandedRowId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="bg-afk-card p-5 sm:p-6 rounded-xl border border-afk-border shadow-sm space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-afk-border">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-afk-offwhite flex items-center gap-2">
              <span>Partner Settlement & Distribution History</span>
            </h2>
            <span className="text-2xs px-2 py-0.5 rounded-full bg-afk-olive/30 border border-afk-olive text-afk-olive-accent font-semibold">
              Verified Ledger
            </span>
          </div>
          <p className="text-xs text-afk-secondary mt-1">
            Authoritative breakdown of capital injections, drawings, reimbursable loans, venture distributions and profit share allocations
          </p>
        </div>

        <div className="flex items-center gap-2 no-print flex-wrap">
          {/* View Tab Switcher */}
          <div className="flex items-center p-1 rounded-lg bg-afk-surface border border-afk-border">
            <button
              onClick={() => {
                setActiveTab("MY_HISTORY");
                setSelectedPartnerFilter("ALL");
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                activeTab === "MY_HISTORY"
                  ? "bg-afk-card text-afk-gold shadow-sm"
                  : "text-afk-muted hover:text-afk-offwhite"
              }`}
            >
              My History ({currentPartner.name})
            </button>
            <button
              onClick={() => setActiveTab("ALL_PARTNERS")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === "ALL_PARTNERS"
                  ? "bg-afk-card text-afk-gold shadow-sm"
                  : "text-afk-muted hover:text-afk-offwhite"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All Partners Consolidated</span>
            </button>
          </div>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-afk-surface hover:bg-afk-elevated border border-afk-border text-xs text-afk-offwhite font-medium transition"
            title="Print Partner Settlement Ledger"
          >
            <Printer className="w-3.5 h-3.5 text-afk-gold" />
            <span className="hidden sm:inline">Print Ledger</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards for History Context */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-afk-surface border border-afk-border">
          <span className="text-2xs text-afk-secondary uppercase font-semibold block">
            {activeTab === "MY_HISTORY" ? "My Capital Deposited" : "Total Firm Capital"}
          </span>
          <span className="text-lg font-bold text-emerald-400 block mt-1 tabular-nums">
            {formatBdt(summaryCapital)}
          </span>
          <span className="text-3xs text-afk-muted mt-0.5 block">
            Confirmed equity cash contributions
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-afk-surface border border-afk-border">
          <span className="text-2xs text-afk-secondary uppercase font-semibold block">
            {activeTab === "MY_HISTORY" ? "My Drawings" : "Total Firm Drawings"}
          </span>
          <span className="text-lg font-bold text-amber-400 block mt-1 tabular-nums">
            {formatBdt(summaryDrawings)}
          </span>
          <span className="text-3xs text-afk-muted mt-0.5 block">
            Personal withdrawals & cash advances
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-afk-surface border border-afk-border">
          <span className="text-2xs text-afk-secondary uppercase font-semibold block">
            {activeTab === "MY_HISTORY" ? "Due from Company" : "Outstanding Partner Loans"}
          </span>
          <span className="text-lg font-bold text-afk-offwhite block mt-1 tabular-nums">
            {formatBdt(summaryLoans)}
          </span>
          <span className="text-3xs text-afk-muted mt-0.5 block">
            Reimbursable claims owed by firm
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-afk-surface border border-afk-border">
          <span className="text-2xs text-afk-secondary uppercase font-semibold block">
            {activeTab === "MY_HISTORY" ? "My Net Partner Equity" : "Firm Net Partner Equity"}
          </span>
          <span className={`text-lg font-bold block mt-1 tabular-nums ${summaryEquity >= 0 ? "text-afk-gold" : "text-rose-400"}`}>
            {formatBdt(summaryEquity)}
          </span>
          <span className="text-3xs text-afk-muted mt-0.5 block">
            Capital − Drawings + Allocated Profit/Loss
          </span>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="no-print space-y-3 bg-afk-surface/40 p-3 rounded-xl border border-afk-border">
        {/* Partner Pills (When on All Partners Tab) */}
        {activeTab === "ALL_PARTNERS" && (
          <div className="flex items-center gap-1.5 flex-wrap pb-2 border-b border-afk-border/50">
            <span className="text-2xs text-afk-muted font-semibold uppercase pr-1">
              Filter Partner:
            </span>
            <button
              onClick={() => setSelectedPartnerFilter("ALL")}
              className={`px-2.5 py-1 rounded-md text-2xs font-semibold transition ${
                selectedPartnerFilter === "ALL"
                  ? "bg-afk-olive text-afk-offwhite"
                  : "bg-afk-card border border-afk-border text-afk-secondary hover:text-afk-offwhite"
              }`}
            >
              All Partners ({allTransactions.length})
            </button>
            {allStatements.map((s) => {
              const count = allTransactions.filter((t) => t.partnerId === s.partnerId).length;
              return (
                <button
                  key={s.partnerId}
                  onClick={() => setSelectedPartnerFilter(s.partnerId)}
                  className={`px-2.5 py-1 rounded-md text-2xs font-semibold transition flex items-center gap-1 ${
                    selectedPartnerFilter === s.partnerId
                      ? "bg-afk-olive text-afk-offwhite"
                      : "bg-afk-card border border-afk-border text-afk-secondary hover:text-afk-offwhite"
                  }`}
                >
                  <span>{s.name}</span>
                  <span className="text-3xs opacity-80">({count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Secondary Filters: Type & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-2xs text-afk-muted font-semibold uppercase">Type:</span>
            <select
              value={selectedTypeFilter}
              onChange={(e) => setSelectedTypeFilter(e.target.value)}
              className="bg-afk-card border border-afk-border rounded-md px-2.5 py-1 text-xs text-afk-offwhite focus:outline-none focus:border-afk-olive"
            >
              <option value="ALL">All Transaction Types</option>
              <option value="CAPITAL_DEPOSIT">Capital Contributions</option>
              <option value="DRAWING">Partner Drawings</option>
              <option value="LOAN_ADVANCE">Reimbursable Loan Advances</option>
              <option value="LOAN_REVERSAL">Loan Reversals & Repayments</option>
              <option value="PROFIT_SHARE">Profit & Loss Share Allocations</option>
              <option value="VENTURE_SETTLEMENT">Venture Settlement Distributions</option>
            </select>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-afk-muted" />
            <input
              type="text"
              placeholder="Search by description, voucher, memo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-afk-card border border-afk-border rounded-md pl-8 pr-2.5 py-1 text-xs text-afk-offwhite placeholder:text-afk-subtle focus:outline-none focus:border-afk-olive w-full sm:w-64"
            />
          </div>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-afk-border text-afk-secondary bg-afk-surface/40">
              <th className="py-2.5 px-3">Date</th>
              {activeTab === "ALL_PARTNERS" && <th className="py-2.5 px-3">Partner</th>}
              <th className="py-2.5 px-3">Particulars / Journal Voucher</th>
              <th className="py-2.5 px-3">Account / Method</th>
              <th className="py-2.5 px-3">Type</th>
              <th className="py-2.5 px-3 text-right">Amount (BDT)</th>
              <th className="py-2.5 px-3 text-center">Status</th>
              <th className="py-2.5 px-2 text-center no-print">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-afk-border">
            {filteredTransactions.length === 0 ? (
              <tr>
                <td
                  colSpan={activeTab === "ALL_PARTNERS" ? 8 : 7}
                  className="py-8 text-center text-afk-muted"
                >
                  <Coins className="w-6 h-6 mx-auto mb-2 text-afk-secondary/50" />
                  <p className="font-medium">No distribution or settlement transactions found matching criteria.</p>
                  <p className="text-2xs text-afk-subtle mt-0.5">Try resetting search or filter options.</p>
                </td>
              </tr>
            ) : (
              filteredTransactions.map((item, idx) => {
                const isExpanded = expandedRowId === item.id;
                const isPositive =
                  item.type === "CAPITAL_DEPOSIT" ||
                  item.type === "LOAN_ADVANCE" ||
                  (item.type === "PROFIT_SHARE" && item.amount >= 0);

                return (
                  <tr
                    key={item.id || idx}
                    className="hover:bg-afk-surface/40 transition group"
                  >
                    {/* Date */}
                    <td className="py-3 px-3 text-afk-muted font-mono whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-afk-secondary" />
                        <span>{formatDate(item.date)}</span>
                      </div>
                      <span className="text-3xs text-afk-subtle block pl-4">
                        {formatDateTime(item.date).split(",")[1] || ""}
                      </span>
                    </td>

                    {/* Partner (if viewing all) */}
                    {activeTab === "ALL_PARTNERS" && (
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-afk-surface border border-afk-border flex items-center justify-center text-3xs font-bold text-afk-gold">
                            {item.partnerName ? item.partnerName.charAt(0) : "P"}
                          </div>
                          <span className="font-semibold text-afk-offwhite text-xs">
                            {item.partnerName}
                          </span>
                        </div>
                      </td>
                    )}

                    {/* Particulars & Voucher */}
                    <td className="py-3 px-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-afk-offwhite">
                            {item.description || "Partner Settlement Transaction"}
                          </span>
                          {item.journalNumber && (
                            <span className="text-3xs px-1.5 py-0.2 rounded bg-afk-card border border-afk-border text-afk-gold font-mono">
                              {item.journalNumber}
                            </span>
                          )}
                          {item.hasEvidence && (
                            <span className="text-3xs px-1 rounded bg-emerald-950/50 text-emerald-300 border border-emerald-800 font-mono">
                              Receipt on File
                            </span>
                          )}
                        </div>
                        {item.memo && item.memo !== item.description && (
                          <p className="text-2xs text-afk-secondary italic">{item.memo}</p>
                        )}
                      </div>
                    </td>

                    {/* Account / Method */}
                    <td className="py-3 px-3 whitespace-nowrap text-afk-secondary font-mono text-2xs">
                      {item.paymentMethod || item.accountName || "General Ledger"}
                    </td>

                    {/* Type Badge */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {item.type === "CAPITAL_DEPOSIT" && (
                        <span className="text-2xs px-2 py-0.5 rounded font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800">
                          Capital Contribution
                        </span>
                      )}
                      {item.type === "DRAWING" && (
                        <span className="text-2xs px-2 py-0.5 rounded font-medium bg-amber-950/60 text-amber-400 border border-amber-800">
                          Partner Drawing
                        </span>
                      )}
                      {item.type === "LOAN_ADVANCE" && (
                        <span className="text-2xs px-2 py-0.5 rounded font-medium bg-purple-950/60 text-purple-400 border border-purple-800">
                          Reimbursable Loan
                        </span>
                      )}
                      {item.type === "LOAN_REVERSAL" && (
                        <span className="text-2xs px-2 py-0.5 rounded font-medium bg-sky-950/60 text-sky-400 border border-sky-800">
                          Loan Reversal
                        </span>
                      )}
                      {item.type === "PROFIT_SHARE" && (
                        <span className="text-2xs px-2 py-0.5 rounded font-medium bg-indigo-950/60 text-indigo-400 border border-indigo-800">
                          Profit / Loss Share (20%)
                        </span>
                      )}
                      {item.type === "VENTURE_SETTLEMENT" && (
                        <span className="text-2xs px-2 py-0.5 rounded font-medium bg-teal-950/60 text-teal-400 border border-teal-800">
                          Venture Distribution
                        </span>
                      )}
                      {!["CAPITAL_DEPOSIT", "DRAWING", "LOAN_ADVANCE", "LOAN_REVERSAL", "PROFIT_SHARE", "VENTURE_SETTLEMENT"].includes(item.type) && (
                        <span className="text-2xs px-2 py-0.5 rounded font-medium bg-afk-surface border border-afk-border text-afk-secondary uppercase">
                          {item.type || "SETTLEMENT"}
                        </span>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="py-3 px-3 text-right font-bold tabular-nums whitespace-nowrap">
                      <span className={isPositive ? "text-emerald-400" : "text-afk-gold"}>
                        {isPositive ? "+" : ""}
                        {formatBdt(item.amount)}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-2xs px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>{item.status || "CONFIRMED"}</span>
                      </span>
                    </td>

                    {/* Expand row */}
                    <td className="py-3 px-2 text-center no-print">
                      <button
                        onClick={() => toggleRow(item.id)}
                        className="p-1 rounded text-afk-muted hover:text-afk-offwhite hover:bg-afk-surface transition"
                        title="Toggle full accounting journal details"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Expandable Detail Sub-Drawer (if a row is expanded) */}
      {expandedRowId && (
        <div className="no-print p-4 rounded-xl bg-afk-surface border border-afk-border space-y-3 animate-fadeIn">
          {(() => {
            const exp = filteredTransactions.find((t) => t.id === expandedRowId);
            if (!exp) return null;
            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-afk-border">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-afk-gold" />
                    <span className="text-xs font-bold text-afk-offwhite">
                      General Ledger Journal Record Details
                    </span>
                  </div>
                  <button
                    onClick={() => setExpandedRowId(null)}
                    className="text-2xs text-afk-muted hover:text-afk-offwhite"
                  >
                    Close
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-2xs text-afk-muted block">Journal Number</span>
                    <span className="font-mono text-afk-gold font-bold">{exp.journalNumber || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-2xs text-afk-muted block">Partner Identity</span>
                    <span className="font-semibold text-afk-offwhite">{exp.partnerName} ({exp.partnerId})</span>
                  </div>
                  <div>
                    <span className="text-2xs text-afk-muted block">Posting Timestamp</span>
                    <span className="font-mono text-afk-secondary">{formatDateTime(exp.date)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2 border-t border-afk-border/40">
                  <div>
                    <span className="text-2xs text-afk-muted block">Target GL Account</span>
                    <span className="font-mono text-afk-offwhite">{exp.accountName || "Capital / Liability Account"}</span>
                  </div>
                  <div>
                    <span className="text-2xs text-afk-muted block">Settlement Channel</span>
                    <span className="font-mono text-afk-offwhite">{exp.paymentMethod || "Direct Settlement"}</span>
                  </div>
                </div>

                <div className="text-2xs text-afk-secondary bg-afk-card p-2.5 rounded-lg border border-afk-border">
                  <strong className="text-afk-offwhite">Audit Trail & Particulars:</strong> {exp.description}
                  {exp.memo && exp.memo !== exp.description && <span> — <em>{exp.memo}</em></span>}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
