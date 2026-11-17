# First Medication Run-Out — Plan Brief

> Full plan: `context/changes/first-medication-run-out/plan.md`

## What & Why

Roadmap S-03 (US-01, FR-007, FR-014, FR-015): a caregiver adds a medication with a daily dose to a profile and immediately sees pills left, the run-out date, days left and an urgency colour, sorted from the one running out soonest. This is the product's primary success criterion, and its guardrail — the run-out date is never later than the real one — makes the calculation the most heavily tested code in the app.

## Starting Point

S-02 left `/` with the profile heading and a static "No medications yet" card. Profiles are protected by RLS through `profile_caregivers`; there is no medications table, no dialog component and no JS test runner (CI runs lint + build only).

## Desired End State

"Add medication" opens a two-step dialog (details with a live "Lasts N days · until …" preview, then review & confirm). The main screen shows a summary ("Total medications: N · M running out!"), three count tiles and cards grouped by urgency, each with run-out date, pills left, days left and a progress bar. Example: 18 tablets at 2/day counted on Thu 5 Nov → 9 days left, runs out Fri 13 Nov, red.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Run-out date | Last day with a full dose; today's dose comes out of the counted stock | Never late whether or not today's pill was already taken (answers the roadmap unknown). |
| Urgency | PRD thresholds, inclusive: ≤ 14 red, ≤ 30 yellow, ≥ 31 green | PRD FR-015 + AGENTS.md hard rule; Figma's "7 days" is a design error. |
| Doses | Multiples of 0.5 tablet | Split tablets are common; quarters are rare. |
| "Today" | Europe/Warsaw calendar day, in code and as the DB default | Polish users; UTC would flip the day late (a late-side error). |
| Add flow | Two-step modal as in Figma | Matches design; review step reusable for S-07 edit. |
| Medication form | Not stored; all units "tabl." | Keeps everything countable; syrups are out of v1. |
| Irregular schedules | Hidden until S-05 | No dead UI. |
| Used-up stock | "Ran out on <last covered day>" state, 0 left, top of the list | Unmissable, pills never negative. |
| Overview | Summary line + three tiles + cards grouped by urgency | Close to mock `176:226`; answers "anything urgent?" at a glance. |
| "Left now" default | Pre-filled with package size (user choice) | Fastest for a fresh package; accepted risk, see below. |
| Storage | Counted pills + `counted_on`; figures computed on read | PRD: stock decreases from the moment it was entered; S-06/S-07 re-count later. |
| Tests | Vitest for the pure module, `npm test` in the `Lint and build` CI job; pgTAP for RLS | Earlier slices deferred unit tests to this calculation. |

## Scope

**In scope:** `medications` table with RLS + pgTAP; pure stock module with exhaustive unit tests; Vitest + CI step; add-medication dialog and server action; summary, tiles and grouped cards on `/`; urgency tokens; docs; cloud migration push and PR.

**Out of scope:** irregular schedules (S-05), "+ Add package" and corrections (S-06), edit/pause (S-07), delete and "⋯" menu (S-08), sidebar urgency markers (S-09), demo mode (S-10), medication form types, slider, E2E tests, migrations in CI.

## Architecture / Approach

The database stores inputs only (name, package size, pills counted, daily dose, `counted_on` stamped by the DB in Warsaw time). `src/lib/medications/stock.ts` is a pure, framework-free module that turns a row plus today's Warsaw date into pills left, days left, run-out date and urgency, and sorts/groups the list; the server page and the client dialog preview both import it. Counts are handled as half-tablet integers to avoid floating-point drift.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Run-out calculation and test runner | Vitest, `stock.ts` + boundary tests, `npm test` in CI | Off-by-one or time-zone slip that makes the date late |
| 2. Medications database | Migration with RLS, pgTAP, types, `listMedications()` | Policy that leaks another caregiver's rows |
| 3. Add medication dialog | Two-step dialog, validation shared with DB limits, server action | Client and DB limits drifting apart |
| 4. Medication overview and release | Summary, tiles, grouped cards, docs, `db push --remote`, PR | Tile counts disagreeing with the list |

**Prerequisites:** S-02 merged (done); local Supabase running; CLI linked to the cloud project (done in S-02).
**Estimated effort:** ~3–4 sessions across 4 phases.

## Open Risks & Assumptions

- Pre-filled "left now": an unedited half-used package overstates stock — the calculation can't catch it; the review step shows the count prominently.
- Europe/Warsaw for everyone: a caregiver far abroad sees the day change a few hours off.
- The Figma sample date (14 Nov for 18 tablets at 2/day from 5 Nov) is one day later than the chosen rule; the app will show 13 Nov by design.

## Success Criteria (Summary)

- A new medication shows the correct pills left, run-out date (never late), days left and colour within seconds of saving, sorted soonest first.
- `npm test` pins every boundary of the rule and runs on every PR.
- No caregiver can see or add medications in another caregiver's profile (pgTAP).
