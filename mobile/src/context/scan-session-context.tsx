import { createContext, use, useEffect, useState, type PropsWithChildren } from "react";
import {
  initLocalDb,
  getRosterCountForHall,
  getPendingSyncCount,
  replaceRosterForExam,
  type RosterRow,
} from "@/lib/local-db";
import { startSyncEngine } from "@/lib/sync-engine";
import { fetchRoster, type ExamSummary } from "@/lib/api";

export type ActiveSession = {
  exam: ExamSummary;
  hallId: string;
  hallBuildingName: string;
  hallRoomNumber: string;
  rosterCount: number;
};

type ScanSessionContextValue = {
  session: ActiveSession | null;
  pendingSyncCount: number;
  presyncing: boolean;
  presyncError: string | null;
  startSession: (exam: ExamSummary) => Promise<void>;
  endSession: () => void;
};

const ScanSessionContext = createContext<ScanSessionContextValue | null>(null);

export function useScanSession() {
  const value = use(ScanSessionContext);
  if (!value) throw new Error("useScanSession must be used within a ScanSessionProvider");
  return value;
}

export function ScanSessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [presyncing, setPresyncing] = useState(false);
  const [presyncError, setPresyncError] = useState<string | null>(null);

  useEffect(() => {
    initLocalDb();
    setPendingSyncCount(getPendingSyncCount());
    // Runs for the whole app session, not just while a hall/exam is
    // selected — a scan queued under a previous selection still needs to
    // drain even after the invigilator moves on to the next exam.
    return startSyncEngine(setPendingSyncCount);
  }, []);

  async function startSession(exam: ExamSummary) {
    setPresyncing(true);
    setPresyncError(null);
    try {
      const { myHallId, roster } = await fetchRoster(exam.id);
      const hallEntry = roster.find((r) => r.hallId === myHallId);

      const rows: RosterRow[] = roster.map((r) => ({
        mapping_id: r.mappingId,
        exam_id: exam.id,
        roll_number: r.rollNumber,
        full_name: r.fullName,
        department: r.department,
        seat_number: r.seatNumber,
        photo_url: r.photoUrl,
        used_at: r.usedAt,
        hall_id: r.hallId,
        hall_building_name: r.hallBuildingName,
        hall_room_number: r.hallRoomNumber,
      }));
      replaceRosterForExam(exam.id, rows);

      setSession({
        exam,
        hallId: myHallId,
        hallBuildingName: hallEntry?.hallBuildingName ?? "",
        hallRoomNumber: hallEntry?.hallRoomNumber ?? "",
        rosterCount: getRosterCountForHall(exam.id, myHallId),
      });
    } catch (err) {
      setPresyncError(err instanceof Error ? err.message : "Couldn't download the roster.");
    } finally {
      setPresyncing(false);
    }
  }

  function endSession() {
    setSession(null);
  }

  return (
    <ScanSessionContext.Provider
      value={{ session, pendingSyncCount, presyncing, presyncError, startSession, endSession }}
    >
      {children}
    </ScanSessionContext.Provider>
  );
}
