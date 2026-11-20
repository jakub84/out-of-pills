import { computeStock, type Stock } from "@/lib/medications/stock";
import {
  parseAmount,
  validateDailyDose,
  validatePackageSize,
  validatePillsLeft,
  type MedicationInput,
} from "@/lib/medications/validation";

export const PACKAGE_CHIPS = ["20", "28", "30", "56", "60", "90"] as const;
export const DOSE_CHIPS = ["0.5", "1", "2", "3"] as const;
export const OTHER = "other";

/**
 * "Left now" follows the package size (`full`, `double`) until the user types or
 * steps the number (`manual`).
 */
export type PillsMode = "full" | "double" | "manual";

/** Everything the wizard holds before saving. */
export type MedicationDraft = {
  name: string;
  /** One of PACKAGE_CHIPS or OTHER. */
  packageChoice: string;
  packageOther: string;
  pillsMode: PillsMode;
  pillsManual: string;
  /** One of DOSE_CHIPS or OTHER. */
  doseChoice: string;
  doseOther: string;
};

export const initialDraft: MedicationDraft = {
  name: "",
  packageChoice: "30",
  packageOther: "",
  pillsMode: "full",
  pillsManual: "",
  doseChoice: "1",
  doseOther: "",
};

/** The package size, when valid. */
export function packageSizeOf(draft: MedicationDraft): number | null {
  const value = draft.packageChoice === OTHER ? draft.packageOther : draft.packageChoice;
  return validatePackageSize(value) ? null : parseAmount(value);
}

/** The four form values as typed (derived "left now" included). */
export function draftInput(draft: MedicationDraft): MedicationInput {
  const packageSize = draft.packageChoice === OTHER ? draft.packageOther : draft.packageChoice;
  const size = packageSizeOf(draft);
  let pillsLeft = draft.pillsManual;
  if (draft.pillsMode !== "manual") {
    pillsLeft = size === null ? "" : String(draft.pillsMode === "double" ? size * 2 : size);
  }
  return {
    name: draft.name,
    packageSize,
    pillsLeft,
    dailyDose: draft.doseChoice === OTHER ? draft.doseOther : draft.doseChoice,
  };
}

/** Stock as of today for a count made today, or null while the numbers are invalid. */
export function previewStock(input: MedicationInput, today: string): Stock | null {
  if (validatePillsLeft(input.pillsLeft) || validateDailyDose(input.dailyDose)) return null;
  const pillsCounted = parseAmount(input.pillsLeft);
  const dailyDose = parseAmount(input.dailyDose);
  if (pillsCounted === null || dailyDose === null) return null;
  return computeStock({ pillsCounted, countedOn: today, dailyDose, pausedOn: null }, today);
}
