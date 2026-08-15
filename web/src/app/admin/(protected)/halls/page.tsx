import { createClient } from "@/lib/supabase/server";
import { HallsManager } from "@/components/admin/halls-manager";

export default async function HallsPage() {
  const supabase = await createClient();
  const { data: halls } = await supabase
    .from("halls")
    .select("id, building_name, room_number, floor_level, capacity")
    .order("building_name", { ascending: true })
    .order("room_number", { ascending: true });

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-bold text-ink">Halls</h1>
      <p className="mt-1 text-sm text-slate">
        Venues reused across exam cycles.
      </p>

      <div className="mt-6">
        <HallsManager initialHalls={halls ?? []} />
      </div>
    </div>
  );
}
