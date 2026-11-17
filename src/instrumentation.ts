// Runs once when the Next.js server starts (Node runtime only).
// Resumes any Partner Portal push that was pending when the app last stopped.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { resumePendingPortalSync } = await import("@/server/services/portal-autosync");
  await resumePendingPortalSync();
}
