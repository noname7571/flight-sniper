# Flight Sniper

[![CI](https://github.com/noname7571/flight-sniper/actions/workflows/ci.yml/badge.svg)](https://github.com/noname7571/flight-sniper/actions/workflows/ci.yml)
[![GitHub release](https://img.shields.io/badge/version-0.1.0-blue)](https://github.com/noname7571/flight-sniper)

A web-based flight ticket price monitoring tool that checks flight prices 24/7 and sends notifications via email or Discord when prices drop below your target threshold.

## Branching Strategy

This project follows a simplified Git Flow:

- `main` -- production-ready code, always deployable
- `feat/*` -- new features (e.g. `feat/discord-notifications`)
- `fix/*` -- bug fixes
- `chore/*` -- config, dependencies, CI/CD

Every feature is developed on its own branch and merged via Pull Request with squash commit.

## Supported Airports (Central Europe)

| Code | Airport |
|------|---------|
| VIE | Vienna International (~60km from Bratislava) |
| BUD | Budapest Ferenc Liszt (~200km) |
| PRG | Prague Vaclav Havel (~330km) |
| BTS | Bratislava M.R. Stefanik |
| KSC | Kosice |
| TAT | Poprad-Tatry |
| KTW | Katowice |
| KRK | Krakow |

## How It Works

1. Add a route (e.g. VIE -> BCN) with your maximum price
2. The scheduler checks prices at your chosen interval (every 30min to 24h)
3. When a price is found below your threshold, you get notified via email and/or Discord webhook
4. Price history is stored for reference

## Tech Stack

- **Backend:** Node.js + TypeScript + Express
- **Database:** SQLite (local dev) or PostgreSQL (production)
- **Frontend:** Vanilla HTML/CSS/JS (no framework required)
- **Flight Data:** SerpApi (Google Flights) - [serpapi.com](https://serpapi.com)
- **Notifications:** SMTP email + Discord webhooks

## Quick Start

### Prerequisites

- Node.js 20+
- A SerpApi API key (free tier: 250 searches/month) - [sign up here](https://serpapi.com)

### Local Development

```bash
# Install dependencies
cd backend && npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your SerpApi key and notification settings

# Run the backend (serves frontend too)
npm run dev
```

Open http://localhost:3001 in your browser.

## Setup Notifications

### Discord

1. Go to your Discord server settings
2. Integrations -> Webhooks -> New Webhook
3. Copy the webhook URL
4. Paste it in the web UI when adding a route

### Email

The app uses SMTP to send emails. Configure these in `.env`:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

For Gmail, create an App Password at https://myaccount.google.com/apppasswords

## Deployment

### Option 1: Vercel (easiest for frontend + API)

1. Push this repo to GitHub
2. Import it in Vercel
3. Set `Root Directory` to `backend`
4. Add environment variables in Vercel dashboard
5. Add a PostgreSQL database (Neon, Supabase, or Vercel Postgres)
6. Set `DATABASE_URL` environment variable
7. Vercel Cron Jobs will trigger price checks hourly (configured in `vercel.json`)

### Option 2: Docker (VPS - recommended for full 24/7 monitoring)

```bash
# Build and run with docker-compose
docker compose up -d
```

Or deploy to any VPS (Hetzner, DigitalOcean, etc.) for full 24/7 background monitoring.

### Option 3: Railway / Fly.io

These platforms support long-running processes, which is ideal for the built-in cron scheduler.

## Development Workflow

```bash
# 1. Start from main
git checkout main
git pull

# 2. Create a feature branch
git checkout -b feat/my-feature

# 3. Make changes, commit using conventional commits
git add .
git commit -m "feat: add description of the feature"

# 4. Push and create a Pull Request
git push -u origin feat/my-feature

# 5. After PR is merged, delete the branch
git checkout main
git pull
git branch -d feat/my-feature
```

### CI/CD Pipelines

| Pipeline | Trigger | What it does |
|----------|---------|--------------|
| **CI** | Every push & PR to main | TypeScript check, build, Docker build, security audit |
| **Deploy** | Push to main | Builds Docker image, pushes to GHCR, deploys to VPS |

Secrets required for deployment (configure in GitHub repo Settings > Secrets and variables > Actions):

| Secret | Purpose |
|--------|---------|
| `VPS_HOST` | VPS IP address |
| `VPS_USER` | SSH username |
| `VPS_SSH_KEY` | SSH private key |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SERPAPI_API_KEY` | Yes | SerpApi key for flight data |
| `SMTP_HOST` | For email | SMTP server hostname |
| `SMTP_PORT` | For email | SMTP server port |
| `SMTP_USER` | For email | SMTP username |
| `SMTP_PASS` | For email | SMTP password |
| `DATABASE_URL` | No | PostgreSQL connection string (defaults to SQLite) |
| `CRON_SECRET` | For Vercel | Secret to secure cron endpoints |
| `PORT` | No | Server port (default: 3001) |

## Project Structure

```
flight-sniper/
  backend/            # Node.js + TypeScript backend
    src/
      index.ts        # Server entry point
      app.ts          # Express app (shared between serverless and server)
      scheduler.ts    # Cron-based price checker
      routes/         # API route handlers
      alerts/         # Discord and email notification senders
      api/            # Flight data providers (SerpApi, scrapers)
      db/             # Database layer (SQLite + PostgreSQL adapters)
  frontend/           # Web UI
    index.html
    css/style.css
    js/app.js
  api/                # Vercel serverless function entry points
  Dockerfile          # Containerized deployment
  docker-compose.yml
  vercel.json         # Vercel deployment configuration
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Health check |
| GET | /api/routes | List all monitored routes |
| POST | /api/routes | Add a new route to monitor |
| PUT | /api/routes/:id | Update a route |
| DELETE | /api/routes/:id | Remove a route |
| GET | /api/routes/:id/history | Get price history for a route |

## License

MIT


