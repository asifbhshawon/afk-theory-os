import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getCalendarEntries,
  createCalendarEntry,
} from "@/server/services/calendar";

export async function GET(req: NextRequest) {
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

export async function POST(req: NextRequest) {
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
