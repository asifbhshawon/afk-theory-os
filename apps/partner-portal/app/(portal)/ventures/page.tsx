import { db } from "@/lib/db";
import { portalVentures } from "@/lib/schema";
import { desc } from "drizzle-orm";
import { getCurrentPartner, hasVentureAccess } from "@/lib/auth";
import { formatBdt, formatDate } from "@/lib/format";
import {
  Briefcase,
  Users,
  Target,
  TrendingUp,
  Package,
  CheckCircle2,
  Lock,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function VenturesPage() {
  const partner = await getCurrentPartner();
  if (!partner) return null;

  const allVentures = await db
    .select()
    .from(portalVentures)
    .orderBy(desc(portalVentures.updatedAt));

  const permittedVentures = allVentures.filter((v) =>
    hasVentureAccess(partner, v.ventureNumber)
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="pb-3 border-b border-afk-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-afk-offwhite flex items-center gap-2">
            <span>Ventures & Dedicated Projects</span>
            <span className="text-xs px-2 py-0.5 rounded bg-afk-surface border border-afk-border text-afk-olive-accent font-semibold">
              {permittedVentures.length} Permitted
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-afk-secondary mt-0.5">
            Independent product drops, seasonal collections, and modular investor agreements
          </p>
        </div>

        <div className="text-2xs text-afk-muted flex items-center gap-1.5 self-start sm:self-auto bg-afk-surface px-3 py-1.5 rounded-lg border border-afk-border">
          <Lock className="w-3.5 h-3.5 text-afk-gold" />
          <span>Restricted to your approved venture agreements</span>
        </div>
      </div>

      {/* Ventures Cards Grid */}
      {permittedVentures.length === 0 ? (
        <div className="bg-afk-card p-12 rounded-xl border border-afk-border text-center">
          <Briefcase className="w-10 h-10 text-afk-muted mx-auto mb-3" />
          <h3 className="text-base font-bold text-afk-offwhite">
            No Permitted Ventures Assigned
          </h3>
          <p className="text-xs text-afk-secondary mt-1 max-w-md mx-auto">
            You do not currently have authorized investor or operational access to active venture projects. Contact the Managing Partner to amend venture participation agreements.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {permittedVentures.map((venture) => {
            const participants = Array.isArray(venture.participants)
              ? venture.participants
              : [];
            const myParticipation = participants.find(
              (p: any) =>
                p.partnerId === partner.id ||
                p.name?.toLowerCase() === partner.name?.toLowerCase()
            );

            const prod = (venture.productionProgress as any) || {};
            const sales = (venture.salesProgress as any) || {};

            return (
              <div
                key={venture.id}
                className="bg-afk-card rounded-xl border border-afk-border shadow-sm flex flex-col justify-between overflow-hidden"
              >
                {/* Venture Card Header */}
                <div className="p-5 border-b border-afk-border bg-afk-surface/40">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-afk-gold">
                          {venture.ventureNumber}
                        </span>
                        <span className="text-2xs px-2 py-0.5 rounded bg-afk-surface border border-afk-border text-afk-secondary uppercase">
                          {venture.typeName}
                        </span>
                      </div>
                      <h2 className="text-base font-bold text-afk-offwhite mt-1">
                        {venture.title}
                      </h2>
                    </div>

                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide bg-afk-surface border border-afk-border text-afk-olive-accent shrink-0">
                      {venture.stage}
                    </span>
                  </div>

                  {venture.description && (
                    <p className="text-xs text-afk-secondary mt-2 line-clamp-2">
                      {venture.description}
                    </p>
                  )}
                </div>

                {/* Body Details */}
                <div className="p-5 space-y-4">
                  {/* Budget & Funding Grid */}
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-2.5 rounded-lg bg-afk-surface border border-afk-border">
                      <span className="text-2xs text-afk-muted uppercase tracking-wider block">Target Budget</span>
                      <span className="text-sm font-bold text-afk-offwhite block mt-0.5 tabular-nums">
                        {formatBdt(venture.targetBudget)}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-afk-surface border border-afk-border">
                      <span className="text-2xs text-afk-muted uppercase tracking-wider block">Actual Raised</span>
                      <span className="text-sm font-bold text-emerald-400 block mt-0.5 tabular-nums">
                        {formatBdt(venture.actualCashRaised)}
                      </span>
                    </div>
                  </div>

                  {/* My Participation Highlight */}
                  {myParticipation && (
                    <div className="p-3 rounded-lg bg-afk-olive-dark/40 border border-afk-olive/40 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-afk-offwhite flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-afk-olive-accent" />
                          <span>My Investor Participation ({partner.name})</span>
                        </span>
                        <span className="text-2xs font-mono font-bold text-afk-gold uppercase">
                          {myParticipation.role || "INVESTOR"}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 pt-1 text-center text-2xs">
                        <div>
                          <span className="text-afk-muted block">Invested:</span>
                          <span className="font-bold text-afk-offwhite tabular-nums">
                            {formatBdt(myParticipation.actualCashContributed || myParticipation.committedCapital)}
                          </span>
                        </div>
                        <div>
                          <span className="text-afk-muted block">Capital %:</span>
                          <span className="font-bold text-afk-offwhite tabular-nums">
                            {myParticipation.investmentPercentage || myParticipation.investmentCommitment || "—"}%
                          </span>
                        </div>
                        <div>
                          <span className="text-afk-muted block">Profit Split:</span>
                          <span className="font-bold text-afk-olive-accent tabular-nums">
                            {myParticipation.profitSharingPercentage || myParticipation.profitSharePct || "—"}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Production & Sales Progress Preview */}
                  {(prod.plannedQty || sales.unitsSold) && (
                    <div className="p-3 rounded-lg bg-afk-surface border border-afk-border text-2xs space-y-2">
                      {prod.plannedQty && (
                        <div className="flex items-center justify-between">
                          <span className="text-afk-secondary flex items-center gap-1">
                            <Package className="w-3 h-3 text-afk-gold" />
                            <span>Production:</span>
                          </span>
                          <span className="font-semibold text-afk-offwhite">
                            {prod.completedQty || 0} / {prod.plannedQty} units ({prod.qcPassRate || 100}% QC pass)
                          </span>
                        </div>
                      )}
                      {sales.unitsSold && (
                        <div className="flex items-center justify-between">
                          <span className="text-afk-secondary flex items-center gap-1">
                            <TrendingUp className="w-3 h-3 text-emerald-400" />
                            <span>Sales Velocity:</span>
                          </span>
                          <span className="font-semibold text-afk-offwhite">
                            {sales.unitsSold} sold ({formatBdt(sales.netSales)})
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Performance Summary / Note */}
                  {venture.performanceSummary && (
                    <p className="text-2xs text-afk-muted italic border-l-2 border-afk-olive pl-2">
                      “{venture.performanceSummary}”
                    </p>
                  )}
                </div>

                {/* Footer Dates */}
                <div className="px-5 py-3 border-t border-afk-border bg-afk-surface/20 flex items-center justify-between text-2xs text-afk-muted">
                  <span>Start: {formatDate(venture.startDate)}</span>
                  <span>Target Close: {formatDate(venture.targetDate)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
