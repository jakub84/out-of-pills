"use client";

import { Minus, Plus } from "lucide-react";
import { useActionState, useRef, useState, type FormEvent, type Ref } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDays, formatShortDate, formatTablets } from "@/lib/medications/format";
import { initialStockFormState, type StockFormState } from "@/lib/medications/form-state";
import type { Stock } from "@/lib/medications/stock";
import { parseAmount } from "@/lib/medications/validation";
import { cn } from "@/lib/utils";
import { urgencyBgClass, urgencyTextClass, urgencyTintClass } from "./urgency";

/** What the restock and correction dialogs need about one medication, from the server. */
export type StockDialogMedication = {
  id: string;
  name: string;
  dailyDose: number;
  packageSize: number;
  /** Stored baseline: tablets counted on `countedOn`; sent back as the expected baseline. */
  pillsCounted: number;
  countedOn: string;
};

export type StockDialogProps = {
  medication: StockDialogMedication;
  /**
   * Today in Warsaw (YYYY-MM-DD) from the server. Never the browser clock: a fast
   * device clock would push the previewed run-out date later than the real one.
   */
  today: string;
};

/** Dialog box shared by the restock and correction dialogs; scrolls on short screens. */
export const STOCK_DIALOG_CONTENT_CLASS =
  "max-h-[92dvh] gap-5 overflow-y-auto p-5 sm:max-w-md sm:p-6";

type StockAction = (prev: StockFormState, formData: FormData) => Promise<StockFormState>;

/**
 * Form state for one stock dialog: the typed amount, its field error (client or server),
 * and the server action wrapped so a success closes the dialog. The dialog content
 * unmounts when closed, so each opening starts from `initialAmount` again.
 */
export function useStockForm({
  action,
  initialAmount,
  validate,
  onSaved,
}: {
  action: StockAction;
  initialAmount: string;
  /** Client-side check of the typed amount, same rules as the server action. */
  validate: (value: string) => string | undefined;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(initialAmount);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const inputRef = useRef<HTMLInputElement>(null);

  const [state, formAction, isPending] = useActionState(
    async (prev: StockFormState, formData: FormData) => {
      const result = await action(prev, formData);
      if (result.status === "success") {
        onSaved();
      } else if (result.fieldErrors?.tablets) {
        setFieldError(result.fieldErrors.tablets);
        inputRef.current?.focus();
      }
      return result;
    },
    initialStockFormState,
  );

  function changeAmount(value: string) {
    setAmount(value);
    if (fieldError) setFieldError(undefined);
  }

  /** Blocks the submit and points at the field when the amount is invalid. */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const error = validate(amount);
    if (error) {
      event.preventDefault();
      setFieldError(error);
      inputRef.current?.focus();
    }
  }

  return {
    amount,
    changeAmount,
    fieldError,
    inputRef,
    formAction,
    isPending,
    handleSubmit,
    errorMessage: state.status === "error" ? state.message : undefined,
  };
}

/** The baseline the user was shown, so the action applies only to that one. */
export function BaselineFields({ medication }: { medication: StockDialogMedication }) {
  return (
    <>
      <input type="hidden" name="medicationId" value={medication.id} />
      <input type="hidden" name="expectedPillsCounted" value={String(medication.pillsCounted)} />
      <input type="hidden" name="expectedCountedOn" value={medication.countedOn} />
    </>
  );
}

/** "<label>: 18 tabl. · 9 days · until Sat 14 Nov", or "… · Ran out"; optional urgency dot. */
export function StockLine({
  label,
  stock,
  showDot = false,
  className,
}: {
  label: string;
  stock: Stock;
  showDot?: boolean;
  className?: string;
}) {
  return (
    <p className={cn("flex items-center gap-2 text-sm text-foreground", className)}>
      {showDot ? (
        <span
          aria-hidden
          className={cn("size-2.5 shrink-0 rounded-full", urgencyBgClass[stock.urgency])}
        />
      ) : null}
      <span>
        {label}: <span className="font-semibold">{formatTablets(stock.pillsLeft)} tabl.</span>
        {" · "}
        {stock.runOutDate ? (
          <>
            {formatDays(stock.daysLeft)} · until{" "}
            <span className="font-semibold">{formatShortDate(stock.runOutDate)}</span>
          </>
        ) : (
          <span className="font-semibold text-urgency-red">Ran out</span>
        )}
      </span>
    </p>
  );
}

/**
 * One side of a before/after comparison: label, tablets, days left (urgency colour) and the
 * run-out date on their own lines. `highlight` tints it by urgency; `stock` null shows a dash.
 */
export function StockSnapshot({
  label,
  stock,
  highlight = false,
}: {
  label: string;
  stock: Stock | null;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-lg border px-3 py-2.5",
        highlight && stock ? urgencyTintClass[stock.urgency] : "bg-card",
      )}
    >
      <span className="text-xs font-medium tracking-wide text-brand-subtle uppercase">{label}</span>
      {stock ? (
        <>
          <span className="font-heading text-2xl leading-7 font-bold text-foreground">
            {formatTablets(stock.pillsLeft)} <span className="text-sm font-semibold">tabl.</span>
          </span>
          {stock.runOutDate ? (
            <>
              <span
                className={cn(
                  "flex items-center gap-1.5 text-sm font-semibold",
                  urgencyTextClass[stock.urgency],
                )}
              >
                <span
                  aria-hidden
                  className={cn("size-2 shrink-0 rounded-full", urgencyBgClass[stock.urgency])}
                />
                {formatDays(stock.daysLeft)}
              </span>
              <span className="text-xs text-brand-subtle">
                until {formatShortDate(stock.runOutDate)}
              </span>
            </>
          ) : (
            <span className="text-sm font-semibold text-urgency-red">Ran out</span>
          )}
        </>
      ) : (
        <span className="font-heading text-2xl leading-7 font-bold text-brand-subtle">–</span>
      )}
    </div>
  );
}

/** Amount input with −/+ buttons (step 1); halves can be typed. */
export function AmountStepper({
  id,
  name,
  value,
  min,
  max,
  invalid,
  describedBy,
  inputRef,
  onChange,
}: {
  id: string;
  name: string;
  value: string;
  min: number;
  max: number;
  invalid: boolean;
  describedBy?: string;
  inputRef: Ref<HTMLInputElement>;
  onChange: (value: string) => void;
}) {
  function step(delta: number) {
    const current = parseAmount(value) ?? 0;
    onChange(String(Math.min(max, Math.max(min, current + delta))));
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        aria-label="One tablet less"
        onClick={() => step(-1)}
        className="rounded-full"
      >
        <Minus aria-hidden />
      </Button>
      <Input
        ref={inputRef}
        id={id}
        name={name}
        inputMode="decimal"
        autoComplete="off"
        aria-required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        className="max-w-[120px] text-center"
      />
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        aria-label="One tablet more"
        onClick={() => step(1)}
        className="rounded-full"
      >
        <Plus aria-hidden />
      </Button>
    </div>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  );
}
