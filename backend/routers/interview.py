from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from models import SessionLocal, InterviewSession, InterviewMessage, Project
from services.interview_engine import (
    get_opening_message,
    get_next_question,
    complete_interview,
)

router = APIRouter(prefix="/api/interview", tags=["interview"])


class StartRequest(BaseModel):
    project_id: str
    interview_type: str  # behavioral, technical, coding, system_design
    difficulty: str = "balanced"  # coaching, balanced, faang


class AnswerRequest(BaseModel):
    session_id: int
    answer: str


@router.post("/start")
def start_interview(req: StartRequest):
    """Start a new interview session and return the opening question."""
    valid_types = ["behavioral", "technical", "coding", "system_design"]
    valid_difficulties = ["coaching", "balanced", "faang"]

    if req.interview_type not in valid_types:
        raise HTTPException(400, f"Invalid type. Choose from: {valid_types}")
    if req.difficulty not in valid_difficulties:
        raise HTTPException(400, f"Invalid difficulty. Choose from: {valid_difficulties}")

    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.id == req.project_id).first()
        if not project:
            raise HTTPException(404, "Project not found")

        # Create session
        session = InterviewSession(
            project_id=req.project_id,
            interview_type=req.interview_type,
            difficulty=req.difficulty,
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        # Get opening question
        opening = get_opening_message(req.project_id, req.interview_type, req.difficulty)

        # Save opening message
        msg = InterviewMessage(
            session_id=session.id,
            role="interviewer",
            content=opening,
        )
        db.add(msg)
        db.commit()

        return {
            "session_id": session.id,
            "project_id": req.project_id,
            "interview_type": req.interview_type,
            "difficulty": req.difficulty,
            "opening_message": opening,
        }
    finally:
        db.close()


@router.post("/answer")
def submit_answer(req: AnswerRequest):
    """Submit a candidate answer and get the next interviewer question."""
    if not req.answer.strip():
        raise HTTPException(400, "Answer cannot be empty")

    db = SessionLocal()
    try:
        session = db.query(InterviewSession).filter(
            InterviewSession.id == req.session_id
        ).first()
        if not session:
            raise HTTPException(404, "Session not found")
        if session.status == "completed":
            raise HTTPException(400, "Interview already completed")

        result = get_next_question(
            session_id=req.session_id,
            candidate_answer=req.answer,
            project_id=session.project_id,
            interview_type=session.interview_type,
            difficulty=session.difficulty,
        )
        return result
    finally:
        db.close()


@router.post("/complete/{session_id}")
def finish_interview(session_id: int):
    """Complete the interview and get final score + feedback."""
    result = complete_interview(session_id)
    return result


@router.get("/sessions/{project_id}")
def get_sessions(project_id: str):
    """Get past interview sessions for a project."""
    db = SessionLocal()
    try:
        sessions = db.query(InterviewSession).filter(
            InterviewSession.project_id == project_id
        ).order_by(InterviewSession.created_at.desc()).limit(10).all()

        return [{
            "id": s.id,
            "interview_type": s.interview_type,
            "difficulty": s.difficulty,
            "status": s.status,
            "score": s.score,
            "feedback": s.feedback,
            "created_at": s.created_at.isoformat(),
        } for s in sessions]
    finally:
        db.close()


@router.get("/session/{session_id}/messages")
def get_messages(session_id: int):
    """Get all messages for an interview session."""
    db = SessionLocal()
    try:
        messages = db.query(InterviewMessage).filter(
            InterviewMessage.session_id == session_id
        ).order_by(InterviewMessage.created_at).all()

        return [{
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "evaluation": m.evaluation,
            "created_at": m.created_at.isoformat(),
        } for m in messages]
    finally:
        db.close()
