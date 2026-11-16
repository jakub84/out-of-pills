# Create and Switch Profiles Implementation Plan

## Overview

Roadmap S-02 (`create-and-switch-profiles`, FR-003, FR-006): a signed-in caregiver gives their first name, creates profiles for the people whose medications they track ("Mom", "Me", …) and switches between them on the main screen. The slice also brings the app onto the design from Figma (file `jThXxph37aBIqtM28HkonX`): shadcn components, CSS tokens, the "Out of Pills soon?" brand, and restyled auth screens. It creates the first tables holding user data, and their row-level security becomes the privacy template every later slice copies.

## Current State Analysis

- `/` (`src/app/page.tsx:25-47`) renders "Signed in as {email}", a Sign out button and a static "No profiles yet" panel inside `<Suspense>`; `getCurrentUser()` (`src/lib/auth/dal.ts:15`) is the authoritative auth check.
- No database objects: no `supabase/migrations/`, no `supabase/tests/`. `supabase/config.toml:60-72` has default migration/seed settings (`seed.sql` path, not present).
- Forms follow one pattern: server action `(prevState, formData) => FormState` + `useActionState` (`src/app/(auth)/actions.ts`, `src/app/(auth)/_components/sign-in-form.tsx`), field helpers `readField` (`src/lib/auth/validation.ts:13`), `TextField` and button class strings (`src/app/(auth)/_components/text-field.tsx`).
- Styling is hardcoded `zinc-*` utilities with `dark:` variants; `src/app/globals.css` is the create-next-app default (two vars, Arial body). No shadcn, no `components.json`, no `cn()` helper, no icon library. Fonts: Geist + Geist Mono via `next/font` (`src/app/layout.tsx:5-13`).
- `next.config.ts` enables `cacheComponents` and wires Tailwind v4 through a Turbopack CSS loader rule — anything reading cookies or `searchParams` must sit inside `<Suspense>`.
- Previews and staging use the production Supabase project (README "Deploying"), so a PR preview queries the cloud schema. CI (`.github/workflows/ci.yml`) runs no migrations.
- Figma mocks (all light theme, Polish copy):
  - `176:552` sign-in — wordmark logo, pill mascot, teal `#37968a` primary, 56px/16px-radius button, inputs with 4/12/12/12 radius.
  - `164:172` onboarding step 2 "Your name" — 3-step stepper (Account ✓ · Your name · First profile), Josefin Sans headings, app header (logo + avatar initial).
  - `162:73` onboarding step 3 "First profile" — four profile-type cards (me / parent / child / someone else, Lucide icons), name input with suggestion chips, avatar colour grid (6 swatches), Back + "Create profile "<name>"".
  - `176:226` main screen — header (logo, bell, avatar), collapsible left sidebar ("Profiles:" list with avatar, selected row teal bar + 7% teal background, `…` menus, "+ Add new", "Settings → My profile"), main area ("Hi: <user>", "Profile: <name>", medication overview and cards, illustration).
- Figma variables are shadcn-named: `general/border #e5e5e5`, `general/foreground #000`, `general/muted-foreground #737373`, `general/input #e5e5e5`, `radius-full 999`, spacing `2xs 4`, `xs 8`, body font Geist 14/20.

## Desired End State

- A new user signs up, confirms, signs in and is taken through onboarding: enters their first name, picks whose medications they track, names the profile (chips help), picks an avatar colour, and lands on the main screen showing that profile.
- The main screen shows the app header with an avatar menu (name, email, Sign out), a sidebar listing all the user's profiles (oldest first) with the selected one highlighted, "+ Add new" leading to `/profiles/new`, and the selected profile's heading plus an empty medication-stock state. Selection lives in `/?profile=<id>`; on phones the sidebar is a sheet.
- No user can read or change another user's caregiver row, profiles or memberships — proven by pgTAP tests and a two-account manual check.
- Sign-in, sign-up, forgot-password and reset-password use the new brand and shadcn components; all UI copy is English.

