"use client";

import { ArrowLeft, Check } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDays, formatLongDate, formatTablets } from "@/lib/medications/format";
import type { Stock } from "@/lib/medications/stock";
import type { MedicationField, MedicationValues } from "@/lib/medications/validation";
import { cn } from "@/lib/utils";
import { urgencyBgClass, urgencyLabel } from "./urgency";

type MedicationReviewStepProps = {
  profileId: string;
  values: MedicationValues;
  stock: Stock;
  formAction: (formData: FormData) => void;
  isPending: boolean;
  errorMessage?: string;
  onBack: () => void;
  onChangeField: (field: MedicationField) => void;
};

/** Step 2 of the add-medication wizard (mock 182:300): the numbers before saving. */
export function MedicationReviewStep({
  profileId,
  values,
  stock,
  formAction,
  isPending,
  errorMessage,
  onBack,
  onChangeField,
}: MedicationReviewStepProps) {
  const tiles: { field: MedicationField; label: string; value: string }[] = [
    { field: "name", label: "Name", value: values.name },
    { field: "pillsLeft", label: "You have now", value: `${formatTablets(values.pillsLeft)} tabl.` },
    {
      field: "dailyDose",
      label: "Daily dose",
      value: `${formatTablets(values.dailyDose)} tabl. a day`,
    },
    { field: "packageSize", label: "Full package", value: `${values.packageSize} tabl.` },
  ];

  return (
    <form action={formAction} className="flex min-h-0 flex-1 flex-col">
      <input type="hidden" name="profileId" value={profileId} />
      <input type="hidden" name="name" value={values.name} />
      <input type="hidden" name="packageSize" value={String(values.packageSize)} />
      <input type="hidden" name="pillsLeft" value={String(values.pillsLeft)} />
      <input type="hidden" name="dailyDose" value={String(values.dailyDose)} />

      <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-5 py-6 sm:px-8">
        <Card className="gap-3 px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="min-w-0 font-heading text-2xl break-words text-foreground">
              {values.name}
            </p>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold text-foreground">
              <span
                aria-hidden
                className={cn("size-2 rounded-full", urgencyBgClass[stock.urgency])}
              />
              {urgencyLabel[stock.urgency]}
            </span>
          </div>
          {stock.runOutDate ? (
            <>
              <p className="font-heading text-4xl text-foreground">
                Lasts {formatDays(stock.daysLeft)}
              </p>
              <p className="text-base text-brand-subtle">
                Runs out on{" "}
                <span className="font-semibold text-foreground">
                  {formatLongDate(stock.runOutDate)}
                </span>
              </p>
            </>
          ) : (
            <p className="text-base text-foreground">Not enough for a full day&apos;s dose</p>
          )}
        </Card>

        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {tiles.map((tile) => (
            <div
              key={tile.field}
              className="flex items-start justify-between gap-3 rounded-xl border bg-card px-4 py-3"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <dt className="text-[13px] text-brand-subtle">{tile.label}</dt>
                <dd className="text-base font-semibold break-words text-foreground">
                  {tile.value}
                </dd>
              </div>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto shrink-0 px-0"
                aria-label={`Change ${tile.label.toLowerCase()}`}
                onClick={() => onChangeField(tile.field)}
              >
                Change
              </Button>
            </div>
          ))}
        </dl>

        <p className="text-[13px] text-brand-subtle">
          From tomorrow the stock updates itself. We always round the date to the earlier side.
        </p>

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <div className="flex gap-4 border-t px-5 py-5 sm:justify-end sm:px-8">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onBack}
          className="flex-1 sm:flex-none"
        >
          <ArrowLeft data-icon="inline-start" aria-hidden />
          Back
        </Button>
        <Button type="submit" size="lg" disabled={isPending} className="flex-1 sm:flex-none">
          <Check data-icon="inline-start" aria-hidden />
          {isPending ? "Saving…" : "Save medication"}
        </Button>
      </div>
    </form>
  );
}
