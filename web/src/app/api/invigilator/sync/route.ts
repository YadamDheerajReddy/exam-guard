import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireInvigilator, UnauthorizedError, type InvigilatorContext } from "@/lib/invigilator-context";
import { verifyDisplayToken } from "@/lib/barcode-token";

type IncomingEvent = {
  clientEventId: string;
  // Exactly one of these two is expected: token for a real camera scan,
  // manualMappingId for the roll-number-search fallback (no barcode was
  // ever read, so there's nothing to cryptographically verify — the
  // invigilator's own authenticated session is the only proof we have).
  token?: string;
  manualMappingId?: string;
  deviceVerifiedAt: string;
};

type EventAck = {
  clientEventId: string;
  status: "VERIFIED" | "WRONG_HALL" | "FLAGGED";
  mappingId: string | null;
  note?: string;
};

type Service = ReturnType<typeof createAdminClient>;

async function recordDecision(
  service: Service,
  invigilator: InvigilatorContext,
  event: IncomingEvent,
  mappingId: string,
  note: string | undefined,
): Promise<EventAck> {
  const { data: mapping } = await service
    .from("student_exam_mappings")
    .select("id, hall_id, used_at")
    .eq("id", mappingId)
    .maybeSingle();

  if (!mapping) {
    await service.from("verification_logs").insert({
      mapping_id: null,
      invigilator_id: invigilator.id,
      client_event_id: event.clientEventId,
      verified_at: event.deviceVerifiedAt,
      status: "FLAGGED",
      notes: [note, `Mapping ${mappingId} not found.`].filter(Boolean).join(" "),
    });
    return { clientEventId: event.clientEventId, status: "FLAGGED", mappingId: null, note: "Mapping not found." };
  }

  if (mapping.hall_id !== invigilator.assignedHallId) {
    await service.from("verification_logs").insert({
      mapping_id: mapping.id,
      invigilator_id: invigilator.id,
      client_event_id: event.clientEventId,
      verified_at: event.deviceVerifiedAt,
      status: "WRONG_HALL",
      notes: note ?? null,
    });
    return { clientEventId: event.clientEventId, status: "WRONG_HALL", mappingId: mapping.id };
  }

  if (mapping.used_at) {
    const detail = `Duplicate scan — already verified at ${mapping.used_at}.`;
    await service.from("verification_logs").insert({
      mapping_id: mapping.id,
      invigilator_id: invigilator.id,
      client_event_id: event.clientEventId,
      verified_at: event.deviceVerifiedAt,
      status: "FLAGGED",
      notes: [note, detail].filter(Boolean).join(" "),
    });
    return { clientEventId: event.clientEventId, status: "FLAGGED", mappingId: mapping.id, note: detail };
  }

  // Conditional on used_at still being null — the DB, not application
  // logic, decides who wins a race between two syncs for the same mapping
  // (SYNC_CONFLICT in the App Flow doc's state machine). The loser falls
  // through to the duplicate branch above on its own event's turn through
  // this same loop, since it'll see used_at already set by the winner.
  const { data: claimed } = await service
    .from("student_exam_mappings")
    .update({ used_at: event.deviceVerifiedAt })
    .eq("id", mapping.id)
    .is("used_at", null)
    .select("id")
    .maybeSingle();

  if (!claimed) {
    const detail = "Duplicate scan — lost the race to another sync.";
    await service.from("verification_logs").insert({
      mapping_id: mapping.id,
      invigilator_id: invigilator.id,
      client_event_id: event.clientEventId,
      verified_at: event.deviceVerifiedAt,
      status: "FLAGGED",
      notes: [note, detail].filter(Boolean).join(" "),
    });
    return { clientEventId: event.clientEventId, status: "FLAGGED", mappingId: mapping.id, note: "Already verified elsewhere." };
  }

  await service.from("verification_logs").insert({
    mapping_id: mapping.id,
    invigilator_id: invigilator.id,
    client_event_id: event.clientEventId,
    verified_at: event.deviceVerifiedAt,
    status: "VERIFIED",
    notes: note ?? null,
  });
  return { clientEventId: event.clientEventId, status: "VERIFIED", mappingId: mapping.id };
}

// The phone only decodes a scanned token locally (see mobile
// src/lib/decode-token.ts) — it never holds BARCODE_TOKEN_SECRET, so it
// can't verify a signature or safely claim used_at. This endpoint is the
// one place a scan actually becomes authoritative: re-verify the token
// server-side, decide VERIFIED/WRONG_HALL/FLAGGED for real, and record it.
//
// verification_logs is append-only (Backend Schema §4) — every branch
// inserts a new row, never updates or deletes an earlier one. Idempotency
// comes from the unique constraint on client_event_id, so a device that
// retries a sync after a dropped connection can't create duplicate rows.
export async function POST(request: Request) {
  let invigilator: InvigilatorContext;
  try {
    invigilator = await requireInvigilator(request);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }

  if (!invigilator.assignedHallId) {
    return NextResponse.json({ error: "No hall assigned." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const events = Array.isArray(body?.events) ? (body.events as IncomingEvent[]) : null;
  if (!events || events.length === 0) {
    return NextResponse.json({ error: "events array is required." }, { status: 400 });
  }

  const service = createAdminClient();
  const acks: EventAck[] = [];

  for (const event of events) {
    if (!event?.clientEventId || !event.deviceVerifiedAt || (!event.token && !event.manualMappingId)) {
      acks.push({ clientEventId: event?.clientEventId ?? "unknown", status: "FLAGGED", mappingId: null, note: "Malformed event." });
      continue;
    }

    const { data: existing } = await service
      .from("verification_logs")
      .select("mapping_id, status")
      .eq("client_event_id", event.clientEventId)
      .maybeSingle();
    if (existing) {
      acks.push({ clientEventId: event.clientEventId, status: existing.status as EventAck["status"], mappingId: existing.mapping_id });
      continue;
    }

    if (event.manualMappingId) {
      acks.push(
        await recordDecision(service, invigilator, event, event.manualMappingId, "Manual roll-number search — no barcode scanned."),
      );
      continue;
    }

    const verified = await verifyDisplayToken(event.token!);
    if (!verified.ok) {
      await service.from("verification_logs").insert({
        mapping_id: null,
        invigilator_id: invigilator.id,
        client_event_id: event.clientEventId,
        verified_at: event.deviceVerifiedAt,
        status: "FLAGGED",
        notes: `Invalid scan: token ${verified.reason}.`,
      });
      acks.push({ clientEventId: event.clientEventId, status: "FLAGGED", mappingId: null, note: `Token ${verified.reason}.` });
      continue;
    }

    acks.push(await recordDecision(service, invigilator, event, verified.payload.mappingId, undefined));
  }

  return NextResponse.json({ acks });
}
