"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";

/**
 * Header button that opens the profiles sheet below `md`. On desktop the sidebar is
 * collapsed and expanded by the toggle on its right border instead.
 */
export function HeaderSidebarTrigger() {
  return <SidebarTrigger aria-label="Show profiles" className="md:hidden" />;
}
