---
description: Deploy the Well Care Mart storefront (this repo) — frontend to Vercel via git push, and/or Supabase Edge Functions. Use when asked to push, ship, or deploy storefront/frontend/edge-function changes here.
---

# Deploying the storefront (wellcare-mart-app)

This repo has two independently-deployed pieces. Changes to one do NOT deploy the other.

## 1. Frontend (Vercel — auto-deploys on git push)

- Vercel project: `cozy-care-sync`, linked via GitHub integration to `origin`
  (`https://github.com/pro123908/cozy-care-sync.git`, branch `main`).
- There is **no manual Vercel CLI step** for this app. Pushing to `main` on GitHub
  is the deploy trigger — Vercel builds and ships it automatically.
- So "deploy the frontend" == `git push origin main` after committing.

Before pushing:
1. Run `npx tsc --noEmit -p tsconfig.json` and confirm no *new* errors (a handful of
   pre-existing ones may already exist on `main` — compare against a clean stash if unsure).
2. Start the dev server (`bun run dev`, http://localhost:5173) and have the user verify
   the change in-browser before pushing — this is a standing preference, not optional.
3. `git status --short` and check for `dev-dist/sw.js` or other build artifacts that
   appear modified just from running the dev server. Do NOT stage/commit those —
   only `git add` the specific source files that were intentionally changed.
4. Commit, then `git push origin main`.

## 2. Supabase Edge Functions (manual deploy — NOT triggered by git push)

- Project ref: `dkspvlpswpipltceptoa` (already linked; `supabase/.temp/project-ref`).
- Functions live in `supabase/functions/<name>/index.ts`.
- Editing a function's source file has **zero effect on production** until deployed:
  ```
  supabase functions deploy <function-name>
  ```
- This is the mistake to avoid: it's easy to edit e.g. `meta-track/index.ts`, verify
  against the local dev server, and assume it works — but the local dev server calls
  the *hosted* function (`.env` points `VITE_SUPABASE_URL` at the live project), not
  a local one. If a client-side change depends on a function-side change (new event
  name, new field, etc.), deploy the function FIRST, then verify in-browser.

## 3. Database migrations

- `supabase/migrations/*.sql` — apply via the Supabase dashboard SQL editor or
  `supabase db push`, as done for prior migrations. Not covered by git push or
  `functions deploy`.

## Quick reference

| Changed | Deploy command |
|---|---|
| `src/`, `index.html`, `public/` | `git push origin main` (after commit) |
| `supabase/functions/*` | `supabase functions deploy <name>` |
| `supabase/migrations/*` | Apply SQL via Supabase dashboard / `supabase db push` |
