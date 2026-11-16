"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { signUp } from "../actions";
import { initialAuthFormState } from "@/lib/auth/form-state";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/validation";
import { ResendLinkForm } from "./resend-link-form";
import { authHeadingClass, TextField } from "./text-field";

export function SignUpForm() {
  const [state, formAction, isPending] = useActionState(signUp, initialAuthFormState);

  if (state.status === "success" && state.email) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className={authHeadingClass}>Check your email</h1>
        <p className="text-sm text-muted-foreground">
          {state.message}. We sent a link to{" "}
          <span className="font-medium text-foreground">{state.email}</span>.
        </p>
        <ResendLinkForm email={state.email} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className={authHeadingClass}>Create your account</h1>
        <p className="text-sm text-muted-foreground">
          Track how many pills are left and when each medication runs out.
        </p>
      </div>
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
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          hint={`At least ${PASSWORD_MIN_LENGTH} characters, with letters and digits`}
          error={state.fieldErrors?.password}
        />
        {state.status === "error" && state.message ? (
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" size="lg" disabled={isPending} className="mt-2 w-full">
          {isPending ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </div>
  );
}
