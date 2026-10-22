import { getCurrentUser, logoutUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ShieldCheck, Database, Calendar, LogOut } from "lucide-react";
import Link from "next/link";

export async function Header() {
  const user = await getCurrentUser();

  const today = new Date().toLocaleDateString("en-BD", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  async function handleLogout() {
    "use server";
    await logoutUser();
    redirect("/login");
  }

  const primaryRole = user?.isAdmin
    ? "Administrator"
    : user?.roles[0]?.replace("_", " ") || "Partner";

  const initial = user?.name ? user.name[0].toUpperCase() : "A";

  return (
    <header className="h-16 border-b border-afk-border bg-afk-charcoal/80 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <span className="text-xs uppercase tracking-widest text-afk-muted font-mono">
          AFK THEORY
        </span>
        <span className="text-afk-border text-sm">/</span>
        <span className="text-sm font-medium text-afk-offwhite capitalize">
          Business OS
        </span>
      </div>

      <div className="flex items-center gap-4 text-xs">
        {/* Date display */}
        <div className="hidden sm:flex items-center gap-1.5 text-afk-muted bg-afk-surface px-2.5 py-1.5 rounded border border-afk-border">
          <Calendar className="w-3.5 h-3.5" />
          <span>{today}</span>
        </div>

        {/* Database Status indicator */}
        <div className="flex items-center gap-1.5 text-afk-success bg-afk-olive-dark/40 px-2.5 py-1.5 rounded border border-afk-olive/40 font-mono">
          <Database className="w-3.5 h-3.5" />
          <span>PostgreSQL Active</span>
        </div>

        {/* Active Partner User Badge & Logout */}
        {user ? (
          <div className="flex items-center gap-3 pl-2 border-l border-afk-border">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-afk-olive text-afk-offwhite border border-afk-olive-light flex items-center justify-center font-bold text-xs">
                {initial}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-medium text-afk-offwhite leading-tight">{user.name}</p>
                <p className="text-[10px] text-afk-muted leading-tight capitalize">{primaryRole}</p>
              </div>
            </div>

            <form action={handleLogout}>
              <button
                type="submit"
                title="Sign out of AFK Business OS"
                className="p-1.5 text-afk-muted hover:text-red-400 hover:bg-afk-surface rounded border border-afk-border transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        ) : (
          <Link
            href="/login"
            className="px-3 py-1 bg-afk-olive text-afk-offwhite rounded text-xs hover:bg-afk-olive-light transition"
          >
            Sign In
          </Link>
        )}
      </div>
    </header>
  );
}
