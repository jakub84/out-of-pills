"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth/dal";
import { readField } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";
import type { MedicationFormState, StockFormState } from "./form-state";
import {
  addPackage as addPackageToStock,
  correctCount,
  todayInWarsaw,
  type StockInput,
} from "./stock";
import {
  parseAmount,
  validateMedication,
  validatePackageAmount,
  validatePackageSize,
  validatePillsLeft,
  validateResultingCount,
} from "./validation";

const GENERIC_ERROR = "Something went wrong. Please try again.";
const STALE_ERROR = "The stock just changed — check the numbers and try again.";
const DAY_CHANGED_ERROR = "The day just changed — check the numbers and try again.";

// Raised by the medications_stock_counted_today trigger when counted_on is not today (Warsaw).
const DAY_CHANGED_SQLSTATE = "OP001";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    // Keep the failure visible in the server logs; the user only sees the generic message.
    console.error("addMedication insert failed", error);
    return { status: "error", message: GENERIC_ERROR };
  }

  // Refresh the main screen so the new medication shows without a reload.
  revalidatePath("/", "layout");
  return { status: "success" };
}

type StockUpdate = {
  /** Name for server logs. */
  action: string;
  validateTablets: (value: string) => string | undefined;
  rebase: (input: StockInput, today: string, tablets: number) => StockInput;
  /** Optional check of the resulting count; an error is shown on the `tablets` field. */
  validateResult?: (pillsCounted: number) => string | undefined;
  /** New remembered package size, saved in the same guarded update. */
  packageSize?: number;
};

/**
 * Rewrites a medication's stock baseline to (new count, today), but only when the stored
 * baseline is still the one the user was shown (`expectedPillsCounted`, `expectedCountedOn`).
 * The update itself is guarded by the same baseline, so two submits with the same expected
 * values change the stock once; the second gets the stale error. RLS scopes the row to the
 * caller's profiles: a foreign or unknown id surfaces as the generic error.
 */
async function updateStock(formData: FormData, update: StockUpdate): Promise<StockFormState> {
  await getCurrentUser();

  const tabletsInput = readField(formData, "tablets");
  const tabletsError = update.validateTablets(tabletsInput);
  if (tabletsError) {
    return { status: "error", fieldErrors: { tablets: tabletsError } };
  }
  // Non-null: validated above.
  const tablets = parseAmount(tabletsInput) as number;

  const medicationId = readField(formData, "medicationId");
  const expectedPillsCounted = parseAmount(readField(formData, "expectedPillsCounted"));
  const expectedCountedOn = readField(formData, "expectedCountedOn");
  if (
    !UUID_PATTERN.test(medicationId) ||
    expectedPillsCounted === null ||
    !Number.isInteger(expectedPillsCounted * 2) ||
    !DATE_PATTERN.test(expectedCountedOn)
  ) {
    return { status: "error", message: GENERIC_ERROR };
  }

  const supabase = await createClient();
  const { data: row, error: selectError } = await supabase
    .from("medications")
    .select("id, pills_counted, counted_on, daily_dose")
    .eq("id", medicationId)
    .maybeSingle();

  if (selectError) {
    console.error(`${update.action} select failed`, selectError);
    return { status: "error", message: GENERIC_ERROR };
  }
  if (!row) {
    return { status: "error", message: GENERIC_ERROR };
  }
  if (Number(row.pills_counted) !== expectedPillsCounted || row.counted_on !== expectedCountedOn) {
    revalidatePath("/", "layout");
    return { status: "error", message: STALE_ERROR };
  }

  const next = update.rebase(
    {
      pillsCounted: Number(row.pills_counted),
      countedOn: row.counted_on,
      dailyDose: Number(row.daily_dose),
    },
    todayInWarsaw(),
    tablets,
  );
  const resultError = update.validateResult?.(next.pillsCounted);
  if (resultError) {
    return { status: "error", fieldErrors: { tablets: resultError } };
  }

  const { data: updated, error: updateError } = await supabase
    .from("medications")
    .update({
      pills_counted: next.pillsCounted,
      counted_on: next.countedOn,
      ...(update.packageSize === undefined ? {} : { package_size: update.packageSize }),
    })
    .eq("id", medicationId)
    .eq("pills_counted", expectedPillsCounted)
    .eq("counted_on", expectedCountedOn)
    .select("id");

  if (updateError) {
    if (updateError.code === DAY_CHANGED_SQLSTATE) {
      revalidatePath("/", "layout");
      return { status: "error", message: DAY_CHANGED_ERROR };
    }
    // Keep the failure visible in the server logs; the user only sees the generic message.
    console.error(`${update.action} update failed`, updateError);
    return { status: "error", message: GENERIC_ERROR };
  }
  if (!updated || updated.length === 0) {
    // Someone changed the baseline between the select and the update.
    revalidatePath("/", "layout");
    return { status: "error", message: STALE_ERROR };
  }

  // Refresh the main screen so the new figures show without a reload.
  revalidatePath("/", "layout");
  return { status: "success" };
}

/**
 * Adds a package: today's tablets left plus `tablets`, counted today. An optional
 * `packageSize` (picked in the dialog's dropdown) becomes the new remembered package size.
 */
export async function addPackage(
  _prevState: StockFormState,
  formData: FormData,
): Promise<StockFormState> {
  const packageSizeInput = readField(formData, "packageSize");
  // The dropdown only offers valid sizes, so a bad value is a tampered request: generic error.
  if (packageSizeInput && validatePackageSize(packageSizeInput)) {
    await getCurrentUser();
    return { status: "error", message: GENERIC_ERROR };
  }

  return updateStock(formData, {
    action: "addPackage",
    validateTablets: validatePackageAmount,
    rebase: addPackageToStock,
    validateResult: validateResultingCount,
    packageSize: packageSizeInput ? (parseAmount(packageSizeInput) as number) : undefined,
  });
}

/** Corrects the count: exactly `tablets` left, counted today. */
export async function correctPillCount(
  _prevState: StockFormState,
  formData: FormData,
): Promise<StockFormState> {
  return updateStock(formData, {
    action: "correctPillCount",
    validateTablets: validatePillsLeft,
    rebase: correctCount,
  });
}
