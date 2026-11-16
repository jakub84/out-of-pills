import { signOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

/** Plain form posting to the `signOut` server action; no client state needed. */
export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="outline">
        Sign out
      </Button>
    </form>
  );
}
