"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { resendConfirmation } from "../actions";
import { initialAuthFormState } from "@/lib/auth/form-state";

/** "Resend link" button for the sign-up success panel and the unconfirmed sign-in state. */
export function ResendLinkForm({ email }: { email: string }) {
  const [state, formAction, isPending] = useActionState(
    resendConfirmation,
    initialAuthFormState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="email" value={email} />
      <Button type="submit" variant="outline" size="lg" disabled={isPending} className="w-full">
        {isPending ? "Sending…" : "Resend link"}
      </Button>
      {state.message ? (
        <p
          role="status"
          className={
            state.status === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
