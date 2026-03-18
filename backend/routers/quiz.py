import json
import os
import os as _os
import anthropic as _anthropic
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models import get_db, SessionLocal, Project, QuizQuestion, QuizAttempt
from services.quiz_engine import generate_questions, get_next_question, record_attempt, generate_code_walkthrough
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


@router.get("/files/{project_id}")
def list_project_files(project_id: str):
    """Returns list of source files available for code walkthrough."""
    projects_dir = os.getenv("SWARM_PROJECTS_DIR", os.path.expanduser("~/gauntlet-swarm/projects"))
    project_path = Path(projects_dir) / project_id

    if not project_path.exists():
        return {"files": []}

    SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv", ".next",
                 "dist", "build", ".gradle", "target"}
    IMPORTANT_EXTS = {".py", ".ts", ".tsx", ".js", ".jsx", ".java", ".go",
                      ".rs", ".rb", ".cs", ".md"}

    files = []
    for root, dirs, fnames in os.walk(project_path):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for fname in fnames:
            fpath = Path(root) / fname
            if fpath.suffix.lower() in IMPORTANT_EXTS:
                rel = str(fpath.relative_to(project_path))
                size = fpath.stat().st_size
                if size > 100:
                    files.append({"path": rel, "size": size})

    files.sort(key=lambda f: f["size"], reverse=True)
    return {"files": files[:30]}


@router.post("/walkthrough")
def code_walkthrough(project_id: str, file_path: str):
    """Generates line-by-line teaching questions for a specific source file."""
    questions = generate_code_walkthrough(project_id, file_path)
    return {"questions": questions}


@router.get("/error-analysis/{project_id}")
def get_error_analysis(project_id: str, db: Session = Depends(get_db)):
    """
    Analyzes quiz attempts to find recurring weak areas across all question types.
    Returns pattern analysis, not just counts.
    """
    import json as json_lib
    from collections import Counter

    attempts = db.query(QuizAttempt).filter(
        QuizAttempt.project_id == project_id,
        QuizAttempt.is_correct == 0,
    ).all()

    if not attempts:
        return {"patterns": [], "message": "No incorrect answers yet — keep quizzing!"}

    # Get question details for wrong attempts
    question_ids = [a.question_id for a in attempts]
    questions = db.query(QuizQuestion).filter(
        QuizQuestion.id.in_(question_ids)
    ).all()
    q_map = {q.id: q for q in questions}

    # Group by question type
    type_counts: dict = {}
    level_counts: dict = {}
    for attempt in attempts:
        q = q_map.get(attempt.question_id)
        if not q:
            continue
        type_counts[q.question_type] = type_counts.get(q.question_type, 0) + 1
        level_counts[q.level] = level_counts.get(q.level, 0) + 1

    # Find questions with lowest accuracy
    worst_questions = sorted(
        [q for q in questions if q.times_shown > 0],
        key=lambda q: q.times_correct / max(q.times_shown, 1)
    )[:5]

    patterns = []
    for qtype, count in sorted(type_counts.items(), key=lambda x: -x[1]):
        total_of_type = db.query(QuizAttempt).join(
            QuizQuestion, QuizAttempt.question_id == QuizQuestion.id
        ).filter(
            QuizAttempt.project_id == project_id,
            QuizQuestion.question_type == qtype,
        ).count()

        accuracy = round((1 - count / max(total_of_type, 1)) * 100) if total_of_type > 0 else 0
        patterns.append({
            "type": qtype,
            "wrong_count": count,
            "total": total_of_type,
            "accuracy": accuracy,
            "needs_work": accuracy < 70,
        })

    return {
        "patterns": patterns,
        "worst_questions": [{
            "question": q.question[:120],
            "type": q.question_type,
            "accuracy": round(q.times_correct / max(q.times_shown, 1) * 100),
            "times_shown": q.times_shown,
        } for q in worst_questions],
        "hardest_level": max(level_counts, key=level_counts.get) if level_counts else None,
        "total_wrong": len(attempts),
    }


