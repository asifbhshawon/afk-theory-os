import { db } from "@/db";
import {
  calendarCategories,
  calendarEntries,
  calendarChecklistItems,
  calendarRecurrenceRules,
  calendarRecurrenceExceptions,
  calendarPreferences,
  users,
  partners,
  ventures,
  productionOrders,
  salesOrders,
  purchaseOrders,
  documentLinks,
  documents,
} from "@/db/schema";
import { eq, and, or, gte, lte, sql, desc, asc, inArray } from "drizzle-orm";
import {
  addDays,
  addWeeks,
  addMonths,
  addYears,
  isBefore,
  isAfter,
  isEqual,
  startOfDay,
  endOfDay,
} from "date-fns";

export const DEFAULT_CALENDAR_CATEGORIES = [
  { name: "Production", slug: "production", color: "#3B82F6", icon: "Factory", description: "Batch manufacturing, factory deadlines & fabric dyeing", sortOrder: 1 },
  { name: "Finance", slug: "finance", color: "#10B981", icon: "Wallet", description: "Disbursements, supplier dues, taxes & transfers", sortOrder: 2 },
  { name: "Partner Meeting", slug: "partner-meeting", color: "#8B5CF6", icon: "Users", description: "Founding partner governance, strategy & reviews", sortOrder: 3 },
  { name: "Supplier", slug: "supplier", color: "#F59E0B", icon: "Truck", description: "Fabric procurement, yarn orders & supplier deadlines", sortOrder: 4 },
  { name: "Sales & Delivery", slug: "sales-delivery", color: "#06B6D4", icon: "ShoppingBag", description: "Order shipments, courier follow-ups & customer fulfillment", sortOrder: 5 },
  { name: "Marketing", slug: "marketing", color: "#EC4899", icon: "Megaphone", description: "Campaigns, Meta ad scheduling & content creation", sortOrder: 6 },
  { name: "Photoshoot", slug: "photoshoot", color: "#F97316", icon: "Camera", description: "Studio lookbook, model shoots & product photography", sortOrder: 7 },
  { name: "Product Launch", slug: "product-launch", color: "#E11D48", icon: "Sparkles", description: "Drop dates, website release & drop countdowns", sortOrder: 8 },
  { name: "Design", slug: "design", color: "#6366F1", icon: "Palette", description: "Tech packs, sample fittings & silhouette development", sortOrder: 9 },
  { name: "Personal", slug: "personal", color: "#6B7280", icon: "User", description: "Private tasks, notes & personal reminders", sortOrder: 10 },
  { name: "General", slug: "general", color: "#7D9472", icon: "Calendar", description: "General business operations & miscellaneous", sortOrder: 11 },
];

/**
 * Ensure standard business categories exist in PostgreSQL
 */
export async function ensureDefaultCategories(systemUserId?: string) {
  const existing = await db.select().from(calendarCategories);
  if (existing.length === 0) {
    for (const cat of DEFAULT_CALENDAR_CATEGORIES) {
      await db.insert(calendarCategories).values({
        name: cat.name,
        slug: cat.slug,
        color: cat.color,
        icon: cat.icon,
        description: cat.description,
        isShared: cat.slug !== "personal",
        sortOrder: cat.sortOrder,
        createdByUserId: systemUserId,
      }).onConflictDoNothing();
    }
  }
}

/**
 * Fetch calendar categories
 */
export async function getCalendarCategories(includeArchived = false) {
  await ensureDefaultCategories();
  const query = db
    .select()
    .from(calendarCategories);

  if (!includeArchived) {
    return await query
      .where(eq(calendarCategories.isArchived, false))
      .orderBy(asc(calendarCategories.sortOrder), asc(calendarCategories.name));
  }
  return await query.orderBy(asc(calendarCategories.sortOrder), asc(calendarCategories.name));
}

/**
 * Create custom category
 */
export async function createCalendarCategory(input: {
  name: string;
  color: string;
  icon?: string;
  description?: string;
  isShared?: boolean;
  userId?: string;
}) {
  const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const [created] = await db
    .insert(calendarCategories)
    .values({
      name: input.name,
      slug: `${slug}-${Date.now().toString(36)}`,
      color: input.color || "#7D9472",
      icon: input.icon || "Calendar",
      description: input.description,
      isShared: input.isShared ?? true,
      createdByUserId: input.userId,
    })
    .returning();
  return created;
}

