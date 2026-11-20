"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth/dal";
import { readField } from "@/lib/auth/validation";
import type { TablesUpdate } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import type { MedicationFormState, StockFormState } from "./form-state";
import {
  addPackage as addPackageToStock,
  correctCount,
  editStock,
  pauseStock,
  resumeStock,
  todayInWarsaw,
  type StockInput,
} from "./stock";
import {
  parseAmount,
  validateMedication,
  validateMedicationEdit,
  validatePackageAmount,
  validatePackageSize,
  validatePillsLeft,
  validateResultingCount,
} from "./validation";

const GENERIC_ERROR = "Something went wrong. Please try again.";
const STALE_ERROR = "The stock just changed — check the numbers and try again.";
const DAY_CHANGED_ERROR = "The day just changed — check the numbers and try again.";

// Raised by the medications_stock_counted_today trigger when counted_on (or a new
// paused_on) is not today (Warsaw) while the stock, dose or pause state changes.
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

/** The stored state the user was shown, sent back by the form's hidden baseline fields. */
type Baseline = StockInput & { medicationId: string };

function isHalfStep(amount: number): boolean {
  return Number.isInteger(amount * 2);
}

/** Reads the hidden baseline fields; null when any is missing or malformed. */
function readBaseline(formData: FormData): Baseline | null {
  const medicationId = readField(formData, "medicationId");
  const pillsCounted = parseAmount(readField(formData, "expectedPillsCounted"));
  const countedOn = readField(formData, "expectedCountedOn");
  const dailyDose = parseAmount(readField(formData, "expectedDailyDose"));
  // Empty when the medication was shown as not paused.
  const pausedOn = readField(formData, "expectedPausedOn");
  if (
    !UUID_PATTERN.test(medicationId) ||
    pillsCounted === null ||
    !isHalfStep(pillsCounted) ||
    !DATE_PATTERN.test(countedOn) ||
    dailyDose === null ||
    dailyDose <= 0 ||
    !isHalfStep(dailyDose) ||
    (pausedOn !== "" && !DATE_PATTERN.test(pausedOn))
  ) {
    return null;
  }
  return { medicationId, pillsCounted, countedOn, dailyDose, pausedOn: pausedOn || null };
}

type GuardedUpdate = {
  /** Name for server logs. */
  action: string;
  /**
   * New baseline from the stored one, or the error to show when the stored state does
   * not allow this change (e.g. pausing a paused medication).
   */
  rebase: (stored: StockInput, today: string) => StockInput | { error: string };
  /** Optional check of the resulting count; reported as `invalid`. */
  validateResult?: (pillsCounted: number) => string | undefined;
  /** New name, saved in the same guarded update. */
  name?: string;
  /** New remembered package size, saved in the same guarded update. */
  packageSize?: number;
};

type GuardedOutcome =
  | { status: "success" }
  | { status: "error"; message: string }
  | { status: "invalid"; error: string };

/**
 * Rewrites a medication's baseline to the rebase result (counted today), but only when the
 * stored baseline — count, count day, daily dose and pause state — is still the one the
 * user was shown. The update itself is guarded by the same baseline, so two submits with
 * the same expected values change the medication once; the second gets the stale error.
 * RLS scopes the row to the caller's profiles: a foreign or unknown id surfaces as the
 * generic error. Callers check the session first.
 */
