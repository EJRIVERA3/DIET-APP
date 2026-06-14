# Daily Diet Cloud

A mobile-first diet schedule app with daily cloud backup. It includes meal and
macro tracking, copy-day workflows, workouts, busy blocks, weigh-ins, progress,
and a Cloud Sync key that can restore the same data on iPhone or Android.

## Live Site

The current Sites deployment is:

https://daily-diet-cloud-emilio.covan-group-2760.chatgpt-team.site

The app is configured as a PWA, so phone users can open it in Safari or Chrome
and add it to the home screen.

## Local Development

Requirements:

- Node.js `>=22.13.0`

Commands:

```bash
npm install
npm run dev
npm run lint
npm run build
```

## Cloud Backup

The app currently works with Cloudflare D1 on Sites. It also supports Supabase
as an alternate backend. The API chooses Supabase automatically when
`SUPABASE_URL` and a server-only Supabase secret/service key are present.

Local environment keys are listed in `.env.example`. Hosted runtime values
should be set in the hosting provider, not committed to Git.

## Supabase Setup

Create a Supabase project, then run the SQL in:

```text
supabase/migrations/0001_diet_cloud.sql
```

After the tables exist, set these runtime environment variables:

```text
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SECRET_KEY=your-server-side-secret-key
BACKUP_DRIVER=supabase
```

Legacy Supabase projects can use `SUPABASE_SERVICE_ROLE_KEY` instead of
`SUPABASE_SECRET_KEY`. Keep secret/service keys server-side only.

The migration enables RLS and does not add public policies. The app writes
through the server API route, so database access is not exposed to the browser.

## Git

This folder is initialized as a Git repository on branch:

```text
codex/diet-cloud-app
```

If you want to push to GitHub or another Git host, add your remote and push:

```bash
git remote add origin <your-repo-url>
git push -u origin codex/diet-cloud-app
```

This machine did not have the Git CLI on `PATH` when the project was created, so
the repository was committed with a local JS Git helper. Installing Git for
Windows will make the normal commands above work.
