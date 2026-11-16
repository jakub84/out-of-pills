---
bootstrapped_at: 2026-11-04T10:31:45Z
starter_id: next
starter_name: Next.js
project_name: out-of-pills
language_family: js
package_manager: npm
cwd_strategy: subdir-then-move
bootstrapper_confidence: verified
phase_3_status: ok
audit_command: npm audit --json
---

## Hand-off

```yaml
starter_id: next
package_manager: npm
project_name: out-of-pills
hints:
  language_family: js
  team_size: solo
  deployment_target: vercel
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: verified
  path_taken: custom
  quality_override: false
  self_check_answers:
    typed: true
    from_official_starter: true
    conventions: false
    docs_current: true
    can_judge_agent: false
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
```

### Why this stack

Out of Pills is a small-scale web app with a 3-week MVP built solo, and its only technology-forcing feature in v1 is authentication (email + password and Google sign-in, FR-001/FR-002) with strict per-caregiver data privacy. The user explicitly chose Next.js (App Router, TypeScript, Tailwind) for the frontend over the registry default Astro starter; Next.js passes all four agent-friendly gates and has verified bootstrapper support, which suits the short timeline. Because create-next-app ships no auth or database, the backend layer is Supabase (Postgres + Supabase Auth with Google OAuth, integrated via @supabase/ssr), with Row Level Security enforcing that medication data is visible only to the profile's caregiver. Deployment targets Vercel, the native host for Next.js, with GitHub Actions and auto-deploy on merge to main. The self-check flagged two gaps (familiarity with conventions and judging agent output), so the generated CLAUDE.md should spell out Next.js/Supabase conventions: server components by default, "use client" only for interactivity, Supabase access only through @supabase/ssr clients, and RLS on every table.

## Pre-scaffold verification

| Signal      | Value                                        | Severity | Notes                                               |
| ----------- | -------------------------------------------- | -------- | --------------------------------------------------- |
| npm package | create-next-app v16.4.5 published 2026-11-03 | fresh    | resolved from cmd_template                          |
| GitHub repo | not run                                      | —        | card docs_url (https://nextjs.org/docs) is not a GitHub URL |

Local toolchain at run time: Node v26.8.2, npm 12.0.2.

## Scaffold log

**Resolved invocation**: `npx create-next-app@latest bootstrap-scaffold --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes` (run with `CI=1`)
**Strategy**: subdir-then-move
**Exit code**: 0
**Files moved**: 8 top-level entries (eslint.config.mjs, next-env.d.ts, next.config.ts, package.json, public/, README.md, src/, tsconfig.json; 9 files under src/ + public/)
**Conflicts (.scaffold siblings)**: none
**.gitignore handling**: append-merged (10 de-duplicated lines under `# from next`)
**.bootstrap-scaffold cleanup**: deleted (temp dir was `bootstrap-scaffold/`, see deviations)

### Deviations from the standard flow

1. **First attempt failed (exit 1), nothing written.** `create-next-app .bootstrap-scaffold ...` was rejected: `Could not create a project called ".bootstrap-scaffold" because of npm naming restrictions: name cannot start with a period`. With user approval, retried with a dot-free temp dir `bootstrap-scaffold`.
2. **create-next-app's dependency install failed but the CLI exited 0.** npm 12 rejected the CLI's install invocation: `npm error code EALLOWSCRIPTS — --allow-scripts is not allowed in project-scoped installs. Add the entries to the "allowScripts" field in package.json, or to .npmrc, instead.` Project files were fully generated; only `node_modules` was missing. After move-up, a plain `npm install` was run: exit 0, 359 packages added.
3. **package.json `name`** was changed from `bootstrap-scaffold` (temp dir artifact) to `out-of-pills` (hand-off `project_name`).
4. **.gitignore merge** was reconstructed from the official `create-next-app@16.4.5` template (`dist/templates/app-tw/ts/gitignore`) after the first merge attempt failed on a temp-file path; the scaffold's own copy had been removed. Contents are identical to what the CLI ships.
5. **Smoke test**: `npm run build` passed (routes `/` and `/_not-found`, static).

### Notes for the user

- Resolved after the run: the appended `.env*` line (which re-ignored `.env.example`) was removed from the `# from next` block; the existing `.env` / `.env.*` / `!.env.example` rules already cover it.

## Post-scaffold audit

**Tool**: npm audit --json (exit 1, informational)
**Summary**: 0 CRITICAL, 0 HIGH, 16 MODERATE, 0 LOW
**Direct vs transitive**: 0/0/2/0 direct of total 0/0/16/0 (direct: `eslint`, `eslint-config-next`; both devDependencies)

All 16 entries trace back to a single root advisory in the dev-only lint toolchain; nothing in the production dependency tree (`next`, `react`, `react-dom`) is affected.

#### CRITICAL findings

None.

#### HIGH findings

None.

#### MODERATE findings

- **minimatch** `<11.0.1` — GHSA-g3hv-75wg-m249, "minimatch has potential denial of service via globparts amplification". Root cause of every other entry below.
- Affected via the chain (all moderate, all dev-only): `eslint` (direct), `eslint-config-next` (direct), `@eslint-community/eslint-utils`, `@eslint/config-array`, `@eslint/eslintrc`, `@next/eslint-plugin-next`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `@typescript-eslint/type-utils`, `@typescript-eslint/typescript-estree`, `@typescript-eslint/utils`, `typescript-eslint`, `eslint-plugin-import`, `eslint-plugin-jsx-a11y`, `eslint-plugin-react`.
- npm's suggested fix (`npm audit fix --force`) would **downgrade** to `eslint@4.0.0` / `eslint-config-next@0.2.4` — do not apply it. Wait for upstream ESLint/plugin releases that pull `minimatch >= 11.0.1`, or add an `overrides` entry for minimatch if you want to clear it sooner.

#### LOW / INFO findings

None.

## Hints recorded but not acted on

| Hint                    | Value                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| bootstrapper_confidence | verified                                                                                      |
| quality_override        | false                                                                                         |
| path_taken              | custom                                                                                        |
| self_check_answers      | typed: true, from_official_starter: true, conventions: false, docs_current: true, can_judge_agent: false |
| team_size               | solo                                                                                          |
| deployment_target       | vercel                                                                                        |
| ci_provider             | github-actions                                                                                |
| ci_default_flow         | auto-deploy-on-merge                                                                          |
| has_auth                | true                                                                                          |
| has_payments            | false                                                                                         |
| has_realtime            | false                                                                                         |
| has_ai                  | false                                                                                         |
| has_background_jobs     | false                                                                                         |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep.
- Address audit findings per your project's risk tolerance — the full breakdown is in this log.
