import os
import json
import re
import urllib.request
import urllib.parse
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models import Project, BuildLog, ProjectStatus, get_db, QuizQuestion, QuizAttempt
from seed_data import GAUNTLET_PROJECTS
from services.watcher import import_all_project_logs
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/projects", tags=["projects"])

class ProjectUpdate(BaseModel):
    status: Optional[str] = None
    phase: Optional[str] = None
    live_url: Optional[str] = None
    github_url: Optional[str] = None

class ProjectCreate(BaseModel):
    id: str
    name: str
    company: str
    stack: str
    brief: Optional[str] = ""
    estimated_minutes: int = 120


class RailwayWebhookPayload(BaseModel):
    type: str = ""
    status: str = ""
    url: Optional[str] = None
    service: Optional[dict] = None
    deployment: Optional[dict] = None
    project: Optional[dict] = None
    environment: Optional[dict] = None


class GitHubImportRequest(BaseModel):
    repo_url: str
    company: str = ""
    brief: str = ""


def project_to_dict(p):
    elapsed = p.elapsed_seconds or 0
    estimated = (p.estimated_minutes or 120) * 60
    remaining = max(0, estimated - elapsed) if p.status == ProjectStatus.building else 0
    return {
        "id": p.id, "name": p.name, "company": p.company,
        "stack": p.stack, "port": p.port,
        "status": p.status.value if p.status else "queued",
        "phase": p.phase or "", "files_count": p.files_count or 0,
        "live_url": p.live_url or "", "github_url": p.github_url or "",
        "last_log": p.last_log or "",
        "estimated_minutes": p.estimated_minutes or 120,
        "elapsed_seconds": elapsed,
        "minutes_remaining": round(remaining / 60),
        "has_build_summary": bool(p.build_summary),
        "build_summary": p.build_summary or "",
        "hiring_notes": p.hiring_notes or "",
        "brief": p.brief or "",
        "featured": p.featured or 0,
        "started_at": p.started_at.isoformat() if p.started_at else None,
        "completed_at": p.completed_at.isoformat() if p.completed_at else None,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }

@router.get("/seed")
def seed_projects(db: Session = Depends(get_db)):
    count = 0
    for data in GAUNTLET_PROJECTS:
        if not db.query(Project).filter(Project.id == data["id"]).first():
            db.add(Project(**data))
            count += 1
    db.commit()
    return {"seeded": count}

