import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Logo } from "@/components/brand/logo";
import { getCaregiver, listProfiles } from "@/lib/profiles/dal";
import { SignOutButton } from "./_components/sign-out-button";

/** Interim main page: onboarding redirects plus the selected profile's name (Phase 4 adds the shell). */
export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-3xl items-center px-4 py-4">
          <Logo />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          <SignedInContent searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

/** Reads the session and searchParams, so it must stay inside the Suspense boundary above. */
async function SignedInContent({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const [caregiver, profiles] = await Promise.all([getCaregiver(), listProfiles()]);

  if (!caregiver) redirect("/onboarding/name");
  if (profiles.length === 0) redirect("/onboarding/profile");

  // An unknown, malformed or foreign id falls back to the oldest profile.
  const { profile: requested } = await searchParams;
  const selected = profiles.find((profile) => profile.id === requested) ?? profiles[0];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="min-w-0 font-heading text-3xl font-normal break-words text-foreground">
        Profile: <span className="text-primary">{selected.name}</span>
      </h1>
      <SignOutButton />
    </div>
  );
}
