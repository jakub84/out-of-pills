import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AddMedicationDialog } from "@/components/medications/add-medication-dialog";
import type { OverviewItem } from "@/components/medications/medication-card";
import {
  MedicationGroups,
  NoMedications,
  RunOutTiles,
} from "@/components/medications/medication-overview";
import { StockIllustration } from "@/components/medications/stock-illustration";
import { PageLoader } from "@/components/navigation/page-loader";
import { ProfileAvatar } from "@/components/profiles/profile-avatar";
import { listMedications } from "@/lib/medications/dal";
import {
  computeStock,
  groupByUrgency,
  overallUrgency,
  todayInWarsaw,
} from "@/lib/medications/stock";
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
    // `relative isolate` anchors the header illustration and keeps it behind the content, above the page.
    <div className="relative isolate w-full">
      <div className="mx-auto w-full max-w-[1000px] px-4 py-8 sm:px-10 sm:py-12 lg:px-20">
        <Suspense fallback={<PageLoader />}>
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
    // Unpaused until the pause column is read (edit-and-pause-medication Phase 2).
    stock: computeStock({ ...medication, pausedOn: null }, today),
  }));
  // Each group comes back sorted by compareByRunOut, ran-out items first in red.
  const groups = groupByUrgency(items);
  const runningOut = groups.red.length;

  const addButton = <AddMedicationDialog profileId={selected.id} profileName={selected.name} today={today} />;

  return (
    <div className="flex flex-col gap-12">
      <StockIllustration urgency={overallUrgency(items)} />
      {/* Long names wrap within the header illustration's faded left edge, before the solid part. */}
      <div className="flex flex-col gap-3 lg:max-w-[60%]">
        <div className="flex items-start gap-3 sm:gap-4">
          <ProfileAvatar
            initial={initialOf(selected.name)}
            avatarColor={selected.avatarColor}
            avatar={selected.avatar}
            size="header"
          />
          {/* min-w-0 lets a long name wrap instead of pushing past the screen edge. */}
          <h1 className="min-w-0 font-heading text-4xl font-normal break-words text-foreground sm:text-[54px]">
            <span className="block text-lg sm:text-xl">Profile:</span>{" "}
            <span title={selected.name} className="line-clamp-2 text-primary">
              {selected.name}
            </span>
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
