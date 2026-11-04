"use client";

import { useActionState } from "react";

import { updatePassword } from "@/app/(auth)/actions";
import { primaryButtonClass, TextField } from "@/app/(auth)/_components/text-field";
import { initialAuthFormState } from "@/lib/auth/form-state";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/validation";

export function ResetPasswordForm({ email }: { email: string }) {
  const [state, formAction, isPending] = useActionState(updatePassword, initialAuthFormState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="min-w-0 break-all text-sm text-zinc-600 dark:text-zinc-400">
        For <span className="font-medium text-zinc-900 dark:text-zinc-50">{email}</span>
      </p>
      {/* Lets password managers attach the new password to the right account. */}
      <input type="hidden" name="username" autoComplete="username" value={email} />
      <TextField
        name="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN_LENGTH}
        hint={`At least ${PASSWORD_MIN_LENGTH} characters, with letters and digits`}
        error={state.fieldErrors?.password}
      />
      <TextField
        name="confirmPassword"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN_LENGTH}
        error={state.fieldErrors?.confirmPassword}
      />
      {state.status === "error" && state.message ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {state.message}
        </p>
      ) : null}
      <button type="submit" disabled={isPending} className={primaryButtonClass}>
        {isPending ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
