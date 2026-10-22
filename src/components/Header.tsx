"use client";

import { usePathname } from "next/navigation";
import { ShieldCheck, Database, Calendar } from "lucide-react";

export function Header() {
  const pathname = usePathname();
  const today = new Date().toLocaleDateString("en-BD", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <header className="h-16 border-b border-afk-border bg-afk-charcoal/80 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <span className="text-xs uppercase tracking-widest text-afk-muted font-mono">
          AFK THEORY
        </span>
        <span className="text-afk-border text-sm">/</span>
        <span className="text-sm font-medium text-afk-offwhite capitalize">
          {pathname === "/" ? "Executive Dashboard" : pathname.replace("/", "").replace("-", " ")}
        </span>
      </div>

      <div className="flex items-center gap-4 text-xs">
        {/* Date display */}
        <div className="hidden sm:flex items-center gap-1.5 text-afk-muted bg-afk-surface px-2.5 py-1.5 rounded border border-afk-border">
          <Calendar className="w-3.5 h-3.5" />
          <span>{today}</span>
        </div>

        {/* Database Status indicator */}
        <div className="flex items-center gap-1.5 text-afk-success bg-afk-olive-dark/40 px-2.5 py-1.5 rounded border border-afk-olive/40 font-mono">
          <Database className="w-3.5 h-3.5" />
          <span>PostgreSQL Active</span>
        </div>

        {/* Active Partner User Badge */}
        <div className="flex items-center gap-2 pl-2 border-l border-afk-border">
          <div className="w-7 h-7 rounded-full bg-afk-surfaceLight border border-afk-border flex items-center justify-center font-bold text-xs text-afk-offwhite">
            S
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-medium text-afk-offwhite leading-tight">Shawon</p>
            <p className="text-[10px] text-afk-muted leading-tight">Admin & Partner</p>
          </div>
        </div>
      </div>
    </header>
  );
}