@router.post("")
def create_project(data: ProjectCreate, db: Session = Depends(get_db)):
    if not re.match(r'^[a-z0-9][a-z0-9-]*[a-z0-9]$', data.id):
        raise HTTPException(status_code=400, detail="id must be lowercase letters, numbers, and hyphens only")
    if db.query(Project).filter(Project.id == data.id).first():
        raise HTTPException(status_code=409, detail=f"Project '{data.id}' already exists")
    project = Project(
        id=data.id,
        name=data.name,
        company=data.company,
        stack=data.stack,
        status=ProjectStatus.queued,
        phase="queued",
        estimated_minutes=data.estimated_minutes,
        brief=data.brief or "",
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project_to_dict(project)
    
@router.get("")
def list_projects(db: Session = Depends(get_db)):
    return [project_to_dict(p) for p in db.query(Project).order_by(Project.created_at).all()]


@router.post("/import-github")
def import_from_github(req: GitHubImportRequest, db: Session = Depends(get_db)):
    """
    Imports a project from a public GitHub repository.
    Fetches key source files, generates a build summary using Claude,
    and creates a new project entry ready for quiz and interview prep.
    """
    import anthropic as _ant
    import re as _re

    # Parse repo URL → owner/repo
    url = req.repo_url.rstrip("/").replace(".git", "")
    parts = url.split("github.com/")
    if len(parts) < 2:
        raise HTTPException(400, "Invalid GitHub URL. Use format: https://github.com/username/repo-name")

    owner_repo = parts[1].strip("/")
    parts2 = owner_repo.split("/")
    if len(parts2) < 2:
        raise HTTPException(400, "Could not parse owner/repo from URL")

    owner, repo = parts2[0], parts2[1]
    project_id = f"{owner}-{repo}".lower()[:50]
    project_id = _re.sub(r'[^a-z0-9-]', '-', project_id)
    project_id = _re.sub(r'-+', '-', project_id).strip('-')

    # Check if already exists
    existing = db.query(Project).filter(Project.id == project_id).first()
    if existing:
        raise HTTPException(409, f"Project '{project_id}' already exists. Delete it first to re-import.")

    # Fetch repo tree from GitHub API
    SKIP_DIRS = {"node_modules", ".git", ".next", "dist", "build", "__pycache__",
                 ".venv", "vendor", "target", ".gradle", "coverage"}
    IMPORTANT_EXTS = {".py", ".ts", ".tsx", ".js", ".jsx", ".java", ".go",
                      ".rs", ".rb", ".cs", ".md", ".yaml", ".yml", ".toml", ".json"}
    SKIP_FILES = {"package-lock.json", "yarn.lock", "poetry.lock", "Pipfile.lock"}

    def github_get(path: str) -> dict:
        api_url = f"https://api.github.com/{path}"
        req_obj = urllib.request.Request(
            api_url,
            headers={"Accept": "application/vnd.github.v3+json", "User-Agent": "SwarmOS/1.0"}
        )
        try:
            with urllib.request.urlopen(req_obj, timeout=10) as resp:
                import json as _json
                return _json.loads(resp.read().decode())
        except Exception as e:
            raise HTTPException(502, f"GitHub API error: {str(e)}")

    def fetch_file_content(download_url: str) -> str:
        try:
            req_obj = urllib.request.Request(
                download_url,
                headers={"User-Agent": "SwarmOS/1.0"}
            )
            with urllib.request.urlopen(req_obj, timeout=8) as resp:
                return resp.read().decode("utf-8", errors="replace")[:3000]
        except Exception:
            return ""

    # Get repo info
    try:
        repo_info = github_get(f"repos/{owner}/{repo}")
    except Exception:
        raise HTTPException(404, f"Repository {owner}/{repo} not found or is private")

    repo_name = repo_info.get("name", repo)
    repo_description = repo_info.get("description", "")
    default_branch = repo_info.get("default_branch", "main")
    language = repo_info.get("language", "")
    topics = repo_info.get("topics", [])

    # Get file tree (recursive)
    try:
        tree_data = github_get(f"repos/{owner}/{repo}/git/trees/{default_branch}?recursive=1")
    except Exception:
        raise HTTPException(502, "Could not fetch repository file tree")

    tree = tree_data.get("tree", [])

    # Filter to important files
    important_files = []
    for item in tree:
        if item.get("type") != "blob":
            continue
        path = item.get("path", "")
        filename = path.split("/")[-1]

        # Skip unwanted directories
        path_parts = path.split("/")
        if any(part in SKIP_DIRS for part in path_parts[:-1]):
            continue

        # Skip unwanted files
        if filename in SKIP_FILES:
            continue

        # Check extension
        ext = "." + path.rsplit(".", 1)[-1].lower() if "." in path else ""
        if ext not in IMPORTANT_EXTS:
            continue

        # Prioritize: README, main entry points, core logic files
        priority = 0
        if filename.lower() in ["readme.md", "build_summary.md", "architecture.md"]:
            priority = 10
        elif filename.lower() in ["main.py", "main.ts", "index.ts", "index.js", "app.py", "app.ts"]:
            priority = 8
        elif "model" in path.lower() or "schema" in path.lower():
            priority = 6
        elif "route" in path.lower() or "router" in path.lower() or "api" in path.lower():
            priority = 5
        elif ext in {".md", ".yaml", ".yml"}:
            priority = 3
        else:
            priority = 1

        important_files.append({
            "path": path,
            "url": item.get("url", ""),
            "priority": priority,
            "size": item.get("size", 0),
        })

    # Sort by priority, take top 20
    important_files.sort(key=lambda f: (-f["priority"], f["size"]))
    top_files = important_files[:20]

    # Fetch file contents
    collected_content = []
    collected_content_map = []  # {path, content} for RAG
    for file_info in top_files:
        try:
            file_data = github_get(f"repos/{owner}/{repo}/contents/{urllib.parse.quote(file_info['path'])}")
            download_url = file_data.get("download_url", "")
            if download_url:
                content = fetch_file_content(download_url)
                if content and len(content) > 50:
                    collected_content.append(f"=== {file_info['path']} ===\n{content}")
                    collected_content_map.append({"path": file_info["path"], "content": content})
                    if len("\n\n".join(collected_content)) > 15000:
                        break
        except Exception:
            continue

    if not collected_content:
        raise HTTPException(400, "Could not fetch any source files from this repository. Make sure it's public.")

    combined = "\n\n".join(collected_content)

    # Detect stack from language, topics, and files
    stack_parts = []
    if language:
        stack_parts.append(language)
    for topic in topics[:3]:
        if topic not in stack_parts:
            stack_parts.append(topic.replace("-", " ").title())
    detected_stack = " + ".join(stack_parts) if stack_parts else "Unknown"

    # Generate build summary using Claude
    ai_client = _ant.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    try:
        response = ai_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            messages=[{"role": "user", "content": f"""Analyze this GitHub repository and create a comprehensive build summary.

REPO: {owner}/{repo}
DESCRIPTION: {repo_description}
LANGUAGE: {language}
TOPICS: {', '.join(topics)}

SOURCE FILES:
{combined}

Write a comprehensive build summary covering:
1. What this project does and what problem it solves
2. Architecture and key technical decisions
3. Important files and what each does
4. Stack and libraries used
5. Most complex or interesting parts of the codebase
6. What a technical interviewer would ask about this project

Be specific — reference actual file names, function names, and patterns from the code.
Format as markdown."""}]
        )
        build_summary = response.content[0].text.strip()
    except Exception as e:
        build_summary = f"# {repo_name}\n\n{repo_description}\n\nStack: {detected_stack}\n\nCould not generate full summary: {str(e)}"

    # Determine company from request or repo name
    company = req.company or owner.replace("-", " ").title()
    brief = req.brief or repo_description or f"Imported from GitHub: {owner}/{repo}"

    # Create project
    project = Project(
        id=project_id,
        name=repo_name.replace("-", " ").replace("_", " ").title(),
        company=company,
        stack=detected_stack,
        status=ProjectStatus.done,
        phase="done",
        files_count=len([f for f in tree if f.get("type") == "blob"]),
        github_url=f"https://github.com/{owner}/{repo}",
        build_summary=build_summary,
        brief=brief,
        estimated_minutes=120,
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    # Index files for RAG
    try:
        from services.rag_engine import index_project_files
        files_for_rag = {item["path"]: item.get("content", "") for item in collected_content_map}
        chunk_count = index_project_files(project.id, files_for_rag, db)
        print(f"Indexed {chunk_count} chunks for {project.id}")
    except Exception as e:
        print(f"RAG indexing failed (non-fatal): {e}")

    return {
        **project_to_dict(project),
        "imported": True,
        "files_scanned": len(collected_content),
        "message": f"Successfully imported {repo_name} from GitHub",
    }


@router.get("/due-for-review")
def get_due_for_review(db: Session = Depends(get_db)):
    """
    Returns projects that are due for quiz review based on spaced repetition schedule.
    Reviews are due at: 1 day, 3 days, 7 days, 14 days after last quiz attempt.
    """
    from datetime import timedelta
    import json as json_lib

    REVIEW_INTERVALS = [1, 3, 7, 14]  # days

    projects = db.query(Project).filter(Project.status == ProjectStatus.done).all()
    due = []

    now = datetime.now(timezone.utc)

    for project in projects:
        # Get last quiz attempt for this project
        last_attempt = db.query(QuizAttempt).filter(
            QuizAttempt.project_id == project.id
        ).order_by(QuizAttempt.created_at.desc()).first()

        if not last_attempt:
            # Never quizzed — due immediately
            due.append({
                "id": project.id,
                "name": project.name,
                "company": project.company,
                "days_since_quiz": None,
                "reason": "Never quizzed",
                "priority": "high",
            })
            continue

        last_date = last_attempt.created_at
        if last_date.tzinfo is None:
            last_date = last_date.replace(tzinfo=timezone.utc)

        days_since = (now - last_date).days

        # Check if due based on intervals
        for interval in REVIEW_INTERVALS:
            if days_since >= interval:
                due.append({
                    "id": project.id,
                    "name": project.name,
                    "company": project.company,
                    "days_since_quiz": days_since,
                    "reason": f"Due for {interval}-day review",
                    "priority": "high" if days_since >= 7 else "medium",
                })
                break

    due.sort(key=lambda x: (x["priority"] == "medium", x.get("days_since_quiz") or -1))
    return {"due": due, "count": len(due)}


@router.get("/study-stats/overview")
def get_study_overview(db: Session = Depends(get_db)):
    """Get overall study stats across all projects."""
    from models import StudyTimer, InterviewSession

    timers = db.query(StudyTimer).all()
    attempts = db.query(QuizAttempt).all()
    interview_sessions = db.query(InterviewSession).filter(
        InterviewSession.status == "completed"
    ).all()

    total_seconds = sum(t.duration_seconds for t in timers)
    total_questions = sum(t.questions_answered for t in timers)
    correct = sum(1 for a in attempts if a.is_correct)

    # Today's stats
    from datetime import timedelta
    today = datetime.now(timezone.utc).date()
    today_timers = [t for t in timers if t.created_at.date() == today]
    today_seconds = sum(t.duration_seconds for t in today_timers)
    today_questions = sum(t.questions_answered for t in today_timers)

    # This week
    week_start = datetime.now(timezone.utc) - timedelta(days=7)
    week_timers = [t for t in timers if t.created_at.replace(tzinfo=None) >= week_start.replace(tzinfo=None)]
    week_seconds = sum(t.duration_seconds for t in week_timers)

    return {
        "total_minutes_studied": round(total_seconds / 60),
        "total_questions_answered": len(attempts),
        "overall_accuracy": round(correct / max(len(attempts), 1) * 100),
        "total_interview_sessions": len(interview_sessions),
        "today_minutes": round(today_seconds / 60),
        "today_questions": today_questions,
        "week_minutes": round(week_seconds / 60),
        "streak_days": _calculate_streak(timers),
    }


def _calculate_streak(timers) -> int:
    """Calculate consecutive days studied."""
    if not timers:
        return 0
    from datetime import timedelta
    dates = sorted(set(t.created_at.date() for t in timers), reverse=True)
    today = datetime.now(timezone.utc).date()
    streak = 0
    current = today
    for date in dates:
        if date == current or date == current - timedelta(days=1):
            streak += 1
            current = date
        else:
            break
    return streak


class PitchRequest(BaseModel):
    project_id: str
    pitch_text: str
    target_audience: str = "technical"  # technical, non-technical, executive


class WhyCompanyRequest(BaseModel):
    project_id: str
    job_description: str
    company_name: str


@router.post("/{project_id}/toggle-featured")
def toggle_featured(project_id: str, db: Session = Depends(get_db)):
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(404, "Project not found")
    p.featured = 0 if p.featured else 1
    db.commit()
    return {"featured": p.featured, "project_id": project_id}


@router.post("/{project_id}/pitch-feedback")
def get_pitch_feedback(project_id: str, req: PitchRequest, db: Session = Depends(get_db)):
    """Evaluates a 30-second elevator pitch for a project."""
    import anthropic as _ant
    import os as _os

    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(404, "Project not found")

    word_count = len(req.pitch_text.split())
    # Average speaking pace is ~130 words per minute
    estimated_seconds = round((word_count / 130) * 60)

    ai_client = _ant.Anthropic(api_key=_os.getenv("ANTHROPIC_API_KEY"))
    try:
        response = ai_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=800,
            messages=[{"role": "user", "content": f"""Evaluate this elevator pitch for a software project.

PROJECT: {p.name} for {p.company}
STACK: {p.stack}
BUILD SUMMARY: {p.build_summary[:500] if p.build_summary else ""}

TARGET AUDIENCE: {req.target_audience}
WORD COUNT: {word_count} words (~{estimated_seconds} seconds to speak)

PITCH:
{req.pitch_text}

Evaluate on:
1. Does it explain WHAT the project does clearly?
2. Does it explain WHO it's for / what PROBLEM it solves?
3. Does it include ONE impressive technical detail?
4. Is it the right length? (ideal: 30-45 seconds = ~65-100 words)
5. Would a hiring manager remember this after 10 other candidates?

Respond with JSON only:
{{
  "score": 0-100,
  "estimated_seconds": {estimated_seconds},
  "verdict": "too short|too long|just right",
  "strengths": ["what worked"],
  "gaps": ["what's missing"],
  "rewritten": "A stronger version of this pitch in under 45 seconds that covers what/who/wow",
  "one_liner": "A single memorable sentence that captures the essence of this project"
}}"""}]
        )
        text = response.content[0].text.strip().replace("```json", "").replace("```", "").strip()
        result = json.loads(text)
        result["word_count"] = word_count
        result["estimated_seconds"] = estimated_seconds
        return result
    except Exception as e:
        raise HTTPException(500, f"Pitch feedback failed: {str(e)}")


