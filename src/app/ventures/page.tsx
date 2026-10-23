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
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Shield,
  Filter,
} from "lucide-react";

export const dynamic = "force-dynamic";

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

  const allAgreements = await db.select().from(ventureAgreements);
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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-afk-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-xs font-mono font-semibold rounded bg-afk-olive/20 text-afk-olive-accent border border-afk-olive">
              VENTURES & WATERFALL ENGINE
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            Projects, Drops & Investment Pools
          </h1>
          <p className="text-sm text-afk-muted">
            Universal partnership engine for asymmetrical capital, custom waterfalls, and drop-level accounting.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/studio"
            className="px-4 py-2 text-sm font-medium text-afk-muted hover:text-white bg-afk-surface border border-afk-border rounded-lg transition-colors flex items-center gap-2"
          >
            Studio
          </Link>
          <Link
            href="/ventures/new"
            className="px-4 py-2 text-sm font-semibold text-white bg-afk-olive-accent hover:bg-afk-olive rounded-lg shadow-sm transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Venture
          </Link>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-afk-surface border border-afk-border rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-afk-muted uppercase tracking-wider">
              Total Ventures
            </span>
            <Layers className="w-4 h-4 text-afk-olive-accent" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {totalVenturesCount}
          </div>
          <span className="text-xs text-afk-muted mt-1 block">
            {activeVenturesCount} active in production / sales
          </span>
        </div>

        <div className="p-4 bg-afk-surface border border-afk-border rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-afk-muted uppercase tracking-wider">
              Active Drops
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2">
            {activeVenturesCount}
          </div>
          <span className="text-xs text-afk-muted mt-1 block">
            Generating live drop revenue
          </span>
        </div>

        <div className="p-4 bg-afk-surface border border-afk-border rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-afk-muted uppercase tracking-wider">
              Target Capital
            </span>
            <Coins className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            ৳{totalTargetFund.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-xs text-afk-muted mt-1 block">
            Approved agreement budgets
          </span>
        </div>

        <div className="p-4 bg-afk-surface border border-afk-border rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-afk-muted uppercase tracking-wider">
              Capital Contributed
            </span>
            <Shield className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-sky-400 mt-2">
            ৳{totalContributed.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-xs text-afk-muted mt-1 block">
            Verified in funding ledger
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-afk-border">
        {STAGES.map((s) => {
          const isActive = currentStage === s.code;
          return (
            <Link
              key={s.code}
              href={`/ventures?stage=${s.code}`}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                isActive
                  ? "bg-afk-olive-accent text-white font-semibold"
                  : "text-afk-muted hover:text-white bg-afk-surface/50 hover:bg-afk-surface"
              }`}
            >
              {s.label}
            </Link>
          );
        })}
      </div>

      {/* Ventures List */}
      {allVentures.length === 0 ? (
        <div className="p-12 text-center bg-afk-surface/40 border border-dashed border-afk-border rounded-2xl">
          <Layers className="w-12 h-12 text-afk-muted mx-auto mb-3 opacity-40" />
          <h3 className="text-base font-medium text-white">No Ventures Found</h3>
          <p className="text-sm text-afk-muted mt-1 max-w-sm mx-auto">
            {currentStage === "ALL"
              ? "Start by creating your first venture, independent project, or seasonal apparel drop."
              : `There are currently no ventures in stage '${currentStage}'.`}
          </p>
          <div className="mt-5">
            <Link
              href="/ventures/new"
              className="px-4 py-2 text-sm font-semibold text-white bg-afk-olive-accent hover:bg-afk-olive rounded-lg transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create First Venture
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {allVentures.map((v) => {
            const stageColors: Record<string, string> = {
              IDEA: "text-purple-400 bg-purple-500/10 border-purple-500/20",
              PLANNING: "text-amber-400 bg-amber-500/10 border-amber-500/20",
              DRAFT_AGREEMENT: "text-blue-400 bg-blue-500/10 border-blue-500/20",
              ACTIVE: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
              COMPLETED: "text-sky-400 bg-sky-500/10 border-sky-500/20",
              SETTLED: "text-afk-olive-accent bg-afk-olive/20 border-afk-olive",
              ARCHIVED: "text-gray-400 bg-gray-500/10 border-gray-500/20",
            };

            const stageBadgeStyle = stageColors[v.stage] || stageColors.PLANNING;

            return (
              <div
                key={v.id}
                className="bg-afk-surface border border-afk-border rounded-xl p-5 hover:border-afk-olive/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-mono font-semibold text-afk-olive-accent">
                      {v.code}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full border ${stageBadgeStyle}`}
                    >
                      {v.stage.replace("_", " ")}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white mb-1 group-hover:text-afk-olive-accent">
                    {v.name}
                  </h3>

                  <p className="text-xs text-afk-muted line-clamp-2 mb-4">
                    {v.description || "No description provided."}
                  </p>

                  <div className="grid grid-cols-2 gap-2 py-3 border-t border-b border-afk-border/50 text-xs">
                    <div>
                      <span className="text-afk-muted block text-[10px] uppercase">Type</span>
                      <span className="font-medium text-white">{v.typeName}</span>
                    </div>
                    <div>
                      <span className="text-afk-muted block text-[10px] uppercase">Manager</span>
                      <span className="font-medium text-white">
                        {v.managerName || "Unassigned"}
                      </span>
                    </div>
                    <div>
                      <span className="text-afk-muted block text-[10px] uppercase">Budget Cap</span>
                      <span className="font-medium text-white">
                        {v.budgetCap ? `৳${parseFloat(v.budgetCap).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "None"}
                      </span>
                    </div>
                    <div>
                      <span className="text-afk-muted block text-[10px] uppercase">Launch Target</span>
                      <span className="font-medium text-white">
                        {v.targetLaunchDate
                          ? new Date(v.targetLaunchDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                          : "TBD"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-2 flex items-center justify-between">
                  <span className="text-[11px] text-afk-muted font-mono">
                    Created {new Date(v.createdAt).toLocaleDateString()}
                  </span>
                  <Link
                    href={`/ventures/${v.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-afk-olive-accent hover:text-white transition-colors"
                  >
                    Open Workspace <ArrowRight className="w-3.5 h-3.5" />
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
