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

## Production (Supabase cloud)

Auth in production mirrors `supabase/config.toml`. Set up once in the Supabase and Resend dashboards; no secrets live in this repo.

1. **Project** — free-plan project `out-of-pills` in an EU region. Link the CLI so migrations can be pushed later:

   ```bash
   npx supabase link --project-ref <project-ref>
   ```

2. **Authentication → Sign In / Providers → Email** — email provider on, *Confirm email* on, minimum password length `8`, password requirements *letters and digits*.
3. **Authentication → Emails → Templates** — paste `supabase/templates/confirmation.html` into *Confirm signup* and `supabase/templates/recovery.html` into *Reset password* (subjects as in `config.toml`). Both link to `/auth/confirm` with a `token_hash`.
4. **SMTP via Resend** — verify your domain in Resend (SPF/DKIM DNS records) and create an API key. In **Authentication → Emails → SMTP Settings** enable custom SMTP: host `smtp.resend.com`, port `465`, username `resend`, password = the Resend API key, sender `no-reply@<your-domain>`, sender name `Out of Pills`. The API key stays in the Supabase dashboard only.
5. **URLs (after the deploy pipeline exists)** — **Authentication → URL Configuration**: Site URL = production URL; Redirect URLs include `<production-url>/**`. In Vercel set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the cloud project (**Project Settings → API Keys**).

Free-plan projects pause after about a week without activity. Resume from the project page in the Supabase dashboard (**Restore project**); the app returns errors until it is running again.

## Checks

```bash
npm run lint
npm run build
```
