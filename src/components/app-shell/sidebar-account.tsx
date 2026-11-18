import { LogOut } from "lucide-react";

import { signOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/dal";
import { getCaregiver } from "@/lib/profiles/dal";

/**
 * Sidebar footer: the caregiver's name, email and "Sign out". On the collapsed icon rail only
 * the button's icon stays. Reads the session: render it inside `<Suspense>`.
 */
export async function SidebarAccount() {
  const [user, caregiver] = await Promise.all([getCurrentUser(), getCaregiver()]);

  return (
    <div className="flex flex-col gap-3 group-data-[collapsible=icon]:items-center">
      <div className="flex min-w-0 flex-col gap-0.5 group-data-[collapsible=icon]:hidden">
        {caregiver ? (
          <p className="truncate text-sm font-semibold text-foreground">{caregiver.displayName}</p>
        ) : null}
        <p className="truncate text-xs text-brand-subtle" title={user.email}>
          {user.email}
        </p>
      </div>
      <form action={signOut} className="w-full group-data-[collapsible=icon]:w-auto">
        <Button
          type="submit"
          variant="ghost"
          size="md"
          title="Sign out"
          className="w-full justify-start px-0 text-primary hover:bg-transparent hover:text-primary hover:underline group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:hover:bg-muted"
        >
          {/* Only on the icon rail, where the label is hidden. */}
          <LogOut aria-hidden className="hidden group-data-[collapsible=icon]:block" />
          <span className="group-data-[collapsible=icon]:sr-only">Sign out</span>
        </Button>
      </form>
    </div>
  );
}
