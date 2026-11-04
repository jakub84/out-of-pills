import type { Metadata } from "next";
import Link from "next/link";

import { SignUpForm } from "../_components/sign-up-form";
import { linkClass } from "../_components/text-field";

export const metadata: Metadata = { title: "Create account · Out of Pills" };

export default function SignUpPage() {
  return (
    <div className="flex flex-col gap-6">
      <SignUpForm />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account?{" "}
        <Link href="/sign-in" className={linkClass}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
