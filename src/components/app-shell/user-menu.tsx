import { LogOut } from "lucide-react";

import { signOut } from "@/app/(auth)/actions";
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
 * Header avatar (the caregiver's initial) opening a menu with their name, email and
 * "Sign out". Reads the session: render it inside `<Suspense>`.
 */
export async function UserMenu() {
  const [user, caregiver] = await Promise.all([getCurrentUser(), getCaregiver()]);
  const name = caregiver?.displayName ?? "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
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
        {/* A plain form posting to the server action; the item submits it on click or Enter. */}
        <form action={signOut}>
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
