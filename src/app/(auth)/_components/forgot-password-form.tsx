"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requestPasswordReset } from "../actions";
import { initialAuthFormState } from "@/lib/auth/form-state";
import { authHeadingClass, TextField } from "./text-field";

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(
    requestPasswordReset,
    initialAuthFormState,
  );

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className={authHeadingClass}>Check your email</h1>
        <p role="status" className="text-sm text-muted-foreground">
          {state.message}.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className={authHeadingClass}>Forgot your password?</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we will send you a link to choose a new password.
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
        {state.status === "error" && state.message ? (
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" size="lg" disabled={isPending} className="mt-2 w-full">
          {isPending ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </div>
  );
}
