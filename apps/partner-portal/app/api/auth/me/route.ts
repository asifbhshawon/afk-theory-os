import { NextResponse } from "next/server";
import { getCurrentPartner } from "@/lib/auth";

export async function GET() {
  const partner = await getCurrentPartner();
  if (!partner) {
    return NextResponse.json({ authenticated: false, partner: null }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, partner });
}
