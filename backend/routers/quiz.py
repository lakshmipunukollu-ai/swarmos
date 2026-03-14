from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from models import get_db, QuizQuestion, QuizAttempt
from services.quiz_engine import generate_questions, get_next_question, record_attempt
from pydantic import BaseModel

router = APIRouter(prefix="/api/quiz", tags=["quiz"])

class GenerateRequest(BaseModel):
    project_id: str
    question_type: str
    level: int = 1
    count: int = 3

class AttemptRequest(BaseModel):
    question_id: int
    project_id: str
    user_answer: str
    is_correct: bool

@router.post("/generate")
def generate(req: GenerateRequest):
    questions = generate_questions(req.project_id, req.question_type, req.level, req.count)
    return {"questions": questions}

@router.get("/next")
def next_question(project_id: str, question_type: str):
    question = get_next_question(project_id, question_type)
    return {"question": question}

@router.post("/attempt")
def submit_attempt(req: AttemptRequest):
    return record_attempt(req.question_id, req.project_id, req.user_answer, req.is_correct)

@router.get("/stats/{project_id}")
def get_stats(project_id: str, db: Session = Depends(get_db)):
    questions = db.query(QuizQuestion).filter(QuizQuestion.project_id == project_id).all()
    attempts = db.query(QuizAttempt).filter(QuizAttempt.project_id == project_id).all()
    correct = sum(1 for a in attempts if a.is_correct)
    return {
        "total_questions": len(questions),
        "total_attempts": len(attempts),
        "correct": correct,
        "accuracy": round(correct / max(len(attempts), 1) * 100),
    }
