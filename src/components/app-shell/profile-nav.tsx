"use client";

import { Plus } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";

import { PendingLink, useNavigationPending } from "@/components/navigation/navigation-pending";
import { ProfileAvatar } from "@/components/profiles/profile-avatar";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { AvatarColor, ProfileAvatar as ProfileAvatarId } from "@/lib/profiles/validation";
import { ProfileOptionsMenu } from "./profile-options-menu";

export type ProfileNavItem = {
  id: string;
  name: string;
  initial: string;
  avatarColor: AvatarColor;
  avatar: ProfileAvatarId | null;
  /** At least one medication is red or has run out. */
  runningOut: boolean;
};

/** The profile id in `/profiles/<id>/edit`, or `null` for any other path. */
function editedProfileId(pathname: string): string | null {
  const match = /^\/profiles\/([^/]+)\/edit$/.exec(pathname);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

/**
 * Profile rows plus "+ Add new". The selection mirrors the main page: on `/` it is the
 * `?profile=` id when it is one of these profiles, else the oldest; on `/profiles/<id>/edit`
 * it is that profile; elsewhere none. The selected row shows the "⋯" options menu.
 * During navigation it follows the destination, so the click shows straight away.
 * Uses `useSearchParams()`: render it inside `<Suspense>`.
 */
export function ProfileNav({ profiles }: { profiles: ProfileNavItem[] }) {
  const currentPathname = usePathname();
  const currentSearchParams = useSearchParams();
  const { pendingHref } = useNavigationPending();
  const { setOpenMobile } = useSidebar();

  // The base only lets URL parse a relative href; it is never used.
  const destination = pendingHref ? new URL(pendingHref, "http://localhost") : null;
  const pathname = destination?.pathname ?? currentPathname;
  const searchParams = destination?.searchParams ?? currentSearchParams;

  const onProfilePage = pathname === "/";
  const requested = searchParams.get("profile");
  const editedId = editedProfileId(pathname);
  const selectedId = onProfilePage
    ? (profiles.find((profile) => profile.id === requested) ?? profiles[0])?.id
    : profiles.find((profile) => profile.id === editedId)?.id;
  const onAddPage = pathname === "/profiles/new";

  // On phones the sidebar is a sheet: close it once a destination is chosen.
  const closeSheet = () => setOpenMobile(false);

  return (
    <SidebarMenu>
      {profiles.map((profile) => {
        const selected = profile.id === selectedId;
        // On the edit page the selected row links back to the profile: a real navigation.
        const current = selected && onProfilePage;
        return (
          <SidebarMenuItem key={profile.id}>
            <SidebarMenuButton
              asChild
              size="row"
              isActive={selected}
              tooltip={profile.name}
              // Leaves room for the "⋯" so the name truncates before it.
              className="group-has-data-[sidebar=menu-action]/menu-item:pr-12"
            >
              <PendingLink
                href={`/?profile=${encodeURIComponent(profile.id)}`}
                trackPending={!current}
                aria-current={current ? "page" : undefined}
                onClick={closeSheet}
              >
                <span className="relative shrink-0">
                  <ProfileAvatar
                    initial={profile.initial}
                    avatarColor={profile.avatarColor}
                    avatar={profile.avatar}
                    size="list"
                  />
                  {/* Urgency dot (mock 221:392). */}
                  {profile.runningOut ? (
                    <span
                      aria-hidden
                      data-slot="profile-urgency-dot"
                      className="absolute top-px right-px size-[7px] rounded-full bg-urgency-red ring-1 ring-sidebar"
                    />
                  ) : null}
                </span>
                {/* Stays the button's last child: only that span gets the ellipsis. */}
                <span className="group-data-[collapsible=icon]:sr-only">
                  {profile.name}
                  {profile.runningOut ? <span className="sr-only">, running out</span> : null}
                </span>
              </PendingLink>
            </SidebarMenuButton>
            {selected ? <ProfileOptionsMenu profile={profile} /> : null}
          </SidebarMenuItem>
        );
      })}
      <SidebarMenuItem className="mt-4">
        <SidebarMenuButton asChild size="row" isActive={onAddPage} tooltip="Add new">
          <PendingLink
            href="/profiles/new"
            trackPending={!onAddPage}
            aria-current={onAddPage ? "page" : undefined}
            onClick={closeSheet}
          >
            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center rounded-md border border-dashed border-brand-subtle text-brand-ink"
            >
              <Plus className="size-3.5!" />
            </span>
            <span className="group-data-[collapsible=icon]:sr-only">Add new</span>
          </PendingLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
