# Deploying Daily Diet Cloud

This app can run in three places. They don't conflict — pick whichever you need.

| Target | URL style | Cloud sync across devices | Cost |
| --- | --- | --- | --- |
| ChatGPT Sites (current) | `*.chatgpt-team.site` | ✅ (D1) | included |
| **GitHub Pages** | `ejrivera3.github.io/DIET-APP/` | ❌ (localStorage only) | free |
| **Cloudflare Workers** | `*.workers.dev` | ✅ (D1) | free tier |

The app is **local-first**: it always saves to the browser's `localStorage`, so it
works fully offline / single-device. The server API (`/api/diet` → D1 or Supabase)
only adds **cross-device cloud sync** via the "Cloud Sync key". GitHub Pages has no
server, so on Pages the cloud sync stays dormant and each device keeps its own data.

---

## 1. GitHub Pages (static, public, no accounts needed by users)

A separate static build (`npm run build:static`, config in `vite.static.config.ts`)
bundles `app/DietApp.tsx` as a plain client SPA into `dist-static/`. A GitHub Action
(`.github/workflows/deploy-pages.yml`) builds and publishes it on every push to
`codex/diet-cloud-app`.

**One-time setup (done in the GitHub web UI):**

1. Push this branch to GitHub (the workflow file must be on the branch).
2. Repo → **Settings → Pages → Build and deployment → Source = "GitHub Actions"**.
3. The next push (or "Run workflow" on the Actions tab) deploys it.

Live URL: **https://ejrivera3.github.io/DIET-APP/**

> The base path is `/DIET-APP/` (matching the repo name). If you rename the repo or
> use a custom domain, set `STATIC_BASE` (e.g. `STATIC_BASE=/ npm run build:static`).

Build & preview locally:

```bash
npm run build:static
npm run preview:static
```

---

## 2. Cloudflare Workers (full app, cloud sync works, your own account)

The app is already built for Cloudflare. `wrangler.jsonc` deploys the built worker
in `dist/`.

**One-time setup:**

```bash
npx wrangler login                          # opens browser, log into Cloudflare
npx wrangler d1 create daily-diet-cloud-db  # prints a database_id
```

Paste that `database_id` into `wrangler.jsonc` (replace `REPLACE_WITH_YOUR_D1_DATABASE_ID`).

**Deploy (anytime):**

```bash
npm run deploy:cf   # = npm run build && wrangler deploy
```

Wrangler prints your live `https://daily-diet-cloud.<account>.workers.dev` URL.
The `/api/diet` route auto-creates its tables in D1 on first use.

> Prefer Supabase instead of D1? Set `SUPABASE_URL` + `SUPABASE_SECRET_KEY` +
> `BACKUP_DRIVER=supabase` as Worker secrets (`npx wrangler secret put ...`) and run
> the SQL in `supabase/migrations/0001_diet_cloud.sql`. See README.md.

---

## Working from both Claude Code and ChatGPT Codex

Both edit the same repo. Always `git pull` before starting and `git push` when done so
the other tool — and the GitHub Pages deploy — pick up your changes.
