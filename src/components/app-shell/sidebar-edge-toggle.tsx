"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";

/**
 * Desktop toggle sitting on the sidebar's right border: collapses the sidebar to its
 * icon rail (avatars and "+ Add new") and expands it again. Phones use the header trigger.
 */
export function SidebarEdgeToggle() {
  const { state, toggleSidebar } = useSidebar();
  const expanded = state === "expanded";
  const Icon = expanded ? PanelLeftClose : PanelLeftOpen;

  return (
    <Button
      type="button"
      size="icon-sm"
      onClick={toggleSidebar}
      aria-label={expanded ? "Collapse profiles" : "Expand profiles"}
      aria-expanded={expanded}
      className="absolute top-6 -right-4 z-20 hidden rounded-full shadow-sm md:inline-flex"
    >
      <Icon aria-hidden />
    </Button>
  );
}
