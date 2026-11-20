# Page Loaders and Save Toasts — Plan Brief

> Full plan: `context/changes/loaders-and-toasts/plan.md`

## What & Why

Caregivers should see that the app is working when they move between pages, and get clear confirmation when a change is saved. This plan adds a recoloured four-ring loader for page changes and first load, plus short toasts after successful saves. Hiding the old content during a profile switch also prevents one person's medications being read as another's.

## Starting Point

Profile switching changes only a URL parameter, and the code suggests the old content stays visible until new data arrives. Some pages are blank while loading, there is no toast system, and two saves end in server redirects that leave their forms no success result.

## Desired End State

Moving between profiles and app pages immediately hides the old content, with the loader fading in if loading passes 150 ms. Successful saves show a specific toast such as `+28 tabl. added to Aspirin`. Existing inline errors stay, and a failed request shows a toast while the user stays on the form.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Loader design | Uiverse four-ring loader in teal, ink and grey | Your chosen design, without the colours that signal urgency |
| Loader placement | Replaces the main area; header and sidebar stay | Old medications cannot be mistaken for the new profile's |
| Loader coverage | Signed-in app and onboarding | Consistent for signed-in caregivers; auth pages are mostly static |
| First load | Loader for main content; small skeletons stay in sidebar and avatar | Page content always loads the same way |
| Fast loads | Hide content at once, fade loader in after 150 ms | No stale content and no flash |
| Toast scope | Medication, package, count, profile, password | Confirms lasting changes without interrupting onboarding |
| Toast text | Name and amount | Shows exactly what changed |
| Toast position | Bottom right; full width at the bottom on phones; about 4 s | Stays clear of the header and page title |
| Failures | Inline errors stay; toast only when the request fails | Entered values stay visible and connection loss is handled |

## Scope

**In scope:**

- Loader, navigation pending state, immediate sidebar selection and first-load fallbacks
- Sonner toasts, tested messages and shared failed-request handling
- Return-to-client success for create profile and change password
- `AGENTS.md` guidance for later features

**Out of scope:**

- Auth page loaders and browser back/forward loaders
- Toasts for sign-in, sign-up, sign-out, email requests and the onboarding name step
- Run-out dates in toasts, database changes and browser test setup

## Architecture / Approach

A root client provider runs navigation in a React transition and exposes its pending state. `PendingLink` starts navigation and `PendingRegion` swaps page content for `PageLoader`. Forms run saves through `runSaveAction`, which lets Next.js redirects through and handles failed requests, then show text from one tested messages module.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Page Loader and Navigation State | Loader on navigation and first load | Behaviour differs between development and production prefetching |
| 2. Toasts for In-Place Saves | Sonner, helpers and three medication toasts | A toast interaction closing an open dialog |
| 3. Toasts for Saves That Change Page | Profile and password toasts, name-step failure handling, project guidance | Changing the end of two server actions without breaking their redirects |

**Prerequisites:** local Supabase stack running for manual checks; Sonner can be installed.
**Estimated effort:** about 2–3 sessions across 3 phases.

## Open Risks & Assumptions

- The missing feedback on profile switching is inferred from code. The design does not depend on it, and Phase 1 verifies the result on a production build.
- Browser back/forward keeps current behaviour.
- A form submitted before JavaScript loads relies on React replaying it after hydration; without JavaScript, create profile and password change will not navigate on their own.

## Success Criteria (Summary)

- A profile switch never leaves the previous profile's medications readable while the new one loads.
- Each agreed save shows its exact toast once, while inline errors keep working.
- Lost connections and expired sessions are told apart correctly, and `npm run lint`, `npm test` and `npm run build` pass.
