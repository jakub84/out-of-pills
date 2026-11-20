"use client";

import { Ellipsis, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import { useNavigationPending } from "@/components/navigation/navigation-pending";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuAction, useSidebar } from "@/components/ui/sidebar";
import { DeleteProfileDialog } from "./delete-profile-dialog";
import type { ProfileNavItem } from "./profile-nav";

type OpenDialog = "delete" | null;

type ProfileOptionsMenuProps = {
  profile: Pick<ProfileNavItem, "id" | "name" | "medicationCount">;
};

/**
 * The selected sidebar row's "⋯" (mock 176:226). "Edit profile" opens the edit page;
 * "Delete profile" opens its confirmation. Render it inside the row's `SidebarMenuItem`,
 * after its `SidebarMenuButton`; the icon rail hides it.
 */
export function ProfileOptionsMenu({ profile }: ProfileOptionsMenuProps) {
  const { navigate } = useNavigationPending();
  const { setOpenMobile } = useSidebar();
  const [dialog, setDialog] = useState<OpenDialog>(null);

  function openEditPage() {
    navigate(`/profiles/${encodeURIComponent(profile.id)}/edit`);
    // On phones the sidebar is a sheet: close it once a destination is chosen.
    setOpenMobile(false);
  }

  /** Open state of one dialog; closing it closes whichever dialog is open. */
  function dialogProps(name: Exclude<OpenDialog, null>) {
    return {
      open: dialog === name,
      onOpenChange: (open: boolean) => setDialog(open ? name : null),
    };
  }

  return (
    <>
      <DropdownMenu>
        {/* Centred in the 48px row; the row's name truncates before it (see ProfileNav). */}
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction
            aria-label={`Options for ${profile.name}`}
            className="top-1/2 right-3 w-7 -translate-y-1/2 [&>svg]:size-5"
          >
            <Ellipsis aria-hidden />
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="end" className="w-48">
          <DropdownMenuItem onSelect={openEditPage}>
            <Pencil aria-hidden />
            Edit profile
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
            <Trash2 aria-hidden />
            Delete profile
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Outside the dropdown, which unmounts its items once it closes. */}
      <DeleteProfileDialog profile={profile} {...dialogProps("delete")} />
    </>
  );
}
