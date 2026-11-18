import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AddMedicationDialog } from "@/components/medications/add-medication-dialog";
import type { OverviewItem } from "@/components/medications/medication-card";
import {
  MedicationGroups,
  NoMedications,
  RunOutTiles,
} from "@/components/medications/medication-overview";
import { ProfileAvatar } from "@/components/profiles/profile-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { listMedications } from "@/lib/medications/dal";
import { computeStock, groupByUrgency, todayInWarsaw } from "@/lib/medications/stock";
import { getCaregiver, listProfiles, type Profile } from "@/lib/profiles/dal";
import { initialOf } from "@/lib/profiles/validation";

/** An unknown, malformed or foreign id falls back to the oldest profile (RLS hides foreign rows). */
function selectProfile(profiles: Profile[], requested: string | string[] | undefined) {
  return profiles.find((profile) => profile.id === requested) ?? profiles[0];
}

export async function generateMetadata({ searchParams }: PageProps<"/">): Promise<Metadata> {
  const [profiles, { profile: requested }] = await Promise.all([listProfiles(), searchParams]);
  const selected = selectProfile(profiles, requested);
  return { title: selected ? `${selected.name} · Out of Pills` : "Out of Pills" };
}

/** Main screen (mock 176:226): the selected profile and its medication stock. */
export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <div className="relative w-full">
      {/* Header illustration (mock 176:228): flush top-right, left and bottom edges fade into the page. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 right-0 hidden w-[min(806px,50%)] [mask-image:linear-gradient(to_right,transparent,black_30%),linear-gradient(to_top,transparent,black_25%)] [mask-composite:intersect] lg:block"
      >
        <Image
          src="/brand/stock-illustration.png"
          alt=""
          width={1024}
          height={572}
          className="h-auto w-full"
        />
      </div>
      <div className="relative z-10 mx-auto w-full max-w-[1000px] px-4 py-8 sm:px-10 sm:py-12 lg:px-20">
        <Suspense fallback={<SelectedProfileSkeleton />}>
          <SelectedProfile searchParams={searchParams} />
        </Suspense>
      </div>
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

  const medications = await listMedications(selected.id);
  const today = todayInWarsaw();
  const items: OverviewItem[] = medications.map((medication) => ({
    id: medication.id,
    name: medication.name,
    dailyDose: medication.dailyDose,
    packageSize: medication.packageSize,
    pillsCounted: medication.pillsCounted,
    countedOn: medication.countedOn,
    stock: computeStock(medication, today),
  }));
  // Each group comes back sorted by compareByRunOut, ran-out items first in red.
  const groups = groupByUrgency(items);
  const runningOut = groups.red.length;

  const addButton = <AddMedicationDialog profileId={selected.id} profileName={selected.name} today={today} />;

  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-3">
        <p className="font-heading text-2xl font-light text-brand-ink">
          <span className="font-medium">Hi:</span> {caregiver.displayName}
        </p>
        <div className="flex items-center gap-3 sm:gap-4">
          <ProfileAvatar
            initial={initialOf(selected.name)}
            avatarColor={selected.avatarColor}
            avatar={selected.avatar}
            size="header"
          />
          {/* min-w-0 lets a long name wrap instead of pushing past the screen edge. */}
          <h1 className="min-w-0 font-heading text-4xl font-normal break-words text-foreground sm:text-[54px]">
            Profile: <span className="text-primary">{selected.name}</span>
          </h1>
        </div>
        <div className="flex flex-col gap-3 text-sm leading-[18px] text-brand-subtle">
          <p>
            Total medications: <span className="font-extrabold">{items.length}</span>
          </p>
          {runningOut > 0 ? (
            <p className="font-extrabold text-urgency-red">{runningOut} running out!</p>
          ) : null}
        </div>
      </div>

      {items.length > 0 ? <RunOutTiles groups={groups} /> : null}

      <section aria-labelledby="medication-stock-heading" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            id="medication-stock-heading"
            className="font-heading text-2xl font-normal text-foreground sm:text-[32px]"
          >
            Medication stock{" "}
            <span className="text-xl font-light text-brand-subtle">({items.length})</span>
          </h2>
          {items.length > 0 ? addButton : null}
        </div>
        {items.length > 0 ? (
          <MedicationGroups groups={groups} today={today} />
        ) : (
          <NoMedications action={addButton} />
        )}
      </section>
    </div>
  );
}

function SelectedProfileSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <Skeleton className="h-7 w-40" />
      <div className="flex items-center gap-3 sm:gap-4">
        <Skeleton className="size-16 shrink-0 rounded-full sm:size-20" />
        <Skeleton className="h-12 w-full max-w-72" />
      </div>
    </div>
  );
}
