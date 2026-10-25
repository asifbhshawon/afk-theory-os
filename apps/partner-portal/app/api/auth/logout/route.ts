import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PARTNER_SESSION_COOKIE, revokePartnerSession } from "@/lib/auth";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(PARTNER_SESSION_COOKIE)?.value;

    if (token) {
      await revokePartnerSession(token);
    }

    const response = NextResponse.json({ success: true, message: "Logged out" });
    response.cookies.delete(PARTNER_SESSION_COOKIE);
    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Logout failed" }, { status: 500 });
  }
}
