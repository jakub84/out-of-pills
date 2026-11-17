# First Medication Run-Out Implementation Plan

## Overview

Roadmap S-03 (`first-medication-run-out`; US-01, FR-007, FR-014, FR-015): a caregiver adds a medication with a daily dose to the selected profile, and the main screen shows, for every medication of that profile, pills left, the run-out date, days left and an urgency colour, sorted from the one running out soonest. The run-out calculation is the product's core guardrail — the date shown must never be later than the real one — so it lives in one pure, exhaustively unit-tested module, and this slice introduces the project's JS test runner for it.

## Current State Analysis

- `/` (`src/app/(app)/page.tsx:33-78`) shows "Hi / Profile: <name>", then "Medication stock (0)" with a static empty-state card (illustration + "No medications yet — adding them arrives soon."). Profile selection is `selectProfile()` (`page.tsx:11`); reads sit inside `<Suspense>` because of `cacheComponents`.
- Database: `caregivers`, `profiles`, `profile_caregivers` (`supabase/migrations/20261116165228_profiles.sql`). Profile access is "a `profile_caregivers` row with `user_id = (select auth.uid())` exists" (`:70-80`). pgTAP in `supabase/tests/database/profiles_rls.test.sql`.
- Forms: server action `(prev, formData) => FormState` + `useActionState` (`src/lib/profiles/actions.ts`, `src/components/profiles/profile-form.tsx`); `readField` in `src/lib/auth/validation.ts`; `createProfile` ends with `revalidatePath("/", "layout")` so the shell refreshes.
- UI: shadcn components in `src/components/ui/` (no `dialog` yet), tokens in `src/app/globals.css` (`--primary #37968a`, `--primary-tint`, avatar tokens), Josefin Sans via `font-heading`. All UI copy is English.
- No JS test runner; CI (`.github/workflows/ci.yml`) job `Lint and build` runs `npm ci`, `npm run lint`, `npm run build`. Earlier plans deferred unit tests to this slice.
- `getCurrentUser()` calls `await connection()` (`src/lib/auth/dal.ts`), so reading the clock in request-time server components after it is allowed.
- Figma (file `jThXxph37aBIqtM28HkonX`):
  - `176:226` main screen: summary "Total medications: 12 · 2 are running out!", three dashed tiles (red / amber / teal: count + label), "Medication stock (12)" with a teal "Add new medication" button, cards grouped by urgency with group headers; card = run-out date tile (weekday / day / month), timeline dot, name, "2 tabl. daily – 18 tabl. left", "Runs out on Thursday 12 November", large days-left number, 3-segment bar, "+ Add package" and "⋯" (both out of scope). Urgency hex: red `#f07777`, amber `#d39c37`, teal `#37968a`, empty bar `#d9d9d9` — raw values, not variables.
  - `177:601` "Add medication (step 1 of 2)": dialog with stepper "1 Medication details · 2 Review & confirm"; "Name and strength" free text ("Type it as on the package. We don't need a drug database."); form cards (tablets / capsules / other — out of scope); package chips 20 / 28 / 30 / 56 / 60 / 90 / Other; "How many tablets are left now?" stepper + slider + chips "Full package (30)" / "2 packages (60)", "Count once — we count for you from then on."; schedule cards (only daily in scope) and "Tablets per day?" chips 1 / 2 / 3 / Other; footer preview "Lasts 30 days · until Sat 5 Dec"; "Cancel" / "Next: review →".
  - `182:300` review step (drawn as "Edit medication, step 2 of 2"): summary card with urgency badge, "Lasts 9 days", "Runs out on Sat 14 Nov", bar with ticks Today / 14 days / 30 days / 60+; tiles Name / You have now / Dosage / Full package each with "Change"; note "From tomorrow the stock updates itself. We always round the date to the earlier side."; "← Go back" / "✓ Save".
  - Mock inconsistencies (resolved below): list groups at 7 days but the review bar ticks at 14; sample numbers don't add up; the sample "18 tablets at 2/day on 5 Nov → 14 Nov" is one day later than the rule chosen here.

