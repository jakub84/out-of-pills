import { LogOut } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getCurrentUser } from "@/lib/auth/dal";
import { getCaregiver } from "@/lib/profiles/dal";
import { initialOf } from "@/lib/profiles/validation";

/**
 * "Hi: <name>" in the header, left of the avatar. On phones it takes what the menu button and
 * logo leave (`100vw - 15.75rem`). Reads the session: render it inside `<Suspense>`.
 */
export async function UserGreeting() {
  const caregiver = await getCaregiver();
  if (!caregiver) return null;

  return (
    <p
      title={caregiver.displayName}
      className="max-w-[calc(100vw-15.75rem)] truncate font-heading text-base font-light text-brand-ink sm:max-w-60 sm:text-lg"
    >
      <span className="font-medium">Hi:</span> {caregiver.displayName}
    </p>
  );
}

/**
 * Header avatar (the caregiver's initial) opening a menu with their name, email and
 * "Sign out". Hidden on phones, where the sidebar sheet has the same details and sign-out.
 * Reads the session: render it inside `<Suspense>`.
 */
export async function UserMenu() {
  const [user, caregiver] = await Promise.all([getCurrentUser(), getCaregiver()]);
  const name = caregiver?.displayName ?? "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="hidden rounded-full sm:inline-flex"
          aria-label="Account menu"
        >
          <Avatar>
            <AvatarFallback className="bg-primary text-sm text-primary-foreground">
              {initialOf(name || user.email)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          {name ? (
            <span className="truncate text-sm font-semibold text-foreground">{name}</span>
          ) : null}
          <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* A plain form posting to the sign-out route; the item submits it on click or Enter. */}
        <form method="post" action="/auth/sign-out">
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut aria-hidden />
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
