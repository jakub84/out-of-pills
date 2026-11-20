"use client";

import { useActionState, useId, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { FORM_DIALOG_CONTENT_CLASS } from "@/components/dialogs/form-dialog";
import { useSaveGuard, type GuardSave } from "@/components/dialogs/use-save-guard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readField } from "@/lib/auth/validation";
import { medicationUpdatedMessage } from "@/lib/feedback/messages";
import { runSaveAction } from "@/lib/feedback/run-save-action";
import { editMedication } from "@/lib/medications/actions";
import { formatTablets } from "@/lib/medications/format";
import {
  initialMedicationFormState,
  type MedicationFormState,
} from "@/lib/medications/form-state";
import { computeStock, editStock } from "@/lib/medications/stock";
import {
  PILLS_LEFT_MAX,
  parseAmount,
  validateDailyDose,
  validateMedicationEdit,
  validatePillsLeft,
  type EditPillsMode,
  type MedicationField,
  type MedicationFieldErrors,
} from "@/lib/medications/validation";
import { cn } from "@/lib/utils";
import { ChipGroup, focusChipGroup } from "./chip-group";
import { DOSE_CHIPS, DOSE_OPTIONS, OTHER, PACKAGE_CHIPS, PACKAGE_OPTIONS } from "./medication-draft";
import {
  AmountStepper,
  BaselineFields,
  FieldError,
  StockLine,
  type StockDialogMedication,
  type StockDialogProps,
} from "./stock-dialog-parts";

/** Fields in the order they appear, for moving focus to the first error. */
const FIELD_ORDER: MedicationField[] = ["name", "packageSize", "dailyDose", "pillsLeft"];

/** What the edit form holds before saving. */
type EditDraft = {
  name: string;
  /** One of PACKAGE_CHIPS or OTHER. */
  packageChoice: string;
  packageOther: string;
  /** One of DOSE_CHIPS or OTHER. */
  doseChoice: string;
  doseOther: string;
  /** Pills left follow the dose (`auto`) until the user types or steps the number (`manual`). */
  pillsMode: EditPillsMode;
  pillsManual: string;
};

/** The chip for a stored value, or "Other" with the value typed in. */
function chipChoice(value: number, chips: readonly string[]) {
  const text = String(value);
  return chips.includes(text) ? { choice: text, other: "" } : { choice: OTHER, other: text };
}

/** The form pre-filled from a stored medication. */
function draftFrom(medication: StockDialogMedication): EditDraft {
  const packageChip = chipChoice(medication.packageSize, PACKAGE_CHIPS);
  const doseChip = chipChoice(medication.dailyDose, DOSE_CHIPS);
  return {
    name: medication.name,
    packageChoice: packageChip.choice,
    packageOther: packageChip.other,
    doseChoice: doseChip.choice,
    doseOther: doseChip.other,
    pillsMode: "auto",
    pillsManual: "",
  };
}

/** Identifies the stored values the form was filled from. */
function seedKey(medication: StockDialogMedication): string {
  return [
    medication.name,
    medication.packageSize,
    medication.dailyDose,
    medication.pillsCounted,
    medication.countedOn,
    medication.pausedOn ?? "",
  ].join("|");
}

/**
 * Moves the fields the user has not changed from `from` to `to`; edited fields are kept.
 * Pills left in manual mode count as edited.
 */
function reseedDraft(draft: EditDraft, from: StockDialogMedication, to: StockDialogMedication): EditDraft {
  const before = draftFrom(from);
  const after = draftFrom(to);
  const untouched = (...keys: (keyof EditDraft)[]) => keys.every((key) => draft[key] === before[key]);
  return {
    ...draft,
    ...(untouched("name") ? { name: after.name } : {}),
    ...(untouched("packageChoice", "packageOther")
      ? { packageChoice: after.packageChoice, packageOther: after.packageOther }
      : {}),
    ...(untouched("doseChoice", "doseOther")
      ? { doseChoice: after.doseChoice, doseOther: after.doseOther }
      : {}),
  };
}

/**
 * "Edit medication" dialog (FR-010): name, package size, daily dose and pills left, with the
 * result previewed. Controlled — the card's options menu opens it.
 */
export function EditMedicationDialog({
  medication,
  today,
  open,
  onOpenChange,
}: StockDialogProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const guard = useSaveGuard(onOpenChange);

  return (
    <Dialog open={open} onOpenChange={guard.onOpenChange}>
      <DialogContent className={cn(FORM_DIALOG_CONTENT_CLASS, "sm:max-w-lg")}>
        {/* Content unmounts when closed, so every opening pre-fills the stored values again. */}
        <EditMedicationForm
          medication={medication}
          today={today}
          guardSave={guard.guardSave}
          onSaved={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function EditMedicationForm({
  medication,
  today,
  guardSave,
  onSaved,
}: StockDialogProps & { guardSave: GuardSave; onSaved: () => void }) {
  const ids = useId();
  const id = (suffix: string) => `${ids}-${suffix}`;
  const pillsRef = useRef<HTMLInputElement>(null);
  // The stored values the form was filled from; they are sent back as the baseline, so a
  // save never pairs a fresh baseline with values chosen against an older one.
  const [seed, setSeed] = useState(medication);
  const [draft, setDraft] = useState<EditDraft>(() => draftFrom(medication));
  const [errors, setErrors] = useState<MedicationFieldErrors>({});
  const paused = seed.pausedOn !== null;

  const packageSize = draft.packageChoice === OTHER ? draft.packageOther : draft.packageChoice;
  const dailyDose = draft.doseChoice === OTHER ? draft.doseOther : draft.doseChoice;
  const manual = draft.pillsMode === "manual";

  // Previews only from valid numbers: editStock throws on non-half or out-of-range values.
  const dose = validateDailyDose(dailyDose) ? null : (parseAmount(dailyDose) as number);
  const typedPills =
    manual && !validatePillsLeft(draft.pillsManual) ? (parseAmount(draft.pillsManual) as number) : null;
  // Untouched, pills left follow the dose like the server's auto mode; today's count otherwise.
  const autoPills =
    dose === null
      ? computeStock(seed, today).pillsLeft
      : editStock(seed, today, { dailyDose: dose, pillsLeft: null }).pillsCounted;
  const pillsLeft = manual ? draft.pillsManual : String(autoPills);
  const preview =
    dose === null || (manual && typedPills === null)
      ? null
      : computeStock(editStock(seed, today, { dailyDose: dose, pillsLeft: typedPills }), today);

  function focusField(field: MedicationField) {
    switch (field) {
      case "name":
        document.getElementById(id("name"))?.focus();
        break;
      case "packageSize":
        if (draft.packageChoice === OTHER) document.getElementById(id("package-other"))?.focus();
        else focusChipGroup(id("package"));
        break;
      case "dailyDose":
        if (draft.doseChoice === OTHER) document.getElementById(id("dose-other"))?.focus();
        else focusChipGroup(id("dose"));
        break;
      case "pillsLeft":
        pillsRef.current?.focus();
        break;
    }
  }

  function showErrors(fieldErrors: MedicationFieldErrors) {
    setErrors(fieldErrors);
    const first = FIELD_ORDER.find((field) => fieldErrors[field]);
    if (first) focusField(first);
  }

  const [state, formAction, isPending] = useActionState(
    async (prev: MedicationFormState, formData: FormData) => {
      // A failed request keeps the dialog open with the typed values.
      const result = await runSaveAction(
        () => guardSave(() => editMedication(prev, formData)),
        initialMedicationFormState,
      );
      if (result.status === "success") {
        toast.success(medicationUpdatedMessage(readField(formData, "name").trim()));
        onSaved();
      } else if (result.fieldErrors) {
        showErrors(result.fieldErrors);
      }
      return result;
    },
    initialMedicationFormState,
  );

  // After a failed save the page may bring newer stored values (e.g. the stale-stock error
  // revalidates). Move the untouched fields and the baseline to them, keeping the error
  // visible, so the retry is based on what is stored now. After a success the dialog
  // closes, so nothing changes under it.
  if (state.status === "error" && seedKey(medication) !== seedKey(seed)) {
    setSeed(medication);
    setDraft(reseedDraft(draft, seed, medication));
  }

  function change(patch: Partial<EditDraft>, field: MedicationField) {
    setDraft((current) => ({ ...current, ...patch }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  }

  /** Blocks the submit and points at the first invalid field. */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const result = validateMedicationEdit({
      name: draft.name,
      packageSize,
      dailyDose,
      pillsMode: draft.pillsMode,
      pillsLeft,
    });
    if (!result.ok) {
      event.preventDefault();
      showErrors(result.fieldErrors);
    }
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <BaselineFields medication={seed} />
      <input type="hidden" name="packageSize" value={packageSize} />
      <input type="hidden" name="dailyDose" value={dailyDose} />
      <input type="hidden" name="pillsMode" value={draft.pillsMode} />
      {/* The day the stepper's starting number was worked out for; a typed count is refused after midnight. */}
      <input type="hidden" name="shownOn" value={today} />

      <DialogHeader className="gap-1.5 pr-8">
        <DialogTitle className="font-heading text-2xl font-normal">Edit medication</DialogTitle>
        <DialogDescription className="break-words text-brand-subtle">
          {seed.name} · {formatTablets(seed.dailyDose)} tabl. daily
          {paused ? " · Paused" : ""}
        </DialogDescription>
      </DialogHeader>

      {/* Name and strength */}
      <div className="flex flex-col gap-3">
        <Label htmlFor={id("name")} className="font-semibold">
          Name and strength
        </Label>
        <Input
          id={id("name")}
          name="name"
          autoComplete="off"
          aria-required
          value={draft.name}
          onChange={(event) => change({ name: event.target.value }, "name")}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? id("name-error") : undefined}
        />
        <FieldError id={id("name-error")} message={errors.name} />
      </div>

      {/* Package size */}
      <div className="flex flex-col gap-3">
        <p id={id("package-label")} className="text-sm font-semibold text-foreground">
          Tablets in a full package
        </p>
        <ChipGroup
          id={id("package")}
          labelledBy={id("package-label")}
          describedBy={errors.packageSize ? id("package-error") : undefined}
          options={PACKAGE_OPTIONS}
          value={draft.packageChoice}
          invalid={Boolean(errors.packageSize) && draft.packageChoice !== OTHER}
          onValueChange={(value) => change({ packageChoice: value }, "packageSize")}
        />
        {draft.packageChoice === OTHER ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={id("package-other")} className="text-[13px] font-normal">
              Tablets in your package
            </Label>
            <Input
              id={id("package-other")}
              inputMode="numeric"
              autoComplete="off"
              value={draft.packageOther}
              onChange={(event) => change({ packageOther: event.target.value }, "packageSize")}
              aria-invalid={errors.packageSize ? true : undefined}
              aria-describedby={errors.packageSize ? id("package-error") : undefined}
              className="max-w-[160px]"
            />
          </div>
        ) : null}
        <FieldError id={id("package-error")} message={errors.packageSize} />
      </div>

      {/* Daily dose */}
      <div className="flex flex-col gap-3">
        <p id={id("dose-label")} className="text-sm font-semibold text-foreground">
          Tablets per day
        </p>
        <ChipGroup
          id={id("dose")}
          labelledBy={id("dose-label")}
          describedBy={errors.dailyDose ? id("dose-error") : undefined}
          options={DOSE_OPTIONS}
          value={draft.doseChoice}
          invalid={Boolean(errors.dailyDose) && draft.doseChoice !== OTHER}
          onValueChange={(value) => change({ doseChoice: value }, "dailyDose")}
        />
        {draft.doseChoice === OTHER ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={id("dose-other")} className="text-[13px] font-normal">
              Tablets per day (halves allowed, e.g. 1.5)
            </Label>
            <Input
              id={id("dose-other")}
              inputMode="decimal"
              autoComplete="off"
              value={draft.doseOther}
              onChange={(event) => change({ doseOther: event.target.value }, "dailyDose")}
              aria-invalid={errors.dailyDose ? true : undefined}
              aria-describedby={errors.dailyDose ? id("dose-error") : undefined}
              className="max-w-[160px]"
            />
          </div>
        ) : null}
        <FieldError id={id("dose-error")} message={errors.dailyDose} />
      </div>

      {/* Tablets left now */}
      <div className="flex flex-col gap-3">
        <Label htmlFor={id("pills")} className="font-semibold">
          How many tablets are left now?
        </Label>
        <AmountStepper
          id={id("pills")}
          name="pillsLeft"
          value={pillsLeft}
          min={0}
          max={PILLS_LEFT_MAX}
          invalid={Boolean(errors.pillsLeft)}
          describedBy={
            errors.pillsLeft ? `${id("pills-error")} ${id("pills-hint")}` : id("pills-hint")
          }
          inputRef={pillsRef}
          onChange={(value) => change({ pillsMode: "manual", pillsManual: value }, "pillsLeft")}
        />
        <FieldError id={id("pills-error")} message={errors.pillsLeft} />
        <p id={id("pills-hint")} className="text-[13px] text-brand-subtle">
          {paused
            ? "This medication is paused, so the count stays as it is until you resume it."
            : "Lowering the dose assumes today's dose at the old amount was already taken."}
        </p>
      </div>

      <div aria-live="polite" className="border-t pt-5">
        {preview ? (
          <StockLine label="After saving" stock={preview} showDot />
        ) : (
          <p className="text-sm text-brand-subtle">
            Enter the daily dose and tablets left to see the result.
          </p>
        )}
      </div>

      {state.status === "error" && state.message ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-3 sm:justify-end">
        <DialogClose asChild>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isPending}
            className="flex-1 sm:flex-none"
          >
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" size="lg" disabled={isPending} className="flex-1 sm:flex-none">
          {isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
