import type { Metadata } from "next";
import Link from "next/link";

import { ForgotPasswordForm } from "../_components/forgot-password-form";
import { linkClass } from "../_components/text-field";

export const metadata: Metadata = { title: "Reset password · Out of Pills" };

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-6">
      <ForgotPasswordForm />
      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/sign-in" className={linkClass}>
          Back to log in
        </Link>
      </p>
    </div>
  );
}
