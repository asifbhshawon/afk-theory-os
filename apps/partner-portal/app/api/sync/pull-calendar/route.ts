import { NextRequest, NextResponse } from "next/server";
import { getCalendarEntriesSince } from "@/lib/sync";
import { getCurrentPartner } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const syncSecret = process.env.SYNC_SHARED_SECRET || "afk-theory-partner-portal-sync-secret-key-2026";
    const partner = await getCurrentPartner();

    const isAuthorized =
      authHeader === `Bearer ${syncSecret}` ||
      req.headers.get("x-sync-secret") === syncSecret ||
      partner !== null;

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const since = searchParams.get("since") || undefined;

    const data = await getCalendarEntriesSince(since);
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...data,
    });
  } catch (err: any) {
    console.error("[Sync Pull Calendar API Error]", err);
    return NextResponse.json({ error: err.message || "Failed to pull calendar" }, { status: 500 });
  }
}
