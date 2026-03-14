# SwarmOS

AI engineering platform — build, track, and learn from agent-built projects.

## Features
- **Dashboard** — live status of all 9 Gauntlet projects with time estimates
- **Intake** — paste any project brief, AI analyzes and asks follow-ups
- **Quiz** — unlimited adaptive questions from your actual codebase. Never stop learning.

## Local setup

### 1. Start database
```bash
docker-compose up postgres redis -d
```

### 2. Backend
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.template .env
# edit .env — add ANTHROPIC_API_KEY and SWARM_PROJECTS_DIR
uvicorn main:app --reload --port 8000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

## Deploy to Railway
```bash
git add .
git commit -m "initial swarmos"
git push origin main
```
Railway auto-deploys on push.

## Environment variables (set in Railway dashboard)
- `ANTHROPIC_API_KEY` — your Anthropic key
- `DATABASE_URL` — auto-provided by Railway Postgres
- `SWARM_PROJECTS_DIR` — path to your gauntlet-swarm/projects folder
