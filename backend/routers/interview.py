import json
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
    interview_type: str
    difficulty: str = "balanced"
    target_company: str = ""


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
            target_company=req.target_company,
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        # Get opening question
        opening = get_opening_message(req.project_id, req.interview_type, req.difficulty, req.target_company)

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
            "target_company": req.target_company,
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
            target_company=session.target_company or "",
        )
        return result
    finally:
        db.close()


@router.post("/complete/{session_id}")
def finish_interview(session_id: int):
    """Complete the interview and get final score + feedback."""
    result = complete_interview(session_id)
    return result


@router.get("/answers/{project_id}")
def get_answer_library(project_id: str):
    """Get all saved candidate answers with their evaluations, sorted by score."""
    db = SessionLocal()
    try:
        # Get all completed sessions for this project
        sessions = db.query(InterviewSession).filter(
            InterviewSession.project_id == project_id,
            InterviewSession.status == "completed"
        ).all()
        session_ids = [s.id for s in sessions]

        if not session_ids:
            return {"answers": []}

        # Get all candidate messages with evaluations
        messages = db.query(InterviewMessage).filter(
            InterviewMessage.session_id.in_(session_ids),
            InterviewMessage.role == "candidate",
            InterviewMessage.evaluation != "",
            InterviewMessage.evaluation != "{}",
        ).order_by(InterviewMessage.created_at.desc()).all()

        answers = []
        for msg in messages:
            try:
                eval_data = json.loads(msg.evaluation) if msg.evaluation else {}
                if not eval_data.get("score"):
                    continue
                # Get the question (previous interviewer message)
                prev = db.query(InterviewMessage).filter(
                    InterviewMessage.session_id == msg.session_id,
                    InterviewMessage.role == "interviewer",
                    InterviewMessage.id < msg.id,
                ).order_by(InterviewMessage.id.desc()).first()

                session = next((s for s in sessions if s.id == msg.session_id), None)
                answers.append({
                    "id": msg.id,
                    "question": prev.content if prev else "",
                    "answer": msg.content,
                    "score": eval_data.get("score", 0),
                    "strengths": eval_data.get("strengths", []),
                    "weaknesses": eval_data.get("weaknesses", []),
                    "ideal_answer": eval_data.get("ideal_answer", ""),
                    "tip": eval_data.get("tip", ""),
                    "interview_type": session.interview_type if session else "",
                    "created_at": msg.created_at.isoformat(),
                })
            except Exception:
                continue

        answers.sort(key=lambda x: x["score"], reverse=True)
        return {"answers": answers}
    finally:
        db.close()


@router.get("/weak-spots/{project_id}")
def get_weak_spots(project_id: str):
    """Analyze all interview sessions to find consistent weak areas."""
    db = SessionLocal()
    try:
        sessions = db.query(InterviewSession).filter(
            InterviewSession.project_id == project_id,
            InterviewSession.status == "completed"
        ).all()

        if not sessions:
            return {"weak_spots": [], "message": "Complete at least one interview session to see weak spots."}

        session_ids = [s.id for s in sessions]
        messages = db.query(InterviewMessage).filter(
            InterviewMessage.session_id.in_(session_ids),
            InterviewMessage.role == "candidate",
        ).all()

        # Collect scores by interview type
        type_scores: dict = {}
        for msg in messages:
            try:
                if not msg.evaluation:
                    continue
                eval_data = json.loads(msg.evaluation)
                score = eval_data.get("score", 0)
                if not score:
                    continue
                session = next((s for s in sessions if s.id == msg.session_id), None)
                if not session:
                    continue
                itype = session.interview_type
                if itype not in type_scores:
                    type_scores[itype] = []
                type_scores[itype].append({
                    "score": score,
                    "weaknesses": eval_data.get("weaknesses", []),
                })
            except Exception:
                continue

        weak_spots = []
        for itype, scores in type_scores.items():
            avg = sum(s["score"] for s in scores) / len(scores)
            all_weaknesses = [w for s in scores for w in s["weaknesses"]]

            # Find most common weakness themes
            from collections import Counter
            weakness_counts = Counter(all_weaknesses)
            top_weaknesses = [w for w, _ in weakness_counts.most_common(3)]

            weak_spots.append({
                "interview_type": itype,
                "avg_score": round(avg),
                "sessions_count": len(scores),
                "top_weaknesses": top_weaknesses,
                "needs_work": avg < 70,
            })

        weak_spots.sort(key=lambda x: x["avg_score"])
        return {"weak_spots": weak_spots}
    finally:
        db.close()


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
