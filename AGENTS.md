# Repository Guidelines

Out of Pills is a web app where caregivers track how many pills are left per profile and when each medication runs out. Stack: Next.js 16 (App Router, TypeScript, Tailwind v4) on Vercel, with Supabase (Postgres + Auth) as the planned backend — see @context/foundation/tech-stack.md.

## Hard Rules

- Medication data is private to its caregiver. Every Supabase table gets Row Level Security enabled in the same migration that creates it, with policies scoped to `auth.uid()`. Never import the service-role key into code that can reach the browser.
- Access Supabase only through `@supabase/ssr` clients (one server, one browser helper); no direct `@supabase/supabase-js` clients in components.
- Server Components by default. Add `"use client"` only to files that use state, effects, or event handlers.
- The run-out date must never be later than the real one: round calculations toward the earlier date. Urgency colours: red ≤ 14 days, yellow ≤ 30, green above (@context/foundation/prd.md, Business Logic).
- Demo mode ("Try without signing in") never writes to Supabase.
- Commit `.env.example` only; never `.env` or `.env.local`.
- Do not run `npm audit fix --force` — it downgrades ESLint and eslint-config-next.

## Project Structure

- `src/app/` — App Router routes, layouts, `globals.css`. Import via the `@/*` alias (maps to `src/*`).
- `public/` — static assets.
- `context/foundation/` — living product docs: `prd.md` (requirements, FR-xxx ids), `tech-stack.md`. Edit in place.
- `context/changes/<change-id>/` — per-change research and plans. `context/archive/` is read-only.

## Commands

- `npm run dev` — dev server on http://localhost:3000.
- `npm run build` — production build; must pass before a PR.
- `npm run lint` — ESLint; must pass before a PR.

No test runner or CI workflow exists yet; GitHub Actions with auto-deploy to Vercel on merge to `main` is planned.

## Coding Style

- TypeScript `strict` (@tsconfig.json); no `any` without a comment explaining why.
- Lint rules: `next/core-web-vitals` + `next/typescript` (@eslint.config.mjs).
- Style with Tailwind utility classes; Tailwind is wired through Turbopack in @next.config.ts, which also enables `cacheComponents`.
- Reference PRD requirement ids (e.g. `FR-014`) in plans and PR descriptions.

## Commits & Pull Requests

- Commit subjects: imperative, sentence case, no type prefix (e.g. `Add tech stack selection: Next.js + Supabase on Vercel`).
- Branches: `<area>/<slug>` (e.g. `setup/init-app`); open PRs against `main`.
