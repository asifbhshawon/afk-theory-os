import { db } from "@/db";
import {
  ventures,
  ventureTypes,
  ventureAgreements,
  ventureParticipants,
  ventureProductLinks,
  partners,
  users,
  auditLogs,
  workflowDefinitions,
  collections,
  inventoryLots,
  productionOrders,
} from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";

export type ParticipationMode =
  | "EQUAL"
  | "PROPORTIONAL"
  | "CUSTOM_PROFIT"
  | "FIXED_RETURN"
  | "CAPITAL_RECOVERY_FIRST"
  | "PROFIT_REINVESTMENT"
  | "MANAGEMENT_SERVICE"
  | "CUSTOM_WATERFALL"
  | "PROPORTIONAL_CAPITAL"
  | "CUSTOM_PROFIT_SPLIT"
  | "EQUAL_SPLIT"
  | "FIXED_RETURN_PLUS_RESIDUAL"
  | "REINVESTMENT"
  | "SERVICE_SWEAT_EQUITY"
  | "MULTI_STAGE_WATERFALL";

export type VentureStage =
  | "IDEA"
  | "PLANNING"
  | "DRAFT_AGREEMENT"
  | "ACTIVE"
  | "COMPLETED"
  | "SETTLED"
  | "ARCHIVED";

export interface CreateVentureInput {
  title: string;
  typeCode: string;
  description?: string;
  stage?: VentureStage;
  managerUserId?: string;
  targetBudget?: number;
  startDate?: string | Date;
  targetDate?: string | Date;
  notes?: string;
  userId?: string;
}

export interface ParticipantInput {
  partnerId?: string | null;
  name: string;
  isExternal?: boolean;
  role?: string;
  investmentCommitment: number;
  profitSharingPercentage: number;
  lossSharingPercentage: number;
  capitalRecoveryPriority?: number;
  responsibilities?: string;
}

export interface AgreementInput {
  participationMode: ParticipationMode;
  targetBudget?: number;
  waterfallRules?: Record<string, any>;
  lossRecoveryPolicy?: string;
  effectiveDate?: string | Date;
  notes?: string;
  participants?: ParticipantInput[];
}

let sequenceInitialized = false;

export async function ensureVentureSequence(client?: any) {
  if (sequenceInitialized) return;
  const runner = client || db;
  try {
    await runner.execute(sql`CREATE SEQUENCE IF NOT EXISTS venture_seq START WITH 100001`);
    sequenceInitialized = true;
  } catch {
    // ignore
  }
}

// Generate unique sequential venture code (e.g. VENT-2026-0001) backed by PostgreSQL sequence
export async function generateVentureCode(txClient?: any): Promise<string> {
  const client = txClient || db;
  const year = new Date().getFullYear();
  await ensureVentureSequence(db);
  const res = await client.execute(sql`SELECT nextval('venture_seq') as seq`);
  const seq = String(res.rows[0].seq).padStart(4, "0");
  return `VENT-${year}-${seq}`;
}

// Create a new venture
export async function createVenture(input: CreateVentureInput, txClient?: any) {
  const execute = async (tx: any) => {
    // 1. Validate venture type
    const [vType] = await tx
      .select()
      .from(ventureTypes)
      .where(eq(ventureTypes.code, input.typeCode))
      .limit(1);

    if (!vType) {
      throw new Error(`Invalid venture type code: ${input.typeCode}`);
    }

    // 2. Generate code
    const ventureNumber = await generateVentureCode(tx);

    // 3. Insert venture record
    const [venture] = await tx
      .insert(ventures)
      .values({
        ventureNumber,
        title: input.title,
        typeCode: input.typeCode,
        description: input.description,
        stage: input.stage || "PLANNING",
        managerUserId: input.managerUserId || null,
        targetBudget: input.targetBudget ? input.targetBudget.toFixed(2) : "0.00",
        startDate: input.startDate ? new Date(input.startDate) : null,
        targetDate: input.targetDate ? new Date(input.targetDate) : null,
        createdByUserId: input.userId || null,
      })
      .returning();

    // 4. Create default agreement in DRAFT
    await tx.insert(ventureAgreements).values({
      ventureId: venture.id,
      version: 1,
      status: "DRAFT",
      participationMode: "PROPORTIONAL",
      effectiveDate: new Date(),
      waterfallRules: {},
      lossRecoveryPolicy: "PROPORTIONAL",
      notes: input.notes || "Initial Foundation Agreement",
    });

    // 5. Audit log
    if (input.userId) {
      await tx.insert(auditLogs).values({
        userId: input.userId,
        action: "CREATE_VENTURE",
        entityType: "VENTURE",
        entityId: venture.id,
        details: `Created venture ${ventureNumber}: ${input.title} (${input.typeCode})`,
      });
    }

    return venture;
  };

  if (txClient) {
    return await execute(txClient);
  } else {
    return await db.transaction(execute);
  }
}

