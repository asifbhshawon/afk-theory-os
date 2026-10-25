import { db } from "./db";
import {
  portalCalendarCategories,
  portalCalendarEntries,
  portalCalendarChecklists,
  portalCalendarRecurrence,
  portalPartners,
} from "./schema";
import { eq, and, or, inArray, gte, lte, asc, desc, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { hasVentureAccess, PortalPartner } from "./auth";

export const DEFAULT_PORTAL_CATEGORIES = [
  { id: "cat-prod", name: "Production", slug: "production", color: "#3B82F6", icon: "Factory", isShared: true, sortOrder: 1 },
  { id: "cat-fin", name: "Finance", slug: "finance", color: "#10B981", icon: "Wallet", isShared: true, sortOrder: 2 },
  { id: "cat-meet", name: "Partner Meeting", slug: "partner-meeting", color: "#8B5CF6", icon: "Users", isShared: true, sortOrder: 3 },
  { id: "cat-sup", name: "Supplier", slug: "supplier", color: "#F59E0B", icon: "Truck", isShared: true, sortOrder: 4 },
  { id: "cat-sales", name: "Sales & Delivery", slug: "sales-delivery", color: "#06B6D4", icon: "ShoppingBag", isShared: true, sortOrder: 5 },
  { id: "cat-mkt", name: "Marketing", slug: "marketing", color: "#EC4899", icon: "Megaphone", isShared: true, sortOrder: 6 },
  { id: "cat-photo", name: "Photoshoot", slug: "photoshoot", color: "#F97316", icon: "Camera", isShared: true, sortOrder: 7 },
  { id: "cat-drop", name: "Product Launch", slug: "product-launch", color: "#E11D48", icon: "Sparkles", isShared: true, sortOrder: 8 },
  { id: "cat-dsgn", name: "Design", slug: "design", color: "#6366F1", icon: "Palette", isShared: true, sortOrder: 9 },
  { id: "cat-pers", name: "Personal", slug: "personal", color: "#6B7280", icon: "User", isShared: false, sortOrder: 10 },
  { id: "cat-gen", name: "General", slug: "general", color: "#5A7352", icon: "Calendar", isShared: true, sortOrder: 11 },
];

export async function ensureDefaultPortalCategories() {
  for (const cat of DEFAULT_PORTAL_CATEGORIES) {
    const [existing] = await db
      .select()
      .from(portalCalendarCategories)
      .where(eq(portalCalendarCategories.slug, cat.slug))
      .limit(1);

    if (!existing) {
      await db.insert(portalCalendarCategories).values(cat);
    }
  }
}

export async function getPortalCategories() {
  await ensureDefaultPortalCategories();
  return await db
    .select()
    .from(portalCalendarCategories)
    .where(eq(portalCalendarCategories.isArchived, false))
    .orderBy(asc(portalCalendarCategories.sortOrder));
}

export interface GetCalendarEntriesFilter {
  partner: PortalPartner;
  startDate?: Date;
  endDate?: Date;
  scope?: string;
  entryType?: string;
  categoryId?: string;
  ventureId?: string;
  search?: string;
}

export async function getPortalCalendarEntries(filter: GetCalendarEntriesFilter) {
  await ensureDefaultPortalCategories();

  const conditions = [eq(portalCalendarEntries.isArchived, false)];

  // Permission scoping:
  // 1. COMPANY notes: visible to all partners
  // 2. PERSONAL notes: visible ONLY if ownerPartnerId == partner.id
  // 3. VENTURE notes: visible ONLY if partner has access to that venture
  const permissionCondition = or(
    eq(portalCalendarEntries.scope, "COMPANY"),
    and(
      eq(portalCalendarEntries.scope, "PERSONAL"),
      eq(portalCalendarEntries.ownerPartnerId, filter.partner.id)
    ),
    filter.partner.role === "ADMIN" || filter.partner.permittedVentureIds.includes("*")
      ? eq(portalCalendarEntries.scope, "VENTURE")
      : and(
          eq(portalCalendarEntries.scope, "VENTURE"),
          inArray(portalCalendarEntries.ventureId, filter.partner.permittedVentureIds)
        )
  )!;

  conditions.push(permissionCondition);

  if (filter.startDate) {
    conditions.push(gte(portalCalendarEntries.startDate, filter.startDate));
  }
  if (filter.endDate) {
    conditions.push(lte(portalCalendarEntries.startDate, filter.endDate));
  }
  if (filter.scope) {
    conditions.push(eq(portalCalendarEntries.scope, filter.scope));
  }
  if (filter.entryType) {
    conditions.push(eq(portalCalendarEntries.entryType, filter.entryType));
  }
  if (filter.categoryId) {
    conditions.push(eq(portalCalendarEntries.categoryId, filter.categoryId));
  }
  if (filter.ventureId) {
    if (!hasVentureAccess(filter.partner, filter.ventureId)) {
      return []; // Unauthorized to view this venture's entries
    }
    conditions.push(eq(portalCalendarEntries.ventureId, filter.ventureId));
  }

  const entries = await db
    .select({
      id: portalCalendarEntries.id,
      title: portalCalendarEntries.title,
      description: portalCalendarEntries.description,
      entryType: portalCalendarEntries.entryType,
      status: portalCalendarEntries.status,
      priority: portalCalendarEntries.priority,
      startDate: portalCalendarEntries.startDate,
      endDate: portalCalendarEntries.endDate,
      isAllDay: portalCalendarEntries.isAllDay,
      location: portalCalendarEntries.location,
      scope: portalCalendarEntries.scope,
      visibility: portalCalendarEntries.visibility,
      categoryId: portalCalendarEntries.categoryId,
      categoryName: portalCalendarCategories.name,
      categoryColor: portalCalendarCategories.color,
      categoryIcon: portalCalendarCategories.icon,
      ventureId: portalCalendarEntries.ventureId,
      assignedPartnerId: portalCalendarEntries.assignedPartnerId,
      ownerPartnerId: portalCalendarEntries.ownerPartnerId,
      ownerName: portalPartners.name,
      tags: portalCalendarEntries.tags,
      version: portalCalendarEntries.version,
      origin: portalCalendarEntries.origin,
      createdAt: portalCalendarEntries.createdAt,
      updatedAt: portalCalendarEntries.updatedAt,
    })
    .from(portalCalendarEntries)
    .leftJoin(portalCalendarCategories, eq(portalCalendarEntries.categoryId, portalCalendarCategories.id))
    .leftJoin(portalPartners, eq(portalCalendarEntries.ownerPartnerId, portalPartners.id))
    .where(and(...conditions))
    .orderBy(asc(portalCalendarEntries.startDate));

  if (entries.length === 0) return [];

  const entryIds = entries.map((e) => e.id);
  const checklists = await db
    .select()
    .from(portalCalendarChecklists)
    .where(inArray(portalCalendarChecklists.calendarEntryId, entryIds))
    .orderBy(asc(portalCalendarChecklists.sortOrder));

  const checklistMap: Record<string, any[]> = {};
  for (const c of checklists) {
    if (!checklistMap[c.calendarEntryId]) checklistMap[c.calendarEntryId] = [];
    checklistMap[c.calendarEntryId].push(c);
  }

  return entries.map((e) => ({
    ...e,
    checklists: checklistMap[e.id] || [],
  }));
}

export interface CreateCalendarEntryInput {
  title: string;
  description?: string;
  entryType?: string; // NOTE, TASK, MEETING, DEADLINE, REMINDER
  status?: string;
  priority?: string;
  startDate: Date | string;
  endDate?: Date | string;
  isAllDay?: boolean;
  location?: string;
  scope?: string; // PERSONAL, COMPANY, VENTURE
  categoryId?: string;
  ventureId?: string;
  assignedPartnerId?: string;
  tags?: string[];
  checklists?: { title: string; isCompleted?: boolean }[];
  recurrence?: {
    frequency: string;
    interval?: number;
    daysOfWeek?: number[];
    untilDate?: Date | string;
  };
}

export async function createPortalCalendarEntry(
  partner: PortalPartner,
  input: CreateCalendarEntryInput
) {
  const scope = input.scope || "COMPANY";

  // Check venture permissions if venture scope
  if (scope === "VENTURE") {
    if (!input.ventureId) {
      throw new Error("Venture ID is required for VENTURE scoped entries.");
    }
    if (!hasVentureAccess(partner, input.ventureId)) {
      throw new Error(`Unauthorized: You do not have access to venture ${input.ventureId}.`);
    }
  }

  const entryId = randomUUID();
  const now = new Date();

  return await db.transaction(async (tx) => {
    const [entry] = await tx
      .insert(portalCalendarEntries)
      .values({
        id: entryId,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        entryType: input.entryType || "NOTE",
        status: input.status || "PENDING",
        priority: input.priority || "MEDIUM",
        startDate: new Date(input.startDate),
        endDate: input.endDate ? new Date(input.endDate) : null,
        isAllDay: input.isAllDay ?? false,
        location: input.location?.trim() || null,
        scope,
        visibility: scope === "PERSONAL" ? "PRIVATE" : "PUBLIC",
        categoryId: input.categoryId || null,
        ventureId: input.ventureId || null,
        assignedPartnerId: input.assignedPartnerId || null,
        ownerPartnerId: partner.id,
        tags: input.tags || [],
        version: 1,
        origin: "PORTAL",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const createdChecklists = [];
    if (input.checklists && input.checklists.length > 0) {
      let order = 0;
      for (const item of input.checklists) {
        if (!item.title.trim()) continue;
        const [c] = await tx
          .insert(portalCalendarChecklists)
          .values({
            id: randomUUID(),
            calendarEntryId: entry.id,
            title: item.title.trim(),
            isCompleted: item.isCompleted ?? false,
            completedAt: item.isCompleted ? now : null,
            sortOrder: order++,
          })
          .returning();
        createdChecklists.push(c);
      }
    }

    if (input.recurrence) {
      await tx.insert(portalCalendarRecurrence).values({
        id: randomUUID(),
        calendarEntryId: entry.id,
        frequency: input.recurrence.frequency,
        interval: input.recurrence.interval || 1,
        daysOfWeek: input.recurrence.daysOfWeek || null,
        untilDate: input.recurrence.untilDate ? new Date(input.recurrence.untilDate) : null,
      });
    }

    return {
      ...entry,
      checklists: createdChecklists,
    };
  });
}

export async function updatePortalCalendarEntry(
  partner: PortalPartner,
  id: string,
  updates: Partial<CreateCalendarEntryInput>
) {
  const [existing] = await db
    .select()
    .from(portalCalendarEntries)
    .where(eq(portalCalendarEntries.id, id))
    .limit(1);

  if (!existing) {
    throw new Error("Calendar entry not found.");
  }

  // Permission checks:
  if (existing.scope === "PERSONAL" && existing.ownerPartnerId !== partner.id) {
    throw new Error("Unauthorized: Cannot edit another partner's personal note.");
  }
  if (existing.scope === "VENTURE" && existing.ventureId && !hasVentureAccess(partner, existing.ventureId)) {
    throw new Error("Unauthorized: Cannot edit note in unassigned venture.");
  }

  const now = new Date();

  return await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(portalCalendarEntries)
      .set({
        title: updates.title !== undefined ? updates.title.trim() : existing.title,
        description: updates.description !== undefined ? updates.description?.trim() : existing.description,
        entryType: updates.entryType || existing.entryType,
        status: updates.status || existing.status,
        priority: updates.priority || existing.priority,
        startDate: updates.startDate ? new Date(updates.startDate) : existing.startDate,
        endDate: updates.endDate !== undefined ? (updates.endDate ? new Date(updates.endDate) : null) : existing.endDate,
        isAllDay: updates.isAllDay !== undefined ? updates.isAllDay : existing.isAllDay,
        location: updates.location !== undefined ? updates.location?.trim() : existing.location,
        categoryId: updates.categoryId !== undefined ? updates.categoryId : existing.categoryId,
        version: existing.version + 1,
        updatedAt: now,
      })
      .where(eq(portalCalendarEntries.id, id))
      .returning();

    return updated;
  });
}

export async function togglePortalChecklistItem(partner: PortalPartner, checklistItemId: string) {
  const [item] = await db
    .select()
    .from(portalCalendarChecklists)
    .where(eq(portalCalendarChecklists.id, checklistItemId))
    .limit(1);

  if (!item) throw new Error("Checklist item not found.");

  const [entry] = await db
    .select()
    .from(portalCalendarEntries)
    .where(eq(portalCalendarEntries.id, item.calendarEntryId))
    .limit(1);

  if (!entry) throw new Error("Parent calendar entry not found.");

  if (entry.scope === "PERSONAL" && entry.ownerPartnerId !== partner.id) {
    throw new Error("Unauthorized to modify personal task checklist.");
  }

  const newStatus = !item.isCompleted;
  const now = new Date();

  const [updated] = await db
    .update(portalCalendarChecklists)
    .set({
      isCompleted: newStatus,
      completedAt: newStatus ? now : null,
    })
    .where(eq(portalCalendarChecklists.id, checklistItemId))
    .returning();

  return updated;
}
