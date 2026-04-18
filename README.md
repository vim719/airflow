# AirClaw Frontend

Next.js 14 · TypeScript · Tailwind CSS · Claude API

## Routes

| Route | Description |
|---|---|
| `/` | Live signal dashboard — ticker, active signals, system status |
| `/gstack` | Interactive tech stack — click any node to inspect role, file, I/O |
| `/design-consultation` | AI-powered design system builder (Claude Sonnet 4, streaming) |

## Design System

- **Display font:** Instrument Serif — editorial weight, unexpected in fintech
- **UI font:** Geist — tabular-nums native, excellent at data density
- **Color:** Gold `#B8860B` as primary accent — institutional, not consumer
- **Direction:** Light professional institutional — Stripe meets Jane Street

## Local Development

```bash
# 1. Install
npm install

# 2. Configure
cp .env.local.template .env.local
# Edit .env.local: add ANTHROPIC_API_KEY

# 3. Run
npm run dev
# → http://localhost:3000
```

## Deploy to Vercel

### Option A: Vercel CLI (fastest)
```bash
npm i -g vercel
vercel

# When prompted:
# - Set up project? Y
# - Which scope? (your account)
# - Link to existing? N
# - Project name: airclaw-frontend
# - Directory: ./
# - Override settings? N

# Add your API key:
vercel env add ANTHROPIC_API_KEY production
# Paste your key

# Deploy to production:
vercel --prod
```

### Option B: GitHub → Vercel dashboard
```bash
git init
git add .
git commit -m "feat: AirClaw frontend MVP"
git remote add origin https://github.com/YOUR_USERNAME/airclaw-frontend.git
git push -u origin main
```
Then: vercel.com/new → Import → Select repo → Add `ANTHROPIC_API_KEY` env var → Deploy.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | For `/design-consultation` Claude API calls |

## File Structure

```
src/
  app/
    layout.tsx              # Root layout, fonts, nav
    page.tsx                # / — Signal dashboard
    globals.css             # Design tokens, utility classes
    gstack/
      page.tsx              # /gstack — Interactive tech stack
    design-consultation/
      page.tsx              # /design-consultation — AI designer UI
    api/
      design-consultation/
        route.ts            # Claude API streaming route
  components/
    layout/
      Nav.tsx               # Sticky nav with active states
```

## Notes for Demo

- The `/gstack` page is fully static — no API key needed
- The `/design-consultation` page requires `ANTHROPIC_API_KEY`
- Ticker data and signal data on `/` are simulated (realistic hardcoded values)
- Connect to your real AirClaw backend by replacing the static data in `page.tsx`
  with fetch calls to your Python API endpoints
