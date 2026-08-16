# Day Arc

A personal daily routine tracker. Static frontend in `public/index.html`, one
serverless function in `api/kv.js` that reads/writes Upstash Redis. The
frontend talks to it through the same `window.storage.get/set/delete/list`
interface it always used — only the implementation underneath changed from
`localStorage` to a real network-backed store, so your data now follows you
across devices and survives clearing browser storage.

## Deploy to Vercel

1. **Push this folder to a GitHub repo** (or run `vercel` from inside it with
   the [Vercel CLI](https://vercel.com/docs/cli) — either works).

2. **Import the repo on [vercel.com/new](https://vercel.com/new)** and deploy
   it. No build step is needed — Vercel will serve `public/` as static files
   and `api/kv.js` as a serverless function automatically.

3. **Add Upstash Redis storage.** Easiest path: in the Vercel dashboard, open
   your project → **Storage** tab → **Create Database** → **Upstash Redis**.
   Vercel provisions it and automatically sets the `UPSTASH_REDIS_REST_URL`
   and `UPSTASH_REDIS_REST_TOKEN` environment variables for you — no manual
   copy-pasting.

   (Alternatively, create a free database directly at
   [console.upstash.com](https://console.upstash.com), then add
   `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` yourself under
   Project → **Settings → Environment Variables**, using the REST URL/token
   shown on the database's detail page.)

4. **Redeploy** (Vercel does this automatically after you add env vars via
   the Storage tab; if you added them manually, trigger a redeploy from the
   Deployments tab so the function picks them up).

5. Open the deployed URL — the app should load and start saving to Redis.

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
locally. You'll still need `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN` in a local `.env` file (or pulled via
`vercel env pull`) for the API to work.

## Project structure

```
public/index.html   the entire app (HTML + CSS + JS, no build step)
api/kv.js            serverless function: GET/POST -> Upstash Redis
package.json          declares @upstash/redis as the only dependency
vercel.json           serves index.html at the root
```

## Data model (unchanged from the offline version)

- `routine:YYYY-MM-DD` — that day's checkbox state
- `settings` — app-level settings (e.g. level)
- `extras_persistent` — persistent extras
- Cycle keys used by the Cycles tab (biweekly/weekly/monthly food/task state)

All keys are stored personal (`shared: false`), namespaced under `dayarc:` in
Redis, so this Redis database can safely be reused for other things too.

## Backups

The **Export backup** / **Import backup** buttons in the app now read/write
through the same API rather than `localStorage` directly, so they still work
exactly as before — a JSON snapshot of every key you can download and
restore later.
