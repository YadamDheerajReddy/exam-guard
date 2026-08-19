import { supabase } from "./supabase";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL!;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }

  // Lets screens tell "your session died, sign in again" apart from a real
  // server-side problem, instead of showing one dead-end message for both.
  get isAuthError() {
    return this.status === 401;
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError("You're signed out. Sign in again to continue.", 401);
  return { Authorization: `Bearer ${token}` };
}

// One request path for every /api/invigilator/* call so failures carry the
// server's own message and status. Previously each helper threw a fixed
// string ("Couldn't load exams.") that discarded both, which made a failure
// on a real device impossible to diagnose from the screen.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = await authHeader();

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { ...headers, ...(init?.headers ?? {}) },
    });
  } catch {
    // fetch only rejects on transport failure — the server was never reached.
    throw new ApiError(`Can't reach the server at ${API_BASE_URL}. Check the connection.`, 0);
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    if (res.status === 401) {
      throw new ApiError(body?.error ?? "Your session expired. Sign out and sign in again.", 401);
    }
    throw new ApiError(body?.error ?? `Request failed (${res.status}).`, res.status);
  }

  return res.json() as Promise<T>;
}

export type ExamSummary = {
  id: string;
  courseCode: string;
  courseTitle: string;
  examDate: string;
  startTime: string;
  endTime: string;
};

export async function fetchExams(): Promise<ExamSummary[]> {
  const data = await request<{ exams: ExamSummary[] }>("/api/invigilator/exams");
  return data.exams;
}

export type RosterEntry = {
  mappingId: string;
  rollNumber: string;
  fullName: string;
  department: string;
  seatNumber: string;
  usedAt: string | null;
  hallId: string;
  hallBuildingName: string;
  hallRoomNumber: string;
  photoUrl: string | null;
};

export async function fetchRoster(
  examId: string,
): Promise<{ exam: ExamSummary; myHallId: string; roster: RosterEntry[] }> {
  return request(`/api/invigilator/roster?examId=${encodeURIComponent(examId)}`);
}

export type SyncEvent = {
  clientEventId: string;
  token?: string;
  manualMappingId?: string;
  deviceVerifiedAt: string;
};
export type SyncAck = {
  clientEventId: string;
  status: "VERIFIED" | "WRONG_HALL" | "FLAGGED";
  mappingId: string | null;
  note?: string;
};

export async function syncEvents(events: SyncEvent[]): Promise<SyncAck[]> {
  const data = await request<{ acks: SyncAck[] }>("/api/invigilator/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events }),
  });
  return data.acks;
}

// Called once right after supabase.auth.signInWithPassword() succeeds —
// flags the account for a forced password change if the password just
// typed still matches the org's deterministic temp pattern, regardless of
// whether this is the first login (see the route's own comment for why).
export async function checkLoginPassword(password: string): Promise<{ mustChangePassword: boolean }> {
  return request("/api/invigilator/login-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
}

export async function changeInvigilatorPassword(newPassword: string): Promise<void> {
  await request("/api/invigilator/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newPassword }),
  });
}

// Called from the login screen, before there's any session — can't go
// through request(), which always demands a bearer token first. Redemption
// (setting the actual new password) happens on a web page the emailed link
// opens, not in-app, so this only ever fires the request half.
export async function requestInvigilatorPasswordReset(email: string): Promise<{ message: string }> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/invigilator/request-password-reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  } catch {
    throw new ApiError(`Can't reach the server at ${API_BASE_URL}. Check the connection.`, 0);
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(body?.error ?? `Request failed (${res.status}).`, res.status);
  }

  return res.json() as Promise<{ message: string }>;
}