Verify: run the S-01 sign-up locally, complete onboarding, add a second profile, switch between them, try another user's profile id in the URL; `npx supabase test db` is green.

### Key Discoveries:

- `profiles` rows become readable only after their membership row exists, so a plain `insert … returning` from the client fails RLS — creation goes through one `create_profile()` function that writes both rows.
- Previews hit the production database: a migration must be in the cloud before the PR preview can work, and must not break the deployed `master` build (additive only).
- `cacheComponents` (`next.config.ts:5`): pages reading `searchParams`, cookies or the session keep that read behind `<Suspense>` (pattern in `src/app/(auth)/sign-in/page.tsx:20-22`).
- The mock's "less than 7 days" urgency group conflicts with the PRD (red ≤ 14 days) — irrelevant here (no medications yet), flagged for S-03.

## What We're NOT Doing

- Rename or delete profiles, the `…` row menus (S-08); urgency dots on avatars (S-09); medications, the "Add new medication" button, overview cards and stats (S-03+); demo mode (S-10).
- Bell / notifications, "Last signed in N days ago", "Settings → My profile" (no way to change the display name after onboarding yet — the step-2 hint copy does not promise one).
- Sharing profiles or inviting caregivers (FR-016); `profile_caregivers` exists but only ever holds the creator.
- Dark mode — the mocks are light only; existing `dark:` variants are removed from restyled screens.
- Running migrations or pgTAP in CI; a JS test runner.
- Unique profile names — two profiles may share a name.
- Google sign-in on the restyled sign-in screen (S-04).

## Implementation Approach

Four phases, each ending in a checkable state. First the design foundation, so every later screen is built from shared components and tokens rather than restyled twice. Then the database with its RLS and tests, so UI phases build on a proven privacy boundary and generated types. Then onboarding, which creates the first rows. Finally the main screen with switching and the add-profile page, which reuses the onboarding form.

Translate Polish mock copy to English, freely improving it (e.g. "Konto gotowe — witamy!" → "Account ready — welcome!", "Czyich leków pilnujemy?" → "Whose medications are we keeping an eye on?"). Treat mock code as a visual reference only: build with project-native flex/grid layout, shadcn components and tokens, never absolute positioning or hex literals in components.

## Critical Implementation Details

**Figma assets expire.** Asset URLs returned by `get_design_context` live 7 days. Re-run `get_design_context` on the node during implementation, download the logo SVG, mascot PNG (`176:566`) and main-screen illustration (`176:228`) into `public/brand/`, and never reference Figma URLs at runtime. Icons come from `lucide-react` (the mocks use Lucide names), not from downloaded SVGs.

**Migration before merge.** For any PR containing a migration: verify locally (`npx supabase db reset`, `npx supabase test db`), then `npx supabase db push` to the linked cloud project, then let the preview run, then merge. Never edit a migration that has been pushed; add a new one. In this slice the push happens in Phase 4, right before the PR opens, so Phases 3–4 can still amend the unpushed migration.

**RLS without recursion.** `profiles` policies check `profile_caregivers`; `profile_caregivers` policies must only compare `user_id` to `(select auth.uid())` and never query `profiles`, otherwise Postgres reports infinite recursion in policy.

## Phase 1: Design foundation

### Overview

Install shadcn on the existing Tailwind v4 setup, define the token layer from the Figma variables, add the brand fonts and assets, and restyle the four auth screens to match mock `176:552`.

### Changes Required:

#### 1. shadcn setup

**File**: `components.json`, `src/lib/utils.ts`, `src/components/ui/*`, `package.json`

**Intent**: Give the app one reusable component library so every screen in this and later slices shares the same building blocks.

