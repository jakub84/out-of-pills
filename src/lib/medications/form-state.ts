import type { MedicationFieldErrors } from "./validation";

/** State shared by the add-medication wizard (`useActionState`) and its server action. */
export type MedicationFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: MedicationFieldErrors;
};

export const initialMedicationFormState: MedicationFormState = { status: "idle" };

/** State shared by the restock and correction forms and their server actions. */
export type StockFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: { tablets?: string };
};

export const initialStockFormState: StockFormState = { status: "idle" };
