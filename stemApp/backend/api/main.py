from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from .database import SessionLocal

app = FastAPI(title="STEM-ACT Backend")

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/health/db")
def health_db(db: Session = Depends(get_db)):
    result = db.execute(text("SELECT 1")).scalar()
    now = db.execute(text("SELECT now()")).scalar()

    return {
        "database": "connected",
        "check": result,
        "time": str(now)
    }
