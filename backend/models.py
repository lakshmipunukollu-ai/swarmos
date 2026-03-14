from sqlalchemy import Column, String, Integer, DateTime, Text, Enum as SAEnum, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timezone
import enum
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://ghostfolio@localhost:5432/swarmos")
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


class ProjectStatus(enum.Enum):
    queued = "queued"
    building = "building"
    testing = "testing"
    done = "done"
    error = "error"


class Project(Base):
    __tablename__ = "projects"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    company = Column(String, nullable=False)
    stack = Column(String, nullable=False)
    port = Column(Integer, default=0)
    status = Column(SAEnum(ProjectStatus), default=ProjectStatus.queued)
    phase = Column(String, default="")
    files_count = Column(Integer, default=0)
    live_url = Column(String, default="")
    github_url = Column(String, default="")
    last_log = Column(Text, default="")
    build_summary = Column(Text, default="")
    estimated_minutes = Column(Integer, default=120)
    elapsed_seconds = Column(Integer, default=0)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class BuildLog(Base):
    __tablename__ = "build_logs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    level = Column(String, default="info")
    phase = Column(String, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(String, nullable=False)
    question_type = Column(String, nullable=False)
    level = Column(Integer, default=1)
    question = Column(Text, nullable=False)
    correct_answer = Column(Text, nullable=False)
    explanation = Column(Text, default="")
    times_shown = Column(Integer, default=0)
    times_correct = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"
    id = Column(Integer, primary_key=True, autoincrement=True)
    question_id = Column(Integer, nullable=False)
    project_id = Column(String, nullable=False)
    user_answer = Column(Text, default="")
    is_correct = Column(Integer, default=0)
    needs_review = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine)