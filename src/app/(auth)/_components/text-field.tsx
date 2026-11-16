import type { InputHTMLAttributes, ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  /** Optional element on the label row, e.g. the "Forgot your password?" link. */
  labelAction?: ReactNode;
};

/** Labelled input with an inline error; shared by the auth forms. */
export function TextField({
  name,
  label,
  error,
  hint,
  labelAction,
  id,
  ...inputProps
}: TextFieldProps) {
  const inputId = id ?? name;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={inputId}>{label}</Label>
        {labelAction}
      </div>
      <Input
        id={inputId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...inputProps}
      />
      {hint && !error ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Primary-coloured underlined link used across the auth screens. */
export const linkClass =
  "text-primary underline underline-offset-2 hover:text-primary/80";

/** Screen heading inside the auth card (mock: "Log in to your account"). */
export const authHeadingClass = "text-base font-semibold text-foreground";
