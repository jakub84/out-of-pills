import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; email: string };

/**
 * The authoritative "who is signed in" check for protected pages and actions.
 * Verifies the session with Supabase and redirects to `/sign-in` when there is none.
 * Wrapped in React `cache()` so one request verifies the session once, however many
 * components ask. Reads cookies: call it inside `<Suspense>`, never inside `use cache`.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  // getClaims() checks token expiry with Date.now(). With partialPrefetching, Next.js
  // prerenders this with cookies available and rejects the clock read; connection()
  // marks the session check as request-time work.
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims?.sub) {
    redirect("/sign-in");
  }

  return { id: claims.sub, email: claims.email ?? "" };
});
