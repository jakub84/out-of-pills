# Page Loaders and Save Toasts Implementation Plan

## Overview

Add a branded four-ring page loader for navigation and first load, and short toasts that confirm successful data changes. This is a UX improvement that supports the existing flows; it has no PRD requirement id of its own and needs no database change.

## Current State Analysis

- Profile switching only changes `?profile=` on `/`. The main content sits in one unkeyed `<Suspense>` (`src/app/(app)/page.tsx:42`), so the previous profile's medications are expected to stay visible until the new data arrives. This comes from reading the code and has not been observed at runtime.
- `/profiles/new` and both onboarding steps use `fallback={null}` (`src/app/(app)/profiles/new/page.tsx:19`, `src/app/onboarding/name/page.tsx:27`, `src/app/onboarding/profile/page.tsx:17`), so part of the page is blank while it loads.
- There is no toast system. `sonner` is not installed; the current version (2.0.8) accepts React 19 as a peer dependency.
- Add medication, add package and correct count already return `{ status: "success" }` to client wrappers (`src/components/medications/add-medication-dialog.tsx:104`, `src/components/medications/stock-dialog-parts.tsx:62`).
- `createProfile` and `updatePassword` finish with `redirect()` (`src/lib/profiles/actions.ts:91`, `src/app/(auth)/actions.ts:194`), so their forms never receive a success result.
- Server errors are already shown inside the dialog or form. A failed request (for example lost internet) is not handled, and the app has no `error.tsx`.

## Desired End State

- Clicking a profile, "Add new", Cancel or Back hides the current page content at once, and the recoloured loader fades in if loading takes longer than 150 ms. Header and sidebar stay in place, and the clicked profile is highlighted immediately.
- The main content, `/profiles/new` and both onboarding steps show the same loader on first load. The sidebar list and user avatar keep their small skeletons.
- These successful saves show a toast for about 4 seconds, bottom right on desktop and full width at the bottom on phones:

| Save | Toast |
| --- | --- |
| Add medication | `Aspirin added` |
| Add package | `+28 tabl. added to Aspirin` |
| Correct count | `Aspirin count set to 18 tabl.` |
| Create profile | `Profile Mom created` |
| Change password | `Password changed` |

- Server and validation errors stay inline. If the request itself fails, the user stays on the form and sees the error toast `Couldn't save. Check your connection and try again.`

### Key Discoveries:

