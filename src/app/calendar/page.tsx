import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { partners, ventures } from "@/db/schema";
import { getCalendarCategories } from "@/server/services/calendar";
import { CalendarWorkspaceClient } from "@/components/calendar/CalendarWorkspaceClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Calendar & Planner | AFK THEORY Business OS",
  description: "Drop schedule, supplier deadlines, factory batch timetables, and business notes",
};

export default async function CalendarPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const allCategories = await getCalendarCategories(false);
  const allPartners = await db
    .select({ id: partners.id, name: partners.name })
    .from(partners)
    .orderBy(partners.name);

  const allVentures = await db
    .select({ id: ventures.id, title: ventures.title, ventureNumber: ventures.ventureNumber })
    .from(ventures)
    .orderBy(ventures.title);

  return (
    <div className="space-y-6">
      <CalendarWorkspaceClient
        initialCategories={allCategories}
        partners={allPartners}
        ventures={allVentures}
        currentUserId={user.id}
      />
    </div>
  );
}
