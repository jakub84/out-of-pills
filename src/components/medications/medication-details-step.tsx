"use client";

import { ArrowRight, Minus, Plus } from "lucide-react";
import { useId, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDays, formatShortDate } from "@/lib/medications/format";
import type { Stock } from "@/lib/medications/stock";
import {
  PILLS_LEFT_MAX,
  parseAmount,
  type MedicationFieldErrors,
  type MedicationInput,
} from "@/lib/medications/validation";
import { cn } from "@/lib/utils";
import { ChipGroup } from "./chip-group";
import {
  DOSE_CHIPS,
  OTHER,
  PACKAGE_CHIPS,
  packageSizeOf,
  type MedicationDraft,
} from "./medication-draft";
import { urgencyBgClass } from "./urgency";

/** Element ids of the focusable fields, so the wizard can move focus to them. */
export type DetailsFieldIds = {
  name: string;
  packageGroup: string;
  packageOther: string;
  pills: string;
  doseGroup: string;
  doseOther: string;
};

type MedicationDetailsStepProps = {
  draft: MedicationDraft;
  input: MedicationInput;
  preview: Stock | null;
  errors: MedicationFieldErrors;
  fieldIds: DetailsFieldIds;
  onChange: (patch: Partial<MedicationDraft>, field: keyof MedicationFieldErrors) => void;
  onNext: () => void;
};

const PACKAGE_OPTIONS = [
  ...PACKAGE_CHIPS.map((value) => ({ value, label: value })),
  { value: OTHER, label: "Other" },
];
const DOSE_OPTIONS = [
  ...DOSE_CHIPS.map((value) => ({ value, label: value })),
  { value: OTHER, label: "Other" },
];

