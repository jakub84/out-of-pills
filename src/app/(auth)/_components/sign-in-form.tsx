"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { signIn } from "../actions";
import { initialAuthFormState } from "@/lib/auth/form-state";
import { ResendLinkForm } from "./resend-link-form";
import { linkClass, TextField } from "./text-field";

export function SignInForm() {
  const [state, formAction, isPending] = useActionState(signIn, initialAuthFormState);
  const needsConfirmation = state.reason === "email_not_confirmed" && state.email;

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-6">
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
          autoComplete="current-password"
          required
          error={state.fieldErrors?.password}
          labelAction={
            <Link href="/forgot-password" className={`text-sm ${linkClass}`}>
              Forgot your password?
            </Link>
          }
        />
        {state.status === "error" && state.message && !needsConfirmation ? (
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" size="lg" disabled={isPending} className="mt-2 w-full">
          {isPending ? "Logging in…" : "Log in"}
        </Button>
      </form>
      {needsConfirmation ? (
        <Alert>
          <AlertTitle>{state.message}.</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <p>Open the link we sent to {state.email}, or request a new one.</p>
            <ResendLinkForm email={state.email ?? ""} />
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
