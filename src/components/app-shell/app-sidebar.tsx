import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";

import { Sidebar, SidebarContent } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { listAllMedications } from "@/lib/medications/dal";
import { computeStock, overallUrgency, todayInWarsaw } from "@/lib/medications/stock";
import { listProfiles } from "@/lib/profiles/dal";
import { initialOf } from "@/lib/profiles/validation";
import { ProfileNav } from "./profile-nav";
import { SidebarEdgeToggle } from "./sidebar-edge-toggle";

const HEADING_ID = "sidebar-profiles-heading";

/**
 * Left sidebar (mock 176:226): the caregiver's profiles, oldest first, a red dot on those
 * with a medication running out, and "+ Add new". Below `md` the shadcn Sidebar renders
 * itself as a Sheet.
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
    </Sidebar>
  );
}

/** The dots are an extra: if medications fail to load, the profile list still works. */
async function loadMedicationsForDots() {
  try {
    return await listAllMedications();
  } catch (error) {
    // Lets Next's own control-flow errors (redirects, dynamic rendering) through.
    unstable_rethrow(error);
    console.error("Failed to load medications for the sidebar", error);
    return [];
  }
}

async function SidebarProfiles() {
  const [profiles, medications] = await Promise.all([listProfiles(), loadMedicationsForDots()]);
  const today = todayInWarsaw();
  const runningOutProfileIds = new Set(
    medications
      .filter((medication) => {
        const stock = computeStock(medication, today);
        return overallUrgency([{ ...medication, stock }]) === "red";
      })
      .map((medication) => medication.profileId),
  );

  return (
    <ProfileNav
      profiles={profiles.map((profile) => ({
        id: profile.id,
        name: profile.name,
        initial: initialOf(profile.name),
        avatarColor: profile.avatarColor,
        avatar: profile.avatar,
        runningOut: runningOutProfileIds.has(profile.id),
      }))}
    />
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
