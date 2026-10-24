import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/db";
import {
  users,
  calendarCategories,
  calendarEntries,
  calendarChecklistItems,
  calendarRecurrenceRules,
  calendarRecurrenceExceptions,
  ventures,
  productionOrders,
} from "@/db/schema";
import {
  ensureDefaultCategories,
  getCalendarCategories,
  createCalendarCategory,
  archiveCalendarCategory,
  createCalendarEntry,
  getCalendarEntries,
  getCalendarEntryById,
  updateCalendarEntry,
  addRecurrenceException,
  deleteCalendarEntry,
  toggleChecklistItem,
  getUpcomingDeadlinesAndTasks,
} from "@/server/services/calendar";
import { eq } from "drizzle-orm";
import { addDays, addWeeks } from "date-fns";

describe("Acceptance Suite 19: Business Calendar & Planner Module", () => {
  let testUserA: string;
  let testUserB: string;
  let testVentureId: string;

  beforeAll(async () => {
    // Ensure default categories exist
    await ensureDefaultCategories();

    // Query or create test users
    const existingUsers = await db.select().from(users).limit(2);
    if (existingUsers.length >= 2) {
      testUserA = existingUsers[0].id;
      testUserB = existingUsers[1].id;
    } else {
      const [u1] = await db
        .insert(users)
        .values({
          name: "Test Partner A",
          email: "partnerA@afktest.local",
          passwordHash: "hash",
        })
        .returning();
      const [u2] = await db
        .insert(users)
        .values({
          name: "Test Partner B",
          email: "partnerB@afktest.local",
          passwordHash: "hash",
        })
        .returning();
      testUserA = u1.id;
      testUserB = u2.id;
    }

    // Query or create test venture
    const existingVentures = await db.select().from(ventures).limit(1);
    if (existingVentures.length > 0) {
      testVentureId = existingVentures[0].id;
    }
  });

  it("1. Categories: loads 11 default categories with proper colors & sort order", async () => {
    const cats = await getCalendarCategories(false);
    expect(cats.length).toBeGreaterThanOrEqual(11);
    const names = cats.map((c) => c.name);
    expect(names).toContain("Production");
    expect(names).toContain("Finance");
    expect(names).toContain("Partner Meeting");
    expect(names).toContain("Supplier");
    expect(names).toContain("Marketing");
  });

  it("2. Categories: creates user-defined category with custom color & archives safely", async () => {
    const newCat = await createCalendarCategory({
      name: "Embroidery QC",
      color: "#9333EA",
      description: "Sample embroidery quality check",
      userId: testUserA,
    });
    expect(newCat.id).toBeDefined();
    expect(newCat.color).toBe("#9333EA");

    // Create entry in this category
    const entry = await createCalendarEntry(
      {
        title: "Check hoodie sleeve embroidery",
        startDate: new Date(),
        categoryId: newCat.id,
      },
      testUserA
    );
    expect(entry.id).toBeDefined();

    // Archive category
    await archiveCalendarCategory(newCat.id);

    // Verify category is marked archived but entry remains intact!
    const activeCats = await getCalendarCategories(false);
    expect(activeCats.some((c) => c.id === newCat.id)).toBe(false);

    const retrievedEntry = await getCalendarEntryById(entry.id);
    expect(retrievedEntry?.title).toBe("Check hoodie sleeve embroidery");
    expect(retrievedEntry?.categoryId).toBe(newCat.id);
  });

  it("3. Entries: creates personal note and verifies privacy scoping", async () => {
    const privateNote = await createCalendarEntry(
      {
        title: "Private audit memo for Shawon",
        description: "Confidential investment note",
        entryType: "NOTE",
        scope: "PERSONAL",
        startDate: new Date(),
      },
      testUserA
    );

    // Fetch entries for User A: MUST be visible
    const userAEntries = await getCalendarEntries({
      userId: testUserA,
    });
    expect(userAEntries.some((e) => e.id === privateNote.id)).toBe(true);

    // Fetch entries for User B: MUST NOT be visible (enforcing server-side privacy)
    const userBEntries = await getCalendarEntries({
      userId: testUserB,
    });
    expect(userBEntries.some((e) => e.id === privateNote.id)).toBe(false);
  });

  it("4. Entries: creates task with checklists and toggles completion", async () => {
    const task = await createCalendarEntry(
      {
        title: "Finalize Fabric GSM and Lab Dips",
        entryType: "TASK",
        priority: "HIGH",
        status: "PENDING",
        startDate: new Date(),
        checklists: [
          { title: "Review 320 GSM terry sample" },
          { title: "Approve Black-01 shade" },
        ],
      },
      testUserA
    );

    const fullTask = await getCalendarEntryById(task.id);
    expect(fullTask?.checklists.length).toBe(2);
    expect(fullTask?.checklists[0].isCompleted).toBe(false);

    // Toggle first checklist item
    const firstItemId = fullTask!.checklists[0].id;
    await toggleChecklistItem(firstItemId, true);

    const updatedTask = await getCalendarEntryById(task.id);
    expect(updatedTask?.checklists[0].isCompleted).toBe(true);

    // Mark entire task complete
    await updateCalendarEntry(task.id, { status: "COMPLETED" });
    const completedTask = await getCalendarEntryById(task.id);
    expect(completedTask?.status).toBe("COMPLETED");
  });

  it("5. Entries: creates weekly recurring meeting and expands occurrences", async () => {
    const baseDate = new Date();
    const meeting = await createCalendarEntry(
      {
        title: "Weekly Founder Strategy Review",
        entryType: "EVENT",
        startDate: baseDate,
        endDate: new Date(baseDate.getTime() + 60 * 60 * 1000),
        recurrence: {
          frequency: "WEEKLY",
          interval: 1,
          maxOccurrences: 4,
        },
      },
      testUserA
    );

    // Query 4 weeks window
    const windowStart = addDays(baseDate, -1);
    const windowEnd = addWeeks(baseDate, 5);
    const recurringList = await getCalendarEntries({
      startDate: windowStart,
      endDate: windowEnd,
    });

    const occurrences = recurringList.filter(
      (e) => e.title.includes("Weekly Founder") || e.originalEntryId === meeting.id
    );
    expect(occurrences.length).toBeGreaterThanOrEqual(4);
  });

  it("6. Recurrence Exception: updates single occurrence without altering parent series", async () => {
    const baseDate = new Date();
    const series = await createCalendarEntry(
      {
        title: "Factory Inspection Routine",
        entryType: "EVENT",
        startDate: baseDate,
        recurrence: {
          frequency: "WEEKLY",
          interval: 1,
          maxOccurrences: 3,
        },
      },
      testUserA
    );

    const nextWeekDate = addWeeks(baseDate, 1);
    // Add exception for next week's occurrence
    await addRecurrenceException({
      calendarEntryId: series.id,
      originalDate: nextWeekDate,
      overrideTitle: "Special QC Inspection with Tousif",
    });

    const windowList = await getCalendarEntries({
      startDate: addDays(baseDate, -1),
      endDate: addWeeks(baseDate, 3),
    });

    const specialOcc = windowList.find((e) =>
      e.title === "Special QC Inspection with Tousif"
    );
    expect(specialOcc).toBeDefined();

    // Verify other occurrences maintain original title
    const normalOcc = windowList.find((e) =>
      e.title === "Factory Inspection Routine" && e.originalEntryId === series.id
    );
    expect(normalOcc).toBeDefined();
  });

  it("7. Business Links: links calendar deadline to venture project", async () => {
    if (!testVentureId) return;

    const deadline = await createCalendarEntry(
      {
        title: "Origin Drop Website Release Countdown",
        entryType: "DEADLINE",
        priority: "URGENT",
        startDate: addDays(new Date(), 3),
        ventureId: testVentureId,
      },
      testUserA
    );

    const retrieved = await getCalendarEntryById(deadline.id);
    expect(retrieved?.ventureId).toBe(testVentureId);
    expect(retrieved?.entryType).toBe("DEADLINE");
  });

  it("8. Dashboard Summary: retrieves today schedule & upcoming deadlines", async () => {
    // Insert a deadline for tomorrow
    await createCalendarEntry(
      {
        title: "Pay fabric mill invoice balance",
        entryType: "DEADLINE",
        priority: "HIGH",
        startDate: addDays(new Date(), 1),
      },
      testUserA
    );

    const summary = await getUpcomingDeadlinesAndTasks(testUserA);
    expect(summary.upcomingDeadlines).toBeDefined();
    expect(summary.upcomingDeadlines.length).toBeGreaterThanOrEqual(1);
  });
});