/**
 * Update existing category
 */
export async function updateCalendarCategory(
  id: string,
  input: {
    name?: string;
    color?: string;
    icon?: string;
    description?: string;
    isShared?: boolean;
    sortOrder?: number;
  }
) {
  const [updated] = await db
    .update(calendarCategories)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(calendarCategories.id, id))
    .returning();
  return updated;
}

/**
 * Soft-archive category (historical items are preserved!)
 */
export async function archiveCalendarCategory(id: string) {
  const [archived] = await db
    .update(calendarCategories)
    .set({
      isArchived: true,
      updatedAt: new Date(),
    })
    .where(eq(calendarCategories.id, id))
    .returning();
  return archived;
}

export interface CalendarFilter {
  startDate?: Date;
  endDate?: Date;
  categoryIds?: string[];
  scopes?: string[];
  entryTypes?: string[];
  ventureId?: string;
  search?: string;
  userId?: string;
  includeCompletedTasks?: boolean;
}

/**
 * Query calendar entries with recurrence expansion, checklists, and permission scoping
 */
export async function getCalendarEntries(filter: CalendarFilter) {
  await ensureDefaultCategories();

  // Base conditions
  const conditions = [eq(calendarEntries.isArchived, false)];

  // Category filter
  if (filter.categoryIds && filter.categoryIds.length > 0) {
    conditions.push(inArray(calendarEntries.categoryId, filter.categoryIds));
  }

  // Scope filter
  if (filter.scopes && filter.scopes.length > 0) {
    conditions.push(inArray(calendarEntries.scope, filter.scopes));
  }

  // Entry type filter
  if (filter.entryTypes && filter.entryTypes.length > 0) {
    conditions.push(inArray(calendarEntries.entryType, filter.entryTypes));
  }

  // Venture filter
  if (filter.ventureId) {
    conditions.push(eq(calendarEntries.ventureId, filter.ventureId));
  }

  // Permission filter:
  // Personal entries only visible to their creator
  if (filter.userId) {
    conditions.push(
      or(
        eq(calendarEntries.scope, "COMPANY"),
        eq(calendarEntries.scope, "VENTURE"),
        and(eq(calendarEntries.scope, "PERSONAL"), eq(calendarEntries.ownerUserId, filter.userId))
      )!
    );
  }

  // Execute primary query
  const rawEntries = await db
    .select({
      id: calendarEntries.id,
      title: calendarEntries.title,
      description: calendarEntries.description,
      entryType: calendarEntries.entryType,
      status: calendarEntries.status,
      priority: calendarEntries.priority,
      startDate: calendarEntries.startDate,
      endDate: calendarEntries.endDate,
      isAllDay: calendarEntries.isAllDay,
      location: calendarEntries.location,
      scope: calendarEntries.scope,
      visibility: calendarEntries.visibility,
      categoryId: calendarEntries.categoryId,
      categoryName: calendarCategories.name,
      categoryColor: calendarCategories.color,
      categoryIcon: calendarCategories.icon,
      ventureId: calendarEntries.ventureId,
      productionOrderId: calendarEntries.productionOrderId,
      salesOrderId: calendarEntries.salesOrderId,
      purchaseOrderId: calendarEntries.purchaseOrderId,
      assignedPartnerId: calendarEntries.assignedPartnerId,
      assignedPartnerName: partners.name,
      ownerUserId: calendarEntries.ownerUserId,
      ownerName: users.name,
      tags: calendarEntries.tags,
      createdAt: calendarEntries.createdAt,
    })
    .from(calendarEntries)
    .leftJoin(calendarCategories, eq(calendarEntries.categoryId, calendarCategories.id))
    .leftJoin(partners, eq(calendarEntries.assignedPartnerId, partners.id))
    .leftJoin(users, eq(calendarEntries.ownerUserId, users.id))
    .where(and(...conditions))
    .orderBy(asc(calendarEntries.startDate));

  // Fetch checklists for all retrieved entries
  const entryIds = rawEntries.map((e) => e.id);
  let checklistsByEntry: Record<string, any[]> = {};
  let recurrenceRulesByEntry: Record<string, any> = {};
  let recurrenceExceptionsByEntry: Record<string, any[]> = {};
  let evidenceCountsByEntry: Record<string, number> = {};

  if (entryIds.length > 0) {
    const checklistItems = await db
      .select()
      .from(calendarChecklistItems)
      .where(inArray(calendarChecklistItems.calendarEntryId, entryIds))
      .orderBy(asc(calendarChecklistItems.sortOrder));

    for (const item of checklistItems) {
      if (!checklistsByEntry[item.calendarEntryId]) {
        checklistsByEntry[item.calendarEntryId] = [];
      }
      checklistsByEntry[item.calendarEntryId].push(item);
    }

    const recRules = await db
      .select()
      .from(calendarRecurrenceRules)
      .where(inArray(calendarRecurrenceRules.calendarEntryId, entryIds));

    for (const r of recRules) {
      recurrenceRulesByEntry[r.calendarEntryId] = r;
    }

    const recExceptions = await db
      .select()
      .from(calendarRecurrenceExceptions)
      .where(inArray(calendarRecurrenceExceptions.calendarEntryId, entryIds));

    for (const ex of recExceptions) {
      if (!recurrenceExceptionsByEntry[ex.calendarEntryId]) {
        recurrenceExceptionsByEntry[ex.calendarEntryId] = [];
      }
      recurrenceExceptionsByEntry[ex.calendarEntryId].push(ex);
    }

    const docLinks = await db
      .select({
        entityId: documentLinks.entityId,
        count: sql<number>`count(*)`,
      })
      .from(documentLinks)
      .where(
        and(
          eq(documentLinks.entityType, "CALENDAR_ENTRY"),
          inArray(documentLinks.entityId, entryIds)
        )
      )
      .groupBy(documentLinks.entityId);

    for (const dl of docLinks) {
      evidenceCountsByEntry[dl.entityId] = Number(dl.count);
    }
  }

  // Expand entries & handle recurrence within date window if specified
  const results: any[] = [];
  const windowStart = filter.startDate ? startOfDay(filter.startDate) : null;
  const windowEnd = filter.endDate ? endOfDay(filter.endDate) : null;

  for (const entry of rawEntries) {
    const rule = recurrenceRulesByEntry[entry.id];
    const exceptions = recurrenceExceptionsByEntry[entry.id] || [];
    const checklist = checklistsByEntry[entry.id] || [];
    const evidenceCount = evidenceCountsByEntry[entry.id] || 0;

    const baseItem = {
      ...entry,
      checklists: checklist,
      recurrenceRule: rule || null,
      evidenceCount,
    };

    if (!rule) {
      // Non-recurring: check if within window
      const itemStart = new Date(entry.startDate);
      const inWindow =
        (!windowStart || isAfter(itemStart, windowStart) || isEqual(itemStart, windowStart)) &&
        (!windowEnd || isBefore(itemStart, windowEnd) || isEqual(itemStart, windowEnd));

      if (inWindow || !filter.startDate || !filter.endDate) {
        results.push(baseItem);
      }
    } else {
      // Recurring item expansion
      let currentStart = new Date(entry.startDate);
      const durationMs = entry.endDate
        ? new Date(entry.endDate).getTime() - new Date(entry.startDate).getTime()
        : 0;

      const untilDate = rule.untilDate ? new Date(rule.untilDate) : addYears(new Date(), 2);
      const maxLimit = Math.min(rule.maxOccurrences || 365, 365);
      let count = 0;

      while (count < maxLimit && isBefore(currentStart, untilDate)) {
        // Check exceptions
        const exc = exceptions.find((e) =>
          isEqual(startOfDay(new Date(e.originalDate)), startOfDay(currentStart))
        );

        if (!exc || !exc.isCancelled) {
          const occStart = exc?.overrideStartDate ? new Date(exc.overrideStartDate) : currentStart;
          const occEnd = exc?.overrideEndDate
            ? new Date(exc.overrideEndDate)
            : durationMs > 0
            ? new Date(occStart.getTime() + durationMs)
            : null;

          const inWindow =
            (!windowStart || isAfter(occStart, windowStart) || isEqual(occStart, windowStart)) &&
            (!windowEnd || isBefore(occStart, windowEnd) || isEqual(occStart, windowEnd));

          if (inWindow) {
            results.push({
              ...baseItem,
              id: `${entry.id}_occ_${count}`,
              originalEntryId: entry.id,
              isOccurrence: count > 0,
              occurrenceIndex: count,
              title: exc?.overrideTitle || entry.title,
              startDate: occStart,
              endDate: occEnd,
            });
          }
        }

        // Advance to next period
        if (rule.frequency === "DAILY") {
          currentStart = addDays(currentStart, rule.interval || 1);
        } else if (rule.frequency === "WEEKLY") {
          currentStart = addWeeks(currentStart, rule.interval || 1);
        } else if (rule.frequency === "MONTHLY") {
          currentStart = addMonths(currentStart, rule.interval || 1);
        } else if (rule.frequency === "YEARLY") {
          currentStart = addYears(currentStart, rule.interval || 1);
        } else {
          break;
        }
        count++;

        // Stop if passed window end
        if (windowEnd && isAfter(currentStart, windowEnd)) {
          break;
        }
      }
    }
  }

  // Client search filter if provided
  if (filter.search && filter.search.trim()) {
    const q = filter.search.toLowerCase();
    return results.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q)) ||
        (r.categoryName && r.categoryName.toLowerCase().includes(q))
    );
  }

  return results;
}