**Contract**: `npx shadcn@latest init` (Tailwind v4, CSS variables, `@/components`, `@/lib/utils` aliases), `lucide-react` as icon library. Run init as-is: it detects Tailwind v4 from `@import "tailwindcss"`, needs no `tailwind.config` or `postcss.config`, and adds `cn`, `class-variance-authority`, `radix-ui`, `lucide-react`, `tw-animate-css` (no clsx/tailwind-merge). Add the components this slice uses: `button`, `input`, `label`, `card`, `alert`, `avatar`, `dropdown-menu`, `sidebar` (brings `sheet`, `separator`, `tooltip`, `skeleton`, `use-mobile`), `radio-group`, `toggle-group`. Customise variants in the generated files to the mocks: `Button` default = primary teal, `size="lg"` 56px with 16px radius, `outline` variant for Back; `Input` 40px with the 4/12/12/12 corner radius. Keep the Turbopack CSS loader in `next.config.ts` working (`npm run build` must pass).

#### 2. Tokens and fonts

**File**: `src/app/globals.css`, `src/app/layout.tsx`

**Intent**: One source of colours, radii and fonts so components never carry hex values.

**Contract**: `globals.css` defines shadcn's semantic variables on `:root` (light only) mapped from Figma: `--primary` teal `#37968a`, `--primary-foreground` white, `--foreground` `#000`/`#0a0a0a`, `--muted-foreground` `#737373`, `--border`/`--input` `#e5e5e5`, `--background` `#f5f5f5` for app pages, `--card` white, `--destructive` for errors; brand extras `--brand-ink #2a303c`, `--brand-subtle #646873`, urgency placeholders are NOT added (S-03). Six avatar tokens `--avatar-mint #dceee9`, `--avatar-slate #dde3ea`, `--avatar-sand #f2e6d0`, `--avatar-rose #f2dfe5`, `--avatar-lavender #e4e0f3`, `--avatar-stone #ecebe7`, exposed to Tailwind via `@theme inline` (e.g. `bg-avatar-mint`). Fonts: Geist as `--font-sans`, Josefin Sans (`next/font/google`, weights 300–700) as `--font-heading` (`font-heading` utility). Remove the dark-mode media query and the Arial body rule.

#### 3. Brand assets and shell

**File**: `public/brand/logo.svg`, `public/brand/mascot.png`, `public/brand/stock-illustration.png`, `src/components/brand/logo.tsx`, `src/app/_components/auth-card.tsx`

**Intent**: The wordmark and mascot from the mocks, used consistently by auth screens and the app header.

**Contract**: Assets downloaded from Figma nodes (see Critical Implementation Details); `Logo` renders the SVG via `next/image` with its intrinsic width/height and an accessible label "Out of Pills soon?". `AuthCard` becomes the `176:552` layout: centered white card (35px radius on desktop, edge-to-edge on phones), logo, mascot, then children; thin teal top border on the page.

#### 4. Restyled auth screens

**File**: `src/app/(auth)/**`, `src/app/reset-password/**`, `src/app/_components/sign-out-button.tsx`

**Intent**: Sign-in matches the mock; sign-up, forgot and reset follow the same shell and components.

**Contract**: `TextField` keeps its props API but renders shadcn `Label` + `Input` with inline error/hint; error and notice panels use `Alert`; all buttons use `Button`, links use the primary colour with underline. Copy in English ("Log in to your account", "Log in", "Forgot your password?", "Don't have an account? Sign up"). Server actions, validation and redirects are unchanged. No `zinc-*` or `dark:` classes remain in `src/app`.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Production build passes: `npm run build`
- No hardcoded zinc or dark-mode classes remain in app code: `grep -rE "zinc-|dark:" src/app` returns nothing

#### Manual Verification:

- `/sign-in` visually matches Figma node `176:552` at desktop width (logo, mascot, field radii, teal button, links)
- Sign-up, forgot-password and reset-password use the same shell and components and read well at 375 px
- The S-01 flows still work: sign up, confirm via Mailpit, sign in, wrong password error, "Confirm your email first" + resend, password reset

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Database and privacy

### Overview

