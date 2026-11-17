import { NextResponse } from "next/server";
import { getCloudSyncStatus } from "@/server/services/cloud-sync";
import { syncPortalNow, getAutoSyncState } from "@/server/services/portal-autosync";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [status, auto] = await Promise.all([getCloudSyncStatus(), getAutoSyncState()]);
    return NextResponse.json({ ...status, auto });
  } catch (err: any) {
    return NextResponse.json(
      { isConfigured: false, error: err.message || "Failed to fetch cloud sync status" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Please log in to sync with Cloud Portal." },
        { status: 401 }
      );
    }

    const result = await syncPortalNow();
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[Sync Portal API Error]", err);
    return NextResponse.json(
      { success: false, error: err.message || "Cloud sync operation failed." },
      { status: 500 }
    );
  }
}
