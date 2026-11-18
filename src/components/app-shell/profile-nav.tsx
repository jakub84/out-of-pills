"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { ProfileAvatar } from "@/components/profiles/profile-avatar";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { AvatarColor, ProfileAvatar as ProfileAvatarId } from "@/lib/profiles/validation";

export type ProfileNavItem = {
  id: string;
  name: string;
  initial: string;
  avatarColor: AvatarColor;
  avatar: ProfileAvatarId | null;
  /** At least one medication is red or has run out. */
  runningOut: boolean;
};

/**
 * Profile rows plus "+ Add new". The selection mirrors the main page: on `/` it is the
 * `?profile=` id when it is one of these profiles, else the oldest; elsewhere none.
 * Uses `useSearchParams()`: render it inside `<Suspense>`.
 */
export function ProfileNav({ profiles }: { profiles: ProfileNavItem[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setOpenMobile } = useSidebar();

  const requested = searchParams.get("profile");
  const selectedId =
    pathname === "/"
      ? (profiles.find((profile) => profile.id === requested) ?? profiles[0])?.id
      : undefined;
  const onAddPage = pathname === "/profiles/new";

  // On phones the sidebar is a sheet: close it once a destination is chosen.
  const closeSheet = () => setOpenMobile(false);

  return (
    <SidebarMenu>
      {profiles.map((profile) => {
        const selected = profile.id === selectedId;
        return (
          <SidebarMenuItem key={profile.id}>
            <SidebarMenuButton asChild size="row" isActive={selected} tooltip={profile.name}>
              <Link
                href={`/?profile=${encodeURIComponent(profile.id)}`}
                aria-current={selected ? "page" : undefined}
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
                      className="absolute top-px right-px size-[7px] rounded-full bg-urgency-red"
                    />
                  ) : null}
                </span>
                <span className="group-data-[collapsible=icon]:sr-only">{profile.name}</span>
                {profile.runningOut ? <span className="sr-only">, running out</span> : null}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
      <SidebarMenuItem className="mt-4">
        <SidebarMenuButton asChild size="row" isActive={onAddPage} tooltip="Add new">
          <Link
            href="/profiles/new"
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
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
