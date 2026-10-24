"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Calendar,
  LayoutDashboard,
  Wallet,
  Users,
  Layers,
  BarChart3,
  Package,
  Factory,
  ShoppingBag,
  FileText,
  Settings,
  PlusCircle,
  X,
  ArrowRight,
} from "lucide-react";

interface CommandItem {
  id: string;
  title: string;
  subtitle: string;
  category: "Navigation" | "Quick Action" | "Finance";
  icon: any;
  href?: string;
  action?: () => void;
}

export function CommandPalette({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands: CommandItem[] = [
    {
      id: "nav-dash",
      title: "Dashboard",
      subtitle: "Overview of business position & liquid cash",
      category: "Navigation",
      icon: LayoutDashboard,
      href: "/",
    },
    {
      id: "nav-cal",
      title: "Calendar & Planner",
      subtitle: "Monthly planner, drops, meetings & tasks",
      category: "Navigation",
      icon: Calendar,
      href: "/calendar",
    },
    {
      id: "nav-orders",
      title: "Sales & Orders",
      subtitle: "Orders, customer delivery & courier COD",
      category: "Navigation",
      icon: ShoppingBag,
      href: "/orders",
    },
    {
      id: "nav-inventory",
      title: "Products & Inventory",
      subtitle: "Catalog styles, variants & stock lots",
      category: "Navigation",
      icon: Package,
      href: "/inventory",
    },
    {
      id: "nav-mfg",
      title: "Manufacturing",
      subtitle: "Factory production orders & batch WIP",
      category: "Navigation",
      icon: Factory,
      href: "/manufacturing",
    },
    {
      id: "nav-finance",
      title: "Money & Transactions",
      subtitle: "General ledger, expenses & transfers",
      category: "Navigation",
      icon: Wallet,
      href: "/finance",
    },
    {
      id: "nav-partners",
      title: "Partner Accounts",
      subtitle: "Capital accounts, drawings & loan statements",
      category: "Navigation",
      icon: Users,
      href: "/partners",
    },
    {
      id: "nav-ventures",
      title: "Ventures & Investments",
      subtitle: "Drop pools, partner agreements & waterfalls",
      category: "Navigation",
      icon: Layers,
      href: "/ventures",
    },
    {
      id: "nav-reports",
      title: "Financial Reports",
      subtitle: "Balance sheet, income statement & trial balance",
      category: "Navigation",
      icon: BarChart3,
      href: "/reports",
    },
    {
      id: "nav-docs",
      title: "Evidence & Documents",
      subtitle: "Universal receipts, slips & proof library",
      category: "Navigation",
      icon: FileText,
      href: "/documents",
    },
    {
      id: "nav-settings",
      title: "Backup & System Health",
      subtitle: "Database backups, integrity & recovery",
      category: "Navigation",
      icon: Settings,
      href: "/settings",
    },
    {
      id: "action-new-entry",
      title: "New Calendar Activity",
      subtitle: "Create event, note, task or deadline",
      category: "Quick Action",
      icon: PlusCircle,
      href: "/calendar?action=new",
    },
    {
      id: "action-new-expense",
      title: "Record Business Expense",
      subtitle: "Post quick business expense with receipt",
      category: "Quick Action",
      icon: Wallet,
      href: "/finance?action=new-expense",
    },
    {
      id: "action-new-order",
      title: "New Sales Order",
      subtitle: "Create COD or courier order",
      category: "Quick Action",
      icon: ShoppingBag,
      href: "/orders#new-order",
    },
  ];

  const filtered = commands.filter((cmd) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      cmd.title.toLowerCase().includes(q) ||
      cmd.subtitle.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen) return;

      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % (filtered.length || 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = filtered[selectedIndex];
        if (selected) {
          handleExecute(selected);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filtered, selectedIndex]);

  const handleExecute = (cmd: CommandItem) => {
    onClose();
    if (cmd.href) {
      router.push(cmd.href);
    } else if (cmd.action) {
      cmd.action();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-afk-card border border-afk-border rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-afk-border gap-3 bg-afk-surface/60">
          <Search className="w-5 h-5 text-afk-olive-light shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, page name, or action... (e.g. Calendar, Orders, Expense)"
            className="w-full bg-transparent border-0 text-afk-offwhite text-sm placeholder:text-afk-muted focus:outline-none focus:ring-0"
          />
          <button
            onClick={onClose}
            className="p-1 rounded text-afk-muted hover:text-afk-offwhite hover:bg-afk-elevated transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 divide-y divide-afk-border/40">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-afk-muted">
              No matching commands found.
            </div>
          ) : (
            filtered.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  onClick={() => handleExecute(cmd)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-afk-olive/20 text-afk-offwhite border border-afk-olive/40"
                      : "text-afk-secondary hover:bg-afk-surface/80 hover:text-afk-offwhite border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-lg ${
                        isSelected
                          ? "bg-afk-olive/30 text-afk-olive-accent"
                          : "bg-afk-surface text-afk-muted"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-afk-offwhite truncate">
                        {cmd.title}
                      </p>
                      <p className="text-xs text-afk-muted truncate">
                        {cmd.subtitle}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs px-2 py-0.5 rounded bg-afk-surface border border-afk-border text-afk-muted">
                      {cmd.category}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-afk-muted" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 border-t border-afk-border bg-afk-surface/40 flex items-center justify-between text-xs text-afk-muted">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-afk-surface border border-afk-border text-afk-secondary font-mono text-[11px]">
                ↑
              </kbd>{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-afk-surface border border-afk-border text-afk-secondary font-mono text-[11px]">
                ↓
              </kbd>{" "}
              Navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-afk-surface border border-afk-border text-afk-secondary font-mono text-[11px]">
                Enter
              </kbd>{" "}
              Open
            </span>
          </div>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-afk-surface border border-afk-border text-afk-secondary font-mono text-[11px]">
              ESC
            </kbd>{" "}
            Close
          </span>
        </div>
      </div>
    </div>
  );
}
