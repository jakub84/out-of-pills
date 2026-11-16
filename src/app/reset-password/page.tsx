import type { Metadata } from "next";
import { Suspense } from "react";

import { authHeadingClass } from "@/app/(auth)/_components/text-field";
import { AuthCard } from "@/app/_components/auth-card";
import { getCurrentUser } from "@/lib/auth/dal";
import { ResetPasswordForm } from "./_components/reset-password-form";

export const metadata: Metadata = { title: "Choose a new password · Out of Pills" };

/**
 * Outside the `(auth)` group: requires the session created by the recovery link.
 * Signed-out visitors are redirected to `/sign-in` by the proxy and by `getCurrentUser()`.
 */
export default function ResetPasswordPage() {
  return (
    <AuthCard>
      <div className="flex flex-col gap-4">
        <h1 className={authHeadingClass}>Choose a new password</h1>
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          <SignedInResetForm />
        </Suspense>
      </div>
    </AuthCard>
  );
}

/** Reads the session, so it must stay inside the Suspense boundary above. */
async function SignedInResetForm() {
  const user = await getCurrentUser();
  return <ResetPasswordForm email={user.email} />;
}