@router.post("/{project_id}/why-this-company")
def generate_why_this_company(project_id: str, req: WhyCompanyRequest, db: Session = Depends(get_db)):
    """
    Generates a compelling 'why this company' answer that connects
    the candidate's specific project to what the company is building.
    """
    import anthropic as _ant
    import os as _os

    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(404, "Project not found")

    # Get all projects for broader context
    all_projects = db.query(Project).all()
    project_list = ", ".join(f"{proj.name} ({proj.company})" for proj in all_projects[:5])

    ai_client = _ant.Anthropic(api_key=_os.getenv("ANTHROPIC_API_KEY"))
    try:
        response = ai_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1000,
            messages=[{"role": "user", "content": f"""You are helping a software engineer craft a compelling answer to "Why do you want to work at {req.company_name}?"

CANDIDATE BACKGROUND:
- Built {p.name} specifically for {p.company} — {p.stack}
- Also built: {project_list}
- Build summary: {p.build_summary[:600] if p.build_summary else ""}

JOB DESCRIPTION:
{req.job_description[:1500]}

Generate a compelling, specific, authentic "why this company" answer that:
1. Connects their {p.name} project directly to what {req.company_name} is building
2. References specific things from the job description
3. Shows genuine understanding of the company's technical challenges
4. Is 3-4 sentences, conversational, not rehearsed-sounding
5. Ends with what they specifically want to learn or contribute

Also generate follow-up talking points in case the interviewer asks to elaborate.

Respond with JSON only:
{{
  "main_answer": "the 3-4 sentence answer",
  "talking_points": ["specific elaboration point 1", "specific elaboration point 2", "specific elaboration point 3"],
  "connection": "one sentence explaining how their project directly relates to this company's work",
  "what_to_avoid": "one thing that would make this answer sound generic"
}}"""}]
        )
        text = response.content[0].text.strip().replace("```json", "").replace("```", "").strip()
        return json.loads(text)
    except Exception as e:
        raise HTTPException(500, f"Why this company generation failed: {str(e)}")


