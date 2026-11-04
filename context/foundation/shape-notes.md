---
project: "Out of Pills"
context_type: greenfield
created: 2026-11-03
updated: 2026-11-03
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: 2026-11-27
  after_hours_only: false
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "pain category"
      decision: "workflow friction (manual counting/notes too time-consuming) + forgetting / no signal"
    - topic: "insight"
      decision: "remaining stock can be calculated from dosage and package state — enter once, app recalculates"
    - topic: "primary persona"
      decision: "caregiver of a close person; self-monitoring user is secondary"
    - topic: "auth method"
      decision: "account with email + password, plus Google sign-in"
    - topic: "roles on a shared profile"
      decision: "flat model: all caregivers with access are equal (view + edit)"
    - topic: "patient account"
      decision: "not required; a profile is a 'folder' describing a person"
    - topic: "sharing mechanism"
      decision: "invitation by email"
    - topic: "profile removal / revoking access"
      decision: "each caregiver can only detach themselves; profile is deleted when the last caregiver detaches"
    - topic: "MVP scope"
      decision: "single caregiver flow: sign up -> create profile -> add medication -> see when it runs out; sharing and notifications are NOT in v1"
    - topic: "timeline"
      decision: "~3h/day Mon-Fri until 2026-11-27 (~3.5 weeks, ~50-55h); fits the 3-week MVP budget"
  frs_drafted: 20
  quality_check_status: accepted
---

# Shape notes — Out of Pills

## Seed idea (verbatim)

> Projekt Out of pills, aplikacja webowa do monitorowania leków które się bierze. Przykładowo, bliksa mi osoba bierze duzo różnych leków i nie zwraca uwagi czy kończą się czy nie, problem pojawia się gdy okazuje się że gdy część leków się skonczyła, a nie mamy recepty i to powoduje stres. Aplikacja miałaby przechowywac informacje o lekach i przeliczac kiedy sie skonczą, za kazdym razem gdy user loguje sie do plaikacji widzi, w czytelny przystępny sposob (UX - ważne) ile zostało tabletek i kiedy się skonczą, mozna tworzyc profile, uzytkownik moze miec ich pare, uzytkownicy mogą sobie udotstępniać też prfile np by dwie osoby mogły pilnować zapasów dla osoby trzeciej. Fajnie byłoby mieć system notyfikacji kiedy konczy sie jakis lek (np mail) ale nie jest to najważniejsza funkcjonalność. Zastanawiam się też nad podpięciem AI ale nie jestem pewien jaką sensowną rolę miałaby pełnić.

## Vision & Problem Statement

A person taking many different medications does not keep track of whether they are running out. The problem surfaces only when some medications have already run out and there is no prescription at hand — causing stress and, in reality, an interruption in taking the medication. Today the household checks the stock "every now and then"; notes are not kept because counting and regularly updating them is time-consuming, notes get lost, and people simply forget that the stock needs monitoring.

Insight: the remaining stock does not need to be counted manually — it can be calculated from the dosage and the package state. The data is entered once and the app recalculates when each medication will run out, so nobody has to remember to check.

Pain category: workflow friction (manual tracking is too costly to sustain) + forgetting (no signal before it is too late).

## User & Persona

### Primary persona
A caregiver of a close person who takes many medications. The caregiver watches the medication stock on the other person's behalf (possibly for more than one person) and may share that responsibility with another caregiver. They reach for the product when they want to know, at a glance, how many pills are left and when each medication will run out.

### Secondary persona
A person monitoring their own medication stock.

## Access Control

- Users sign in with an account: email + password, or Google sign-in.
- A user can create several profiles. A profile describes a person whose medications are tracked; that person does not need an account of their own (they may be invited like any other caregiver if they want access).
- Profiles are shared by an invitation sent to an email address; after signing in / signing up, the invited user sees the profile in their list.
- Flat role model: every user with access to a profile is an equal caregiver — can view and edit the profile's medications and invite others.
- No user can delete data for others: each caregiver can only detach themselves from a profile; the profile is deleted when the last caregiver detaches.
- Unauthenticated users see sign-in / sign-up and a "Try without signing in" demo entry. Demo visitors get pre-filled sample profiles and medications they can click through and edit; demo changes are not persisted (reset on exit / after time), a clear message says it is a test mode, and nothing from a demo session is visible to other users.
- MVP note: profile sharing (invitations, multiple caregivers) is the target model but is NOT part of v1 — v1 has a single caregiver per profile.

