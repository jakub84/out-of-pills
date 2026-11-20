"use client";

import { ArrowRight, Plus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { packageAddedMessage } from "@/lib/feedback/messages";
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
  StockSnapshot,
  useStockForm,
  type StockDialogProps,
} from "./stock-dialog-parts";
import { ChipGroup } from "./chip-group";
import { useSaveGuard, type GuardSave } from "./use-save-guard";

const PACKAGE_COUNTS = [1, 2, 3] as const;
/** Pack sizes offered in the dropdown; the remembered size is always added. */
const COMMON_PACKAGE_SIZES = [10, 14, 20, 28, 30, 50, 56, 60, 90, 100];

/** "1 package" … "3 packages" of `size` tablets, within the per-add amount limit. */
function packageCountOptions(size: number) {
  return PACKAGE_COUNTS.map((count) => ({
    count,
    value: String(count),
    label: count === 1 ? "1 package" : `${count} packages`,
    tablets: count * size,
  })).filter((option) => option.tablets <= PACKAGE_AMOUNT_MAX);
}

/**
 * "+ Add package" button and dialog (mock 182:304): restock with the effect shown first. Not
 * offered while the medication is paused (the card hides it; the action rejects it).
 */
export function AddPackageDialog({ medication, today }: StockDialogProps) {
  const [open, setOpen] = useState(false);
  const { onOpenChange, guardSave } = useSaveGuard(setOpen);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="md" className="w-full @3xl:w-auto @3xl:min-w-[148px]">
          <Plus data-icon="inline-start" className="size-3" aria-hidden />
          Add package<span className="sr-only"> of {medication.name}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className={STOCK_DIALOG_CONTENT_CLASS}>
        {/* Content unmounts when closed, so every opening pre-fills the package size again. */}
        <AddPackageForm
          medication={medication}
          today={today}
          guardSave={guardSave}
          onSaved={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function AddPackageForm({
  medication,
  today,
  guardSave,
  onSaved,
}: StockDialogProps & { guardSave: GuardSave; onSaved: () => void }) {
  const id = useId();
  const now = computeStock(medication, today);
  const [packageSize, setPackageSize] = useState(medication.packageSize);

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
    successMessage: (added) => packageAddedMessage(medication.name, added),
    guardSave,
    onSaved,
  });

  // Preview only from a valid amount: addPackage throws on non-half or negative tablets.
  const tablets = validatePackageAmount(form.amount) ? null : (parseAmount(form.amount) as number);
  const after =
    tablets === null ? null : computeStock(addPackageToStock(medication, today, tablets), today);
  const extendsBy = after ? after.daysLeft - now.daysLeft : null;

  // 1–3 whole packages of the chosen size; counts above the amount limit are left out.
  const packageOptions = packageCountOptions(packageSize);
  const selectedCount = packageOptions.find((option) => option.tablets === tablets)?.count;
  const sizeChanged = packageSize !== medication.packageSize;
  const sizeOptions = [...new Set([...COMMON_PACKAGE_SIZES, medication.packageSize])].sort(
    (a, b) => a - b,
  );

  // A new size keeps the chosen number of packages (1 if none fits), e.g. 2 × 28 → 2 × 56.
  function changePackageSize(value: string) {
    const size = Number(value);
    setPackageSize(size);
    const count = selectedCount ?? 1;
    const fits = packageCountOptions(size).find((option) => option.count === count);
    form.changeAmount(String(fits ? fits.tablets : size));
  }

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

      <div className="flex flex-col gap-3">
        {/* Sent only when changed: the action then saves it as the remembered size. */}
        {sizeChanged ? <input type="hidden" name="packageSize" value={packageSize} /> : null}
        <Label htmlFor={`${id}-size`} className="font-semibold">
          Package size
        </Label>
        <Select value={String(packageSize)} onValueChange={changePackageSize}>
          <SelectTrigger id={`${id}-size`} className="bg-card font-semibold">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sizeOptions.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size} tabl.{size === medication.packageSize ? " (remembered)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {sizeChanged ? (
          <p className="text-[13px] text-brand-subtle">
            {packageSize} tabl. will be remembered as the package size when you add.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <span id={`${id}-packages`} className="text-sm font-semibold">
          Packages
        </span>
        <ChipGroup
          labelledBy={`${id}-packages`}
          options={packageOptions}
          value={selectedCount === undefined ? "" : String(selectedCount)}
          onValueChange={(value) => {
            const option = packageOptions.find((o) => o.value === value);
            if (option) form.changeAmount(String(option.tablets));
          }}
        />
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

      {/* Before/after comparison below a divider: one summary line, then Now → After adding. */}
      <section aria-live="polite" className="flex flex-col gap-3 border-t pt-5">
        <p className="text-sm text-foreground">
          {tablets !== null && extendsBy !== null ? (
            <>
              <span className="font-semibold">+{formatTablets(tablets)} tabl.</span>
              <span className="text-brand-subtle"> · stock lasts </span>
              <span className="font-semibold">{formatDays(extendsBy)} longer</span>
            </>
          ) : (
            <span className="text-brand-subtle">Enter the tablets to add to see the result.</span>
          )}
        </p>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <StockSnapshot label="Now" stock={now} />
          <ArrowRight className="size-4 text-brand-subtle" aria-hidden />
          <StockSnapshot label="After adding" stock={after} highlight />
        </div>
      </section>

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
