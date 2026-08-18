import { createContext, use, useCallback, useEffect, useState, type PropsWithChildren } from "react";
import { useSession } from "@/context/session-context";
import { supabase } from "@/lib/supabase";
import { takePendingLoginCheck } from "@/lib/pending-login-check";

export type InvigilatorProfile = {
  fullName: string;
  assignedHallId: string | null;
  assignedHallBuildingName: string | null;
  assignedHallRoomNumber: string | null;
  mustChangePassword: boolean;
};

export type InvigilatorLookup =
  | { status: "loading" }
  | { status: "ready"; invigilator: InvigilatorProfile }
  | { status: "not-invigilator" }
  | { status: "error"; message: string };

type InvigilatorContextValue = {
  lookup: InvigilatorLookup;
  refresh: () => void;
};

const InvigilatorContext = createContext<InvigilatorContextValue | null>(null);

export function useInvigilator() {
  const value = use(InvigilatorContext);
  if (!value) throw new Error("useInvigilator must be used within an InvigilatorProvider");
  return value;
}

export function InvigilatorProvider({ children }: PropsWithChildren) {
  const { session } = useSession();
  const [lookup, setLookup] = useState<InvigilatorLookup>({ status: "loading" });

  const load = useCallback(async () => {
    if (!session) return;
    setLookup({ status: "loading" });
    const pending = takePendingLoginCheck();
    if (pending) await pending;
    supabase
      .from("invigilators")
      .select("full_name, assigned_hall_id, must_change_password, halls(building_name, room_number)")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          setLookup({ status: "error", message: error.message });
          return;
        }
        if (!data) {
          setLookup({ status: "not-invigilator" });
          return;
        }
        const hall = Array.isArray(data.halls) ? data.halls[0] : data.halls;
        setLookup({
          status: "ready",
          invigilator: {
            fullName: data.full_name,
            assignedHallId: data.assigned_hall_id,
            assignedHallBuildingName: hall?.building_name ?? null,
            assignedHallRoomNumber: hall?.room_number ?? null,
            mustChangePassword: data.must_change_password,
          },
        });
      });
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  return <InvigilatorContext.Provider value={{ lookup, refresh: load }}>{children}</InvigilatorContext.Provider>;
}
