"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Wallet,
  Settings,
} from "lucide-react";
import clsx from "clsx";

const MOBILE_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/orders", label: "Orders", icon: ShoppingBag },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/finance", label: "Finance", icon: Wallet },
  { href: "/settings", label: "More", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-afk-charcoal border-t border-afk-border flex items-center justify-around px-2 z-50">
      {MOBILE_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "flex flex-col items-center justify-center w-14 h-12 rounded-lg transition-colors",
              isActive
                ? "text-afk-offwhite font-medium"
                : "text-afk-muted hover:text-afk-offwhite"
            )}
          >
            <Icon className={clsx("w-5 h-5", isActive && "text-afk-olive-accent")} />
            <span className="text-[10px] mt-1">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
