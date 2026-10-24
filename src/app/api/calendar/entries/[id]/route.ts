import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getCalendarEntryById,
  updateCalendarEntry,
  deleteCalendarEntry,
  addRecurrenceException,
} from "@/server/services/calendar";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
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
