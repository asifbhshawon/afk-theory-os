"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { LogOut, MoreHorizontal, X } from "lucide-react";
import type { PortalPartner } from "@/lib/constants";
import { ALL_NAV_ITEMS, isActive } from "./nav";
import { useLogout } from "./useLogout";

/** Phone navigation: four primary tabs + a "More" sheet (hidden from `lg` up). */
export function MobileTabBar({ partner }: { partner: PortalPartner }) {
  const pathname = usePathname();
  const { logout, busy } = useLogout();
  const [open, setOpen] = useState(false);

  const primary = ALL_NAV_ITEMS.filter((i) => i.mobilePrimary).slice(0, 4);
  const more = ALL_NAV_ITEMS.filter((i) => !primary.includes(i));
  const moreActive = more.some((i) => isActive(pathname, i.href));

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {open && (
        <div className="no-print lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="More navigation">
          <button className="absolute inset-0 bg-black/70" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-afk-borderLight bg-afk-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="grid place-items-center w-9 h-9 rounded-full bg-afk-olive-dark border border-afk-olive/50 text-sm font-bold">
                  {partner.name.charAt(0)}
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-afk-offwhite">{partner.name}</p>
                  <p className="text-2xs text-afk-muted">{partner.role === "ADMIN" ? "Founding Admin" : "Founding Partner"}</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="p-2 text-afk-muted hover:text-afk-offwhite">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {more.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-medium transition",
                      active
                        ? "border-afk-olive/60 bg-afk-olive/20 text-afk-offwhite"
                        : "border-afk-border bg-afk-surface text-afk-secondary hover:text-afk-offwhite"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    {item.shortLabel ?? item.label}
                  </Link>
                );
              })}
              <button
                onClick={logout}
                disabled={busy}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-afk-border bg-afk-surface px-2 py-3 text-xs font-medium text-afk-danger hover:bg-afk-danger/10 transition disabled:opacity-50"
              >
                <LogOut className="w-5 h-5" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      <nav
        aria-label="Primary"
        className="no-print lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-afk-border bg-afk-charcoal/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="grid grid-cols-5">
          {primary.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "flex flex-col items-center gap-0.5 py-2 text-2xs font-medium transition",
                    active ? "text-afk-offwhite" : "text-afk-muted"
                  )}
                >
                  <span className={clsx("grid place-items-center h-7 w-12 rounded-full transition", active && "bg-afk-olive/25")}>
                    <Icon className={clsx("w-5 h-5", active && "text-afk-olive-accent")} />
                  </span>
                  {item.shortLabel ?? item.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              onClick={() => setOpen(true)}
              aria-expanded={open}
              className={clsx("w-full flex flex-col items-center gap-0.5 py-2 text-2xs font-medium", moreActive ? "text-afk-offwhite" : "text-afk-muted")}
            >
              <span className={clsx("grid place-items-center h-7 w-12 rounded-full", moreActive && "bg-afk-olive/25")}>
                <MoreHorizontal className={clsx("w-5 h-5", moreActive && "text-afk-olive-accent")} />
              </span>
              More
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
