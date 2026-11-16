import { AlarmClockCheck, ClockAlert, MessageCircleWarning } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AddMedicationDialog } from "@/components/medications/add-medication-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { getCaregiver, listProfiles, type Profile } from "@/lib/profiles/dal";

/** "What's running out?" tiles (mock 176:460 / 176:456 / 176:464); thresholds per FR-015. */
const RUN_OUT_TILES = [
  {
    label: "14 days or less",
    count: 2,
    Icon: MessageCircleWarning,
    className: "border-urgency-red text-urgency-red",
  },
  {
    label: "30 days or less",
    count: 4,
    Icon: ClockAlert,
    className: "border-urgency-yellow text-urgency-yellow",
  },
  {
    label: "More than 30 days",
    count: 9,
    Icon: AlarmClockCheck,
    className: "border-urgency-green text-urgency-green",
  },
];

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

  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-3">
        <p className="font-heading text-2xl font-light text-brand-ink">
          <span className="font-medium">Hi:</span> {caregiver.displayName}
        </p>
        <h1 className="font-heading text-4xl font-normal break-words text-foreground sm:text-[54px]">
          Profile: <span className="text-primary">{selected.name}</span>
        </h1>
        {/* Placeholder copy from mock 176:346; Phase 4 replaces it with real figures. */}
        <div className="flex flex-col gap-3 text-sm leading-[18px] text-brand-subtle">
          <p>
            Last signed in: <span className="font-bold">24</span> days ago
          </p>
          <p>
            Total medications: <span className="font-extrabold">12</span>
          </p>
          <p className="font-extrabold">2 are running out!</p>
        </div>
      </div>

      <section aria-labelledby="running-out-heading" className="flex flex-col gap-5">
        <h2
          id="running-out-heading"
          className="font-heading text-2xl font-normal text-foreground sm:text-[32px]"
        >
          What&apos;s running out?
        </h2>
        {/* Placeholder counts from mock 176:226; Phase 4 computes them from the medications. */}
        <ul className="flex flex-wrap gap-4 sm:gap-[30px]">
          {RUN_OUT_TILES.map(({ label, count, Icon, className }) => (
            <li
              key={label}
              className={`flex w-[153px] flex-col items-center gap-[5px] rounded-[16px] border border-dashed bg-card pt-3 pb-2.5 ${className}`}
            >
              <Icon className="size-6" aria-hidden />
              <span className="font-heading text-2xl leading-6 font-bold text-foreground">
                {count}
              </span>
              <span className="text-sm leading-6 text-brand-subtle">{label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="medication-stock-heading" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            id="medication-stock-heading"
            className="font-heading text-2xl font-normal text-foreground sm:text-[32px]"
          >
            Medication stock <span className="text-xl font-light text-brand-subtle">(0)</span>
          </h2>
          <AddMedicationDialog profileId={selected.id} profileName={selected.name} />
        </div>
        <p className="text-base text-brand-subtle">No medications yet.</p>
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