## MVP flow

1. User signs up (email + password or Google).
2. User creates a profile (e.g. "Mom").
3. User adds a medication.
4. User sees how many pills are left and when the medication will run out.

Out of v1 by user decision: profile sharing, notifications.

## Timeline budget

- Available: ~3h/day, Monday–Friday, until 2026-11-27 (~3.5 weeks, ~50–55h).
- mvp_weeks: 3 (flow has 4 steps — fits the budget; no scope-cost warning needed).
- hard_deadline: 2026-11-27.

## Success Criteria

### Primary
- After adding a medication, the user sees — within 2 minutes of signing up — how many pills are left and the correct date when the medication will run out.

### Secondary
- The main screen shows all medications of a profile in a readable overview, sorted from the one running out soonest, with a clear warning.

### Guardrails
- Privacy: medication (health) data is visible only to the profile's caregiver(s) — nobody else.
- Calculation correctness: the run-out date is never later than in reality (better to warn too early than too late).
- UX: entering data is simple, re-adding the same medication again (e.g. a new package of a medication already tracked) is fast, and the whole product is designed with UX in mind.

## Functional Requirements

### Authentication
- FR-001: User can sign up and sign in with email + password. Priority: must-have
  > Socrates: Counter-argument considered: "Google alone would be less work in 3 weeks." Resolution: kept — both sign-in options must stay.
- FR-002: User can sign in with a Google account. Priority: must-have
  > Socrates: Counter-argument considered: "not every caregiver has a Google account." Resolution: kept as an additional option, never the only one (FR-001 stays).
- FR-020: Visitor can try the app without signing in, in a demo mode with pre-filled sample profiles and medications that can be edited but are not persisted. Priority: must-have
  > Socrates: Counter-argument considered: "a visitor may type real medication data into the demo." Resolution: demo data is never persisted, test mode is clearly labelled, and nothing from a demo session reaches other users.

### Profiles
- FR-003: User can create multiple profiles (e.g. "Mom", "Dad", "Me"). Priority: must-have
  > Socrates: Counter-argument considered: "one profile is enough to prove the MVP." Resolution: no counter-argument accepted; stands as written.
- FR-004: User can rename a profile. Priority: must-have
  > Socrates: Counter-argument considered: "rarely needed." Resolution: kept as must-have — without it a typo forces deleting the profile with its medications.
- FR-005: User can delete a profile together with its medications, after a confirmation. Priority: must-have
  > Socrates: Counter-argument considered: "conflicts with later sharing, where removal becomes 'detach yourself'." Resolution: in v1 (single caregiver) deleting with confirmation = the last caregiver detaching; the rule from Access Control is kept so sharing does not break it later.
- FR-006: User can switch between profiles using the profile list on the main screen. Priority: must-have
  > Socrates: Counter-argument considered: "an urgent medication in another profile is invisible while looking at the current one." Resolution: added FR-019 (urgency marker on the profile list).
- FR-019: User can see on the profile list the urgency of each profile (colour of its most urgent medication). Priority: must-have
  > Socrates: Counter-argument considered: "duplicates information." Resolution: no counter-argument accepted; stands as written.

### Medications
- FR-007: User can add a medication to a profile with: name + strength, number of pills per package, current number of pills left, and dosage. Priority: must-have
  > Socrates: Counter-argument considered: "the caregiver does not know the current stock and has to count the pills." Resolution: accepted as a one-time cost; field stays.
- FR-008: User can define dosage either as a daily amount or as an irregular schedule (e.g. every other day, once a week). Priority: must-have
  > Socrates: Counter-argument considered: "irregular schedules are a lot of work for v1." Resolution: no counter-argument accepted; stands as written.
- FR-009: User can add a new package of an already tracked medication in one action ("+ package"); the package's pill count is pre-filled and can be changed before confirming. Priority: must-have
  > Socrates: Counter-argument considered: "a package may have a different size (e.g. 28 instead of 30)." Resolution: default count from the medication, editable before confirming.
- FR-010: User can edit a medication (including its dosage); from that moment the calculation follows the new values. Priority: must-have
  > Socrates: Counter-argument considered: "a temporary dosage (e.g. double dose for 5 days) is not covered by a plain dosage change." Resolution: user decision — dosage changes are done by editing the medication.
- FR-011: User can correct the current number of pills left (e.g. after a recount or a lost pill). Priority: must-have
  > Socrates: Counter-argument considered: "corrections may hide calculation errors." Resolution: no counter-argument accepted; stands as written.
