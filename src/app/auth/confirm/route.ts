import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

type LinkType = "email" | "recovery";

function isLinkType(value: string | null): value is LinkType {
  return value === "email" || value === "recovery";
}

/**
 * Accepts only same-origin relative paths starting with a single "/".
 * Rejects "//host", "/\host" and absolute URLs to prevent an open redirect.
 */
function safeNext(next: string | null, origin: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/";
  }
  try {
    const url = new URL(next, origin);
    if (url.origin !== origin) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

/** Email-link handler: turns a `token_hash` link into a session, then redirects. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeNext(searchParams.get("next"), origin);

  if (tokenHash && isLinkType(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      redirect(next);
    }
  }

  redirect("/sign-in?error=link-invalid");
}
