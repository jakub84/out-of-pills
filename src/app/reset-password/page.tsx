import type { Metadata } from "next";
import { Suspense } from "react";

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
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Choose a new password
        </h1>
        <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
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