/** Step 1 of the add-medication wizard (mock 177:601). */
export function MedicationDetailsStep({
  draft,
  input,
  preview,
  errors,
  fieldIds,
  onChange,
  onNext,
}: MedicationDetailsStepProps) {
  const ids = useId();
  const id = (suffix: string) => `${ids}-${suffix}`;
  const packageSize = packageSizeOf(draft);

  function stepPills(delta: number) {
    const current = parseAmount(input.pillsLeft) ?? 0;
    const next = Math.min(PILLS_LEFT_MAX, Math.max(0, current + delta));
    onChange({ pillsMode: "manual", pillsManual: String(next) }, "pillsLeft");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onNext();
  }

  const pillsOptions =
    packageSize === null
      ? []
      : [
          { value: "full", label: `Full package (${packageSize})` },
          { value: "double", label: `2 packages (${packageSize * 2})` },
        ];

  return (
    <form noValidate onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-10 overflow-y-auto px-5 py-6 sm:px-8">
        {/* Name and strength */}
        <div className="flex flex-col gap-3">
          <Label htmlFor={fieldIds.name} className="font-semibold">
            Name and strength
          </Label>
          <Input
            id={fieldIds.name}
            autoComplete="off"
            aria-required
            value={draft.name}
            onChange={(event) => onChange({ name: event.target.value }, "name")}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? `${id("name-error")} ${id("name-hint")}` : id("name-hint")}
          />
          <FieldError id={id("name-error")} message={errors.name} />
          <p id={id("name-hint")} className="text-[13px] text-brand-subtle">
            Type it as on the package, e.g. Bisocard 5 mg.
          </p>
        </div>

        {/* Package size */}
        <div className="flex flex-col gap-3">
          <p id={id("package-label")} className="text-sm font-semibold text-foreground">
            Tablets in a full package
          </p>
          <ChipGroup
            id={fieldIds.packageGroup}
            labelledBy={id("package-label")}
            describedBy={errors.packageSize ? id("package-error") : undefined}
            options={PACKAGE_OPTIONS}
            value={draft.packageChoice}
            invalid={Boolean(errors.packageSize) && draft.packageChoice !== OTHER}
            onValueChange={(value) => onChange({ packageChoice: value }, "packageSize")}
          />
          {draft.packageChoice === OTHER ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={fieldIds.packageOther} className="text-[13px] font-normal">
                Tablets in your package
              </Label>
              <Input
                id={fieldIds.packageOther}
                inputMode="numeric"
                autoComplete="off"
                value={draft.packageOther}
                onChange={(event) =>
                  onChange({ packageOther: event.target.value }, "packageSize")
                }
                aria-invalid={errors.packageSize ? true : undefined}
                aria-describedby={errors.packageSize ? id("package-error") : undefined}
                className="max-w-[160px]"
              />
            </div>
          ) : null}
          <FieldError id={id("package-error")} message={errors.packageSize} />
        </div>

        {/* Tablets left now */}
        <div className="flex flex-col gap-3">
          <Label htmlFor={fieldIds.pills} className="font-semibold">
            How many tablets are left now?
          </Label>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              aria-label="One tablet less"
              onClick={() => stepPills(-1)}
              className="rounded-full"
            >
              <Minus aria-hidden />
            </Button>
            <Input
              id={fieldIds.pills}
              inputMode="decimal"
              autoComplete="off"
              aria-required
              value={input.pillsLeft}
              onChange={(event) =>
                onChange({ pillsMode: "manual", pillsManual: event.target.value }, "pillsLeft")
              }
              aria-invalid={errors.pillsLeft ? true : undefined}
              aria-describedby={
                errors.pillsLeft ? `${id("pills-error")} ${id("pills-hint")}` : id("pills-hint")
              }
              className="max-w-[120px] text-center"
            />
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              aria-label="One tablet more"
              onClick={() => stepPills(1)}
              className="rounded-full"
            >
              <Plus aria-hidden />
            </Button>
          </div>
          <FieldError id={id("pills-error")} message={errors.pillsLeft} />
          {pillsOptions.length > 0 ? (
            <>
              <p id={id("pills-chips-label")} className="sr-only">
                Fill in from the package size
              </p>
              <ChipGroup
                labelledBy={id("pills-chips-label")}
                options={pillsOptions}
                value={draft.pillsMode === "manual" ? "" : draft.pillsMode}
                onValueChange={(value) => {
                  if (value === "full" || value === "double") {
                    onChange({ pillsMode: value }, "pillsLeft");
                  }
                }}
              />
            </>
          ) : null}
          <p id={id("pills-hint")} className="text-[13px] text-brand-subtle">
            Count once — we count for you from then on.
          </p>
        </div>

        {/* Daily dose */}
        <div className="flex flex-col gap-3">
          <p id={id("dose-label")} className="text-sm font-semibold text-foreground">
            Tablets per day
          </p>
          <ChipGroup
            id={fieldIds.doseGroup}
            labelledBy={id("dose-label")}
            describedBy={errors.dailyDose ? id("dose-error") : undefined}
            options={DOSE_OPTIONS}
            value={draft.doseChoice}
            invalid={Boolean(errors.dailyDose) && draft.doseChoice !== OTHER}
            onValueChange={(value) => onChange({ doseChoice: value }, "dailyDose")}
          />
          {draft.doseChoice === OTHER ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={fieldIds.doseOther} className="text-[13px] font-normal">
                Tablets per day (halves allowed, e.g. 1.5)
              </Label>
              <Input
                id={fieldIds.doseOther}
                inputMode="decimal"
                autoComplete="off"
                value={draft.doseOther}
                onChange={(event) => onChange({ doseOther: event.target.value }, "dailyDose")}
                aria-invalid={errors.dailyDose ? true : undefined}
                aria-describedby={errors.dailyDose ? id("dose-error") : undefined}
                className="max-w-[160px]"
              />
            </div>
          ) : null}
          <FieldError id={id("dose-error")} message={errors.dailyDose} />
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <StockPreview preview={preview} />
        <div className="flex gap-4 sm:shrink-0">
          <DialogClose asChild>
            <Button type="button" variant="outline" size="lg" className="flex-1 sm:flex-none">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" size="lg" className="flex-1 sm:flex-none">
            Next: review
            <ArrowRight data-icon="inline-end" aria-hidden />
          </Button>
        </div>
      </div>
    </form>
  );
}

/** "Lasts N days · until Fri 13 Nov" with an urgency dot; announced as it changes. */
function StockPreview({ preview }: { preview: Stock | null }) {
  return (
    <p aria-live="polite" className="flex min-w-0 items-center gap-2 text-sm text-foreground">
      {preview ? (
        <>
          <span
            aria-hidden
            className={cn("size-2.5 shrink-0 rounded-full", urgencyBgClass[preview.urgency])}
          />
          {preview.runOutDate ? (
            <span>
              Lasts <span className="font-semibold">{formatDays(preview.daysLeft)}</span> · until{" "}
              <span className="font-semibold">{formatShortDate(preview.runOutDate)}</span>
            </span>
          ) : (
            <span>Not enough for a full day&apos;s dose</span>
          )}
        </>
      ) : (
        <span className="text-brand-subtle">Enter the stock and daily dose to see how long it lasts.</span>
      )}
    </p>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  );
}
