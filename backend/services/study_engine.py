import anthropic
import os
import json
from models import SessionLocal, StudySession, StudyQuestion

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


def fetch_url_content(url: str) -> str:
    """Fetch text content from a URL."""
    import urllib.request
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as response:
            html = response.read().decode("utf-8", errors="replace")
        # Strip HTML tags simply
        import re
        text = re.sub(r"<[^>]+>", " ", html)
        text = re.sub(r"\s+", " ", text).strip()
        return text[:8000]
    except Exception as e:
        return f"Could not fetch URL: {str(e)}"


def generate_study_questions(session_id: int, count: int = 10) -> list:
    """Generate quiz questions from a study session's content."""
    db = SessionLocal()
    try:
        session = db.query(StudySession).filter(StudySession.id == session_id).first()
        if not session:
            return []

        content = session.raw_content[:6000] if session.raw_content else ""
        subject = session.subject or "General"
        title = session.title or "Study Material"

        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=3000,
            messages=[{"role": "user", "content": f"""You are a study coach generating quiz questions to help someone learn.

SUBJECT: {subject}
MATERIAL TITLE: {title}
CONTENT:
{content}

Generate {count} quiz questions that test understanding of this material.
Mix question types: factual recall, conceptual understanding, application.
Make wrong answers plausible but clearly incorrect to someone who understands the material.

Respond with JSON array only (no markdown):
[{{
  "question": "...",
  "correct_answer": "...",
  "wrong_answers": ["...", "...", "..."],
  "explanation": "Why this is correct and what concept it tests",
  "question_type": "multiple_choice",
  "level": 1
}}]

Level guide: 1=recall, 2=understanding, 3=application"""}]
        )

        text = response.content[0].text.strip()
        text = text.replace("```json", "").replace("```", "").strip()
        questions_data = json.loads(text)

        saved = []
        for q in questions_data:
            question = StudyQuestion(
                session_id=session_id,
                question=q["question"],
                correct_answer=q["correct_answer"],
                wrong_answers=json.dumps(q.get("wrong_answers", [])),
                explanation=q.get("explanation", ""),
                question_type=q.get("question_type", "multiple_choice"),
                level=q.get("level", 1),
            )
            db.add(question)
            db.flush()
            saved.append({
                "id": question.id,
                "question": question.question,
                "correct_answer": question.correct_answer,
                "wrong_answers": json.loads(question.wrong_answers),
                "explanation": question.explanation,
                "level": question.level,
            })
        db.commit()
        return saved
    except Exception as e:
        print(f"Study question generation error: {e}")
        return []
    finally:
        db.close()


def create_session_from_text(title: str, subject: str, text: str) -> dict:
    db = SessionLocal()
    try:
        session = StudySession(
            title=title,
            subject=subject,
            content_type="text",
            raw_content=text[:10000],
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return {"id": session.id, "title": session.title, "subject": session.subject}
    finally:
        db.close()


def create_session_from_url(title: str, subject: str, url: str) -> dict:
    content = fetch_url_content(url)
    db = SessionLocal()
    try:
        session = StudySession(
            title=title,
            subject=subject,
            content_type="url",
            raw_content=content,
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return {"id": session.id, "title": session.title, "subject": session.subject}
    finally:
        db.close()


def create_session_from_pdf(title: str, subject: str, pdf_base64: str) -> dict:
    """Extract text from PDF using Claude's document reading."""
    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4000,
            messages=[{"role": "user", "content": [
                {
                    "type": "document",
                    "source": {
                        "type": "base64",
                        "media_type": "application/pdf",
                        "data": pdf_base64,
                    }
                },
                {
                    "type": "text",
                    "text": "Extract and summarize all the key content from this document. Include all important facts, concepts, definitions, and information that would be useful for studying. Be comprehensive."
                }
            ]}]
        )
        extracted = response.content[0].text.strip()
    except Exception as e:
        extracted = f"Could not extract PDF content: {str(e)}"

    db = SessionLocal()
    try:
        session = StudySession(
            title=title,
            subject=subject,
            content_type="pdf",
            raw_content=extracted[:10000],
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return {"id": session.id, "title": session.title, "subject": session.subject}
    finally:
        db.close()


def create_session_from_image(title: str, subject: str, image_base64: str, media_type: str = "image/jpeg") -> dict:
    """Extract text from image (handwritten notes, textbook photos) using Claude vision."""
    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4000,
            messages=[{"role": "user", "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": image_base64,
                    }
                },
                {
                    "type": "text",
                    "text": "Extract and transcribe all text and content from this image. If it's handwritten notes, transcribe them. If it's a textbook page, extract all the key content. Be comprehensive and include everything visible."
                }
            ]}]
        )
        extracted = response.content[0].text.strip()
    except Exception as e:
        extracted = f"Could not extract image content: {str(e)}"

    db = SessionLocal()
    try:
        session = StudySession(
            title=title,
            subject=subject,
            content_type="image",
            raw_content=extracted[:10000],
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return {"id": session.id, "title": session.title, "subject": session.subject}
    finally:
        db.close()


def get_session_questions(session_id: int) -> list:
    db = SessionLocal()
    try:
        questions = db.query(StudyQuestion).filter(
            StudyQuestion.session_id == session_id
        ).all()
        return [{
            "id": q.id,
            "question": q.question,
            "correct_answer": q.correct_answer,
            "wrong_answers": json.loads(q.wrong_answers or "[]"),
            "explanation": q.explanation,
            "level": q.level,
        } for q in questions]
    finally:
        db.close()


def record_study_attempt(question_id: int, is_correct: bool) -> dict:
    db = SessionLocal()
    try:
        q = db.query(StudyQuestion).filter(StudyQuestion.id == question_id).first()
        if not q:
            return {}
        q.times_shown += 1
        if is_correct:
            q.times_correct += 1
        db.commit()
        return {
            "is_correct": is_correct,
            "correct_answer": q.correct_answer,
            "explanation": q.explanation,
            "times_shown": q.times_shown,
            "times_correct": q.times_correct,
        }
    finally:
        db.close()
