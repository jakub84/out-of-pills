"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { avatarBgClass } from "@/components/profiles/avatar-colors";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { AvatarColor } from "@/lib/profiles/validation";
import { cn } from "@/lib/utils";

export type ProfileNavItem = {
  id: string;
  name: string;
  initial: string;
  avatarColor: AvatarColor;
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
                <span
                  aria-hidden
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-foreground",
                    avatarBgClass[profile.avatarColor],
                  )}
                >
                  {profile.initial}
                </span>
                <span className="group-data-[collapsible=icon]:sr-only">{profile.name}</span>
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
              className="flex size-6 shrink-0 items-center justify-center rounded-md border border-dashed border-brand-subtle text-brand-ink"
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
