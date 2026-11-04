"use client";

import { useActionState } from "react";

import { resendConfirmation } from "../actions";
import { initialAuthFormState } from "@/lib/auth/form-state";
import { secondaryButtonClass } from "./text-field";

/** "Resend link" button for the sign-up success panel and the unconfirmed sign-in state. */
export function ResendLinkForm({ email }: { email: string }) {
  const [state, formAction, isPending] = useActionState(
    resendConfirmation,
    initialAuthFormState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="email" value={email} />
      <button type="submit" disabled={isPending} className={secondaryButtonClass}>
        {isPending ? "Sending…" : "Resend link"}
      </button>
      {state.message ? (
        <p
          role="status"
          className={
            state.status === "error"
              ? "text-sm text-red-700 dark:text-red-400"
              : "text-sm text-zinc-600 dark:text-zinc-400"
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
