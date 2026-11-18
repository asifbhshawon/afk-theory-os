import { redirect } from "next/navigation";
import { getCurrentPartner } from "@/lib/auth";
import { getSyncFreshness } from "@/lib/portal-data";
import { Sidebar } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";
import { MobileTabBar } from "@/components/shell/MobileTabBar";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const partner = await getCurrentPartner();

  if (!partner) {
    redirect("/login");
  }

  // Cached (tag: portal-data) — costs no database query between syncs.
  const freshness = await getSyncFreshness().catch(() => ({ lastPushedAt: null, status: "UNKNOWN" }));

  return (
    <div className="min-h-screen bg-afk-black text-afk-offwhite">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-afk-olive focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-afk-offwhite">
        Skip to main content
        </a>
      <Sidebar partner={partner} />
      <div className="lg:pl-64 print:pl-0 flex min-h-screen flex-col">
        <TopBar partner={partner} lastPushedAt={freshness.lastPushedAt} />
        <main id="main-content" tabIndex={-1} className="flex-1 outline-none w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 lg:pb-10 print:p-0">
          {children}
        </main>
        <footer className="no-print hidden lg:block border-t border-afk-border py-4 text-center text-xs text-afk-muted">
          AFK THEORY Business OS — Partner Portal · read-only view of the local ERP
        </footer>
      </div>
      <MobileTabBar partner={partner} />
    </div>
  );
}
