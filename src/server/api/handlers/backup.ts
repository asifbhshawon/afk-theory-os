import { NextResponse } from "next/server";
import { createLocalBackup } from "@/server/services/backup";
import { getCurrentUser } from "@/lib/auth";

export async function handleBackupPost() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Administrator login required." },
        { status: 401 }
      );
    }

    if (!user.isAdmin) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Only administrators can trigger local backups." },
        { status: 403 }
      );
    }

    const result = await createLocalBackup();
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
    return NextResponse.json({ success: true, backup: result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// Alias for direct test invocation
export const POST = handleBackupPost;
