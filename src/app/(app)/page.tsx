import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getCaregiver, listProfiles, type Profile } from "@/lib/profiles/dal";

/** An unknown, malformed or foreign id falls back to the oldest profile (RLS hides foreign rows). */
function selectProfile(profiles: Profile[], requested: string | string[] | undefined) {
  return profiles.find((profile) => profile.id === requested) ?? profiles[0];
}

export async function generateMetadata({ searchParams }: PageProps<"/">): Promise<Metadata> {
  const [profiles, { profile: requested }] = await Promise.all([listProfiles(), searchParams]);
  const selected = selectProfile(profiles, requested);
  return { title: selected ? `${selected.name} · Out of Pills` : "Out of Pills" };
}

/** Main screen (mock 176:226, S-02 parts): the selected profile and its medication stock. */
export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <div className="w-full max-w-[1000px] px-4 py-8 sm:px-10 sm:py-12 lg:px-20">
      <Suspense fallback={<SelectedProfileSkeleton />}>
        <SelectedProfile searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/** Reads the session and searchParams, so it must stay inside the Suspense boundary above. */
async function SelectedProfile({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const [caregiver, profiles] = await Promise.all([getCaregiver(), listProfiles()]);

  if (!caregiver) redirect("/onboarding/name");
  if (profiles.length === 0) redirect("/onboarding/profile");

  const { profile: requested } = await searchParams;
  const selected = selectProfile(profiles, requested);

  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-3">
        <p className="font-heading text-2xl font-light text-brand-ink">
          <span className="font-medium">Hi:</span> {caregiver.displayName}
        </p>
        <h1 className="font-heading text-4xl font-normal break-words text-foreground sm:text-[54px]">
          Profile: <span className="text-primary">{selected.name}</span>
        </h1>
      </div>

      <section aria-labelledby="medication-stock-heading" className="flex flex-col gap-5">
        <h2
          id="medication-stock-heading"
          className="font-heading text-2xl font-normal text-foreground sm:text-[32px]"
        >
          Medication stock <span className="text-xl font-light text-brand-subtle">(0)</span>
        </h2>
        <Card className="items-center gap-6 px-6 py-8 text-center">
          {/* Wrapped: Card styles a first-child <img> as a full-bleed cover. */}
          <div className="w-full max-w-[420px]">
            <Image
              src="/brand/stock-illustration.png"
              alt=""
              width={1024}
              height={572}
              className="h-auto w-full"
            />
          </div>
          <p className="text-base text-brand-subtle">
            No medications yet — adding them arrives soon.
          </p>
        </Card>
      </section>
    </div>
  );
}

function SelectedProfileSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-12 w-72" />
    </div>
  );
}
