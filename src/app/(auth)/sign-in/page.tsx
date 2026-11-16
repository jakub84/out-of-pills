import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SignInForm } from "../_components/sign-in-form";
import { authHeadingClass, linkClass } from "../_components/text-field";

export const metadata: Metadata = { title: "Log in · Out of Pills" };

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={authHeadingClass}>Log in to your account</h1>
      {/* searchParams is request data: keep it behind Suspense so the page shell stays static. */}
      <Suspense fallback={null}>
        <LinkErrorNotice searchParams={searchParams} />
      </Suspense>
      <SignInForm />
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/sign-up" className={linkClass}>
          Sign up
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
    <Alert variant="destructive">
      <AlertTitle>This link is invalid or has expired.</AlertTitle>
      <AlertDescription>
        Log in below — if your email is not confirmed yet, you can request a new link.
      </AlertDescription>
    </Alert>
  );
}
