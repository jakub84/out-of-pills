"use client";

import { useActionState } from "react";

import { requestPasswordReset } from "../actions";
import { initialAuthFormState } from "@/lib/auth/form-state";
import { primaryButtonClass, TextField } from "./text-field";

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(
    requestPasswordReset,
    initialAuthFormState,
  );

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Check your email
        </h1>
        <p role="status" className="text-base text-zinc-600 dark:text-zinc-400">
          {state.message}.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Forgot your password?
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Enter your email and we will send you a link to choose a new password.
        </p>
      </div>
      <form action={formAction} className="flex flex-col gap-4">
        <TextField
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          error={state.fieldErrors?.email}
        />
        {state.status === "error" && state.message ? (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {state.message}
          </p>
        ) : null}
        <button type="submit" disabled={isPending} className={primaryButtonClass}>
          {isPending ? "Sending…" : "Send reset link"}
        </button>
      </form>
    </div>
  );
}