/**
 * Fetch single entry details by ID with checklist and evidence
 */
export async function getCalendarEntryById(id: string) {
  const [entry] = await db
    .select({
      id: calendarEntries.id,
      title: calendarEntries.title,
      description: calendarEntries.description,
      entryType: calendarEntries.entryType,
      status: calendarEntries.status,
      priority: calendarEntries.priority,
      startDate: calendarEntries.startDate,
      endDate: calendarEntries.endDate,
      isAllDay: calendarEntries.isAllDay,
      location: calendarEntries.location,
      scope: calendarEntries.scope,
      visibility: calendarEntries.visibility,
      categoryId: calendarEntries.categoryId,
      categoryName: calendarCategories.name,
      categoryColor: calendarCategories.color,
      categoryIcon: calendarCategories.icon,
      ventureId: calendarEntries.ventureId,
      productionOrderId: calendarEntries.productionOrderId,
      salesOrderId: calendarEntries.salesOrderId,
      purchaseOrderId: calendarEntries.purchaseOrderId,
      assignedPartnerId: calendarEntries.assignedPartnerId,
      assignedPartnerName: partners.name,
      ownerUserId: calendarEntries.ownerUserId,
      ownerName: users.name,
      tags: calendarEntries.tags,
      createdAt: calendarEntries.createdAt,
      updatedAt: calendarEntries.updatedAt,
    })
    .from(calendarEntries)
    .leftJoin(calendarCategories, eq(calendarEntries.categoryId, calendarCategories.id))
    .leftJoin(partners, eq(calendarEntries.assignedPartnerId, partners.id))
    .leftJoin(users, eq(calendarEntries.ownerUserId, users.id))
    .where(eq(calendarEntries.id, id))
    .limit(1);

  if (!entry) return null;

  const checklists = await db
    .select()
    .from(calendarChecklistItems)
    .where(eq(calendarChecklistItems.calendarEntryId, id))
    .orderBy(asc(calendarChecklistItems.sortOrder));

  const [recurrence] = await db
    .select()
    .from(calendarRecurrenceRules)
    .where(eq(calendarRecurrenceRules.calendarEntryId, id))
    .limit(1);

  return {
    ...entry,
    checklists,
    recurrenceRule: recurrence || null,
  };
}

