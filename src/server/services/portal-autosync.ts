import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { CloudSyncResult } from "./cloud-sync";

// =============================================================================
// Automatic push to the Partner Portal.
//
// Any business event (journal posted, order created/shipped/cancelled, calendar
// note changed) calls schedulePortalSync(). Changes are debounced so a burst of
// activity becomes one push, only one push runs at a time, failures retry with
// backoff, and a "dirty" flag is persisted so a restart (or an offline spell)
// still ends with the cloud catching up.
//
// Never throws and never blocks the caller. Disabled under tests, when
// PORTAL_AUTOSYNC=false, or when no cloud database is configured.
// =============================================================================

const STATE_KEY = "PORTAL_SYNC_STATE";
const DEBOUNCE_MS = 10_000;
const MAX_WAIT_MS = 60_000;
const RETRY_BASE_MS = 30_000;
const RETRY_MAX_MS = 10 * 60_000;
const WATCHDOG_MS = 10 * 60_000;

export interface PortalSyncState {
  dirty: boolean;
  dirtySince: string | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  failures: number;
}

interface Runtime {
  timer: ReturnType<typeof setTimeout> | null;
  watchdog: ReturnType<typeof setInterval> | null;
  firstScheduledAt: number | null;
  nextRunAt: number | null;
  running: boolean;
  runAgain: boolean;
  state: PortalSyncState;
  loaded: boolean;
}

const g = globalThis as unknown as { __afkPortalAutoSync?: Runtime };
const rt: Runtime = (g.__afkPortalAutoSync ??= {
  timer: null,
  watchdog: null,
  firstScheduledAt: null,
  nextRunAt: null,
  running: false,
  runAgain: false,
  loaded: false,
  state: { dirty: false, dirtySince: null, lastAttemptAt: null, lastSuccessAt: null, lastError: null, failures: 0 },
});

export function isAutoSyncEnabled(): boolean {
  if (process.env.VITEST || process.env.NODE_ENV === "test") return false;
  if (process.env.PORTAL_AUTOSYNC === "false") return false;
  return !!(process.env.SUPABASE_DATABASE_URL || process.env.SUPABASE_BACKUP_URL);
}

async function persist(patch: Partial<PortalSyncState>) {
  rt.state = { ...rt.state, ...patch };
  try {
    await db
      .insert(settings)
      .values({ key: STATE_KEY, value: rt.state, description: "Partner Portal auto-sync state" })
      .onConflictDoUpdate({ target: settings.key, set: { value: rt.state, updatedAt: new Date() } });
  } catch {
    /* state persistence is best-effort */
  }
}

async function loadState() {
  if (rt.loaded) return;
  rt.loaded = true;
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, STATE_KEY)).limit(1);
    if (row?.value) rt.state = { ...rt.state, ...(row.value as Partial<PortalSyncState>) };
  } catch {
    /* ignore */
  }
}

function arm(delayMs: number) {
  if (rt.timer) clearTimeout(rt.timer);
  rt.nextRunAt = Date.now() + delayMs;
  rt.timer = setTimeout(() => void run(), delayMs);
  rt.timer.unref?.();
}

/** Call after any change the partners should see. Cheap, synchronous, never throws. */
export function schedulePortalSync(reason: string = "change"): void {
  try {
    if (!isAutoSyncEnabled()) return;

    if (rt.running) {
      rt.runAgain = true; // changes landed mid-push: go once more afterwards
      return;
    }

    const now = Date.now();
    rt.firstScheduledAt ??= now;
    const waitLeft = Math.max(0, MAX_WAIT_MS - (now - rt.firstScheduledAt));
    arm(Math.min(DEBOUNCE_MS, waitLeft));

    if (!rt.state.dirty) {
      void persist({ dirty: true, dirtySince: new Date().toISOString() });
    }
    ensureWatchdog();
  } catch {
    /* never break the business transaction */
  }
}

/** One push attempt with state bookkeeping. Throws on failure (after recording it). */
async function execute(): Promise<CloudSyncResult> {
  rt.running = true;
  rt.timer = null;
  rt.nextRunAt = null;
  rt.firstScheduledAt = null;
  rt.runAgain = false;
  await persist({ lastAttemptAt: new Date().toISOString() });

  try {
    const { syncLocalErpToCloud } = await import("./cloud-sync"); // dynamic: avoids an import cycle with finance
    const result = await syncLocalErpToCloud();
    await persist({
      dirty: rt.runAgain,
      dirtySince: rt.runAgain ? new Date().toISOString() : null,
      lastSuccessAt: new Date().toISOString(),
      lastError: null,
      failures: 0,
    });
    return result;
  } catch (err: any) {
    const failures = rt.state.failures + 1;
    await persist({ dirty: true, lastError: String(err?.message ?? err).slice(0, 300), failures });
    arm(Math.min(RETRY_BASE_MS * 2 ** (failures - 1), RETRY_MAX_MS));
    throw err;
  } finally {
    rt.running = false;
    if (rt.runAgain && rt.state.failures === 0) schedulePortalSync("queued-during-sync");
  }
}

async function run() {
  if (rt.running) return;
  try {
    await execute();
  } catch {
    /* already recorded + retry armed */
  }
}

/** Manual "Sync now" — same bookkeeping as the automatic path, result returned to the caller. */
export async function syncPortalNow(): Promise<CloudSyncResult> {
  if (rt.running) throw new Error("A sync is already running — give it a few seconds.");
  await loadState();
  return execute();
}

function ensureWatchdog() {
  if (rt.watchdog) return;
  rt.watchdog = setInterval(() => {
    if (rt.state.dirty && !rt.running && !rt.timer) arm(1_000);
  }, WATCHDOG_MS);
  rt.watchdog.unref?.();
}

/** Called once at server start: if changes were pending when we stopped, push them. */
export async function resumePendingPortalSync(): Promise<void> {
  if (!isAutoSyncEnabled()) return;
  await loadState();
  ensureWatchdog();
  if (rt.state.dirty && !rt.timer && !rt.running) arm(15_000);
}

export async function getAutoSyncState() {
  await loadState();
  return {
    enabled: isAutoSyncEnabled(),
    running: rt.running,
    dirty: rt.state.dirty || rt.running || !!rt.timer,
    lastSuccessAt: rt.state.lastSuccessAt,
    lastAttemptAt: rt.state.lastAttemptAt,
    lastError: rt.state.lastError,
    failures: rt.state.failures,
    nextRunAt: rt.nextRunAt ? new Date(rt.nextRunAt).toISOString() : null,
  };
}
