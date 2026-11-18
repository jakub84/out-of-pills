import { Suspense, type ReactNode } from "react";

import { AppHeader } from "@/components/app-shell/app-header";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { HeaderSidebarTrigger } from "@/components/app-shell/header-sidebar-trigger";
import { UserMenu } from "@/components/app-shell/user-menu";
import { PendingRegion } from "@/components/navigation/navigation-pending";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Signed-in shell (mock 176:226): sticky header, profiles sidebar, main area.
 * `defaultOpen` is static on purpose: reading the `sidebar_state` cookie here would be
 * request-time work outside `<Suspense>`, which `cacheComponents` rejects.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    // TooltipProvider: collapsed sidebar rows show the profile name on hover.
    <TooltipProvider>
      <SidebarProvider defaultOpen className="flex-col">
        <AppHeader className="sticky top-0 z-20" leading={<HeaderSidebarTrigger />}>
          {/* Reads the session: keep it behind Suspense so the shell stays static. */}
          <Suspense fallback={<Skeleton className="size-8 rounded-full" />}>
            <UserMenu />
          </Suspense>
        </AppHeader>
        <div className="flex flex-1">
          <AppSidebar />
          <SidebarInset>
            <PendingRegion>{children}</PendingRegion>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
