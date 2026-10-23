import { redirect } from "next/navigation";
import { isSystemInitialized, initializeSystem } from "@/server/services/setup";
import { getCurrentUser, loginUser } from "@/lib/auth";
import { ShieldCheck, Users, Key, AlertCircle } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    redirect("/");
  }

  const initialized = await isSystemInitialized();
  const resolvedParams = await searchParams;
  const isSuccess = resolvedParams.success === "true";

  async function handleInitialize(formData: FormData) {
    "use server";
    const adminPassword = (formData.get("adminPassword") as string) || "";

    const passwords: Record<string, string> = {};
    if (adminPassword && adminPassword.length >= 8) {
      passwords["Shawon"] = adminPassword;
    }

    const res = await initializeSystem(passwords);

    // Auto-login admin if password was provided
    if (adminPassword) {
      await loginUser("shawon@afktheory.local", adminPassword);
      redirect("/");
    }

    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-afk-black flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-afk-charcoal border border-afk-border rounded-xl p-8 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-afk-olive rounded-lg mx-auto flex items-center justify-center font-bold tracking-widest text-afk-offwhite border border-afk-olive-light mb-3 shadow-md">
            AFK
          </div>
          <h1 className="text-xl font-bold tracking-wider text-afk-offwhite">AFK THEORY Business OS</h1>
          <p className="text-xs text-afk-muted mt-1">First-Run Administrator & Partner Provisioning</p>
        </div>

        {initialized ? (
          <div className="p-4 bg-afk-surface rounded-lg border border-afk-border text-center space-y-3">
            <ShieldCheck className="w-8 h-8 text-afk-success mx-auto" />
            <p className="text-xs text-afk-offwhite">
              System is already initialized with founding partner accounts and chart of accounts.
            </p>
            <Link
              href="/login"
              className="inline-block px-4 py-2 bg-afk-olive hover:bg-afk-olive-light text-afk-offwhite text-xs font-semibold rounded transition"
            >
              Go to Partner Login
            </Link>
          </div>
        ) : (
          <div>
            <div className="mb-6 p-4 bg-afk-surface rounded-lg border border-afk-border text-xs text-afk-muted space-y-2">
              <div className="flex items-center gap-2 font-semibold text-afk-offwhite">
                <Users className="w-4 h-4 text-afk-olive-accent" />
                <span>Founding Partnership Structure</span>
              </div>
              <p>
                Initializing will configure the double-entry chart of accounts, warehouse locations, and provision accounts for all 5 founding partners (Shawon, Rafi, Tousif, Midhat, Mueid) with 20.00% initial equity each.
              </p>
            </div>

            <form action={handleInitialize} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-afk-muted mb-1.5">
                  Set Administrator Password (Shawon)
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-afk-muted absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="password"
                    name="adminPassword"
                    required
                    minLength={8}
                    placeholder="Enter strong admin password (min 8 chars)"
                    className="w-full bg-afk-surface border border-afk-border rounded-lg pl-9 pr-3 py-2 text-xs text-afk-offwhite placeholder:text-afk-muted/60 focus:outline-none focus:border-afk-olive focus:ring-1 focus:ring-afk-olive transition"
                  />
                </div>
                <p className="text-[11px] text-afk-muted mt-1">
                  Remaining partners will receive individually generated random 16-character credentials.
                </p>
              </div>

              <button
                type="submit"
                className="w-full mt-3 py-2.5 bg-afk-olive hover:bg-afk-olive-light text-afk-offwhite text-xs font-semibold rounded-lg transition shadow-sm cursor-pointer"
              >
                Complete Provisioning & Launch OS
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
