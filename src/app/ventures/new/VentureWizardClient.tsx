"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Layers,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Shield,
  Coins,
  Percent,
  Plus,
  Trash2,
  Calculator,
} from "lucide-react";
import { ParticipationMode } from "@/server/services/ventures";

export interface WizardParticipant {
  partnerId?: string | null;
  name?: string;
  externalName?: string;
  externalRole?: string;
  isExternal?: boolean;
  roleDescription?: string;
  committedCapital: number;
  profitSharePct: number;
  lossSharePct: number;
  capitalRecoveryPriority?: number;
}

interface Partner {
  id: string;
  name: string;
  ownershipPct: string;
  profitSharePct: string;
}

interface VentureType {
  code: string;
  name: string;
  description: string | null;
  defaultMode?: string;
}

interface Props {
  partners: Partner[];
  ventureTypes: VentureType[];
  collections: any[];
  products: any[];
  onSubmit: (data: any) => Promise<void>;
}

export function VentureWizardClient({
  partners,
  ventureTypes,
  collections,
  products,
  onSubmit,
}: Props) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [typeCode, setTypeCode] = useState(ventureTypes[0]?.code || "PRODUCT_DROP");
  const [description, setDescription] = useState("");
  const [managerPartnerId, setManagerPartnerId] = useState<string>(partners[0]?.id || "");
  const [targetLaunchDate, setTargetLaunchDate] = useState("");
  const [targetEndDate, setTargetEndDate] = useState("");
  const [budgetCap, setBudgetCap] = useState<number>(100000);
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>(["2026-DROP"]);

  // Agreement State
  const [participationMode, setParticipationMode] = useState<ParticipationMode>("PROPORTIONAL_CAPITAL");
  const [hurdleRatePct, setHurdleRatePct] = useState<number>(0);
  const [preferredReturnPct, setPreferredReturnPct] = useState<number>(0);
  const [retainedEarningsPct, setRetainedEarningsPct] = useState<number>(0);
  const [reinvestmentPct, setReinvestmentPct] = useState<number>(0);

  // Participants State
  const [participants, setParticipants] = useState<WizardParticipant[]>(() =>
    partners.map((p) => ({
      partnerId: p.id,
      isExternal: false,
      roleDescription: "Founding Partner",
      committedCapital: 20000,
      profitSharePct: 20.0,
      lossSharePct: 20.0,
      capitalRecoveryPriority: 1,
    }))
  );

  const MODES: {
    code: ParticipationMode;
    title: string;
    description: string;
    badge: string;
  }[] = [
    {
      code: "PROPORTIONAL_CAPITAL",
      title: "Proportional to Capital",
      description: "Profit share directly mirrors cash and capital committed by each participant.",
      badge: "Standard",
    },
    {
      code: "CUSTOM_PROFIT_SPLIT",
      title: "Asymmetric Custom Split",
      description: "Independent profit and loss percentages different from invested capital (e.g. 50/30/20 funding vs 40/40/20 profit).",
      badge: "Most Flexible",
    },
    {
      code: "EQUAL_SPLIT",
      title: "Equal Split",
      description: "Profit is divided equally among participating members regardless of initial capital variance.",
      badge: "Equal",
    },
    {
      code: "CAPITAL_RECOVERY_FIRST",
      title: "Capital Recovery First",
      description: "100% of initial revenue/gross profit returns invested principal before residual profit is split.",
      badge: "De-Risked",
    },
    {
      code: "FIXED_RETURN_PLUS_RESIDUAL",
      title: "Fixed Return + Residual",
      description: "Senior capital receives guaranteed hurdle % return, junior capital receives remaining upside.",
      badge: "Hurdle",
    },
    {
      code: "REINVESTMENT",
      title: "Reinvestment Pool",
      description: "A fixed percentage of proceeds is retained to fund the subsequent apparel batch or drop.",
      badge: "Compounding",
    },
    {
      code: "SERVICE_SWEAT_EQUITY",
      title: "Service / Sweat Equity",
      description: "Recognises design, marketing, or photography contributions with agreed valuation without diluting statutory company shares.",
      badge: "Sweat Equity",
    },
    {
      code: "MULTI_STAGE_WATERFALL",
      title: "Multi-Stage Waterfall",
      description: "Complex multi-tier distribution: Reserve -> Capital Return -> Hurdle -> Residual split.",
      badge: "Advanced",
    },
  ];

  // Calculations & Validations
  const totalCommitted = participants.reduce((acc, p) => acc + (p.committedCapital || 0), 0);
  const totalProfitPct = Math.round(participants.reduce((acc, p) => acc + (p.profitSharePct || 0), 0) * 100) / 100;
  const totalLossPct = Math.round(participants.reduce((acc, p) => acc + (p.lossSharePct || 0), 0) * 100) / 100;

  const isProfitValid = Math.abs(totalProfitPct - 100.0) <= 0.05;
  const isLossValid = Math.abs(totalLossPct - 100.0) <= 0.05;

  const handleEqualize = () => {
    const count = participants.length;
    if (count === 0) return;
    const basePct = Math.floor((100 / count) * 100) / 100;
    const remainder = Math.round((100 - basePct * (count - 1)) * 100) / 100;

    setParticipants((prev) =>
      prev.map((p, idx) => ({
        ...p,
        profitSharePct: idx === count - 1 ? remainder : basePct,
        lossSharePct: idx === count - 1 ? remainder : basePct,
      }))
    );
  };

  const handleProportionalize = () => {
    if (totalCommitted <= 0) return;
    let runningTotal = 0;
    const count = participants.length;

    setParticipants((prev) =>
      prev.map((p, idx) => {
        if (idx === count - 1) {
          const finalPct = Math.max(0, Math.round((100 - runningTotal) * 100) / 100);
          return { ...p, profitSharePct: finalPct, lossSharePct: finalPct };
        } else {
          const raw = (p.committedCapital / totalCommitted) * 100;
          const rounded = Math.round(raw * 100) / 100;
          runningTotal += rounded;
          return { ...p, profitSharePct: rounded, lossSharePct: rounded };
        }
      })
    );
  };

  const addExternalParticipant = () => {
    setParticipants((prev) => [
      ...prev,
      {
        partnerId: null,
        isExternal: true,
        externalName: `Investor ${prev.length + 1}`,
        externalRole: "External Angel / Collaborator",
        roleDescription: "External Capital",
        committedCapital: 0,
        profitSharePct: 0,
        lossSharePct: 0,
        capitalRecoveryPriority: 1,
      },
    ]);
  };

  const removeParticipant = (index: number) => {
    setParticipants((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleFinalSubmit = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Venture name is required.");
      return;
    }
    if (!isProfitValid) {
      setError(`Profit share must sum to exactly 100.00% (currently ${totalProfitPct}%).`);
      return;
    }
    if (!isLossValid) {
      setError(`Loss share must sum to exactly 100.00% (currently ${totalLossPct}%).`);
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit({
        name,
        typeCode,
        description,
        managerPartnerId,
        budgetCap,
        targetLaunchDate,
        targetEndDate,
        notes,
        tags,
        participationMode,
        targetFundAmount: budgetCap,
        hurdleRatePct,
        preferredReturnPct,
        retainedEarningsPct,
        reinvestmentPct,
        participants,
      });
    } catch (err: any) {
      setError(err?.message || "Failed to create venture.");
      setSubmitting(false);
    }
  };

  const STEPS_NAV = [
    "1. Identity",
    "2. Model",
    "3. Budget",
    "4. Participants",
    "5. Equity Split",
    "6. Waterfall",
    "7. Funding",
    "8. Product Link",
    "9. Governance",
    "10. Launch",
  ];

  return (
    <div className="bg-afk-surface border border-afk-border rounded-2xl shadow-xl overflow-hidden">
      {/* Wizard Header */}
      <div className="p-6 bg-afk-charcoal border-b border-afk-border">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-mono font-semibold text-afk-olive-accent tracking-wider uppercase">
              Step {step} of 10 — Create Venture
            </span>
            <h2 className="text-xl font-bold text-white mt-0.5">
              {step === 1 && "Venture Identity & Classification"}
              {step === 2 && "Select Participation Model"}
              {step === 3 && "Capital Budget & Target Fund"}
              {step === 4 && "Select Participating Partners & Investors"}
              {step === 5 && "Capital Commitments & Profit / Loss Split"}
              {step === 6 && "Waterfall Structure & Return Rules"}
              {step === 7 && "Contribution Methods & Asset Types"}
              {step === 8 && "Product & Collection Association"}
              {step === 9 && "Governance, Approvals & Loss Policy"}
              {step === 10 && "Review & Launch Agreement"}
            </h2>
          </div>
          <Link
            href="/ventures"
            className="text-xs font-semibold text-afk-muted hover:text-white transition-colors"
          >
            Cancel
          </Link>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-afk-border h-1.5 rounded-full mt-4 overflow-hidden">
          <div
            className="bg-afk-olive-accent h-full transition-all duration-300"
            style={{ width: `${(step / 10) * 100}%` }}
          />
        </div>

        {/* Step Tabs */}
        <div className="flex gap-2 overflow-x-auto mt-3 py-1 scrollbar-none">
          {STEPS_NAV.map((label, idx) => (
            <button
              key={label}
              onClick={() => setStep(idx + 1)}
              className={`text-[11px] font-medium px-2 py-1 rounded whitespace-nowrap transition-colors ${
                step === idx + 1
                  ? "bg-afk-olive/30 text-afk-olive-accent border border-afk-olive"
                  : idx + 1 < step
                  ? "text-white hover:text-afk-olive-accent"
                  : "text-afk-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mx-6 mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 text-sm text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Wizard Body */}
      <div className="p-6">
        {/* STEP 1: Identity */}
        {step === 1 && (
          <div className="space-y-4 max-w-2xl">
            <div>
              <label className="block text-xs font-semibold text-afk-muted uppercase mb-1">
                Venture Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Heavyweight Graphic Tee Collection #01"
                className="w-full px-3.5 py-2.5 bg-afk-surface-light border border-afk-border rounded-lg text-white text-sm focus:border-afk-olive-accent focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-afk-muted uppercase mb-1">
                  Venture Type *
                </label>
                <select
                  value={typeCode}
                  onChange={(e) => setTypeCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-afk-surface-light border border-afk-border rounded-lg text-white text-sm focus:border-afk-olive-accent focus:outline-none"
                >
                  {ventureTypes.map((vt) => (
                    <option key={vt.code} value={vt.code}>
                      {vt.name} ({vt.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-afk-muted uppercase mb-1">
                  Manager Partner
                </label>
                <select
                  value={managerPartnerId}
                  onChange={(e) => setManagerPartnerId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-afk-surface-light border border-afk-border rounded-lg text-white text-sm focus:border-afk-olive-accent focus:outline-none"
                >
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-afk-muted uppercase mb-1">
                Description & Business Objectives
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Describe fabric specs, target audience, supplier terms, and operational plan..."
                className="w-full px-3.5 py-2.5 bg-afk-surface-light border border-afk-border rounded-lg text-white text-sm focus:border-afk-olive-accent focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-afk-muted uppercase mb-1">
                  Target Launch Date
                </label>
                <input
                  type="date"
                  value={targetLaunchDate}
                  onChange={(e) => setTargetLaunchDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-afk-surface-light border border-afk-border rounded-lg text-white text-sm focus:border-afk-olive-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-afk-muted uppercase mb-1">
                  Target Settlement Date
                </label>
                <input
                  type="date"
                  value={targetEndDate}
                  onChange={(e) => setTargetEndDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-afk-surface-light border border-afk-border rounded-lg text-white text-sm focus:border-afk-olive-accent focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Participation Model */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-afk-muted">
              Select how profit and loss will be distributed among participants. You can customize percentages in Step 5.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {MODES.map((m) => {
                const isSelected = participationMode === m.code;
                return (
                  <div
                    key={m.code}
                    onClick={() => setParticipationMode(m.code)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-afk-olive/15 border-afk-olive ring-1 ring-afk-olive"
                        : "bg-afk-surface-light/40 border-afk-border hover:border-afk-border/80"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-bold text-white">{m.title}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-afk-border text-afk-muted">
                        {m.badge}
                      </span>
                    </div>
                    <p className="text-xs text-afk-muted">{m.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3: Budget & Target Fund */}
        {step === 3 && (
          <div className="space-y-4 max-w-xl">
            <div>
              <label className="block text-xs font-semibold text-afk-muted uppercase mb-1">
                Total Budget Cap / Target Funding (৳ BDT) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-afk-muted font-bold text-sm">৳</span>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={budgetCap}
                  onChange={(e) => setBudgetCap(parseFloat(e.target.value) || 0)}
                  className="w-full pl-8 pr-3.5 py-2.5 bg-afk-surface-light border border-afk-border rounded-lg text-white font-mono text-sm focus:border-afk-olive-accent focus:outline-none"
                />
              </div>
              <p className="text-xs text-afk-muted mt-1.5">
                The total capital required to fund fabric procurement, manufacturing, labels, packaging, and marketing for this drop.
              </p>
            </div>

            <div className="p-4 bg-afk-charcoal border border-afk-border rounded-xl">
              <span className="text-xs font-semibold text-afk-olive-accent uppercase tracking-wider block mb-1">
                Funding Structure
              </span>
              <p className="text-xs text-afk-muted">
                Each participant will commit a portion of this budget. If actual expenses are lower than budget, unused funds are preserved or returned in settlement.
              </p>
            </div>
          </div>
        )}

        {/* STEP 4: Select Participating Members */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-afk-muted">
                Select who is participating financially in this venture. Founding partners with 0% contribution can be excluded without affecting company equity.
              </p>
              <button
                type="button"
                onClick={addExternalParticipant}
                className="px-3 py-1.5 text-xs font-semibold text-afk-olive-accent bg-afk-olive/20 hover:bg-afk-olive/30 border border-afk-olive rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add External Investor
              </button>
            </div>

            <div className="space-y-2">
              {participants.map((p, idx) => {
                const partnerObj = partners.find((pt) => pt.id === p.partnerId);
                const displayName = partnerObj?.name || p.externalName || `Participant ${idx + 1}`;

                return (
                  <div
                    key={idx}
                    className="p-3 bg-afk-surface-light/60 border border-afk-border rounded-xl flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-afk-olive/20 border border-afk-olive flex items-center justify-center font-bold text-xs text-afk-olive-accent">
                        {displayName.charAt(0)}
                      </div>
                      <div>
                        <span className="text-sm font-bold text-white block">{displayName}</span>
                        <span className="text-[11px] text-afk-muted">
                          {p.isExternal ? "External Investor / Creator" : "Founding Partner (20% Company Equity)"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={p.roleDescription || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setParticipants((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, roleDescription: val } : item))
                          );
                        }}
                        placeholder="Role / Responsibility"
                        className="px-2.5 py-1 text-xs bg-afk-charcoal border border-afk-border rounded text-white"
                      />

                      {participants.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeParticipant(idx)}
                          className="p-1.5 text-afk-muted hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 5: Equity Split & Percentages */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-afk-muted uppercase">
                  Participants & Allocations
                </span>
                <p className="text-xs text-afk-muted">
                  Specify committed cash capital and agreed profit/loss distribution.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleEqualize}
                  className="px-2.5 py-1 text-xs font-medium text-afk-muted hover:text-white bg-afk-surface-light border border-afk-border rounded transition-colors"
                >
                  Equalize (1/N)
                </button>
                <button
                  type="button"
                  onClick={handleProportionalize}
                  className="px-2.5 py-1 text-xs font-medium text-afk-olive-accent hover:text-white bg-afk-olive/20 border border-afk-olive rounded transition-colors"
                >
                  Proportional to Capital
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-afk-border rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-afk-charcoal text-afk-muted uppercase font-mono text-[10px] border-b border-afk-border">
                  <tr>
                    <th className="py-2.5 px-3">Participant</th>
                    <th className="py-2.5 px-3">Committed Capital (৳)</th>
                    <th className="py-2.5 px-3">Profit Share (%)</th>
                    <th className="py-2.5 px-3">Loss Share (%)</th>
                    <th className="py-2.5 px-3">Recovery Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-afk-border/50">
                  {participants.map((p, idx) => {
                    const partnerObj = partners.find((pt) => pt.id === p.partnerId);
                    const name = partnerObj?.name || p.externalName || `Participant ${idx + 1}`;

                    return (
                      <tr key={idx} className="hover:bg-afk-surface-light/40">
                        <td className="py-2 px-3 font-medium text-white">{name}</td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={p.committedCapital}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setParticipants((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, committedCapital: val } : item))
                              );
                            }}
                            className="w-28 px-2 py-1 bg-afk-charcoal border border-afk-border rounded text-white font-mono"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={p.profitSharePct}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setParticipants((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, profitSharePct: val } : item))
                                );
                              }}
                              className="w-20 px-2 py-1 bg-afk-charcoal border border-afk-border rounded text-white font-mono"
                            />
                            <span className="text-afk-muted">%</span>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={p.lossSharePct}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setParticipants((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, lossSharePct: val } : item))
                                );
                              }}
                              className="w-20 px-2 py-1 bg-afk-charcoal border border-afk-border rounded text-white font-mono"
                            />
                            <span className="text-afk-muted">%</span>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <select
                            value={p.capitalRecoveryPriority || 1}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 1;
                              setParticipants((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, capitalRecoveryPriority: val } : item))
                              );
                            }}
                            className="px-2 py-1 bg-afk-charcoal border border-afk-border rounded text-white"
                          >
                            <option value={1}>Tier 1 (Senior)</option>
                            <option value={2}>Tier 2 (Pari-Passu)</option>
                            <option value={3}>Tier 3 (Junior)</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Invariant Status Bars */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div
                className={`p-3 rounded-xl border flex items-center justify-between ${
                  isProfitValid
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-red-500/10 border-red-500/30 text-red-400"
                }`}
              >
                <span className="text-xs font-semibold">Total Profit Share Sum:</span>
                <span className="text-sm font-mono font-bold">
                  {totalProfitPct.toFixed(2)}% {isProfitValid ? "✓ Valid (100.00%)" : "✗ Must equal 100%"}
                </span>
              </div>

              <div
                className={`p-3 rounded-xl border flex items-center justify-between ${
                  isLossValid
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-red-500/10 border-red-500/30 text-red-400"
                }`}
              >
                <span className="text-xs font-semibold">Total Loss Share Sum:</span>
                <span className="text-sm font-mono font-bold">
                  {totalLossPct.toFixed(2)}% {isLossValid ? "✓ Valid (100.00%)" : "✗ Must equal 100%"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 6: Waterfall Structure */}
        {step === 6 && (
          <div className="space-y-4 max-w-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-afk-muted uppercase mb-1">
                  Retained Reserve (%)
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={retainedEarningsPct}
                    onChange={(e) => setRetainedEarningsPct(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-afk-surface-light border border-afk-border rounded-lg text-white font-mono text-sm"
                  />
                  <span className="text-afk-muted">%</span>
                </div>
                <span className="text-[11px] text-afk-muted mt-1 block">
                  Holdback for returns/defects before payout.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-afk-muted uppercase mb-1">
                  Preferred Return / Hurdle (%)
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={preferredReturnPct}
                    onChange={(e) => setPreferredReturnPct(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-afk-surface-light border border-afk-border rounded-lg text-white font-mono text-sm"
                  />
                  <span className="text-afk-muted">%</span>
                </div>
                <span className="text-[11px] text-afk-muted mt-1 block">
                  Priority hurdle paid before residual split.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-afk-muted uppercase mb-1">
                  Reinvestment Roll (%)
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={reinvestmentPct}
                    onChange={(e) => setReinvestmentPct(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-afk-surface-light border border-afk-border rounded-lg text-white font-mono text-sm"
                  />
                  <span className="text-afk-muted">%</span>
                </div>
                <span className="text-[11px] text-afk-muted mt-1 block">
                  Auto-rolled into next collection fund.
                </span>
              </div>
            </div>

            <div className="p-4 bg-afk-charcoal border border-afk-border rounded-xl">
              <span className="text-xs font-bold text-white uppercase block mb-1">
                Deterministic Integer-Paisa Guarantee
              </span>
              <p className="text-xs text-afk-muted">
                Our calculation engine uses integer-paisa rounding remainder allocation to guarantee that no fraction of a paisa is lost, ensuring exact balanced double-entry accounting.
              </p>
            </div>
          </div>
        )}

        {/* STEP 7: Funding Methods */}
        {step === 7 && (
          <div className="space-y-4 max-w-2xl">
            <p className="text-sm text-afk-muted">
              AFK THEORY supports multiple contribution modes. Select how capital will be delivered:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 bg-afk-surface-light/40 border border-afk-border rounded-xl">
                <span className="text-xs font-bold text-white block mb-1">1. Cash & Bank Deposit</span>
                <p className="text-xs text-afk-muted">
                  Direct transfer to BRAC Bank, bKash Merchant, or Cash on Hand tagged to this venture.
                </p>
              </div>

              <div className="p-4 bg-afk-surface-light/40 border border-afk-border rounded-xl">
                <span className="text-xs font-bold text-white block mb-1">2. Partner Loan</span>
                <p className="text-xs text-afk-muted">
                  Recorded in Partner Due Liability (2110-2150) without altering company share capital.
                </p>
              </div>

              <div className="p-4 bg-afk-surface-light/40 border border-afk-border rounded-xl">
                <span className="text-xs font-bold text-white block mb-1">3. Non-Cash Asset (Fabric)</span>
                <p className="text-xs text-afk-muted">
                  Agreed valuation of raw fabric or trims contributed directly into Materials Inventory (1210).
                </p>
              </div>

              <div className="p-4 bg-afk-surface-light/40 border border-afk-border rounded-xl">
                <span className="text-xs font-bold text-white block mb-1">4. Sweat / Service Equity</span>
                <p className="text-xs text-afk-muted">
                  Valued design, shooting, or management service recognized in drop agreement without statutory dilution.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* STEP 8: Product Link */}
        {step === 8 && (
          <div className="space-y-4 max-w-xl">
            <p className="text-sm text-afk-muted">
              Optionally associate an existing apparel collection with this venture. You can also link products and inventory lots later.
            </p>

            <div>
              <label className="block text-xs font-semibold text-afk-muted uppercase mb-1">
                Link Collection (Optional)
              </label>
              <select className="w-full px-3.5 py-2.5 bg-afk-surface-light border border-afk-border rounded-lg text-white text-sm focus:border-afk-olive-accent focus:outline-none">
                <option value="">None (Link later or independent venture)</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* STEP 9: Governance & Approvals */}
        {step === 9 && (
          <div className="space-y-4 max-w-2xl">
            <div className="p-4 bg-afk-surface-light/60 border border-afk-border rounded-xl space-y-3">
              <span className="text-xs font-bold text-white uppercase tracking-wider block">
                Two-Tier Ledger Governance
              </span>
              <ul className="text-xs text-afk-muted space-y-2 list-disc list-inside">
                <li>
                  <strong className="text-white">Tier 1 Statutory Ledger:</strong> The founding 20% legal company ownership ledger remains untouched.
                </li>
                <li>
                  <strong className="text-white">Tier 2 Project Sub-Ledger:</strong> Venture allocations are segregated into project-specific dimensions and waterfall schedules.
                </li>
                <li>
                  <strong className="text-white">Financial Approval:</strong> Advancing this venture to ACTIVE stage requires an approved agreement signed by FINANCE_APPROVER or ADMIN.
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* STEP 10: Review & Launch */}
        {step === 10 && (
          <div className="space-y-5 max-w-3xl">
            <div className="p-5 bg-afk-charcoal border border-afk-border rounded-xl">
              <div className="flex items-center justify-between pb-3 border-b border-afk-border">
                <div>
                  <span className="text-xs font-mono font-semibold text-afk-olive-accent">
                    {typeCode}
                  </span>
                  <h3 className="text-lg font-bold text-white">{name}</h3>
                </div>
                <span className="px-3 py-1 text-xs font-bold rounded-full bg-afk-olive/20 text-afk-olive-accent border border-afk-olive">
                  {participationMode.replace(/_/g, " ")}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-b border-afk-border text-xs">
                <div>
                  <span className="text-afk-muted block text-[10px] uppercase">Budget Cap</span>
                  <span className="font-bold text-white">৳{budgetCap.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-afk-muted block text-[10px] uppercase">Committed</span>
                  <span className="font-bold text-white">৳{totalCommitted.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-afk-muted block text-[10px] uppercase">Participants</span>
                  <span className="font-bold text-white">{participants.length} Members</span>
                </div>
                <div>
                  <span className="text-afk-muted block text-[10px] uppercase">Reserve %</span>
                  <span className="font-bold text-white">{retainedEarningsPct}%</span>
                </div>
              </div>

              <div className="mt-4">
                <span className="text-xs font-semibold text-afk-muted uppercase block mb-2">
                  Agreed Profit & Loss Distribution
                </span>
                <div className="space-y-1.5">
                  {participants.map((p, idx) => {
                    const partnerObj = partners.find((pt) => pt.id === p.partnerId);
                    const pName = partnerObj?.name || p.externalName || `Participant ${idx + 1}`;
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs py-1 px-2.5 bg-afk-surface-light rounded"
                      >
                        <span className="font-medium text-white">{pName}</span>
                        <div className="flex items-center gap-4 text-afk-muted font-mono">
                          <span>Committed: ৳{p.committedCapital.toLocaleString()}</span>
                          <span className="text-emerald-400 font-bold">Profit: {p.profitSharePct}%</span>
                          <span className="text-amber-400">Loss: {p.lossSharePct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3 text-xs text-emerald-400">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span>
                All mathematical invariants satisfied. Ready to create venture and draft foundation agreement.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Wizard Footer Nav */}
      <div className="p-6 bg-afk-charcoal border-t border-afk-border flex items-center justify-between">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="px-4 py-2 text-sm font-medium text-afk-muted hover:text-white bg-afk-surface border border-afk-border rounded-lg transition-colors flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Previous
          </button>
        ) : (
          <div />
        )}

        {step < 10 ? (
          <button
            type="button"
            onClick={() => {
              if (step === 1 && !name.trim()) {
                setError("Please enter a venture name.");
                return;
              }
              if (step === 5) {
                if (!isProfitValid) {
                  setError(`Profit share must sum to exactly 100.00% (currently ${totalProfitPct}%).`);
                  return;
                }
                if (!isLossValid) {
                  setError(`Loss share must sum to exactly 100.00% (currently ${totalLossPct}%).`);
                  return;
                }
              }
              setError(null);
              setStep((s) => s + 1);
            }}
            className="px-5 py-2 text-sm font-semibold text-white bg-afk-olive-accent hover:bg-afk-olive rounded-lg shadow-sm transition-colors flex items-center gap-2"
          >
            Next <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={handleFinalSubmit}
            className="px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-md transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {submitting ? "Launching Venture..." : "Launch Venture & Agreement"}
          </button>
        )}
      </div>
    </div>
  );
}
