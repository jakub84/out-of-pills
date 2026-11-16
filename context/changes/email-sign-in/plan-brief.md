# Email Sign-in — Plan Brief

> Full plan: `context/changes/email-sign-in/plan.md`

## What & Why

Roadmap S-01 (FR-001): a caregiver can create an account with email + password, confirm it by email, sign in, reset a forgotten password and sign out, landing on an empty main screen only signed-in users can reach. It is the first step on the only path to the north star (S-03), and it establishes how every later slice talks to Supabase and checks who is signed in.

## Starting Point

An untouched create-next-app scaffold (Next.js 16, `cacheComponents` on). No Supabase dependency, no `.env.example`, no proxy, no tables, no test runner.

## Desired End State

Locally (`npx supabase start` + `npm run dev`), a visitor is sent to `/sign-in`, can sign up, confirm via the email caught in Mailpit, see "Signed in as …" with an empty "No profiles yet" state on `/`, sign out, and reset a password. Production has a Supabase cloud project with the same policy and Resend SMTP on the user's own domain; the end-to-end production check finishes once F-01 deploys.

## Key Decisions Made

| Decision                  | Choice                                          | Why (1 sentence)                                                                 |
| ------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------- |
| Email confirmation        | Required                                        | User's choice: verified addresses, useful for later sharing and notifications.   |
| Unconfirmed sign-in       | "Confirm your email first" + Resend link        | Nobody gets stuck when the mail went to spam or the link expired.               |
| Password reset            | In this slice                                   | User's choice: complete basic account lifecycle now.                             |
| Password policy           | Min 8 chars, letters and digits                 | User's choice; enforced in Supabase and mirrored in the forms.                   |
| Dev environment           | Local Supabase via CLI + Docker; cloud for prod | Full dev/prod isolation; local emails land in Mailpit.                           |
| Production SMTP           | Resend with the user's own domain               | Supabase's default SMTP only reaches team members; best deliverability.          |
| UI language               | English                                         | Portfolio readable by anyone; matches PRD and code.                              |
| Verification              | build + lint + manual checklist                 | No test runner yet; unit tests arrive with S-03's calculation logic.            |
| Email link flow           | `token_hash` → `/auth/confirm` route handler    | Works even when the link is opened in another browser.                          |
| Enumeration               | Neutral messages on sign-up and reset           | Never reveal whether an email has an account.                                    |

## Scope

**In scope:** sign up, email confirmation, resend confirmation, sign in, sign out, forgot/reset password, protected empty main screen, `proxy.ts` session refresh, server Supabase helper + Data Access Layer, local Supabase config + templates, production auth + SMTP configuration, docs (AGENTS.md, README).

**Out of scope:** Google sign-in (S-04), profiles and any tables/RLS (S-02), deploy pipeline (F-01), browser Supabase helper, account deletion / email change / MFA, automated tests, i18n.

## Architecture / Approach

`src/proxy.ts` refreshes the Supabase session cookie on every request and does optimistic redirects (signed-out → `/sign-in`, signed-in away from auth pages). The authoritative check is `getCurrentUser()` in `src/lib/auth/dal.ts`, called inside `<Suspense>` (required by Cache Components) and at the start of every action needing a user. Mutations are Server Actions; forms are small client components with `useActionState`. Email templates link to `/auth/confirm`, which calls `verifyOtp` and redirects to a sanitised `next`.

## Phases at a Glance

| Phase                                      | What it delivers                                              | Key risk                                                       |
| ------------------------------------------ | ------------------------------------------------------------- | -------------------------------------------------------------- |
| 1. Local Supabase and client wiring        | Local auth stack, helpers, proxy, DAL, docs                    | Cookie handling in proxy / Cache Components build errors       |
| 2. Sign up, confirm, sign in, sign out     | FR-001 user flow + protected empty main screen                 | Error mapping and no-enumeration behaviour                     |
| 3. Password reset                          | Forgot password → email → new password → signed in            | Recovery session vs proxy redirects on `/reset-password`       |
| 4. Production auth configuration           | Cloud project, Resend SMTP, templates, env                     | DNS verification; final check waits for F-01                   |

**Prerequisites:** Docker Desktop installed; a free Supabase slot (you have 1 of 2 in use); a domain you control for Resend; F-01 for the final production check.
**Estimated effort:** ~3–4 working sessions across 4 phases (Phase 4 partly waits on DNS propagation and F-01).

## Open Risks & Assumptions

- Assumes you own a domain whose DNS you can edit (Resend decision); without it, Phase 4 SMTP falls back to another provider.
- Docker Desktop on Windows must run reliably; if not, switching dev to the cloud project is a config-only change.
- Free Supabase projects pause after a week of inactivity — sign-in on production stops until resumed.
- Preview deployments cannot complete email links (Site URL points at production) — acceptable for v1.

## Success Criteria (Summary)

- A new user can sign up, confirm by email and reach their (empty) main screen; signed-out visitors cannot.
- A user who forgot their password can reset it by email and sign in again.
- `npm run build` and `npm run lint` pass; no secrets committed.
