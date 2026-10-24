import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCalendarEntries, getCalendarCategories } from "@/server/services/calendar";
import { PrintableCalendarView } from "@/components/calendar/PrintableCalendarView";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Printable Business Planner | AFK THEORY Business OS",
  description: "A4 Printable Daily, Weekly, and Monthly Business Calendar",
};

export default async function PrintableCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const formatType = (params.type?.toUpperCase() || "MONTHLY") as "DAILY" | "WEEKLY" | "MONTHLY";
  const targetDate = params.date ? new Date(params.date) : new Date();

  const includeNotes = params.notes !== "false";
  const includeTasks = params.tasks !== "false";
  const includeCompleted = params.completed !== "false";
  const includeExtraNotesSpace = params.lines !== "false";

  const categories = await getCalendarCategories(false);
  const entries = await getCalendarEntries({
    userId: user.id,
  });

  return (
    <div className="bg-white min-h-screen p-4 sm:p-8 font-sans">
      <PrintableCalendarView
        formatType={formatType}
        targetDate={targetDate}
        entries={entries}
        categories={categories}
        includeNotes={includeNotes}
        includeTasks={includeTasks}
        includeCompleted={includeCompleted}
        includeExtraNotesSpace={includeExtraNotesSpace}
      />
    </div>
  );
}
