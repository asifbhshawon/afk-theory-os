import { db } from "@/db";
import { partners, ventureTypes, collections, products } from "@/db/schema";
import { createVenture, saveVentureAgreement, ParticipationMode } from "@/server/services/ventures";
import { requireRole } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { VentureWizardClient } from "./VentureWizardClient";

export const dynamic = "force-dynamic";

export default async function NewVenturePage() {
  const allPartners = await db.select().from(partners).orderBy(partners.name);
  const allVentureTypes = await db.select().from(ventureTypes);
  const allCollections = await db.select().from(collections);
  const allProducts = await db.select().from(products);

  async function handleCreateVenture(data: {
    name: string;
    typeCode: string;
    description?: string;
    managerPartnerId?: string;
    budgetCap?: number;
    targetLaunchDate?: string;
    targetEndDate?: string;
    notes?: string;
    tags?: string[];
    participationMode: ParticipationMode;
    targetFundAmount?: number;
    hurdleRatePct?: number;
    preferredReturnPct?: number;
    retainedEarningsPct?: number;
    reinvestmentPct?: number;
    participants: any[];
  }) {
    "use server";
    const user = await requireRole(["ADMIN", "FINANCE_MGR", "PARTNER_VIEWER"]);

    // 1. Create venture
    const venture = await createVenture({
      title: data.name,
      typeCode: data.typeCode,
      description: data.description,
      targetBudget: data.budgetCap,
      startDate: data.targetLaunchDate,
      targetDate: data.targetEndDate,
      notes: data.notes,
      userId: user.id,
    });

    // 2. Save agreement and participants
    await saveVentureAgreement(
      venture.id,
      {
        participationMode: data.participationMode,
        targetBudget: data.targetFundAmount || data.budgetCap || 0,
        waterfallRules: {
          hurdleRatePct: data.hurdleRatePct || 0,
          preferredReturnPct: data.preferredReturnPct || 0,
          retainedReservePct: data.retainedEarningsPct || 0,
          reinvestmentPct: data.reinvestmentPct || 0,
        },
        participants: data.participants.map((p) => {
          const partnerObj = allPartners.find((pt) => pt.id === p.partnerId);
          return {
            partnerId: p.partnerId || null,
            name: partnerObj?.name || p.externalName || "Participant",
            isExternal: Boolean(p.isExternal),
            role: p.roleDescription || "INVESTOR",
            investmentCommitment: p.committedCapital || p.investmentCommitment || 0,
            profitSharingPercentage: p.profitSharePct || p.profitSharingPercentage || 0,
            lossSharingPercentage: p.lossSharePct || p.lossSharingPercentage || 0,
            capitalRecoveryPriority: p.capitalRecoveryPriority || 1,
          };
        }),
        notes: data.notes,
      },
      user.id
    );

    revalidatePath("/ventures");
    redirect(`/ventures/${venture.id}`);
  }

  return (
    <div className="max-w-5xl mx-auto py-4">
      <VentureWizardClient
        partners={allPartners}
        ventureTypes={allVentureTypes}
        collections={allCollections}
        products={allProducts}
        onSubmit={handleCreateVenture}
      />
    </div>
  );
}
