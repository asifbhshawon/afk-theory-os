"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

export function useLogout() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const logout = useCallback(async () => {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Logout failed", err);
      setBusy(false);
    }
  }, [router]);

  return { logout, busy };
}
