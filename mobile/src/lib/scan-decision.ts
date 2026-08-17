import * as Crypto from "expo-crypto";
import { decodeToken, isTokenExpired } from "./decode-token";
import { findByMappingId, isAlreadyUsedLocally, type RosterRow, type ScanQueueRow } from "./local-db";

export type ScanOutcome =
  | { kind: "VERIFIED"; roster: RosterRow }
  | { kind: "WRONG_HALL"; roster: RosterRow }
  | { kind: "ALREADY_USED"; roster: RosterRow; usedAt: string | null }
  | { kind: "NOT_FOUND" }
  | { kind: "EXPIRED" };

export type ScanDecision = { outcome: ScanOutcome; queueRow: ScanQueueRow };

function baseRow(params: {
  clientEventId: string;
  mappingId: string | null;
  token: string | null;
  isManual: boolean;
  status: ScanQueueRow["status"];
  note: string | null;
  verifiedAtIso: string;
  sessionExamId: string;
  sessionHallId: string;
}): ScanQueueRow {
  return {
    client_event_id: params.clientEventId,
    mapping_id: params.mappingId,
    token: params.token,
    is_manual: params.isManual ? 1 : 0,
    status: params.status,
    note: params.note,
    device_verified_at: params.verifiedAtIso,
    synced: 0,
    session_exam_id: params.sessionExamId,
    session_hall_id: params.sessionHallId,
  };
}

// Pure decision — does NOT write to the queue. The scanner/manual-search
// screens call enqueueScan() themselves once the invigilator actually
// confirms (or the auto-confirm timer fires), so a scan the invigilator
// dismisses without acting on it never gets recorded.
export function decideForToken(
  token: string,
  myHallId: string,
  sessionExamId: string,
  sessionHallId: string,
): ScanDecision {
  const now = new Date().toISOString();
  const clientEventId = Crypto.randomUUID();
  const decoded = decodeToken(token);

  if (!decoded) {
    return {
      outcome: { kind: "NOT_FOUND" },
      queueRow: baseRow({
        clientEventId,
        mappingId: null,
        token,
        isManual: false,
        status: "FLAGGED",
        note: "Unreadable barcode.",
        verifiedAtIso: now,
        sessionExamId,
        sessionHallId,
      }),
    };
  }

  if (isTokenExpired(decoded)) {
    return {
      outcome: { kind: "EXPIRED" },
      queueRow: baseRow({
        clientEventId,
        mappingId: decoded.mappingId,
        token,
        isManual: false,
        status: "FLAGGED",
        note: "Barcode expired before this device could read it.",
        verifiedAtIso: now,
        sessionExamId,
        sessionHallId,
      }),
    };
  }

  const roster = findByMappingId(decoded.mappingId);
  if (!roster || roster.exam_id !== sessionExamId) {
    return {
      outcome: { kind: "NOT_FOUND" },
      queueRow: baseRow({
        clientEventId,
        mappingId: decoded.mappingId,
        token,
        isManual: false,
        status: "FLAGGED",
        note: "Not found in this exam's roster.",
        verifiedAtIso: now,
        sessionExamId,
        sessionHallId,
      }),
    };
  }

  return decideForRoster(roster, myHallId, token, false, clientEventId, now, sessionExamId, sessionHallId);
}

export function decideForManual(
  roster: RosterRow,
  myHallId: string,
  sessionExamId: string,
  sessionHallId: string,
): ScanDecision {
  const now = new Date().toISOString();
  const clientEventId = Crypto.randomUUID();
  return decideForRoster(roster, myHallId, null, true, clientEventId, now, sessionExamId, sessionHallId);
}

function decideForRoster(
  roster: RosterRow,
  myHallId: string,
  token: string | null,
  isManual: boolean,
  clientEventId: string,
  verifiedAtIso: string,
  sessionExamId: string,
  sessionHallId: string,
): ScanDecision {
  if (roster.hall_id !== myHallId) {
    return {
      outcome: { kind: "WRONG_HALL", roster },
      queueRow: baseRow({
        clientEventId,
        mappingId: roster.mapping_id,
        token,
        isManual,
        status: "WRONG_HALL",
        note: null,
        verifiedAtIso,
        sessionExamId,
        sessionHallId,
      }),
    };
  }

  const used = isAlreadyUsedLocally(roster.mapping_id);
  if (used.used) {
    return {
      outcome: { kind: "ALREADY_USED", roster, usedAt: used.at },
      queueRow: baseRow({
        clientEventId,
        mappingId: roster.mapping_id,
        token,
        isManual,
        status: "FLAGGED",
        note: `Duplicate — already verified at ${used.at}.`,
        verifiedAtIso,
        sessionExamId,
        sessionHallId,
      }),
    };
  }

  return {
    outcome: { kind: "VERIFIED", roster },
    queueRow: baseRow({
      clientEventId,
      mappingId: roster.mapping_id,
      token,
      isManual,
      status: "VERIFIED",
      note: null,
      verifiedAtIso,
      sessionExamId,
      sessionHallId,
    }),
  };
}
