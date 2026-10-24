import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getCalendarCategories,
  createCalendarCategory,
  updateCalendarCategory,
  archiveCalendarCategory,
  getCalendarEntries,
  createCalendarEntry,
  getCalendarEntryById,
  updateCalendarEntry,
  deleteCalendarEntry,
  addRecurrenceException,
  toggleChecklistItem,
} from "@/server/services/calendar";

// ==========================================
// 1. Categories
// ==========================================

export async function handleCalendarCategoriesGet() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const categories = await getCalendarCategories(false);
    return NextResponse.json({ categories });
  } catch (err: any) {
    console.error("[API /api/calendar/categories GET]", err);
    return NextResponse.json({ error: err.message || "Internal Error" }, { status: 500 });
  }
}

export async function handleCalendarCategoriesPost(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    if (!body.name || !body.color) {
      return NextResponse.json({ error: "Name and color are required" }, { status: 400 });
    }

    const category = await createCalendarCategory({
      name: body.name,
      color: body.color,
      icon: body.icon,
      description: body.description,
      isShared: body.isShared ?? true,
      userId: user.id,
    });

    return NextResponse.json({ success: true, category });
  } catch (err: any) {
    console.error("[API /api/calendar/categories POST]", err);
    return NextResponse.json({ error: err.message || "Internal Error" }, { status: 500 });
  }
}

export async function handleCalendarCategoriesPatch(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: "Category ID is required" }, { status: 400 });
    }

    const updated = await updateCalendarCategory(body.id, {
      name: body.name,
      color: body.color,
      icon: body.icon,
      description: body.description,
      isShared: body.isShared,
      sortOrder: body.sortOrder,
    });

    return NextResponse.json({ success: true, category: updated });
  } catch (err: any) {
    console.error("[API /api/calendar/categories PATCH]", err);
    return NextResponse.json({ error: err.message || "Internal Error" }, { status: 500 });
  }
}

export async function handleCalendarCategoriesDelete(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Category ID is required" }, { status: 400 });
    }

    const archived = await archiveCalendarCategory(id);
    return NextResponse.json({ success: true, archived });
  } catch (err: any) {
    console.error("[API /api/calendar/categories DELETE]", err);
    return NextResponse.json({ error: err.message || "Internal Error" }, { status: 500 });
  }
}

// ==========================================
// 2. Entries
// ==========================================

export async function handleCalendarEntriesGet(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const startStr = searchParams.get("start");
    const endStr = searchParams.get("end");
    const categories = searchParams.get("categories")?.split(",").filter(Boolean);
    const scopes = searchParams.get("scopes")?.split(",").filter(Boolean);
    const types = searchParams.get("types")?.split(",").filter(Boolean);
    const ventureId = searchParams.get("ventureId") || undefined;
    const search = searchParams.get("q") || undefined;

    const entries = await getCalendarEntries({
      startDate: startStr ? new Date(startStr) : undefined,
      endDate: endStr ? new Date(endStr) : undefined,
      categoryIds: categories,
      scopes,
      entryTypes: types,
      ventureId,
      search,
      userId: user.id,
    });

    return NextResponse.json({ entries });
  } catch (err: any) {
    console.error("[API /api/calendar/entries GET]", err);
    return NextResponse.json({ error: err.message || "Internal Error" }, { status: 500 });
  }
}

export async function handleCalendarEntriesPost(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    if (!body.title || !body.startDate) {
      return NextResponse.json(
        { error: "Title and startDate are required" },
        { status: 400 }
      );
    }

    const entry = await createCalendarEntry(body, user.id);
    return NextResponse.json({ success: true, entry });
  } catch (err: any) {
    console.error("[API /api/calendar/entries POST]", err);
    return NextResponse.json({ error: err.message || "Internal Error" }, { status: 500 });
  }
}

// ==========================================
// 3. Entry by ID
// ==========================================

export async function handleCalendarEntryByIdGet(req: NextRequest, id: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const entry = await getCalendarEntryById(id);
    if (!entry) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Personal entry permission check
    if (entry.scope === "PERSONAL" && entry.ownerUserId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ entry });
  } catch (err: any) {
    console.error("[API /api/calendar/entries/[id] GET]", err);
    return NextResponse.json({ error: err.message || "Internal Error" }, { status: 500 });
  }
}

export async function handleCalendarEntryByIdPatch(req: NextRequest, id: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existing = await getCalendarEntryById(id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (existing.scope === "PERSONAL" && existing.ownerUserId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();

    // Check if updating only a specific occurrence
    if (body.singleOccurrenceDate) {
      const exception = await addRecurrenceException({
        calendarEntryId: id,
        originalDate: body.singleOccurrenceDate,
        overrideTitle: body.title,
        overrideStartDate: body.startDate,
        overrideEndDate: body.endDate,
        isCancelled: body.isCancelled ?? false,
      });
      return NextResponse.json({ success: true, exception });
    }

    const updated = await updateCalendarEntry(id, body);
    return NextResponse.json({ success: true, entry: updated });
  } catch (err: any) {
    console.error("[API /api/calendar/entries/[id] PATCH]", err);
    return NextResponse.json({ error: err.message || "Internal Error" }, { status: 500 });
  }
}

export async function handleCalendarEntryByIdDelete(req: NextRequest, id: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existing = await getCalendarEntryById(id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (existing.scope === "PERSONAL" && existing.ownerUserId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const deleted = await deleteCalendarEntry(id);
    return NextResponse.json({ success: true, deleted });
  } catch (err: any) {
    console.error("[API /api/calendar/entries/[id] DELETE]", err);
    return NextResponse.json({ error: err.message || "Internal Error" }, { status: 500 });
  }
}

// ==========================================
// 4. Checklist Item by ID
// ==========================================

export async function handleCalendarChecklistPatch(req: NextRequest, id: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const updated = await toggleChecklistItem(id, Boolean(body.isCompleted));
    return NextResponse.json({ success: true, item: updated });
  } catch (err: any) {
    console.error("[API /api/calendar/checklist/[id] PATCH]", err);
    return NextResponse.json({ error: err.message || "Internal Error" }, { status: 500 });
  }
}
