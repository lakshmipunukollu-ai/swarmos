from sqlalchemy import Column, String, Integer, DateTime, Text, Enum as SAEnum, create_engine, text, inspect
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timezone
import enum
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://swarmos:swarmos123@localhost:5432/swarmos")
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
    hiring_notes = Column(Text, default="")
    brief = Column(Text, default="")
    featured = Column(Integer, default=0)  # 0 = normal, 1 = featured/highlighted
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
    wrong_answers = Column(Text, default="[]")
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


class StudySession(Base):
    __tablename__ = "study_sessions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String, nullable=False)
    subject = Column(String, default="")
    content_type = Column(String, default="text")  # text, pdf, image, url
    raw_content = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class StudyQuestion(Base):
    __tablename__ = "study_questions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, nullable=False)
    question = Column(Text, nullable=False)
    correct_answer = Column(Text, nullable=False)
    wrong_answers = Column(Text, default="[]")
    explanation = Column(Text, default="")
    question_type = Column(String, default="multiple_choice")
    level = Column(Integer, default=1)
    times_shown = Column(Integer, default=0)
    times_correct = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class InterviewSession(Base):
    __tablename__ = "interview_sessions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(String, nullable=False)
    interview_type = Column(String, nullable=False)  # behavioral, technical, coding, system_design
    difficulty = Column(String, default="balanced")  # coaching, balanced, faang
    target_company = Column(String, default="")
    status = Column(String, default="active")  # active, completed
    score = Column(Integer, nullable=True)  # 0-100 final score
    feedback = Column(Text, default="")  # final feedback summary
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)


class InterviewMessage(Base):
    __tablename__ = "interview_messages"
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, nullable=False)
    role = Column(String, nullable=False)  # interviewer, candidate
    content = Column(Text, nullable=False)
    evaluation = Column(Text, default="")  # JSON: {score, strengths, weaknesses, tip}
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class WeakSpot(Base):
    __tablename__ = "weak_spots"
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(String, nullable=False)
    topic = Column(String, nullable=False)
    interview_type = Column(String, nullable=False)
    avg_score = Column(Integer, default=0)
    occurrences = Column(Integer, default=0)
    last_seen = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class StudyTimer(Base):
    __tablename__ = "study_timers"
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(String, nullable=False)
    session_type = Column(String, nullable=False)  # quiz, interview, walkthrough, study, defend
    duration_seconds = Column(Integer, default=0)
    questions_answered = Column(Integer, default=0)
    correct_answers = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


def create_tables():
    Base.metadata.create_all(bind=engine)
    insp = inspect(engine)

    # Add brief to projects if missing
    if "brief" not in [c["name"] for c in insp.get_columns("projects")]:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE projects ADD COLUMN brief TEXT DEFAULT ''"))
    

    if "featured" not in [c["name"] for c in insp.get_columns("projects")]:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE projects ADD COLUMN featured INTEGER DEFAULT 0"))
    

    # Add wrong_answers to quiz_questions if missing
    if "wrong_answers" not in [c["name"] for c in insp.get_columns("quiz_questions")]:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE quiz_questions ADD COLUMN wrong_answers TEXT DEFAULT '[]'"))
    

    if "hiring_notes" not in [c["name"] for c in insp.get_columns("projects")]:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE projects ADD COLUMN hiring_notes TEXT DEFAULT ''"))
    

    # Add target_company to interview_sessions if missing
    if "interview_sessions" in insp.get_table_names() and "target_company" not in [c["name"] for c in insp.get_columns("interview_sessions")]:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE interview_sessions ADD COLUMN target_company TEXT DEFAULT ''"))
    

    # Create new study tables if they don't exist
    Base.metadata.create_all(bind=engine)

    # Enable pgvector extension
    try:
        with engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    except Exception:
        pass  # pgvector not available on this system

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
