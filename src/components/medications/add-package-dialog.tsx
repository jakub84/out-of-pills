"use client";

import { Plus } from "lucide-react";
import { useId, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { addPackage } from "@/lib/medications/actions";
import { formatDays, formatTablets } from "@/lib/medications/format";
import { addPackage as addPackageToStock, computeStock } from "@/lib/medications/stock";
import {
  PACKAGE_AMOUNT_MAX,
  PACKAGE_AMOUNT_MIN,
  parseAmount,
  validatePackageAmount,
  validateResultingCount,
} from "@/lib/medications/validation";
import {
  AmountStepper,
  BaselineFields,
  FieldError,
  STOCK_DIALOG_CONTENT_CLASS,
  StockLine,
  useStockForm,
  type StockDialogProps,
} from "./stock-dialog-parts";

/** "+ Add package" button and dialog (mock 182:304): restock with the effect shown first. */
export function AddPackageDialog({ medication, today }: StockDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="md" className="w-full @3xl:w-auto @3xl:min-w-[148px]">
          <Plus data-icon="inline-start" className="size-3" aria-hidden />
          Add package<span className="sr-only"> of {medication.name}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className={STOCK_DIALOG_CONTENT_CLASS}>
        {/* Content unmounts when closed, so every opening pre-fills the package size again. */}
        <AddPackageForm medication={medication} today={today} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function AddPackageForm({
  medication,
  today,
  onSaved,
}: StockDialogProps & { onSaved: () => void }) {
  const id = useId();
  const now = computeStock(medication, today);

  // The resulting count must fit the 9999 limit too, like the server action checks.
  function validate(value: string): string | undefined {
    const error = validatePackageAmount(value);
    if (error) return error;
    const tablets = parseAmount(value) as number;
    return validateResultingCount(addPackageToStock(medication, today, tablets).pillsCounted);
  }

  const form = useStockForm({
    action: addPackage,
    initialAmount: String(medication.packageSize),
    validate,
    onSaved,
  });

  // Preview only from a valid amount: addPackage throws on non-half or negative tablets.
  const tablets = validatePackageAmount(form.amount) ? null : (parseAmount(form.amount) as number);
  const after =
    tablets === null ? null : computeStock(addPackageToStock(medication, today, tablets), today);
  const extendsBy = after ? after.daysLeft - now.daysLeft : null;
  const errorId = `${id}-error`;

  return (
    <form
      action={form.formAction}
      onSubmit={form.handleSubmit}
      noValidate
      className="flex flex-col gap-5"
    >
      <BaselineFields medication={medication} />

      <DialogHeader className="gap-1.5 pr-8">
        <DialogTitle className="font-heading text-2xl font-normal">Add package</DialogTitle>
        <DialogDescription className="break-words text-brand-subtle">
          {medication.name} · {formatTablets(medication.dailyDose)} tabl. daily
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-1.5 rounded-xl border bg-card px-4 py-3">
        <p className="text-[13px] text-brand-subtle">
          Remembered package:{" "}
          <span className="font-semibold text-foreground">{medication.packageSize} tabl.</span>
        </p>
        <StockLine label="Now" stock={now} />
      </div>

      <div className="flex flex-col gap-3">
        <Label htmlFor={`${id}-tablets`} className="font-semibold">
          Tablets to add
        </Label>
        <AmountStepper
          id={`${id}-tablets`}
          name="tablets"
          value={form.amount}
          min={PACKAGE_AMOUNT_MIN}
          max={PACKAGE_AMOUNT_MAX}
          invalid={Boolean(form.fieldError)}
          describedBy={form.fieldError ? errorId : undefined}
          inputRef={form.inputRef}
          onChange={form.changeAmount}
        />
        <FieldError id={errorId} message={form.fieldError} />
      </div>

      <div aria-live="polite" className="flex flex-col gap-1.5">
        {after && tablets !== null && extendsBy !== null ? (
          <>
            <p className="text-sm text-brand-subtle">
              <span className="font-semibold text-foreground">+{formatTablets(tablets)} tabl.</span>
              {" · "}stock extends by {formatDays(extendsBy)}
            </p>
            <StockLine label="After adding" stock={after} showDot />
          </>
        ) : (
          <p className="text-sm text-brand-subtle">Enter the tablets to add to see the result.</p>
        )}
      </div>

      {form.errorMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{form.errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-3 sm:justify-end">
        <DialogClose asChild>
          <Button type="button" variant="outline" size="lg" className="flex-1 sm:flex-none">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" size="lg" disabled={form.isPending} className="flex-1 sm:flex-none">
          {form.isPending
            ? "Adding…"
            : tablets !== null
              ? `Add ${formatTablets(tablets)} tabl.`
              : "Add tablets"}
        </Button>
      </div>
    </form>
  );
}
