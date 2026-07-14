# Deploying Chu Chu

Two halves: the **backend + AI engine** go to Render (free). The **Electron
app** runs on your own machine and talks to that Render URL — that's the
"OS assistant" half, and it stays local because opening apps, taking
screenshots, and controlling your clipboard only make sense on your own
computer (see `docs/ARCHITECTURE.md`).

Total time if you're just getting Groq's key and clicking through Render's
UI: about 10 minutes.

## 0. What you'll need
- A free [GitHub](https://github.com) account, with this code pushed to a repo.
- A free [Render](https://render.com) account (no credit card required for
  the free tier).
- A free [Groq](https://console.groq.com/keys) API key — this is the only key
  that's actually required. Gemini, OpenRouter, and Tavily keys are optional
  extras (fallback models, web search) and everything works without them.

## 1. Push this repo to GitHub
```bash
cd chu-chu
git init
git add .
git commit -m "Chu Chu — initial build"
git branch -M main
git remote add origin https://github.com/<your-username>/chu-chu.git
git push -u origin main
```

## 2. Deploy the backend to Render
1. In the Render dashboard: **New +** → **Blueprint**.
2. Connect the `chu-chu` repo you just pushed. Render will find `render.yaml`
   at the repo root automatically.
3. Render shows you the one service it's about to create
   (`chu-chu-backend`) and prompts you for the `sync: false` values:
   - `GROQ_API_KEY` — paste your key from console.groq.com. **Required.**
   - `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `TAVILY_API_KEY` — optional,
     leave blank if you don't have them yet. You can add them later without
     redeploying (Environment tab → they take effect on the next restart).
4. Click **Apply**. First build takes a few minutes — Render is installing
   the handful of lightweight dependencies in `backend/requirements.txt`
   (no ML libraries in that list, so this is a fast build).
5. Once it's live, open `https://your-service-name.onrender.com/health` in a
   browser. You should see something like:
   ```json
   {"status": "ok", "app": "Chu Chu", "environment": "production", "providers_configured": ["groq"]}
   ```
   If `providers_configured` is empty, double-check `GROQ_API_KEY` landed
   correctly in the service's Environment tab.

## 3. Copy your shared secret
Render auto-generated `APP_SHARED_SECRET` for you (that's what
`generateValue: true` in `render.yaml` does). Go to your service →
**Environment** tab → copy the value. You'll paste this into the Electron app
next — it's what stops random internet traffic from hitting your free
backend and burning your Groq quota.

## 4. Point the Electron app at your backend
```bash
cd frontend
cp .env.example .env
```
Edit `frontend/.env`:
```
VITE_API_BASE_URL=https://your-service-name.onrender.com
VITE_APP_SHARED_SECRET=<the value you copied in step 3>
```

## 5. Run it
```bash
npm install
npm run electron:dev
```
This starts Vite's dev server and launches the Electron shell pointed at it.
First message might take 30-60 seconds if the backend had spun down from
inactivity — Render free instances sleep after 15 minutes idle. The UI shows
a "waking up Chu Chu" state for this rather than a raw error; it only
happens on the first request after a period of no use.

### Building an installer
```bash
npm run electron:build
```
Produces a platform-native installer (`.exe` / `.dmg` / `.AppImage`) under
`frontend/release/` for **whichever OS you run this command on** —
electron-builder cross-compiles in limited cases only, so build on each
target OS, or use a free GitHub Actions matrix build if you want all three
from one push (not included by default — this repo optimizes for "runs on
your machine," not "ships a public installer").

## 6. Optional: make notes/reminders survive a redeploy
By default the backend uses a local SQLite file, which Render's free tier
wipes on every redeploy/restart. If that matters to you:

1. Create a free database at [neon.tech](https://neon.tech) (no card,
   scale-to-zero, doesn't expire). Copy the connection string it gives you.
2. In Render → your service → **Environment** → add a new variable:
   - Key: `DATABASE_URL`
   - Value: `postgresql://user:password@host/dbname` (paste what Neon gave
     you — the app rewrites this to the `+asyncpg` driver form automatically)
3. Save. Render restarts the service; tables are created automatically on
   first boot against the new database.

## 7. Optional: keep the backend warm
Render's free tier has no free cron jobs, so `.github/workflows/keep-warm.yml`
pings `/health` from GitHub Actions every 10 minutes instead. To enable it:
Settings → Secrets and variables → Actions → **New repository variable** →
name `RENDER_BACKEND_URL`, value `https://your-service-name.onrender.com`.
Read the comment at the top of that workflow file first — keeping one
instance warm 24/7 uses close to all of Render's 750 free instance-hours/month,
which is fine (it fits) but leaves little room for a second free service on
the same account.

## Troubleshooting
- **"No AI provider is configured" in the chat.** `GROQ_API_KEY` isn't set,
  or isn't saved. Render → service → Environment → confirm it's there → if
  you just added it, trigger **Manual Deploy → Deploy latest commit** to
  restart the service and pick it up.
- **401 from the Electron app.** `VITE_APP_SHARED_SECRET` in
  `frontend/.env` doesn't match `APP_SHARED_SECRET` on Render. Re-copy it
  from the Environment tab.
- **First request after a while is slow, then fine.** Expected — that's the
  free tier's cold start (~30-60s). See step 7 if you want to minimize it.
- **CORS error in the Electron devtools console.** Shouldn't happen with the
  default config (`CORS_ORIGINS=*`); if you narrowed it, make sure your
  Electron app's actual origin is on the list — see the CORS note in
  `docs/ARCHITECTURE.md` for why Electron's origin isn't always what you'd
  expect.
