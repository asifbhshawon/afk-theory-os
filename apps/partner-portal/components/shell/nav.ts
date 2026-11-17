import {
  LayoutDashboard,
  ShoppingBag,
  Banknote,
  Wallet,
  Briefcase,
  Bell,
  Calendar,
  FileText,
  Settings,
} from "lucide-react";
import type { ComponentType } from "react";

export interface NavItem {
  href: string;
  label: string;
  /** Shorter label for the mobile tab bar. */
  shortLabel?: string;
  icon: ComponentType<{ className?: string }>;
  /** Shown as a tab in the mobile bottom bar (max 4; the rest go under "More"). */
  mobilePrimary?: boolean;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

/** Single source of truth for the sidebar, the mobile tab bar and its "More" sheet. */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Business",
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard, mobilePrimary: true },
      { href: "/sales", label: "Sales & Orders", shortLabel: "Sales", icon: ShoppingBag, mobilePrimary: true },
      { href: "/money", label: "Money & Cash Flow", shortLabel: "Money", icon: Banknote, mobilePrimary: true },
      { href: "/updates", label: "Business Updates", shortLabel: "Updates", icon: Bell },
    ],
  },
  {
    title: "Projects",
    items: [{ href: "/ventures", label: "Ventures", icon: Briefcase }],
  },
  {
    title: "My Space",
    items: [
      { href: "/my-investments", label: "My Investments", shortLabel: "Mine", icon: Wallet, mobilePrimary: true },
      { href: "/calendar", label: "Calendar & Notes", shortLabel: "Calendar", icon: Calendar },
      { href: "/reports", label: "Reports", icon: FileText },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = { href: "/settings", label: "Settings", icon: Settings };

export const ALL_NAV_ITEMS: NavItem[] = [...NAV_GROUPS.flatMap((g) => g.items), SETTINGS_ITEM];

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
