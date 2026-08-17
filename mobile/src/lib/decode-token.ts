// Decodes (does NOT verify) a scanned barcode's JWT payload. The device
// deliberately never holds BARCODE_TOKEN_SECRET — shipping it into a mobile
// bundle would let anyone extract it and forge valid-looking passes — so
// on-device "validation" is roster-membership + expiry only. The signature
// is checked for real server-side at sync time (web/src/lib/barcode-token.ts
// verifyDisplayToken), which is the actual source of truth.
export type DecodedToken = { mappingId: string; examId: string; kind: string; exp: number };

// Hand-rolled rather than atob()/Buffer — neither is reliably available in
// the Hermes runtime without an extra polyfill, and this is the only place
// the app needs base64url decoding.
const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64UrlDecode(segment: string): string {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  let bits = "";
  for (const char of base64) {
    const index = BASE64_CHARS.indexOf(char);
    if (index === -1) continue;
    bits += index.toString(2).padStart(6, "0");
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }

  let result = "";
  let i = 0;
  while (i < bytes.length) {
    const byte1 = bytes[i++];
    if (byte1 < 0x80) {
      result += String.fromCharCode(byte1);
    } else if (byte1 >= 0xc0 && byte1 < 0xe0 && i < bytes.length) {
      const byte2 = bytes[i++];
      result += String.fromCharCode(((byte1 & 0x1f) << 6) | (byte2 & 0x3f));
    } else if (byte1 >= 0xe0 && i + 1 < bytes.length) {
      const byte2 = bytes[i++];
      const byte3 = bytes[i++];
      result += String.fromCharCode(((byte1 & 0x0f) << 12) | ((byte2 & 0x3f) << 6) | (byte3 & 0x3f));
    } else {
      result += String.fromCharCode(byte1);
    }
  }
  return result;
}

export function decodeToken(token: string): DecodedToken | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    if (typeof payload.mapping_id !== "string" || typeof payload.exam_id !== "string" || typeof payload.exp !== "number") {
      return null;
    }
    return { mappingId: payload.mapping_id, examId: payload.exam_id, kind: payload.kind, exp: payload.exp };
  } catch {
    return null;
  }
}

export function isTokenExpired(decoded: DecodedToken, nowMs: number = Date.now()): boolean {
  return decoded.exp * 1000 <= nowMs;
}
