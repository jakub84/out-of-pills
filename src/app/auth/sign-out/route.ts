import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Sign-out target for plain form posts. The browser loads `/sign-in` as a new document, which
 * clears the client state Next.js keeps for visited pages, so nothing reaches the next user.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 303 makes the browser follow the redirect with GET.
  return NextResponse.redirect(new URL("/sign-in", request.url), 303);
}