## Desired End State

- On `/`, "Add medication" opens a two-step dialog; saving adds the medication to the selected profile and the list updates without a reload.
- The overview shows a summary line ("Total medications: N · M running out!"), three count tiles, and cards grouped under "14 days or less", "30 days or less", "More than 30 days", sorted soonest first; each card shows the run-out date, "<dose> tabl. daily · <left> tabl. left", days left and the bar; used-up stock shows a "Ran out" state at the top.
- Worked example (today 5 Nov, Europe/Warsaw): 18 tablets counted on 5 Nov at 2/day → 18 left, 9 days left, runs out Fri 13 Nov, red. On 10 Nov a medication counted on 5 Nov as 10 tablets at 2/day shows 0 left, "Ran out on Mon 9 Nov".
- No user can read or add medications in another user's profile — proven by pgTAP.
- `npm test` runs the calculation tests locally and in CI.

Verify: add three medications with different stocks to one profile, check numbers against the worked examples, switch profiles, `npm test` and `npx supabase test db` are green.

### Key Discoveries:

- Stock decreases "from the moment the stock was entered" (PRD Business Logic) — store the counted amount plus the counting date, compute today's figures on read; S-06/S-07 later re-count instead of mutating a running total.
- A direct insert into `medications` passes RLS (the membership row already exists), so no `security definer` function is needed — unlike `create_profile()`.
- Column-level `grant insert (…)` keeps `counted_on` out of the client's reach: the database stamps it.
- `PRD FR-015` thresholds (≤ 14 red, ≤ 30 yellow) are an AGENTS.md hard rule; the Figma "less than 7 days" label is a design error.

## What We're NOT Doing

- Irregular schedules (S-05) — the "Every few days" / "On chosen days" cards are hidden, not disabled.
- "+ Add package" and stock corrections (S-06); editing or pausing a medication (S-07); deleting it and the "⋯" menu (S-08); urgency markers on the sidebar (S-09); demo mode (S-10).
- Medication form (tablets / capsules / other): not stored, not shown; every unit is "tabl.".
- The slider in "left now", the timeline line between cards, "last signed in N days ago".
- Per-viewer time zones; reminders or notifications; a drug database.
- Running migrations or pgTAP in CI; E2E tests.
- Unique medication names — duplicates are allowed.

## Implementation Approach

Prove the maths first, then the privacy boundary, then the input, then the display. Phase 1 builds the pure calculation with the test runner and CI step, so every later screen imports a tested function instead of re-deriving dates. Phase 2 adds the table, RLS, pgTAP and a data-access function. Phase 3 adds the add-medication dialog (verified through Studio rows). Phase 4 replaces the empty state with the overview, updates docs, pushes the migration and opens the PR.

## Critical Implementation Details

**The run-out rule (decided).** Units are tablets; doses and counts are multiples of 0.5. Let `elapsed = max(0, today − countedOn)` in whole Warsaw calendar days.
- `pillsLeft = max(0, pillsCounted − dailyDose × elapsed)`.
- `daysLeft = floor(pillsLeft / dailyDose)` — today's dose is assumed to come out of the stock, so today counts as day 1.
- `daysLeft ≥ 1` → `runOutDate = today + daysLeft − 1` (the last day with a full dose).
- `daysLeft = 0` → status "ran out"; `lastCoveredDay = countedOn + floor(pillsCounted / dailyDose) − 1`, shown as "Ran out on <date>" when `lastCoveredDay ≥ countedOn`, otherwise "Not enough for a full day's dose".
- Urgency: ran out or `daysLeft ≤ 14` → red; `≤ 30` → yellow; `≥ 31` → green.
- Sort: `daysLeft` ascending, then run-out / last-covered date ascending, then name (case-insensitive), then id.
- Never use floating point for counts: work in half-tablet integers (`× 2`) internally.