async function guardedUpdate(formData: FormData, update: GuardedUpdate): Promise<GuardedOutcome> {
  const baseline = readBaseline(formData);
  if (!baseline) {
    return { status: "error", message: GENERIC_ERROR };
  }

  const supabase = await createClient();
  const { data: row, error: selectError } = await supabase
    .from("medications")
    .select("id, pills_counted, counted_on, daily_dose, paused_on")
    .eq("id", baseline.medicationId)
    .maybeSingle();

  if (selectError) {
    console.error(`${update.action} select failed`, selectError);
    return { status: "error", message: GENERIC_ERROR };
  }
  if (!row) {
    return { status: "error", message: GENERIC_ERROR };
  }

  // PostgREST may return numeric columns as strings; normalise to numbers.
  const stored: StockInput = {
    pillsCounted: Number(row.pills_counted),
    countedOn: row.counted_on,
    dailyDose: Number(row.daily_dose),
    pausedOn: row.paused_on,
  };
  if (
    stored.pillsCounted !== baseline.pillsCounted ||
    stored.countedOn !== baseline.countedOn ||
    stored.dailyDose !== baseline.dailyDose ||
    stored.pausedOn !== baseline.pausedOn
  ) {
    revalidatePath("/", "layout");
    return { status: "error", message: STALE_ERROR };
  }

  const next = update.rebase(stored, todayInWarsaw());
  if ("error" in next) {
    if (next.error === STALE_ERROR) revalidatePath("/", "layout");
    return { status: "error", message: next.error };
  }
  const resultError = update.validateResult?.(next.pillsCounted);
  if (resultError) {
    return { status: "invalid", error: resultError };
  }

  // Dose and pause state are written only when the rebase changes them, so restock and
  // correction send the same update as before.
  const changes: TablesUpdate<"medications"> = {
    pills_counted: next.pillsCounted,
    counted_on: next.countedOn,
  };
  if (next.dailyDose !== stored.dailyDose) changes.daily_dose = next.dailyDose;
  if (next.pausedOn !== stored.pausedOn) changes.paused_on = next.pausedOn;
  if (update.name !== undefined) changes.name = update.name;
  if (update.packageSize !== undefined) changes.package_size = update.packageSize;

  const guarded = supabase
    .from("medications")
    .update(changes)
    .eq("id", baseline.medicationId)
    .eq("pills_counted", baseline.pillsCounted)
    .eq("counted_on", baseline.countedOn)
    .eq("daily_dose", baseline.dailyDose);
  const { data: updated, error: updateError } = await (
    baseline.pausedOn === null
      ? guarded.is("paused_on", null)
      : guarded.eq("paused_on", baseline.pausedOn)
  ).select("id");

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

type StockUpdate = Omit<GuardedUpdate, "rebase"> & {
  validateTablets: (value: string) => string | undefined;
  rebase: (stored: StockInput, today: string, tablets: number) => StockInput | { error: string };
};

/** Restock and correction: validates `tablets`, then runs the guarded update. */
async function updateStock(formData: FormData, update: StockUpdate): Promise<StockFormState> {
  await getCurrentUser();

  const tabletsInput = readField(formData, "tablets");
  const tabletsError = update.validateTablets(tabletsInput);
  if (tabletsError) {
    return { status: "error", fieldErrors: { tablets: tabletsError } };
  }
  // Non-null: validated above.
  const tablets = parseAmount(tabletsInput) as number;

  const outcome = await guardedUpdate(formData, {
    ...update,
    rebase: (stored, today) => update.rebase(stored, today, tablets),
  });
  if (outcome.status === "invalid") {
    return { status: "error", fieldErrors: { tablets: outcome.error } };
  }
  return outcome;
}

/**
 * Adds a package: today's tablets left plus `tablets`, counted today. An optional
 * `packageSize` (picked in the dialog's dropdown) becomes the new remembered package size.
 * A paused medication is not offered a restock, so one arriving here gets the generic error.
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
    rebase: (stored, today, tablets) =>
      stored.pausedOn !== null ? { error: GENERIC_ERROR } : addPackageToStock(stored, today, tablets),
    validateResult: validateResultingCount,
    packageSize: packageSizeInput ? (parseAmount(packageSizeInput) as number) : undefined,
  });
}

/** Corrects the count: exactly `tablets` left, counted today; the pause state is kept. */
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

/**
 * Edits name, package size and daily dose, rebased to today; the pause state is kept. In
 * `auto` pills mode the server works out pills left from the stored stock and its own
 * Warsaw date (the form's pre-filled number is never trusted); in `manual` mode the typed
 * number is saved as is. With the same dose and no typed count the stock is not rebased,
 * so a rename or package-size change keeps the stored count and its day.
 */
export async function editMedication(
  _prevState: MedicationFormState,
  formData: FormData,
): Promise<MedicationFormState> {
  await getCurrentUser();

  const pillsMode = readField(formData, "pillsMode");
  if (pillsMode !== "auto" && pillsMode !== "manual") {
    return { status: "error", message: GENERIC_ERROR };
  }
  const result = validateMedicationEdit({
    name: readField(formData, "name"),
    packageSize: readField(formData, "packageSize"),
    dailyDose: readField(formData, "dailyDose"),
    pillsMode,
    pillsLeft: readField(formData, "pillsLeft"),
  });
  if (!result.ok) {
    return { status: "error", fieldErrors: result.fieldErrors };
  }

  const { name, packageSize, dailyDose, pillsLeft } = result.values;
  // A typed count may have been stepped from the day before's number (dialog open over
  // midnight), which would still hold yesterday's dose and push the date later.
  if (pillsMode === "manual" && readField(formData, "shownOn") !== todayInWarsaw()) {
    revalidatePath("/", "layout");
    return { status: "error", message: DAY_CHANGED_ERROR };
  }
  const outcome = await guardedUpdate(formData, {
    action: "editMedication",
    rebase: (stored, today) => editStock(stored, today, { dailyDose, pillsLeft }),
    name,
    packageSize,
  });
  // No result check is configured, so `invalid` cannot happen; mapped for completeness.
  if (outcome.status === "invalid") {
    return { status: "error", fieldErrors: { pillsLeft: outcome.error } };
  }
  return outcome;
}

/** Pauses: today's dose is still taken, then the stock is frozen from today. */
export async function pauseMedication(
  _prevState: StockFormState,
  formData: FormData,
): Promise<StockFormState> {
  await getCurrentUser();

  const outcome = await guardedUpdate(formData, {
    action: "pauseMedication",
    // Already paused: the request came from an outdated screen.
    rebase: (stored, today) =>
      stored.pausedOn !== null ? { error: STALE_ERROR } : pauseStock(stored, today),
  });
  // No result check is configured, so `invalid` cannot happen.
  return outcome.status === "invalid" ? { status: "error", message: GENERIC_ERROR } : outcome;
}

/** Resumes: the frozen count, counted today, so today is day 1 again. */
export async function resumeMedication(
  _prevState: StockFormState,
  formData: FormData,
): Promise<StockFormState> {
  await getCurrentUser();

  const outcome = await guardedUpdate(formData, {
    action: "resumeMedication",
    // Not paused: the request came from an outdated screen.
    rebase: (stored, today) =>
      stored.pausedOn === null ? { error: STALE_ERROR } : resumeStock(stored, today),
  });
  // No result check is configured, so `invalid` cannot happen.
  return outcome.status === "invalid" ? { status: "error", message: GENERIC_ERROR } : outcome;
}

/**
 * Removes one medication for good (FR-013). RLS scopes the row to the caller's profiles; no
 * deleted row (already removed, or not visible to the caller) counts as success, so a stale
 * tab ends up showing the same list.
 */
export async function removeMedication(
  _prevState: StockFormState,
  formData: FormData,
): Promise<StockFormState> {
  await getCurrentUser();

  const medicationId = readField(formData, "medicationId");
  if (!UUID_PATTERN.test(medicationId)) {
    return { status: "error", message: GENERIC_ERROR };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("medications").delete().eq("id", medicationId);

  if (error) {
    // Keep the failure visible in the server logs; the user only sees the generic message.
    console.error("removeMedication delete failed", error);
    return { status: "error", message: GENERIC_ERROR };
  }

  // Refresh the main screen so the card, tiles and sidebar dot update without a reload.
  revalidatePath("/", "layout");
  return { status: "success" };
}
