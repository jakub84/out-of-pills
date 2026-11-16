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
- `src/proxy.ts` — Next.js Proxy (formerly Middleware): refreshes the Supabase session and does optimistic auth redirects.
- `src/lib/supabase/` — `@supabase/ssr` helpers: `server.ts` (Server Components, Server Actions, Route Handlers) and `proxy.ts` (session refresh); the browser helper is added when first needed.
- `src/lib/auth/dal.ts` — `getCurrentUser()`, the authoritative signed-in check; call it inside `<Suspense>`, never in `use cache`.
- `supabase/` — local Supabase project: `config.toml` (auth policy), `templates/` (auth emails), later `migrations/`.
- `public/` — static assets.
- `context/foundation/` — living product docs: `prd.md` (requirements, FR-xxx ids), `tech-stack.md`. Edit in place.
- `context/changes/<change-id>/` — per-change research and plans. `context/archive/` is read-only.

## Commands

- `cp .env.example .env.local` — then fill in the publishable key from `npx supabase status`.
- `npx supabase start` / `npx supabase stop` — local Supabase stack (requires Docker Desktop running). API on http://127.0.0.1:55321, Studio on http://127.0.0.1:55323, Mailpit (auth emails) on http://127.0.0.1:55324.
- `npm run dev` — dev server on http://localhost:3000.
- `npm run build` — production build; must pass before a PR.
- `npm run lint` — ESLint; must pass before a PR.

No test runner exists yet. CI is `.github/workflows/ci.yml`: every PR runs `Lint and build` and gets a Vercel preview (URL commented on the PR); a merge to `master` deploys staging automatically, then production after approval in the `production` environment. Vercel deploys only from Actions (`vercel.json` disables Git deploys); Node is pinned by `engines.node` in `package.json`.

## Coding Style

- TypeScript `strict` (@tsconfig.json); no `any` without a comment explaining why.
- Lint rules: `next/core-web-vitals` + `next/typescript` (@eslint.config.mjs).
- Style with Tailwind utility classes; Tailwind is wired through Turbopack in @next.config.ts, which also enables `cacheComponents`.
- Reference PRD requirement ids (e.g. `FR-014`) in plans and PR descriptions.

## Commits & Pull Requests

- Commit subjects: imperative, sentence case, no type prefix (e.g. `Add tech stack selection: Next.js + Supabase on Vercel`).
- Branches: `<area>/<slug>` (e.g. `setup/init-app`); open PRs against `master`.
- `master` accepts changes only through a PR with a green `Lint and build` check (don't rename that job). Production deploys need a manual approval in GitHub Actions.
