# Deploy Pipeline Implementation Plan

## Overview

Roadmap F-01 (`deploy-pipeline`): put the repo on GitHub and add one GitHub Actions workflow that lints and builds every pull request, deploys a Vercel preview for each PR, deploys a staging (preview) build on every merge to `master`, and deploys production to `*.vercel.app` only after a manual approval in the GitHub Environment `production`. This unblocks S-01 Phase 4 (production auth URLs and the real-inbox checklist), S-04 (stable Google callback URL) and testing every later slice on real mobile browsers (NFR: browsers).

## Current State Analysis

- No git remote. `master` ends at `5576fe9` (PRD only); all S-01 work (`b54300d`..`f43a10a`) lives only on `setup/init-app`.
- No `.github/`, no `vercel.json`, no Node version pin. Local Node is 26.x; `package.json` has no `engines`.
- The app reads exactly two env vars, both public: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`src/lib/supabase/server.ts:15-16`, `src/lib/supabase/proxy.ts:24-25`). CI has no `.env.local`, so the CI build needs placeholder values.
- Auth emails build their links from `{{ .SiteURL }}` (`supabase/templates/confirmation.html:5`; `src/app/(auth)/actions.ts:144` passes no `redirectTo`). Any deployment, preview included, therefore sends email links to the production URL.
- `README.md` "Production (Supabase cloud)" step 5 already anticipates this change (Supabase URL config + Vercel env vars). S-01 plan Progress 4.1–4.3 are open; 4.3 waits for this change.
- `.gitignore` already ignores `.vercel/` and `.env.*` (except `.env.example`).
- `AGENTS.md` says "No test runner or CI workflow exists yet; GitHub Actions with auto-deploy to Vercel on merge to `master` is planned" — becomes stale after this change.

## Desired End State

- Public GitHub repo with `master` protected: changes land only through a PR whose "Lint and build" check is green; no force pushes.
- Every PR gets: lint + build check, a Vercel preview deployment, and a PR comment with its URL.
- Every merge to `master`: lint + build, an automatic staging (preview) deployment, then a production job that waits for "Approve" in the `production` environment and deploys to `https://<project>.vercel.app`.
- Vercel deploys only from GitHub Actions (Git integration disabled).
- Supabase Site URL / Redirect URLs point at production; S-01 Phase 4 checklist passes on the production URL with a real inbox.

Verify: open a trivial PR → see green check + preview comment; merge → staging URL in run summary → approve → production URL serves the new build.

### Key Discoveries:

- Only public env vars exist, so CI placeholders are safe and no app secret ever enters GitHub (`src/lib/supabase/server.ts:15`).
- Email links use SiteURL, so previews sharing the production Supabase project still send users to production for confirm/reset — acceptable, documented (`supabase/templates/confirmation.html:5`).
- Branch protection / rulesets are free only on public repos — the reason the repo is public.

## What We're NOT Doing

- No custom domain (stays `*.vercel.app`); no separate staging Supabase project — previews and staging use the production Supabase project.
- No `prod` release branch; release gating is the environment approval on `master`.
- No Vercel Git integration (no Vercel bot comments, no Vercel-side builds).
- No test runner, E2E, or database migrations in CI (no tests exist yet; migrations arrive with S-02).
- No changes to app code or auth behaviour; no Supabase preview-URL redirect wildcards (email links go to SiteURL anyway).
- No preview deploys for PRs from forks (secrets unavailable; solo repo).

## Implementation Approach

Three steps, each ending in an observable state. First get the existing work onto GitHub `master` through a plain PR (no CI exists yet). Then build the pipeline on its own branch `infra/deploy-pipeline`, so the PR that introduces the workflow is also its first test. Finally merge it, approve the first production deploy, lock `master`, and point Supabase at the production URL to close S-01.

Deploys use the Vercel CLI's prebuilt flow (`vercel pull` → `vercel build` → `vercel deploy --prebuilt`), authenticated by `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` GitHub secrets. Vercel holds the real `NEXT_PUBLIC_*` values per Vercel environment (Preview, Production); `vercel pull` fetches them, so GitHub never stores them.

## Critical Implementation Details