**"Today" is Europe/Warsaw.** Derive the calendar date with `Intl.DateTimeFormat` and `timeZone: "Europe/Warsaw"`, never `Date#getDate()` (UTC on Vercel). The database default for `counted_on` uses the same zone, so both sides agree. Date arithmetic runs on plain `YYYY-MM-DD` values (days since epoch), not on local `Date` objects, so DST changes cannot shift a day.

**Accepted risk: pre-filled "left now".** By user decision the field starts at the package size. An unedited half-used package overstates stock (a late-side error the calculation cannot catch); the review step shows the count prominently as "You have now: N tabl." to make it visible.

## Phase 1: Run-out calculation and test runner

### Overview

Add Vitest, write the pure stock module test-first, and run it in CI.

### Changes Required:

#### 1. Test runner

**File**: `package.json`, `vitest.config.ts`, `.github/workflows/ci.yml`

**Intent**: Give the project a JS unit-test runner that understands the `@/*` alias and runs on every PR.

**Contract**: dev dependency `vitest`; script `"test": "vitest run"`; config resolves `@` to `src` and uses the `node` environment. CI job `Lint and build` (name unchanged — required check) gains `- run: npm test` after lint.

#### 2. Stock calculation

**File**: `src/lib/medications/stock.ts`

**Intent**: The single place that turns a stored medication into today's figures, urgency and order.

**Contract**:
- `todayInWarsaw(now?: Date): string` → `YYYY-MM-DD`.
- `computeStock({ pillsCounted, countedOn, dailyDose }, today): { pillsLeft: number; daysLeft: number; runOutDate: string | null; lastCoveredDay: string | null; urgency: "ran-out" | "red" | "yellow" | "green" }` per the rule in Critical Implementation Details.
- `compareByRunOut(a, b)` for sorting `{ name, id, stock }`; `groupByUrgency(items)` → `{ red, yellow, green }` with ran-out items inside `red`.
- `addDays(date, n)`, `daysBetween(a, b)` on `YYYY-MM-DD` strings.
- No React, no Supabase imports — it must run on server and client.

#### 3. Unit tests

**File**: `src/lib/medications/stock.test.ts`

**Intent**: Pin every boundary of the guardrail so a later change cannot make the date later.

**Contract**: covers at least — the worked example (18 at 2/day on 5 Nov → 9 days, 13 Nov); same-day entry counts today; one day later (16 left, 8 days, still 13 Nov); `daysLeft` exactly 14 → red, 15 → yellow, 30 → yellow, 31 → green; ran out (10 at 2/day counted 5 Nov, today 10 Nov → 0 left, last covered 9 Nov); entered below one dose (1 at 2/day → "not enough", no date); pills left never negative long after run-out; halves (7 at 1.5/day → 4 days; after 1 day 5.5 left); 0.5/day; `todayInWarsaw` at `2026-11-05T23:30Z` → `2026-11-06` and at `2026-03-29T00:30Z` (DST start) → `2026-03-29`; month and year rollover in `addDays`; sort ties (same days left → earlier date → name → id); grouping puts ran-out first within red.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Lint passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- The worked examples in the test file match the decided rule (18 at 2/day on 5 Nov → 13 Nov; ran-out example → 9 Nov)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Medications database

### Overview

