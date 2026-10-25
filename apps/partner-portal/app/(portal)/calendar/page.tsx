import { getCurrentPartner } from "@/lib/auth";
import { getPortalCalendarEntries, getPortalCategories } from "@/lib/calendar";
import { CalendarClient } from "@/components/CalendarClient";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const partner = await getCurrentPartner();
  if (!partner) return null;

  const entries = await getPortalCalendarEntries({ partner });
  const categories = await getPortalCategories();

  return (
    <CalendarClient
      initialEntries={entries as any}
      categories={categories}
      partner={partner}
    />
  );
}