/**
 * Create a new calendar item (Event, Note, Task, Deadline, Reminder)
 */
export async function createCalendarEntry(
  input: {
    title: string;
    description?: string;
    entryType?: "EVENT" | "NOTE" | "TASK" | "DEADLINE" | "REMINDER";
    status?: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    startDate: Date | string;
    endDate?: Date | string | null;
    isAllDay?: boolean;
    location?: string;
    scope?: "COMPANY" | "VENTURE" | "PERSONAL";
    visibility?: "PUBLIC" | "PARTICIPANTS" | "PRIVATE";
    categoryId?: string;
    ventureId?: string;
    productionOrderId?: string;
    salesOrderId?: string;
    purchaseOrderId?: string;
    assignedPartnerId?: string;
    tags?: string[];
    checklists?: { title: string; isCompleted?: boolean }[];
    recurrence?: {
      frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
      interval?: number;
      untilDate?: Date | string;
      maxOccurrences?: number;
    };
  },
  ownerUserId: string
) {
  const start = new Date(input.startDate);
  const end = input.endDate ? new Date(input.endDate) : null;

  const [entry] = await db
    .insert(calendarEntries)
    .values({
      title: input.title,
      description: input.description,
      entryType: input.entryType || "NOTE",
      status: input.status || "PENDING",
      priority: input.priority || "MEDIUM",
      startDate: start,
      endDate: end,
      isAllDay: input.isAllDay ?? false,
      location: input.location,
      scope: input.scope || "COMPANY",
      visibility: input.visibility || "PUBLIC",
      categoryId: input.categoryId || null,
      ventureId: input.ventureId || null,
      productionOrderId: input.productionOrderId || null,
      salesOrderId: input.salesOrderId || null,
      purchaseOrderId: input.purchaseOrderId || null,
      assignedPartnerId: input.assignedPartnerId || null,
      ownerUserId,
      tags: input.tags || [],
    })
    .returning();

  // Insert checklists if provided
  if (input.checklists && input.checklists.length > 0) {
    for (let i = 0; i < input.checklists.length; i++) {
      const item = input.checklists[i];
      await db.insert(calendarChecklistItems).values({
        calendarEntryId: entry.id,
        title: item.title,
        isCompleted: item.isCompleted || false,
        sortOrder: i,
      });
    }
  }

  // Insert recurrence rule if provided
  if (input.recurrence) {
    await db.insert(calendarRecurrenceRules).values({
      calendarEntryId: entry.id,
      frequency: input.recurrence.frequency,
      interval: input.recurrence.interval || 1,
      untilDate: input.recurrence.untilDate ? new Date(input.recurrence.untilDate) : null,
      maxOccurrences: input.recurrence.maxOccurrences || null,
    });
  }

  return entry;
}

