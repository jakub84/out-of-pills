"use client";

import { Plus } from "lucide-react";
import { useActionState, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { readField } from "@/lib/auth/validation";
import { medicationAddedMessage } from "@/lib/feedback/messages";
import { runSaveAction } from "@/lib/feedback/run-save-action";
import { addMedication } from "@/lib/medications/actions";
import {
  initialMedicationFormState,
  type MedicationFormState,
} from "@/lib/medications/form-state";
import {
  validateMedication,
  type MedicationField,
  type MedicationFieldErrors,
} from "@/lib/medications/validation";
import { cn } from "@/lib/utils";
import { focusChipGroup } from "./chip-group";
import { MedicationDetailsStep, type DetailsFieldIds } from "./medication-details-step";
import {
  OTHER,
  draftInput,
  initialDraft,
  previewStock,
  type MedicationDraft,
} from "./medication-draft";
import { MedicationReviewStep } from "./medication-review-step";

type AddMedicationDialogProps = {
  profileId: string;
  profileName: string;
  /**
   * Today in Warsaw (YYYY-MM-DD) from the server, like the database's `counted_on`.
   * Never the browser clock: a fast device clock would push the previewed
   * run-out date later than the real one.
   */
  today: string;
};

const STEPS = ["Medication details", "Review & confirm"] as const;
const FIELD_ORDER: MedicationField[] = ["name", "packageSize", "pillsLeft", "dailyDose"];

/** "Add medication" button and the two-step dialog (mocks 177:601, 182:300). */
export function AddMedicationDialog({ profileId, profileName, today }: AddMedicationDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg">
          <Plus data-icon="inline-start" aria-hidden />
          Add medication
        </Button>
      </DialogTrigger>
      <DialogContent
        className={cn(
          // Phones: full screen. From sm: a centred dialog.
          "top-0 left-0 flex h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0",
          "sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[min(92dvh,900px)] sm:max-w-[640px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl",
        )}
      >
        {/* Content unmounts when closed, so every opening starts a fresh wizard. */}
        <AddMedicationWizard
          profileId={profileId}
          profileName={profileName}
          today={today}
          onSaved={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function AddMedicationWizard({
  profileId,
  profileName,
  today,
  onSaved,
}: AddMedicationDialogProps & { onSaved: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [draft, setDraft] = useState<MedicationDraft>(initialDraft);
  const [errors, setErrors] = useState<MedicationFieldErrors>({});

  const titleRef = useRef<HTMLHeadingElement>(null);
  const baseId = useId();
  const fieldIds: DetailsFieldIds = {
    name: `${baseId}-name`,
    packageGroup: `${baseId}-package`,
    packageOther: `${baseId}-package-other`,
    pills: `${baseId}-pills`,
    doseGroup: `${baseId}-dose`,
    doseOther: `${baseId}-dose-other`,
  };

  const [state, formAction, isPending] = useActionState(
    async (prev: MedicationFormState, formData: FormData) => {
      // A failed request keeps the wizard on this step, with the draft in its state.
      const result = await runSaveAction(
        () => addMedication(prev, formData),
        initialMedicationFormState,
      );
      if (result.status === "success") {
        toast.success(medicationAddedMessage(readField(formData, "name")));
        onSaved();
      } else if (result.fieldErrors) {
        setErrors(result.fieldErrors);
        setStep(1);
      }
      return result;
    },
    initialMedicationFormState,
  );

  const input = draftInput(draft);
  const preview = previewStock(input, today);
  const validated = validateMedication(input);

  function focusElement(id: string) {
    document.getElementById(id)?.focus();
  }

  function focusField(field: MedicationField) {
    switch (field) {
      case "name":
        focusElement(fieldIds.name);
        break;
      case "packageSize":
        if (draft.packageChoice === OTHER) focusElement(fieldIds.packageOther);
        else focusChipGroup(fieldIds.packageGroup);
        break;
      case "pillsLeft":
        focusElement(fieldIds.pills);
        break;
      case "dailyDose":
        if (draft.doseChoice === OTHER) focusElement(fieldIds.doseOther);
        else focusChipGroup(fieldIds.doseGroup);
        break;
    }
  }

  function goToStep(next: 1 | 2, focus?: MedicationField) {
    // Render the step synchronously so focus can move into it.
    flushSync(() => setStep(next));
    if (focus) focusField(focus);
    else titleRef.current?.focus();
  }

  function handleChange(patch: Partial<MedicationDraft>, field: MedicationField) {
    setDraft((current) => ({ ...current, ...patch }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function handleNext() {
    if (!validated.ok) {
      const fieldErrors = { ...validated.fieldErrors };
      // "Left now" still follows an invalid package size: only the package needs fixing.
      if (draft.pillsMode !== "manual" && fieldErrors.packageSize) fieldErrors.pillsLeft = undefined;
      setErrors(fieldErrors);
      const first = FIELD_ORDER.find((field) => fieldErrors[field]);
      if (first) focusField(first);
      return;
    }
    setErrors({});
    goToStep(2);
  }

  return (
    <>
      <DialogHeader className="gap-3 border-b px-5 pt-5 pb-4 pr-12 sm:px-8 sm:pt-7">
        <DialogTitle
          ref={titleRef}
          tabIndex={-1}
          className="font-heading text-2xl font-normal outline-none sm:text-[28px]"
        >
          Add medication
        </DialogTitle>
        <DialogDescription className="text-brand-subtle">
          For {profileName} · Step {step} of 2: {STEPS[step - 1]}
        </DialogDescription>
        <ol aria-hidden className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {STEPS.map((label, index) => {
            const number = index + 1;
            const current = number === step;
            return (
              <li
                key={label}
                className={cn(
                  "flex items-center gap-2",
                  // Connector line between steps.
                  index > 0 && "before:mr-2 before:h-px before:w-8 before:bg-border sm:before:w-14",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                    current
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {number}
                </span>
                <span className={current ? "font-semibold text-foreground" : "text-muted-foreground"}>
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      </DialogHeader>

      {step === 1 || !validated.ok || !preview ? (
        <MedicationDetailsStep
          draft={draft}
          input={input}
          preview={preview}
          errors={errors}
          fieldIds={fieldIds}
          onChange={handleChange}
          onNext={handleNext}
        />
      ) : (
        <MedicationReviewStep
          profileId={profileId}
          values={validated.values}
          stock={preview}
          formAction={formAction}
          isPending={isPending}
          errorMessage={state.status === "error" ? state.message : undefined}
          onBack={() => goToStep(1)}
          onChangeField={(field) => goToStep(1, field)}
        />
      )}
    </>
  );
}
