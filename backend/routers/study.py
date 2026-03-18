import json
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


class BraindumpRequest(BaseModel):
    project_id: str
    recall_text: str


@router.post("/braindump")
def check_braindump(req: BraindumpRequest):
    """
    Compares a candidate's brain dump against the project's build summary.
    Returns what they remembered, what they forgot, and feedback.
    """
    import anthropic as _anthropic
    import os as _os

    db = SessionLocal()
    try:
        from models import Project
        project = db.query(Project).filter(Project.id == req.project_id).first()
        if not project:
            raise HTTPException(404, "Project not found")
        if not project.build_summary:
            raise HTTPException(400, "No build summary for this project. Run Refresh first.")

        ai_client = _anthropic.Anthropic(api_key=_os.getenv("ANTHROPIC_API_KEY"))
        response = ai_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1000,
            messages=[{"role": "user", "content": f"""You are evaluating how well an engineer remembers their own project.

PROJECT: {project.name} ({project.company})
STACK: {project.stack}

BUILD SUMMARY (ground truth):
{project.build_summary[:3000]}

CANDIDATE'S RECALL:
{req.recall_text}

Compare what they wrote against the build summary. Be specific and constructive.

Respond with JSON only:
{{
  "score": 0-100,
  "remembered": ["specific accurate thing they recalled correctly - be specific, reference actual details"],
  "forgot": ["important thing from the build summary they completely missed"],
  "inaccurate": ["something they said that was wrong or imprecise"],
  "feedback": "2-3 sentence overall assessment. Be encouraging but honest about gaps."
}}"""}]
        )
        text = response.content[0].text.strip().replace("```json", "").replace("```", "").strip()
        result = json.loads(text)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Braindump check failed: {str(e)}")
    finally:
        db.close()