@router.get("/file-content/{project_id}")
def get_file_content(project_id: str, file_path: str):
    """Returns the raw content of a source file for side-by-side display."""
    projects_dir = os.getenv("SWARM_PROJECTS_DIR", os.path.expanduser("~/gauntlet-swarm/projects"))
    full_path = Path(projects_dir) / project_id / file_path

    if not full_path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")

    try:
        content = full_path.read_text(errors="replace")
        lines = content.splitlines()
        return {
            "file_path": file_path,
            "content": content,
            "lines": lines,
            "line_count": len(lines),
            "language": _detect_language(file_path),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _detect_language(file_path: str) -> str:
    ext = file_path.rsplit(".", 1)[-1].lower() if "." in file_path else ""
    return {
        "py": "python", "ts": "typescript", "tsx": "typescript",
        "js": "javascript", "jsx": "javascript", "java": "java",
        "go": "go", "rs": "rust", "rb": "ruby", "cs": "csharp",
        "md": "markdown", "yaml": "yaml", "yml": "yaml",
        "json": "json", "toml": "toml", "sh": "bash",
    }.get(ext, "text")


class ExplainTermRequest(BaseModel):
    term: str
    context_code: str
    project_id: str
    depth: str = "simple"  # simple, detailed, example


@router.post("/explain-term")
def explain_term(req: ExplainTermRequest):
    """
    Explains a code term or concept in plain English.
    depth: simple=12-year-old explanation, detailed=full explanation, example=show code example
    """
    ai_client = _anthropic.Anthropic(api_key=_os.getenv("ANTHROPIC_API_KEY"))

    depth_prompts = {
        "simple": "Explain this in the simplest possible terms, like you're talking to a 12-year-old who has never coded. Use an analogy from everyday life. Keep it under 3 sentences.",
        "detailed": "Give a thorough technical explanation covering: what it is, why it exists, how it works, and when to use it vs alternatives. Keep it under 150 words.",
        "example": "Show a simple, isolated code example that demonstrates this concept clearly. Use 10-15 lines max. Add a one-line comment on each important line."
    }

    try:
        response = ai_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=400,
            messages=[{"role": "user", "content": f"""You are a coding tutor explaining a concept to someone learning.

Term/concept: {req.term}
Context (where they saw it):
{req.context_code[:500]}

{depth_prompts[req.depth]}

Be concrete and specific to the context shown."""}]
        )
        return {
            "term": req.term,
            "depth": req.depth,
            "explanation": response.content[0].text.strip(),
        }
    except Exception as e:
        raise HTTPException(500, f"Explanation failed: {str(e)}")


class CodeChatMessage(BaseModel):
    role: str
    content: str


class CodeChatRequest(BaseModel):
    project_id: str
    file_path: str
    file_content: str
    question: str
    history: list[CodeChatMessage] = []


@router.post("/code-chat")
def code_chat(req: CodeChatRequest):
    """
    Answers questions about a specific source file in context.
    Maintains conversation history for back-and-forth Q&A.
    Also flags if the question reveals a knowledge gap worth adding to quiz.
    """
    ai_client = _anthropic.Anthropic(api_key=_os.getenv("ANTHROPIC_API_KEY"))

    # Build conversation history
    messages = []
    for msg in req.history[-10:]:  # keep last 10 messages for context
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": req.question})

    try:
        response = ai_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=600,
            system=f"""You are a senior engineer helping someone deeply understand their own code.

File: {req.file_path}
Project: {req.project_id}

FILE CONTENT:
{req.file_content[:3000]}

Answer questions about this specific file. Be concrete — reference actual line numbers,
function names, and variable names from the code. If the question is about a concept
(like "what is JWT"), explain it simply then show how it's used in THIS file specifically.

After answering, if the question reveals a gap in understanding that would be valuable
to quiz on, add a line at the very end: QUIZ_WORTHY: [short topic description]""",
            messages=messages
        )

        answer = response.content[0].text.strip()

        # Check if quiz-worthy
        quiz_worthy = None
        if "QUIZ_WORTHY:" in answer:
            parts = answer.split("QUIZ_WORTHY:")
            answer = parts[0].strip()
            quiz_worthy = parts[1].strip()

        return {
            "answer": answer,
            "quiz_worthy": quiz_worthy,
        }
    except Exception as e:
        raise HTTPException(500, f"Chat failed: {str(e)}")


class FeynmanRequest(BaseModel):
    project_id: str
    concept: str
    explanation: str