**Stale approvals.** Production jobs must share one concurrency group with `cancel-in-progress: false`. GitHub keeps only the newest pending run in a group, so approving can never ship an older commit over a newer one.

**Two different builds.** The "Lint and build" job uses placeholder env vars and only proves the code compiles. The deploy jobs run `vercel build` (with `--prod` for production) after `vercel pull --environment=<preview|production>`, so the deployed bundle inlines the real `NEXT_PUBLIC_*` values. Never deploy the output of the check job.

**Status check name.** The ruleset in Phase 3 requires the check by its job name. Keep the job name `Lint and build` stable; renaming it silently blocks every merge.

## Phase 1: GitHub repo and S-01 merge

### Overview

Create the public repo, push both branches, and merge S-01 into `master` through a PR so the pipeline branch starts from a complete `master`.

### Changes Required:

#### 1. GitHub repository

**File**: — (GitHub, via `gh`; user runs `! gh auth login` first if not authenticated)

**Intent**: Give the project a public remote so Actions, rulesets and Vercel can attach to it.

**Contract**: Local `main` renamed to `master` (`git branch -m main master`) before the first push, so `main` never exists on GitHub. Public repo `out-of-pills` under the user's account with default branch `master`; `origin` remote; `master` and `setup/init-app` pushed with upstream tracking.

#### 2. S-01 pull request

**File**: — (GitHub PR `setup/init-app` → `master`)

**Intent**: Land the already-verified S-01 work (roadmap + auth, Phases 1–3) on `master` before any CI exists.

**Contract**: PR title per commit convention; body references FR-001 and notes that S-01 Phase 4 finishes after F-01. Merge with a merge commit (preserves the per-phase SHAs recorded in `context/changes/email-sign-in/plan.md` Progress). S-01 stays `in-progress` in the roadmap.

### Success Criteria:

#### Automated Verification:

- Repo is public: `gh repo view --json visibility` returns `PUBLIC`
- Default branch is `master` and no `main` branch exists: `gh repo view --json defaultBranchRef` returns `master`; `git ls-remote --heads origin main` is empty
- `master` on GitHub contains S-01: `git merge-base --is-ancestor f43a10a origin/master`

#### Manual Verification:

- The S-01 PR shows as merged on GitHub and the repo page renders the README

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Pipeline on a pull request

### Overview

On branch `infra/deploy-pipeline` (from the updated `master`), add the workflow and repo config, set up the Vercel project and GitHub secrets/environment, update docs, and open a PR that proves the check and the preview deploy work.

### Changes Required:

#### 1. Workflow

**File**: `.github/workflows/ci.yml`

**Intent**: One workflow for checks and all three deployment kinds, so the whole release path is readable in one file.

**Contract**:
- Triggers: `pull_request` (to `master`) and `push` to `master`. Default permissions `contents: read`.
- Job `checks`, name `Lint and build`: checkout, `actions/setup-node` with `node-version-file: package.json` and npm cache, `npm ci`, `npm run lint`, `npm run build`, with placeholder env `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=ci-placeholder`.
- Job `preview` (PR only, same-repo PRs only, `needs: checks`, `pull-requests: write`): prebuilt Vercel deploy to the Preview environment; comment the URL on the PR, updating its own previous comment instead of adding a new one each push; concurrency per PR with cancel-in-progress.
- Job `staging` (push to `master`, `needs: checks`): same preview deploy; URL written to the job summary.
- Job `production` (push to `master`, `needs: staging`, `environment: production` with the production URL): `vercel pull --environment=production`, `vercel build --prod`, `vercel deploy --prebuilt --prod`; concurrency group `production`, `cancel-in-progress: false`.
- Vercel CLI installed at a pinned exact version; `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` as env from secrets, `--token ${{ secrets.VERCEL_TOKEN }}` on every CLI call.

#### 2. Vercel and Node config

**File**: `vercel.json`, `package.json`

**Intent**: Make Actions the only deployer and run the same Node major locally, in CI and on Vercel.