@router.get("/{project_id}")
def get_project(project_id: str, db: Session = Depends(get_db)):
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return project_to_dict(p)


@router.get("/{project_id}/rag-status")
def get_rag_status(project_id: str, db: Session = Depends(get_db)):
    """Returns how many chunks are indexed for this project."""
    from models import CodeChunk
    count = db.query(CodeChunk).filter(CodeChunk.project_id == project_id).count()
    return {
        "project_id": project_id,
        "chunks_indexed": count,
        "has_rag": count > 0,
    }


@router.post("/{project_id}/index-rag")
def index_project_rag(project_id: str, db: Session = Depends(get_db)):
    """
    Manually trigger RAG indexing for a project.
    Reads files from SWARM_PROJECTS_DIR and indexes them.
    """
    import os as _os
    from pathlib import Path as _Path
    from services.rag_engine import index_project_files

    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(404, "Project not found")

    projects_dir = _os.getenv("SWARM_PROJECTS_DIR", _os.path.expanduser("~/gauntlet-swarm/projects"))
    project_dir = _Path(projects_dir) / project_id

    SKIP_DIRS = {"node_modules", ".git", ".next", "dist", "build", "__pycache__", ".venv"}
    IMPORTANT_EXTS = {".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".rs", ".java"}

    files = {}
    if project_dir.exists():
        for f in project_dir.rglob("*"):
            if f.is_file():
                if any(skip in f.parts for skip in SKIP_DIRS):
                    continue
                ext = f.suffix.lower()
                if ext in IMPORTANT_EXTS:
                    try:
                        content = f.read_text(errors="replace")
                        rel_path = str(f.relative_to(project_dir))
                        files[rel_path] = content
                    except Exception:
                        continue

    if not files:
        # Fall back to build summary if no files found
        if p.build_summary:
            files["build_summary.md"] = p.build_summary
        else:
            return {"indexed": 0, "message": "No files found to index"}

    chunk_count = index_project_files(project_id, files, db)
    return {
        "indexed": chunk_count,
        "files_processed": len(files),
        "message": f"Indexed {chunk_count} chunks from {len(files)} files"
    }


@router.post("/{project_id}/study-session")
def log_study_session(project_id: str, session_type: str, duration_seconds: int,
                      questions_answered: int = 0, correct_answers: int = 0,
                      db: Session = Depends(get_db)):
    """Log a completed study session for time tracking."""
    from models import StudyTimer
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(404, "Project not found")

    timer = StudyTimer(
        project_id=project_id,
        session_type=session_type,
        duration_seconds=duration_seconds,
        questions_answered=questions_answered,
        correct_answers=correct_answers,
    )
    db.add(timer)
    db.commit()
    return {"logged": True}


@router.get("/{project_id}/readiness")
def get_readiness_score(project_id: str, db: Session = Depends(get_db)):
    """
    Calculates an interview readiness score (0-100) for a project based on:
    - Quiz accuracy (40%)
    - Interview scores (30%)
    - Time studied (15%)
    - Code walkthrough completion (15%)
    """
    from models import StudyTimer, InterviewSession

    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(404, "Project not found")

    # 1. Quiz accuracy score (40%)
    attempts = db.query(QuizAttempt).filter(QuizAttempt.project_id == project_id).all()
    if attempts:
        correct = sum(1 for a in attempts if a.is_correct)
        quiz_accuracy = correct / len(attempts)
        quiz_score = quiz_accuracy * 40
    else:
        quiz_score = 0
        quiz_accuracy = 0

    # 2. Interview score (30%)
    sessions = db.query(InterviewSession).filter(
        InterviewSession.project_id == project_id,
        InterviewSession.status == "completed",
        InterviewSession.score != None,
    ).all()
    if sessions:
        avg_interview = sum(s.score for s in sessions) / len(sessions)
        interview_score = (avg_interview / 100) * 30
    else:
        interview_score = 0

    # 3. Time studied (15%) — max score at 120 minutes
    timers = db.query(StudyTimer).filter(StudyTimer.project_id == project_id).all()
    total_seconds = sum(t.duration_seconds for t in timers)
    total_minutes = total_seconds / 60
    time_score = min(15, (total_minutes / 120) * 15)

    # 4. Code walkthrough (15%) — gets full score if any walkthrough done
    walkthrough_done = any(t.session_type == "walkthrough" for t in timers)
    walkthrough_score = 15 if walkthrough_done else 0

    total = round(quiz_score + interview_score + time_score + walkthrough_score)

    # Readiness label
    if total >= 80:
        label = "Interview ready"
        color = "green"
    elif total >= 60:
        label = "Almost ready"
        color = "amber"
    elif total >= 40:
        label = "In progress"
        color = "blue"
    else:
        label = "Just starting"
        color = "muted"

    return {
        "score": total,
        "label": label,
        "color": color,
        "breakdown": {
            "quiz_accuracy": round(quiz_score),
            "interview_score": round(interview_score),
            "time_studied": round(time_score),
            "walkthrough": round(walkthrough_score),
        },
        "stats": {
            "total_quiz_attempts": len(attempts),
            "quiz_accuracy_pct": round(quiz_accuracy * 100) if attempts else 0,
            "interview_sessions": len(sessions),
            "avg_interview_score": round(sum(s.score for s in sessions) / len(sessions)) if sessions else 0,
            "total_minutes_studied": round(total_minutes),
            "walkthrough_done": walkthrough_done,
        }
    }


@router.get("/{project_id}/study-history")
def get_study_history(project_id: str, db: Session = Depends(get_db)):
    """
    Returns a full study history for a project including:
    - What has been studied (quiz topics, interview types, walkthroughs)
    - What still needs work (weak spots, low accuracy areas)
    - What has been mastered (high accuracy, high interview scores)
    - Key concepts and notes to remember
    """
    from models import StudyTimer, InterviewSession, QuizQuestion

    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(404, "Project not found")

    timers = db.query(StudyTimer).filter(StudyTimer.project_id == project_id).all()
    attempts = db.query(QuizAttempt).filter(QuizAttempt.project_id == project_id).all()
    questions = db.query(QuizQuestion).filter(QuizQuestion.project_id == project_id).all()
    q_map = {q.id: q for q in questions}

    studied_types = list(set(t.session_type for t in timers))
    total_minutes = round(sum(t.duration_seconds for t in timers) / 60)
    total_questions = len(attempts)
    correct = sum(1 for a in attempts if a.is_correct)
    accuracy = round(correct / max(total_questions, 1) * 100)

    type_stats = {}
    for attempt in attempts:
        q = q_map.get(attempt.question_id)
        if not q:
            continue
        if q.question_type not in type_stats:
            type_stats[q.question_type] = {"correct": 0, "total": 0}
        type_stats[q.question_type]["total"] += 1
        if attempt.is_correct:
            type_stats[q.question_type]["correct"] += 1

    mastered = []
    needs_work = []
    not_started = []
    all_types = ["architecture", "code", "system_design", "flashcard", "code_walkthrough"]
    for qtype in all_types:
        if qtype not in type_stats:
            not_started.append(qtype)
        else:
            stats = type_stats[qtype]
            acc = stats["correct"] / max(stats["total"], 1) * 100
            if acc >= 80:
                mastered.append({"type": qtype, "accuracy": round(acc)})
            else:
                needs_work.append({"type": qtype, "accuracy": round(acc)})

    interview_sessions = db.query(InterviewSession).filter(
        InterviewSession.project_id == project_id,
        InterviewSession.status == "completed"
    ).all()

    interview_summary = []
    for s in interview_sessions:
        interview_summary.append({
            "type": s.interview_type,
            "difficulty": s.difficulty,
            "score": s.score,
            "date": s.created_at.strftime("%Y-%m-%d"),
            "feedback": (s.feedback[:200] if s.feedback else ""),
        })

    key_concepts = []
    for q in questions:
        if q.times_correct >= 2:
            key_concepts.append({
                "concept": q.question[:100],
                "answer": q.correct_answer[:150],
                "type": q.question_type,
            })

    return {
        "project_id": project_id,
        "project_name": p.name,
        "company": p.company,
        "stack": p.stack,
        "studied": {
            "total_minutes": total_minutes,
            "total_questions": total_questions,
            "overall_accuracy": accuracy,
            "session_types": studied_types,
        },
        "mastered": mastered,
        "needs_work": needs_work,
        "not_started": not_started,
        "interview_history": interview_summary,
        "key_concepts": key_concepts[:20],
        "build_summary": (p.build_summary[:500] if p.build_summary else ""),
    }


@router.get("/{project_id}/study-doc")
def export_study_doc(project_id: str, db: Session = Depends(get_db)):
    """
    Generates a shareable study document for a project.
    Can be given to a friend/mentor to quiz you with.
    Returns markdown formatted text.
    """
    from models import InterviewSession, QuizQuestion

    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(404, "Project not found")

    attempts = db.query(QuizAttempt).filter(QuizAttempt.project_id == project_id).all()
    questions = db.query(QuizQuestion).filter(QuizQuestion.project_id == project_id).all()
    correct = sum(1 for a in attempts if a.is_correct)
    accuracy = round(correct / max(len(attempts), 1) * 100)

    by_type = {}
    for q in questions:
        if q.question_type not in by_type:
            by_type[q.question_type] = []
        by_type[q.question_type].append(q)

    weak = [q for q in questions if q.times_shown > 0 and (q.times_correct / q.times_shown) < 0.7]

    interviews = db.query(InterviewSession).filter(
        InterviewSession.project_id == project_id,
        InterviewSession.status == "completed"
    ).order_by(InterviewSession.created_at.desc()).limit(3).all()

    doc = f"""# Study Document — {p.name}
**Company:** {p.company}
**Stack:** {p.stack}
**Overall quiz accuracy:** {accuracy}%
**Generated:** {datetime.now(timezone.utc).strftime("%B %d, %Y")}

---

## Project Overview

{p.build_summary[:800] if p.build_summary else "No build summary available. Run Refresh to generate one."}

---

## Key Interview Questions (ask me these)

"""
    for qtype, qs in by_type.items():
        if not qs:
            continue
        doc += f"\n### {qtype.replace('_', ' ').title()}\n\n"
        for q in qs[:5]:
            doc += f"**Q: {q.question}**\n"
            doc += f"A: {q.correct_answer}\n\n"

    if weak:
        doc += "\n---\n\n## Areas I Still Need Work On\n\n"
        doc += "*These are questions I have answered incorrectly — focus extra time here:*\n\n"
        for q in weak[:10]:
            acc = round(q.times_correct / max(q.times_shown, 1) * 100)
            doc += f"- **[{acc}% accuracy]** {q.question}\n"

    if interviews:
        doc += "\n---\n\n## Recent Interview Feedback\n\n"
        for s in interviews:
            doc += f"**{s.interview_type.replace('_', ' ').title()} ({s.difficulty}) — Score: {s.score}/100**\n"
            if s.feedback:
                doc += f"{s.feedback}\n\n"

    doc += "\n---\n\n## Quick Reference — Stack & Architecture\n\n"
    doc += f"**Stack:** {p.stack}\n\n"
    if p.build_summary:
        doc += f"{p.build_summary[:1000]}\n"

    doc += "\n---\n*Generated by SwarmOS — your AI-powered interview prep system*\n"

    return {"markdown": doc, "project_name": p.name}


@router.patch("/{project_id}")
def update_project(project_id: str, update: ProjectUpdate, db: Session = Depends(get_db)):
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    if update.status:
        p.status = ProjectStatus[update.status]
        if update.status == "building" and not p.started_at:
            p.started_at = datetime.now(timezone.utc)
        if update.status == "done" and not p.completed_at:
            p.completed_at = datetime.now(timezone.utc)
    if update.phase is not None: p.phase = update.phase
    if update.live_url is not None: p.live_url = update.live_url
    if update.github_url is not None: p.github_url = update.github_url
    db.commit()
    return project_to_dict(p)

@router.delete("/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_db)):
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    # Delete related records first
    db.query(BuildLog).filter(BuildLog.project_id == project_id).delete()
    db.query(QuizQuestion).filter(QuizQuestion.project_id == project_id).delete()
    db.query(QuizAttempt).filter(QuizAttempt.project_id == project_id).delete()
    db.delete(p)
    db.commit()
    return {"deleted": project_id}

@router.post("/{project_id}/refresh")
def refresh_project(project_id: str, db: Session = Depends(get_db)):
    """
    Re-reads source files from disk, rebuilds build summary using Claude,
    updates the project in DB. Call this after making changes to a project.
    """
    import anthropic

    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")

    projects_dir = os.getenv("SWARM_PROJECTS_DIR", os.path.expanduser("~/gauntlet-swarm/projects"))
    project_path = Path(projects_dir) / project_id

    if not project_path.exists():
        raise HTTPException(status_code=404, detail=f"Project folder not found at {project_path}")

    # Collect important files (skip binary, deps, build artifacts)
    SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv", ".next",
                 "dist", "build", ".gradle", "target", "vendor"}
    SKIP_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff",
                 ".ttf", ".eot", ".map", ".lock", ".sum"}
    IMPORTANT_EXTS = {".py", ".ts", ".tsx", ".js", ".jsx", ".java", ".go",
                      ".rs", ".rb", ".cs", ".cpp", ".c", ".h", ".md", ".yaml", ".yml", ".toml"}

    collected = []
    for root, dirs, files in os.walk(project_path):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for fname in files:
            fpath = Path(root) / fname
            rel = str(fpath.relative_to(project_path))
            if fpath.suffix.lower() in SKIP_EXTS:
                continue
            if fpath.suffix.lower() not in IMPORTANT_EXTS:
                continue
            try:
                content = fpath.read_text(errors="replace")
                if len(content) > 200:  # skip trivial files
                    collected.append(f"=== {rel} ===\n{content[:2000]}")
                    if len("\n".join(collected)) > 15000:
                        break
            except Exception:
                continue
        if len("\n".join(collected)) > 15000:
            break

    if not collected:
        raise HTTPException(status_code=400, detail="No source files found in project folder")

    combined = "\n\n".join(collected)

    # Ask Claude to generate a fresh build summary
    ai_client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    try:
        response = ai_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            messages=[{"role": "user", "content": f"""You are analyzing a software project to create a build summary.

PROJECT: {p.name}
COMPANY: {p.company}
STACK: {p.stack}

SOURCE FILES:
{combined}

Write a comprehensive build summary covering:
1. What was built and what problem it solves
2. Architecture decisions and why
3. Key files and what each does
4. Most important/complex parts of the code
5. Patterns and libraries used
6. What an interviewer would ask about this project

Format as markdown. Be specific — reference actual file names, function names, and 
patterns from the code. This summary will be used to generate quiz questions."""}]
        )
        new_summary = response.content[0].text.strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Claude summary failed: {str(e)}")

    # Update project
    p.build_summary = new_summary

    # Generate hiring lens — what makes this project stand out to hiring partners
    try:
        hiring_response = ai_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1000,
            messages=[{"role": "user", "content": f"""You are a senior engineering hiring manager reviewing a candidate's portfolio project.

PROJECT: {p.name}
COMPANY TARGET: {p.company}
STACK: {p.stack}

BUILD SUMMARY:
{new_summary[:3000]}

Analyze this project from a hiring perspective. Identify:

1. STRENGTHS — specific technical choices that signal strong engineering instincts
   (things most junior devs miss, production-thinking, non-obvious decisions)

2. TALKING POINTS — 2-3 specific things the candidate should lead with in interviews
   about this project. Be concrete — reference actual code patterns or decisions.

3. GAPS TO FILL — 1-3 small additions that would make this significantly more impressive
   to a hiring partner. Quick wins only (under a day of work each).

4. RED FLAGS — anything that might raise questions in a technical interview that
   the candidate should be prepared to defend.

Format as JSON only (no markdown):
{{
  "strengths": ["specific strength with code context", "..."],
  "talking_points": ["Lead with: ...", "Mention: ...", "If asked about scale: ..."],
  "gaps_to_fill": [
    {{"what": "Add rate limiting to the API", "why": "Shows production awareness", "effort": "2 hours"}},
    ...
  ],
  "red_flags": ["potential question and how to address it", "..."]
}}"""}]
        )
        hiring_text = hiring_response.content[0].text.strip()
        hiring_text = hiring_text.replace("```json", "").replace("```", "").strip()
        hiring_data = json.loads(hiring_text)
        p.hiring_notes = json.dumps(hiring_data)
    except Exception as e:
        print(f"Hiring lens failed (non-fatal): {e}")
        p.hiring_notes = p.hiring_notes or ""

    # Recount files
    skip = {".git", "node_modules", "__pycache__", ".venv", ".gradle"}
    total = 0
    for root, dirs, files in os.walk(project_path):
        dirs[:] = [d for d in dirs if d not in skip]
        total += len(files)
    p.files_count = total

    db.commit()

    # Auto-regenerate quiz questions with the new summary
    try:
        from services.quiz_engine import generate_questions
        # Clear old questions for this project
        db.query(QuizQuestion).filter(QuizQuestion.project_id == project_id).delete()
        db.commit()
        # Generate fresh questions for core types
        for qtype in ["architecture", "flashcard", "code"]:
            for level in [1, 2, 3]:
                generate_questions(project_id, qtype, level, count=2)
        print(f"Quiz questions regenerated for {project_id}")
    except Exception as e:
        print(f"Quiz regeneration failed (non-fatal): {e}")

    return {**project_to_dict(p), "refreshed": True, "files_scanned": len(collected)}


