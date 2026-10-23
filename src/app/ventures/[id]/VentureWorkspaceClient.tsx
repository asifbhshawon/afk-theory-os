"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Layers,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Coins,
  Shield,
  FileText,
  Clock,
  Plus,
  DollarSign,
  PieChart,
  Sliders,
  Sparkles,
  Printer,
  ChevronRight,
  Percent,
} from "lucide-react";
import { ContributionType } from "@/server/services/funding";

interface Props {
  venture: any;
  fundingSummary: any;
  contributions: any[];
  financials: any;
  settlements: any[];
  customFieldDefs: any[];
  customFieldVals: any;
  paymentAccounts: any[];
  partners: any[];
  currentUser: any;
  onTransitionStage: (newStage: string, notes?: string) => Promise<void>;
  onApproveAgreement: (agreementId: string) => Promise<void>;
  onRecordContribution: (data: any) => Promise<void>;
  onCreateSettlement: (data: any) => Promise<void>;
  onApproveSettlement: (settlementId: string) => Promise<void>;
  onDisburseSettlement: (data: any) => Promise<void>;
  onSaveCustomFields: (values: Record<string, any>) => Promise<void>;
}

export function VentureWorkspaceClient({
  venture,
  fundingSummary,
  contributions,
  financials,
  settlements,
  customFieldDefs,
  customFieldVals,
  paymentAccounts,
  partners,
  currentUser,
  onTransitionStage,
  onApproveAgreement,
  onRecordContribution,
  onCreateSettlement,
  onApproveSettlement,
  onDisburseSettlement,
  onSaveCustomFields,
}: Props) {
  const [activeTab, setActiveTab] = useState<"overview" | "agreement" | "funding" | "waterfall" | "custom_fields">("overview");
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modals & form state
  const [showContributionModal, setShowContributionModal] = useState(false);
  const [contribParticipantId, setContribParticipantId] = useState("");
  const [contribType, setContribType] = useState<ContributionType>("CASH");
  const [contribAmount, setContribAmount] = useState<number>(10000);
  const [contribPaymentAccId, setContribPaymentAccId] = useState(paymentAccounts[0]?.id || "");
  const [contribDescription, setContribDescription] = useState("");
  const [contribPostLedger, setContribPostLedger] = useState(true);

  // Settlement creation state
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [settlementProfitOverride, setSettlementProfitOverride] = useState<number>(financials.netProfit);
  const [settlementType, setSettlementType] = useState<"FULL" | "PARTIAL" | "REINVESTMENT" | "LOSS_CARRYFORWARD">("FULL");
  const [settlementNotes, setSettlementNotes] = useState("");

  // Settlement disburse state
  const [disburseSettlementId, setDisburseSettlementId] = useState<string | null>(null);
  const [disbursePaymentAccId, setDisbursePaymentAccId] = useState(paymentAccounts[0]?.id || "");

  // Live waterfall simulator state
  const [simProfit, setSimProfit] = useState<number>(financials.netProfit > 0 ? financials.netProfit : 50000);

  // Custom fields state
  const [fieldValues, setFieldValues] = useState<Record<string, any>>(customFieldVals || {});

  // Lifecycle stages
  const STAGES = ["IDEA", "PLANNING", "DRAFT_AGREEMENT", "ACTIVE", "COMPLETED", "SETTLED", "ARCHIVED"];
  const currentStageIndex = STAGES.indexOf(venture.stage);

  const getNextStage = () => {
    if (venture.stage === "IDEA") return "PLANNING";
    if (venture.stage === "PLANNING") return "DRAFT_AGREEMENT";
    if (venture.stage === "DRAFT_AGREEMENT") return "ACTIVE";
    if (venture.stage === "ACTIVE") return "COMPLETED";
    if (venture.stage === "COMPLETED") return "SETTLED";
    return null;
  };

  const nextStage = getNextStage();

  const handleAdvanceStage = async () => {
    if (!nextStage) return;
    try {
      setLoading(true);
      setActionError(null);
      await onTransitionStage(nextStage, `Advanced from ${venture.stage} via workspace`);
    } catch (err: any) {
      setActionError(err?.message || "Failed to advance stage.");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveAg = async () => {
    if (!venture.activeAgreement) return;
    try {
      setLoading(true);
      setActionError(null);
      await onApproveAgreement(venture.activeAgreement.id);
    } catch (err: any) {
      setActionError(err?.message || "Failed to approve agreement.");
    } finally {
      setLoading(false);
    }
  };

  const handleContributionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setActionError(null);
      await onRecordContribution({
        participantId: contribParticipantId || undefined,
        contributionType: contribType,
        amount: contribAmount,
        paymentAccountId: contribPaymentAccId || undefined,
        description: contribDescription || `Contribution for ${venture.code}`,
        isRecordedInLedger: contribPostLedger,
      });
      setShowContributionModal(false);
      setContribAmount(10000);
      setContribDescription("");
    } catch (err: any) {
      setActionError(err?.message || "Failed to record contribution.");
    } finally {
      setLoading(false);
    }
  };

  const handleSettlementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setActionError(null);
      await onCreateSettlement({
        customNetProfit: settlementProfitOverride,
        settlementType,
        notes: settlementNotes,
      });
      setShowSettlementModal(false);
    } catch (err: any) {
      setActionError(err?.message || "Failed to create settlement.");
    } finally {
      setLoading(false);
    }
  };

  const handleDisburseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disburseSettlementId) return;
    try {
      setLoading(true);
      setActionError(null);
      await onDisburseSettlement({
        settlementId: disburseSettlementId,
        paymentAccountId: disbursePaymentAccId,
      });
      setDisburseSettlementId(null);
    } catch (err: any) {
      setActionError(err?.message || "Failed to disburse settlement.");
    } finally {
      setLoading(false);
    }
  };

  const handleCustomFieldsSave = async () => {
    try {
      setLoading(true);
      setActionError(null);
      await onSaveCustomFields(fieldValues);
    } catch (err: any) {
      setActionError(err?.message || "Failed to save custom fields.");
    } finally {
      setLoading(false);
    }
  };

  // Live waterfall simulator math
  const simParticipants = (venture.participants || []).map((p: any) => {
    const profitPct = parseFloat(p.profitSharePct || "0");
    const lossPct = parseFloat(p.lossSharePct || "0");
    const committed = parseFloat(p.committedCapital || "0");

    let simReturn = 0;
    if (simProfit >= 0) {
      simReturn = Math.round(simProfit * (profitPct / 100) * 100) / 100;
    } else {
      simReturn = -Math.round(Math.abs(simProfit) * (lossPct / 100) * 100) / 100;
    }

    const roi = committed > 0 ? (simReturn / committed) * 100 : 0;

    return {
      name: p.partnerName,
      profitPct,
      lossPct,
      committed,
      simReturn,
      roi: Math.round(roi * 10) / 10,
    };
  });

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="p-6 bg-afk-charcoal border border-afk-border rounded-2xl shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                href="/ventures"
                className="text-xs font-semibold text-afk-muted hover:text-white transition-colors flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> All Ventures
              </Link>
              <span className="text-afk-border">•</span>
              <span className="text-xs font-mono font-bold text-afk-olive-accent px-2 py-0.5 rounded bg-afk-olive/20 border border-afk-olive">
                {venture.code}
              </span>
              <span className="text-xs text-afk-muted font-medium">
                {venture.typeName}
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-white">
              {venture.name}
            </h1>

            <p className="text-xs text-afk-muted mt-1 max-w-2xl">
              {venture.description || "No description provided."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {nextStage && (
              <button
                type="button"
                disabled={loading}
                onClick={handleAdvanceStage}
                className="px-4 py-2 text-xs font-bold text-white bg-afk-olive-accent hover:bg-afk-olive rounded-lg shadow transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                Advance to {nextStage.replace("_", " ")} <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Stepper Progression */}
        <div className="mt-6 pt-5 border-t border-afk-border/60">
          <div className="flex items-center justify-between overflow-x-auto pb-2 scrollbar-none gap-2">
            {STAGES.filter((s) => s !== "ARCHIVED").map((stageName, idx) => {
              const isPast = idx < currentStageIndex;
              const isCurrent = stageName === venture.stage;

              return (
                <div key={stageName} className="flex items-center gap-2 flex-shrink-0">
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      isCurrent
                        ? "bg-afk-olive-accent text-white shadow"
                        : isPast
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-afk-surface text-afk-muted border border-afk-border"
                    }`}
                  >
                    {isPast && <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>{stageName.replace("_", " ")}</span>
                  </div>
                  {idx < 5 && <ChevronRight className="w-3 h-3 text-afk-muted/50" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Action Error Alert */}
      {actionError && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 text-sm text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Workspace Tabs */}
      <div className="flex border-b border-afk-border gap-2 overflow-x-auto">
        {[
          { id: "overview", label: "Overview & P&L", icon: TrendingUp },
          { id: "agreement", label: "Agreement & Equity", icon: FileText },
          { id: "funding", label: "Funding Ledger", icon: Coins },
          { id: "waterfall", label: "Waterfall & Settlements", icon: PieChart },
          { id: "custom_fields", label: "Custom Attributes", icon: Sliders },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
                isActive
                  ? "border-afk-olive-accent text-white bg-afk-surface/40"
                  : "border-transparent text-afk-muted hover:text-white hover:border-afk-border"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW & P&L */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* P&L Performance Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="p-4 bg-afk-surface border border-afk-border rounded-xl">
              <span className="text-[10px] font-semibold text-afk-muted uppercase tracking-wider block">
                Gross Revenue
              </span>
              <div className="text-xl font-bold text-white mt-1">
                ৳{financials.grossRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-afk-muted mt-0.5 block">Attributed apparel sales</span>
            </div>

            <div className="p-4 bg-afk-surface border border-afk-border rounded-xl">
              <span className="text-[10px] font-semibold text-afk-muted uppercase tracking-wider block">
                Direct COGS
              </span>
              <div className="text-xl font-bold text-amber-400 mt-1">
                ৳{financials.directCogs.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-afk-muted mt-0.5 block">Fabric & manufacturing cost</span>
            </div>

            <div className="p-4 bg-afk-surface border border-afk-border rounded-xl">
              <span className="text-[10px] font-semibold text-afk-muted uppercase tracking-wider block">
                Gross Margin
              </span>
              <div className="text-xl font-bold text-white mt-1">
                ৳{financials.grossMargin.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-afk-muted mt-0.5 block">
                {financials.grossRevenue > 0
                  ? `${Math.round((financials.grossMargin / financials.grossRevenue) * 100)}% margin`
                  : "0% margin"}
              </span>
            </div>

            <div className="p-4 bg-afk-surface border border-afk-border rounded-xl">
              <span className="text-[10px] font-semibold text-afk-muted uppercase tracking-wider block">
                Operating Expenses
              </span>
              <div className="text-xl font-bold text-red-400 mt-1">
                ৳{financials.operatingExpenses.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-afk-muted mt-0.5 block">Packaging, ads, shipping</span>
            </div>

            <div className="p-4 bg-afk-charcoal border border-afk-border rounded-xl">
              <span className="text-[10px] font-semibold text-afk-olive-accent uppercase tracking-wider block">
                Net Venture Profit / (Loss)
              </span>
              <div
                className={`text-xl font-bold mt-1 ${
                  financials.netProfit >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                ৳{financials.netProfit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-afk-muted mt-0.5 block">Subject to waterfall split</span>
            </div>
          </div>

          {/* Venture Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="p-5 bg-afk-surface border border-afk-border rounded-xl space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Venture Parameters
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-afk-muted block text-[10px] uppercase">Manager</span>
                  <span className="font-semibold text-white">{venture.managerName || "Unassigned"}</span>
                </div>
                <div>
                  <span className="text-afk-muted block text-[10px] uppercase">Budget Cap</span>
                  <span className="font-semibold text-white">
                    {venture.budgetCap ? `৳${parseFloat(venture.budgetCap).toLocaleString()}` : "None"}
                  </span>
                </div>
                <div>
                  <span className="text-afk-muted block text-[10px] uppercase">Target Launch</span>
                  <span className="font-semibold text-white">
                    {venture.targetLaunchDate ? new Date(venture.targetLaunchDate).toLocaleDateString() : "TBD"}
                  </span>
                </div>
                <div>
                  <span className="text-afk-muted block text-[10px] uppercase">Target Settlement</span>
                  <span className="font-semibold text-white">
                    {venture.targetEndDate ? new Date(venture.targetEndDate).toLocaleDateString() : "TBD"}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-5 bg-afk-surface border border-afk-border rounded-xl space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Linked Assets & Products
              </h3>
              {venture.productLinks && venture.productLinks.length > 0 ? (
                <div className="space-y-1.5">
                  {venture.productLinks.map((link: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-2 bg-afk-surface-light rounded text-xs flex items-center justify-between"
                    >
                      <span className="text-white font-medium">
                        {link.collectionId ? `Collection: ${link.collectionId}` : link.inventoryLotId ? `Lot: ${link.inventoryLotId}` : "Linked Item"}
                      </span>
                      <span className="text-afk-muted text-[10px] font-mono">Linked</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-afk-muted">
                  No products or inventory lots directly linked yet. Sales attribution works automatically when inventory lots or orders are tagged with this venture.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AGREEMENT & PARTICIPANTS */}
      {activeTab === "agreement" && (
        <div className="space-y-6">
          {venture.activeAgreement ? (
            <div className="space-y-5">
              {/* Agreement Header Banner */}
              <div className="p-5 bg-afk-surface border border-afk-border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono font-bold text-afk-olive-accent">
                      Version {venture.activeAgreement.version}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                        venture.activeAgreement.status === "APPROVED"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      }`}
                    >
                      {venture.activeAgreement.status}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white">
                    {venture.activeAgreement.name}
                  </h3>
                  <span className="text-xs text-afk-muted">
                    Mode: <strong className="text-white">{venture.activeAgreement.participationMode.replace(/_/g, " ")}</strong>
                  </span>
                </div>

                {venture.activeAgreement.status === "DRAFT" && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleApproveAg}
                    className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve & Lock Agreement
                  </button>
                )}
              </div>

              {/* Participants Table */}
              <div className="bg-afk-surface border border-afk-border rounded-xl overflow-hidden">
                <div className="p-4 border-b border-afk-border bg-afk-charcoal flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Participating Members & Asymmetric Split
                  </h4>
                  <span className="text-xs font-mono text-afk-muted">
                    {venture.participants.length} Active Participants
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-afk-charcoal/50 text-afk-muted font-mono uppercase text-[10px] border-b border-afk-border">
                      <tr>
                        <th className="py-2.5 px-4">Participant</th>
                        <th className="py-2.5 px-4">Role Description</th>
                        <th className="py-2.5 px-4">Committed Capital</th>
                        <th className="py-2.5 px-4">Profit Share (%)</th>
                        <th className="py-2.5 px-4">Loss Share (%)</th>
                        <th className="py-2.5 px-4">Recovery Priority</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-afk-border/50">
                      {venture.participants.map((p: any) => (
                        <tr key={p.id} className="hover:bg-afk-surface-light/40">
                          <td className="py-3 px-4 font-bold text-white">
                            {p.partnerName}
                            {p.isExternal && (
                              <span className="ml-2 text-[10px] font-normal px-1.5 py-0.5 rounded bg-afk-border text-afk-muted">
                                External
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-afk-muted">{p.roleDescription || "Participant"}</td>
                          <td className="py-3 px-4 font-mono font-semibold text-white">
                            ৳{parseFloat(p.committedCapital || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                            {p.profitSharePct}%
                          </td>
                          <td className="py-3 px-4 font-mono text-amber-400">
                            {p.lossSharePct}%
                          </td>
                          <td className="py-3 px-4 text-afk-muted">
                            Tier {p.capitalRecoveryPriority || 1}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-afk-surface border border-afk-border rounded-xl">
              <p className="text-sm text-afk-muted">No agreement found for this venture.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: FUNDING LEDGER */}
      {activeTab === "funding" && (
        <div className="space-y-6">
          {/* Funding KPI Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-afk-surface border border-afk-border rounded-xl">
              <span className="text-[10px] font-semibold text-afk-muted uppercase block">
                Total Committed
              </span>
              <div className="text-xl font-bold text-white mt-1">
                ৳{fundingSummary.totalCommitted.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="p-4 bg-afk-surface border border-afk-border rounded-xl">
              <span className="text-[10px] font-semibold text-afk-muted uppercase block">
                Capital Contributed
              </span>
              <div className="text-xl font-bold text-sky-400 mt-1">
                ৳{fundingSummary.totalContributed.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="p-4 bg-afk-surface border border-afk-border rounded-xl">
              <span className="text-[10px] font-semibold text-afk-muted uppercase block">
                Capital Shortfall
              </span>
              <div className="text-xl font-bold text-amber-400 mt-1">
                ৳{fundingSummary.totalShortfall.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="p-4 bg-afk-surface border border-afk-border rounded-xl">
              <span className="text-[10px] font-semibold text-afk-muted uppercase block">
                Funding Progress
              </span>
              <div className="text-xl font-bold text-emerald-400 mt-1">
                {fundingSummary.overallFundingPct}%
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Funding Contributions
            </h3>
            <button
              type="button"
              onClick={() => setShowContributionModal(true)}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-afk-olive-accent hover:bg-afk-olive rounded-lg shadow transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Record Contribution
            </button>
          </div>

          {/* Contributions List */}
          <div className="bg-afk-surface border border-afk-border rounded-xl overflow-hidden">
            {contributions.length === 0 ? (
              <div className="p-8 text-center text-xs text-afk-muted">
                No contributions recorded yet. Click &quot;Record Contribution&quot; to deposit partner or investor funds.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-afk-charcoal text-afk-muted uppercase font-mono text-[10px] border-b border-afk-border">
                  <tr>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Participant</th>
                    <th className="py-2.5 px-4">Type</th>
                    <th className="py-2.5 px-4">Amount (৳)</th>
                    <th className="py-2.5 px-4">Payment Account</th>
                    <th className="py-2.5 px-4">GL Journal #</th>
                    <th className="py-2.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-afk-border/50">
                  {contributions.map((c: any) => (
                    <tr key={c.id} className="hover:bg-afk-surface-light/40">
                      <td className="py-2.5 px-4 font-mono text-afk-muted">
                        {new Date(c.date).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-white">{c.partnerName}</td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-afk-border text-white">
                          {c.contributionType.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono font-bold text-white">
                        ৳{c.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-4 text-afk-muted">{c.paymentAccountName || "N/A"}</td>
                      <td className="py-2.5 px-4 font-mono text-afk-olive-accent">
                        {c.journalNumber || "None"}
                      </td>
                      <td className="py-2.5 px-4 text-emerald-400 font-semibold">{c.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: WATERFALL & SETTLEMENTS */}
      {activeTab === "waterfall" && (
        <div className="space-y-6">
          {/* Live Simulator Header */}
          <div className="p-5 bg-afk-charcoal border border-afk-border rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-mono font-bold text-afk-olive-accent uppercase tracking-wider block">
                  Interactive Waterfall Simulator
                </span>
                <p className="text-xs text-afk-muted">
                  Simulate exact paisa distributions across participating members under different profit or loss outcomes.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowSettlementModal(true)}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create Settlement Snapshot
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-[#101216] p-4 rounded-xl border border-[#282E38]">
              <span className="text-xs font-bold text-gray-200 uppercase tracking-wider whitespace-nowrap">
                Simulated Net Profit:
              </span>
              <div className="relative w-48">
                <span className="absolute left-3 top-2.5 text-afk-olive-accent text-sm font-bold">৳</span>
                <input
                  type="number"
                  step="1000"
                  value={simProfit}
                  onChange={(e) => setSimProfit(parseFloat(e.target.value) || 0)}
                  className="w-full pl-8 pr-3 py-2 text-sm bg-[#0D0F12] border border-[#2D333F] rounded-lg font-mono font-bold text-white focus:border-afk-olive-accent focus:outline-none"
                />
              </div>

              <input
                type="range"
                min="-50000"
                max="250000"
                step="5000"
                value={simProfit}
                onChange={(e) => setSimProfit(parseFloat(e.target.value) || 0)}
                className="w-full accent-afk-olive cursor-pointer h-2 bg-[#1C2026] rounded-lg"
              />
            </div>

            {/* Simulator Table */}
            <div className="overflow-x-auto border border-afk-border rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-afk-surface text-afk-muted font-mono uppercase text-[10px] border-b border-afk-border">
                  <tr>
                    <th className="py-2 px-3">Participant</th>
                    <th className="py-2 px-3">Profit %</th>
                    <th className="py-2 px-3">Loss %</th>
                    <th className="py-2 px-3">Committed Capital</th>
                    <th className="py-2 px-3">Simulated Distribution (৳)</th>
                    <th className="py-2 px-3">Projected ROI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-afk-border/50">
                  {simParticipants.map((sp: any, idx: number) => (
                    <tr key={idx} className="hover:bg-afk-surface-light/40">
                      <td className="py-2.5 px-3 font-bold text-white">{sp.name}</td>
                      <td className="py-2.5 px-3 font-mono text-emerald-400">{sp.profitPct}%</td>
                      <td className="py-2.5 px-3 font-mono text-amber-400">{sp.lossPct}%</td>
                      <td className="py-2.5 px-3 font-mono text-white">৳{sp.committed.toLocaleString()}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-white">
                        <span className={sp.simReturn >= 0 ? "text-emerald-400" : "text-red-400"}>
                          ৳{sp.simReturn.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-afk-olive-accent">
                        {sp.roi}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Historical Settlements List */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Settlements & Allocation Snapshots
            </h4>

            {settlements.length === 0 ? (
              <div className="p-8 text-center bg-afk-surface border border-afk-border rounded-xl text-xs text-afk-muted">
                No formal settlements generated yet. Run a settlement above when a drop cycle concludes.
              </div>
            ) : (
              <div className="space-y-4">
                {settlements.map((s: any) => (
                  <div
                    key={s.id}
                    className="p-5 bg-afk-surface border border-afk-border rounded-xl space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-afk-border">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-afk-olive-accent">
                            {s.settlementNumber}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                              s.status === "DISBURSED"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : s.status === "APPROVED"
                                ? "bg-sky-500/20 text-sky-400"
                                : "bg-amber-500/20 text-amber-400"
                            }`}
                          >
                            {s.status}
                          </span>
                        </div>
                        <span className="text-xs text-afk-muted mt-0.5 block">
                          Type: {s.settlementType} • Total: ৳{s.totalSettledAmount.toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {s.status === "DRAFT" && (
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => onApproveSettlement(s.id)}
                            className="px-3 py-1.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 rounded transition-colors"
                          >
                            Approve
                          </button>
                        )}
                        {s.status === "APPROVED" && (
                          <button
                            type="button"
                            onClick={() => setDisburseSettlementId(s.id)}
                            className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded transition-colors"
                          >
                            Disburse
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Settlement Lines Breakdown */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-afk-charcoal text-afk-muted uppercase font-mono text-[10px]">
                          <tr>
                            <th className="py-2 px-3">Participant</th>
                            <th className="py-2 px-3">Capital Returned</th>
                            <th className="py-2 px-3">Preferred Return</th>
                            <th className="py-2 px-3">Residual Profit</th>
                            <th className="py-2 px-3">Reinvested</th>
                            <th className="py-2 px-3">Net Payable (৳)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-afk-border/50">
                          {s.lines.map((l: any) => (
                            <tr key={l.id}>
                              <td className="py-2 px-3 font-bold text-white">{l.partnerName}</td>
                              <td className="py-2 px-3 font-mono">৳{l.capitalReturned.toLocaleString()}</td>
                              <td className="py-2 px-3 font-mono">৳{l.preferredReturn.toLocaleString()}</td>
                              <td className="py-2 px-3 font-mono text-emerald-400">৳{l.residualProfit.toLocaleString()}</td>
                              <td className="py-2 px-3 font-mono text-amber-400">৳{l.reinvestedAmount.toLocaleString()}</td>
                              <td className="py-2 px-3 font-mono font-bold text-white">৳{l.netPayable.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: CUSTOM FIELDS */}
      {activeTab === "custom_fields" && (
        <div className="p-6 bg-afk-surface border border-afk-border rounded-xl space-y-5 max-w-2xl">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Venture Custom Attributes
            </h3>
            <Link
              href="/studio"
              className="text-xs text-afk-olive-accent hover:underline flex items-center gap-1"
            >
              Manage Field Definitions in Studio &rarr;
            </Link>
          </div>

          {customFieldDefs.length === 0 ? (
            <p className="text-xs text-afk-muted">
              No custom fields defined for VENTURE yet. Open the Customisation Studio to add code-free custom fields.
            </p>
          ) : (
            <div className="space-y-4">
              {customFieldDefs.map((def: any) => (
                <div key={def.id}>
                  <label className="block text-xs font-semibold text-afk-muted uppercase mb-1">
                    {def.fieldLabel} {def.isRequired && "*"}
                  </label>
                  <input
                    type={def.dataType === "NUMBER" || def.dataType === "DECIMAL" || def.dataType === "MONEY" ? "number" : "text"}
                    value={fieldValues[def.fieldKey] || ""}
                    onChange={(e) =>
                      setFieldValues((prev) => ({ ...prev, [def.fieldKey]: e.target.value }))
                    }
                    placeholder={`Enter ${def.fieldLabel}...`}
                    className="w-full px-3.5 py-2 bg-afk-charcoal border border-afk-border rounded text-white text-xs"
                  />
                </div>
              ))}

              <button
                type="button"
                disabled={loading}
                onClick={handleCustomFieldsSave}
                className="px-4 py-2 text-xs font-bold text-white bg-afk-olive-accent hover:bg-afk-olive rounded shadow transition-colors disabled:opacity-50"
              >
                Save Custom Attributes
              </button>
            </div>
          )}
        </div>
      )}

      {/* MODAL: Record Contribution */}
      {showContributionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md bg-[#14171C] border border-[#2D333F] rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-afk-border">
              <h3 className="text-base font-bold text-white">Record Venture Contribution</h3>
              <button
                onClick={() => setShowContributionModal(false)}
                className="text-afk-muted hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleContributionSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-bold text-gray-200 uppercase tracking-wider mb-1.5">
                  Participant *
                </label>
                <select
                  value={contribParticipantId}
                  onChange={(e) => setContribParticipantId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#0D0F12] border border-[#2D333F] rounded-xl text-white text-xs focus:border-afk-olive-accent focus:outline-none"
                >
                  <option value="">Company Treasury / Direct</option>
                  {(venture.participants || []).map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.partnerName} ({p.roleDescription || "Participant"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-200 uppercase tracking-wider mb-1.5">
                  Contribution Type *
                </label>
                <select
                  value={contribType}
                  onChange={(e) => setContribType(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-[#0D0F12] border border-[#2D333F] rounded-xl text-white text-xs focus:border-afk-olive-accent focus:outline-none"
                >
                  <option value="CASH">Cash Deposit</option>
                  <option value="PARTNER_LOAN">Partner Loan</option>
                  <option value="NON_CASH_ASSET">Non-Cash Asset (Raw Fabric / Blanks)</option>
                  <option value="SERVICE_EQUITY">Sweat / Service Equity</option>
                  <option value="COMPANY_ALLOCATION">Company Allocation</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-200 uppercase tracking-wider mb-1.5">
                  Amount (৳ BDT) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="100"
                  value={contribAmount}
                  onChange={(e) => setContribAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-afk-surface border border-afk-border rounded font-mono text-white text-sm"
                />
              </div>

              {(contribType === "CASH" || contribType === "PARTNER_LOAN") && (
                <div>
                  <label className="block text-xs font-bold text-gray-200 uppercase tracking-wider mb-1.5">
                    Deposit Payment Account *
                  </label>
                  <select
                    value={contribPaymentAccId}
                    onChange={(e) => setContribPaymentAccId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#0D0F12] border border-[#2D333F] rounded-xl text-white text-xs focus:border-afk-olive-accent focus:outline-none"
                  >
                    {paymentAccounts.map((pa) => (
                      <option key={pa.id} value={pa.id}>
                        {pa.name} ({pa.type})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-200 uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  value={contribDescription}
                  onChange={(e) => setContribDescription(e.target.value)}
                  placeholder="e.g. Initial fabric procurement deposit"
                  className="w-full px-3.5 py-2.5 bg-[#0D0F12] border border-[#2D333F] rounded-xl text-white text-xs focus:border-afk-olive-accent focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="postLedger"
                  checked={contribPostLedger}
                  onChange={(e) => setContribPostLedger(e.target.checked)}
                  className="rounded bg-afk-surface border-afk-border text-afk-olive-accent"
                />
                <label htmlFor="postLedger" className="text-afk-muted">
                  Post atomic double-entry journal to General Ledger
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-afk-border">
                <button
                  type="button"
                  onClick={() => setShowContributionModal(false)}
                  className="px-3 py-1.5 text-xs text-afk-muted hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-afk-olive-accent hover:bg-afk-olive rounded shadow"
                >
                  Confirm Contribution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Create Settlement */}
      {showSettlementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md bg-[#14171C] border border-[#2D333F] rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-afk-border">
              <h3 className="text-base font-bold text-white">Create Allocation Snapshot & Settlement</h3>
              <button
                onClick={() => setShowSettlementModal(false)}
                className="text-afk-muted hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSettlementSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-bold text-gray-200 uppercase tracking-wider mb-1.5">
                  Settlement Type *
                </label>
                <select
                  value={settlementType}
                  onChange={(e) => setSettlementType(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-[#0D0F12] border border-[#2D333F] rounded-xl text-white text-xs focus:border-afk-olive-accent focus:outline-none"
                >
                  <option value="FULL">Full Settlement & Payout</option>
                  <option value="PARTIAL">Partial Settlement</option>
                  <option value="REINVESTMENT">Roll to Reinvestment Pool</option>
                  <option value="LOSS_CARRYFORWARD">Loss Carryforward</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-200 uppercase tracking-wider mb-1.5">
                  Net Profit to Distribute (৳ BDT) *
                </label>
                <input
                  type="number"
                  step="100"
                  value={settlementProfitOverride}
                  onChange={(e) => setSettlementProfitOverride(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-afk-surface border border-afk-border rounded font-mono text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-200 uppercase tracking-wider mb-1.5">
                  Settlement Notes
                </label>
                <textarea
                  rows={2}
                  value={settlementNotes}
                  onChange={(e) => setSettlementNotes(e.target.value)}
                  placeholder="Notes for voucher and audit trail..."
                  className="w-full px-3.5 py-2.5 bg-[#0D0F12] border border-[#2D333F] rounded-xl text-white text-xs focus:border-afk-olive-accent focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-afk-border">
                <button
                  type="button"
                  onClick={() => setShowSettlementModal(false)}
                  className="px-3 py-1.5 text-xs text-afk-muted hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded shadow"
                >
                  Generate Settlement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Disburse Settlement */}
      {disburseSettlementId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm bg-[#14171C] border border-[#2D333F] rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white">Disburse Settlement Payout</h3>
            <form onSubmit={handleDisburseSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-bold text-gray-200 uppercase tracking-wider mb-1.5">
                  Disburse From Account *
                </label>
                <select
                  value={disbursePaymentAccId}
                  onChange={(e) => setDisbursePaymentAccId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#0D0F12] border border-[#2D333F] rounded-xl text-white text-xs focus:border-afk-olive-accent focus:outline-none"
                >
                  {paymentAccounts.map((pa) => (
                    <option key={pa.id} value={pa.id}>
                      {pa.name} ({pa.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-afk-border">
                <button
                  type="button"
                  onClick={() => setDisburseSettlementId(null)}
                  className="px-3 py-1.5 text-xs text-afk-muted hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded shadow"
                >
                  Confirm Payout
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
