"use client";

import { Ellipsis, Pencil } from "lucide-react";

import { useNavigationPending } from "@/components/navigation/navigation-pending";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuAction, useSidebar } from "@/components/ui/sidebar";

type ProfileOptionsMenuProps = {
  profile: { id: string; name: string };
};

/**
 * The selected sidebar row's "⋯" (mock 176:226). "Edit profile" opens the edit page.
 * Render it inside the row's `SidebarMenuItem`, after its `SidebarMenuButton`; the icon
 * rail hides it.
 */
export function ProfileOptionsMenu({ profile }: ProfileOptionsMenuProps) {
  const { navigate } = useNavigationPending();
  const { setOpenMobile } = useSidebar();

  function openEditPage() {
    navigate(`/profiles/${encodeURIComponent(profile.id)}/edit`);
    // On phones the sidebar is a sheet: close it once a destination is chosen.
    setOpenMobile(false);
  }

  return (
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