- `useLinkStatus` skips its pending state for prefetched links (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-link-status.md:71`), so it cannot be the source of this loader.
- When a server action redirects, Next.js rejects the action promise on the client (`node_modules/next/dist/client/components/router-reducer/reducers/server-action-reducer.js:237-254`). Any catch around an action must rethrow Next.js control-flow errors.
- `SidebarMenuButton asChild` and `Button asChild` pass props and a ref to their child (`src/components/app-shell/profile-nav.tsx:52`, `src/components/profiles/profile-form.tsx:329`).
- The app is light-only (`src/app/globals.css:5`), so the toast needs no theme switching.
- The loader source is `loaders/Nawsome_young-goat-78.html` in the MIT-licensed `uiverse-io/galaxy` repository: four SVG circles, four keyframe sets, 2 s linear loop, 6em size.

## What We're NOT Doing

- No loader for links between sign-in, sign-up and forgot password, and no change to the reset page's `Loading…` fallback.
- No loader for browser back/forward, which this pending state cannot track.
- No toast for the onboarding name step, sign-in, sign-up, sign-out or email requests.
- No toast for server or validation errors that already appear inline.
- No replacement of the sidebar list and user avatar skeletons.
- No run-out date in toasts.
- No red or yellow in the loader: those colours mean urgency in this app.
- No database, RLS or run-out calculation change.
- No browser test setup; the project has no Playwright configuration yet.

## Implementation Approach

A single client provider in the root layout owns navigation through `useTransition`, because a transition stays pending until the destination is ready and does not depend on prefetch state. Links and post-save navigation go through it, and a region component swaps page content for the loader. Toast text and failed-request handling live in small `.ts` modules so they can be unit tested with the existing Node-based Vitest setup.

## Critical Implementation Details

- **Timing & lifecycle**: `runSaveAction` must call `unstable_rethrow` before handling a caught error. Otherwise an expired session, whose redirect arrives as a rejected action, would show the connection toast.
- **User experience spec**: a toast rendered while a modal is open must not close that modal when clicked or swiped, or the user loses what they entered.
- **Debug & observability**: verify navigation against `npm run build` and `npm start` with network throttling. Prefetching differs in `npm run dev`, so the development server is not sufficient evidence.

## Phase 1: Page Loader and Navigation State

### Overview

Deliver the loader and immediate navigation feedback across the signed-in app and onboarding.

### Changes Required:

#### 1. Loader component and animation

**File**: `src/components/navigation/page-loader.tsx`, `src/app/globals.css`

**Intent**: Port the Uiverse four-ring loader as a Server Component, recoloured with project tokens, and credit its source.

**Contract**: `PageLoader` renders a centred `role="status"` block with screen-reader text `Loading…`, fading in after a 150 ms delay. Rings use `stroke-primary`, `stroke-brand-ink`, `stroke-brand-subtle` and `stroke-primary/50`, with no hex colours. Geometry, keyframe values, 2 s duration and 6em size match the source. Under `prefers-reduced-motion` the SVG is hidden and `Loading…` becomes visible. A comment records `Adapted from Uiverse.io by Nawsome (MIT)`.

#### 2. Navigation pending state

**File**: `src/components/navigation/navigation-pending.tsx`, `src/app/layout.tsx`

**Intent**: Give links, regions and post-save code one shared view of the navigation in progress.

**Contract**: Client exports `NavigationPendingProvider`, `useNavigationPending()` returning `{ pending, pendingHref, navigate(href) }`, `PendingLink` and `PendingRegion`. `navigate` runs an optimistic `pendingHref` update and `router.push` in one transition. `PendingLink` forwards all props and its ref to `next/link`, calls the caller's `onClick`, leaves modified clicks, non-primary clicks and `target` links to the browser, and accepts `trackPending={false}`. `PendingRegion` keeps children mounted but hidden with a conditional `hidden` class while pending, and shows `PageLoader`. The provider must not read `useSearchParams`, so the root layout needs no new Suspense boundary.

#### 3. Connect navigation surfaces

**File**: `src/app/(app)/layout.tsx`, `src/app/onboarding/layout.tsx`, `src/components/app-shell/profile-nav.tsx`, `src/components/profiles/profile-form.tsx`

**Intent**: Use the pending state wherever these screens navigate, and show the destination profile as selected straight away.

**Contract**: `PendingRegion` wraps page children in `SidebarInset` and in the onboarding column. Profile rows, "Add new" and the form's back link use `PendingLink`. The already selected profile uses `trackPending={false}`. `ProfileNav` derives its selection and "Add new" active state from `pendingHref` while pending. The existing sheet close on click stays.

#### 4. First-load fallbacks

**File**: `src/app/(app)/page.tsx`, `src/app/(app)/profiles/new/page.tsx`, `src/app/onboarding/name/page.tsx`, `src/app/onboarding/profile/page.tsx`

**Intent**: Use the same loader wherever main content loads.

**Contract**: These `<Suspense>` fallbacks become `<PageLoader />`, and `SelectedProfileSkeleton` is removed. Sidebar, user menu and onboarding header fallbacks do not change.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Unit tests pass: `npm test`
- Production build passes: `npm run build`

#### Manual Verification:

- On a throttled production build, switching profile hides the old medications at once and shows the loader while the sidebar highlights the clicked profile
- A fast profile switch shows no loader flash
- Clicking the already selected profile shows no loader
- Add new, Cancel and onboarding Back show the loader on slow connections
- Refreshing `/`, `/profiles/new` and both onboarding steps shows the loader in the content area while sidebar and avatar skeletons remain
- The rings use only teal, ink and grey, and the page has no horizontal scroll at phone width
- With reduced motion enabled, `Loading…` is shown instead of the animation
- Ctrl/Cmd-click on a profile opens a new tab and leaves the current page visible

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Toasts for In-Place Saves

### Overview

Add the toast system, tested helpers and confirmation for the three medication saves.

### Changes Required:

#### 1. Toast component

**File**: `package.json`, `package-lock.json`, `src/components/ui/sonner.tsx`, `src/app/layout.tsx`

**Intent**: Add Sonner through shadcn and mount it once, so toasts survive dialogs closing and page changes.

**Contract**: `Toaster` uses `theme="light"`, `position="bottom-right"`, a 4000 ms duration and project tokens. Remove any `next-themes` usage from the generated file and do not add that dependency. Long medication names wrap inside the toast.

#### 2. Toast messages

**File**: `src/lib/feedback/messages.ts`, `src/lib/feedback/messages.test.ts`

**Intent**: Keep all wording in one tested place.

**Contract**: Pure functions return exactly: `{name} added`; `+{tablets} tabl. added to {name}`; `{name} count set to {tablets} tabl.`; `Profile {name} created`; `Password changed`; and the connection message `Couldn't save. Check your connection and try again.` Tablet amounts use `formatTablets`, including halves.

#### 3. Failed-request wrapper

**File**: `src/lib/feedback/run-save-action.ts`, `src/lib/feedback/run-save-action.test.ts`

**Intent**: Handle failed requests the same way in every form without swallowing Next.js navigation.

**Contract**: `runSaveAction<S>(call: () => Promise<S>, failedState: S): Promise<S>` returns the action result. On a caught error it calls `unstable_rethrow`, shows the connection toast and returns `failedState`. Tests cover a normal result, a network error and a Next.js redirect error.

#### 4. Medication saves

**File**: `src/components/medications/add-medication-dialog.tsx`, `src/components/medications/stock-dialog-parts.tsx`, `src/components/medications/add-package-dialog.tsx`, `src/components/medications/correct-count-dialog.tsx`

**Intent**: Confirm successful saves and keep the dialog usable when the request fails.

**Contract**: The three actions run through `runSaveAction`. On success the wrappers toast and then close the dialog. `useStockForm` gains `successMessage: (tablets: number) => string`; the tablets come from the submitted form. A failed request leaves the dialog open with its values.

#### 5. Toasts and open dialogs

**File**: `src/components/ui/dialog.tsx`

**Intent**: Stop interaction with a toast from counting as a click outside a modal.

**Contract**: `DialogContent` ignores outside-interaction events whose target is inside `[data-sonner-toaster]`, then still calls any handler passed by the caller.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Unit tests pass, including `messages.test.ts` and `run-save-action.test.ts`: `npm test`
- Production build passes: `npm run build`

#### Manual Verification:

- Add medication, add package and correct count each close the dialog, update the page and show the agreed toast once
- Toasts appear bottom right on desktop and full width at the bottom on a phone, then disappear after about 4 seconds
- A stale-stock or validation error stays inline, with no toast
- With the network offline, saving shows the connection toast and the dialog keeps its values
- Clicking or swiping that toast does not close the dialog
- A screen reader announces the success toast

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Toasts for Saves That Change Page

### Overview

Let the client finish the two redirecting saves so it can confirm them, cover the remaining failed-request path and record the pattern for later features.

### Changes Required:

#### 1. Create profile

**File**: `src/lib/profiles/form-state.ts`, `src/lib/profiles/actions.ts`, `src/components/profiles/profile-form.tsx`

**Intent**: Confirm a new profile and then open it, during onboarding and from the app.

**Contract**: `ProfileFormState` gains `status: "success"` and `profileId?: string`. `createProfile` keeps `revalidatePath("/", "layout")` and returns `{ status: "success", profileId }` instead of its final redirect. The redirects for error codes `P0001` and `42501` stay. `ProfileForm` wraps the action with `runSaveAction`, toasts the trimmed submitted name, calls `navigate` to `/?profile=<encoded id>` and keeps submit disabled after success.

#### 2. Change password

**File**: `src/app/(auth)/actions.ts`, `src/app/reset-password/_components/reset-password-form.tsx`

**Intent**: Confirm the new password before returning to the app.

**Contract**: `updatePassword` returns `{ status: "success" }` instead of `redirect("/")`. The session check through `getCurrentUser()` stays. The form uses `runSaveAction`, toasts `Password changed`, calls `navigate("/")` and keeps submit disabled after success.

#### 3. Onboarding name failures

**File**: `src/app/onboarding/_components/display-name-form.tsx`

**Intent**: Give this save the same failed-request handling without adding a success toast.

**Contract**: The action runs through `runSaveAction`; `failedState` keeps the submitted `displayName`. The success path remains the server redirect.

#### 4. Project guidance

**File**: `AGENTS.md`

**Intent**: Make later features, including edit and delete, use the same feedback.

**Contract**: Add `src/components/navigation/` and `src/lib/feedback/` to Project Structure. Add a rule that successful data changes show a toast from `src/lib/feedback/messages.ts`, run through `runSaveAction`, and keep server errors inline; in-app navigation that should show the loader uses `PendingLink` or `navigate`.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Unit tests pass: `npm test`
- Production build passes: `npm run build`

#### Manual Verification:

- Creating a profile from the app shows `Profile <name> created`, the loader if needed, and then the new profile selected
- Creating the first profile in onboarding shows the toast and lands on the main screen
- Validation errors on the profile form stay inline with entered values kept
- Skipped-name and signed-out profile paths still redirect correctly with no connection toast
- A password reset shows `Password changed` and lands on the main screen
- An expired session during a medication save redirects to sign-in with no connection toast
- Offline saves on the profile, password and onboarding name forms show the connection toast and stay on the form
- The onboarding name step shows no success toast

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

- Every toast message, including whole and half tablet amounts.
- `runSaveAction`: returned result, network failure with toast and failed state, and a redirect error rethrown with no toast.

### Integration Tests:

- None added. The project has no component or browser test setup, and adding one is outside this change.

### Manual Testing Steps:

1. Run the local Supabase stack, then `npm run build` and `npm start`.
2. Throttle the network in browser developer tools and switch between two profiles that have different medications.
3. Run each save on desktop and at phone width, then repeat with the network offline.
4. Walk through onboarding with a new account, and complete a password reset through the local Mailpit link.

## Performance Considerations

Sonner is the only new runtime dependency. The loader is inline SVG and CSS. Hidden page content stays mounted only during navigation.

## Migration Notes

No data migration. A deployment only changes application code, and `createProfile` and `updatePassword` change together with their forms. A tab left open on the previous version may need a refresh after deployment.

## References

- Change notes: `context/changes/loaders-and-toasts/change.md`
- Loader source: `https://uiverse.io/Nawsome/young-goat-78`, code from `https://github.com/uiverse-io/galaxy/blob/main/loaders/Nawsome_young-goat-78.html`
- Existing save pattern: `src/components/medications/stock-dialog-parts.tsx:62`
- Next.js docs: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-link-status.md`, `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/unstable_rethrow.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Page Loader and Navigation State

#### Automated

- [x] 1.1 Lint passes: `npm run lint` — 77df296
- [x] 1.2 Unit tests pass: `npm test` — 77df296
- [x] 1.3 Production build passes: `npm run build` — 77df296

#### Manual

- [x] 1.4 On a throttled production build, switching profile hides the old medications at once and shows the loader while the sidebar highlights the clicked profile — 77df296
- [x] 1.5 A fast profile switch shows no loader flash — 77df296
- [x] 1.6 Clicking the already selected profile shows no loader — 77df296
- [x] 1.7 Add new, Cancel and onboarding Back show the loader on slow connections — 77df296
- [x] 1.8 Refreshing `/`, `/profiles/new` and both onboarding steps shows the loader in the content area while sidebar and avatar skeletons remain — 77df296
- [x] 1.9 The rings use only teal, ink and grey, and the page has no horizontal scroll at phone width — 77df296
- [x] 1.10 With reduced motion enabled, `Loading…` is shown instead of the animation — 77df296
- [x] 1.11 Ctrl/Cmd-click on a profile opens a new tab and leaves the current page visible — 77df296

### Phase 2: Toasts for In-Place Saves

#### Automated

- [x] 2.1 Lint passes: `npm run lint` — 33f025b
- [x] 2.2 Unit tests pass, including `messages.test.ts` and `run-save-action.test.ts`: `npm test` — 33f025b
- [x] 2.3 Production build passes: `npm run build` — 33f025b

#### Manual

- [x] 2.4 Add medication, add package and correct count each close the dialog, update the page and show the agreed toast once — 33f025b
- [x] 2.5 Toasts appear bottom right on desktop and full width at the bottom on a phone, then disappear after about 4 seconds — 33f025b
- [x] 2.6 A stale-stock or validation error stays inline, with no toast — 33f025b
- [x] 2.7 With the network offline, saving shows the connection toast and the dialog keeps its values — 33f025b
- [x] 2.8 Clicking or swiping that toast does not close the dialog — 33f025b
- [x] 2.9 A screen reader announces the success toast — 33f025b

### Phase 3: Toasts for Saves That Change Page

#### Automated

- [x] 3.1 Lint passes: `npm run lint` — ce6dea1
- [x] 3.2 Unit tests pass: `npm test` — ce6dea1
- [x] 3.3 Production build passes: `npm run build` — ce6dea1

#### Manual

- [x] 3.4 Creating a profile from the app shows `Profile <name> created`, the loader if needed, and then the new profile selected — ce6dea1
- [x] 3.5 Creating the first profile in onboarding shows the toast and lands on the main screen — ce6dea1
- [x] 3.6 Validation errors on the profile form stay inline with entered values kept — ce6dea1
- [x] 3.7 Skipped-name and signed-out profile paths still redirect correctly with no connection toast — ce6dea1
- [x] 3.8 A password reset shows `Password changed` and lands on the main screen — ce6dea1
- [x] 3.9 An expired session during a medication save redirects to sign-in with no connection toast — ce6dea1
- [x] 3.10 Offline saves on the profile, password and onboarding name forms show the connection toast and stay on the form — ce6dea1
- [x] 3.11 The onboarding name step shows no success toast — ce6dea1
