"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  Search,
  PlusCircle,
  LogOut,
  ChevronDown,
  Wallet,
  ShoppingBag,
  Layers,
  FileText,
  User,
} from "lucide-react";
import { CommandPalette } from "@/components/CommandPalette";

interface HeaderClientProps {
  user: {
    id: string;
    name: string;
    email: string;
    roles: string[];
    isAdmin: boolean;
  } | null;
  todayFormatted: string;
  onLogout: () => Promise<void>;
}

const ROUTE_TITLES: { [prefix: string]: { section: string; title: string } } = {
  "/calendar": { section: "Home", title: "Calendar & Planner" },
  "/orders": { section: "Operations", title: "Sales & Orders" },
  "/inventory": { section: "Operations", title: "Products & Inventory" },
  "/manufacturing": { section: "Operations", title: "Manufacturing Production" },
  "/documents": { section: "Operations", title: "Evidence & Document Library" },
  "/finance": { section: "Finance", title: "Money & Accounts" },
  "/partners": { section: "Finance", title: "Founding Partners & Governance" },
  "/ventures": { section: "Finance", title: "Ventures & Investments" },
  "/reports": { section: "Finance", title: "Financial Reports & Statements" },
  "/studio": { section: "System", title: "Customisation Studio" },
  "/settings": { section: "System", title: "Backup & System Health" },
};

export function HeaderClient({ user, todayFormatted, onLogout }: HeaderClientProps) {
  const pathname = usePathname();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Derive route title
  let currentInfo = { section: "Home", title: "Dashboard" };
  for (const [prefix, info] of Object.entries(ROUTE_TITLES)) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      currentInfo = info;
      break;
    }
  }

  const primaryRole = user?.isAdmin
    ? "Administrator"
    : user?.roles[0]?.replace("_", " ") || "Partner";

  const initial = user?.name ? user.name[0].toUpperCase() : "A";

  return (
    <>
      <header className="h-16 border-b border-afk-border bg-afk-charcoal/90 backdrop-blur px-4 md:px-6 flex items-center justify-between sticky top-0 z-30 select-none">
        {/* Left: Breadcrumbs & Page Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xs uppercase tracking-wider text-afk-muted font-medium hidden sm:inline">
            {currentInfo.section}
          </span>
          <span className="text-afk-border text-xs hidden sm:inline">/</span>
          <h2 className="text-sm md:text-base font-semibold text-afk-offwhite truncate">
            {currentInfo.title}
          </h2>
        </div>

        {/* Right: Actions, Search, Calendar, User Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Search / Command palette trigger */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-afk-surface hover:bg-afk-elevated border border-afk-border text-afk-muted hover:text-afk-offwhite text-xs transition cursor-pointer"
            title="Search & Commands (Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5 text-afk-olive-light" />
            <span className="hidden lg:inline text-afk-secondary">Search or jump to...</span>
            <kbd className="hidden sm:inline px-1 py-0.2 rounded bg-afk-charcoal border border-afk-border font-mono text-[10px] text-afk-muted">
              Ctrl K
            </kbd>
          </button>

          {/* Clickable Calendar Today shortcut */}
          <Link
            href="/calendar"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-afk-surface hover:bg-afk-olive/15 hover:border-afk-olive/40 border border-afk-border text-afk-secondary hover:text-afk-offwhite text-xs font-medium transition cursor-pointer"
            title="Open Calendar & Planner"
          >
            <Calendar className="w-4 h-4 text-afk-olive-accent" />
            <span className="hidden sm:inline">{todayFormatted}</span>
          </Link>

          {/* Quick Add Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setIsQuickAddOpen(!isQuickAddOpen);
                setIsProfileOpen(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-afk-olive hover:bg-afk-olive-light text-afk-offwhite rounded-lg text-xs font-semibold transition shadow-sm cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">New</span>
              <ChevronDown className="w-3 h-3 opacity-80" />
            </button>

            {isQuickAddOpen && (
              <div
                className="absolute right-0 mt-2 w-56 bg-afk-card border border-afk-border rounded-xl shadow-2xl py-1 z-50 animate-in fade-in duration-100"
                onClick={() => setIsQuickAddOpen(false)}
              >
                <Link
                  href="/calendar?action=new"
                  className="flex items-center gap-2.5 px-3 py-2 text-xs text-afk-offwhite hover:bg-afk-surface transition"
                >
                  <Calendar className="w-4 h-4 text-afk-olive-accent" />
                  <span>Calendar Activity / Note</span>
                </Link>
                <Link
                  href="/finance?action=new-expense"
                  className="flex items-center gap-2.5 px-3 py-2 text-xs text-afk-offwhite hover:bg-afk-surface transition"
                >
                  <Wallet className="w-4 h-4 text-afk-gold" />
                  <span>Business Expense</span>
                </Link>
                <Link
                  href="/orders#new-order"
                  className="flex items-center gap-2.5 px-3 py-2 text-xs text-afk-offwhite hover:bg-afk-surface transition"
                >
                  <ShoppingBag className="w-4 h-4 text-emerald-400" />
                  <span>Sales Order (COD / Courier)</span>
                </Link>
                <Link
                  href="/ventures/new"
                  className="flex items-center gap-2.5 px-3 py-2 text-xs text-afk-offwhite hover:bg-afk-surface transition"
                >
                  <Layers className="w-4 h-4 text-sky-400" />
                  <span>New Venture / Drop Pool</span>
                </Link>
              </div>
            )}
          </div>

          {/* User Profile & Logout */}
          {user ? (
            <div className="relative pl-1 sm:pl-2 border-l border-afk-border">
              <button
                onClick={() => {
                  setIsProfileOpen(!isProfileOpen);
                  setIsQuickAddOpen(false);
                }}
                className="flex items-center gap-2 p-1 rounded-lg hover:bg-afk-surface transition cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-afk-olive text-afk-offwhite border border-afk-olive-light/50 flex items-center justify-center font-bold text-xs shadow-sm">
                  {initial}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-xs font-semibold text-afk-offwhite leading-tight truncate max-w-[120px]">
                    {user.name}
                  </p>
                  <p className="text-[11px] text-afk-muted leading-tight capitalize">
                    {primaryRole}
                  </p>
                </div>
              </button>

              {isProfileOpen && (
                <div
                  className="absolute right-0 mt-2 w-52 bg-afk-card border border-afk-border rounded-xl shadow-2xl p-2 z-50 animate-in fade-in duration-100"
                  onClick={() => setIsProfileOpen(false)}
                >
                  <div className="px-3 py-2 border-b border-afk-border/60 mb-1">
                    <p className="text-xs font-semibold text-afk-offwhite truncate">
                      {user.name}
                    </p>
                    <p className="text-[11px] text-afk-muted truncate mt-0.5">
                      {user.email}
                    </p>
                  </div>
                  <Link
                    href="/settings"
                    className="flex items-center gap-2 px-3 py-2 text-xs text-afk-secondary hover:text-afk-offwhite hover:bg-afk-surface rounded-lg transition"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>System & Backups</span>
                  </Link>
                  <button
                    onClick={async () => {
                      await onLogout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition mt-1 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="px-3.5 py-1.5 bg-afk-olive hover:bg-afk-olive-light text-afk-offwhite rounded-lg text-xs font-semibold transition shadow-sm"
            >
              Sign In
            </Link>
          )}
        </div>
      </header>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </>
  );
}
