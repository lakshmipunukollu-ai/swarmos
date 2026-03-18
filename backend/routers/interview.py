import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from models import SessionLocal, InterviewSession, InterviewMessage, Project
from services.interview_engine import (
    get_opening_message, get_next_question, complete_interview,
    get_defend_question, evaluate_defense
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


class DefendRequest(BaseModel):
    project_id: str
    file_path: str
    code_snippet: str
    question_focus: str = "what"  # what, why, change, weakness


class DefendEvalRequest(BaseModel):
    project_id: str
    file_path: str
    code_snippet: str
    question: str
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


@router.post("/defend/question")
def get_defend_challenge(req: DefendRequest):
    """Get a 'defend your code' question for a specific code snippet."""
    valid_focuses = ["what", "why", "change", "weakness"]
    if req.question_focus not in valid_focuses:
        raise HTTPException(400, f"Invalid focus. Choose from: {valid_focuses}")
    result = get_defend_question(req.project_id, req.file_path, req.code_snippet, req.question_focus)
    return result


@router.post("/defend/evaluate")
def evaluate_defend(req: DefendEvalRequest):
    """Evaluate a candidate's defense of their code."""
    result = evaluate_defense(req.question, req.code_snippet, req.answer, req.project_id)
    return result


@router.get("/ai-defense-prep")
def get_ai_defense_prep():
    """
    Returns prepared answers for the 'did AI write this for you?' question
    and other common objections about AI-assisted development.
    These are conversation starters — the candidate should personalize them.
    """
    return {
        "objections": [
            {
                "question": "Did AI write all of this code for you?",
                "framework": "Acknowledge + Reframe + Prove",
                "answer": "I used AI as a tool throughout — the same way engineers use Stack Overflow, documentation, or code review from colleagues. Every architectural decision, every bug I debugged, every tradeoff I made was mine. In fact I built a quiz system specifically to make sure I can explain every line of code I shipped. Want me to walk you through the authentication flow or the database schema?",
                "key_points": [
                    "Compare to other accepted tools (Stack Overflow, docs, code review)",
                    "Emphasize ownership of decisions not just keystrokes",
                    "Offer to prove understanding on the spot",
                    "Turn it into a demonstration of confidence"
                ]
            },
            {
                "question": "How much of this did you actually understand vs just copy-paste?",
                "framework": "Be honest + Show depth",
                "answer": "Honestly, some parts I understood deeply from the start, others I had to dig into after they were written. What I care about is getting to full understanding — which is why I built a code walkthrough tool that quizzes me line by line on my own codebase. I can tell you why we used Redis for session caching instead of Postgres, why the API is structured the way it is, and what I'd change now that I've had time to reflect.",
                "key_points": [
                    "Honesty builds trust more than claiming perfect knowledge",
                    "Show you actively pursued understanding",
                    "Have 2-3 specific technical decisions ready to discuss",
                ]
            },
            {
                "question": "Anyone can vibe-code a project. What makes you different?",
                "framework": "Agree + Elevate",
                "answer": "That's true — generating a project is easy. What's hard is knowing why every decision was made, what breaks first at scale, and how to extend it. I spent as much time studying these projects as I did building them. I can defend every architectural decision, explain the tradeoffs I'd make differently, and discuss how I'd scale each one. The code is a starting point — the understanding is what I'm bringing to this role.",
                "key_points": [
                    "Agree that the bar is higher than just having the code",
                    "Show you went beyond generation to comprehension",
                    "Pivot to what you uniquely bring"
                ]
            }
        ],
        "preparation_tips": [
            "Have 2-3 specific technical decisions per project memorized with the WHY",
            "Practice explaining one complex feature without looking at code",
            "Know the one thing you'd change about each project and why",
            "Be ready to live-debug or extend code on the spot if asked"
        ]
    }
