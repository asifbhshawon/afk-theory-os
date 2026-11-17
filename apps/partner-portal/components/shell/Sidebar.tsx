"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { LogOut, ShieldCheck } from "lucide-react";
import type { PortalPartner } from "@/lib/constants";
import { NAV_GROUPS, SETTINGS_ITEM, isActive, type NavItem } from "./nav";
import { useLogout } from "./useLogout";

function SideLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
        active
          ? "bg-afk-olive/20 text-afk-offwhite"
          : "text-afk-secondary hover:bg-afk-surface hover:text-afk-offwhite"
      )}
    >
      {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r bg-afk-olive-accent" />}
      <Icon className={clsx("w-[18px] h-[18px] shrink-0", active ? "text-afk-olive-accent" : "text-afk-muted group-hover:text-afk-secondary")} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

/** Desktop navigation rail (hidden below `lg`; phones use MobileTabBar). */
export function Sidebar({ partner }: { partner: PortalPartner }) {
  const pathname = usePathname();
  const { logout, busy } = useLogout();

  return (
    <aside className="no-print hidden lg:flex fixed inset-y-0 left-0 z-40 w-64 flex-col border-r border-afk-border bg-afk-charcoal">
      <Link href="/" className="flex items-center gap-3 px-5 h-16 border-b border-afk-border shrink-0">
        <span className="grid place-items-center w-9 h-9 rounded-lg bg-afk-surface border border-afk-border text-xs font-bold tracking-wider text-afk-gold">
          AFK
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-bold tracking-tight text-afk-offwhite">AFK THEORY</span>
          <span className="block text-2xs uppercase tracking-wider text-afk-olive-accent font-semibold">Partner Portal</span>
        </span>
      </Link>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="px-3 mb-1.5 text-2xs font-semibold uppercase tracking-wider text-afk-subtle">{group.title}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <SideLink key={item.href} item={item} active={isActive(pathname, item.href)} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-afk-border p-3 space-y-2 shrink-0">
        <SideLink item={SETTINGS_ITEM} active={isActive(pathname, SETTINGS_ITEM.href)} />
        <div className="flex items-center gap-3 rounded-lg bg-afk-surface border border-afk-border px-3 py-2.5">
          <span className="grid place-items-center w-8 h-8 rounded-full bg-afk-olive-dark border border-afk-olive/50 text-xs font-bold text-afk-offwhite shrink-0">
            {partner.name.charAt(0)}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block text-xs font-semibold text-afk-offwhite truncate">{partner.name}</span>
            <span className="flex items-center gap-1 text-2xs text-afk-muted">
              {partner.role === "ADMIN" && <ShieldCheck className="w-3 h-3 text-afk-gold" />}
              {partner.role === "ADMIN" ? "Founding Admin" : "Founding Partner"}
            </span>
          </span>
          <button
            onClick={logout}
            disabled={busy}
            title="Sign out"
            aria-label="Sign out"
            className="p-1.5 rounded-lg text-afk-muted hover:text-afk-danger hover:bg-afk-elevated transition disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
