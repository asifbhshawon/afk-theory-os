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
  CircleDot,
  Layers,
  Database,
  Lock,
} from "lucide-react";
import clsx from "clsx";

interface NavItem {
  href: string;
  label: string;
  icon: any;
  badge?: string;
  badgeColor?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "OPERATIONS",
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard },
      { href: "/orders", label: "Sales & Courier", icon: ShoppingBag, badge: "COD", badgeColor: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
      { href: "/inventory", label: "Catalog & Stock", icon: Package },
      { href: "/manufacturing", label: "Manufacturing", icon: Factory, badge: "WIP", badgeColor: "text-sky-400 bg-sky-500/10 border-sky-500/20" },
    ],
  },
  {
    title: "FINANCE & PARTNERS",
    items: [
      { href: "/finance", label: "Finance & Accounts", icon: Wallet, badge: "GL", badgeColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
      { href: "/partners", label: "Partner Accounts", icon: Users, badge: "20%", badgeColor: "text-afk-olive-accent bg-afk-olive/20 border-afk-olive" },
      { href: "/reports", label: "Reports & Drilldown", icon: BarChart3 },
    ],
  },
  {
    title: "MANAGEMENT",
    items: [
      { href: "/settings", label: "System & Backups", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-64 bg-afk-charcoal border-r border-afk-border h-screen sticky top-0 select-none shadow-xl">
      {/* Brand Header */}
      <div className="p-5 border-b border-afk-border/80 bg-gradient-to-b from-afk-surface/40 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-afk-olive to-afk-olive-dark flex items-center justify-center font-bold tracking-widest text-afk-offwhite border border-afk-olive-light shadow-md shadow-afk-olive/10 shrink-0">
            AFK
          </div>
          <div className="min-w-0">
            <h1 className="font-extrabold text-sm tracking-wider text-afk-offwhite uppercase truncate leading-tight">
              AFK THEORY
            </h1>
            <p className="text-[10px] uppercase font-mono tracking-widest text-afk-muted leading-tight mt-0.5">
              Clothing Co. · OS
            </p>
          </div>
        </div>

        {/* Local Deployment Status Pill */}
        <div className="mt-3 flex items-center justify-between px-2.5 py-1 rounded bg-afk-surface border border-afk-border/60 text-[10px]">
          <span className="flex items-center gap-1.5 text-afk-muted">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-medium text-emerald-400">100% Local</span>
          </span>
          <span className="font-mono text-afk-muted/80">Offline Safe</span>
        </div>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto scrollbar-thin scrollbar-thumb-afk-border">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="space-y-1">
            <h3 className="px-3 text-[10px] font-bold uppercase tracking-widest text-afk-muted/70 font-mono mb-2">
              {section.title}
            </h3>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      "group flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-all duration-150",
                      isActive
                        ? "bg-gradient-to-r from-afk-olive/30 via-afk-olive/15 to-transparent text-afk-offwhite font-semibold border-l-2 border-afk-olive-accent shadow-sm"
                        : "text-afk-muted hover:text-afk-offwhite hover:bg-afk-surface/60"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={clsx(
                          "w-4 h-4 shrink-0 transition-colors duration-150",
                          isActive
                            ? "text-afk-olive-accent"
                            : "text-afk-muted group-hover:text-afk-offwhite"
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={clsx(
                          "text-[9px] font-mono px-1.5 py-0.2 rounded border font-semibold",
                          item.badgeColor || "text-afk-muted bg-afk-surface border-afk-border"
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Infrastructure Card */}
      <div className="p-3.5 border-t border-afk-border bg-afk-surface/30 space-y-2">
        <div className="p-2.5 rounded bg-afk-surface/80 border border-afk-border/70 text-[11px] space-y-1.5 font-mono">
          <div className="flex items-center justify-between text-afk-muted text-[10px]">
            <span className="flex items-center gap-1.5">
              <Database className="w-3 h-3 text-afk-olive-accent" />
              <span>Database</span>
            </span>
            <span className="text-afk-offwhite font-semibold">PostgreSQL 16</span>
          </div>
          <div className="flex items-center justify-between text-afk-muted text-[10px]">
            <span className="flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-emerald-400" />
              <span>Backups</span>
            </span>
            <span className="text-emerald-400">AES-256-GCM</span>
          </div>
          <div className="flex items-center justify-between text-afk-muted text-[10px] pt-1 border-t border-afk-border/40">
            <span>Currency</span>
            <span className="text-afk-offwhite font-bold">BDT (৳)</span>
          </div>
        </div>

        <div className="flex items-center justify-between px-1 text-[10px] text-afk-muted/60 font-mono">
          <span>AFK Theory OS</span>
          <span>v1.0.0</span>
        </div>
      </div>
    </aside>
  );
}
