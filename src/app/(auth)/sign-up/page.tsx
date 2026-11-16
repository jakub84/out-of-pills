import type { Metadata } from "next";
import Link from "next/link";

import { SignUpForm } from "../_components/sign-up-form";
import { linkClass } from "../_components/text-field";

export const metadata: Metadata = { title: "Create account · Out of Pills" };

export default function SignUpPage() {
  return (
    <div className="flex flex-col gap-6">
      <SignUpForm />
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in" className={linkClass}>
          Log in
        </Link>
      </p>
    </div>
  );
}
