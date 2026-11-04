# Email Sign-in Implementation Plan

## Overview

Roadmap item S-01 (`email-sign-in`, FR-001): a user can sign up with email + password, confirm the address through an emailed link, sign in, reset a forgotten password, sign out, and land on an empty main screen that only signed-in users can reach. This is also the first time Supabase is wired into the app, so the plan establishes the Supabase clients, session refresh and auth-routing conventions every later slice reuses.

## Current State Analysis

- The app is an untouched create-next-app scaffold: `src/app/page.tsx` is the Next.js welcome page, `src/app/layout.tsx:21-24` still has the default "Create Next App" metadata.
- No Supabase anything: no `@supabase/ssr` / `@supabase/supabase-js` dependency (`package.json`), no `supabase/` folder, no `.env.example`, no `proxy.ts`.
- `next.config.ts` enables `cacheComponents: true` and `partialPrefetching: true`. With Cache Components, reading `cookies()` outside a `<Suspense>` boundary is a build error, and `cookies()` cannot be read inside a plain `use cache` scope (`node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`, Step 2 and "Common pitfalls").
- Next.js 16 renamed Middleware to **Proxy**: the file is `src/proxy.ts`, exporting `proxy` (`node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`).
- No test runner exists; `npm run build` and `npm run lint` are the only automated gates (AGENTS.md, Commands).
- AGENTS.md hard rules that apply: Supabase only through `@supabase/ssr`; never import a service-role key into browser-reachable code; Server Components by default; commit `.env.example` only.

## Desired End State

