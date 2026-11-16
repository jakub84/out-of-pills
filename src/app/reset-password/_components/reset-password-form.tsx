"use client";

import { useActionState } from "react";

import { updatePassword } from "@/app/(auth)/actions";
import { TextField } from "@/app/(auth)/_components/text-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { initialAuthFormState } from "@/lib/auth/form-state";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/validation";

export function ResetPasswordForm({ email }: { email: string }) {
  const [state, formAction, isPending] = useActionState(updatePassword, initialAuthFormState);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <p className="min-w-0 break-all text-sm text-muted-foreground">
        For <span className="font-medium text-foreground">{email}</span>
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
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" size="lg" disabled={isPending} className="mt-2 w-full">
        {isPending ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}