// Get ventures with optional filters and statistics
export async function getVentures(filters?: {
  stage?: string;
  typeCode?: string;
  managerUserId?: string;
}) {
  const query = db
    .select({
      venture: ventures,
      type: ventureTypes,
      manager: users,
    })
    .from(ventures)
    .leftJoin(ventureTypes, eq(ventures.typeCode, ventureTypes.code))
    .leftJoin(users, eq(ventures.managerUserId, users.id))
    .orderBy(desc(ventures.createdAt));

  const rows = await query;

  return rows
    .filter(({ venture }) => {
      if (filters?.stage && venture.stage !== filters.stage) return false;
      if (filters?.typeCode && venture.typeCode !== filters.typeCode) return false;
      if (filters?.managerUserId && venture.managerUserId !== filters.managerUserId) return false;
      return true;
    })
    .map(({ venture, type, manager }) => ({
      ...venture,
      code: venture.ventureNumber,
      name: venture.title,
      typeName: type?.name || venture.typeCode,
      managerName: manager?.name || null,
      budgetCap: venture.targetBudget,
      targetLaunchDate: venture.startDate,
      targetEndDate: venture.targetDate,
    }));
}

// Get comprehensive venture details by ID
export async function getVentureById(id: string) {
  const [venture] = await db
    .select({
      venture: ventures,
      type: ventureTypes,
      manager: users,
    })
    .from(ventures)
    .leftJoin(ventureTypes, eq(ventures.typeCode, ventureTypes.code))
    .leftJoin(users, eq(ventures.managerUserId, users.id))
    .where(eq(ventures.id, id))
    .limit(1);

  if (!venture) return null;

  // Fetch agreements
  const agreements = await db
    .select()
    .from(ventureAgreements)
    .where(eq(ventureAgreements.ventureId, id))
    .orderBy(desc(ventureAgreements.version));

  const activeAgreement = agreements.find((a) => a.status === "APPROVED") || agreements[0] || null;

  // Fetch participants for active agreement
  let participants: any[] = [];
  if (activeAgreement) {
    participants = await db
      .select({
        participant: ventureParticipants,
        partner: partners,
      })
      .from(ventureParticipants)
      .leftJoin(partners, eq(ventureParticipants.partnerId, partners.id))
      .where(eq(ventureParticipants.agreementId, activeAgreement.id))
      .orderBy(ventureParticipants.createdAt);
  }

  // Fetch product links
  const links = await db
    .select()
    .from(ventureProductLinks)
    .where(eq(ventureProductLinks.ventureId, id));

  return {
    ...venture.venture,
    code: venture.venture.ventureNumber,
    name: venture.venture.title,
    typeName: venture.type?.name || venture.venture.typeCode,
    managerName: venture.manager?.name || null,
    budgetCap: venture.venture.targetBudget,
    targetLaunchDate: venture.venture.startDate,
    targetEndDate: venture.venture.targetDate,
    agreements,
    activeAgreement,
    participants: participants.map((p) => ({
      ...p.participant,
      partnerName: p.participant.name,
      committedCapital: p.participant.investmentCommitment,
      profitSharePct: p.participant.profitSharingPercentage,
      lossSharePct: p.participant.lossSharingPercentage,
    })),
    productLinks: links,
  };
}

