"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  Wallet,
  Users,
  Package,
  Factory,
  ShoppingBag,
  BarChart3,
  FileText,
  Settings,
  CircleDot,
  Layers,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import clsx from "clsx";

interface NavItem {
  href: string;
  label: string;
  icon: any;
  exact?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "HOME",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/calendar", label: "Calendar & Planner", icon: Calendar },
    ],
  },
  {
    title: "OPERATIONS",
    items: [
      { href: "/orders", label: "Sales & Orders", icon: ShoppingBag },
      { href: "/inventory", label: "Products & Inventory", icon: Package },
      { href: "/manufacturing", label: "Manufacturing", icon: Factory },
      { href: "/documents", label: "Evidence & Documents", icon: FileText },
    ],
  },
  {
    title: "FINANCE",
    items: [
      { href: "/finance", label: "Money & Transactions", icon: Wallet },
      { href: "/partners", label: "Partner Accounts", icon: Users },
      { href: "/ventures", label: "Ventures & Investments", icon: Layers },
      { href: "/reports", label: "Financial Reports", icon: BarChart3 },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      { href: "/studio", label: "Customisation Studio", icon: CircleDot },
      { href: "/settings", label: "Backup & System Health", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("afk_sidebar_collapsed");
    if (saved !== null) {
      setIsCollapsed(saved === "true");
    }
  }, []);

  const toggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem("afk_sidebar_collapsed", String(next));
  };

  return (
    <aside
      className={clsx(
        "hidden md:flex flex-col bg-afk-charcoal border-r border-afk-border h-screen sticky top-0 select-none shadow-lg transition-all duration-200 z-20",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Brand Header */}
      <div className="p-4 border-b border-afk-border flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 min-w-0 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-afk-olive to-afk-olive-dark flex items-center justify-center font-bold tracking-wider text-afk-offwhite border border-afk-olive-light/40 shadow-sm shrink-0 transition-transform group-hover:scale-105">
            AFK
          </div>
          {!isCollapsed && (
            <div className="min-w-0 animate-in fade-in duration-150">
              <h1 className="font-bold text-base tracking-wide text-afk-offwhite leading-tight truncate">
                AFK THEORY
              </h1>
              <p className="text-xs text-afk-muted leading-tight mt-0.5">
                Business OS
              </p>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto scrollbar-thin">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="space-y-1">
            {!isCollapsed && (
              <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-afk-muted/80 mb-2">
                {section.title}
              </h3>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(item.href + "/");

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={isCollapsed ? item.label : undefined}
                    className={clsx(
                      "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 relative",
                      isActive
                        ? "bg-afk-surface text-afk-offwhite font-semibold shadow-sm border border-afk-border"
                        : "text-afk-secondary hover:text-afk-offwhite hover:bg-afk-surface/60"
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-afk-olive-light rounded-r" />
                    )}

                    <Icon
                      className={clsx(
                        "w-5 h-5 shrink-0 transition-colors",
                        isActive
                          ? "text-afk-olive-accent"
                          : "text-afk-muted group-hover:text-afk-offwhite"
                      )}
                    />

                    {!isCollapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer & Collapse Toggle */}
      <div className="p-3 border-t border-afk-border flex items-center justify-between bg-afk-surface/30">
        {!isCollapsed && (
          <div className="text-xs text-afk-muted pl-2">
            <span>AFK Theory OS</span>
          </div>
        )}

        <button
          onClick={toggleCollapse}
          title={isCollapsed ? "Expand Sidebar (Ctrl+[)" : "Collapse Sidebar"}
          className={clsx(
            "p-2 rounded-lg text-afk-muted hover:text-afk-offwhite hover:bg-afk-surface transition",
            isCollapsed && "mx-auto"
          )}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
