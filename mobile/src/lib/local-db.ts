import * as SQLite from "expo-sqlite";

// Lazy, not module-top-level: expo-router resolves every route's module
// graph up front to build its route table, including (app)/_layout.tsx
// and everything it imports, regardless of whether the user has reached
// the login gate yet. Opening the database at import time would run this
// on app boot before auth even renders — harmless on native, but on web
// (alpha support, see docs.expo.dev/versions/latest/sdk/sqlite) it can
// throw before anything reaches the screen.
let dbInstance: SQLite.SQLiteDatabase | null = null;
function getDb(): SQLite.SQLiteDatabase {
  if (!dbInstance) {
    dbInstance = SQLite.openDatabaseSync("examguard.db");
  }
  return dbInstance;
}

export type RosterRow = {
  mapping_id: string;
  exam_id: string;
  roll_number: string;
  full_name: string;
  department: string;
  seat_number: string;
  photo_url: string | null;
  used_at: string | null;
  hall_id: string;
  hall_building_name: string;
  hall_room_number: string;
};

export type ScanStatus = "VERIFIED" | "WRONG_HALL" | "FLAGGED";

export type ScanQueueRow = {
  client_event_id: string;
  mapping_id: string | null;
  // Null for manual roll-number-search confirmations (no barcode was ever
  // scanned, so there's nothing to verify server-side beyond the
  // invigilator's own authenticated identity — see is_manual).
  token: string | null;
  is_manual: number;
  status: ScanStatus;
  note: string | null;
  device_verified_at: string;
  synced: number;
  // The exam/hall the invigilator was actively working under at scan time —
  // not derived from the mapping, since a WRONG_HALL or unrecognized scan
  // still needs to count toward *this* session's summary even though its
  // mapping (if any) belongs to a different hall or wasn't found at all.
  session_exam_id: string;
  session_hall_id: string;
};

let initialized = false;

// One-time schema setup. Safe to call repeatedly — every statement is
// idempotent (CREATE TABLE IF NOT EXISTS).
export function initLocalDb() {
  if (initialized) return;
  getDb().execSync(`
    CREATE TABLE IF NOT EXISTS roster (
      mapping_id TEXT PRIMARY KEY NOT NULL,
      exam_id TEXT NOT NULL,
      roll_number TEXT NOT NULL,
      full_name TEXT NOT NULL,
      department TEXT NOT NULL,
      seat_number TEXT NOT NULL,
      photo_url TEXT,
      used_at TEXT,
      hall_id TEXT NOT NULL,
      hall_building_name TEXT NOT NULL,
      hall_room_number TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_roster_exam ON roster(exam_id);
    CREATE INDEX IF NOT EXISTS idx_roster_roll ON roster(exam_id, roll_number);

    CREATE TABLE IF NOT EXISTS scan_queue (
      client_event_id TEXT PRIMARY KEY NOT NULL,
      mapping_id TEXT,
      token TEXT,
      is_manual INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      note TEXT,
      device_verified_at TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0,
      session_exam_id TEXT NOT NULL,
      session_hall_id TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_scan_queue_synced ON scan_queue(synced);
    CREATE INDEX IF NOT EXISTS idx_scan_queue_mapping ON scan_queue(mapping_id);
    CREATE INDEX IF NOT EXISTS idx_scan_queue_session ON scan_queue(session_exam_id, session_hall_id);
  `);
  initialized = true;
}

