import { createClient } from "@/lib/supabase/server";
import { InvigilatorsManager } from "@/components/admin/invigilators-manager";
import { MAX_INVIGILATORS_PER_HALL } from "@/lib/hall-capacity";

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

  const activeCountByHall = new Map<string, number>();
  for (const inv of invigilators ?? []) {
    if (!inv.is_active || !inv.assigned_hall_id) continue;
    activeCountByHall.set(inv.assigned_hall_id, (activeCountByHall.get(inv.assigned_hall_id) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-bold text-ink">Invigilators</h1>
      <p className="mt-1 text-sm text-slate">
        Each invigilator signs into the scanner app with their email and a
        generated password. A hall can have up to {MAX_INVIGILATORS_PER_HALL} active invigilators.
      </p>

      <div className="mt-6">
        <InvigilatorsManager
          halls={(halls ?? []).map((h) => ({
            id: h.id,
            buildingName: h.building_name,
            roomNumber: h.room_number,
            activeCount: activeCountByHall.get(h.id) ?? 0,
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
