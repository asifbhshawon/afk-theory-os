import { NextRequest, NextResponse } from "next/server";
import { getCurrentPartner } from "@/lib/auth";
import {
  getPortalCalendarEntries,
  createPortalCalendarEntry,
  updatePortalCalendarEntry,
} from "@/lib/calendar";

export async function GET(req: NextRequest) {
  try {
    const partner = await getCurrentPartner();
    if (!partner) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope") || undefined;
    const entryType = searchParams.get("entryType") || undefined;
    const categoryId = searchParams.get("categoryId") || undefined;
    const ventureId = searchParams.get("ventureId") || undefined;
    const startStr = searchParams.get("startDate");
    const endStr = searchParams.get("endDate");

    const entries = await getPortalCalendarEntries({
      partner,
      scope,
      entryType,
      categoryId,
      ventureId,
      startDate: startStr ? new Date(startStr) : undefined,
      endDate: endStr ? new Date(endStr) : undefined,
    });

    return NextResponse.json({ entries });
  } catch (err: any) {
    console.error("[Calendar Entries GET Error]", err);
    return NextResponse.json({ error: err.message || "Failed to load entries" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const partner = await getCurrentPartner();
    if (!partner) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    if (!body.title || !body.startDate) {
      return NextResponse.json(
        { error: "Title and startDate are required." },
        { status: 400 }
      );
    }

    const created = await createPortalCalendarEntry(partner, body);
    return NextResponse.json({ success: true, entry: created });
  } catch (err: any) {
    console.error("[Calendar Entries POST Error]", err);
    return NextResponse.json(
      { error: err.message || "Failed to create calendar entry" },
      { status: 400 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const partner = await getCurrentPartner();
    if (!partner) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: "Entry ID is required." }, { status: 400 });
    }

    const updated = await updatePortalCalendarEntry(partner, body.id, body);
    return NextResponse.json({ success: true, entry: updated });
  } catch (err: any) {
    console.error("[Calendar Entries PATCH Error]", err);
    return NextResponse.json(
      { error: err.message || "Failed to update calendar entry" },
      { status: 400 }
    );
  }
}