Create the first migration (caregivers, profiles, memberships, `create_profile()`), prove isolation with pgTAP, generate TypeScript types and document how migrations reach the cloud.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/<timestamp>_profiles.sql`

**Intent**: Store the caregiver's display name and their profiles in a shape that survives future sharing, with RLS enabled in the same migration (Hard Rule).

**Contract**:
- `caregivers(user_id uuid pk references auth.users on delete cascade, display_name text not null check (char_length(btrim(display_name)) between 1 and 40), created_at timestamptz default now())`. RLS: select / insert / update where `user_id = (select auth.uid())`; no delete policy.
- `profiles(id uuid pk default gen_random_uuid(), name text not null check (char_length(btrim(name)) between 1 and 40), kind text not null check (kind in ('me','parent','child','other')), avatar_color text not null check (avatar_color in ('mint','slate','sand','rose','lavender','stone')), created_at timestamptz not null default now())`. RLS: select for members (`exists` on `profile_caregivers` with `user_id = (select auth.uid())`); no insert, update or delete policy (rename/delete arrive with S-08, which adds and tests its own policies).
- `profile_caregivers(profile_id uuid references profiles on delete cascade, user_id uuid references auth.users on delete cascade, created_at timestamptz default now(), primary key (profile_id, user_id))`, index on `user_id`. RLS: select where `user_id = (select auth.uid())`; no insert/update/delete policy.
- `public.create_profile(p_name text, p_kind text, p_avatar_color text) returns uuid` — `security definer`, `set search_path = ''`, raises if `auth.uid()` is null or the caller has no `caregivers` row (so a profile never exists without its caregiver's name), inserts the profile and a membership for `auth.uid()`, returns the id; `revoke execute … from public, anon`; `grant execute … to authenticated`.
- Grants: `authenticated` gets only the table privileges the policies need; `anon` gets none.

#### 2. RLS tests

**File**: `supabase/tests/database/profiles_rls.test.sql`

**Intent**: Repeatable proof of the privacy guardrail before any UI depends on it.

**Contract**: pgTAP, run by `npx supabase test db` (the CLI enables the `pgtap` extension itself). One transaction per file: `begin; select plan(n); … select * from finish(); rollback;`. Two users are inserted into `auth.users`; a test acts as a user with `set local role authenticated` plus `select set_config('request.jwt.claims', json_build_object('sub', <uid>, 'role', 'authenticated')::text, true)`, and as anon with `set local role anon`. Asserts: each sees only their own caregiver row, profiles and memberships; user B cannot select, update or link user A's profile (by id); direct `insert into profiles` is denied; `create_profile()` links only the caller and raises for a caller without a `caregivers` row; anon sees zero rows and cannot execute `create_profile()`; check constraints reject an empty/41-char name and an unknown kind/colour.

#### 3. Types and data access

**File**: `src/lib/supabase/database.types.ts`, `package.json`, `src/lib/supabase/server.ts`, `src/lib/supabase/proxy.ts`

**Intent**: Type-safe queries under `strict` instead of untyped rows.

**Contract**: npm script `db:types` = `supabase gen types typescript > src/lib/supabase/database.types.ts` (no `--local`: it is the default and deprecated in CLI 3). With the stack down the CLI writes its error JSON to stdout, so check the file starts with `export type` after generating. `createServerClient<Database>` in both helpers.

#### 4. Docs

**File**: `README.md`, `AGENTS.md`

**Intent**: Make the migrate-before-merge rule and the new commands discoverable.

**Contract**: README: "Database" section — `npx supabase migration new`, `npx supabase db reset`, `npx supabase test db`, `npm run db:types`, and the release order (verify locally → `npx supabase db push` → preview → merge; additive migrations only). AGENTS.md Commands: the same commands; Project Structure: `supabase/migrations/`, `supabase/tests/database/`, `src/components/ui/` (shadcn, edit variants there), `src/lib/supabase/database.types.ts` (generated, don't edit); Hard Rules: "Push migrations to the cloud project before merging the PR that adds them; never edit a pushed migration."

### Success Criteria:

#### Automated Verification:

- Migration applies on a clean database: `npx supabase db reset`
- RLS tests pass: `npx supabase test db`
- Generated types are current: `npm run db:types` leaves `git status` clean
- Lint passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- In Studio (http://127.0.0.1:55323) the three tables show RLS enabled

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Onboarding

### Overview

Build the two onboarding steps from mocks `164:172` and `162:73` and route new users through them.

### Changes Required:

#### 1. Data access layer

**File**: `src/lib/profiles/dal.ts`, `src/lib/profiles/validation.ts`

**Intent**: One server-only place that reads the caregiver and their profiles, used by onboarding, the main screen and `/profiles/new`.

**Contract**: `getCaregiver(): Promise<{ displayName } | null>`, `listProfiles(): Promise<Profile[]>` ordered by `created_at` asc, then `id` (RLS scopes rows; the code adds no `user_id` filter beyond what RLS enforces). `Profile = { id, name, kind, avatarColor }`. Both call `getCurrentUser()` first and must be used inside `<Suspense>`. Wrap `getCurrentUser`, `getCaregiver` and `listProfiles` in React `cache()` so the header, sidebar and page share one session check and one query each per request. Validation helpers: `validateDisplayName`, `validateProfileName` (trimmed, 1–40 chars, messages "Enter your first name" / "Use at most 40 characters"), `PROFILE_KINDS`, `AVATAR_COLORS` constants matching the migration checks.

#### 2. Server actions

**File**: `src/app/onboarding/actions.ts` (or `src/lib/profiles/actions.ts`)

**Intent**: Save the name and create profiles with the existing form-state pattern.

**Contract**: `saveDisplayName(prev, formData)` upserts the caller's `caregivers` row and redirects to `/onboarding/profile`. `createProfile(prev, formData)` validates name/kind/colour, calls `rpc('create_profile', …)` and redirects to `/?profile=<new id>`. Both return a `FormState` with field errors on invalid input and a generic message on unexpected errors; both start with `getCurrentUser()`.

#### 3. Onboarding routes

**File**: `src/app/onboarding/layout.tsx`, `src/app/onboarding/name/page.tsx`, `src/app/onboarding/profile/page.tsx`, `src/app/onboarding/_components/*`

**Intent**: Match the two mocks and keep users in the right step.

**Contract**:
- Layout: app header (logo; avatar initial once a name exists), centered column with the dotted left rule, `Stepper` (Account ✓, Your name, First profile) with completed/current/upcoming states as described in Figma component `167:109`.
- `/onboarding/name`: "Account ready — welcome!", "What's your first name?", hint "This is how we'll greet you in the app."; field hint "Just your first name is fine."; "Next →". Pre-filled when a name exists (Back from step 3).
- `/onboarding/profile`: "Hi: <name>", live heading "Profile: <typed name>", intro copy; "Whose medications are we keeping an eye on?" with four type cards (radio group: For me — my medications; For a parent — mom, dad, grandparents; For a child — son, daughter; For someone else — partner, someone in your care; icons `user`, `users`, `baby`, `heart`); "Profile name" input with chips (me → user's name, "Me"; parent → "Mom", "Dad"; child → "Son", "Daughter"; other → "Partner") that fill the input; "Avatar colour" grid of the six swatches showing the initial on the selected one; "← Back" (to `/onboarding/name`) and "+ Create profile "<name>"". Defaults: kind `me`, name = user's name, colour `mint`.
- Guards: `/onboarding/name` and `/onboarding/profile` redirect to `/` only when the user has a caregiver row **and** ≥ 1 profile; `/onboarding/profile` redirects to `/onboarding/name` without a caregiver row; `/` redirects to `/onboarding/name` without a caregiver row and to `/onboarding/profile` without profiles. These rules never point at each other for the same state, so no redirect loop.

#### 4. Reusable profile form

**File**: `src/components/profiles/profile-form.tsx`

**Intent**: One client component for type, name, chips and colour, reused by `/profiles/new` in Phase 4.

**Contract**: `"use client"`; props `{ displayName: string; action; backHref?: string; submitLabel }`; posts `name`, `kind`, `avatarColor`; keyboard-accessible radio groups for type and colour; works at 375 px (type cards wrap to 2×2).

#### 5. Interim main page

**File**: `src/app/page.tsx`

**Intent**: `/` must apply the onboarding redirects and must not say "No profiles yet" to someone who just created one.

**Contract**: Inside the existing `<Suspense>` component: the redirects from §3, then a minimal stub "Profile: <selected profile name>" (selection as in Phase 4: `searchParams.profile` among `listProfiles()`, else the oldest) plus the existing Sign out button. The S-01 placeholder panel is removed. Phase 4 moves the page into `(app)/` and replaces the stub with the shell.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Production build passes: `npm run build`
- RLS tests still pass: `npx supabase test db`

#### Manual Verification:

- A newly confirmed user signing in is sent to `/onboarding/name`; the screen matches Figma node `164:172` (translated copy)
- Saving the name opens `/onboarding/profile`, matching node `162:73`; Back returns to the name step pre-filled
- Type cards switch the chips; a chip fills the name; the heading updates as you type; the selected swatch shows the initial
- An empty name or a 41-character name shows a field error; nothing is saved
- Creating the profile lands on `/?profile=<id>`; revisiting `/onboarding/name` afterwards redirects to `/`
- Both steps are usable at 375 px

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Main screen and switching

### Overview

Replace the placeholder `/` with the app shell from mock `176:226` (only the parts S-02 owns), add `/profiles/new`, and finish the docs.

### Changes Required:

#### 1. App shell

**File**: `src/app/(app)/layout.tsx` (move `/` into an `(app)` route group), `src/components/app-shell/*`

**Intent**: Header and sidebar shared by `/` and `/profiles/new`.

**Contract**: Header: logo left; avatar (user's initial, primary background) opening a `DropdownMenu` with name, email and "Sign out" (posts to `signOut`). Sidebar (shadcn `Sidebar`, collapsible with the panel-left icon; it renders a `Sheet` on its own below `md`, opened by a trigger in the header). `SidebarProvider` gets a static `defaultOpen`; do not read the `sidebar_state` cookie in the layout — under `cacheComponents` a `cookies()` call outside `<Suspense>` fails the build: "Profiles" heading, one row per profile (avatar in its colour with the initial, name), selected row with the teal left bar and tinted background and `aria-current="page"`, rows are links to `/?profile=<id>`; "+ Add new" row (dashed square with plus) linking to `/profiles/new`. No `…` menus, no urgency dots, no Settings section. Data from `listProfiles()` inside `<Suspense>` with a skeleton fallback.

#### 2. Main page

**File**: `src/app/(app)/page.tsx`

**Intent**: Show the selected profile.

**Contract**: Reads `searchParams.profile` inside `<Suspense>`; onboarding redirects as in Phase 3; selection = the profile with that id among `listProfiles()`, else the oldest; an unknown, malformed or foreign id renders the oldest profile (never an error, never a foreign row). Content: "Hi: <display name>", "Profile: <profile name>" (Josefin Sans, name in primary), "Medication stock (0)" heading and an empty-state card with the illustration and "No medications yet — adding them arrives soon." (no button). Page title "<profile name> · Out of Pills".

#### 3. Add profile page

**File**: `src/app/(app)/profiles/new/page.tsx`

**Intent**: Create further profiles from the sidebar.

**Contract**: Heading "Add a profile" (no stepper), `ProfileForm` with `backHref="/"` labelled "Cancel" and submit "+ Create profile "<name>"", same `createProfile` action → lands on `/?profile=<new id>` with the new row selected in the sidebar. Requires a caregiver row (else redirect to onboarding).

#### 4. Migration push and PR

**File**: — (Supabase CLI, GitHub)

**Intent**: The PR preview reads the production database, so the schema must be there before the PR opens.

**Contract**: After the local gates pass and the migration is final: `npx supabase db push` to the linked cloud project, then push the branch and open the PR against `master`. From this point the migration file is frozen.

#### 5. Docs and cleanup

**File**: `AGENTS.md`, `README.md`

**Intent**: Describe the new structure for the next slice.

**Contract**: AGENTS.md Project Structure gains `src/app/(app)/` (signed-in shell), `src/app/onboarding/`, `src/lib/profiles/`, `src/components/{ui,brand,profiles,app-shell}`; Coding Style gains "Build UI from `src/components/ui` (shadcn) and the tokens in `globals.css`; no hex colours or `zinc-*` utilities in components." README intro mentions onboarding and profiles.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Production build passes: `npm run build`
- RLS tests still pass: `npx supabase test db`
- On the PR, the `Lint and build` check is green and the `preview` job succeeds: `gh pr checks`

#### Manual Verification:

- After onboarding, `/` matches the S-02 parts of Figma node `176:226`: header, sidebar with the profile and "+ Add new", "Hi / Profile" heading, empty medication state
- "+ Add new" → `/profiles/new` → creating "Mom" (parent, rose) lands on Mom, selected in the sidebar; the sidebar lists profiles oldest first
- Clicking a profile in the sidebar switches the main area and the URL; back/forward work
- With two accounts (A, B): pasting A's `/?profile=<id>` while signed in as B shows B's own oldest profile, and A's profile name appears nowhere
- `/` without a profile id opens the oldest profile; a malformed id does the same
- At 375 px the sidebar opens as a sheet from the header and closes after choosing a profile
- Avatar menu shows the name and email; Sign out returns to `/sign-in`
- Before the PR opened, `npx supabase db push` applied the migration to the cloud project (Supabase dashboard → Table Editor shows the three tables with RLS on)
- On the PR preview (production Supabase), a real account can complete onboarding and switch profiles

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- None in JS (no runner yet; S-03 introduces one for the run-out calculation).
- pgTAP (`supabase/tests/database/profiles_rls.test.sql`) covers the privacy boundary: per-user isolation of all three tables, no direct profile inserts, `create_profile()` links only the caller and requires a caregiver row, anon access denied, check constraints.

### Integration Tests:

- None automated. The PR preview exercises the app against the production database after the migration push.

### Manual Testing Steps:

1. Sign up a fresh account locally, confirm via Mailpit, complete both onboarding steps, land on the main screen.
2. Add a second and a third profile with different types and colours; switch between them; use browser back/forward.
3. Sign in as a second account in another browser; paste the first account's profile URL — only your own data appears.
4. Repeat 1–2 at 375 px width.
5. Re-run the S-01 auth checklist on the restyled screens.

## Performance Considerations

- Every main-screen request reads the caregiver row and the profile list (two small indexed queries). `(select auth.uid())` in policies keeps RLS evaluation per statement, not per row. No caching of user data (cookies / `use cache` are off-limits for session reads).

## Migration Notes

- First migration of the project; additive. Existing users have no caregiver row and go through onboarding on their next visit to `/`.
- Rollback: a follow-up migration dropping the three tables and the function. Never edit the pushed migration.

## References

- Roadmap item: `context/foundation/roadmap.md` (S-02)
- PRD: FR-003, FR-006, Access Control, NFR privacy (`context/foundation/prd.md`)
- Figma file `jThXxph37aBIqtM28HkonX`: nodes `176:552` (sign-in), `164:172` (name), `162:73` (first profile), `176:226` (main screen)
- Auth patterns: `src/app/(auth)/actions.ts`, `src/lib/auth/dal.ts:15`, `src/app/(auth)/_components/text-field.tsx`
- Suspense + `searchParams` pattern: `src/app/(auth)/sign-in/page.tsx:20-22`
- Prior plans: `context/archive/2026-11-04-email-sign-in/plan.md`, `context/archive/2026-11-16-deploy-pipeline/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Design foundation

#### Automated

- [x] 1.1 Lint passes: `npm run lint`
- [x] 1.2 Production build passes: `npm run build`
- [x] 1.3 No hardcoded zinc or dark-mode classes remain in app code: `grep -rE "zinc-|dark:" src/app` returns nothing

#### Manual

- [x] 1.4 `/sign-in` visually matches Figma node `176:552` at desktop width (logo, mascot, field radii, teal button, links)
- [x] 1.5 Sign-up, forgot-password and reset-password use the same shell and components and read well at 375 px
- [x] 1.6 The S-01 flows still work: sign up, confirm via Mailpit, sign in, wrong password error, "Confirm your email first" + resend, password reset

### Phase 2: Database and privacy

#### Automated

- [ ] 2.1 Migration applies on a clean database: `npx supabase db reset`
- [ ] 2.2 RLS tests pass: `npx supabase test db`
- [ ] 2.3 Generated types are current: `npm run db:types` leaves `git status` clean
- [ ] 2.4 Lint passes: `npm run lint`
- [ ] 2.5 Production build passes: `npm run build`

#### Manual

- [ ] 2.6 In Studio (http://127.0.0.1:55323) the three tables show RLS enabled

### Phase 3: Onboarding

#### Automated

- [ ] 3.1 Lint passes: `npm run lint`
- [ ] 3.2 Production build passes: `npm run build`
- [ ] 3.3 RLS tests still pass: `npx supabase test db`

#### Manual

- [ ] 3.4 A newly confirmed user signing in is sent to `/onboarding/name`; the screen matches Figma node `164:172` (translated copy)
- [ ] 3.5 Saving the name opens `/onboarding/profile`, matching node `162:73`; Back returns to the name step pre-filled
- [ ] 3.6 Type cards switch the chips; a chip fills the name; the heading updates as you type; the selected swatch shows the initial
- [ ] 3.7 An empty name or a 41-character name shows a field error; nothing is saved
- [ ] 3.8 Creating the profile lands on `/?profile=<id>`; revisiting `/onboarding/name` afterwards redirects to `/`
- [ ] 3.9 Both steps are usable at 375 px

### Phase 4: Main screen and switching

#### Automated

- [ ] 4.1 Lint passes: `npm run lint`
- [ ] 4.2 Production build passes: `npm run build`
- [ ] 4.3 RLS tests still pass: `npx supabase test db`
- [ ] 4.4 On the PR, the `Lint and build` check is green and the `preview` job succeeds: `gh pr checks`

#### Manual

- [ ] 4.5 After onboarding, `/` matches the S-02 parts of Figma node `176:226`: header, sidebar with the profile and "+ Add new", "Hi / Profile" heading, empty medication state
- [ ] 4.6 "+ Add new" → `/profiles/new` → creating "Mom" (parent, rose) lands on Mom, selected in the sidebar; the sidebar lists profiles oldest first
- [ ] 4.7 Clicking a profile in the sidebar switches the main area and the URL; back/forward work
- [ ] 4.8 With two accounts (A, B): pasting A's `/?profile=<id>` while signed in as B shows B's own oldest profile, and A's profile name appears nowhere
- [ ] 4.9 `/` without a profile id opens the oldest profile; a malformed id does the same
- [ ] 4.10 At 375 px the sidebar opens as a sheet from the header and closes after choosing a profile
- [ ] 4.11 Avatar menu shows the name and email; Sign out returns to `/sign-in`
- [ ] 4.12 Before the PR opened, `npx supabase db push` applied the migration to the cloud project (Supabase dashboard → Table Editor shows the three tables with RLS on)
- [ ] 4.13 On the PR preview (production Supabase), a real account can complete onboarding and switch profiles
