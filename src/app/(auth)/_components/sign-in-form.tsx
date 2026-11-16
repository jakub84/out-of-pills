"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signIn } from "../actions";
import { initialAuthFormState } from "@/lib/auth/form-state";
import { ResendLinkForm } from "./resend-link-form";
import { linkClass, primaryButtonClass, TextField } from "./text-field";

export function SignInForm() {
  const [state, formAction, isPending] = useActionState(signIn, initialAuthFormState);
  const needsConfirmation = state.reason === "email_not_confirmed" && state.email;

  return (
    <div className="flex flex-col gap-4">
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
        <div className="flex flex-col gap-1.5">
          <TextField
            name="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            error={state.fieldErrors?.password}
          />
          <Link href="/forgot-password" className={`self-end text-sm ${linkClass}`}>
            Forgot password?
          </Link>
        </div>
        {state.status === "error" && state.message && !needsConfirmation ? (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {state.message}
          </p>
        ) : null}
        <button type="submit" disabled={isPending} className={primaryButtonClass}>
          {isPending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      {needsConfirmation ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950"
        >
          <p className="text-sm text-amber-900 dark:text-amber-100">
            <span className="font-medium">{state.message}.</span> Open the link we sent to{" "}
            {state.email}, or request a new one.
          </p>
          <ResendLinkForm email={state.email ?? ""} />
        </div>
      ) : null}
    </div>
  );
}
