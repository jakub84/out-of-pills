"use client";

import { ArrowRight } from "lucide-react";
import { useActionState } from "react";

import { TextField } from "@/app/(auth)/_components/text-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { readField } from "@/lib/auth/validation";
import { runSaveAction } from "@/lib/feedback/run-save-action";
import { saveDisplayName } from "@/lib/profiles/actions";
import { initialProfileFormState, type ProfileFormState } from "@/lib/profiles/form-state";

/** Onboarding step 2: the caregiver's first name. */
export function DisplayNameForm({ defaultName }: { defaultName: string }) {
  const [state, formAction, isPending] = useActionState(
    (prev: ProfileFormState, formData: FormData) =>
      // `displayName` refills the field, which React clears after a form action.
      runSaveAction<ProfileFormState>(() => saveDisplayName(prev, formData), {
        status: "idle",
        displayName: readField(formData, "displayName"),
      }),
    initialProfileFormState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <div className="w-full sm:max-w-[342px]">
        <TextField
          name="displayName"
          label="First name"
          autoComplete="given-name"
          aria-required
          defaultValue={state.displayName ?? defaultName}
          hint="Just your first name is fine."
          error={state.fieldErrors?.displayName}
        />
      </div>
      {state.status === "error" && state.message ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <div>
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Saving…" : "Next"}
          <ArrowRight data-icon="inline-end" aria-hidden />
        </Button>
      </div>
    </form>
  );
}