- FR-012: User can pause / discontinue a medication so its stock stops decreasing. Priority: must-have
  > Socrates: Counter-argument considered: "deleting (FR-013) would be enough." Resolution: no counter-argument accepted; stands as written.
- FR-013: User can delete a medication, after a confirmation. Priority: must-have
  > Socrates: Counter-argument considered: "risk of accidental deletion." Resolution: deletion requires confirmation; pausing stays a separate action.

### Stock overview
- FR-014: User can see, for every medication of the selected profile, how many pills are left, the date it runs out and the number of days left — sorted from the one running out soonest. Priority: must-have
  > Socrates: Counter-argument considered: "the run-out date is too late — what matters is when to get the prescription." Resolution: keep the run-out date; the early-warning buffer comes from the colour thresholds (FR-015).
- FR-015: User can recognise urgency at a glance through colour thresholds (red ≤ 14 days, yellow ≤ 30 days, green above) next to the days-left count. Priority: must-have
  > Socrates: Counter-argument considered: "7 days is too little to get a prescription." Resolution: thresholds raised to red ≤ 14 days, yellow ≤ 30 days.

### Later (outside v1)
- FR-016: User can share a profile with another caregiver by email invitation. Priority: nice-to-have
  > Socrates: Counter-argument considered: "sharing is core to the caregiver persona." Resolution: stays nice-to-have, per the MVP scope decision.
- FR-017: User receives an email notification when a medication is running out. Priority: nice-to-have
  > Socrates: Counter-argument considered: "without it the 'forgetting' pain remains — v1 signals only when someone opens the app." Resolution: stays nice-to-have, per the MVP scope decision.
- FR-018: User can see the history of stock changes (packages added, dosage changes, corrections). Priority: nice-to-have
  > Socrates: Counter-argument considered: "history must be recorded from the start or v1 data is lost." Resolution: stays nice-to-have.

Main screen (user decision): the medications of one profile plus the list of profiles (switch between them there).
AI role: undecided — tracked in Open Questions, not as an FR.

## Business Logic

Based on the pill stock and the dosage schedule, the app calculates every day how many pills are left and when each medication will run out, and flags medications whose end is close enough that a prescription must be obtained.

Inputs (entered by the user): current number of pills left, pills per package, dosage (daily amount or irregular schedule), package additions, stock corrections, dosage edits and pause/resume of a medication.

Stock decreases automatically according to the dosage schedule from the moment the stock was entered — the user does not confirm individual doses; deviations are fixed with a stock correction. A paused medication does not decrease. The output is, per medication: pills left, run-out date and days left, plus an urgency level (red ≤ 14 days, yellow ≤ 30 days, green above). The calculation always errs on the early side — the shown run-out date is never later than the real one.

The user encounters the rule on every sign-in: the selected profile's medications are listed from the one running out soonest, with colour-coded urgency, and the profile list shows each profile's most urgent level.

## Non-Functional Requirements

- Medication (health) data of a profile is visible only to that profile's caregiver(s); it is never disclosed to third parties, and a user can delete their own data.
- The product is fully usable in mobile and desktop browsers (latest two major versions of the mainstream browsers).

## User Stories

### US-01: Caregiver sees when a newly added medication runs out

- **Given** a signed-in user with a profile "Mom" and no medications yet
- **When** they add a medication with name + strength, pills per package, pills currently left and a daily dosage
- **Then** the profile's overview shows that medication with the number of pills left, the run-out date and the days left, marked with the matching urgency colour

#### Acceptance Criteria
- The run-out date is never later than the real one (rounding errs on the early side).
- The overview is sorted from the medication running out soonest.

## Product framing

- Product type: web app.
- Scale: the author plus a handful of people — a portfolio project. Public visitors can try it through the demo mode (FR-020).
- Timing: hard deadline 2026-11-27; ~3h/day Mon–Fri as part of the working/learning day (not after hours).

## Non-Goals

- No dose-taking reminders — the product watches the stock, not whether a dose was taken at 8:00.
- No medication database and no integration with e-prescription systems (IKP) or pharmacies — the medication name is typed in manually.
- No native mobile app and no offline guarantee — browser only, internet required.
- Not in v1 (nice-to-have, see FR-016–FR-018): profile sharing between caregivers, email notifications, stock change history.

## Open Questions

1. **What sensible role could AI play in the product?** — Owner: user. Not blocking v1.
