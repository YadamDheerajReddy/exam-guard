import { supabase } from "./supabase";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL!;

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in.");
  return { Authorization: `Bearer ${token}` };
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
  const headers = await authHeader();
  const res = await fetch(`${API_BASE_URL}/api/invigilator/exams`, { headers });
  if (!res.ok) throw new Error("Couldn't load exams.");
  const data = await res.json();
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
  const headers = await authHeader();
  const res = await fetch(`${API_BASE_URL}/api/invigilator/roster?examId=${encodeURIComponent(examId)}`, { headers });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Couldn't load roster.");
  }
  return res.json();
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
  const headers = await authHeader();
  const res = await fetch(`${API_BASE_URL}/api/invigilator/sync`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ events }),
  });
  if (!res.ok) throw new Error("Sync failed.");
  const data = await res.json();
  return data.acks;
}
