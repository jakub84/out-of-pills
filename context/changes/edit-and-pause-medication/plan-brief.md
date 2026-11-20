# Edit and Pause a Medication — Plan Brief

> Full plan: `context/changes/edit-and-pause-medication/plan.md`
> Research: `context/changes/edit-and-pause-medication/research.md`

## What & Why

Roadmap S-07 (FR-010, FR-012): caregivers can edit a medication — name, package size, daily dose, pills left — and pause / resume it. Doses change and treatments get suspended in real life; without this the run-out date drifts from reality. From the moment of the change the calculation follows the new values, a paused medication does not decrease, and the run-out date is never later than the real one.

## Starting Point

A medication stores a baseline (`pills_counted`, `counted_on`, `daily_dose`) and `computeStock()` derives today's figures, today counting as day 1. S-06 already rebases that baseline to "left today, counted today" through one guarded update. There is no pause state; the database blocks name / dose updates; the card's "⋯ → Edit" item is a disabled placeholder.

## Desired End State

"⋯" offers Correct count, Edit, Pause / Resume. Edit shows a live preview; lowering the dose lowers the pre-filled pills left. A paused medication sits muted in a "Paused" group with its frozen count and "Paused since <date>", outside every urgency signal. Resume restarts consumption from that day.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Data model | Rebase the baseline + `paused_on date`; no history tables | Rebasing collapses the past into the count, so nothing is recalculated retroactively | Research |
| Edit fields | Name, package size, daily dose and pills left | Everything about a medication fixable in one dialog | Plan |
| Dose decrease today | Silently assume today's old dose taken: `L − (old − new)` | Plain rebase can show the date one day late; this keeps the guardrail | Plan |
| Pills-left field | Pre-filled, follows the dose until the user types (`auto` / `manual`) | One visible number = what gets saved; server recomputes `auto` with its own date | Plan |
| Pause today | Today's dose counted as taken: frozen = `L − dose` | Never shows more pills than real; same-day pause + resume costs one dose on paper | Plan |
| Paused display | Separate "Paused" group after green; excluded from tiles, red dot, illustration | Paused items must not raise false alarms | Plan |
| While paused | Resume, Edit, Correct count; no "+ Add package"; pause = discontinue until S-08 | Fixes stay possible, card stays calm, no extra state | Plan |
| Database guard | Trigger requires a today-dated count for any dose / pause change | Makes a retroactive dose change impossible even if the app has a bug | Research |
| Concurrency | Guard also compares dose and pause state (incl. S-06 actions) | Double pause / stale edit gets the existing stale error | Plan |

## Scope

**In scope:** pause / edit / resume maths in `stock.ts` (test-first); additive migration with grants, check and trigger; pgTAP; edit / pause / resume server actions and toasts; edit dialog, pause and resume confirm dialogs, menu, paused card and group.

**Out of scope:** dose / stock history (FR-018); "already taken?" question; separate discontinue state; restocking while paused; scheduled pauses; irregular schedules (S-05); removal (S-08).

## Architecture / Approach

Every write = read row → `computeStock` today → apply change (`editStock` / `pauseStock` / `resumeStock` in `stock.ts`) → store as a new count dated today, through the generalised guarded update in `actions.ts`. The database trigger enforces the "dated today" rule for count, dose and pause changes. UI follows the existing Correct count dialog pattern with `runSaveAction` and toasts from `messages.ts`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Stock maths | Paused state, edit / pause / resume rebases, paused group — unit-tested | An off-by-one that moves a date later |
| 2. Database | `paused_on`, edit grants, extended same-day trigger, pgTAP, DAL | Trigger too loose (retroactive change) or too strict (blocks valid edits) |
| 3. Server actions | Guarded edit / pause / resume, validation, toast wording | Breaking S-06 restock / correction while generalising the guard |
| 4. UI | Edit dialog, pause / resume dialogs, paused card and group | Pills-left auto / manual behaviour confusing users |

**Prerequisites:** S-03 and S-06 merged (done); local Supabase stack running for Phase 2.
**Estimated effort:** ~3–4 sessions across 4 phases; migration must be pushed to the cloud project before the PR merges.

## Open Risks & Assumptions

- Conservative subtraction can under-count by a dose when today's dose wasn't taken yet; users fix it with Correct count.
- S-05 (irregular schedules) will change what "dose" and "today's dose" mean; the rebase functions and dose input are kept in reusable places for that.

## Success Criteria (Summary)

- A caregiver changes a dose or pauses a medication and the shown date is right from that day, never later than reality.
- A paused medication stays frozen for days and stops triggering red signals; resuming restarts it from that day.
- The database rejects any dose / pause change that is not dated today.
