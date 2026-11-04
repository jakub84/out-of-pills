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

## Checks

```bash
npm run lint
npm run build
```