@router.post("/feynman")
def evaluate_feynman(req: FeynmanRequest):
    """
    Evaluates a Feynman technique explanation.
    The candidate explains a concept in plain English as if to a non-engineer.
    Claude scores whether a non-technical person would actually understand it.
    """
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.id == req.project_id).first()
        project_name = project.name if project else req.project_id
        stack = project.stack if project else ""
    finally:
        db.close()

    ai_client = _anthropic.Anthropic(api_key=_os.getenv("ANTHROPIC_API_KEY"))
    try:
        response = ai_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=800,
            messages=[{"role": "user", "content": f"""You are evaluating a software engineer's ability to explain technical concepts simply.

PROJECT: {project_name} ({stack})
CONCEPT THEY ARE EXPLAINING: {req.concept}

THEIR EXPLANATION:
{req.explanation}

Evaluate this as if you are a curious 12-year-old who has never coded.
Would you actually understand what they're talking about after reading this?

Score on:
1. Clarity — could a non-engineer follow this?
2. Accuracy — is the explanation technically correct?
3. Analogy quality — did they use a good real-world comparison?
4. Completeness — did they cover the key idea?

Respond with JSON only:
{{
  "score": 0-100,
  "would_12yo_understand": true/false,
  "clarity_score": 0-100,
  "accuracy_score": 0-100,
  "what_worked": "what made this explanation good",
  "what_confused": "what would confuse a non-engineer",
  "better_analogy": "a clearer everyday analogy for this concept",
  "simpler_version": "how to explain the same thing in 2 sentences a non-engineer would understand"
}}"""}]
        )
        text = response.content[0].text.strip().replace("```json", "").replace("```", "").strip()
        return json.loads(text)
    except Exception as e:
        raise HTTPException(500, f"Feynman evaluation failed: {str(e)}")


class AdaptiveQuizRequest(BaseModel):
    project_id: str
    chat_topics: list[str] = []  # topics from code chat Q&A


@router.post("/adaptive-generate")
def adaptive_generate(req: AdaptiveQuizRequest):
    """
    Generates quiz questions based on:
    1. Topics the user researched during code walkthrough (chat_topics)
    2. Questions they historically get wrong (from QuizAttempt)
    3. Concepts from the build summary they haven't been tested on yet
    """
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.id == req.project_id).first()
        if not project:
            return {"questions": []}

        # Find weak question types
        wrong_attempts = db.query(QuizAttempt).filter(
            QuizAttempt.project_id == req.project_id,
            QuizAttempt.is_correct == 0,
        ).all()

        weak_question_ids = [a.question_id for a in wrong_attempts]
        weak_questions = db.query(QuizQuestion).filter(
            QuizQuestion.id.in_(weak_question_ids)
        ).all() if weak_question_ids else []

        weak_topics = list(set([q.question_type for q in weak_questions]))
        focus_type = weak_topics[0] if weak_topics else "architecture"

        # Build context from chat topics
        chat_context = ""
        if req.chat_topics:
            chat_context = f"\n\nThe candidate has been researching these topics during code review — generate questions specifically about these: {', '.join(req.chat_topics)}"

        build_summary = project.build_summary or ""

        import anthropic as _ant
        import os as _os
        import json as _json

        ai_client = _ant.Anthropic(api_key=_os.getenv("ANTHROPIC_API_KEY"))
        response = ai_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            messages=[{"role": "user", "content": f"""Generate 5 adaptive quiz questions for this project.

PROJECT: {project.name} ({project.company})
STACK: {project.stack}
BUILD SUMMARY: {build_summary[:2000]}

WEAK AREAS (focus here): {', '.join(weak_topics) if weak_topics else 'general understanding'}{chat_context}

Generate questions that specifically target the weak areas and researched topics.
Mix levels 1-3. Make wrong answers plausible.

Respond with JSON array only:
[{{
  "question": "...",
  "correct_answer": "...",
  "wrong_answers": ["...", "...", "..."],
  "explanation": "...",
  "level": 1-3,
  "type": "architecture|code|system_design|flashcard",
  "topic": "specific topic this tests"
}}]"""}]
        )

        text = response.content[0].text.strip().replace("```json", "").replace("```", "").strip()
        questions_data = _json.loads(text)

        saved = []
        for q in questions_data:
            question = QuizQuestion(
                project_id=req.project_id,
                question_type=q.get("type", "architecture"),
                level=q.get("level", 1),
                question=q["question"],
                correct_answer=q["correct_answer"],
                wrong_answers=_json.dumps(q.get("wrong_answers", [])),
                explanation=q.get("explanation", ""),
            )
            db.add(question)
            db.flush()
            saved.append({
                "id": question.id,
                "question": question.question,
                "correct_answer": question.correct_answer,
                "wrong_answers": _json.loads(question.wrong_answers),
                "explanation": question.explanation,
                "level": question.level,
                "type": question.question_type,
                "topic": q.get("topic", ""),
            })
        db.commit()
        return {"questions": saved, "focused_on": weak_topics, "chat_topics_used": req.chat_topics}
    except Exception as e:
        print(f"Adaptive quiz error: {e}")
        return {"questions": [], "error": str(e)}
    finally:
        db.close()
