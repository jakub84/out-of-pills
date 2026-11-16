import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; email: string };

/**
 * The authoritative "who is signed in" check for protected pages and actions.
 * Verifies the session with Supabase and redirects to `/sign-in` when there is none.
 * Reads cookies: call it inside `<Suspense>`, never inside `use cache`.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims?.sub) {
    redirect("/sign-in");
  }

  return { id: claims.sub, email: claims.email ?? "" };
}