Create the `medications` table with RLS scoped through profile membership, prove isolation with pgTAP, regenerate types and add the data-access function.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/<timestamp>_medications.sql`

**Intent**: Store each medication's inputs with RLS enabled in the same migration (Hard Rule), following the `profiles` policy template.

**Contract**:
- `medications(id uuid pk default gen_random_uuid(), profile_id uuid not null references profiles on delete cascade, name text not null check (char_length(btrim(name)) between 1 and 80), package_size integer not null check (between 1 and 1000), pills_counted numeric(6,1) not null check (between 0 and 9999 and pills_counted * 2 = trunc(pills_counted * 2)), daily_dose numeric(4,1) not null check (> 0 and <= 50 and daily_dose * 2 = trunc(daily_dose * 2)), counted_on date not null default ((now() at time zone 'Europe/Warsaw')::date), created_at timestamptz not null default now())`; index on `profile_id`.
- RLS: select and insert where `exists` a `profile_caregivers` row for `medications.profile_id` with `user_id = (select auth.uid())`. No update or delete policy (S-06/S-07/S-08 add and test their own).
- Grants: revoke all from `anon, authenticated`; `grant select` and `grant insert (profile_id, name, package_size, pills_counted, daily_dose)` to `authenticated`.

#### 2. RLS tests

**File**: `supabase/tests/database/medications_rls.test.sql`

**Intent**: Repeatable proof that medication data stays with the profile's caregiver.

**Contract**: same structure as `profiles_rls.test.sql` (two users, `set local role`, `request.jwt.claims`). Asserts: a caregiver inserts into and reads their own profile's medications; user B cannot select A's medications or insert into A's profile (RLS violation); B cannot update or delete A's rows (no rows affected / denied); anon sees nothing and cannot insert; setting `counted_on` on insert is denied; `counted_on` defaults to the Warsaw date; check constraints reject empty and 81-char names, package 0 and 1001, negative and 0.3 pill counts, dose 0, 0.3 and 50.5; deleting a profile cascades.

#### 3. Types and data access

**File**: `src/lib/supabase/database.types.ts`, `src/lib/medications/dal.ts`

**Intent**: Type-safe reads for the main screen.

**Contract**: regenerate with `npm run db:types`. `listMedications(profileId: string): Promise<Medication[]>` — `server-only`, calls `getCurrentUser()` first, wrapped in React `cache()`, no extra user filter beyond RLS; `Medication = { id, name, packageSize, pillsCounted, dailyDose, countedOn }` with numerics as numbers.

### Success Criteria:

#### Automated Verification:

- Migration applies on a clean database: `npx supabase db reset`
- RLS tests pass: `npx supabase test db`
- Generated types are current: `npm run db:types` leaves `git status` clean
- Unit tests pass: `npm test`
- Lint passes: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- In Studio (http://127.0.0.1:55323) `medications` shows RLS enabled with select and insert policies only

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Add medication dialog

### Overview

Build the two-step dialog from mocks `177:601` and `182:300` and the server action that saves to the selected profile.

### Changes Required:

#### 1. Validation and server action

**File**: `src/lib/medications/validation.ts`, `src/lib/medications/actions.ts`, `src/lib/medications/form-state.ts`

**Intent**: One set of rules shared by the client wizard and the server, and an action in the existing form-state pattern.

**Contract**: validators for name (trimmed 1–80, "Enter the medication name" / "Use at most 80 characters"), package size (integer 1–1000), pills left (0–9999, multiple of 0.5), daily dose (0.5–50, multiple of 0.5) — limits identical to the migration checks. `addMedication(prev, formData)` reads `profileId`, `name`, `packageSize`, `pillsLeft`, `dailyDose`; starts with `getCurrentUser()`; validates; inserts (RLS rejects a foreign `profileId`, which returns the generic error); on success `revalidatePath("/", "layout")` and returns `{ status: "success" }`; field errors and a generic "Something went wrong. Please try again." otherwise. Validator unit tests go in `src/lib/medications/validation.test.ts`.

#### 2. Dialog and wizard

**File**: `src/components/ui/dialog.tsx` (shadcn add), `src/components/medications/add-medication-dialog.tsx`, `src/components/medications/*`

**Intent**: Match the mocks while keeping input fast and the numbers visible before saving.

**Contract**: `"use client"`; props `{ profileId: string; profileName: string }`; trigger "Add medication" (primary, plus icon).
- Step 1 "Medication details": "Name and strength" input with hint "Type it as on the package, e.g. Bisocard 5 mg."; "Tablets in a full package" chips 20 / 28 / 30 / 56 / 60 / 90 / Other (Other reveals a number input), default 30; "How many tablets are left now?" — number input with −/+ (step 1, accepts .5 typed), pre-filled with the package size and following package-size changes until the user edits it, chips "Full package (N)" and "2 packages (2N)", hint "Count once — we count for you from then on."; "Tablets per day" chips 1 / 2 / 3 / Other (Other: number input, step 0.5), default 1. Footer: live preview "Lasts N days · until Fri 13 Nov" with an urgency dot from `computeStock` with today in Warsaw and `countedOn = today`; "Cancel" and "Next: review →" (validates step 1 client-side).
- Step 2 "Review & confirm": card with name, urgency badge, "Lasts N days", "Runs out on Fri, 13 November", tiles "Name", "You have now", "Daily dose", "Full package" each with "Change" (back to step 1, focus that field); note "From tomorrow the stock updates itself. We always round the date to the earlier side."; "← Back" and "Save medication" (submits via `useActionState`, pending state, closes the dialog on success).
- Stepper header "Step N of 2"; chip groups are keyboard-accessible radio groups (reuse `toggle-group`/`radio-group`); on phones the dialog fills the screen; dates in English (`en-GB`, Warsaw zone).

#### 3. Main page wiring

**File**: `src/app/(app)/page.tsx`

**Intent**: Make the dialog reachable before the overview exists.

**Contract**: "Add medication" button right of the "Medication stock" heading and inside the empty-state card (copy "No medications yet." replaces "…arrives soon."), both for the selected profile.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Lint passes: `npm run lint`
- Production build passes: `npm run build`
- RLS tests still pass: `npx supabase test db`

#### Manual Verification:

- The dialog matches mocks `177:601` / `182:300` in English (minus form cards, schedule cards and slider)
- Entering "Bisocard 5 mg", package 30, left 18, 2 per day previews "Lasts 9 days · until <today + 8>"; review shows the same; Save closes the dialog and a row appears in Studio under the selected profile with `counted_on` = today
- Changing the package chip moves "left now" until it is edited by hand; "Full package" / "2 packages" chips fill it; "Change" on the review step returns to the right field
- Empty name, package 0, dose 0 or 0.3 show field errors and nothing is saved
- Usable at 375 px and with keyboard only

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Medication overview and release

### Overview

Replace the empty state with the summary, tiles and grouped cards from mock `176:226`, update the docs, push the migration and open the PR.

### Changes Required:

#### 1. Urgency tokens

**File**: `src/app/globals.css`

**Intent**: Urgency colours as tokens, never hex in components.

**Contract**: `--urgency-red #f07777`, `--urgency-yellow #d39c37`, `--urgency-green` = the primary teal, `--urgency-track #d9d9d9`, plus light tints for the ran-out/red card if needed; exposed via `@theme inline` (`bg-urgency-red`, `text-urgency-yellow`, …).

#### 2. Overview components

**File**: `src/components/medications/*`, `src/app/(app)/page.tsx`

**Intent**: Answer "what runs out first?" at a glance for the selected profile.

**Contract**: the page reads `listMedications(selected.id)` inside the existing Suspense component, computes stock with `todayInWarsaw()`, sorts with `compareByRunOut`, groups with `groupByUrgency`.
- Summary under the profile heading: "Total medications: N" and, when the red group is non-empty, "M running out!" in red.
- "What's running out?" — three tiles (icons `message-circle-warning`, `clock-alert`, `alarm-clock-check`) with counts and labels "14 days or less", "30 days or less", "More than 30 days"; counts equal the group sizes.
- "Medication stock (N)" heading with "Add medication" (Phase 3) on the right.
- Groups in order red → yellow → green with header "<label> (count)"; empty groups are not rendered.
- Card: date tile (weekday / day / month of `runOutDate`, or `lastCoveredDay` when ran out), name, "<dose> tabl. daily · <left> tabl. left" (halves shown as "1.5"), "Runs out on Friday, 13 November" or "Ran out on Monday, 9 November" / "Not enough for a full day's dose", days-left number with "day left"/"days left" in the urgency colour (ran out: "Ran out" badge), and a three-segment bar (0–14, 15–30, 31–60 days; fill proportional to `min(daysLeft, 60)`, track `urgency-track`).
- Empty profile: the illustration card with "No medications yet." and the add button; no tiles.
- Server Components except the dialog; no `zinc-*`, `dark:` or hex in components.

#### 3. Docs

**File**: `AGENTS.md`, `README.md`

**Intent**: Make the test command and the calculation rule discoverable.

**Contract**: AGENTS.md Commands gains `npm test` (Vitest) and replaces "No JavaScript test runner exists yet"; Project Structure gains `src/lib/medications/` (calculation, DAL, actions) and `src/components/medications/`; Hard Rules gains "Run-out maths lives only in `src/lib/medications/stock.ts`; change it test-first." README mentions medications and `npm test`.

#### 4. Migration push and PR

**File**: — (Supabase CLI, GitHub)

**Intent**: The PR preview reads the production database, so the schema must be there before the PR opens.

**Contract**: after local gates pass: `npx supabase db push --remote --dry-run`, then (with user approval) `npx supabase db push --remote`; push the branch, open the PR against `master` referencing US-01, FR-007, FR-014, FR-015. The migration file is frozen from then on.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Lint passes: `npm run lint`
- Production build passes: `npm run build`
- RLS tests still pass: `npx supabase test db`
- On the PR, `Lint and build` (now including `npm test`) and `preview` succeed: `gh pr checks`

#### Manual Verification:

- With medications at 9, 14, 15, 30, 31 and 0 days left, groups, colours, tile counts and order match the rule; the ran-out card is first
- The overview matches the S-03 parts of mock `176:226` (summary, tiles, grouped cards, bar) in English, without "+ Add package" and "⋯"
- Adding a medication through the dialog shows it in the right group immediately; switching profiles shows each profile's own list
- At 375 px tiles and cards stack and stay readable
- Before the PR opened, `npx supabase db push --remote` applied the migration (dashboard shows `medications` with RLS on)
- On the PR preview, a real account can add a medication and see its run-out date

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `src/lib/medications/stock.test.ts` — the run-out rule, thresholds, ran-out states, halves, Warsaw day boundaries incl. DST, date rollover, sort and grouping (Phase 1).
- `src/lib/medications/validation.test.ts` — field limits identical to the migration checks (Phase 3).

### Integration Tests:

- pgTAP `supabase/tests/database/medications_rls.test.sql` — isolation, insert scope, column grant on `counted_on`, constraints, cascade.
- The PR preview exercises the app against the production database after the migration push.

### Manual Testing Steps:

1. Add "Bisocard 5 mg", 30 per package, 18 left, 2/day → 9 days, last covered day today + 8, red.
2. Add medications reaching 14, 15, 30, 31 days → check groups and tile counts.
3. In Studio set one row's `counted_on` 10 days back → it shows "Ran out on …" at the top.
4. Add a 0.5/day and a 1.5/day medication → halves display correctly.
5. Sign in as a second account → none of the first account's medications appear.
6. Repeat 1–2 at 375 px.

## Performance Considerations

- One indexed query per page view (`profile_id`); calculation is O(n) in memory for a handful of rows. No caching of user data.

## Migration Notes

- Second migration; additive. Existing profiles simply have no medications.
- Rollback: a follow-up migration dropping `medications`. Never edit the pushed migration.

## References

- Roadmap item: `context/foundation/roadmap.md` (S-03)
- PRD: US-01, FR-007, FR-014, FR-015, Business Logic, Guardrails (`context/foundation/prd.md`)
- Figma file `jThXxph37aBIqtM28HkonX`: `176:226` (main screen), `177:601` (add, step 1), `182:300` (review step)
- Privacy template: `supabase/migrations/20261116165228_profiles.sql:70-80`, `supabase/tests/database/profiles_rls.test.sql`
- Form pattern: `src/lib/profiles/actions.ts`, `src/components/profiles/profile-form.tsx`
- Prior plan: `context/archive/2026-11-16-create-and-switch-profiles/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Run-out calculation and test runner

#### Automated

- [x] 1.1 Unit tests pass: `npm test` — 252fce0
- [x] 1.2 Lint passes: `npm run lint` — 252fce0
- [x] 1.3 Production build passes: `npm run build` — 252fce0

#### Manual

- [x] 1.4 The worked examples in the test file match the decided rule (18 at 2/day on 5 Nov → 13 Nov; ran-out example → 9 Nov) — 252fce0

### Phase 2: Medications database

#### Automated

- [x] 2.1 Migration applies on a clean database: `npx supabase db reset` — fe5b583
- [x] 2.2 RLS tests pass: `npx supabase test db` — fe5b583
- [x] 2.3 Generated types are current: `npm run db:types` leaves `git status` clean — fe5b583
- [x] 2.4 Unit tests pass: `npm test` — fe5b583
- [x] 2.5 Lint passes: `npm run lint` — fe5b583
- [x] 2.6 Production build passes: `npm run build` — fe5b583

#### Manual

- [x] 2.7 In Studio (http://127.0.0.1:55323) `medications` shows RLS enabled with select and insert policies only — fe5b583

### Phase 3: Add medication dialog

#### Automated

- [x] 3.1 Unit tests pass: `npm test` — c87feff
- [x] 3.2 Lint passes: `npm run lint` — c87feff
- [x] 3.3 Production build passes: `npm run build` — c87feff
- [x] 3.4 RLS tests still pass: `npx supabase test db` — c87feff

#### Manual

- [x] 3.5 The dialog matches mocks `177:601` / `182:300` in English (minus form cards, schedule cards and slider) — c87feff
- [x] 3.6 Entering "Bisocard 5 mg", package 30, left 18, 2 per day previews "Lasts 9 days · until <today + 8>"; review shows the same; Save closes the dialog and a row appears in Studio under the selected profile with `counted_on` = today — c87feff
- [x] 3.7 Changing the package chip moves "left now" until it is edited by hand; "Full package" / "2 packages" chips fill it; "Change" on the review step returns to the right field — c87feff
- [x] 3.8 Empty name, package 0, dose 0 or 0.3 show field errors and nothing is saved — c87feff
- [x] 3.9 Usable at 375 px and with keyboard only — c87feff

### Phase 4: Medication overview and release

#### Automated

- [x] 4.1 Unit tests pass: `npm test` — 9562751
- [x] 4.2 Lint passes: `npm run lint` — 9562751
- [x] 4.3 Production build passes: `npm run build` — 9562751
- [x] 4.4 RLS tests still pass: `npx supabase test db` — 9562751
- [x] 4.5 On the PR, `Lint and build` (now including `npm test`) and `preview` succeed: `gh pr checks` — 9562751

#### Manual

- [x] 4.6 With medications at 9, 14, 15, 30, 31 and 0 days left, groups, colours, tile counts and order match the rule; the ran-out card is first — 9562751
- [x] 4.7 The overview matches the S-03 parts of mock `176:226` (summary, tiles, grouped cards, bar) in English, without "+ Add package" and "⋯" — 9562751
- [x] 4.8 Adding a medication through the dialog shows it in the right group immediately; switching profiles shows each profile's own list — 9562751
- [x] 4.9 At 375 px tiles and cards stack and stay readable — 9562751
- [x] 4.10 Before the PR opened, `npx supabase db push --remote` applied the migration (dashboard shows `medications` with RLS on)
- [x] 4.11 On the PR preview, a real account can add a medication and see its run-out date
