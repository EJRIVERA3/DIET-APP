# Daily Diet Cloud

A mobile-first diet schedule app with daily cloud backup. You plan a day's
meals, log what you actually ate, track weigh-ins and workouts, and a Cloud Sync
key restores the same data on any phone.

## Features

- **Schedule** — a day of meals on a timeline, alongside workouts, busy blocks
  and a weigh-in. Meals can be locked so automation leaves them alone.
- **Meals are the sum of their foods** — each food carries its own calories and
  macros, so a meal's totals are derived rather than typed by hand. A meal with
  no foods yet keeps the planned target the day's macros distribute onto.
- **Custom Foods** — save the foods you eat often with their nutrition, then
  drop one into any meal and its macros come with it.
- **Copy day** — replicate a day's meals, workouts and busy blocks across other
  days, with per-part toggles. Weigh-ins are never copied; they belong to the
  day they were measured on.
- **Shopping list** — totals every food across a week, summing amounts that
  share a unit and converting between grams and ounces.
- **Plan your week** — a weekly review that looks at your weigh-ins and helps
  program the next week's calories.
- **Progress** — weight trend, and a rule-based coach that nudges on low
  protein, unrealistic targets and unusually fast weight loss.
- **Settings** — daily macro and step targets, start and goal weight, and goal
  date. Target changes apply to today forward; logged days keep what they were.
- **Coach sharing** — a coach can follow a client's log through a revocable
  invite link, without the client handing over their sync key.

## Live Site

Cloudflare Sites deployment:

https://daily-diet-cloud-emilio.covan-group-2760.chatgpt-team.site

A static build also deploys to GitHub Pages on every push to
`codex/diet-cloud-app` via `.github/workflows/deploy-pages.yml`.

The app is a PWA, so phone users can open it in Safari or Chrome and add it to
the home screen.

## Local Development

Requirements:

- Node.js `>=22.13.0`

```bash
npm install
npm run dev      # dev server on :3000
npm run lint
npm test         # node --test
npm run build
```

`npm run build:static` and `npm run preview:static` produce and serve the
static (GitHub Pages) build. `npm run deploy:cf` builds and deploys to
Cloudflare Workers.

## Data Model Notes

Two details are easy to trip over:

- **Days are keyed by local date**, not UTC (`dateKey` in `app/DietApp.tsx`).
  Writing day data directly with a UTC-derived key will land on the wrong day
  near midnight.
- **Foods logged before per-food nutrition existed** carry no macros of their
  own. On load they inherit their meal's macros, so older days keep their
  totals. See `normalizeMealFood`.

`app/day-totals.ts` deliberately mirrors `getLoggedTotals` in `app/DietApp.tsx`
— a meal counts as logged only once it has foods attached. If that rule changes
in one place, change it in the other; `day-totals.test.ts` guards it.

## Cloud Backup

The app runs on Cloudflare D1 by default and also supports Supabase. The API
chooses Supabase automatically when `SUPABASE_URL` and a server-only Supabase
secret/service key are present.

Set hosted runtime values in the hosting provider, never in Git.

## Supabase Setup

Create a Supabase project, then run both migrations in order:

```text
supabase/migrations/0001_diet_cloud.sql
supabase/migrations/0002_coach_links.sql
```

Then set these runtime environment variables:

```text
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SECRET_KEY=your-server-side-secret-key
BACKUP_DRIVER=supabase
```

Legacy Supabase projects can use `SUPABASE_SERVICE_ROLE_KEY` instead of
`SUPABASE_SECRET_KEY`. Keep secret/service keys server-side only.

The migrations enable RLS and add no public policies. The app writes through the
server API route, so the database is never exposed to the browser.

## Git

Work happens on `codex/diet-cloud-app`, which pushes to:

https://github.com/EJRIVERA3/The-Food-Tracker-App

```bash
git push origin codex/diet-cloud-app
```
