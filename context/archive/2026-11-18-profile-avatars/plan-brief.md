# Profile Avatars — Plan Brief

> Full plan: `context/changes/profile-avatars/plan.md`

## What & Why

Caregivers can optionally choose a ready-made portrait when creating a profile (FR-021, S-11). It makes profiles easier to recognise, without storing personal photos.

## Starting Point

A profile has a name, a type and a colour, and appears as a 24 px coloured circle with its first letter on the profile list. One form serves onboarding and `/profiles/new`. Profiles cannot be edited yet.

## Desired End State

The profile form offers an optional avatar grid that follows the selected profile type. A chosen avatar appears at 32 px on the list and larger beside the name on the main screen, framed by the profile colour. Profiles without one, including all existing profiles, show their letter in the same places.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Avatar type | Supplied portrait images, no upload | Generic images avoid storing personal photos |
| Required? | Optional, "No avatar" selected by default | Creating a profile stays as quick as today |
| Me | Woman, man | Matches the profile type |
| Parent | Mom, dad, grandma, grandpa | Matches "mom, dad, grandparents" |
| Child | Son, daughter | Matches "son, daughter" |
| Someone else | Woman, man, grandma, grandpa, cat, dog | Covers partners and others in care |
| Picker | Always-visible grid below name and colour | Easy to discover and needs no click to skip |
| Colour | Kept, shown as a frame around the avatar | Profiles with the same avatar stay distinguishable |
| Display | 32 px on the list, larger on the main screen | Portraits are hard to read at 24 px |
| `man` image | Cropped to the face | Hides the "COMMANDO" tag and bottom lettering |
| Changing later | Delivered with S-08 (FR-022) | One profile-editing flow instead of two |
| Type change in form | Selection returns to "No avatar" | An avatar from another type cannot be submitted |

## Scope

**In scope:**

- Avatar catalogue per profile type, in code and in the database
- 10 web-sized images in `public/avatars/`
- Avatar on the profile list and main screen
- Picker in onboarding and on `/profiles/new`

**Out of scope:**

- Photo upload
- Changing an avatar or adding one to an existing profile (S-08)
- Demo-mode avatars (S-10)

## Architecture / Approach

`profiles` gains a nullable `avatar` column with a constraint tying it to `kind`. The existing `create_profile` stays for profiles without an avatar and for older deployed code; a four-argument overload handles profiles with one. A shared `ProfileAvatar` component renders either the image in a colour frame or the letter on the colour.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Avatar Catalogue and Database | Per-type rules, migration, tests | Breaking the deployed `create_profile` call |
| 2. Avatar Images and Display | Images, shared component, list and main screen | Layout at 375 px and in the collapsed sidebar |
| 3. Avatar Picker and Release | Form, validation, docs, migration push, PR | Pushing the migration after the preview needs it |

**Prerequisites:** Docker and the local Supabase stack; the source images in `avatars 2.0`.
**Estimated effort:** About one working session across 3 phases.

## Open Risks & Assumptions

- The user has the right to use the supplied images in the app.
- Existing profiles keep their letter until S-08 adds avatar editing.
- S-11 adds work before the 2026-11-27 deadline and moves the remaining slices back.

## Success Criteria (Summary)

- A caregiver can create a profile with or without an avatar, in onboarding and on `/profiles/new`.
- Each profile type offers only its avatars, and the server and database reject any other value.
- Existing profiles and the currently deployed code keep working.
