import { db } from "@/db";
import { ventures, ventureTypes, ventureAgreements, ventureContributions, partners } from "@/db/schema";
import { getVentures } from "@/server/services/ventures";
import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";
import {
  Layers,
  Plus,
  TrendingUp,
  Coins,
  Shield,
  ArrowRight,
} from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ventures & Investments | AFK THEORY Business OS",
  description: "Drop projects, custom partner waterfalls, and asymmetrical capital management",
};

export default async function VenturesPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; type?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const allVentures = await getVentures({
    stage: params.stage === "ALL" || !params.stage ? undefined : params.stage,
    typeCode: params.type,
  });

  const allContributions = await db.select().from(ventureContributions);

  // Compute metrics
  const totalVenturesCount = allVentures.length;
  const activeVenturesCount = allVentures.filter((v) => v.stage === "ACTIVE").length;

  let totalTargetFund = 0;
  for (const v of allVentures) {
    totalTargetFund += parseFloat(v.budgetCap || v.targetBudget || "0");
  }

  let totalContributed = 0;
  for (const c of allContributions) {
    if (c.status === "CONFIRMED") {
      totalContributed += parseFloat(c.amount || "0");
    }
  }

  const STAGES = [
    { code: "ALL", label: "All Stages" },
    { code: "IDEA", label: "Ideas" },
    { code: "PLANNING", label: "Planning" },
    { code: "ACTIVE", label: "Active Drops" },
    { code: "COMPLETED", label: "Completed" },
    { code: "SETTLED", label: "Settled" },
  ];

  const currentStage = params.stage || "ALL";

  return (
    <div className="space-y-6 select-none">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-afk-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-afk-offwhite">
            Projects, Drops & Investment Pools
          </h1>
          <p className="text-sm text-afk-secondary mt-0.5">
            Universal partnership engine for asymmetrical capital, custom waterfalls, and drop-level accounting.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/studio"
            className="px-4 py-2 text-xs font-semibold text-afk-secondary hover:text-afk-offwhite bg-afk-surface border border-afk-border hover:bg-afk-elevated rounded-lg transition-colors flex items-center gap-2 shadow-sm"
          >
            Studio
          </Link>
          <Link
            href="/ventures/new"
            className="px-4 py-2 text-xs font-semibold text-afk-offwhite bg-afk-olive hover:bg-afk-olive-light rounded-lg shadow-sm transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Venture</span>
          </Link>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-afk-card border border-afk-border rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-afk-secondary uppercase tracking-wider">
              Total Ventures
            </span>
            <Layers className="w-4 h-4 text-afk-olive-accent" />
          </div>
          <div className="text-2xl font-bold text-afk-offwhite mt-2 tabular-nums">
            {totalVenturesCount}
          </div>
          <span className="text-xs text-afk-muted mt-1 block">
            {activeVenturesCount} active in production / sales
          </span>
        </div>

        <div className="p-5 bg-afk-card border border-afk-border rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-afk-secondary uppercase tracking-wider">
              Active Drops
            </span>
            <TrendingUp className="w-4 h-4 text-afk-success" />
          </div>
          <div className="text-2xl font-bold text-afk-success mt-2 tabular-nums">
            {activeVenturesCount}
          </div>
          <span className="text-xs text-afk-muted mt-1 block">
            Generating live drop revenue
          </span>
        </div>

        <div className="p-5 bg-afk-card border border-afk-border rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-afk-secondary uppercase tracking-wider">
              Target Capital
            </span>
            <Coins className="w-4 h-4 text-afk-gold" />
          </div>
          <div className="text-2xl font-bold text-afk-offwhite mt-2 tabular-nums">
            ৳{totalTargetFund.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
          </div>
          <span className="text-xs text-afk-muted mt-1 block">
            Approved agreement budgets
          </span>
        </div>

        <div className="p-5 bg-afk-card border border-afk-border rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-afk-secondary uppercase tracking-wider">
              Capital Contributed
            </span>
            <Shield className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-sky-400 mt-2 tabular-nums">
            ৳{totalContributed.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
          </div>
          <span className="text-xs text-afk-muted mt-1 block">
            Verified in funding ledger
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-afk-border">
        {STAGES.map((s) => {
          const isActive = currentStage === s.code;
          return (
            <Link
              key={s.code}
              href={`/ventures?stage=${s.code}`}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                isActive
                  ? "bg-afk-olive text-afk-offwhite shadow-sm"
                  : "text-afk-secondary hover:text-afk-offwhite bg-afk-surface border border-afk-border"
              }`}
            >
              {s.label}
            </Link>
          );
        })}
      </div>

      {/* Ventures List */}
      {allVentures.length === 0 ? (
        <div className="p-12 text-center bg-afk-card border border-dashed border-afk-border rounded-xl">
          <Layers className="w-10 h-10 text-afk-muted mx-auto mb-2 opacity-60" />
          <h3 className="text-sm font-bold text-afk-offwhite">No Ventures Found</h3>
          <p className="text-xs text-afk-secondary mt-1 max-w-sm mx-auto">
            {currentStage === "ALL"
              ? "Start by creating your first venture, independent project, or seasonal apparel drop."
              : `There are currently no ventures in stage '${currentStage}'.`}
          </p>
          <div className="mt-4">
            <Link
              href="/ventures/new"
              className="px-4 py-2 text-xs font-semibold text-afk-offwhite bg-afk-olive hover:bg-afk-olive-light rounded-lg shadow transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Venture</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {allVentures.map((v) => {
            const stageColors: Record<string, string> = {
              IDEA: "text-purple-300 bg-purple-500/15 border-purple-500/30",
              PLANNING: "text-amber-300 bg-amber-500/15 border-amber-500/30",
              DRAFT_AGREEMENT: "text-blue-300 bg-blue-500/15 border-blue-500/30",
              ACTIVE: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30",
              COMPLETED: "text-sky-300 bg-sky-500/15 border-sky-500/30",
              SETTLED: "text-afk-olive-accent bg-afk-olive/25 border-afk-olive",
              ARCHIVED: "text-gray-400 bg-gray-500/15 border-gray-500/30",
            };

            const stageBadgeStyle = stageColors[v.stage] || stageColors.PLANNING;

            return (
              <div
                key={v.id}
                className="bg-afk-card border border-afk-border rounded-xl p-5 hover:border-afk-border-strong transition flex flex-col justify-between shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-mono font-bold text-afk-olive-accent px-2 py-0.5 rounded bg-afk-olive/20 border border-afk-olive/40">
                      {v.code}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded-full border ${stageBadgeStyle}`}
                    >
                      {v.stage.replace("_", " ")}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-afk-offwhite mb-1">
                    {v.name}
                  </h3>

                  <p className="text-xs text-afk-secondary line-clamp-2 mb-4 leading-relaxed">
                    {v.description || "No description provided."}
                  </p>

                  <div className="grid grid-cols-2 gap-3 py-3 border-t border-b border-afk-border text-xs">
                    <div>
                      <span className="text-afk-muted block text-[10px] uppercase font-bold tracking-wider">Type</span>
                      <span className="font-semibold text-afk-offwhite">{v.typeName}</span>
                    </div>
                    <div>
                      <span className="text-afk-muted block text-[10px] uppercase font-bold tracking-wider">Manager</span>
                      <span className="font-semibold text-afk-offwhite">
                        {v.managerName || "Unassigned"}
                      </span>
                    </div>
                    <div>
                      <span className="text-afk-muted block text-[10px] uppercase font-bold tracking-wider">Budget Cap</span>
                      <span className="font-bold text-afk-offwhite text-xs tabular-nums">
                        {v.budgetCap ? `৳${parseFloat(v.budgetCap).toLocaleString("en-BD")}` : "None"}
                      </span>
                    </div>
                    <div>
                      <span className="text-afk-muted block text-[10px] uppercase font-bold tracking-wider">Launch Target</span>
                      <span className="font-semibold text-afk-offwhite">
                        {v.targetLaunchDate
                          ? new Date(v.targetLaunchDate).toLocaleDateString("en-BD", { month: "short", day: "numeric", year: "numeric" })
                          : "TBD"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-2 flex items-center justify-between">
                  <span className="text-xs text-afk-muted">
                    Created {new Date(v.createdAt).toLocaleDateString("en-BD", { month: "short", day: "numeric" })}
                  </span>
                  <Link
                    href={`/ventures/${v.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-afk-olive-accent hover:text-afk-offwhite transition-colors"
                  >
                    <span>Open Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
