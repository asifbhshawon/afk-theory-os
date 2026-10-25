import { db } from "@/lib/db";
import { portalActivityFeed } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";
import { getCurrentPartner } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import {
  Bell,
  CheckCircle2,
  DollarSign,
  Factory,
  Briefcase,
  Truck,
  ShieldCheck,
  Calendar,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function UpdatesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const partner = await getCurrentPartner();
  if (!partner) return null;

  const resolvedParams = await searchParams;
  const activeCategory = resolvedParams.category || "ALL";

  const query = db
    .select()
    .from(portalActivityFeed)
    .orderBy(desc(portalActivityFeed.timestamp));

  if (activeCategory !== "ALL") {
    query.where(eq(portalActivityFeed.category, activeCategory));
  }

  const activities = await query;

  const categories = [
    { code: "ALL", label: "All Updates" },
    { code: "FINANCE", label: "Finance & Capital" },
    { code: "PRODUCTION", label: "Manufacturing & QC" },
    { code: "VENTURE", label: "Venture Projects" },
    { code: "LOGISTICS", label: "Courier & Delivery" },
    { code: "GOVERNANCE", label: "Partner Governance" },
  ];

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case "FINANCE":
        return <DollarSign className="w-4 h-4 text-emerald-400" />;
      case "PRODUCTION":
        return <Factory className="w-4 h-4 text-afk-gold" />;
      case "VENTURE":
        return <Briefcase className="w-4 h-4 text-afk-olive-accent" />;
      case "LOGISTICS":
        return <Truck className="w-4 h-4 text-cyan-400" />;
      case "GOVERNANCE":
        return <ShieldCheck className="w-4 h-4 text-purple-400" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-afk-secondary" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-3 border-b border-afk-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-afk-offwhite flex items-center gap-2">
            <span>Business Updates & Activity Feed</span>
          </h1>
          <p className="text-xs sm:text-sm text-afk-secondary mt-0.5">
            Sanitized operational milestones, production updates, courier settlements and approvals
          </p>
        </div>
      </div>

      {/* Category Pills Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {categories.map((c) => (
          <a
            key={c.code}
            href={`/updates?category=${c.code}`}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition shrink-0 ${
              activeCategory === c.code
                ? "bg-afk-surface border border-afk-borderLight text-afk-offwhite font-semibold"
                : "text-afk-muted hover:text-afk-secondary hover:bg-afk-surface/40"
            }`}
          >
            {c.label}
          </a>
        ))}
      </div>

      {/* Activity Timeline */}
      <div className="bg-afk-card rounded-xl border border-afk-border shadow-sm p-6">
        {activities.length === 0 ? (
          <div className="py-12 text-center text-afk-muted">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No updates found for category &ldquo;{activeCategory}&rdquo;.</p>
          </div>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-afk-border">
            {activities.map((act) => (
              <div key={act.id} className="relative group">
                {/* Timeline node */}
                <div className="absolute -left-6 top-1.5 w-5 h-5 rounded-full bg-afk-surface border border-afk-border flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-afk-olive"></span>
                </div>

                <div className="p-4 rounded-xl bg-afk-surface/60 border border-afk-border hover:border-afk-borderLight transition space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-md bg-afk-black/50 border border-afk-border">
                        {getCategoryIcon(act.category)}
                      </div>
                      <span className="text-xs font-bold text-afk-offwhite">
                        {act.title}
                      </span>
                    </div>
                    <span className="text-2xs text-afk-muted font-mono">
                      {formatDateTime(act.timestamp)}
                    </span>
                  </div>

                  <p className="text-xs text-afk-secondary leading-relaxed pl-8">
                    {act.description}
                  </p>

                  {act.actorName && (
                    <div className="pl-8 text-2xs text-afk-muted flex items-center gap-1.5">
                      <span>Logged by:</span>
                      <span className="text-afk-offwhite font-medium">
                        {act.actorName}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
