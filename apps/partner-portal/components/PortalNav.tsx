"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  Briefcase,
  Bell,
  Calendar,
  FileText,
  Settings,
} from "lucide-react";
import clsx from "clsx";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/my-investments", label: "My Investments", icon: Wallet },
  { href: "/ventures", label: "Ventures", icon: Briefcase },
  { href: "/updates", label: "Business Updates", icon: Bell },
  { href: "/calendar", label: "Calendar & Notes", icon: Calendar },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function PortalNav() {
  const pathname = usePathname();

  return (
    <nav className="no-print border-b border-afk-border bg-afk-charcoal/80 overflow-x-auto scrollbar-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-1 sm:space-x-4 py-2 min-w-max">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition",
                  isActive
                    ? "bg-afk-surface text-afk-offwhite border border-afk-borderLight font-semibold shadow-sm"
                    : "text-afk-secondary hover:text-afk-offwhite hover:bg-afk-surface/50"
                )}
              >
                <Icon
                  className={clsx(
                    "w-4 h-4",
                    isActive ? "text-afk-olive-accent" : "text-afk-muted"
                  )}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
