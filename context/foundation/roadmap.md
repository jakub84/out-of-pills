---
project: Out of Pills
version: 1
status: draft
created: 2026-11-04
updated: 2026-11-04
prd_version: 1
main_goal: speed
top_blocker: time
milestone_id: first-usable-tracker
milestone_seq: 1
milestone_status: open
---

# Roadmap: Out of Pills

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-01: First usable tracker** — Status: open

- **Intent:** Deliver the full v1 MVP flow from the PRD — a caregiver signs up, creates profiles, adds medications and always sees how many pills are left and when each one runs out — plus a public demo mode, before the 2026-11-27 deadline.
- **Source materials:** `context/foundation/prd.md` (v1)
- **Done when:** every F-NN and S-NN below is `done`.
- **Scope anchors:** FR-001–FR-015, FR-019, FR-020 (all must-have FRs); US-01. FR-016–FR-018 (nice-to-have) are out of scope — see `## Parked`.

## Vision recap

People taking many medications only notice they are running out when a medication is already gone and there is no prescription at hand. Out of Pills removes manual counting: the caregiver enters the stock and dosage once, and the app calculates how many pills are left and when each medication will run out, so nobody has to remember to check.

## North star

**S-03: Caregiver adds a medication and sees when it runs out** — it is US-01 and the primary success criterion verbatim; with `main_goal: speed`, the whole roadmap is arranged to reach it after only two thin prerequisite slices.

> "North star" here means the smallest end-to-end slice whose successful delivery proves the product works — it is placed as early as its prerequisites allow, because everything else only matters if this works.

## At a glance

| ID   | Change ID                  | Outcome (user can …)                                                                 | Prerequisites                     | PRD refs                       | Status   |
| ---- | -------------------------- | ------------------------------------------------------------------------------------ | --------------------------------- | ------------------------------ | -------- |
| F-01 | deploy-pipeline            | (foundation) every merge to `main` is linted, built and deployed to a public URL      | —                                 | NFRs (browsers), Access Control | ready    |
| S-01 | email-sign-in              | sign up and sign in with email + password and land on an empty main screen           | —                                 | FR-001                         | in-progress |
| S-02 | create-and-switch-profiles | create profiles ("Mom", "Me") and switch between them on the main screen             | S-01                              | FR-003, FR-006                 | proposed |
| S-03 | first-medication-run-out   | add a medication with a daily dosage and see pills left, run-out date, days left and urgency colour, sorted | S-02                  | US-01, FR-007, FR-014, FR-015  | proposed |
| S-04 | google-sign-in             | sign in with a Google account                                                        | S-01, F-01                        | FR-002                         | proposed |
| S-05 | irregular-dosage           | define a dosage as an irregular schedule (e.g. every other day, once a week)         | S-03                              | FR-008                         | proposed |
| S-06 | restock-and-correct        | add a new package in one action and correct the pill count                           | S-03                              | FR-009, FR-011                 | proposed |
| S-07 | edit-and-pause-medication  | edit a medication's dosage and pause / resume it, with the calculation following from that moment | S-03                 | FR-010, FR-012                 | proposed |
| S-08 | rename-and-delete          | rename and delete profiles and delete medications, after a confirmation              | S-02, S-03                        | FR-004, FR-005, FR-013         | proposed |
| S-09 | profile-urgency-marker     | see on the profile list each profile's most urgent colour                            | S-02, S-03                        | FR-019                         | proposed |
| S-10 | demo-mode                  | try the app without signing in on pre-filled sample data that is never persisted     | S-05, S-06, S-07, S-08, S-09      | FR-020                         | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                  | Chain                                   | Note                                                                                  |
| ------ | ---------------------- | --------------------------------------- | ------------------------------------------------------------------------------------- |
| A      | Core loop              | `S-01` → `S-02` → `S-03` → `S-09`       | Shortest path to the north star; `speed` puts this stream first.                      |
| B      | Keeping stock accurate | `S-05` · `S-06` · `S-07` (parallel)     | Joins Stream A at `S-03`; the three slices can run as separate agent runs.            |
| C      | Access & reach         | `F-01` → `S-04`                         | Runs alongside Stream A; Google sign-in needs the public URL from `F-01`.             |
| D      | Housekeeping & demo    | `S-08` → `S-10`                         | Joins Stream A at `S-03`; demo comes last so it reflects the full feature set.        |

## Baseline

What's already in place in the codebase as of `2026-11-04` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** partial — create-next-app scaffold only (`src/app/layout.tsx`, `src/app/page.tsx`, Tailwind v4); no product screens.
- **Backend / API:** absent — no route handlers or server actions.
- **Data:** absent — Supabase chosen in `tech-stack.md`, but no dependency, no `supabase/` folder, no migrations.
- **Auth:** absent — no `@supabase/ssr`, no middleware; Supabase Auth planned per `tech-stack.md`.
- **Deploy / infra:** absent — Vercel + GitHub Actions planned per `tech-stack.md`; no `.github/workflows`.
- **Observability:** absent — no logging or error tracking (parked for this milestone, see `## Parked`).

