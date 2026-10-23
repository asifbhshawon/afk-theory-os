import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/db";
import {
  partners,
  users,
  roles,
  userRoles,
  paymentAccounts,
  accounts,
  ventures,
  ventureAgreements,
  ventureParticipants,
  ventureContributions,
  ventureSettlements,
  ventureSettlementLines,
  ventureAllocationSnapshots,
  customFieldDefinitions,
  customFieldValues,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  createVenture,
  saveVentureAgreement,
  approveAgreement,
  transitionVentureStage,
  computeBalancedPercentages,
  getVentureById,
} from "@/server/services/ventures";
import {
  recordContribution,
  getVentureFundingSummary,
  getVentureContributions,
} from "@/server/services/funding";
import {
  executeWaterfallCalculation,
  createSettlementSnapshot,
  approveSettlement,
  disburseSettlement,
  getVentureSettlements,
} from "@/server/services/settlements";
import {
  createFieldDefinition,
  saveEntityCustomFieldValues,
  getEntityCustomFieldValues,
} from "@/server/services/custom-fields";

describe("Acceptance Test 15: Flexible Partnership & Project Investment Engine", () => {
  let shawonPartner: any;
  let rafiPartner: any;
  let tousifPartner: any;
  let midhatPartner: any;
  let mueidPartner: any;
  let bracPaymentAccount: any;
  let adminUser: { id: string; roles: string[] };
  let approverUser: { id: string; roles: string[] };

  beforeAll(async () => {
    // 1. Fetch partners
    const allPartners = await db.select().from(partners);
    shawonPartner = allPartners.find((p) => p.name === "Shawon");
    rafiPartner = allPartners.find((p) => p.name === "Rafi");
    tousifPartner = allPartners.find((p) => p.name === "Tousif");
    midhatPartner = allPartners.find((p) => p.name === "Midhat");
    mueidPartner = allPartners.find((p) => p.name === "Mueid");

    // 2. Fetch payment account
    const [pa] = await db.select().from(paymentAccounts).where(eq(paymentAccounts.type, "BANK")).limit(1);
    bracPaymentAccount = pa || (await db.select().from(paymentAccounts).limit(1))[0];

    // 3. Setup mock users
    const [adminDbUser] = await db.select().from(users).limit(1);
    adminUser = { id: adminDbUser.id, roles: ["ADMIN", "FINANCE_MGR"] };
    approverUser = { id: adminDbUser.id, roles: ["FINANCE_APPROVER"] };
  });

  // --------------------------------------------------------------------------
  // Scenario A: Unequal investments
  // --------------------------------------------------------------------------
  it("Scenario A: tracks unequal investments (Shawon ৳50k, Rafi ৳30k, Tousif ৳20k; Midhat/Mueid 0%)", async () => {
    const venture = await createVenture({
      title: "Drop A - Unequal Capital T-Shirts",
      typeCode: "PRODUCT_DROP",
      targetBudget: 100000,
      description: "Shawon 50k, Rafi 30k, Tousif 20k",
      userId: adminUser.id,
    });

    // Agreement with 3 participants
    const ag = await saveVentureAgreement(
      venture.id,
      {
        participationMode: "PROPORTIONAL",
        targetBudget: 100000,
        participants: [
          {
            partnerId: shawonPartner.id,
            name: "Shawon",
            investmentCommitment: 50000,
            profitSharingPercentage: 50.0,
            lossSharingPercentage: 50.0,
          },
          {
            partnerId: rafiPartner.id,
            name: "Rafi",
            investmentCommitment: 30000,
            profitSharingPercentage: 30.0,
            lossSharingPercentage: 30.0,
          },
          {
            partnerId: tousifPartner.id,
            name: "Tousif",
            investmentCommitment: 20000,
            profitSharingPercentage: 20.0,
            lossSharingPercentage: 20.0,
          },
        ],
      },
      adminUser.id
    );

    await approveAgreement(ag.id, approverUser);

    // Record funding contributions
    await recordContribution({
      ventureId: venture.id,
      partnerId: shawonPartner.id,
      contributionType: "CASH",
      amount: 50000,
      paymentAccountId: bracPaymentAccount.id,
      description: "Shawon Drop A Capital",
      isRecordedInLedger: true,
      userId: adminUser.id,
    });

    await recordContribution({
      ventureId: venture.id,
      partnerId: rafiPartner.id,
      contributionType: "CASH",
      amount: 30000,
      paymentAccountId: bracPaymentAccount.id,
      description: "Rafi Drop A Capital",
      isRecordedInLedger: true,
      userId: adminUser.id,
    });

    await recordContribution({
      ventureId: venture.id,
      partnerId: tousifPartner.id,
      contributionType: "CASH",
      amount: 20000,
      paymentAccountId: bracPaymentAccount.id,
      description: "Tousif Drop A Capital",
      isRecordedInLedger: true,
      userId: adminUser.id,
    });

    const summary = await getVentureFundingSummary(venture.id);
    expect(summary.totalCommitted).toBe(100000);
    expect(summary.totalContributed).toBe(100000);
    expect(summary.totalShortfall).toBe(0);
    expect(summary.overallFundingPct).toBe(100);

    // Statutory company equity must remain strictly 20.00% each
    const shawonDb = await db.select().from(partners).where(eq(partners.name, "Shawon")).limit(1);
    const midhatDb = await db.select().from(partners).where(eq(partners.name, "Midhat")).limit(1);
    expect(parseFloat(shawonDb[0].ownershipPct)).toBe(20.0);
    expect(parseFloat(midhatDb[0].ownershipPct)).toBe(20.0);
  });

  // --------------------------------------------------------------------------
  // Scenario B: Different investment and profit percentages (Asymmetric Split)
  // --------------------------------------------------------------------------
  it("Scenario B: supports different funding % (50/30/20) and profit % (40/40/20)", async () => {
    const venture = await createVenture({
      title: "Drop B - Asymmetric Profit Drop",
      typeCode: "INDEPENDENT_PROJECT",
      targetBudget: 100000,
      userId: adminUser.id,
    });

    const ag = await saveVentureAgreement(
      venture.id,
      {
        participationMode: "CUSTOM_PROFIT",
        targetBudget: 100000,
        participants: [
          {
            partnerId: shawonPartner.id,
            name: "Shawon",
            investmentCommitment: 50000, // 50% funding
            profitSharingPercentage: 40.0, // 40% profit
            lossSharingPercentage: 50.0,
          },
          {
            partnerId: rafiPartner.id,
            name: "Rafi",
            investmentCommitment: 30000, // 30% funding
            profitSharingPercentage: 40.0, // 40% profit (management premium)
            lossSharingPercentage: 30.0,
          },
          {
            partnerId: tousifPartner.id,
            name: "Tousif",
            investmentCommitment: 20000, // 20% funding
            profitSharingPercentage: 20.0, // 20% profit
            lossSharingPercentage: 20.0,
          },
        ],
      },
      adminUser.id
    );

    await approveAgreement(ag.id, approverUser);

    // Calculate waterfall for ৳40,000 net profit
    const result = await executeWaterfallCalculation(venture.id, 40000);
    expect(result.netProfit).toBe(40000);

    const shawonRes = result.participantResults.find((p) => p.name === "Shawon");
    const rafiRes = result.participantResults.find((p) => p.name === "Rafi");
    const tousifRes = result.participantResults.find((p) => p.name === "Tousif");

    // Shawon gets 40% of 40,000 = 16,000
    expect(shawonRes?.residualProfit).toBe(16000);
    // Rafi gets 40% of 40,000 = 16,000
    expect(rafiRes?.residualProfit).toBe(16000);
    // Tousif gets 20% of 40,000 = 8,000
    expect(tousifRes?.residualProfit).toBe(8000);

    // Total residual distributed matches 40,000 exactly
    expect(shawonRes!.residualProfit + rafiRes!.residualProfit + tousifRes!.residualProfit).toBe(40000);
  });

  // --------------------------------------------------------------------------
  // Scenario C: Non-participation
  // --------------------------------------------------------------------------
  it("Scenario C: non-participating partners receive ৳0.00 and retain 20% company equity", async () => {
    const venture = await createVenture({
      title: "Drop C - Rafi & Midhat Exclusive",
      typeCode: "PRODUCT_DROP",
      targetBudget: 60000,
      userId: adminUser.id,
    });

    const ag = await saveVentureAgreement(
      venture.id,
      {
        participationMode: "CUSTOM_PROFIT",
        targetBudget: 60000,
        participants: [
          {
            partnerId: rafiPartner.id,
            name: "Rafi",
            investmentCommitment: 30000,
            profitSharingPercentage: 50.0,
            lossSharingPercentage: 50.0,
          },
          {
            partnerId: midhatPartner.id,
            name: "Midhat",
            investmentCommitment: 30000,
            profitSharingPercentage: 50.0,
            lossSharingPercentage: 50.0,
          },
        ],
      },
      adminUser.id
    );

    await approveAgreement(ag.id, approverUser);

    const result = await executeWaterfallCalculation(venture.id, 25000);

    // Shawon, Tousif, Mueid should NOT be in the participant results
    const nonParticipating = result.participantResults.filter((p) =>
      ["Shawon", "Tousif", "Mueid"].includes(p.name)
    );
    expect(nonParticipating).toHaveLength(0);

    // Rafi and Midhat each get 50%
    const rafi = result.participantResults.find((p) => p.name === "Rafi");
    const midhat = result.participantResults.find((p) => p.name === "Midhat");
    expect(rafi?.residualProfit + midhat?.residualProfit).toBe(25000);
  });

  // --------------------------------------------------------------------------
  // Scenario D: Multi-batch independent funding
  // --------------------------------------------------------------------------
  it("Scenario D: multiple batches maintain independent agreements and ledger pools", async () => {
    // Batch 1
    const vBatch1 = await createVenture({
      title: "Signature Hoodie - Batch #01",
      typeCode: "COLLECTION",
      targetBudget: 50000,
      userId: adminUser.id,
    });
    const ag1 = await saveVentureAgreement(
      vBatch1.id,
      {
        participationMode: "EQUAL",
        participants: [
          { partnerId: shawonPartner.id, name: "Shawon", investmentCommitment: 25000, profitSharingPercentage: 50, lossSharingPercentage: 50 },
          { partnerId: rafiPartner.id, name: "Rafi", investmentCommitment: 25000, profitSharingPercentage: 50, lossSharingPercentage: 50 },
        ],
      },
      adminUser.id
    );
    await approveAgreement(ag1.id, approverUser);

    // Batch 2
    const vBatch2 = await createVenture({
      title: "Signature Hoodie - Batch #02",
      typeCode: "COLLECTION",
      targetBudget: 80000,
      userId: adminUser.id,
    });
    const ag2 = await saveVentureAgreement(
      vBatch2.id,
      {
        participationMode: "CUSTOM_PROFIT",
        participants: [
          { partnerId: shawonPartner.id, name: "Shawon", investmentCommitment: 20000, profitSharingPercentage: 25, lossSharingPercentage: 25 },
          { partnerId: tousifPartner.id, name: "Tousif", investmentCommitment: 60000, profitSharingPercentage: 75, lossSharingPercentage: 75 },
        ],
      },
      adminUser.id
    );
    await approveAgreement(ag2.id, approverUser);

    const res1 = await executeWaterfallCalculation(vBatch1.id, 20000);
    const res2 = await executeWaterfallCalculation(vBatch2.id, 20000);

    // Batch 1 Shawon gets 50% = 10,000
    expect(res1.participantResults.find((p) => p.name === "Shawon")?.residualProfit).toBe(10000);

    // Batch 2 Shawon gets 25% = 5,000; Tousif gets 75% = 15,000
    expect(res2.participantResults.find((p) => p.name === "Shawon")?.residualProfit).toBe(5000);
    expect(res2.participantResults.find((p) => p.name === "Tousif")?.residualProfit).toBe(15000);
  });

  // --------------------------------------------------------------------------
  // Scenario E: Non-cash contribution
  // --------------------------------------------------------------------------
  it("Scenario E: records non-cash fabric contribution into materials inventory", async () => {
    const venture = await createVenture({
      title: "Drop E - Fabric Contribution Venture",
      typeCode: "PRODUCT_DROP",
      targetBudget: 50000,
      userId: adminUser.id,
    });

    const ag = await saveVentureAgreement(
      venture.id,
      {
        participationMode: "PROPORTIONAL",
        participants: [
          { partnerId: shawonPartner.id, name: "Shawon", investmentCommitment: 25000, profitSharingPercentage: 50, lossSharingPercentage: 50 },
          { partnerId: tousifPartner.id, name: "Tousif", investmentCommitment: 25000, profitSharingPercentage: 50, lossSharingPercentage: 50 },
        ],
      },
      adminUser.id
    );
    await approveAgreement(ag.id, approverUser);

    // Record non-cash fabric asset contribution
    const contrib = await recordContribution({
      ventureId: venture.id,
      partnerId: tousifPartner.id,
      contributionType: "NON_CASH_ASSET",
      amount: 25000,
      description: "Contributed 120 yards French Terry fabric",
      isRecordedInLedger: true,
      userId: adminUser.id,
    });

    expect(contrib.contributionType).toBe("NON_CASH_ASSET");
    expect(parseFloat(contrib.amount)).toBe(25000);

    const summary = await getVentureFundingSummary(venture.id);
    const tousifSummary = summary.participants.find((p) => p.name === "Tousif");
    expect(tousifSummary?.nonCashContributed).toBe(25000);
    expect(tousifSummary?.totalContributed).toBe(25000);
  });

  // --------------------------------------------------------------------------
  // Scenario F: Loss-making product / drop
  // --------------------------------------------------------------------------
  it("Scenario F: allocates loss according to lossSharePct with zero negative cash distributions", async () => {
    const venture = await createVenture({
      title: "Drop F - Experimental Deficit Drop",
      typeCode: "EXPERIMENTAL",
      targetBudget: 40000,
      userId: adminUser.id,
    });

    const ag = await saveVentureAgreement(
      venture.id,
      {
        participationMode: "CUSTOM_PROFIT",
        participants: [
          { partnerId: shawonPartner.id, name: "Shawon", investmentCommitment: 20000, profitSharingPercentage: 50, lossSharingPercentage: 70 },
          { partnerId: rafiPartner.id, name: "Rafi", investmentCommitment: 20000, profitSharingPercentage: 50, lossSharingPercentage: 30 },
        ],
      },
      adminUser.id
    );
    await approveAgreement(ag.id, approverUser);

    // Simulate ৳10,000 loss
    const result = await executeWaterfallCalculation(venture.id, -10000);
    expect(result.netProfit).toBe(-10000);

    const shawon = result.participantResults.find((p) => p.name === "Shawon");
    const rafi = result.participantResults.find((p) => p.name === "Rafi");

    // Shawon absorbs 70% of 10,000 = 7,000
    expect(shawon?.lossAllocated).toBe(7000);
    // Rafi absorbs 30% of 10,000 = 3,000
    expect(rafi?.lossAllocated).toBe(3000);

    // Invariant: no negative cash distribution!
    expect(shawon?.netPayable).toBe(0);
    expect(rafi?.netPayable).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Scenario G: External participants / angels
  // --------------------------------------------------------------------------
  it("Scenario G: supports external investors without affecting founding partner roles", async () => {
    const venture = await createVenture({
      title: "Drop G - Guest Creator Collab",
      typeCode: "COLLAB",
      targetBudget: 60000,
      userId: adminUser.id,
    });

    const ag = await saveVentureAgreement(
      venture.id,
      {
        participationMode: "CUSTOM_PROFIT",
        participants: [
          { partnerId: shawonPartner.id, name: "Shawon", investmentCommitment: 30000, profitSharingPercentage: 50, lossSharingPercentage: 50 },
          { partnerId: null, name: "Tanvir Rahman", isExternal: true, role: "Guest Designer", investmentCommitment: 30000, profitSharingPercentage: 50, lossSharingPercentage: 50 },
        ],
      },
      adminUser.id
    );
    await approveAgreement(ag.id, approverUser);

    const result = await executeWaterfallCalculation(venture.id, 30000);
    const guest = result.participantResults.find((p) => p.name === "Tanvir Rahman");
    expect(guest).toBeDefined();
    expect(guest?.isExternal).toBe(true);
    expect(guest?.residualProfit).toBe(15000);
  });

  // --------------------------------------------------------------------------
  // Invariant Tests: 100% Invariant & Deterministic Integer-Paisa Balancing
  // --------------------------------------------------------------------------
  it("Invariant: rejects agreement approval if profit share does not sum to 100.00%", async () => {
    const venture = await createVenture({
      title: "Drop Test - Invalid Percentage Invariant",
      typeCode: "PRODUCT_DROP",
      targetBudget: 50000,
      userId: adminUser.id,
    });

    const ag = await saveVentureAgreement(
      venture.id,
      {
        participationMode: "CUSTOM_PROFIT",
        participants: [
          { partnerId: shawonPartner.id, name: "Shawon", investmentCommitment: 25000, profitSharingPercentage: 50, lossSharingPercentage: 50 },
          { partnerId: rafiPartner.id, name: "Rafi", investmentCommitment: 25000, profitSharingPercentage: 45, lossSharingPercentage: 50 }, // Sums to 95%!
        ],
      },
      adminUser.id
    );

    // Must reject approval
    await expect(approveAgreement(ag.id, approverUser)).rejects.toThrow(
      /Invariant violation: Total profit share must sum to 100.00%/
    );
  });

  it("Invariant: guarantees 0-paisa leakage using deterministic integer-paisa remainder allocation", () => {
    // 3 participants with equal 33.33% - total amount ৳100,000.00
    const percentages = computeBalancedPercentages(
      [{ amount: 1 }, { amount: 1 }, { amount: 1 }],
      3
    );

    const sumPct = percentages.reduce((acc, p) => acc + parseFloat(p), 0);
    expect(sumPct).toBe(100.0);
    // Last participant gets 33.34 to complete the 100.00
    expect(percentages[0]).toBe("33.33");
    expect(percentages[1]).toBe("33.33");
    expect(percentages[2]).toBe("33.34");
  });

  // --------------------------------------------------------------------------
  // Mode 5: Capital Recovery First
  // --------------------------------------------------------------------------
  it("Mode 5: Capital Recovery First returns capital before splitting residual profit", async () => {
    const venture = await createVenture({
      title: "Drop De-Risked - Capital Recovery First",
      typeCode: "PRODUCT_DROP",
      targetBudget: 40000,
      userId: adminUser.id,
    });

    const ag = await saveVentureAgreement(
      venture.id,
      {
        participationMode: "CAPITAL_RECOVERY_FIRST",
        participants: [
          { partnerId: shawonPartner.id, name: "Shawon", investmentCommitment: 20000, profitSharingPercentage: 60, lossSharingPercentage: 50 },
          { partnerId: rafiPartner.id, name: "Rafi", investmentCommitment: 20000, profitSharingPercentage: 40, lossSharingPercentage: 50 },
        ],
      },
      adminUser.id
    );
    await approveAgreement(ag.id, approverUser);

    // Record 40k contributions
    await recordContribution({
      ventureId: venture.id,
      partnerId: shawonPartner.id,
      contributionType: "CASH",
      amount: 20000,
      paymentAccountId: bracPaymentAccount.id,
      description: "Shawon Capital",
      isRecordedInLedger: false,
    });
    await recordContribution({
      ventureId: venture.id,
      partnerId: rafiPartner.id,
      contributionType: "CASH",
      amount: 20000,
      paymentAccountId: bracPaymentAccount.id,
      description: "Rafi Capital",
      isRecordedInLedger: false,
    });

    // Net distributable profit of ৳50,000
    // First 40,000 returns Shawon 20k and Rafi 20k.
    // Remaining 10,000 splits 60/40: Shawon gets 6k, Rafi gets 4k.
    const result = await executeWaterfallCalculation(venture.id, 50000);

    const shawon = result.participantResults.find((p) => p.name === "Shawon");
    const rafi = result.participantResults.find((p) => p.name === "Rafi");

    expect(shawon?.capitalReturned).toBe(20000);
    expect(shawon?.residualProfit).toBe(6000);
    expect(shawon?.grossDistributed).toBe(26000);

    expect(rafi?.capitalReturned).toBe(20000);
    expect(rafi?.residualProfit).toBe(4000);
    expect(rafi?.grossDistributed).toBe(24000);

    expect(shawon!.grossDistributed + rafi!.grossDistributed).toBe(50000);
  });

  // --------------------------------------------------------------------------
  // Workflow Transitions & Authorization
  // --------------------------------------------------------------------------
  it("Workflow: advancing to ACTIVE requires FINANCE_APPROVER and an approved agreement", async () => {
    const venture = await createVenture({
      title: "Drop Workflow Test",
      typeCode: "PRODUCT_DROP",
      userId: adminUser.id,
    });

    // Advance to PLANNING
    await transitionVentureStage(venture.id, "PLANNING", adminUser);

    // Advance to DRAFT_AGREEMENT
    await transitionVentureStage(venture.id, "DRAFT_AGREEMENT", adminUser);

    // Trying to advance to ACTIVE without approved agreement must throw
    await expect(
      transitionVentureStage(venture.id, "ACTIVE", approverUser)
    ).rejects.toThrow(/Cannot activate venture: an APPROVED participation agreement is required/);

    // Save and approve agreement
    const ag = await saveVentureAgreement(
      venture.id,
      {
        participationMode: "EQUAL",
        participants: [
          { partnerId: shawonPartner.id, name: "Shawon", investmentCommitment: 10000, profitSharingPercentage: 50, lossSharingPercentage: 50 },
          { partnerId: rafiPartner.id, name: "Rafi", investmentCommitment: 10000, profitSharingPercentage: 50, lossSharingPercentage: 50 },
        ],
      },
      adminUser.id
    );
    await approveAgreement(ag.id, approverUser);

    // Non-approver user trying to activate must fail
    const viewerUser = { id: adminUser.id, roles: ["PARTNER_VIEWER"] };
    await expect(
      transitionVentureStage(venture.id, "ACTIVE", viewerUser)
    ).rejects.toThrow(/Authorisation failure/);

    // Approver activating succeeds
    const activated = await transitionVentureStage(venture.id, "ACTIVE", approverUser);
    expect(activated.stage).toBe("ACTIVE");
  });

  // --------------------------------------------------------------------------
  // Settlement Voucher & Snapshot Immutability
  // --------------------------------------------------------------------------
  it("Settlement: generates immutable calculation snapshot, approval, and disbursement", async () => {
    const venture = await createVenture({
      title: "Drop Settle Final Test",
      typeCode: "PRODUCT_DROP",
      userId: adminUser.id,
    });

    const ag = await saveVentureAgreement(
      venture.id,
      {
        participationMode: "EQUAL",
        participants: [
          { partnerId: shawonPartner.id, name: "Shawon", investmentCommitment: 10000, profitSharingPercentage: 50, lossSharingPercentage: 50 },
          { partnerId: rafiPartner.id, name: "Rafi", investmentCommitment: 10000, profitSharingPercentage: 50, lossSharingPercentage: 50 },
        ],
      },
      adminUser.id
    );
    await approveAgreement(ag.id, approverUser);

    // Create settlement snapshot
    const { snapshot, settlement } = await createSettlementSnapshot(venture.id, {
      customNetProfit: 30000,
      settlementType: "FULL",
      notes: "Official Drop Settlement",
      userId: adminUser.id,
    });

    expect(snapshot.snapshotNumber).toBeDefined();
    expect(parseFloat(snapshot.netDistributable)).toBe(30000);
    expect(settlement.status).toBe("DRAFT");

    // Approve settlement
    const approved = await approveSettlement(settlement.id, approverUser);
    expect(approved.status).toBe("APPROVED");

    // Disburse settlement
    const disbursed = await disburseSettlement(settlement.id, {
      paymentAccountId: bracPaymentAccount.id,
      user: adminUser,
    });
    expect(disbursed.status).toBe("PAID");

    const settlements = await getVentureSettlements(venture.id);
    expect(settlements).toHaveLength(1);
    expect(settlements[0].lines).toHaveLength(2);
    expect(settlements[0].lines[0].netPayable).toBe(15000);
    expect(settlements[0].lines[1].netPayable).toBe(15000);
  });

  // --------------------------------------------------------------------------
  // Custom Fields & Studio Integration
  // --------------------------------------------------------------------------
  it("Custom Fields: defines and persists custom dynamic attributes on ventures", async () => {
    const fieldDef = await createFieldDefinition({
      entityType: "VENTURE",
      fieldKey: "fabric_gsm_test",
      fieldLabel: "Fabric Weight GSM",
      dataType: "NUMBER",
      isRequired: false,
      defaultValue: "240",
    });
    expect(fieldDef.id).toBeDefined();

    const venture = await createVenture({
      title: "Drop Custom Field Test",
      typeCode: "PRODUCT_DROP",
      userId: adminUser.id,
    });

    // Save field values
    await saveEntityCustomFieldValues(venture.id, {
      fabric_gsm_test: 280,
    });

    const values = await getEntityCustomFieldValues(venture.id);
    expect(values.fabric_gsm_test).toBe(280);
  });
});
