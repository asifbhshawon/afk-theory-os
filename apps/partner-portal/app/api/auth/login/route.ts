import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { portalPartners } from "@/lib/schema";
import { eq } from "drizzle-orm";
import {
  ensurePortalPartnersInitialized,
  verifyPassword,
  createPartnerSession,
  PARTNER_SESSION_COOKIE,
  SESSION_TTL_HOURS,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    await ensurePortalPartnersInitialized();

    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const [partner] = await db
      .select()
      .from(portalPartners)
      .where(eq(portalPartners.email, email.trim().toLowerCase()))
      .limit(1);

    if (!partner) {
      return NextResponse.json(
        { error: "Invalid email or credentials." },
        { status: 401 }
      );
    }

    if (!partner.isActive) {
      return NextResponse.json(
        { error: "Your partner portal account is inactive." },
        { status: 403 }
      );
    }

    const isValid = verifyPassword(password, partner.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid email or credentials." },
        { status: 401 }
      );
    }

    const ip = req.headers.get("x-forwarded-for") || undefined;
    const ua = req.headers.get("user-agent") || undefined;
    const { token, expiresAt } = await createPartnerSession(partner.id, ip, ua);

    const response = NextResponse.json({
      success: true,
      partner: {
        id: partner.id,
        name: partner.name,
        email: partner.email,
        role: partner.role,
        permittedVentureIds: partner.permittedVentureIds,
      },
    });

    response.cookies.set(PARTNER_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
      maxAge: SESSION_TTL_HOURS * 3600,
    });

    return response;
  } catch (err: any) {
    console.error("[Login API]", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
