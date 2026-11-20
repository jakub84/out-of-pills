"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";

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
import { medicationRemovedMessage } from "@/lib/feedback/messages";
import { runSaveAction } from "@/lib/feedback/run-save-action";
import { removeMedication } from "@/lib/medications/actions";
import { initialStockFormState, type StockFormState } from "@/lib/medications/form-state";
import { STOCK_DIALOG_CONTENT_CLASS, type StockDialogMedication } from "./stock-dialog-parts";
import { useSaveGuard, type GuardSave } from "./use-save-guard";

type RemoveDialogMedication = Pick<StockDialogMedication, "id" | "name" | "pausedOn">;

/**
 * Remove confirmation (FR-013): deletes the medication and its stock for good; pausing stays
 * the reversible alternative. Controlled — the card's options menu opens it.
 */
export function RemoveMedicationDialog({
  medication,
  open,
  onOpenChange,
}: {
  medication: RemoveDialogMedication;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const guard = useSaveGuard(onOpenChange);

  return (
    <Dialog open={open} onOpenChange={guard.onOpenChange}>
      <DialogContent className={STOCK_DIALOG_CONTENT_CLASS}>
        {/* Content unmounts when closed, so every opening starts without an old error. */}
        <RemoveMedicationForm
          medication={medication}
          guardSave={guard.guardSave}
          onSaved={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function RemoveMedicationForm({
  medication,
  guardSave,
  onSaved,
}: {
  medication: RemoveDialogMedication;
  guardSave: GuardSave;
  onSaved: () => void;
}) {
  // Frozen once the removal succeeds, so the dialog keeps the name it opened with while it
  // closes, even if the card re-renders before it unmounts.
  const [frozen, setFrozen] = useState<RemoveDialogMedication | null>(null);
  const shown = frozen ?? medication;
  const paused = shown.pausedOn !== null;

  const [state, formAction, isPending] = useActionState(
    async (prev: StockFormState, formData: FormData) => {
      // A failed request keeps the dialog open.
      const result = await runSaveAction(
        () => guardSave(() => removeMedication(prev, formData)),
        initialStockFormState,
      );
      if (result.status === "success") {
        setFrozen(shown);
        // Before closing: the card unmounts after the revalidation, taking the dialog with it.
        toast.success(medicationRemovedMessage(shown.name));
        onSaved();
      }
      return result;
    },
    initialStockFormState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="medicationId" value={shown.id} />

      <DialogHeader className="gap-1.5 pr-8">
        <DialogTitle className="font-heading text-2xl font-normal break-words">
          Remove {shown.name}?
        </DialogTitle>
        <DialogDescription className="text-brand-subtle">
          This removes {shown.name} and its stock from this profile. This can&apos;t be undone.
          {paused ? null : " To stop it for a while instead, use Pause."}
        </DialogDescription>
      </DialogHeader>

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
        <Button
          type="submit"
          variant="destructive"
          size="lg"
          disabled={isPending}
          className="flex-1 sm:flex-none"
        >
          {isPending ? "Removing…" : "Remove"}
        </Button>
      </div>
    </form>
  );
}
