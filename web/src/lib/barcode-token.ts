import "server-only";
import { SignJWT, jwtVerify, errors as joseErrors } from "jose";

// Signs the base token stored in student_exam_mappings.barcode_token (TRD
// §5, §7). This is distinct from the rotating short-lived display token the
// student portal will re-request every 60-120s (Phase 2) — this one just
// needs to stay valid for the life of the exam mapping.
function getSecretKey() {
  const secret = process.env.BARCODE_TOKEN_SECRET;
  if (!secret) throw new Error("BARCODE_TOKEN_SECRET is not set.");
  return new TextEncoder().encode(secret);
}

export async function signBarcodeToken(params: {
  mappingId: string;
  examId: string;
  expiresAt: Date;
}) {
  return new SignJWT({ mapping_id: params.mappingId, exam_id: params.examId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(params.expiresAt.getTime() / 1000))
    .sign(getSecretKey());
}

// TRD §5.2: the student portal re-requests a fresh, short-lived display
// token every 60-120s so a static screenshot expires quickly. Distinct
// from the base barcode_token above — this one is never persisted, just
// signed fresh on each pass fetch and verified by signature+expiry alone.
const ROTATING_TOKEN_TTL_SECONDS = 90;

export async function signRotatingDisplayToken(params: { mappingId: string; examId: string }) {
  const expiresAt = new Date(Date.now() + ROTATING_TOKEN_TTL_SECONDS * 1000);
  return {
    token: await new SignJWT({ mapping_id: params.mappingId, exam_id: params.examId, kind: "display" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(getSecretKey()),
    expiresAt,
  };
}

// School students typically have no phone to hold a rotating code steady
// at the door, so their pass is a single QR meant to be printed on paper
// instead. It carries `kind: "display"` — the same claim
// verifyDisplayToken() checks below — so it goes through the exact same
// server-side verification path as the rotating code; the only difference
// is the caller supplies a long expiry (through the exam window, matching
// the base barcode_token's own convention) instead of the fixed 90s TTL.
export async function signStaticDisplayToken(params: { mappingId: string; examId: string; expiresAt: Date }) {
  return new SignJWT({ mapping_id: params.mappingId, exam_id: params.examId, kind: "display" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(params.expiresAt.getTime() / 1000))
    .sign(getSecretKey());
}

export type DisplayTokenPayload = { mappingId: string; examId: string };
export type VerifyDisplayTokenResult =
  | { ok: true; payload: DisplayTokenPayload }
  | { ok: false; reason: "expired" | "invalid" };

// Authoritative check for a scanned barcode — the invigilator app only
// decodes the token locally (no secret on-device, see mobile
// src/lib/decode-token.ts), so this signature+expiry check is what actually
// gates whether a scan is trusted, run at sync time on the server.
export async function verifyDisplayToken(token: string): Promise<VerifyDisplayTokenResult> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.kind !== "display" || typeof payload.mapping_id !== "string" || typeof payload.exam_id !== "string") {
      return { ok: false, reason: "invalid" };
    }
    return { ok: true, payload: { mappingId: payload.mapping_id, examId: payload.exam_id } };
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      return { ok: false, reason: "expired" };
    }
    return { ok: false, reason: "invalid" };
  }
}
