---
change_id: profile-avatars
title: Add avatars when creating a profile
status: archived
created: 2026-11-18
updated: 2026-11-18
archived_at: 2026-11-18T16:17:14Z
---

## Notes

oopcja dodawania avatarów przy tworzeniu profilu

Decision (2026-11-18): avatars are optional ready-made portraits that depend on the profile type, framed by the existing colour. No photo upload.

Added at the user's request during implementation (2026-11-18), beyond the plan:

- Picker without cards or visible labels; the selected avatar gets a ring. Colours sit below the name, and swatches match the avatars at 64 px.
- The main-screen avatar is square.
- The header illustration follows the profile's most urgent medication: happy for green or none, poor for yellow, very sad for red or ran out.
- A red dot on sidebar avatars marks profiles with a red or ran-out medication. A yellow dot was tried and removed.

Accepted in the implementation review: the dot can lag past midnight in a long-open tab; revisit with S-09.
