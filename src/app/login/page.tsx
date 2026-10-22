import { redirect } from "next/navigation";
import { getCurrentUser, loginUser } from "@/lib/auth";
import { isSystemInitialized } from "@/server/services/setup";
import { Lock, Mail, ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    redirect("/");
  }

  const initialized = await isSystemInitialized();
  if (!initialized) {
    redirect("/setup");
  }

  const resolvedParams = await searchParams;
  const errorMessage = resolvedParams.error;
  const redirectTarget = resolvedParams.from || "/";

  async function handleLogin(formData: FormData) {
    "use server";
    const email = (formData.get("email") as string) || "";
    const password = (formData.get("password") as string) || "";
    const target = (formData.get("from") as string) || "/";

    if (!email || !password) {
      redirect(`/login?error=${encodeURIComponent("Please enter both email and password.")}&from=${encodeURIComponent(target)}`);
    }

    const result = await loginUser(email, password);
    if (!result.success) {
      redirect(`/login?error=${encodeURIComponent(result.error || "Authentication failed.")}&from=${encodeURIComponent(target)}`);
    }

    redirect(target);
  }

  return (
    <div className="min-h-screen bg-afk-black flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-afk-charcoal border border-afk-border rounded-xl p-8 shadow-2xl">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-afk-olive rounded-lg mx-auto flex items-center justify-center font-bold tracking-widest text-afk-offwhite border border-afk-olive-light mb-3 shadow-md">
            AFK
          </div>
          <h1 className="text-xl font-bold tracking-wider text-afk-offwhite">AFK THEORY</h1>
          <p className="text-xs text-afk-muted mt-1">Business OS · Secure Local Access</p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-6 p-3 bg-red-950/60 border border-red-800/80 rounded-lg flex items-center gap-2.5 text-xs text-red-200">
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form action={handleLogin} className="space-y-4">
          <input type="hidden" name="from" value={redirectTarget} />

          <div>
            <label className="block text-xs font-medium text-afk-muted mb-1.5">
              Partner Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-afk-muted absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="name@afktheory.local"
                className="w-full bg-afk-surface border border-afk-border rounded-lg pl-9 pr-3 py-2 text-xs text-afk-offwhite placeholder:text-afk-muted/60 focus:outline-none focus:border-afk-olive focus:ring-1 focus:ring-afk-olive transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-afk-muted mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-afk-muted absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
                placeholder="••••••••••••"
                className="w-full bg-afk-surface border border-afk-border rounded-lg pl-9 pr-3 py-2 text-xs text-afk-offwhite placeholder:text-afk-muted/60 focus:outline-none focus:border-afk-olive focus:ring-1 focus:ring-afk-olive transition"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-2 py-2.5 bg-afk-olive hover:bg-afk-olive-light text-afk-offwhite text-xs font-semibold rounded-lg transition shadow-sm cursor-pointer"
          >
            Sign In to Business OS
          </button>
        </form>

        {/* Security Note */}
        <div className="mt-8 pt-4 border-t border-afk-border/60 text-center">
          <p className="text-[11px] text-afk-muted leading-relaxed">
            Local-first private business system. Access is strictly logged and restricted to authorized founding partners.
          </p>
        </div>
      </div>
    </div>
  );
}
