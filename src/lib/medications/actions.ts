"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth/dal";
import { readField } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";
import type { MedicationFormState } from "./form-state";
import { validateMedication } from "./validation";

const GENERIC_ERROR = "Something went wrong. Please try again.";

/**
 * Adds a medication to a profile the caller belongs to. `counted_on` is stamped by the
 * database (Warsaw date); RLS rejects a foreign or unknown `profileId`, which surfaces
 * as the generic error.
 */
export async function addMedication(
  _prevState: MedicationFormState,
  formData: FormData,
): Promise<MedicationFormState> {
  await getCurrentUser();

  const profileId = readField(formData, "profileId");
  const result = validateMedication({
    name: readField(formData, "name"),
    packageSize: readField(formData, "packageSize"),
    pillsLeft: readField(formData, "pillsLeft"),
    dailyDose: readField(formData, "dailyDose"),
  });
  if (!result.ok) {
    return { status: "error", fieldErrors: result.fieldErrors };
  }
  if (!profileId) {
    return { status: "error", message: GENERIC_ERROR };
  }

  const { name, packageSize, pillsLeft, dailyDose } = result.values;
  const supabase = await createClient();
  const { error } = await supabase.from("medications").insert({
    profile_id: profileId,
    name,
    package_size: packageSize,
    pills_counted: pillsLeft,
    daily_dose: dailyDose,
  });

  if (error) {
    return { status: "error", message: GENERIC_ERROR };
  }

  // Refresh the main screen so the new medication shows without a reload.
  revalidatePath("/", "layout");
  return { status: "success" };
}