- Running `npx supabase start` (Docker Desktop) + `npm run dev` gives a working local auth stack; confirmation and reset emails land in the local Mailpit inbox (http://127.0.0.1:54324).
- A visitor at `/` is redirected to `/sign-in`. From there they can go to `/sign-up`, create an account (password ≥ 8 chars with letters and digits), receive a confirmation email, click it, and land signed in on `/`.
- `/` shows the signed-in user's email, an empty state ("No profiles yet" — profiles arrive in S-02) and a Sign out button.
- Signing in with an unconfirmed account shows "Confirm your email" with a "Resend link" button.
- `/forgot-password` sends a reset link; the link opens `/reset-password`, where the user sets a new password and ends up signed in on `/`.
- Messages never reveal whether an email address has an account.
- Production: a Supabase cloud project is configured with the same auth policy, Resend SMTP on the user's own domain, and the same email templates; the public-URL steps complete once F-01 (`deploy-pipeline`) provides a production URL.

### Key Discoveries:

- `src/app/layout.tsx:28` already sets `lang="en"` — matches the English-UI decision; only metadata needs changing.
- `next.config.ts:5` `cacheComponents: true` → the session read must live in a component wrapped in `<Suspense>`, not at the top of a layout or page.
- `.gitignore` already ignores `.env`, `.env.*` and re-includes `!.env.example`; `*.local` is ignored too.
- Next 16 docs recommend Proxy only for optimistic checks; authorization must be re-verified close to the data (`02-guides/authentication.md`, "Optimistic checks with Proxy").

## What We're NOT Doing

- Google sign-in (S-04, `google-sign-in`).
- Profiles or any app table / migration with RLS — this slice creates no tables (S-02).
- Deploy pipeline, Vercel project and CI (F-01, `deploy-pipeline`); Phase 4 only prepares the auth side of production.
- A browser-side Supabase client helper — nothing in this slice needs one; it is added by the first slice that does.
- Account deletion, email change, password change while signed in, "remember me", MFA.
- A test runner or E2E tests (decided: build + lint + manual checklist; unit tests arrive with S-03's calculation logic, E2E via `/10x-e2e-setup` later).
- i18n — the UI is English only.

## Implementation Approach

Follow the Supabase `@supabase/ssr` pattern adapted to Next 16 + Cache Components:

- **Session refresh + optimistic routing in `src/proxy.ts`.** Every request refreshes the Supabase session cookie and redirects by route class (public auth pages vs protected pages). Proxy is a convenience, not the security boundary.
- **Authoritative check in a Data Access Layer.** `getCurrentUser()` (server-only) verifies the user with Supabase and redirects to `/sign-in` when absent; every protected page and every server action that needs a user calls it.
- **Mutations as Server Actions**, forms as small `"use client"` components using `useActionState` for pending/error states. Pages themselves stay Server Components.
- **Email links use the `token_hash` flow**: templates link to `/auth/confirm?token_hash=…&type=…&next=…`, a Route Handler calls `verifyOtp` and redirects. This works even when the link is opened in a different browser than the one used to sign up (unlike the PKCE code flow).
- **Auth policy lives in `supabase/config.toml`** for local dev and is mirrored to the cloud project in Phase 4.

## Critical Implementation Details

- **Cache Components + session reads.** Any server component that calls `getCurrentUser()` (directly or through the Supabase server client) must be rendered inside `<Suspense>`; never call it at the top level of `layout.tsx`. Do not wrap Supabase calls in `use cache` — the client reads `cookies()`.
- **Proxy cookie handling.** In the proxy helper, create the Supabase client with `getAll`/`setAll` cookie adapters that write refreshed cookies to *both* the request and the response, call `supabase.auth.getClaims()` immediately after creating the client (no code in between), and if you build a redirect response, copy the refreshed cookies onto it — otherwise sessions get silently dropped.
- **Server client `setAll` in Server Components.** Writing cookies from a Server Component throws; the server helper's `setAll` must swallow that error (the proxy does the refresh). This is the documented `@supabase/ssr` pattern.
- **`next` redirect parameter.** `/auth/confirm` must accept only same-origin relative paths starting with a single `/` (reject `//…` and absolute URLs) to avoid an open redirect; default to `/`.
- **`/reset-password` is reachable only with a session** (the recovery link creates one). Proxy must not bounce signed-in users away from it, unlike the other auth pages.

## Phase 1: Local Supabase and client wiring

### Overview

Install Supabase, run it locally with the auth policy decided in planning, and wire the server-side clients and session-refreshing proxy. No user-facing screens yet besides metadata.

### Changes Required:

#### 1. Dependencies

**File**: `package.json`

**Intent**: Add the Supabase runtime libraries and the Supabase CLI so the local stack can be started via `npx supabase …` without a global install.

**Contract**: dependencies `@supabase/ssr`, `@supabase/supabase-js` (peer of `@supabase/ssr`; never imported directly in components); devDependency `supabase` (CLI). No other new runtime dependencies (form validation is hand-written).

#### 2. Local Supabase project config

**File**: `supabase/config.toml` (generated by `npx supabase init`, then edited)

**Intent**: Encode the auth policy decided in planning so local behaviour matches production.

**Contract**:
- `[auth]` `site_url = "http://localhost:3000"`, `additional_redirect_urls` includes `http://localhost:3000/**`, `minimum_password_length = 8`, `password_requirements = "letters_digits"`.
- `[auth.email]` `enable_signup = true`, `enable_confirmations = true`, `max_frequency` left at a short cooldown (e.g. `"1m"`) so "Resend link" is rate-limited.
- `[auth.email.template.confirmation]` and `[auth.email.template.recovery]` with English subjects and `content_path` pointing at the templates below.
- Leave the local mail catcher (Mailpit/Inbucket section) enabled on its default port 54324.

#### 3. Email templates

**File**: `supabase/templates/confirmation.html`, `supabase/templates/recovery.html`

**Intent**: Send `token_hash` links to our own `/auth/confirm` handler instead of Supabase's default verify URL, with short English copy branded "Out of Pills".

**Contract**: confirmation link `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/`; recovery link `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`. Same files are pasted into the cloud dashboard in Phase 4.

#### 4. Environment variables

**File**: `.env.example` (committed), `.env.local` (local only, not committed)

**Intent**: Document the two public values the app needs.

**Contract**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the publishable/anon key printed by `npx supabase status`). No service-role key anywhere.

#### 5. Supabase helpers

**File**: `src/lib/supabase/server.ts`, `src/lib/supabase/proxy.ts`

**Intent**: One server client factory for Server Components, Server Actions and Route Handlers, plus the proxy-side session refresher.

**Contract**:
- `server.ts`: `import "server-only"`; `export async function createClient()` → `createServerClient` from `@supabase/ssr` with `cookies()` from `next/headers`; `setAll` wrapped in try/catch (see Critical Implementation Details).
- `proxy.ts`: `export async function updateSession(request: NextRequest): Promise<NextResponse>` → refreshes the session via `getClaims()` and applies the routing rules below.

#### 6. Proxy

**File**: `src/proxy.ts`

**Intent**: Refresh the session on every page request and do optimistic redirects.

**Contract**: `export async function proxy(request)` delegates to `updateSession`. `config.matcher` excludes `_next/static`, `_next/image`, `favicon.ico` and image files. Routing rules:
- Public auth pages `/sign-in`, `/sign-up`, `/forgot-password`: signed-in → redirect `/`.
- `/auth/confirm`: always passes through.
- Everything else (including `/` and `/reset-password`): signed-out → redirect `/sign-in`.

#### 7. Data Access Layer

**File**: `src/lib/auth/dal.ts`

**Intent**: The single authoritative "who is signed in" check, used by protected pages and actions.

**Contract**: `import "server-only"`; `export async function getCurrentUser(): Promise<{ id: string; email: string }>` — verifies with Supabase (`auth.getClaims()` or `auth.getUser()`), calls `redirect("/sign-in")` when there is no user, returns a narrow object (no tokens).

#### 8. Metadata and docs

**File**: `src/app/layout.tsx`, `AGENTS.md`, `README.md`

**Intent**: Brand the app and document the new local workflow so the next agent/session can run it.

**Contract**:
- `layout.tsx` metadata: title "Out of Pills", description from PRD vision (one line).
- `AGENTS.md` Commands: add `npx supabase start` / `npx supabase stop` (requires Docker Desktop), Mailpit URL, `.env.local` from `.env.example`. Project Structure: add `supabase/` (config, templates, later migrations), `src/lib/supabase/` (server + proxy helpers), `src/lib/auth/dal.ts`, `src/proxy.ts`.
- `README.md`: short "Local setup" section with the same steps.

### Success Criteria:

#### Automated Verification:

- Dependencies install cleanly: `npm install`
- Local Supabase starts: `npx supabase start`
- Production build passes: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification:

- Mailpit inbox opens at http://127.0.0.1:54324
- With the stack running, opening http://localhost:3000/ redirects to `/sign-in` (404 page is acceptable until Phase 2)
- `.env.local` is not listed by `git status`; `.env.example` is

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Sign up, confirm, sign in, sign out

### Overview

The user-facing core of FR-001: account creation with email confirmation, sign-in (including the unconfirmed-account path), the protected empty main screen, and sign-out.

### Changes Required:

#### 1. Auth server actions

**File**: `src/app/(auth)/actions.ts`

**Intent**: All auth mutations, each re-validating input on the server and mapping Supabase errors to user-safe English messages.

**Contract**: `"use server"`. Actions with signature `(prevState: AuthFormState, formData: FormData) => Promise<AuthFormState>` where `AuthFormState = { status: "idle" | "error" | "success"; message?: string; fieldErrors?: Partial<Record<"email" | "password", string>>; email?: string }`:
- `signUp` — validates email + password (≥ 8, at least one letter and one digit); calls `auth.signUp`; on success **and** on "already registered" returns the same `success` state ("Check your email to confirm your account") — no enumeration. `weak_password` → field error.
- `signIn` — calls `auth.signInWithPassword`; `invalid_credentials` → "Invalid email or password"; `email_not_confirmed` → error state flagged so the form shows the resend button; success → `redirect("/")`.
- `resendConfirmation` — calls `auth.resend({ type: "signup", email })`; always returns a neutral success message; `over_email_send_rate_limit` → "Please wait a minute before requesting another email".
- `signOut` — `auth.signOut()` then `redirect("/sign-in")`.
Shared validation helpers live in `src/lib/auth/validation.ts` (pure functions, reusable by Phase 3).

#### 2. Auth pages and forms

**File**: `src/app/(auth)/layout.tsx`, `src/app/(auth)/sign-in/page.tsx`, `src/app/(auth)/sign-up/page.tsx`, `src/app/(auth)/_components/sign-in-form.tsx`, `src/app/(auth)/_components/sign-up-form.tsx`

**Intent**: Simple, mobile-first centred card layout (Tailwind) with clear labels, inline errors and a pending state on submit.

**Contract**: Pages are Server Components with no session reads (they stay static). Forms are `"use client"` components using `useActionState`. Sign-in links to `/sign-up` and `/forgot-password`; sign-up links to `/sign-in`. After successful sign-up the form is replaced by a "Check your email" panel with a "Resend link" button. Sign-in in the `email_not_confirmed` state shows "Confirm your email first" + "Resend link". HTML attributes mirror the server rules (`type="email"`, `required`, `minLength={8}`, `autoComplete`).

#### 3. Email-link handler

**File**: `src/app/auth/confirm/route.ts`

**Intent**: Turn a `token_hash` link from either email template into a session, then send the user on.

**Contract**: `GET` reads `token_hash`, `type` (`email` | `recovery`) and `next`; calls `auth.verifyOtp({ type, token_hash })`; on success redirects to the sanitised `next` (default `/`); on failure redirects to `/sign-in?error=link-invalid`, and the sign-in page shows "This link is invalid or has expired" with a path to resend.

#### 4. Protected main screen

**File**: `src/app/page.tsx` (replaces the create-next-app content), `src/app/_components/sign-out-button.tsx`

**Intent**: The empty main screen S-02 will fill with profiles.

**Contract**: Static shell (app name header) + `<Suspense>` around an async component that calls `getCurrentUser()` and renders "Signed in as {email}", an empty state ("No profiles yet") and a Sign out form posting to `signOut`. Remove now-unused starter assets references from the page (the SVGs in `public/` may stay or be deleted).

### Success Criteria:

#### Automated Verification:

- Production build passes: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification:

- Sign up with a new email → "Check your email" panel; the confirmation email arrives in Mailpit
- Clicking the confirmation link lands on `/` signed in, showing the email and the empty state
- Sign out returns to `/sign-in`; visiting `/` while signed out redirects to `/sign-in`
- Sign in with wrong password → "Invalid email or password"
- Sign in before confirming → "Confirm your email first" + Resend link; resent email arrives; a second resend within a minute shows the wait message
- Signing up again with an already-registered email shows the same "Check your email" panel
- Password `abcdefgh` or `12345678` is rejected with a clear message
- Signed-in user visiting `/sign-in` or `/sign-up` is redirected to `/`
- Opening an already-used confirmation link shows "This link is invalid or has expired"
- Screens are usable at phone width (browser devtools, 375 px)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Password reset

### Overview

"Forgot password" flow: request a link by email, set a new password, end up signed in.

### Changes Required:

#### 1. Reset actions

**File**: `src/app/(auth)/actions.ts`

**Intent**: Two more actions following the Phase 2 conventions.

**Contract**:
- `requestPasswordReset` — validates email; calls `auth.resetPasswordForEmail(email)`; always returns the neutral "If an account exists for this email, we sent a reset link" (rate-limit error → wait message).
- `updatePassword` — calls `getCurrentUser()` first (recovery session required); validates the new password + confirmation field match with the shared rules; `auth.updateUser({ password })`; success → `redirect("/")`.

#### 2. Reset pages

**File**: `src/app/(auth)/forgot-password/page.tsx`, `src/app/reset-password/page.tsx`, matching `"use client"` form components

**Intent**: Two simple forms in the same visual style as Phase 2.

**Contract**: `/forgot-password` is a public auth page (linked from sign-in). `/reset-password` sits outside the `(auth)` group because it requires a session; its page reads the user inside `<Suspense>` (signed-out visitors are redirected by proxy/DAL). Fields: new password + confirm password.

### Success Criteria:

#### Automated Verification:

- Production build passes: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification:

- "Forgot password?" on `/sign-in` → enter email → neutral message; reset email arrives in Mailpit
- Requesting a reset for an unknown email shows the same neutral message and sends nothing
- Reset link opens `/reset-password`; setting a valid new password lands on `/` signed in
- Signing out and signing in with the new password works; the old password is rejected
- Mismatched confirmation or a weak new password shows a field error
- Opening `/reset-password` while signed out redirects to `/sign-in`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Production auth configuration

### Overview

Mirror the local auth policy to a Supabase cloud project and set up Resend SMTP on the user's own domain. Mostly dashboard work; record the result in docs. The production URL comes from F-01 (`deploy-pipeline`) — steps that need it are marked and may be completed after F-01 lands.

### Changes Required:

#### 1. Cloud project

**File**: — (Supabase dashboard); `README.md` production section

**Intent**: Create the production project and apply the same auth policy as `supabase/config.toml`.

**Contract**: Free-plan project "out-of-pills" in an EU region (health data, users in Poland). Authentication settings: email provider on, confirm email on, minimum password length 8, password requirements "letters and digits". Email templates "Confirm signup" and "Reset password" use the same HTML and `token_hash` links as `supabase/templates/`. Link the CLI (`npx supabase link`) so S-02 can push migrations. Note in README that free projects pause after a week of inactivity and how to resume.

#### 2. Resend SMTP

**File**: — (Resend + DNS + Supabase dashboard)

**Intent**: Deliver confirmation and reset emails to any address (Supabase's default SMTP only reaches project team members and is heavily rate-limited).

**Contract**: Domain verified in Resend (SPF/DKIM DNS records), an API key used as the SMTP password; Supabase custom SMTP: host `smtp.resend.com`, port `465`, user `resend`, sender `no-reply@<your-domain>`, sender name "Out of Pills". The API key lives only in the Supabase dashboard — never in the repo.

#### 3. URLs and app env (after F-01)

**File**: — (Supabase dashboard, Vercel env vars)

**Intent**: Point email links at production and give the deployed app its Supabase credentials.

**Contract**: Supabase Site URL = production URL; Redirect URLs include `<production-url>/**`. Vercel env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the cloud project.

### Success Criteria:

#### Manual Verification:

- Cloud project auth settings match `supabase/config.toml` (confirmations, password policy, both templates)
- Resend shows the domain as verified; a Supabase test email (e.g. a password reset to your own address) is delivered from `no-reply@<your-domain>` and not to spam
- After F-01: on the production URL, the full Phase 2 + Phase 3 manual checklist passes with a real inbox

**Implementation Note**: The last criterion depends on F-01. If F-01 is not yet done, complete the other two criteria, leave the last one unchecked, and finish it right after F-01 deploys.

---

## Testing Strategy

### Unit Tests:

- None in this slice (no test runner yet; decided during planning). `src/lib/auth/validation.ts` is pure so it can be covered once S-03 introduces a unit test runner.

### Integration Tests:

- None automated. The Phase 2/3 manual checklists against the local Supabase + Mailpit stack serve as the integration pass.

### Manual Testing Steps:

1. `npx supabase start`, `npm run dev`, open http://localhost:3000 → redirected to `/sign-in`.
2. Sign up → confirm via Mailpit → land on `/` signed in → sign out.
3. Unconfirmed sign-in → resend link → confirm.
4. Forgot password → reset via Mailpit → sign in with the new password.
5. Repeat key steps at 375 px width.
6. After Phase 4 + F-01: repeat 2–4 on production with a real inbox.

## Performance Considerations

Proxy runs on every page request, so it only refreshes/reads the session cookie — no database queries. Auth pages contain no session reads and prerender statically; the main screen streams the user section behind `<Suspense>`.

## Migration Notes

None — no existing users or tables. No SQL migrations in this slice; the `supabase/` folder is created so S-02 can add `supabase/migrations/`.

## References

- Roadmap item: `context/foundation/roadmap.md` — S-01 `email-sign-in`
- PRD: `context/foundation/prd.md` — FR-001, Access Control, NFRs
- Tech stack: `context/foundation/tech-stack.md`
- Next.js 16 Proxy: `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`
- Auth with Cache Components: `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`
- Next.js auth guide (Supabase link, optimistic checks): `node_modules/next/dist/docs/01-app/02-guides/authentication.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Local Supabase and client wiring

#### Automated

- [x] 1.1 Dependencies install cleanly: `npm install` — 5cdae7b
- [x] 1.2 Local Supabase starts: `npx supabase start` — 5cdae7b
- [x] 1.3 Production build passes: `npm run build` — 5cdae7b
- [x] 1.4 Lint passes: `npm run lint` — 5cdae7b

#### Manual

- [x] 1.5 Mailpit inbox opens at http://127.0.0.1:54324 — 5cdae7b
- [x] 1.6 With the stack running, opening http://localhost:3000/ redirects to `/sign-in` (404 page is acceptable until Phase 2) — 5cdae7b
- [x] 1.7 `.env.local` is not listed by `git status`; `.env.example` is — 5cdae7b

### Phase 2: Sign up, confirm, sign in, sign out

#### Automated

- [x] 2.1 Production build passes: `npm run build` — 6327d05
- [x] 2.2 Lint passes: `npm run lint` — 6327d05

#### Manual

- [x] 2.3 Sign up with a new email → "Check your email" panel; the confirmation email arrives in Mailpit — 6327d05
- [x] 2.4 Clicking the confirmation link lands on `/` signed in, showing the email and the empty state — 6327d05
- [x] 2.5 Sign out returns to `/sign-in`; visiting `/` while signed out redirects to `/sign-in` — 6327d05
- [x] 2.6 Sign in with wrong password → "Invalid email or password" — 6327d05
- [x] 2.7 Sign in before confirming → "Confirm your email first" + Resend link; resent email arrives; a second resend within a minute shows the wait message — 6327d05
- [x] 2.8 Signing up again with an already-registered email shows the same "Check your email" panel — 6327d05
- [x] 2.9 Password `abcdefgh` or `12345678` is rejected with a clear message — 6327d05
- [x] 2.10 Signed-in user visiting `/sign-in` or `/sign-up` is redirected to `/` — 6327d05
- [x] 2.11 Opening an already-used confirmation link shows "This link is invalid or has expired" — 6327d05
- [x] 2.12 Screens are usable at phone width (browser devtools, 375 px) — 6327d05

### Phase 3: Password reset

#### Automated

- [x] 3.1 Production build passes: `npm run build`
- [x] 3.2 Lint passes: `npm run lint`

#### Manual

- [x] 3.3 "Forgot password?" on `/sign-in` → enter email → neutral message; reset email arrives in Mailpit
- [x] 3.4 Requesting a reset for an unknown email shows the same neutral message and sends nothing
- [x] 3.5 Reset link opens `/reset-password`; setting a valid new password lands on `/` signed in
- [x] 3.6 Signing out and signing in with the new password works; the old password is rejected
- [x] 3.7 Mismatched confirmation or a weak new password shows a field error
- [x] 3.8 Opening `/reset-password` while signed out redirects to `/sign-in`

### Phase 4: Production auth configuration

#### Manual

- [ ] 4.1 Cloud project auth settings match `supabase/config.toml` (confirmations, password policy, both templates)
- [ ] 4.2 Resend shows the domain as verified; a Supabase test email (e.g. a password reset to your own address) is delivered from `no-reply@<your-domain>` and not to spam
- [ ] 4.3 After F-01: on the production URL, the full Phase 2 + Phase 3 manual checklist passes with a real inbox
