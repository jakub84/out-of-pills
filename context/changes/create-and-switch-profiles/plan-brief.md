# Create and Switch Profiles — Plan Brief

> Full plan: `context/changes/create-and-switch-profiles/plan.md`

## What & Why

Roadmap S-02 (FR-003, FR-006): a caregiver creates profiles for the people whose medications they track and switches between them on the main screen. It is the first slice that stores user data, so its row-level security is the privacy template every later table copies — getting it wrong leaks health data. The slice also moves the app onto the Figma design (brand, shadcn, tokens), because onboarding and the main screen are designed in it.

## Starting Point

S-01 delivered email sign-in; `/` shows the user's email and a static "No profiles yet" panel. There are no tables, migrations or tests, and the UI is hand-styled `zinc-*` Tailwind with no component library. Previews and staging run against the production Supabase project.

## Desired End State

A new user signs in, gives their first name, creates a first profile (type, name with suggestions, avatar colour) and lands on a main screen with a sidebar of profiles, the selected one highlighted, and "+ Add new". Switching is a link (`/?profile=<id>`). No user can see another's names, profiles or memberships — proven by pgTAP tests. All auth screens wear the new brand.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Ownership model | `profiles` + `profile_caregivers` join table + `caregivers(display_name)` | Matches the PRD's flat multi-caregiver model, so sharing later needs no data migration or RLS rewrite. |
| Profile creation | `create_profile()` security-definer RPC writing profile + membership; requires the caller's `caregivers` row | A profile is only readable once its membership exists, so both rows are written together; requiring the name rules out a redirect loop. |
| Display name | `caregivers` table, not auth metadata | Co-caregivers will need to read each other's names when sharing arrives. |
| Profile fields | `kind` (me/parent/child/other) and `avatar_color` (6 tokens) stored | The user's choices stay visible and the sidebar gets its avatars. |
| Migrations to cloud | Manual `npx supabase db push` right before the PR opens (Phase 4), additive only | Previews use the production DB; keeps DB credentials out of GitHub; schema stays editable until the UI has used it. |
| Selection state | URL `/?profile=<id>`; missing/foreign id → oldest profile | Server-rendered, back-button friendly; RLS makes foreign ids harmless. |
| Default profile & order | Oldest first | Stable home profile; no extra state. |
| First run | Onboarding per Figma: name → first profile | User-provided mocks `164:172`, `162:73`. |
| UI foundation | Phase 1 of S-02: shadcn, tokens from Figma variables, Josefin Sans + Geist, brand assets, 4 auth screens restyled | One PR delivers the coherent flow; later screens build on real components. |
| Main-screen scope | Shell + profiles only; nothing owned by S-03/S-08/S-09, no bell, no "My profile" | No dead controls on the production URL. |
| Add profile | Page `/profiles/new` reusing the onboarding form | One form; the wide layout fits a page and phones. |
| RLS proof | pgTAP via `npx supabase test db` + two-account manual check | Repeatable proof without a JS test runner; not in CI yet. |
| Names | Trimmed 1–40 chars; duplicate profile names allowed | Simple, enforced in DB and form. |
| Theme / copy | Light only; English copy translated from the Polish mocks | Mocks are light; app content is English. |

## Scope

**In scope:**
- shadcn + token layer + fonts + logo/mascot/illustration; restyled sign-in, sign-up, forgot and reset screens
- Migration: `caregivers`, `profiles`, `profile_caregivers`, `create_profile()`, RLS; generated TS types; pgTAP tests
- Onboarding `/onboarding/name` and `/onboarding/profile` with stepper, type cards, name chips, colour swatches
- App shell (header + avatar menu, collapsible sidebar / mobile sheet), selection via URL, `/profiles/new`, empty medication state
- README/AGENTS.md: database commands, migrate-before-merge rule, new structure

**Out of scope:**
- Rename/delete and `…` menus (S-08), urgency dots (S-09), medications and overview cards (S-03+), demo mode (S-10)
- Bell, "My profile" settings, last-login stats; sharing/invitations (FR-016)
- Dark mode; migrations or pgTAP in CI; JS test runner; Google sign-in button

## Architecture / Approach

Server Components read the caregiver row and profile list through `src/lib/profiles/dal.ts` (behind `<Suspense>`, after `getCurrentUser()`); Postgres RLS is the real access check. Server actions (`saveDisplayName`, `createProfile`) follow the existing `useActionState` form pattern; `createProfile` calls the RPC. `/` redirects to the onboarding step the user still needs, otherwise renders the shell with the profile chosen from `searchParams`. One client component, `ProfileForm`, serves onboarding and `/profiles/new`. All visuals come from shadcn components in `src/components/ui` and tokens in `globals.css`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Design foundation | shadcn, tokens, fonts, brand assets, restyled auth screens | shadcn init clashing with the Turbopack CSS loader; regressions in S-01 flows |
| 2. Database and privacy | Migration, RLS, RPC, pgTAP tests, types, docs | RLS mistakes (recursion, missing policy) — caught by pgTAP |
| 3. Onboarding | Name and first-profile steps with redirects | Redirect loops between `/` and onboarding |
| 4. Main screen and switching | Shell, sidebar, selection, `/profiles/new`, preview check | Mobile sidebar UX; foreign/malformed ids |

**Prerequisites:** Docker Desktop for the local stack; Supabase CLI linked to the cloud project (`npx supabase link`); Figma access to re-download assets (URLs expire after 7 days).
**Estimated effort:** ~4 sessions, one per phase; Phase 1 and 4 are the largest.

## Open Risks & Assumptions

- Forgetting `npx supabase db push` before the PR breaks the preview (and production after merge) — mitigated by the documented order and Progress item 4.12; the push waits until Phase 4 so the migration can still change during Phases 3–4.
- The mocks show urgency "less than 7 days"; the PRD says red ≤ 14 days — resolve in S-03.
- The onboarding step-2 hint in Figma promises "change it in My profile"; the copy is changed because that page is out of scope.

## Success Criteria (Summary)

- A new user goes from sign-in to their first profile in one guided flow that looks like the Figma mocks.
- They can add more profiles and switch between them from the sidebar, on desktop and phone.
- Another account never sees their profiles — pgTAP and a two-account check agree.