**Contract**: `vercel.json` → `{ "git": { "deploymentEnabled": false } }`. `package.json` → `engines.node` set to the newest Node major Vercel supports at implementation time (check Vercel docs; expected `24.x`), which also drives `setup-node`. `npm run build` and `npm run lint` still pass locally.

#### 3. Vercel project, secrets, environment

**File**: — (Vercel dashboard/CLI, GitHub settings via `gh`)

**Intent**: Wire the external pieces the workflow depends on.

**Contract**:
- Vercel project `out-of-pills` created with `vercel link` (not connected to Git). Note its `orgId`/`projectId` from `.vercel/project.json` (gitignored).
- Vercel env vars `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the Supabase cloud project, set for **Production** and **Preview**.
- Vercel deployment protection for previews: off (Vercel Authentication would hide previews from phones without a Vercel login).
- GitHub secrets: `VERCEL_TOKEN` (personal token scoped to the team), `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
- GitHub Environment `production`: required reviewer = the user, deployment branches limited to `master`.

#### 4. Docs

**File**: `README.md`, `AGENTS.md`, `context/foundation/tech-stack.md`

**Intent**: Describe the real release flow so the next contributor or agent doesn't assume auto-deploy, and record `master` as the default branch everywhere.

**Contract**:
- Default branch is `master`: AGENTS.md "open PRs against `main`" → `master`. In tech-stack.md, "merge to main" → `master`. Leave archived and historical docs (S-01 plan) untouched.
- README: new "Deploying" section covering the PR check plus preview comment, the automatic staging deploy on merge, production after "Approve" in Actions, the required secrets/env vars, and the fact that preview and staging use production Supabase so email links open production. Production step 5 points to the real URL setup.
- AGENTS.md: replace the "No test runner or CI workflow exists yet…" line with the actual flow. Under Commits & Pull Requests, add that `master` accepts only PRs with a green `Lint and build` check and that production deploys need approval.
- tech-stack.md: `ci_default_flow` hint and prose reflect "deploy on merge to `master`, production gated by approval".

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Production build passes: `npm run build`
- On the PR, the `Lint and build` check is green: `gh pr checks`
- On the PR, the `preview` job succeeds

#### Manual Verification:

- The PR has a comment with a preview URL; a second push updates that comment instead of adding a new one
- On the preview URL, sign-in with an existing production account works and lands on the main screen
- The preview URL opens on a phone without any Vercel login
- No deployment appears in the Vercel dashboard other than those made by the workflow

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Production go-live

### Overview

Merge the pipeline PR, approve the first production deploy, protect `master`, point Supabase at the production URL and finish S-01 Phase 4.

### Changes Required:

#### 1. First release

**File**: — (GitHub Actions)

**Intent**: Prove the merge → staging → approve → production path end to end.

**Contract**: Merge the Phase 2 PR. The `staging` job deploys automatically; the `production` job waits until the user approves it and then deploys to `https://<project>.vercel.app`.

#### 2. Protect `master`

**File**: — (GitHub ruleset via `gh api` or Settings → Rules)

**Intent**: Enforce the flow instead of relying on discipline.

**Contract**: Ruleset on `master` (default branch) requires a pull request with 0 approvals, requires the `Lint and build` status check, and blocks force pushes and deletion. There are no bypass actors.

#### 3. Supabase URLs and S-01 closure

**File**: — (Supabase dashboard); `context/changes/email-sign-in/plan.md` Progress

**Intent**: Make confirm/reset email links open production and close the S-01 checklist that this change unblocked.

**Contract**: Authentication → URL Configuration: Site URL = production URL; Redirect URLs include `<production-url>/**` (keep `http://localhost:3000/**`). Then run S-01 Progress 4.1–4.3 and tick them there.

### Success Criteria:

#### Automated Verification:

- The push-to-`master` run shows `staging` and `production` succeeded: `gh run list --branch master`
- Production URL responds and redirects signed-out users to `/sign-in`: `curl -sI https://<project>.vercel.app/` shows a redirect to `/sign-in`
- Ruleset is active on `master`: `gh api repos/{owner}/{repo}/rulesets`

#### Manual Verification:

