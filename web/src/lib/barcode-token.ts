import "server-only";
import { SignJWT } from "jose";

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