// Transition venture stage enforcing workflow transitions and authorization
export async function transitionVentureStage(
  id: string,
  newStage: VentureStage,
  user: { id: string; roles: string[] },
  notes?: string
) {
  return await db.transaction(async (tx) => {
    const [venture] = await tx.select().from(ventures).where(eq(ventures.id, id)).limit(1);
    if (!venture) throw new Error(`Venture with ID ${id} not found.`);

    const currentStage = venture.stage as VentureStage;
    if (currentStage === newStage) return venture;

    // Check workflow definitions
    const [wf] = await tx
      .select()
      .from(workflowDefinitions)
      .where(eq(workflowDefinitions.workflowType, "VENTURE_APPROVAL"))
      .limit(1);

    if (wf && wf.stagesJson) {
      const stagesConfig = wf.stagesJson as any;
      const allowedNext = stagesConfig.allowedTransitions?.[currentStage] || [];
      if (!allowedNext.includes(newStage)) {
        throw new Error(
          `Invalid stage transition: cannot move from '${currentStage}' to '${newStage}'. Allowed: [${allowedNext.join(", ")}]`
        );
      }

      // Check required role
      const requiredRole = stagesConfig.requiredRoleToAdvance?.[newStage];
      if (requiredRole && !user.roles.includes(requiredRole) && !user.roles.includes("ADMIN")) {
        throw new Error(
          `Authorisation failure: Advancing venture to '${newStage}' requires role '${requiredRole}'.`
        );
      }
    }

    // Specific business validations
    if (newStage === "ACTIVE") {
      // Must have an approved agreement
      const [approvedAg] = await tx
        .select()
        .from(ventureAgreements)
        .where(and(eq(ventureAgreements.ventureId, id), eq(ventureAgreements.status, "APPROVED")))
        .limit(1);

      if (!approvedAg) {
        throw new Error(
          "Cannot activate venture: an APPROVED participation agreement is required before entering ACTIVE stage."
        );
      }

      // Verify participant profit split invariant
      const participants = await tx
        .select()
        .from(ventureParticipants)
        .where(eq(ventureParticipants.agreementId, approvedAg.id));

      if (participants.length === 0) {
        throw new Error("Cannot activate venture: participation agreement has zero participants.");
      }

      const totalProfitShare = participants.reduce((acc, p) => acc + parseFloat(p.profitSharingPercentage), 0);
      const roundedProfit = Math.round(totalProfitShare * 100) / 100;
      if (Math.abs(roundedProfit - 100.0) > 0.05) {
        throw new Error(
          `Cannot activate venture: participant profit share sum is ${roundedProfit}%. It must strictly equal 100.00%.`
        );
      }
    }

    const [updated] = await tx
      .update(ventures)
      .set({
        stage: newStage,
        updatedAt: new Date(),
      })
      .where(eq(ventures.id, id))
      .returning();

    await tx.insert(auditLogs).values({
      userId: user.id,
      action: "TRANSITION_STAGE",
      entityType: "VENTURE",
      entityId: id,
      details: `Venture ${updated.ventureNumber} transitioned from ${currentStage} to ${newStage}. Notes: ${notes || "None"}`,
    });

    return updated;
  });
}

// Compute deterministic percentages with integer-paisa rounding remainder allocated to the last participant
export function computeBalancedPercentages(
  items: { amount: number }[],
  totalAmount: number
): string[] {
  if (totalAmount <= 0 || items.length === 0) {
    return items.map(() => "0.00");
  }

  let runningTotalPct = 0;
  const result: string[] = [];

  for (let i = 0; i < items.length; i++) {
    if (i === items.length - 1) {
      // Final item receives exact remainder to guarantee 100.00%
      const finalPct = Math.max(0, 100 - runningTotalPct);
      result.push(finalPct.toFixed(2));
    } else {
      const rawPct = (items[i].amount / totalAmount) * 100;
      const roundedPct = Math.round(rawPct * 100) / 100;
      runningTotalPct += roundedPct;
      result.push(roundedPct.toFixed(2));
    }
  }

  return result;
}

