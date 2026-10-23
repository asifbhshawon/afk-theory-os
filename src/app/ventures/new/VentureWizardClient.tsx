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
  Calendar,
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
  const [participationMode, setParticipationMode] = useState<ParticipationMode>("PROPORTIONAL");
  const [hurdleRatePct, setHurdleRatePct] = useState<number>(0);
  const [preferredReturnPct, setPreferredReturnPct] = useState<number>(0);
  const [retainedEarningsPct, setRetainedEarningsPct] = useState<number>(0);
  const [reinvestmentPct, setReinvestmentPct] = useState<number>(0);

  // Participants State
  const [participants, setParticipants] = useState<WizardParticipant[]>(() =>
    partners.map((p) => ({
      partnerId: p.id,
      name: p.name,
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
      code: "PROPORTIONAL",
      title: "Proportional to Capital",
      description: "Profit share directly mirrors cash and capital committed by each participant.",
      badge: "Standard",
    },
    {
      code: "CUSTOM_PROFIT",
      title: "Asymmetric Custom Split",
      description: "Independent profit and loss percentages different from invested capital (e.g. 50/30/20 funding vs 40/40/20 profit).",
      badge: "Most Flexible",
    },
    {
      code: "EQUAL",
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
      code: "FIXED_RETURN",
      title: "Fixed Return + Residual",
      description: "Senior capital receives guaranteed hurdle % return, junior capital receives remaining upside.",
      badge: "Hurdle",
    },
    {
      code: "PROFIT_REINVESTMENT",
      title: "Reinvestment Pool",
      description: "A fixed percentage of proceeds is retained to fund the subsequent apparel batch or drop.",
      badge: "Compounding",
    },
    {
      code: "MANAGEMENT_SERVICE",
      title: "Service / Sweat Equity",
      description: "Recognises design, marketing, or photography contributions with agreed valuation without diluting statutory company shares.",
      badge: "Sweat Equity",
    },
    {
      code: "CUSTOM_WATERFALL",
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
        name: `Investor ${prev.length + 1}`,
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
    { num: 1, label: "Identity" },
    { num: 2, label: "Model" },
    { num: 3, label: "Budget" },
    { num: 4, label: "Members" },
    { num: 5, label: "Split %" },
    { num: 6, label: "Waterfall" },
    { num: 7, label: "Funding" },
    { num: 8, label: "Products" },
    { num: 9, label: "Rules" },
    { num: 10, label: "Review" },
  ];

  // Common high-contrast input classes
  const inputClass =
    "w-full px-4 py-3 bg-[#101216] border border-[#2D333F] rounded-xl text-white placeholder:text-gray-500 text-sm focus:border-afk-olive-accent focus:ring-1 focus:ring-afk-olive-accent focus:outline-none transition-all shadow-inner";
  const labelClass =
    "block text-xs font-bold text-gray-200 uppercase tracking-wider mb-2";

  return (
    <div className="bg-[#14171C] border border-[#282E38] rounded-2xl shadow-2xl overflow-hidden">
      {/* Wizard Header */}
      <div className="p-6 bg-[#1A1E24] border-b border-[#282E38]">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 text-xs font-mono font-bold rounded bg-afk-olive/30 text-afk-olive-accent border border-afk-olive">
                STEP {step} OF 10
              </span>
              <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
                Venture & Waterfall Wizard
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
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
            className="px-3.5 py-1.5 text-xs font-semibold text-gray-400 hover:text-white bg-[#101216] border border-[#2D333F] rounded-lg transition-colors"
          >
            Cancel
          </Link>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#101216] h-2 rounded-full mt-5 overflow-hidden border border-[#282E38]">
          <div
            className="bg-gradient-to-r from-afk-olive to-afk-olive-accent h-full transition-all duration-300 shadow-sm"
            style={{ width: `${(step / 10) * 100}%` }}
          />
        </div>

        {/* Step Indicator Tabs */}
        <div className="flex gap-2 overflow-x-auto mt-4 py-1 scrollbar-none">
          {STEPS_NAV.map((s) => {
            const isCurrent = step === s.num;
            const isPast = step > s.num;

            return (
              <button
                key={s.num}
                type="button"
                onClick={() => setStep(s.num)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isCurrent
                    ? "bg-afk-olive-accent text-white font-bold shadow-md ring-1 ring-white/20"
                    : isPast
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                    : "bg-[#101216] text-gray-400 border border-[#282E38] hover:text-white hover:border-gray-600"
                }`}
              >
                {isPast ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span>{s.num}.</span>}
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mx-6 mt-6 p-4 bg-red-500/15 border border-red-500/40 rounded-xl flex items-center gap-3 text-sm text-red-300 font-medium shadow-md">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Wizard Body */}
      <div className="p-6 sm:p-8">
        {/* STEP 1: Identity */}
        {step === 1 && (
          <div className="space-y-6 max-w-2xl">
            <div>
              <label className={labelClass}>
                Venture Name <span className="text-amber-400 font-bold">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Heavyweight Graphic Tee Collection #01"
                className={inputClass}
              />
              <span className="text-xs text-gray-400 mt-1.5 block">
                Official commercial name for this product release or project.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>
                  Venture Type <span className="text-amber-400 font-bold">*</span>
                </label>
                <select
                  value={typeCode}
                  onChange={(e) => setTypeCode(e.target.value)}
                  className={inputClass}
                >
                  {ventureTypes.map((vt) => (
                    <option key={vt.code} value={vt.code} className="bg-[#101216] text-white">
                      {vt.name} ({vt.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Managing Partner</label>
                <select
                  value={managerPartnerId}
                  onChange={(e) => setManagerPartnerId(e.target.value)}
                  className={inputClass}
                >
                  {partners.map((p) => (
                    <option key={p.id} value={p.id} className="bg-[#101216] text-white">
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>Description & Business Objectives</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Describe fabric specs, target audience, production batch size, and operational roadmap..."
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>Target Launch Date</label>
                <input
                  type="date"
                  value={targetLaunchDate}
                  onChange={(e) => setTargetLaunchDate(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Target Settlement Date</label>
                <input
                  type="date"
                  value={targetEndDate}
                  onChange={(e) => setTargetEndDate(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Participation Model */}
        {step === 2 && (
          <div className="space-y-5">
            <p className="text-sm text-gray-300 font-medium">
              Choose the distribution architecture for this venture. You will specify exact participant percentages in Step 5.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {MODES.map((m) => {
                const isSelected = participationMode === m.code;
                return (
                  <div
                    key={m.code}
                    onClick={() => setParticipationMode(m.code)}
                    className={`p-5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-[#1E251E] border-afk-olive-accent ring-2 ring-afk-olive-accent shadow-lg"
                        : "bg-[#101216] border-[#2D333F] hover:border-gray-500 hover:bg-[#15181E]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-white">{m.title}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                          isSelected
                            ? "bg-afk-olive-accent text-white"
                            : "bg-[#1C2026] text-gray-400 border border-[#2D333F]"
                        }`}
                      >
                        {m.badge}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">{m.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3: Budget & Target Fund */}
        {step === 3 && (
          <div className="space-y-6 max-w-xl">
            <div>
              <label className={labelClass}>
                Total Budget Cap / Target Funding (৳ BDT) <span className="text-amber-400 font-bold">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3.5 text-afk-olive-accent font-bold text-base">৳</span>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={budgetCap}
                  onChange={(e) => setBudgetCap(parseFloat(e.target.value) || 0)}
                  className="w-full pl-9 pr-4 py-3 bg-[#101216] border border-[#2D333F] rounded-xl text-white font-mono text-base font-bold focus:border-afk-olive-accent focus:ring-1 focus:ring-afk-olive-accent focus:outline-none transition-all shadow-inner"
                />
              </div>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                Total financing required to procure fabric, run manufacturing, packaging, and marketing for this drop.
              </p>
            </div>

            <div className="p-5 bg-[#101216] border border-[#282E38] rounded-xl space-y-2">
              <span className="text-xs font-bold text-afk-olive-accent uppercase tracking-wider block">
                Two-Tier Financial Isolation Guarantee
              </span>
              <p className="text-xs text-gray-300 leading-relaxed">
                This budget forms an independent sub-ledger pool. If actual production costs are lower than target budget, unused capital is preserved for partners or returned during settlement.
              </p>
            </div>
          </div>
        )}

        {/* STEP 4: Select Participating Members */}
        {step === 4 && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-sm text-gray-300 font-medium">
                Choose who participates in this venture. Partners with 0% participation can be omitted without altering their legal 20% company equity.
              </p>
              <button
                type="button"
                onClick={addExternalParticipant}
                className="px-3.5 py-2 text-xs font-bold text-afk-olive-accent bg-afk-olive/20 hover:bg-afk-olive/30 border border-afk-olive rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap self-start"
              >
                <Plus className="w-4 h-4" />
                Add External Investor
              </button>
            </div>

            <div className="space-y-2.5">
              {participants.map((p, idx) => {
                const partnerObj = partners.find((pt) => pt.id === p.partnerId);
                const displayName = partnerObj?.name || p.externalName || `Participant ${idx + 1}`;

                return (
                  <div
                    key={idx}
                    className="p-4 bg-[#101216] border border-[#282E38] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-gray-600 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-afk-olive/25 border border-afk-olive flex items-center justify-center font-bold text-sm text-afk-olive-accent shadow-sm">
                        {displayName.charAt(0)}
                      </div>
                      <div>
                        <span className="text-sm font-bold text-white block">{displayName}</span>
                        <span className="text-xs text-gray-400">
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
                        className="px-3 py-1.5 text-xs bg-[#171A20] border border-[#2D333F] rounded-lg text-white placeholder:text-gray-500 focus:border-afk-olive-accent focus:outline-none"
                      />

                      {participants.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeParticipant(idx)}
                          className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                          title="Remove participant"
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
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-afk-olive-accent uppercase tracking-wider block">
                  Capital Commitment & Allocation Table
                </span>
                <p className="text-xs text-gray-300">
                  Input committed capital and agreed profit/loss distribution.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleEqualize}
                  className="px-3 py-1.5 text-xs font-bold text-gray-300 hover:text-white bg-[#101216] border border-[#2D333F] hover:border-gray-500 rounded-lg transition-colors"
                >
                  Equalize (1/N)
                </button>
                <button
                  type="button"
                  onClick={handleProportionalize}
                  className="px-3 py-1.5 text-xs font-bold text-afk-olive-accent hover:text-white bg-afk-olive/25 border border-afk-olive hover:bg-afk-olive/40 rounded-lg transition-colors"
                >
                  Proportional to Capital
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-[#282E38] rounded-xl shadow-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#101216] text-gray-300 uppercase font-mono text-[11px] border-b border-[#282E38]">
                  <tr>
                    <th className="py-3 px-4">Participant</th>
                    <th className="py-3 px-4">Committed (৳)</th>
                    <th className="py-3 px-4">Profit Share (%)</th>
                    <th className="py-3 px-4">Loss Share (%)</th>
                    <th className="py-3 px-4">Priority Tier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#282E38]/60 bg-[#14171C]">
                  {participants.map((p, idx) => {
                    const partnerObj = partners.find((pt) => pt.id === p.partnerId);
                    const name = partnerObj?.name || p.externalName || `Participant ${idx + 1}`;

                    return (
                      <tr key={idx} className="hover:bg-[#1A1E24]">
                        <td className="py-3 px-4 font-bold text-white text-sm">{name}</td>
                        <td className="py-3 px-4">
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
                            className="w-32 px-3 py-1.5 bg-[#0D0F12] border border-[#2D333F] rounded-lg text-white font-mono text-xs focus:border-afk-olive-accent focus:outline-none"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
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
                              className="w-24 px-3 py-1.5 bg-[#0D0F12] border border-[#2D333F] rounded-lg text-emerald-400 font-bold font-mono text-xs focus:border-afk-olive-accent focus:outline-none"
                            />
                            <span className="text-gray-400 font-bold">%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
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
                              className="w-24 px-3 py-1.5 bg-[#0D0F12] border border-[#2D333F] rounded-lg text-amber-400 font-bold font-mono text-xs focus:border-afk-olive-accent focus:outline-none"
                            />
                            <span className="text-gray-400 font-bold">%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={p.capitalRecoveryPriority || 1}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 1;
                              setParticipants((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, capitalRecoveryPriority: val } : item))
                              );
                            }}
                            className="px-2.5 py-1.5 bg-[#0D0F12] border border-[#2D333F] rounded-lg text-gray-200 text-xs focus:border-afk-olive-accent focus:outline-none"
                          >
                            <option value={1}>Tier 1 (Senior Return)</option>
                            <option value={2}>Tier 2 (Pari-Passu)</option>
                            <option value={3}>Tier 3 (Subordinated)</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Invariant Status Indicators */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div
                className={`p-4 rounded-xl border flex items-center justify-between shadow-sm ${
                  isProfitValid
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                    : "bg-red-500/15 border-red-500/40 text-red-300"
                }`}
              >
                <span className="text-xs font-bold uppercase tracking-wider">Total Profit Share:</span>
                <span className="text-sm font-mono font-bold">
                  {totalProfitPct.toFixed(2)}% {isProfitValid ? "✓ Exact (100.00%)" : "✗ Must equal 100%"}
                </span>
              </div>

              <div
                className={`p-4 rounded-xl border flex items-center justify-between shadow-sm ${
                  isLossValid
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                    : "bg-red-500/15 border-red-500/40 text-red-300"
                }`}
              >
                <span className="text-xs font-bold uppercase tracking-wider">Total Loss Share:</span>
                <span className="text-sm font-mono font-bold">
                  {totalLossPct.toFixed(2)}% {isLossValid ? "✓ Exact (100.00%)" : "✗ Must equal 100%"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 6: Waterfall Structure */}
        {step === 6 && (
          <div className="space-y-6 max-w-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label className={labelClass}>Retained Reserve (%)</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={retainedEarningsPct}
                    onChange={(e) => setRetainedEarningsPct(parseFloat(e.target.value) || 0)}
                    className={inputClass}
                  />
                  <span className="text-gray-400 font-bold">%</span>
                </div>
                <span className="text-xs text-gray-400 mt-1.5 block">
                  Holdback for returns/defects before cash payout.
                </span>
              </div>

              <div>
                <label className={labelClass}>Preferred Hurdle (%)</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={preferredReturnPct}
                    onChange={(e) => setPreferredReturnPct(parseFloat(e.target.value) || 0)}
                    className={inputClass}
                  />
                  <span className="text-gray-400 font-bold">%</span>
                </div>
                <span className="text-xs text-gray-400 mt-1.5 block">
                  Priority return paid before residual pool.
                </span>
              </div>

              <div>
                <label className={labelClass}>Reinvestment Roll (%)</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={reinvestmentPct}
                    onChange={(e) => setReinvestmentPct(parseFloat(e.target.value) || 0)}
                    className={inputClass}
                  />
                  <span className="text-gray-400 font-bold">%</span>
                </div>
                <span className="text-xs text-gray-400 mt-1.5 block">
                  Auto-rolled into subsequent batch fund.
                </span>
              </div>
            </div>

            <div className="p-5 bg-[#101216] border border-[#282E38] rounded-xl space-y-2">
              <span className="text-xs font-bold text-afk-olive-accent uppercase tracking-wider block">
                Deterministic Integer-Paisa Guarantee
              </span>
              <p className="text-xs text-gray-300 leading-relaxed">
                The settlement engine operates in deterministic integer-paisa arithmetic, allocating the rounding remainder to the final eligible participant to guarantee zero financial leakage.
              </p>
            </div>
          </div>
        )}

        {/* STEP 7: Funding Methods */}
        {step === 7 && (
          <div className="space-y-5 max-w-2xl">
            <p className="text-sm text-gray-300 font-medium">
              AFK THEORY supports multiple contribution modes. Select how capital will be delivered:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 bg-[#101216] border border-[#282E38] rounded-xl">
                <span className="text-xs font-bold text-white block mb-1.5">1. Cash & Bank Deposit</span>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Direct deposit into BRAC Bank, bKash Merchant, or Cash on Hand tagged to this venture.
                </p>
              </div>

              <div className="p-5 bg-[#101216] border border-[#282E38] rounded-xl">
                <span className="text-xs font-bold text-white block mb-1.5">2. Partner Loan</span>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Credited to Partner Due Liability (2110-2150) without altering company share capital.
                </p>
              </div>

              <div className="p-5 bg-[#101216] border border-[#282E38] rounded-xl">
                <span className="text-xs font-bold text-white block mb-1.5">3. Non-Cash Fabric Asset</span>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Agreed valuation of raw fabric or trims debited directly into Materials Inventory (1210).
                </p>
              </div>

              <div className="p-5 bg-[#101216] border border-[#282E38] rounded-xl">
                <span className="text-xs font-bold text-white block mb-1.5">4. Sweat / Service Equity</span>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Valued design, shooting, or management service recognized in drop agreement without dilution.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* STEP 8: Product Link */}
        {step === 8 && (
          <div className="space-y-5 max-w-xl">
            <p className="text-sm text-gray-300 font-medium">
              Optionally associate an existing apparel collection with this venture. You can also link products and inventory lots later.
            </p>

            <div>
              <label className={labelClass}>Link Apparel Collection (Optional)</label>
              <select className={inputClass}>
                <option value="" className="bg-[#101216] text-white">None (Link later or independent drop)</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#101216] text-white">
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* STEP 9: Governance & Approvals */}
        {step === 9 && (
          <div className="space-y-5 max-w-2xl">
            <div className="p-5 bg-[#101216] border border-[#282E38] rounded-xl space-y-3.5 shadow-md">
              <span className="text-xs font-bold text-afk-olive-accent uppercase tracking-wider block">
                Two-Tier Ledger Governance
              </span>
              <ul className="text-xs text-gray-300 space-y-2.5 list-disc list-inside leading-relaxed">
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
          <div className="space-y-6 max-w-3xl">
            <div className="p-6 bg-[#101216] border border-[#282E38] rounded-2xl shadow-xl">
              <div className="flex items-center justify-between pb-4 border-b border-[#282E38]">
                <div>
                  <span className="text-xs font-mono font-bold text-afk-olive-accent px-2 py-0.5 rounded bg-afk-olive/20 border border-afk-olive">
                    {typeCode}
                  </span>
                  <h3 className="text-xl font-bold text-white mt-2">{name}</h3>
                </div>
                <span className="px-3.5 py-1 text-xs font-bold rounded-full bg-afk-olive/20 text-afk-olive-accent border border-afk-olive">
                  {participationMode.replace(/_/g, " ")}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-5 border-b border-[#282E38] text-xs">
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-semibold">Budget Cap</span>
                  <span className="font-bold text-white text-sm">৳{budgetCap.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-semibold">Committed</span>
                  <span className="font-bold text-white text-sm">৳{totalCommitted.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-semibold">Participants</span>
                  <span className="font-bold text-white text-sm">{participants.length} Members</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-semibold">Reserve %</span>
                  <span className="font-bold text-white text-sm">{retainedEarningsPct}%</span>
                </div>
              </div>

              <div className="mt-5">
                <span className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-3">
                  Agreed Profit & Loss Distribution
                </span>
                <div className="space-y-2">
                  {participants.map((p, idx) => {
                    const partnerObj = partners.find((pt) => pt.id === p.partnerId);
                    const pName = partnerObj?.name || p.externalName || `Participant ${idx + 1}`;
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs py-2 px-3 bg-[#171A20] border border-[#282E38] rounded-lg"
                      >
                        <span className="font-bold text-white">{pName}</span>
                        <div className="flex items-center gap-4 text-gray-300 font-mono">
                          <span>Committed: ৳{p.committedCapital.toLocaleString()}</span>
                          <span className="text-emerald-400 font-bold">Profit: {p.profitSharePct}%</span>
                          <span className="text-amber-400 font-bold">Loss: {p.lossSharePct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 bg-emerald-500/15 border border-emerald-500/40 rounded-xl flex items-center gap-3 text-xs text-emerald-300 font-medium">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
              <span>
                All mathematical invariants satisfied. Ready to create venture and draft foundation agreement.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Wizard Footer Nav */}
      <div className="p-6 bg-[#1A1E24] border-t border-[#282E38] flex items-center justify-between">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="px-5 py-2.5 text-xs font-bold text-gray-200 hover:text-white bg-[#101216] border border-[#2D333F] hover:bg-[#181B20] rounded-xl transition-all flex items-center gap-2 shadow-sm"
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
            className="px-6 py-2.5 text-xs font-bold text-white bg-afk-olive hover:bg-afk-olive-accent active:bg-afk-olive-dark rounded-xl shadow-md transition-all flex items-center gap-2"
          >
            Next <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={handleFinalSubmit}
            className="px-7 py-3 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-lg shadow-emerald-950/40 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {submitting ? "Launching Venture..." : "Launch Venture & Agreement"}
          </button>
        )}
      </div>
    </div>
  );
}