/**
 * Update an existing calendar entry
 */
export async function updateCalendarEntry(
  id: string,
  input: Partial<{
    title: string;
    description: string;
    entryType: "EVENT" | "NOTE" | "TASK" | "DEADLINE" | "REMINDER";
    status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    startDate: Date | string;
    endDate: Date | string | null;
    isAllDay: boolean;
    location: string;
    scope: "COMPANY" | "VENTURE" | "PERSONAL";
    visibility: "PUBLIC" | "PARTICIPANTS" | "PRIVATE";
    categoryId: string | null;
    ventureId: string | null;
    productionOrderId: string | null;
    salesOrderId: string | null;
    purchaseOrderId: string | null;
    assignedPartnerId: string | null;
    tags: string[];
    checklists: { id?: string; title: string; isCompleted: boolean }[];
  }>
) {
  const updatePayload: any = {
    updatedAt: new Date(),
  };

  if (input.title !== undefined) updatePayload.title = input.title;
  if (input.description !== undefined) updatePayload.description = input.description;
  if (input.entryType !== undefined) updatePayload.entryType = input.entryType;
  if (input.status !== undefined) updatePayload.status = input.status;
  if (input.priority !== undefined) updatePayload.priority = input.priority;
  if (input.startDate !== undefined) updatePayload.startDate = new Date(input.startDate);
  if (input.endDate !== undefined)
    updatePayload.endDate = input.endDate ? new Date(input.endDate) : null;
  if (input.isAllDay !== undefined) updatePayload.isAllDay = input.isAllDay;
  if (input.location !== undefined) updatePayload.location = input.location;
  if (input.scope !== undefined) updatePayload.scope = input.scope;
  if (input.visibility !== undefined) updatePayload.visibility = input.visibility;
  if (input.categoryId !== undefined) updatePayload.categoryId = input.categoryId;
  if (input.ventureId !== undefined) updatePayload.ventureId = input.ventureId;
  if (input.productionOrderId !== undefined) updatePayload.productionOrderId = input.productionOrderId;
  if (input.salesOrderId !== undefined) updatePayload.salesOrderId = input.salesOrderId;
  if (input.purchaseOrderId !== undefined) updatePayload.purchaseOrderId = input.purchaseOrderId;
  if (input.assignedPartnerId !== undefined) updatePayload.assignedPartnerId = input.assignedPartnerId;
  if (input.tags !== undefined) updatePayload.tags = input.tags;

  const [updated] = await db
    .update(calendarEntries)
    .set(updatePayload)
    .where(eq(calendarEntries.id, id))
    .returning();

  // If checklists updated
  if (input.checklists) {
    await db.delete(calendarChecklistItems).where(eq(calendarChecklistItems.calendarEntryId, id));
    for (let i = 0; i < input.checklists.length; i++) {
      const item = input.checklists[i];
      await db.insert(calendarChecklistItems).values({
        calendarEntryId: id,
        title: item.title,
        isCompleted: item.isCompleted,
        completedAt: item.isCompleted ? new Date() : null,
        sortOrder: i,
      });
    }
  }

  return updated;
}

