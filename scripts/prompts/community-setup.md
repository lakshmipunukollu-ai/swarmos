# SwarmOS Community — Public Version Setup

Make only the changes listed. Do not touch any other files.

## Fix 1 — backend/seed_data.py: empty the project list

File: `backend/seed_data.py`

Replace the entire file with:
```python
GAUNTLET_PROJECTS = []
```

## Fix 2 — Create README.md at repo root

File: `README.md`
```markdown
# SwarmOS Community

An AI-powered project control plane for studying and interview prep.

## Stack
- Frontend: Next.js 14, TypeScript
- Backend: FastAPI, PostgreSQL
- AI: Anthropic Claude API

## Setup
1. cp .env.example .env
2. Fill in ANTHROPIC_API_KEY and DATABASE_URL
3. cd backend && uvicorn main:app --reload --port 8000
4. cd frontend && npm run dev
```
