"use client";

import { useId } from "react";

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
import { Label } from "@/components/ui/label";
import { countCorrectedMessage } from "@/lib/feedback/messages";
import { correctPillCount } from "@/lib/medications/actions";
import { formatTablets } from "@/lib/medications/format";
import { computeStock, correctCount } from "@/lib/medications/stock";
import { PILLS_LEFT_MAX, parseAmount, validatePillsLeft } from "@/lib/medications/validation";
import {
  AmountStepper,
  BaselineFields,
  FieldError,
  StockLine,
  useStockForm,
  type StockDialogProps,
} from "./stock-dialog-parts";

/**
 * "Correct the count" dialog (FR-011): set the tablets left after a recount. Controlled — the
 * card's options menu opens it.
 */
export function CorrectCountDialog({
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
      <DialogContent className={FORM_DIALOG_CONTENT_CLASS}>
        {/* Content unmounts when closed, so every opening pre-fills today's expected count. */}
        <CorrectCountForm
          medication={medication}
          today={today}
          guardSave={guard.guardSave}
          onSaved={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function CorrectCountForm({
  medication,
  today,
  guardSave,
  onSaved,
}: StockDialogProps & { guardSave: GuardSave; onSaved: () => void }) {
  const id = useId();
  const paused = medication.pausedOn !== null;
  // While paused this is the frozen count; the correction keeps the pause.
  const expected = computeStock(medication, today).pillsLeft;

  const form = useStockForm({
    action: correctPillCount,
    initialAmount: String(expected),
    validate: validatePillsLeft,
    successMessage: (counted) => countCorrectedMessage(medication.name, counted),
    guardSave,
    onSaved,
  });

  // Preview only from a valid amount: correctCount throws on non-half or negative tablets.
  const tablets = validatePillsLeft(form.amount) ? null : (parseAmount(form.amount) as number);
  const after =
    tablets === null ? null : computeStock(correctCount(medication, today, tablets), today);
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <form
      action={form.formAction}
      onSubmit={form.handleSubmit}
      noValidate
      className="flex flex-col gap-5"
    >
      <BaselineFields medication={medication} />

      <DialogHeader className="gap-1.5 pr-8">
        <DialogTitle className="font-heading text-2xl font-normal">Correct the count</DialogTitle>
        <DialogDescription className="break-words text-brand-subtle">
          {medication.name} · {formatTablets(medication.dailyDose)} tabl. daily
        </DialogDescription>
      </DialogHeader>

      <p className="rounded-xl border bg-card px-4 py-3 text-sm text-foreground">
        We expect now: <span className="font-semibold">{formatTablets(expected)} tabl.</span>
      </p>

      <div className="flex flex-col gap-3">
        <Label htmlFor={`${id}-tablets`} className="font-semibold">
          How many tablets do you have now?
        </Label>
        <AmountStepper
          id={`${id}-tablets`}
          name="tablets"
          value={form.amount}
          min={0}
          max={PILLS_LEFT_MAX}
          invalid={Boolean(form.fieldError)}
          describedBy={form.fieldError ? `${errorId} ${hintId}` : hintId}
          inputRef={form.inputRef}
          onChange={form.changeAmount}
        />
        <FieldError id={errorId} message={form.fieldError} />
        <p id={hintId} className="text-[13px] text-brand-subtle">
          Count every tablet you have, including open packages.{" "}
          {paused
            ? "This medication is paused, so the count stays as it is until you resume it."
            : "Today's dose is taken from this number."}
        </p>
      </div>

      <div aria-live="polite">
        {after ? (
          <StockLine label="After correcting" stock={after} showDot />
        ) : (
          <p className="text-sm text-brand-subtle">Enter the tablets you have to see the result.</p>
        )}
      </div>

      {form.errorMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{form.errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-3 sm:justify-end">
        <DialogClose asChild>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={form.isPending}
            className="flex-1 sm:flex-none"
          >
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" size="lg" disabled={form.isPending} className="flex-1 sm:flex-none">
          {form.isPending ? "Saving…" : "Save count"}
        </Button>
      </div>
    </form>
  );
}
