import { Button } from "@/components/ui/button";

/** Plain form posting to the sign-out route; no client state needed. */
export function SignOutButton() {
  return (
    <form method="post" action="/auth/sign-out">
      <Button type="submit" variant="outline">
        Sign out
      </Button>
    </form>
  );
}