// Save or amend a venture participation agreement
export async function saveVentureAgreement(
  ventureId: string,
  input: AgreementInput,
  userId?: string
) {
  return await db.transaction(async (tx) => {
    // 1. Check existing agreements for this venture
    const existingAgreements = await tx
      .select()
      .from(ventureAgreements)
      .where(eq(ventureAgreements.ventureId, ventureId))
      .orderBy(desc(ventureAgreements.version));

    let targetAgreement: any;
    let isNewVersion = false;

    const latest = existingAgreements[0];
    if (latest && latest.status === "DRAFT") {
      targetAgreement = latest;
    } else {
      isNewVersion = true;
      const newVersion = latest ? latest.version + 1 : 1;
      const [newAg] = await tx
        .insert(ventureAgreements)
        .values({
          ventureId,
          version: newVersion,
          status: "DRAFT",
          participationMode: input.participationMode,
          effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : new Date(),
          waterfallRules: input.waterfallRules || {},
          lossRecoveryPolicy: input.lossRecoveryPolicy || "PROPORTIONAL",
          notes: input.notes,
        })
        .returning();
      targetAgreement = newAg;
    }

    // 2. Update agreement metadata if existing draft
    if (!isNewVersion) {
      const [updatedAg] = await tx
        .update(ventureAgreements)
        .set({
          participationMode: input.participationMode,
          effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : targetAgreement.effectiveDate,
          waterfallRules: input.waterfallRules || targetAgreement.waterfallRules,
          lossRecoveryPolicy: input.lossRecoveryPolicy || targetAgreement.lossRecoveryPolicy,
          notes: input.notes || targetAgreement.notes,
        })
        .where(eq(ventureAgreements.id, targetAgreement.id))
        .returning();
      targetAgreement = updatedAg;
    }

    // 3. Process participants if provided
    if (input.participants && input.participants.length > 0) {
      await tx
        .delete(ventureParticipants)
        .where(eq(ventureParticipants.agreementId, targetAgreement.id));

      const processedParticipants = [...input.participants];

      if (input.participationMode === "EQUAL" || input.participationMode === "EQUAL_SPLIT") {
        const balanced = computeBalancedPercentages(
          processedParticipants.map(() => ({ amount: 1 })),
          processedParticipants.length
        );
        for (let i = 0; i < processedParticipants.length; i++) {
          processedParticipants[i].profitSharingPercentage = parseFloat(balanced[i]);
          processedParticipants[i].lossSharingPercentage = parseFloat(balanced[i]);
        }
      } else if (input.participationMode === "PROPORTIONAL" || input.participationMode === "PROPORTIONAL_CAPITAL") {
        const totalCapital = processedParticipants.reduce((sum, p) => sum + p.investmentCommitment, 0);
        if (totalCapital > 0) {
          const balanced = computeBalancedPercentages(
            processedParticipants.map((p) => ({ amount: p.investmentCommitment })),
            totalCapital
          );
          for (let i = 0; i < processedParticipants.length; i++) {
            processedParticipants[i].profitSharingPercentage = parseFloat(balanced[i]);
            processedParticipants[i].lossSharingPercentage = parseFloat(balanced[i]);
          }
        }
      }

      for (const p of processedParticipants) {
        await tx.insert(ventureParticipants).values({
          agreementId: targetAgreement.id,
          ventureId,
          partnerId: p.partnerId || null,
          name: p.name,
          isExternal: p.isExternal || false,
          role: p.role || "INVESTOR",
          investmentCommitment: (p.investmentCommitment || 0).toFixed(2),
          profitSharingPercentage: (p.profitSharingPercentage || 0).toFixed(2),
          lossSharingPercentage: (p.lossSharingPercentage || 0).toFixed(2),
          capitalRecoveryPriority: p.capitalRecoveryPriority || 1,
          responsibilities: p.responsibilities || null,
          status: "ACTIVE",
        });
      }
    }

    if (userId) {
      await tx.insert(auditLogs).values({
        userId,
        action: isNewVersion ? "CREATE_AGREEMENT_VERSION" : "UPDATE_AGREEMENT",
        entityType: "VENTURE_AGREEMENT",
        entityId: targetAgreement.id,
        details: `Saved agreement v${targetAgreement.version} for venture ${ventureId} (Mode: ${targetAgreement.participationMode})`,
      });
    }

    return targetAgreement;
  });
}

