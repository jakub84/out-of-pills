import { Suspense } from "react";

import { Logo } from "@/components/brand/logo";
import { getCurrentUser } from "@/lib/auth/dal";
import { SignOutButton } from "./_components/sign-out-button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-3xl items-center px-4 py-4">
          <Logo />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          <SignedInContent />
        </Suspense>
      </main>
    </div>
  );
}

/** Reads the session, so it must stay inside the Suspense boundary above. */
async function SignedInContent() {
  const user = await getCurrentUser();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 break-all text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{user.email}</span>
        </p>
        <SignOutButton />
      </div>
      <section className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
        <h1 className="font-heading text-xl font-semibold text-foreground">No profiles yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Profiles for the people you care for will appear here.
        </p>
      </section>
    </>
  );
}