- The production job waited for approval before deploying
- A direct `git push origin master` is rejected
- A sign-up on production delivers a confirmation email whose link opens the production URL and signs the user in
- S-01 Progress 4.1–4.3 are ticked in `context/changes/email-sign-in/plan.md`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- None. No test runner exists yet; the pipeline's job is to run `lint` + `build`. Adding `npm test` to the `checks` job comes when S-03 introduces a runner.

### Integration Tests:

- The pipeline is tested by using it. The Phase 2 PR exercises `checks` and `preview`. The Phase 3 merge exercises `staging` and `production`.

### Manual Testing Steps:

1. Push a second commit to the Phase 2 PR. The preview comment updates in place.
2. Open the preview URL on a phone. It loads without a Vercel login, and you can sign in.
3. After the merge, approve production. The production URL serves the new build.
4. Try `git push origin master` directly. It is rejected.
5. Sign up on production with a real inbox. The confirm link opens production and signs you in.

## Performance Considerations

- CI uses the npm cache via `setup-node`. Each deploy job runs its own `vercel build`, so a merge to `master` builds three times (check, staging, production). That is acceptable at this size and keeps env values correct per environment.

## Migration Notes

- `master` gains S-01 through a merge commit in Phase 1. No data migration. Turning off the ruleset and deleting the workflow fully reverts the pipeline. Vercel keeps earlier deployments, so a bad release can be rolled back from the Vercel dashboard ("Promote" a previous deployment).

## References

- Roadmap item: `context/foundation/roadmap.md` (F-01)
- Tech stack: `context/foundation/tech-stack.md` (`deployment_target: vercel`, `ci_provider: github-actions`)
- S-01 production config this unblocks: `context/changes/email-sign-in/plan.md` (Phase 4, Progress 4.1–4.3)
- Env usage: `src/lib/supabase/server.ts:15`, `src/lib/supabase/proxy.ts:24`
- Email link base: `supabase/templates/confirmation.html:5`, `src/app/(auth)/actions.ts:144`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: GitHub repo and S-01 merge

#### Automated

- [x] 1.1 Repo is public: `gh repo view --json visibility` returns `PUBLIC` — b3145fa
- [x] 1.2 Default branch is `master` and no `main` branch exists: `gh repo view --json defaultBranchRef` returns `master`; `git ls-remote --heads origin main` is empty — b3145fa
- [x] 1.3 `master` on GitHub contains S-01: `git merge-base --is-ancestor f43a10a origin/master` — b3145fa

#### Manual

- [x] 1.4 The S-01 PR shows as merged on GitHub and the repo page renders the README — b3145fa

### Phase 2: Pipeline on a pull request

#### Automated

- [x] 2.1 Lint passes: `npm run lint` — e6d3dec
- [x] 2.2 Production build passes: `npm run build` — e6d3dec
- [x] 2.3 On the PR, the `Lint and build` check is green: `gh pr checks` — e6d3dec
- [x] 2.4 On the PR, the `preview` job succeeds — e6d3dec

#### Manual

- [x] 2.5 The PR has a comment with a preview URL; a second push updates that comment instead of adding a new one — e6d3dec
- [x] 2.6 On the preview URL, sign-in with an existing production account works and lands on the main screen — e6d3dec
- [x] 2.7 The preview URL opens on a phone without any Vercel login — e6d3dec
- [x] 2.8 No deployment appears in the Vercel dashboard other than those made by the workflow — e6d3dec

### Phase 3: Production go-live

#### Automated

- [ ] 3.1 The push-to-`master` run shows `staging` and `production` succeeded: `gh run list --branch master`
- [ ] 3.2 Production URL responds and redirects signed-out users to `/sign-in`: `curl -sI https://<project>.vercel.app/` shows a redirect to `/sign-in`
- [ ] 3.3 Ruleset is active on `master`: `gh api repos/{owner}/{repo}/rulesets`

#### Manual

- [ ] 3.4 The production job waited for approval before deploying
- [ ] 3.5 A direct `git push origin master` is rejected
- [ ] 3.6 A sign-up on production delivers a confirmation email whose link opens the production URL and signs the user in
- [ ] 3.7 S-01 Progress 4.1–4.3 are ticked in `context/changes/email-sign-in/plan.md`
