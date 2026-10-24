"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  ShoppingBag,
  Wallet,
  Settings,
} from "lucide-react";
import clsx from "clsx";

const MOBILE_ITEMS = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/orders", label: "Orders", icon: ShoppingBag },
  { href: "/finance", label: "Finance", icon: Wallet },
  { href: "/settings", label: "System", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-afk-charcoal/95 backdrop-blur border-t border-afk-border flex items-center justify-around px-2 z-40 select-none">
      {MOBILE_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(item.href + "/");

        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "flex flex-col items-center justify-center min-w-[56px] h-12 rounded-lg transition-colors cursor-pointer",
              isActive
                ? "text-afk-offwhite font-medium"
                : "text-afk-muted hover:text-afk-offwhite"
            )}
          >
            <Icon
              className={clsx(
                "w-5 h-5",
                isActive ? "text-afk-olive-accent" : "text-afk-muted"
              )}
            />
            <span
              className={clsx(
                "text-xs mt-1 leading-tight",
                isActive ? "font-semibold text-afk-offwhite" : "text-afk-muted"
              )}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
