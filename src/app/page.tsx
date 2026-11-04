import { Suspense } from "react";

import { getCurrentUser } from "@/lib/auth/dal";
import { SignOutButton } from "./_components/sign-out-button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex w-full max-w-3xl items-center px-4 py-4">
          <p className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Out of Pills
          </p>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
        <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
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
        <p className="min-w-0 break-all text-sm text-zinc-600 dark:text-zinc-400">
          Signed in as{" "}
          <span className="font-medium text-zinc-900 dark:text-zinc-50">{user.email}</span>
        </p>
        <SignOutButton />
      </div>
      <section className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-950">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">No profiles yet</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Profiles for the people you care for will appear here.
        </p>
      </section>
    </>
  );
}
