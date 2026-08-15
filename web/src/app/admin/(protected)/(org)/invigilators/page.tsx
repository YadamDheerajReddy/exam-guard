import { createClient } from "@/lib/supabase/server";
import { InvigilatorsManager } from "@/components/admin/invigilators-manager";

export default async function InvigilatorsPage() {
  const supabase = await createClient();

  const [{ data: halls }, { data: invigilators }] = await Promise.all([
    supabase
      .from("halls")
      .select("id, building_name, room_number")
      .order("building_name", { ascending: true }),
    supabase
      .from("invigilators")
      .select("id, full_name, email, assigned_hall_id, is_active")
      .order("full_name", { ascending: true }),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-bold text-ink">Invigilators</h1>
      <p className="mt-1 text-sm text-slate">
        Each invigilator signs into the scanner app with their email and a
        generated password.
      </p>

      <div className="mt-6">
        <InvigilatorsManager
          halls={(halls ?? []).map((h) => ({
            id: h.id,
            buildingName: h.building_name,
            roomNumber: h.room_number,
          }))}
          invigilators={(invigilators ?? []).map((i) => ({
            id: i.id,
            fullName: i.full_name,
            email: i.email,
            assignedHallId: i.assigned_hall_id,
            isActive: i.is_active,
          }))}
        />
      </div>
    </div>
  );
}
