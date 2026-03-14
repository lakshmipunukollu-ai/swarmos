from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
from models import create_tables, SessionLocal, Project
from seed_data import GAUNTLET_PROJECTS
from routers import projects, quiz, intake
from services.watcher import sync_project_status


async def watch_projects():
    while True:
        try:
            sync_project_status()
        except Exception as e:
            print(f"Watcher error: {e}")
        await asyncio.sleep(10)


def seed_if_empty():
    db = SessionLocal()
    try:
        count = db.query(Project).count()
        if count == 0:
            for data in GAUNTLET_PROJECTS:
                project = Project(**data)
                db.add(project)
            db.commit()
            print(f"Seeded {len(GAUNTLET_PROJECTS)} Gauntlet projects")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    seed_if_empty()
    task = asyncio.create_task(watch_projects())
    yield
    task.cancel()


app = FastAPI(title="SwarmOS API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://swarmos.railway.app", "*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(quiz.router)
app.include_router(intake.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "swarmos-backend"}


@app.get("/")
def root():
    return {"message": "SwarmOS API", "docs": "/docs"}