## Foundations

### F-01: Deploy pipeline to a public URL

- **Outcome:** (foundation) every merge to `main` runs lint + build and deploys to a public URL; pull requests get a preview deployment.
- **Change ID:** deploy-pipeline
- **PRD refs:** NFRs (browsers), Access Control
- **Unlocks:** S-04 (Google sign-in needs a stable public callback URL); verification path for every slice on real mobile browsers (browser NFR); public access for S-10.
- **Prerequisites:** —
- **Parallel with:** S-01, S-02, S-03, S-05, S-06, S-07, S-08, S-09, S-10
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Sequenced early because it is cheap now and expensive in the final week before the deadline; scope stays at pipeline + hosting — no Supabase or auth work here.
- **Status:** ready

## Slices

### S-01: Sign up and sign in with email

- **Outcome:** user can sign up and sign in with email + password, sign out, and land on an empty main screen that only signed-in users can reach.
- **Change ID:** email-sign-in
- **PRD refs:** FR-001
- **Prerequisites:** —
- **Parallel with:** F-01
- **Blockers:** —
- **Unknowns:**
  - Must a new user confirm their email before the first sign-in? Requiring it may break the "within 2 minutes of signing up" success criterion. — Owner: user. Block: no.
- **Risk:** First contact with Supabase Auth and session handling — the layer flagged as least familiar in `tech-stack.md`; keeping it in its own slice isolates that learning from the medication logic.
- **Status:** in-progress

### S-02: Create and switch profiles

- **Outcome:** user can create several profiles (e.g. "Mom", "Dad", "Me") and switch between them using the profile list on the main screen.
- **Change ID:** create-and-switch-profiles
- **PRD refs:** FR-003, FR-006
- **Prerequisites:** S-01
- **Parallel with:** F-01, S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** First table holding user data — establishes the per-caregiver privacy rule (row-level security scoped to the signed-in user) that every later slice copies; getting it wrong here leaks health data.
- **Status:** proposed

### S-03: Caregiver adds a medication and sees when it runs out

- **Outcome:** user can add a medication to a profile (name + strength, pills per package, pills left, daily dosage) and see, for every medication of the profile, pills left, run-out date, days left and an urgency colour (red ≤ 14 days, yellow ≤ 30, green above), sorted from the one running out soonest.
- **Change ID:** first-medication-run-out
- **PRD refs:** US-01, FR-007, FR-014, FR-015
- **Prerequisites:** S-02
- **Parallel with:** F-01, S-04
- **Blockers:** —
- **Unknowns:**
  - Does the dose on the day the stock is entered count as already taken? The answer shifts the run-out date by one day; the PRD rule says to err on the early side. — Owner: user. Block: no.
- **Risk:** Holds the core calculation the whole product depends on; it must always round toward the earlier date, so it gets the deepest verification of any slice.
- **Status:** proposed

### S-04: Sign in with Google

- **Outcome:** user can sign up and sign in with a Google account, as an addition to email + password.
- **Change ID:** google-sign-in
- **PRD refs:** FR-002
- **Prerequisites:** S-01, F-01
- **Parallel with:** S-02, S-03, S-05, S-06, S-07, S-08, S-09, S-10
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Depends on configuration outside the codebase (Google OAuth client, allowed redirect URLs); off the critical path so delays here never hold up the north star.
- **Status:** proposed

### S-05: Irregular dosage schedules

- **Outcome:** user can define a medication's dosage as an irregular schedule (e.g. every other day, once a week) and the run-out date follows that schedule.
- **Change ID:** irregular-dosage
- **PRD refs:** FR-008
- **Prerequisites:** S-03
- **Parallel with:** S-04, S-06, S-07, S-08, S-09
- **Blockers:** —
- **Unknowns:**
  - Which irregular patterns must v1 support — "every N days" and "on chosen weekdays", or more? — Owner: user. Block: no.
- **Risk:** Extends the run-out calculation with the most edge cases; sequenced after S-03 so the daily case is proven first.
- **Status:** proposed

### S-06: Restock and correct the pill count

- **Outcome:** user can add a new package of a tracked medication in one action (pill count pre-filled, editable before confirming) and correct the current number of pills left.
- **Change ID:** restock-and-correct
- **PRD refs:** FR-009, FR-011
- **Prerequisites:** S-03
- **Parallel with:** S-04, S-05, S-07, S-08, S-09
- **Blockers:** —
- **Unknowns:** —
- **Risk:** The fast "+ package" action is the PRD's main UX guardrail for repeat use; both actions reset the stock baseline the calculation runs from.
- **Status:** proposed

