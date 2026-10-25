"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";
import { INITIAL_FOUNDING_PARTNERS } from "@/lib/constants";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickSwitch = (p: typeof INITIAL_FOUNDING_PARTNERS[0]) => {
    setEmail(p.email);
    setPassword("");
  };

  return (
    <div className="min-h-screen bg-afk-black flex flex-col justify-center py-12 sm:px-6 lg:px-8 select-none">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-afk-surface border border-afk-border flex items-center justify-center font-bold text-xl tracking-widest text-afk-gold shadow-lg">
          AFK
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-afk-offwhite">
          AFK THEORY
        </h2>
        <p className="mt-1 text-xs uppercase tracking-widest text-afk-olive-accent font-semibold">
          Founding Partner Portal
        </p>
        <p className="mt-2 text-xs text-afk-secondary">
          Enter your authorized partner credentials to view executive financials & shared calendar
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-afk-card py-8 px-6 sm:px-8 border border-afk-border rounded-2xl shadow-xl space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-afk-danger/10 border border-afk-danger/30 text-afk-danger text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-afk-secondary mb-1">
                Partner Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-afk-muted" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. shawon@afktheory.com"
                  className="w-full bg-afk-input border border-afk-border rounded-lg pl-9 pr-3 py-2 text-sm text-afk-offwhite placeholder:text-afk-subtle focus:outline-none focus:border-afk-olive transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-afk-secondary">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-afk-muted" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-afk-input border border-afk-border rounded-lg pl-9 pr-3 py-2 text-sm text-afk-offwhite placeholder:text-afk-subtle focus:outline-none focus:border-afk-olive transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-afk-olive hover:bg-afk-olive-light text-afk-offwhite font-medium text-sm transition shadow-md disabled:opacity-50"
            >
              <span>{isLoading ? "Authenticating..." : "Sign In to Portal"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Access for the 5 Founding Partners */}
          <div className="pt-4 border-t border-afk-border">
            <p className="text-2xs font-semibold text-afk-muted uppercase tracking-wider mb-2.5 text-center">
              Quick Select Partner (Verified Founding Identities)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {INITIAL_FOUNDING_PARTNERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleQuickSwitch(p)}
                  className="p-2 rounded-lg bg-afk-surface hover:bg-afk-elevated border border-afk-border text-left transition group"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-afk-olive group-hover:bg-afk-gold transition"></span>
                    <span className="text-xs font-semibold text-afk-offwhite">
                      {p.name}
                    </span>
                  </div>
                  <span className="text-2xs text-afk-muted block mt-0.5 truncate">
                    {p.role}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-afk-muted flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-afk-olive" />
          <span>Server-Enforced RBAC • Independent Cloud Read Model</span>
        </div>
      </div>
    </div>
  );
}