/**
 * Add a recurrence exception for a single occurrence
 */
export async function addRecurrenceException(input: {
  calendarEntryId: string;
  originalDate: Date | string;
  isCancelled?: boolean;
  overrideTitle?: string;
  overrideStartDate?: Date | string;
  overrideEndDate?: Date | string;
}) {
  const [created] = await db
    .insert(calendarRecurrenceExceptions)
    .values({
      calendarEntryId: input.calendarEntryId,
      originalDate: new Date(input.originalDate),
      isCancelled: input.isCancelled ?? false,
      overrideTitle: input.overrideTitle,
      overrideStartDate: input.overrideStartDate ? new Date(input.overrideStartDate) : null,
      overrideEndDate: input.overrideEndDate ? new Date(input.overrideEndDate) : null,
    })
    .returning();
  return created;
}

/**
 * Soft-delete or archive calendar item
 */
export async function deleteCalendarEntry(id: string) {
  const [deleted] = await db
    .update(calendarEntries)
    .set({
      isArchived: true,
      updatedAt: new Date(),
    })
    .where(eq(calendarEntries.id, id))
    .returning();
  return deleted;
}

/**
 * Toggle task checklist item completion
 */
export async function toggleChecklistItem(itemId: string, isCompleted: boolean) {
  const [updated] = await db
    .update(calendarChecklistItems)
    .set({
      isCompleted,
      completedAt: isCompleted ? new Date() : null,
    })
    .where(eq(calendarChecklistItems.id, itemId))
    .returning();
  return updated;
}

/**
 * Get upcoming dashboard summary items (today schedule, approaching deadlines, pending tasks)
 */
export async function getUpcomingDeadlinesAndTasks(userId?: string) {
  const now = new Date();
  const startToday = startOfDay(now);
  const endToday = endOfDay(now);
  const inSevenDays = addDays(now, 7);

  // Today's entries
  const todayEntries = await getCalendarEntries({
    startDate: startToday,
    endDate: endToday,
    userId,
  });

  // Upcoming deadlines (next 7 days)
  const upcomingDeadlines = await db
    .select({
      id: calendarEntries.id,
      title: calendarEntries.title,
      startDate: calendarEntries.startDate,
      entryType: calendarEntries.entryType,
      status: calendarEntries.status,
      categoryName: calendarCategories.name,
      categoryColor: calendarCategories.color,
      priority: calendarEntries.priority,
    })
    .from(calendarEntries)
    .leftJoin(calendarCategories, eq(calendarEntries.categoryId, calendarCategories.id))
    .where(
      and(
        eq(calendarEntries.isArchived, false),
        inArray(calendarEntries.entryType, ["DEADLINE", "EVENT"]),
        gte(calendarEntries.startDate, startToday),
        lte(calendarEntries.startDate, inSevenDays)
      )
    )
    .orderBy(asc(calendarEntries.startDate))
    .limit(6);

  // Pending tasks
  const pendingTasks = await db
    .select({
      id: calendarEntries.id,
      title: calendarEntries.title,
      startDate: calendarEntries.startDate,
      status: calendarEntries.status,
      priority: calendarEntries.priority,
      categoryName: calendarCategories.name,
      categoryColor: calendarCategories.color,
    })
    .from(calendarEntries)
    .leftJoin(calendarCategories, eq(calendarEntries.categoryId, calendarCategories.id))
    .where(
      and(
        eq(calendarEntries.isArchived, false),
        eq(calendarEntries.entryType, "TASK"),
        eq(calendarEntries.status, "PENDING")
      )
    )
    .orderBy(asc(calendarEntries.startDate))
    .limit(5);

  return {
    todayEntries,
    upcomingDeadlines,
    pendingTasks,
  };
}
