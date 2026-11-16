# Out of Pills

A web app where caregivers track how many pills are left per profile and when each medication runs out. Built with Next.js 16 and Supabase.

## Local setup

Requirements: Node.js and Docker Desktop (running) for the local Supabase stack.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the local Supabase stack (Postgres, Auth, Studio, Mailpit):

   ```bash
   npx supabase start
   ```

3. Create `.env.local` from the example and paste the publishable (anon) key printed by `npx supabase status`:

   ```bash
   cp .env.example .env.local
   ```

4. Run the app:

   ```bash
   npm run dev
   ```

- App: http://localhost:3000
- Mailpit (sign-up and password-reset emails): http://127.0.0.1:55324
- Supabase Studio: http://127.0.0.1:55323

Stop the stack with `npx supabase stop`.

## Database

Schema changes live in `supabase/migrations/` as timestamped SQL files. Every table enables Row Level Security in the migration that creates it.

```bash
npx supabase migration new <name>   # create supabase/migrations/<timestamp>_<name>.sql
npx supabase db reset               # rebuild the local database from all migrations
npx supabase test db                # run the pgTAP tests in supabase/tests/database/
npm run db:types                    # regenerate src/lib/supabase/database.types.ts
```

`npm run db:types` reads the local stack, so run `npx supabase start` first. With the stack down the CLI writes its error into the file instead, so check that the file starts with `export type`.

Release order for a PR that adds a migration:

1. Verify locally: `npx supabase db reset`, `npx supabase test db`, `npm run db:types`.
2. Push it to the cloud project: `npx supabase db push` (previews and staging use the production database).
3. Check the PR preview.
4. Merge.

Migrations must be additive (new tables, columns, policies): the production build keeps running against the new schema until the merge deploys. Never edit a migration that has been pushed; add a new one.

## Production (Supabase cloud)

Auth in production mirrors `supabase/config.toml`. Set up once in the Supabase and Resend dashboards; no secrets live in this repo.

1. **Project** — free-plan project `out-of-pills` in an EU region. Link the CLI so migrations can be pushed later:

   ```bash
   npx supabase link --project-ref <project-ref>
   ```

2. **Authentication → Sign In / Providers → Email** — email provider on, *Confirm email* on, minimum password length `8`, password requirements *letters and digits*.
3. **Authentication → Emails → Templates** — paste `supabase/templates/confirmation.html` into *Confirm signup* and `supabase/templates/recovery.html` into *Reset password* (subjects as in `config.toml`). Both link to `/auth/confirm` with a `token_hash`.
4. **SMTP via Resend** — verify your domain in Resend (SPF/DKIM DNS records) and create an API key. In **Authentication → Emails → SMTP Settings** enable custom SMTP: host `smtp.resend.com`, port `465`, username `resend`, password = the Resend API key, sender `no-reply@<your-domain>`, sender name `Out of Pills`. The API key stays in the Supabase dashboard only.
5. **URLs** — **Authentication → URL Configuration**: Site URL = the production URL (`https://<project>.vercel.app`, see [Deploying](#deploying)); Redirect URLs include `<production-url>/**` (keep `http://localhost:3000/**`). The Vercel env vars come from this project too, see [Deploying](#deploying).

Free-plan projects pause after about a week without activity. Resume from the project page in the Supabase dashboard (**Restore project**); the app returns errors until it is running again.

## Deploying

GitHub Actions (`.github/workflows/ci.yml`) is the only deployer; Vercel's Git integration is off (`vercel.json`).

- **Pull request to `master`** — the `Lint and build` check runs, then a Vercel preview is deployed and its URL is posted as a PR comment (updated in place on every push). `master` only accepts PRs with a green check.
- **Merge to `master`** — `Lint and build` runs again and staging (a Vercel preview build of `master`) deploys automatically; its URL is in the run summary.
- **Production** — the `production` job waits for **Review deployments → Approve** on the run in the Actions tab, then deploys to `https://<project>.vercel.app`. Only the newest pending run can be approved.

Setup (once):

- GitHub secrets: `VERCEL_TOKEN` (Vercel personal token), `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (from `.vercel/project.json` after `vercel link`). GitHub Environment `production` with you as required reviewer, limited to `master`.
- Vercel env vars for **Production** and **Preview**: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the Supabase cloud project (**Project Settings → API Keys**). Deployment protection for previews off, so previews open on a phone without a Vercel login.

Previews and staging use the production Supabase project: you sign in with real accounts, and email links (confirm sign-up, reset password) always open the production URL.

## Checks

```bash
npm run lint
npm run build
```
