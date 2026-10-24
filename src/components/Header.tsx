import { getCurrentUser, logoutUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { HeaderClient } from "@/components/HeaderClient";

export async function Header() {
  const user = await getCurrentUser();

  const todayFormatted = new Date().toLocaleDateString("en-BD", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  async function handleLogout() {
    "use server";
    await logoutUser();
    redirect("/login");
  }

  return (
    <HeaderClient
      user={user}
      todayFormatted={todayFormatted}
      onLogout={handleLogout}
    />
  );
}
