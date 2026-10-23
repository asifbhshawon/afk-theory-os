import { eq } from "drizzle-orm";
import { db } from "@/db";
import { paymentAccounts, partners, accounts } from "@/db/schema";
import {
  getVentureById,
  transitionVentureStage,
  approveAgreement,
  saveVentureAgreement,
  VentureStage,
} from "@/server/services/ventures";
import {
  getVentureContributions,
  getVentureFundingSummary,
  recordContribution,
  ContributionType,
} from "@/server/services/funding";
import {
  calculateVentureFinancials,
  executeWaterfallCalculation,
  createSettlementSnapshot,
  approveSettlement,
  disburseSettlement,
  getVentureSettlements,
} from "@/server/services/settlements";
import {
  getFieldDefinitions,
  getEntityCustomFieldValues,
  saveEntityCustomFieldValues,
} from "@/server/services/custom-fields";
import { getEvidenceForEntity } from "@/server/services/evidence";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { VentureWorkspaceClient } from "./VentureWorkspaceClient";

export const dynamic = "force-dynamic";

export default async function VentureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const venture = await getVentureById(id);

  if (!venture) {
    notFound();
  }

  // Fetch sub-ledger and operational data
  const fundingSummary = await getVentureFundingSummary(id);
  const contributions = await getVentureContributions(id);
  const financials = await calculateVentureFinancials(id);
  const settlements = await getVentureSettlements(id);
  const customFieldDefs = await getFieldDefinitions("VENTURE");
  const customFieldVals = await getEntityCustomFieldValues(id);
  const allPaymentAccounts = await db.select().from(paymentAccounts);
  const allPartners = await db.select().from(partners).orderBy(partners.name);
  const evidenceList = await getEvidenceForEntity("VENTURE", id);

  // Server Action: Transition Stage
  async function handleTransitionStage(newStage: string, notes?: string) {
    "use server";
    const authUser = await requireRole(["ADMIN", "FINANCE_MGR", "PARTNER"]);
    await transitionVentureStage(id, newStage as VentureStage, authUser, notes);
    revalidatePath(`/ventures/${id}`);
    revalidatePath("/ventures");
  }

  // Server Action: Approve Agreement
  async function handleApproveAgreement(agreementId: string) {
    "use server";
    const authUser = await requireRole(["ADMIN", "PARTNER", "FINANCE_APPROVER"]);
    await approveAgreement(agreementId, authUser);
    revalidatePath(`/ventures/${id}`);
    revalidatePath("/ventures");
  }

  // Server Action: Record Contribution
  async function handleRecordContribution(data: {
    participantId: string;
    amount: number;
    contributionType: ContributionType;
    paymentAccountId?: string;
    description?: string;
    postLedger?: boolean;
  }) {
    "use server";
    const authUser = await requireRole(["ADMIN", "FINANCE_MGR", "PARTNER"]);
    await recordContribution({
      ventureId: id,
      participantId: data.participantId,
      amount: data.amount,
      contributionType: data.contributionType,
      paymentAccountId: data.paymentAccountId,
      description: data.description || "Capital contribution",
      userId: authUser.id,
    });
    revalidatePath(`/ventures/${id}`);
    revalidatePath("/finance");
  }

  // Server Action: Create Settlement Snapshot
  async function handleCreateSettlement(data: {
    periodStart: string;
    periodEnd: string;
    netProfitOverride?: number;
    settlementType?: "FULL" | "PARTIAL" | "REINVESTMENT" | "LOSS_CARRYFORWARD";
    notes?: string;
  }) {
    "use server";
    const authUser = await requireRole(["ADMIN", "FINANCE_MGR"]);
    await createSettlementSnapshot(id, {
      customNetProfit: data.netProfitOverride,
      settlementType: data.settlementType,
      notes: data.notes,
      userId: authUser.id,
    });
    revalidatePath(`/ventures/${id}`);
  }

  // Server Action: Approve Settlement
  async function handleApproveSettlement(settlementId: string) {
    "use server";
    const authUser = await requireRole(["ADMIN", "PARTNER", "FINANCE_APPROVER"]);
    await approveSettlement(settlementId, authUser);
    revalidatePath(`/ventures/${id}`);
  }

  // Server Action: Disburse Settlement
  async function handleDisburseSettlement(data: {
    settlementId: string;
    paymentAccountId: string;
  }) {
    "use server";
    const authUser = await requireRole(["ADMIN", "FINANCE_MGR"]);
    await disburseSettlement(data.settlementId, {
      paymentAccountId: data.paymentAccountId,
      user: authUser,
    });
    revalidatePath(`/ventures/${id}`);
    revalidatePath("/finance");
  }

  // Server Action: Save Custom Fields
  async function handleSaveCustomFields(fieldValues: Record<string, any>) {
    "use server";
    await requireRole(["ADMIN", "FINANCE_MGR"]);
    await saveEntityCustomFieldValues(id, fieldValues);
    revalidatePath(`/ventures/${id}`);
  }

  return (
    <VentureWorkspaceClient
      venture={venture}
      fundingSummary={fundingSummary}
      contributions={contributions}
      financials={financials}
      settlements={settlements}
      customFieldDefs={customFieldDefs}
      customFieldVals={customFieldVals}
      paymentAccounts={allPaymentAccounts}
      partners={allPartners}
      currentUser={user}
      evidenceList={evidenceList}
      onTransitionStage={handleTransitionStage}
      onApproveAgreement={handleApproveAgreement}
      onRecordContribution={handleRecordContribution}
      onCreateSettlement={handleCreateSettlement}
      onApproveSettlement={handleApproveSettlement}
      onDisburseSettlement={handleDisburseSettlement}
      onSaveCustomFields={handleSaveCustomFields}
    />
  );
}
