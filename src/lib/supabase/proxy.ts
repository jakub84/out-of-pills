import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Auth pages for signed-out users; signed-in users are sent to `/`. */
const PUBLIC_AUTH_PATHS = ["/sign-in", "/sign-up", "/forgot-password"];

/** Paths that always pass through, regardless of session. */
const PASS_THROUGH_PATHS = ["/auth/confirm"];

function matches(pathname: string, paths: string[]) {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Refreshes the Supabase session cookies and applies optimistic auth redirects.
 * This is not the authoritative check — pages and actions use `getCurrentUser()`
 * from `@/lib/auth/dal`.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  let cacheHeaders: Record<string, string> = {};

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          cacheHeaders = { ...cacheHeaders, ...headers };
          Object.entries(cacheHeaders).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // Must run right after creating the client: it refreshes an expired session
  // and triggers setAll. Do not put other code between the two.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims?.sub);

  const { pathname } = request.nextUrl;

  if (matches(pathname, PASS_THROUGH_PATHS)) {
    return response;
  }

  if (matches(pathname, PUBLIC_AUTH_PATHS)) {
    return isSignedIn ? redirectWithCookies(request, "/", response) : response;
  }

  return isSignedIn ? response : redirectWithCookies(request, "/sign-in", response);
}

/** Builds a redirect that keeps any refreshed session cookies and cache headers. */
function redirectWithCookies(
  request: NextRequest,
  pathname: string,
  from: NextResponse,
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  from.headers.forEach((value, key) => {
    if (["cache-control", "expires", "pragma"].includes(key.toLowerCase())) {
      redirect.headers.set(key, value);
    }
  });
  return redirect;
}
