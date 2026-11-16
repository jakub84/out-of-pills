"use client";

import { useActionState } from "react";

import { signUp } from "../actions";
import { initialAuthFormState } from "@/lib/auth/form-state";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/validation";
import { ResendLinkForm } from "./resend-link-form";
import { primaryButtonClass, TextField } from "./text-field";

export function SignUpForm() {
  const [state, formAction, isPending] = useActionState(signUp, initialAuthFormState);

  if (state.status === "success" && state.email) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Check your email
        </h1>
        <p className="text-base text-zinc-600 dark:text-zinc-400">
          {state.message}. We sent a link to{" "}
          <span className="font-medium text-zinc-900 dark:text-zinc-50">{state.email}</span>.
        </p>
        <ResendLinkForm email={state.email} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Create your account
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Track how many pills are left and when each medication runs out.
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
        <TextField
          name="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          hint={`At least ${PASSWORD_MIN_LENGTH} characters, with letters and digits`}
          error={state.fieldErrors?.password}
        />
        {state.status === "error" && state.message ? (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {state.message}
          </p>
        ) : null}
        <button type="submit" disabled={isPending} className={primaryButtonClass}>
          {isPending ? "Creating account…" : "Create account"}
        </button>
      </form>
    </div>
  );
}
