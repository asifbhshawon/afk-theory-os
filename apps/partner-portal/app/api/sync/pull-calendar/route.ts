import { NextRequest, NextResponse } from "next/server";
import { getCalendarEntriesSince } from "@/lib/sync";
import { getCurrentPartner } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const syncSecret = process.env.SYNC_SHARED_SECRET;
    const partner = await getCurrentPartner();

    // Determine authorization type: ERP Secret Sync vs Partner Session
    const isErpSync =
      Boolean(syncSecret) &&
      (authHeader === `Bearer ${syncSecret}` || req.headers.get("x-sync-secret") === syncSecret);

    if (!isErpSync && !partner) {
      return NextResponse.json({ error: "Unauthorized access to calendar data." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const since = searchParams.get("since") || undefined;

    // ERP synchronization receives all records; Partner sessions are strictly scoped by permissions
    const data = await getCalendarEntriesSince(since, isErpSync ? undefined : partner!);

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
