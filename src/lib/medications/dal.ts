import "server-only";

import { cache } from "react";

import { getCurrentUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export type Medication = {
  id: string;
  name: string;
  packageSize: number;
  /** Tablets counted, a multiple of 0.5. */
  pillsCounted: number;
  /** Tablets per day, a positive multiple of 0.5. */
  dailyDose: number;
  /** Calendar day of the count, `YYYY-MM-DD` (Europe/Warsaw). */
  countedOn: string;
  /** Day the medication was paused, `YYYY-MM-DD` (Europe/Warsaw); null when taken. */
  pausedOn: string | null;
};

export type ProfileMedication = Medication & { profileId: string };

type MedicationRow = {
  id: string;
  name: string;
  package_size: number;
  pills_counted: number;
  daily_dose: number;
  counted_on: string;
  paused_on: string | null;
};

// PostgREST may return numeric columns as strings; normalise to numbers.
function toMedication(row: MedicationRow): Medication {
  return {
    id: row.id,
    name: row.name,
    packageSize: Number(row.package_size),
    pillsCounted: Number(row.pills_counted),
    dailyDose: Number(row.daily_dose),
    countedOn: row.counted_on,
    pausedOn: row.paused_on,
  };
}

/**
 * Every medication the caller can see, across all their profiles, in one query.
 * RLS limits the rows to profiles the caller belongs to; no extra user filter here.
 * Reads the session: call it inside `<Suspense>`, never inside `use cache`.
 */
export const listAllMedications = cache(async (): Promise<ProfileMedication[]> => {
  await getCurrentUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("medications")
    .select("id, profile_id, name, package_size, pills_counted, daily_dose, counted_on, paused_on");

  if (error) throw new Error(`Failed to load medications: ${error.message}`);

  return data.map((row) => ({ ...toMedication(row), profileId: row.profile_id }));
});

/**
 * The medications of one profile, oldest first; run-out ordering is up to the caller.
 * RLS limits the rows to profiles the caller belongs to; no extra user filter here.
 * Reads the session: call it inside `<Suspense>`, never inside `use cache`.
 */
export const listMedications = cache(
  async (profileId: string): Promise<Medication[]> => {
    await getCurrentUser();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("medications")
      .select("id, name, package_size, pills_counted, daily_dose, counted_on, paused_on")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });

    if (error) throw new Error(`Failed to load medications: ${error.message}`);

    return data.map(toMedication);
  },
);