// Replaces the cached roster for one exam (every hall, not just this
// invigilator's — see the roster route's comment on why) — called on every
// pre-sync so a re-run always reflects the server's current mappings
// rather than accumulating stale rows.
export function replaceRosterForExam(examId: string, rows: RosterRow[]) {
  getDb().withTransactionSync(() => {
    getDb().runSync("DELETE FROM roster WHERE exam_id = ?", examId);
    for (const row of rows) {
      getDb().runSync(
        `INSERT INTO roster (mapping_id, exam_id, roll_number, full_name, department, seat_number, photo_url, used_at, hall_id, hall_building_name, hall_room_number)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row.mapping_id,
        row.exam_id,
        row.roll_number,
        row.full_name,
        row.department,
        row.seat_number,
        row.photo_url,
        row.used_at,
        row.hall_id,
        row.hall_building_name,
        row.hall_room_number,
      );
    }
  });
}

// Scoped to one hall — used for the pre-sync readiness count and manual
// search, both of which are "who am I expecting at my door."
export function getRosterForHall(examId: string, hallId: string): RosterRow[] {
  return getDb().getAllSync<RosterRow>(
    "SELECT * FROM roster WHERE exam_id = ? AND hall_id = ? ORDER BY roll_number",
    examId,
    hallId,
  );
}

export function getRosterCountForHall(examId: string, hallId: string): number {
  const row = getDb().getFirstSync<{ count: number }>(
    "SELECT COUNT(*) as count FROM roster WHERE exam_id = ? AND hall_id = ?",
    examId,
    hallId,
  );
  return row?.count ?? 0;
}

// Unscoped by hall — a scan can resolve to a mapping in a different hall,
// and we still need that row (for the wrong-hall redirect card).
export function findByMappingId(mappingId: string): RosterRow | null {
  return getDb().getFirstSync<RosterRow>("SELECT * FROM roster WHERE mapping_id = ?", mappingId);
}

export function searchByRollNumber(examId: string, hallId: string, query: string): RosterRow[] {
  return getDb().getAllSync<RosterRow>(
    "SELECT * FROM roster WHERE exam_id = ? AND hall_id = ? AND roll_number LIKE ? ORDER BY roll_number LIMIT 20",
    examId,
    hallId,
    `%${query}%`,
  );
}

// Local view of "has this mapping already been used" — combines the
// pre-synced snapshot (used_at from the server at pre-sync time) with any
// scans this device itself has queued since then (including ones not yet
// synced), so a second scan of the same student is caught immediately even
// fully offline.
export function isAlreadyUsedLocally(mappingId: string): { used: boolean; at: string | null } {
  const roster = findByMappingId(mappingId);
  if (roster?.used_at) return { used: true, at: roster.used_at };

  const verified = getDb().getFirstSync<{ device_verified_at: string }>(
    "SELECT device_verified_at FROM scan_queue WHERE mapping_id = ? AND status = 'VERIFIED' LIMIT 1",
    mappingId,
  );
  if (verified) return { used: true, at: verified.device_verified_at };

  return { used: false, at: null };
}

export function enqueueScan(row: ScanQueueRow) {
  getDb().runSync(
    `INSERT OR IGNORE INTO scan_queue (client_event_id, mapping_id, token, is_manual, status, note, device_verified_at, synced, session_exam_id, session_hall_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    row.client_event_id,
    row.mapping_id,
    row.token,
    row.is_manual,
    row.status,
    row.note,
    row.device_verified_at,
    row.synced,
    row.session_exam_id,
    row.session_hall_id,
  );

  // If this scan just claimed a mapping as VERIFIED, reflect that in the
  // roster cache too, so isAlreadyUsedLocally() and the summary counts stay
  // consistent without a re-query join.
  if (row.status === "VERIFIED" && row.mapping_id) {
    getDb().runSync("UPDATE roster SET used_at = ? WHERE mapping_id = ?", row.device_verified_at, row.mapping_id);
  }
}

export function getUnsyncedScans(limit = 25): ScanQueueRow[] {
  return getDb().getAllSync<ScanQueueRow>(
    "SELECT * FROM scan_queue WHERE synced = 0 ORDER BY device_verified_at LIMIT ?",
    limit,
  );
}

export function markSynced(clientEventIds: string[]) {
  if (clientEventIds.length === 0) return;
  getDb().withTransactionSync(() => {
    for (const id of clientEventIds) {
      getDb().runSync("UPDATE scan_queue SET synced = 1 WHERE client_event_id = ?", id);
    }
  });
}

export function getPendingSyncCount(): number {
  const row = getDb().getFirstSync<{ count: number }>("SELECT COUNT(*) as count FROM scan_queue WHERE synced = 0");
  return row?.count ?? 0;
}

export function getSessionSummary(
  examId: string,
  hallId: string,
): { verified: number; wrongHall: number; flagged: number } {
  const rows = getDb().getAllSync<{ status: ScanStatus }>(
    "SELECT status FROM scan_queue WHERE session_exam_id = ? AND session_hall_id = ?",
    examId,
    hallId,
  );
  let verified = 0;
  let wrongHall = 0;
  let flagged = 0;
  for (const row of rows) {
    if (row.status === "VERIFIED") verified++;
    else if (row.status === "WRONG_HALL") wrongHall++;
    else flagged++;
  }
  return { verified, wrongHall, flagged };
}
