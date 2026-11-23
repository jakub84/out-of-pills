"use client";

import { useActionState, useState } from "react";
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
import { medicationPausedMessage, medicationResumedMessage } from "@/lib/feedback/messages";
import { runSaveAction } from "@/lib/feedback/run-save-action";
import { pauseMedication, resumeMedication } from "@/lib/medications/actions";
import { initialStockFormState, type StockFormState } from "@/lib/medications/form-state";
import { computeStock, pauseStock, resumeStock } from "@/lib/medications/stock";
import {
  BaselineFields,
  StockLine,
  type StockDialogMedication,
  type StockDialogProps,
} from "./stock-dialog-parts";

/**
 * Pause / resume confirmation (FR-012): pauses an active medication, resumes a paused one, and
 * shows the resulting stock before saving. Controlled — the card's options menu opens it.
 */
export function PauseMedicationDialog({
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
        {/* Content unmounts when closed, so every opening starts without an old error. */}
        <PauseMedicationForm
          medication={medication}
          today={today}
          guardSave={guard.guardSave}
          onSaved={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function PauseMedicationForm({
  medication,
  today,
  guardSave,
  onSaved,
}: StockDialogProps & { guardSave: GuardSave; onSaved: () => void }) {
  // Live until the save succeeds, then frozen: the refreshed card must not flip the
  // direction while the dialog closes, but a retry after a stale error must send the
  // refreshed baseline (and offer the right direction).
  const [frozen, setFrozen] = useState<StockDialogMedication | null>(null);
  const shown = frozen ?? medication;
  const resuming = shown.pausedOn !== null;
  const action = resuming ? resumeMedication : pauseMedication;
  const successMessage = resuming ? medicationResumedMessage : medicationPausedMessage;
  const after = computeStock(resuming ? resumeStock(shown, today) : pauseStock(shown, today), today);

  const [state, formAction, isPending] = useActionState(
    async (prev: StockFormState, formData: FormData) => {
      // A failed request keeps the dialog open.
      const result = await runSaveAction(
        () => guardSave(() => action(prev, formData)),
        initialStockFormState,
      );
      if (result.status === "success") {
        setFrozen(shown);
        toast.success(successMessage(shown.name));
        onSaved();
      }
      return result;
    },
    initialStockFormState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <BaselineFields medication={shown} />

      <DialogHeader className="gap-1.5 pr-8">
        <DialogTitle className="font-heading text-2xl font-normal break-words">
          {resuming ? "Resume" : "Pause"} {shown.name}?
        </DialogTitle>
        <DialogDescription className="text-brand-subtle">
          {resuming
            ? "Stock starts decreasing again from today, with today as the first day."
            : "Stock stops decreasing. Today's dose is counted as taken."}
        </DialogDescription>
      </DialogHeader>

      <StockLine
        label={resuming ? "After resuming" : "Stays at"}
        stock={after}
        showDot
        className="rounded-xl border bg-card px-4 py-3"
      />

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
          {isPending ? "Saving…" : resuming ? "Resume" : "Pause"}
        </Button>
      </div>
    </form>
  );
}
