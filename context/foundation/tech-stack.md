---
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
---

## Why this stack

Out of Pills is a small-scale web app with a 3-week MVP built solo, and its only technology-forcing feature in v1 is authentication (email + password and Google sign-in, FR-001/FR-002) with strict per-caregiver data privacy. The user explicitly chose Next.js (App Router, TypeScript, Tailwind) for the frontend over the registry default Astro starter; Next.js passes all four agent-friendly gates and has verified bootstrapper support, which suits the short timeline. Because create-next-app ships no auth or database, the backend layer is Supabase (Postgres + Supabase Auth with Google OAuth, integrated via @supabase/ssr), with Row Level Security enforcing that medication data is visible only to the profile's caregiver. Deployment targets Vercel, the native host for Next.js, with GitHub Actions and auto-deploy on merge to main. The self-check flagged two gaps (familiarity with conventions and judging agent output), so the generated CLAUDE.md should spell out Next.js/Supabase conventions: server components by default, "use client" only for interactivity, Supabase access only through @supabase/ssr clients, and RLS on every table.
