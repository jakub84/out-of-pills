# Deploy Pipeline — Plan Brief

> Full plan: `context/changes/deploy-pipeline/plan.md`

## What & Why

Roadmap F-01 puts the app on a public URL through a gated pipeline. Every PR is linted, built and given a preview deployment. Every merge to `master` deploys staging automatically, and production follows only after a manual "Approve". This unblocks S-01's production checklist, S-04's Google callback URL, and testing every later slice on real phones.

## Starting Point

The repo has no remote. `master` holds only the PRD, and all S-01 auth work sits on `setup/init-app`. There is no CI, Vercel project or Node pin yet. The app needs only two public env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).

## Desired End State

The repo is public, and `master` accepts only PRs with a green `Lint and build` check. Each PR gets a preview URL in a comment. A merge deploys staging at once, and production at `https://<project>.vercel.app` after approval in Actions. Supabase email links open production, and the S-01 Phase 4 checklist passes there with a real inbox.

## Key Decisions Made

| Decision              | Choice                                                   | Why (1 sentence)                                                                 |
| --------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Who deploys           | GitHub Actions + Vercel CLI (`--prebuilt`); Vercel Git integration off | Deploys are hard-gated by CI and the whole path lives in one workflow file.        |
| Release gate          | `master` + GitHub Environment `production` with required approval | Same control as a `prod` branch without extra release PRs or back-merges.          |
| Preview/staging data  | Same production Supabase project                         | One project to configure; email links use SiteURL and open production anyway.      |
| Repo visibility       | Public, ruleset on `master` (PR + green check, no force push) | Free branch protection; the repo holds no secrets.                                 |
| Default branch        | `master` (local `main` renamed before first push)        | User preference; docs (AGENTS.md, tech-stack, roadmap) follow.                     |
| Domain                | Default `*.vercel.app`                                   | Works immediately with no DNS; can move to a custom domain later.                  |
| Getting S-01 in       | Plain PR `setup/init-app` → `master` first, pipeline on `infra/deploy-pipeline` | Clean history, and the pipeline PR is the workflow's own first test.               |
| CI build env          | Placeholder `NEXT_PUBLIC_*`; deploy jobs build with real values via `vercel pull` | No app values in GitHub; each deployment inlines its own environment's values.     |

## Scope

**In scope:**
- Public GitHub repo and the S-01 merge
- `.github/workflows/ci.yml` with jobs `checks`, `preview`, `staging` and `production`
- `vercel.json`, `engines.node`, Vercel project and env vars, GitHub secrets and environment
- Ruleset on `master`, Supabase Site/Redirect URLs, closing S-01 4.1–4.3
- README, AGENTS.md and tech-stack.md updates

**Out of scope:** custom domain, staging Supabase project, `prod` branch, Vercel Git integration, tests/migrations in CI, app code changes, fork PR previews.

## Architecture / Approach

The flow is `PR → [Lint and build] → [preview deploy + PR comment]`. After a merge it is `master → [Lint and build] → [staging deploy] → (Approve) → [production deploy]`. Deploy jobs run `vercel pull --environment=…` → `vercel build` → `vercel deploy --prebuilt`, with `VERCEL_TOKEN/ORG_ID/PROJECT_ID` from GitHub secrets. The real Supabase values live in Vercel env vars, so GitHub never holds them. Production jobs share one concurrency group, which means only the newest pending release can be approved.

## Phases at a Glance

| Phase                          | What it delivers                                              | Key risk                                                    |
| ------------------------------ | ------------------------------------------------------------- | ----------------------------------------------------------- |
| 1. GitHub repo and S-01 merge  | Public repo; `master` contains S-01                             | Requires `gh auth login`; the merge happens without CI       |
| 2. Pipeline on a pull request  | Workflow, Vercel project, secrets, docs; green PR with preview | Vercel token/IDs wiring; preview protection blocking phones  |
| 3. Production go-live          | Approved prod deploy, protected `master`, S-01 closed           | Status check name mismatch blocking merges; SiteURL wrong    |

**Prerequisites:** GitHub and Vercel accounts, logged in via `! gh auth login` and `! npx vercel login`. The Supabase cloud project and Resend come from S-01 Phase 4 steps 1–4.
**Estimated effort:** ~1 session across 3 phases, mostly configuration.

## Open Risks & Assumptions

- Previews and staging write to the production database. That is acceptable while the only data is test accounts, and should be revisited before real users arrive.
- Assumes Vercel's newest supported Node major (expected 24.x) runs the app the same way as local Node 26.
- The free Supabase plan pauses after a week idle, which would also break preview and staging.

## Success Criteria (Summary)

- A PR shows a green check and a working preview link that opens on a phone.
- A merged change reaches production only after you click "Approve".
- Sign-up on production sends an email whose link signs you in on the production URL.