@router.post("/{project_id}/import-logs")
def import_project_logs(project_id: str, db: Session = Depends(get_db)):
    """
    Imports historical logs from .agent_log.txt for a specific project.
    Safe to run multiple times — uses line count watermark.
    """
    from pathlib import Path

    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")

    projects_dir = os.getenv("SWARM_PROJECTS_DIR", os.path.expanduser("~/gauntlet-swarm/projects"))
    log_path = Path(projects_dir) / project_id / ".agent_log.txt"

    if not log_path.exists():
        return {"imported": 0, "message": f"No .agent_log.txt found at {log_path}"}

    all_lines = log_path.read_text(errors="replace").strip().splitlines()
    existing_count = db.query(BuildLog).filter(BuildLog.project_id == project_id).count()
    new_lines = all_lines[existing_count:]

    imported = 0
    for line in new_lines:
        line = line.strip()
        if not line:
            continue
        phase_match = re.match(r'^\[([^\]]+)\]', line)
        phase = phase_match.group(1).lower() if phase_match else "general"

        level = "info"
        lower = line.lower()
        if any(w in lower for w in ["error", "failed", "exception", "traceback"]):
            level = "error"
        elif any(w in lower for w in ["warning", "warn", "deprecated"]):
            level = "warning"
        elif any(w in lower for w in ["success", "complete", "done", "finished"]):
            level = "success"

        db.add(BuildLog(
            project_id=project_id,
            message=line,
            level=level,
            phase=phase,
        ))
        imported += 1

    db.commit()
    return {"imported": imported, "total_lines": len(all_lines), "message": f"Imported {imported} new log lines"}


