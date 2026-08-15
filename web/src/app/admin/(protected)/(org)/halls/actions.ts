"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgAdmin } from "@/lib/admin-context";

export type HallFormState = { error?: string } | undefined;

function parseHallForm(formData: FormData) {
  const buildingName = String(formData.get("buildingName") ?? "").trim();
  const roomNumber = String(formData.get("roomNumber") ?? "").trim();
  const floorLevel = Number(formData.get("floorLevel"));
  const capacity = Number(formData.get("capacity"));

  if (!buildingName || !roomNumber) {
    return { error: "Building name and room number are required." } as const;
  }
  if (!Number.isFinite(floorLevel)) {
    return { error: "Floor level must be a number." } as const;
  }
  if (!Number.isFinite(capacity) || capacity < 1) {
    return { error: "Capacity must be a positive number." } as const;
  }

  return {
    buildingName,
    roomNumber,
    floorLevel,
    capacity,
  } as const;
}

export async function createHall(
  _prevState: HallFormState,
  formData: FormData,
): Promise<HallFormState> {
  const parsed = parseHallForm(formData);
  if ("error" in parsed) return parsed;

  const admin = await requireOrgAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("halls").insert({
    building_name: parsed.buildingName,
    room_number: parsed.roomNumber,
    floor_level: parsed.floorLevel,
    capacity: parsed.capacity,
    organization_id: admin.organizationId,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "A hall with that building and room number already exists." };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/halls");
  return undefined;
}

export async function updateHall(
  hallId: string,
  _prevState: HallFormState,
  formData: FormData,
): Promise<HallFormState> {
  const parsed = parseHallForm(formData);
  if ("error" in parsed) return parsed;

  const supabase = await createClient();
  const { error } = await supabase
    .from("halls")
    .update({
      building_name: parsed.buildingName,
      room_number: parsed.roomNumber,
      floor_level: parsed.floorLevel,
      capacity: parsed.capacity,
    })
    .eq("id", hallId);

  if (error) {
    if (error.code === "23505") {
      return { error: "A hall with that building and room number already exists." };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/halls");
  return undefined;
}

export async function deleteHall(hallId: string): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { count } = await supabase
    .from("student_exam_mappings")
    .select("id", { count: "exact", head: true })
    .eq("hall_id", hallId);

  if (count && count > 0) {
    return {
      error: `Can't delete — ${count} student${count === 1 ? " is" : "s are"} mapped to this hall.`,
    };
  }

  const { error } = await supabase.from("halls").delete().eq("id", hallId);
  if (error) return { error: error.message };

  revalidatePath("/admin/halls");
  return {};
}
