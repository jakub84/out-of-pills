import { signOut } from "@/app/(auth)/actions";

/** Plain form posting to the `signOut` server action; no client state needed. */
export function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="h-10 rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-900"
      >
        Sign out
      </button>
    </form>
  );
}