### S-07: Edit dosage and pause a medication

- **Outcome:** user can edit a medication (including its dosage) and pause / resume it; from that moment the calculation follows the new values, and a paused medication does not decrease.
- **Change ID:** edit-and-pause-medication
- **PRD refs:** FR-010, FR-012
- **Prerequisites:** S-03
- **Parallel with:** S-04, S-05, S-06, S-08, S-09
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Changes to dosage and pause state must not retroactively alter pills already consumed; one risk boundary — calculation over time segments.
- **Status:** proposed

### S-08: Rename and delete profiles and medications

- **Outcome:** user can rename a profile, delete a profile together with its medications, and delete a single medication — each deletion after a confirmation.
- **Change ID:** rename-and-delete
- **PRD refs:** FR-004, FR-005, FR-013
- **Prerequisites:** S-02, S-03
- **Parallel with:** S-04, S-05, S-06, S-07, S-09
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Covers the NFR "a user can delete their own data"; profile deletion is modelled as the last caregiver detaching so later sharing (FR-016) does not break it.
- **Status:** proposed

### S-09: Urgency marker on the profile list

- **Outcome:** user can see, on the profile list, each profile's most urgent colour, so an urgent medication in another profile is not missed.
- **Change ID:** profile-urgency-marker
- **PRD refs:** FR-019
- **Prerequisites:** S-02, S-03
- **Parallel with:** S-04, S-05, S-06, S-07, S-08
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Small slice reusing S-03's urgency logic; must stay consistent with the per-medication colours.
- **Status:** proposed

### S-10: Try without signing in (demo mode)

- **Outcome:** visitor can open "Try without signing in", click through pre-filled sample profiles and medications and edit them, with a clear test-mode label; nothing is persisted or visible to other users.
- **Change ID:** demo-mode
- **PRD refs:** FR-020
- **Prerequisites:** S-05, S-06, S-07, S-08, S-09
- **Parallel with:** F-01, S-04
- **Blockers:** —
- **Unknowns:**
  - When does demo data reset — on leaving the page, on a timer, or both? — Owner: user. Block: no.
- **Risk:** Sequenced last so the demo mirrors the complete feature set in one pass; it must never write to the database (hard rule), which is the main thing to verify.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                  | Suggested issue title                                   | Ready for `/10x-plan` | Notes |
| ---------- | -------------------------- | ------------------------------------------------------- | --------------------- | ----- |
| F-01       | deploy-pipeline            | Set up CI and auto-deploy to a public URL               | yes                   | Run `/10x-plan deploy-pipeline` |
| S-01       | email-sign-in              | Sign up and sign in with email and password             | yes                   | Run `/10x-plan email-sign-in` |
| S-02       | create-and-switch-profiles | Create profiles and switch between them                 | no                    | Needs S-01 |
| S-03       | first-medication-run-out   | Add a medication and show its run-out date and urgency  | no                    | North star; needs S-02 |
| S-04       | google-sign-in             | Sign in with Google                                     | no                    | Needs S-01, F-01 |
| S-05       | irregular-dosage           | Support irregular dosage schedules                      | no                    | Needs S-03 |
| S-06       | restock-and-correct        | Add a package in one action and correct pill count      | no                    | Needs S-03 |
| S-07       | edit-and-pause-medication  | Edit dosage and pause / resume a medication             | no                    | Needs S-03 |
| S-08       | rename-and-delete          | Rename and delete profiles, delete medications          | no                    | Needs S-02, S-03 |
| S-09       | profile-urgency-marker     | Show each profile's urgency on the profile list         | no                    | Needs S-02, S-03 |
| S-10       | demo-mode                  | Demo mode without signing in                            | no                    | Needs S-05–S-09 |

## Open Roadmap Questions

1. **What sensible role could AI play in the product?** — Owner: user. Block: roadmap-wide, but not blocking any slice in this milestone (from PRD Open Questions).

## Parked

- **Dose-taking reminders** — Why parked: PRD §Non-Goals — the product watches the stock, not whether a dose was taken.
- **Medication database and e-prescription / pharmacy integration** — Why parked: PRD §Non-Goals — names are typed in manually.
- **Native mobile app and offline support** — Why parked: PRD §Non-Goals — browser only, internet required.
- **Profile sharing between caregivers (FR-016)** — Why parked: PRD nice-to-have, outside v1.
- **Email notification when a medication is running out (FR-017)** — Why parked: PRD nice-to-have, outside v1.
- **History of stock changes (FR-018)** — Why parked: PRD nice-to-have, outside v1.
- **Error tracking and logging** — Why parked: not required by the PRD; `main_goal: speed` and `top_blocker: time` defer it to a later milestone.
- **AI features** — Why parked: role undecided (Open Roadmap Question 1).

## Milestone History

## Done
