import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { SignInForm } from "../_components/sign-in-form";
import { linkClass } from "../_components/text-field";

export const metadata: Metadata = { title: "Sign in · Out of Pills" };

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Sign in
      </h1>
      {/* searchParams is request data: keep it behind Suspense so the page shell stays static. */}
      <Suspense fallback={null}>
        <LinkErrorNotice searchParams={searchParams} />
      </Suspense>
      <SignInForm />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        New to Out of Pills?{" "}
        <Link href="/sign-up" className={linkClass}>
          Create an account
        </Link>
      </p>
    </div>
  );
}

async function LinkErrorNotice({
  searchParams,
}: {
  searchParams: PageProps<"/sign-in">["searchParams"];
}) {
  const { error } = await searchParams;
  if (error !== "link-invalid") return null;

  return (
    <div
      role="alert"
      className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100"
    >
      <p className="font-medium">This link is invalid or has expired.</p>
      <p className="mt-1">
        Sign in below — if your email is not confirmed yet, you can request a new link.
      </p>
    </div>
  );
}
