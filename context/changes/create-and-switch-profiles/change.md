---
change_id: create-and-switch-profiles
title: Create and switch profiles
status: implemented
created: 2026-11-16
updated: 2026-11-16
archived_at: null
---

## Notes

### Decisions made during Phase 3 testing (apply in Phase 4)

These override the plan where they differ.

- **Profile name starts empty.** `ProfileForm` no longer defaults the name to the caregiver's name, and picking "For me" doesn't fill it. The caregiver's name is still offered as a chip. The plan's "Defaults: name = user's name" is superseded; `/profiles/new` inherits this.
- **No dotted left rule** in the onboarding column. User removed it; don't add it to other screens.
- **Header shadow per mock `162:77` / `164:176`.** Tokens `--header-shadow` (`shadow-header`) and `--header-border` (`border-header-border`) in `globals.css`. The shadow is cast by a taller `::before` layer (`before:-top-12 … before:shadow-header`) so the band is as dark as the 108px mock shape. See `src/app/onboarding/layout.tsx`, and reuse the same header on the main screen.
- **Sign out in the onboarding header.** Signed-in users can't reach `/sign-in`, so every signed-in layout needs a way out. The main screen's avatar menu covers this in Phase 4.
- **`getCurrentUser()` calls `await connection()`** before `getClaims()`. With `partialPrefetching`, Next.js otherwise rejects the clock read (`Date.now()`) in the session check during dev prerendering. `npm run build` does not catch this, so check the dev server terminal.
- **Avatar swatches**: the colour fills the whole circle, and the selected one gets `ring-[3px] ring-primary ring-offset-2`. The radio input is an invisible overlay (`absolute inset-0 opacity-0`), not `sr-only`.
- New token `--primary-tint` (`bg-primary-tint`) is used for selected type cards; reuse it for the selected sidebar profile.
- Server actions live in `src/lib/profiles/actions.ts`; `createProfile` is reusable by `/profiles/new`.
- Phase 3 progress SHA write-back (`4488c86`) is uncommitted in `plan.md` and goes into the Phase 4 commit.
