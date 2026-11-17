/**
 * Pure validation helpers for medications, shared by the client forms and the
 * medication server actions. Limits mirror the checks in
 * `supabase/migrations/*_medications.sql`; safe to import from client components.
 */

export const MEDICATION_NAME_MAX_LENGTH = 80;
export const PACKAGE_SIZE_MIN = 1;
export const PACKAGE_SIZE_MAX = 1000;
export const PILLS_LEFT_MAX = 9999;
export const DAILY_DOSE_MIN = 0.5;
export const DAILY_DOSE_MAX = 50;
export const PACKAGE_AMOUNT_MIN = 0.5;
export const PACKAGE_AMOUNT_MAX = 1000;

export type MedicationField = "name" | "packageSize" | "pillsLeft" | "dailyDose";
export type MedicationFieldErrors = Partial<Record<MedicationField, string>>;

/** Raw form values, as typed (strings). */
export type MedicationInput = Record<MedicationField, string>;

/** Validated values, ready to insert. */
export type MedicationValues = {
  name: string;
  packageSize: number;
  pillsLeft: number;
  dailyDose: number;
};

// Digits with an optional decimal part; a comma is accepted as the decimal separator.
const AMOUNT_PATTERN = /^\d+(?:[.,]\d+)?$/;

/** Parses a typed, non-negative amount ("12", "12.5", "12,5"); null when it is not a number. */
export function parseAmount(value: string): number | null {
  const trimmed = value.trim();
  if (!AMOUNT_PATTERN.test(trimmed)) return null;
  const amount = Number(trimmed.replace(",", "."));
  return Number.isFinite(amount) ? amount : null;
}

function isHalfMultiple(amount: number): boolean {
  return Number.isInteger(amount * 2);
}

/** Returns an error message, or `undefined` when the medication name is acceptable. */
export function validateMedicationName(name: string): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) return "Enter the medication name";
  // Code points, like Postgres char_length().
  if (Array.from(trimmed).length > MEDICATION_NAME_MAX_LENGTH) {
    return `Use at most ${MEDICATION_NAME_MAX_LENGTH} characters`;
  }
  return undefined;
}

/** Tablets in a full package: a whole number from 1 to 1000. */
export function validatePackageSize(value: string): string | undefined {
  if (!value.trim()) return "Enter how many tablets a full package has";
  const amount = parseAmount(value);
  if (
    amount === null ||
    !Number.isInteger(amount) ||
    amount < PACKAGE_SIZE_MIN ||
    amount > PACKAGE_SIZE_MAX
  ) {
    return `Use a whole number from ${PACKAGE_SIZE_MIN} to ${PACKAGE_SIZE_MAX}`;
  }
  return undefined;
}

/** Tablets left now: 0 to 9999, whole or half tablets. */
export function validatePillsLeft(value: string): string | undefined {
  if (!value.trim()) return "Enter how many tablets are left";
  const amount = parseAmount(value);
  if (amount === null || amount > PILLS_LEFT_MAX) {
    return `Use a number from 0 to ${PILLS_LEFT_MAX}`;
  }
  if (!isHalfMultiple(amount)) return "Use whole or half tablets, e.g. 12 or 12.5";
  return undefined;
}

/** Tablets per day: 0.5 to 50, whole or half tablets. */
export function validateDailyDose(value: string): string | undefined {
  if (!value.trim()) return "Enter how many tablets a day";
  const amount = parseAmount(value);
  if (amount === null || amount < DAILY_DOSE_MIN || amount > DAILY_DOSE_MAX) {
    return `Use a number from ${DAILY_DOSE_MIN} to ${DAILY_DOSE_MAX}`;
  }
  if (!isHalfMultiple(amount)) return "Use whole or half tablets, e.g. 1 or 1.5";
  return undefined;
}

/** Tablets added from a package: 0.5 to 1000, whole or half tablets. */
export function validatePackageAmount(value: string): string | undefined {
  if (!value.trim()) return "Enter how many tablets you added";
  const amount = parseAmount(value);
  if (amount === null || amount < PACKAGE_AMOUNT_MIN || amount > PACKAGE_AMOUNT_MAX) {
    return `Use a number from ${PACKAGE_AMOUNT_MIN} to ${PACKAGE_AMOUNT_MAX}`;
  }
  if (!isHalfMultiple(amount)) return "Use whole or half tablets, e.g. 30 or 30.5";
  return undefined;
}

/** The stock a restock would produce must still fit the 9999-tablet limit. */
export function validateResultingCount(pillsCounted: number): string | undefined {
  if (pillsCounted > PILLS_LEFT_MAX) {
    return `That would be more than ${PILLS_LEFT_MAX} tablets`;
  }
  return undefined;
}

/**
 * Validates all fields at once: either the field errors, or the parsed values.
 * The name is returned trimmed.
 */
export function validateMedication(
  input: MedicationInput,
): { ok: true; values: MedicationValues } | { ok: false; fieldErrors: MedicationFieldErrors } {
  const fieldErrors: MedicationFieldErrors = {
    name: validateMedicationName(input.name),
    packageSize: validatePackageSize(input.packageSize),
    pillsLeft: validatePillsLeft(input.pillsLeft),
    dailyDose: validateDailyDose(input.dailyDose),
  };
  if (fieldErrors.name || fieldErrors.packageSize || fieldErrors.pillsLeft || fieldErrors.dailyDose) {
    return { ok: false, fieldErrors };
  }
  return {
    ok: true,
    values: {
      name: input.name.trim(),
      // Non-null: validated above.
      packageSize: parseAmount(input.packageSize) as number,
      pillsLeft: parseAmount(input.pillsLeft) as number,
      dailyDose: parseAmount(input.dailyDose) as number,
    },
  };
}