// Approve an agreement (locks it, enforces 100% split invariants)
export async function approveAgreement(
  agreementId: string,
  user: { id: string; roles: string[] }
) {
  if (!user.roles.includes("FINANCE_APPROVER") && !user.roles.includes("ADMIN")) {
    throw new Error("Authorisation failure: Only FINANCE_APPROVER or ADMIN can approve venture agreements.");
  }

  return await db.transaction(async (tx) => {
    const [ag] = await tx
      .select()
      .from(ventureAgreements)
      .where(eq(ventureAgreements.id, agreementId))
      .limit(1);

    if (!ag) throw new Error(`Agreement ${agreementId} not found.`);
    if (ag.status === "APPROVED") return ag;

    // Validate participants
    const participants = await tx
      .select()
      .from(ventureParticipants)
      .where(eq(ventureParticipants.agreementId, agreementId));

    if (participants.length === 0) {
      throw new Error("Cannot approve agreement: at least one participant is required.");
    }

    // Verify 100.00% invariant
    const totalProfitPct = participants.reduce((acc, p) => acc + parseFloat(p.profitSharingPercentage), 0);
    const totalLossPct = participants.reduce((acc, p) => acc + parseFloat(p.lossSharingPercentage), 0);

    const roundedProfit = Math.round(totalProfitPct * 100) / 100;
    const roundedLoss = Math.round(totalLossPct * 100) / 100;

    if (Math.abs(roundedProfit - 100.0) > 0.05) {
      throw new Error(
        `Invariant violation: Total profit share must sum to 100.00% (currently ${roundedProfit}%).`
      );
    }

    if (Math.abs(roundedLoss - 100.0) > 0.05) {
      throw new Error(
        `Invariant violation: Total loss share must sum to 100.00% (currently ${roundedLoss}%).`
      );
    }

    // Supersede previously approved agreements for this venture
    await tx
      .update(ventureAgreements)
      .set({ status: "SUPERSEDED" })
      .where(
        and(
          eq(ventureAgreements.ventureId, ag.ventureId),
          eq(ventureAgreements.status, "APPROVED")
        )
      );

    // Approve current agreement
    const [approved] = await tx
      .update(ventureAgreements)
      .set({
        status: "APPROVED",
        approvedByUserId: user.id,
        approvedAt: new Date(),
        isLocked: true,
      })
      .where(eq(ventureAgreements.id, agreementId))
      .returning();

    await tx.insert(auditLogs).values({
      userId: user.id,
      action: "APPROVE_AGREEMENT",
      entityType: "VENTURE_AGREEMENT",
      entityId: agreementId,
      details: `Approved agreement v${ag.version} for venture ${ag.ventureId}`,
    });

    return approved;
  });
}

// Link product, collection, lot, or production order to venture
export async function linkEntityToVenture(
  ventureId: string,
  input: {
    productId?: string;
    collectionId?: string;
    inventoryLotId?: string;
    productionOrderId?: string;
    notes?: string;
    userId?: string;
  }
) {
  return await db.transaction(async (tx) => {
    const [link] = await tx
      .insert(ventureProductLinks)
      .values({
        ventureId,
        productId: input.productId || null,
        collectionId: input.collectionId || null,
        notes: input.notes || null,
      })
      .returning();

    if (input.collectionId) {
      await tx
        .update(collections)
        .set({ ventureId })
        .where(eq(collections.id, input.collectionId));
    }

    if (input.inventoryLotId) {
      await tx
        .update(inventoryLots)
        .set({ ventureId })
        .where(eq(inventoryLots.id, input.inventoryLotId));
    }

    if (input.productionOrderId) {
      await tx
        .update(productionOrders)
        .set({ ventureId })
        .where(eq(productionOrders.id, input.productionOrderId));
    }

    if (input.userId) {
      await tx.insert(auditLogs).values({
        userId: input.userId,
        action: "LINK_VENTURE_ENTITY",
        entityType: "VENTURE",
        entityId: ventureId,
        details: `Linked entity to venture ${ventureId} (Product: ${input.productId || "none"}, Collection: ${input.collectionId || "none"})`,
      });
    }

    return link;
  });
}
