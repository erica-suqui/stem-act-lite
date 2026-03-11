# Docker + API Setup (FastAPI + Next.js)

## 1. Start Postgres
1. `cd stemApp/db`
2. `docker compose up -d`

## 2. Apply schema and migration
1. `docker exec -i stemact_postgres psql -U stemact_user -d stemact < schema.sql`
2. `docker exec -i stemact_postgres psql -U stemact_user -d stemact < migrations/2026-02-27-ui-values.sql`

## 3. Start FastAPI backend
1. `cd ../backend`
2. `python3 -m venv .venv` (only first time)
3. `source .venv/bin/activate`
4. `pip install -r requirements.txt`
5. Ensure `backend/.env` contains:
   - `DATABASE_URL=postgresql://stemact_user:stemact_pass@127.0.0.1:5433/stemact`
   - `CORS_ALLOW_ORIGINS=http://localhost:3000,http://127.0.0.1:3000`
   - `APP_BASE_URL=http://localhost:3000`
6. Run API: `python -m uvicorn api.main:app --reload --port 8000`

## 4. Start Next.js frontend
1. `cd ../`
2. `npm install`
3. Ensure `stemApp/.env.local` contains:
   - `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`
4. Run frontend: `npm run dev`

## 5. Health checks
- API: `http://localhost:8000/health`
- API + DB: `http://localhost:8000/health/db`
