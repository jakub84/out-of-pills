import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";

import { Sidebar, SidebarContent, SidebarFooter } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { listAllMedications } from "@/lib/medications/dal";
import { computeStock, overallUrgency, todayInWarsaw } from "@/lib/medications/stock";
import { listProfiles } from "@/lib/profiles/dal";
import { initialOf } from "@/lib/profiles/validation";
import { ProfileNav } from "./profile-nav";
import { SidebarAccount } from "./sidebar-account";
import { SidebarEdgeToggle } from "./sidebar-edge-toggle";

const HEADING_ID = "sidebar-profiles-heading";

/**
 * Left sidebar (mock 176:226): the caregiver's profiles, oldest first, a red dot on those
 * with a medication running out, and "+ Add new", with the signed-in account at the bottom.
 * Below `md` the shadcn Sidebar renders itself as a Sheet.
 */
export function AppSidebar() {
  return (
    // On desktop the sidebar sits under the sticky header instead of covering it.
    // Collapsing leaves an icon rail with the avatars and "+ Add new".
    <Sidebar
      collapsible="icon"
      className="top-(--header-height) h-[calc(100svh-var(--header-height))]!"
    >
      <SidebarEdgeToggle />
      <SidebarContent className="pt-8 group-data-[collapsible=icon]:overflow-visible">
        <nav aria-labelledby={HEADING_ID} className="flex flex-col gap-3">
          {/* Stays in the accessibility tree when collapsed: it labels the nav. */}
          <h2
            id={HEADING_ID}
            className="h-5 px-7 text-sm font-medium text-foreground group-data-[collapsible=icon]:sr-only"
          >
            Profiles:
          </h2>
          {/* Reads the session and the URL: keep it behind Suspense. */}
          <Suspense fallback={<ProfileNavSkeleton />}>
            <SidebarProfiles />
          </Suspense>
        </nav>
      </SidebarContent>
      <SidebarFooter className="gap-0 border-t border-sidebar-border px-7 py-5 group-data-[collapsible=icon]:px-0">
        {/* Reads the session: keep it behind Suspense. */}
        <Suspense fallback={<SidebarAccountSkeleton />}>
          <SidebarAccount />
        </Suspense>
      </SidebarFooter>
    </Sidebar>
  );
}

/**
 * The dots are an extra: if medications fail to load, the profile list still works.
 * Returns `null` on failure, so the counts can tell "none" from "unknown".
 */
async function loadMedicationsForDots() {
  try {
    return await listAllMedications();
  } catch (error) {
    // Lets Next's own control-flow errors (redirects, dynamic rendering) through.
    unstable_rethrow(error);
    console.error("Failed to load medications for the sidebar", error);
    return null;
  }
}

async function SidebarProfiles() {
  const [profiles, medications] = await Promise.all([listProfiles(), loadMedicationsForDots()]);
  const today = todayInWarsaw();
  // Medications that failed to load show no dots.
  const runningOutProfileIds = new Set(
    (medications ?? [])
      .filter((medication) => {
        const stock = computeStock(medication, today);
        return overallUrgency([{ ...medication, stock }]) === "red";
      })
      .map((medication) => medication.profileId),
  );
  // For the delete confirmation: paused medications are deleted too, so they count.
  const medicationCounts = new Map<string, number>();
  for (const medication of medications ?? []) {
    const count = medicationCounts.get(medication.profileId) ?? 0;
    medicationCounts.set(medication.profileId, count + 1);
  }

  return (
    <ProfileNav
      profiles={profiles.map((profile) => ({
        id: profile.id,
        name: profile.name,
        initial: initialOf(profile.name),
        avatarColor: profile.avatarColor,
        avatar: profile.avatar,
        runningOut: runningOutProfileIds.has(profile.id),
        medicationCount: medications ? (medicationCounts.get(profile.id) ?? 0) : null,
      }))}
    />
  );
}

function SidebarAccountSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3 group-data-[collapsible=icon]:items-center">
      <div className="flex flex-col gap-1.5 group-data-[collapsible=icon]:hidden">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-3 w-36" />
      </div>
      <Skeleton className="h-[37px] w-24 group-data-[collapsible=icon]:size-9" />
    </div>
  );
}

function ProfileNavSkeleton() {
  return (
    <div aria-hidden className="flex flex-col">
      {["w-24", "w-16"].map((width) => (
        <div
          key={width}
          className="flex h-12 items-center gap-3 px-7 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className={`h-4 ${width} group-data-[collapsible=icon]:hidden`} />
        </div>
      ))}
    </div>
  );
}
