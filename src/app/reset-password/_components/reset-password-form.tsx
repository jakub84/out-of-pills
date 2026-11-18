"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";

import { updatePassword } from "@/app/(auth)/actions";
import { TextField } from "@/app/(auth)/_components/text-field";
import {
  useNavigationPending,
  useSavedFormReset,
} from "@/components/navigation/navigation-pending";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { initialAuthFormState, type AuthFormState } from "@/lib/auth/form-state";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/validation";
import { passwordChangedMessage } from "@/lib/feedback/messages";
import { runSaveAction } from "@/lib/feedback/run-save-action";

/** New-password form that confirms the change, returns to the app and clears itself. */
export function ResetPasswordForm({ email }: { email: string }) {
  const { formKey, markSaved } = useSavedFormReset();

  return <ResetPasswordFields key={formKey} email={email} onSaved={markSaved} />;
}

function ResetPasswordFields({ email, onSaved }: { email: string; onSaved: () => void }) {
  const { navigate } = useNavigationPending();
  // Controlled: React clears uncontrolled fields after a form action, and a failed request
  // must leave what was typed.
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [state, formAction, isPending] = useActionState(
    async (prev: AuthFormState, formData: FormData) => {
      const result = await runSaveAction(
        () => updatePassword(prev, formData),
        initialAuthFormState,
      );
      if (result.status === "success") {
        onSaved();
        toast.success(passwordChangedMessage());
        navigate("/");
      }
      return result;
    },
    initialAuthFormState,
  );
  // Stays on after a success, until the app has opened.
  const isSubmitting = isPending || state.status === "success";

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
        value={password}
        onChange={(event) => setPassword(event.target.value)}
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
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        error={state.fieldErrors?.confirmPassword}
      />
      {state.status === "error" && state.message ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" size="lg" disabled={isSubmitting} className="mt-2 w-full">
        {isSubmitting ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}
