docker setup for stem-act project

1. cd into stemApp/db

2. run command: docker compose up -d

3. run command: docker exec -i stemact_postgres psql -U stemact_user -d stemact < schema.sql (note that DB is exposed on port 5433)

4. Run API, cd into stemApp/backend

5. run command: source .venv/bin/activate

6. run: python -m uvicorn api.main:app --reload --port 8000

7. test in browser: http://localhost:8000/health - should return status OK in browser

8. test in browser: http://localhost:8000/health/db - should return status OK in browser
