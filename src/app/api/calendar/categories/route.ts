import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getCalendarCategories,
  createCalendarCategory,
  updateCalendarCategory,
  archiveCalendarCategory,
} from "@/server/services/calendar";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const categories = await getCalendarCategories(false);
    return NextResponse.json({ categories });
  } catch (err: any) {
    console.error("[API /api/calendar/categories GET]", err);
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
    if (!body.name || !body.color) {
      return NextResponse.json({ error: "Name and color are required" }, { status: 400 });
    }

    const category = await createCalendarCategory({
      name: body.name,
      color: body.color,
      icon: body.icon,
      description: body.description,
      isShared: body.isShared ?? true,
      userId: user.id,
    });

    return NextResponse.json({ success: true, category });
  } catch (err: any) {
    console.error("[API /api/calendar/categories POST]", err);
    return NextResponse.json({ error: err.message || "Internal Error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: "Category ID is required" }, { status: 400 });
    }

    const updated = await updateCalendarCategory(body.id, {
      name: body.name,
      color: body.color,
      icon: body.icon,
      description: body.description,
      isShared: body.isShared,
      sortOrder: body.sortOrder,
    });

    return NextResponse.json({ success: true, category: updated });
  } catch (err: any) {
    console.error("[API /api/calendar/categories PATCH]", err);
    return NextResponse.json({ error: err.message || "Internal Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Category ID is required" }, { status: 400 });
    }

    const archived = await archiveCalendarCategory(id);
    return NextResponse.json({ success: true, archived });
  } catch (err: any) {
    console.error("[API /api/calendar/categories DELETE]", err);
    return NextResponse.json({ error: err.message || "Internal Error" }, { status: 500 });
  }
}
