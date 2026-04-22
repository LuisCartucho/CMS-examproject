from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import review, respond, session, history
from models.database import init_db

app = FastAPI(title="MedRadio-AI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(review.router,  prefix="/api")
app.include_router(respond.router, prefix="/api")
app.include_router(session.router, prefix="/api")
app.include_router(history.router, prefix="/api")

@app.on_event("startup")
def startup():
    init_db()

@app.get("/api/health")
def health():
    return {"status": "ok", "model": "medllama3"}