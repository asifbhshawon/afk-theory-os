"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Plus, Calendar, User, ShieldCheck } from "lucide-react";
import { SyncStatusBadge } from "./SyncStatusBadge";
import { PortalPartner } from "@/lib/auth";

export function PortalHeader({ partner }: { partner: PortalPartner }) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  return (
    <header className="no-print sticky top-0 z-40 w-full border-b border-afk-border bg-afk-black/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand identity & Portal Title */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-afk-surface border border-afk-border flex items-center justify-center font-bold text-sm tracking-wider text-afk-gold group-hover:border-afk-olive transition">
              AFK
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-tight text-afk-offwhite text-sm">
                  AFK THEORY
                </span>
                <span className="text-2xs uppercase tracking-wider px-1.5 py-0.5 rounded bg-afk-olive/30 text-afk-olive-accent font-semibold">
                  Partner Portal
                </span>
              </div>
              <p className="text-2xs text-afk-muted hidden sm:block">
                Authoritative Cloud View for Founding Partners
              </p>
            </div>
          </Link>
        </div>

        {/* Center: Live Sync Status */}
        <div className="hidden md:flex items-center">
          <SyncStatusBadge />
        </div>

        {/* Right: Quick actions & Partner profile */}
        <div className="flex items-center gap-3">
          <Link
            href="/calendar?action=new"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-afk-olive hover:bg-afk-olive-light text-afk-offwhite text-xs font-medium rounded-lg transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Note</span>
          </Link>

          <div className="flex items-center gap-2 pl-2 border-l border-afk-border">
            <div className="flex flex-col text-right hidden sm:block">
              <span className="text-xs font-semibold text-afk-offwhite leading-tight">
                {partner.name}
              </span>
              <span className="text-2xs text-afk-secondary flex items-center justify-end gap-1">
                {partner.role === "ADMIN" && (
                  <ShieldCheck className="w-3 h-3 text-afk-gold" />
                )}
                {partner.role === "ADMIN" ? "Founding Admin" : "Founding Partner"}
              </span>
            </div>

            <div className="w-8 h-8 rounded-full bg-afk-surface border border-afk-border flex items-center justify-center text-xs font-bold text-afk-offwhite">
              {partner.name.charAt(0)}
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 rounded-lg text-afk-muted hover:text-afk-danger hover:bg-afk-surface transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
