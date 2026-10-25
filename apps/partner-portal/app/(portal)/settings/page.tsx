import { getCurrentPartner } from "@/lib/auth";
import { User, ShieldCheck, Key, Lock, Globe, Bell } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const partner = await getCurrentPartner();
  if (!partner) return null;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="pb-3 border-b border-afk-border">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-afk-offwhite flex items-center gap-2">
          <span>Partner Profile & Portal Settings</span>
        </h1>
        <p className="text-xs sm:text-sm text-afk-secondary mt-0.5">
          Manage your executive partner identity, venture access permissions and preferences
        </p>
      </div>

      {/* Partner Identity Card */}
      <div className="bg-afk-card p-6 rounded-xl border border-afk-border shadow-sm space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-afk-surface border-2 border-afk-border flex items-center justify-center text-xl font-bold text-afk-gold">
            {partner.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-lg font-bold text-afk-offwhite flex items-center gap-2">
              <span>{partner.name}</span>
              <span className="text-2xs px-2 py-0.5 rounded-full bg-afk-surface border border-afk-border text-afk-olive-accent font-semibold uppercase">
                {partner.role}
              </span>
            </h2>
            <p className="text-xs text-afk-secondary mt-0.5">{partner.email}</p>
            <p className="text-2xs text-afk-muted mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-afk-gold" />
              <span>Founding 20% Partnership Allocation</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-afk-border">
          <div className="p-3 rounded-lg bg-afk-surface border border-afk-border">
            <span className="text-2xs text-afk-muted uppercase tracking-wider block">
              Portal Partner ID
            </span>
            <span className="text-xs font-mono font-semibold text-afk-offwhite block mt-1">
              {partner.id}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-afk-surface border border-afk-border">
            <span className="text-2xs text-afk-muted uppercase tracking-wider block">
              Permitted Venture Authorizations
            </span>
            <span className="text-xs font-mono font-semibold text-afk-gold block mt-1">
              {partner.permittedVentureIds.join(", ") || "None"}
            </span>
          </div>
        </div>
      </div>

      {/* Security & Access Information */}
      <div className="bg-afk-card p-6 rounded-xl border border-afk-border shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-afk-offwhite flex items-center gap-2">
          <Key className="w-4 h-4 text-afk-gold" />
          <span>Security & Authentication Governance</span>
        </h3>
        <p className="text-xs text-afk-secondary leading-relaxed">
          The AFK THEORY Partner Portal utilizes cryptographically signed HTTP-only cookies and isolated cloud credentials. No local ERP password hashes or administrative database master keys are stored or exposed in this browser environment.
        </p>

        <div className="p-3 rounded-lg bg-afk-surface border border-afk-border text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-afk-secondary">Session Lifetime:</span>
            <span className="text-afk-offwhite font-mono">7 Days (Rolling)</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-afk-secondary">Session Encryption:</span>
            <span className="text-emerald-400 font-mono">Scrypt + Cryptographic Nonce</span>
          </div>
        </div>
      </div>
    </div>
  );
}
