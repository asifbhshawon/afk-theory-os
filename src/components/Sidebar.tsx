"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  Users,
  Package,
  Factory,
  ShoppingBag,
  BarChart3,
  Settings,
  ShieldCheck,
  FileText,
} from "lucide-react";
import clsx from "clsx";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/finance", label: "Finance & Accounts", icon: Wallet },
  { href: "/partners", label: "Partner Accounts", icon: Users },
  { href: "/inventory", label: "Catalog & Stock", icon: Package },
  { href: "/manufacturing", label: "Manufacturing", icon: Factory },
  { href: "/orders", label: "Sales & Courier", icon: ShoppingBag },
  { href: "/reports", label: "Reports & Drilldown", icon: BarChart3 },
  { href: "/settings", label: "System & Backups", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-64 bg-afk-charcoal border-r border-afk-border h-screen sticky top-0">
      {/* Brand Header */}
      <div className="p-6 border-b border-afk-border flex items-center gap-3">
        <div className="w-9 h-9 rounded bg-afk-olive flex items-center justify-center font-bold tracking-widest text-afk-offwhite border border-afk-olive-light">
          AFK
        </div>
        <div>
          <h1 className="font-bold text-sm tracking-wider text-afk-offwhite">AFK THEORY</h1>
          <p className="text-xs text-afk-muted">Business OS · Local</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-afk-olive text-afk-offwhite shadow-sm"
                  : "text-afk-muted hover:text-afk-offwhite hover:bg-afk-surface"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-afk-border bg-afk-charcoal/50 text-xs text-afk-muted space-y-1">
        <div className="flex items-center justify-between">
          <span>Currency</span>
          <span className="font-mono text-afk-offwhite font-medium">BDT (৳)</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Storage</span>
          <span className="text-afk-success flex items-center gap-1 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-afk-success"></span>
            100% Local
          </span>
        </div>
      </div>
    </aside>
  );
}
