from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.study_engine import (
    create_session_from_text,
    create_session_from_url,
    create_session_from_pdf,
    create_session_from_image,
    generate_study_questions,
    get_session_questions,
    record_study_attempt,
)
from models import SessionLocal, StudySession

router = APIRouter(prefix="/api/study", tags=["study"])


class TextUpload(BaseModel):
    title: str
    subject: str
    content: str


class UrlUpload(BaseModel):
    title: str
    subject: str
    url: str


class FileUpload(BaseModel):
    title: str
    subject: str
    file_base64: str
    media_type: str = "application/pdf"


class AttemptRequest(BaseModel):
    question_id: int
    is_correct: bool


@router.post("/upload/text")
def upload_text(req: TextUpload):
    if not req.content.strip():
        raise HTTPException(400, "Content cannot be empty")
    session = create_session_from_text(req.title, req.subject, req.content)
    questions = generate_study_questions(session["id"], count=10)
    return {"session": session, "questions": questions}


@router.post("/upload/url")
def upload_url(req: UrlUpload):
    if not req.url.startswith("http"):
        raise HTTPException(400, "Invalid URL")
    session = create_session_from_url(req.title, req.subject, req.url)
    questions = generate_study_questions(session["id"], count=10)
    return {"session": session, "questions": questions}


@router.post("/upload/pdf")
def upload_pdf(req: FileUpload):
    session = create_session_from_pdf(req.title, req.subject, req.file_base64)
    questions = generate_study_questions(session["id"], count=10)
    return {"session": session, "questions": questions}


@router.post("/upload/image")
def upload_image(req: FileUpload):
    session = create_session_from_image(
        req.title, req.subject, req.file_base64, req.media_type
    )
    questions = generate_study_questions(session["id"], count=10)
    return {"session": session, "questions": questions}


@router.get("/sessions")
def list_sessions():
    db = SessionLocal()
    try:
        sessions = db.query(StudySession).order_by(
            StudySession.created_at.desc()
        ).all()
        return [{
            "id": s.id,
            "title": s.title,
            "subject": s.subject,
            "content_type": s.content_type,
            "created_at": s.created_at.isoformat(),
        } for s in sessions]
    finally:
        db.close()


@router.get("/sessions/{session_id}/questions")
def get_questions(session_id: int):
    questions = get_session_questions(session_id)
    return {"questions": questions}


@router.post("/attempt")
def submit_attempt(req: AttemptRequest):
    return record_study_attempt(req.question_id, req.is_correct)
