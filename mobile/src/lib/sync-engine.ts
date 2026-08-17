import NetInfo from "@react-native-community/netinfo";
import { getUnsyncedScans, markSynced, getPendingSyncCount } from "./local-db";
import { syncEvents } from "./api";

const BATCH_SIZE = 25;
const PERIODIC_INTERVAL_MS = 15_000;

let running = false;

// Drains the whole local backlog it can reach in one go (not just one
// batch) — after connectivity returns from an offline stretch there could
// be well over BATCH_SIZE queued scans, and waiting for further periodic
// ticks to clear them would leave "pending sync" visibly stuck for no
// reason.
export async function drainQueueOnce(): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const batch = getUnsyncedScans(BATCH_SIZE);
      if (batch.length === 0) break;

      const events = batch.map((row) => ({
        clientEventId: row.client_event_id,
        token: row.is_manual ? undefined : (row.token ?? undefined),
        manualMappingId: row.is_manual ? (row.mapping_id ?? undefined) : undefined,
        deviceVerifiedAt: row.device_verified_at,
      }));

      let acks;
      try {
        acks = await syncEvents(events);
      } catch {
        // Offline or the server's unreachable — stop for now, the next
        // connectivity event or periodic tick will retry the same rows.
        break;
      }

      markSynced(acks.map((a) => a.clientEventId));
      if (batch.length < BATCH_SIZE) break;
    }
  } finally {
    running = false;
  }
}

// Runs for the lifetime of the scanner session: drains on every
// connectivity-restored event plus a periodic fallback tick, so "12
// pending sync" never sits stale once the phone is back online.
export function startSyncEngine(onPendingCountChange: (count: number) => void): () => void {
  const tick = async () => {
    await drainQueueOnce();
    onPendingCountChange(getPendingSyncCount());
  };

  const netInfoUnsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected) tick();
  });

  const interval = setInterval(tick, PERIODIC_INTERVAL_MS);
  tick();

  return () => {
    netInfoUnsubscribe();
    clearInterval(interval);
  };
}
