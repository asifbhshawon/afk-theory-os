import { redirect } from "next/navigation";
import { getCurrentPartner } from "@/lib/auth";
import { PortalHeader } from "@/components/PortalHeader";
import { PortalNav } from "@/components/PortalNav";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const partner = await getCurrentPartner();

  if (!partner) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex flex-col bg-afk-black text-afk-offwhite">
      <PortalHeader partner={partner} />
      <PortalNav />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
      <footer className="no-print border-t border-afk-border py-4 text-center text-xs text-afk-muted">
        <p>AFK THEORY Business OS — Executive Partner Portal & Cloud View</p>
      </footer>
    </div>
  );
}