@router.post("/import-all-logs")
def import_all_logs():
    """Bulk import logs for all projects. Run once locally to populate historical logs."""
    total = import_all_project_logs()
    return {"imported": total, "message": f"Imported {total} total log lines"}


@router.post("/{project_id}/hiring-lens")
def get_hiring_lens(project_id: str, db: Session = Depends(get_db)):
    """
    Regenerates just the hiring notes without doing a full refresh.
    Useful for projects that already have a build summary.
    """
    import anthropic

    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")

    if not p.build_summary:
        raise HTTPException(
            status_code=400,
            detail="No build summary yet. Run Refresh first to scan the project files."
        )

    try:
        ai_client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        hiring_response = ai_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1000,
            messages=[{"role": "user", "content": f"""You are a senior engineering hiring manager reviewing a candidate's portfolio project.

PROJECT: {p.name}
COMPANY TARGET: {p.company}
STACK: {p.stack}

BUILD SUMMARY:
{p.build_summary[:3000]}

Analyze this project from a hiring perspective. Identify:

1. STRENGTHS — specific technical choices that signal strong engineering instincts
2. TALKING POINTS — 2-3 specific things to lead with in interviews
3. GAPS TO FILL — small additions that would make this more impressive (quick wins only)
4. RED FLAGS — things an interviewer might push back on, and how to address them

Format as JSON only (no markdown):
{{
  "strengths": ["specific strength with code context", "..."],
  "talking_points": ["Lead with: ...", "Mention: ...", "If asked about scale: ..."],
  "gaps_to_fill": [
    {{"what": "description", "why": "hiring value", "effort": "time estimate"}},
    ...
  ],
  "red_flags": ["potential question and how to address it", "..."]
}}"""}]
        )
        hiring_text = hiring_response.content[0].text.strip()
        hiring_text = hiring_text.replace("```json", "").replace("```", "").strip()
        hiring_data = json.loads(hiring_text)
        p.hiring_notes = json.dumps(hiring_data)
        db.commit()
        return {**project_to_dict(p), "hiring_data": hiring_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Hiring lens failed: {str(e)}")

@router.get("/{project_id}/logs")
def get_logs(project_id: str, limit: int = 500, grouped: bool = False, db: Session = Depends(get_db)):
    logs = db.query(BuildLog).filter(BuildLog.project_id == project_id)\
        .order_by(BuildLog.created_at.asc()).limit(limit).all()

    log_list = [{"id": l.id, "message": l.message, "level": l.level,
                 "phase": l.phase or "general", "created_at": l.created_at.isoformat()} for l in logs]

    if not grouped:
        return log_list

    # Group by phase
    from collections import OrderedDict
    groups = OrderedDict()
    for log in log_list:
        phase = log["phase"] or "general"
        if phase not in groups:
            groups[phase] = []
        groups[phase].append(log)

    return [
        {
            "phase": phase,
            "count": len(entries),
            "level": next((e["level"] for e in entries if e["level"] in ["error", "warning"]), "info"),
            "preview": entries[0]["message"][:120] if entries else "",
            "last": entries[-1]["message"][:120] if entries else "",
            "entries": entries,
        }
        for phase, entries in groups.items()
    ]


@router.post("/webhook/railway")
async def railway_webhook(payload: RailwayWebhookPayload, db: Session = Depends(get_db)):
    """
    Receives Railway deployment webhooks and updates live_url when a frontend
    service deploys successfully.
    """
    # Only process successful deployments
    if payload.status not in ("SUCCESS", "COMPLETE", "success", "complete"):
        return {"received": True, "action": "ignored", "reason": f"status={payload.status}"}

    # Extract the deployed URL
    deployed_url = payload.url
    if not deployed_url:
        # Try nested deployment object
        if payload.deployment and isinstance(payload.deployment, dict):
            deployed_url = payload.deployment.get("url") or payload.deployment.get("staticUrl")
    if not deployed_url:
        return {"received": True, "action": "ignored", "reason": "no url in payload"}

    # Extract service name to match against project IDs
    service_name = ""
    if payload.service and isinstance(payload.service, dict):
        service_name = payload.service.get("name", "").lower()

    if not service_name:
        return {"received": True, "action": "ignored", "reason": "no service name"}

    # Only process frontend services (skip backend, postgres, redis)
    skip_keywords = ["backend", "postgres", "redis", "db", "database", "exquisite", "hospitable"]
    if any(kw in service_name for kw in skip_keywords):
        return {"received": True, "action": "ignored", "reason": "non-frontend service"}

    # Match service name to a project ID
    # Service names like "fsp-frontend", "replicated-frontend" → strip "-frontend" suffix
    # Then find the project whose id contains those words
    clean_name = service_name.replace("-frontend", "").replace("-fe", "").strip("-")

    projects = db.query(Project).all()
    matched = None
    best_score = 0

    for project in projects:
        # Score based on how many words from clean_name appear in project.id
        score = sum(1 for word in clean_name.split("-") if word and word in project.id)
        if score > best_score:
            best_score = score
            matched = project

    if not matched or best_score == 0:
        return {
            "received": True,
            "action": "no_match",
            "service": service_name,
            "clean_name": clean_name,
        }

    # Ensure URL has https://
    if deployed_url and not deployed_url.startswith("http"):
        deployed_url = f"https://{deployed_url}"

    # Update the project
    old_url = matched.live_url
    matched.live_url = deployed_url
    matched.status = ProjectStatus.done
    if not matched.completed_at:
        matched.completed_at = datetime.now(timezone.utc)
    db.commit()

    print(f"Railway webhook: updated {matched.id} live_url {old_url!r} → {deployed_url!r}")

    return {
        "received": True,
        "action": "updated",
        "project_id": matched.id,
        "project_name": matched.name,
        "live_url": deployed_url,
        "matched_from": service_name,
    }
