# Day Arc

A personal daily routine tracker. Static frontend in `public/index.html`, one
serverless function in `api/kv.js` that reads/writes a Postgres table. The
frontend talks to it through the same `window.storage.get/set/delete/list`
interface it always used — only the backend storage changed, so your data
now follows you across devices and survives clearing browser storage.

## Deploy to Vercel

1. **Push this folder to a GitHub repo** (or run `vercel` from inside it with
   the [Vercel CLI](https://vercel.com/docs/cli) — either works).

2. **Import the repo on [vercel.com/new](https://vercel.com/new)** and deploy
   it. No build step is needed — Vercel serves `public/` as static files and
   `api/kv.js` as a serverless function automatically.

3. **Add Postgres storage.** In the Vercel dashboard, open your project →
   **Storage** tab → **Create Database** → choose **Postgres** (this
   provisions a [Neon](https://neon.tech) database under the hood). Vercel
   automatically sets `POSTGRES_URL` and related env vars — no manual
   copy-pasting needed.

   (Alternatively, create a free Postgres database directly at
   [neon.tech](https://neon.tech) or [supabase.com](https://supabase.com),
   then add a `POSTGRES_URL` environment variable yourself under Project →
   **Settings → Environment Variables**, using the connection string from
   your provider. If you use Supabase, use the "connection pooling" /
   pgBouncer connection string so it works well from serverless functions.)

4. **Redeploy** (Vercel does this automatically after you add env vars via
   the Storage tab; if you added them manually, trigger a redeploy from the
   Deployments tab so the function picks them up).

5. Open the deployed URL. The API creates its own table (`dayarc_kv`) on
   first request — nothing to run by hand.

## Optional: protect it with a passcode

By default the `/api/kv` endpoint is open to anyone who has the URL (fine for
a private, unlisted deployment). To require a passcode:

1. In Vercel, add an environment variable `DAYARC_PASSCODE` set to any string
   you choose, and redeploy.
2. Next time you open the app, it'll prompt you for that passcode once and
   remember it in the browser (`localStorage`) for future visits.

## Local development

```bash
npm install
npx vercel dev
```

`vercel dev` runs both the static frontend and the `/api/kv` function
locally. You'll need `POSTGRES_URL` in a local `.env` file (or pulled via
`vercel env pull`) for the API to work.

## Project structure

```
public/index.html   the entire app (HTML + CSS + JS, no build step)
api/kv.js            serverless function: GET/POST -> Postgres
package.json          declares @vercel/postgres as the only dependency
vercel.json           serves index.html at the root
```

## Data model

A single table, created automatically:

```sql
CREATE TABLE dayarc_kv (
  namespace   text NOT NULL,       -- 'personal' or 'shared'
  key         text NOT NULL,
  value       text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (namespace, key)
);
```

Keys used by the app (all in the `personal` namespace):

- `routine:YYYY-MM-DD` — that day's checkbox state
- `settings` — app-level settings (e.g. level)
- `extras_persistent` — persistent extras
- Cycle keys used by the Cycles tab (biweekly/weekly/monthly food/task state)

## Backups

The **Export backup** / **Import backup** buttons in the app read/write
through the same API rather than `localStorage` directly, so they still work
exactly as before — a JSON snapshot of every key you can download and
restore later.
