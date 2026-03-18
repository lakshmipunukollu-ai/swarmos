import anthropic
import os
import json
from models import SessionLocal, Project, InterviewSession, InterviewMessage
from datetime import datetime, timezone

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

DIFFICULTY_PERSONAS = {
    "coaching": """You are a supportive senior engineer conducting a coaching interview.
Your goal is to help the candidate improve. Give hints when they struggle.
Acknowledge good answers warmly. When an answer is incomplete, guide them toward
what's missing with questions like 'Can you tell me more about...' or 'What would
happen if...'""",

    "balanced": """You are an experienced engineering manager at a Series B startup
conducting a technical interview. You are professional and fair. Ask follow-up questions
when answers are vague. Don't give hints but don't be harsh. Evaluate answers objectively.""",

    "faang": """You are a senior Staff Engineer at a top tech company conducting a rigorous
interview. You push back on every answer. If they say 'we used PostgreSQL', ask 'why not
MySQL or MongoDB? What were the tradeoffs?' If they describe an architecture, ask about
failure modes, scaling limits, and what they'd do differently. Never let a vague answer
slide. Be direct but professional."""
}

COMPANY_STYLES = {
    "stripe": "Stripe interviews focus heavily on systems thinking, API design, and handling edge cases at scale. They value clear communication and expect candidates to think about error handling, idempotency, and developer experience.",
    "google": "Google values algorithmic thinking, scalability, and structured communication. Expect follow-ups on time complexity, system design tradeoffs, and how you'd handle 1000x scale.",
    "meta": "Meta focuses on impact, velocity, and cross-functional collaboration. They want to hear about measurable outcomes and how you moved fast while maintaining quality.",
    "amazon": "Amazon uses the STAR format strictly. They tie everything back to their Leadership Principles. Expect questions about customer obsession, ownership, and delivering results.",
    "apple": "Apple values craftsmanship, attention to detail, and deep technical expertise. They want to understand your design decisions and why you chose one approach over another.",
    "airbnb": "Airbnb values trust, belonging, and thoughtful product thinking. They expect candidates to show empathy for users and think about accessibility and edge cases.",
    "netflix": "Netflix values autonomy, context over control, and high performance. They want people who can make decisions independently and communicate their reasoning clearly.",
    "startup": "Startup interviews are fast-paced. They want generalists who can ship quickly, wear multiple hats, and think about business impact alongside technical quality.",
    "default": ""
}


def get_company_style(company: str) -> str:
    if not company:
        return ""
    company_lower = company.lower()
    for key, style in COMPANY_STYLES.items():
        if key in company_lower:
            return f"\n\nCompany context: {style}"
    return f"\n\nYou are interviewing for {company}. Tailor your questions to what this company likely values."


TYPE_OPENERS = {
    "behavioral": "Tell me about yourself and this project. What problem were you solving and why did it matter?",
    "technical": "Walk me through the architecture of this project. Start from the highest level and go deeper as I ask questions.",
    "coding": "I'm going to ask you to write some code related to this project. Are you ready? I'll give you a function to implement.",
    "system_design": "Let's talk about scaling this project. Imagine it suddenly needs to handle 100x the current load. Walk me through how you'd approach that."
}

TYPE_SYSTEM_PROMPTS = {
    "behavioral": """Focus on behavioral aspects: challenges faced, decisions made, team dynamics,
what the candidate learned, how they handled setbacks. Use the STAR framework to evaluate answers
(Situation, Task, Action, Result). Ask follow-ups about specific situations.""",

    "technical": """Focus on technical decisions: why they chose this stack, database schema design,
API design, authentication approach, error handling, testing strategy. Dig into the actual
implementation details. Reference the build summary when asking about specific decisions.""",

    "coding": """Ask the candidate to write actual code functions related to their project.
Start with a simpler function, then increase complexity. Evaluate: correctness, edge cases,
time/space complexity, code style. Format code questions clearly with the function signature.""",

    "system_design": """Focus on scalability and architecture evolution: caching strategy, database
scaling, load balancing, microservices vs monolith tradeoffs, monitoring, deployment strategy.
Push them to think about failure modes and bottlenecks."""
}


def get_opening_message(project_id: str, interview_type: str, difficulty: str, target_company: str = "") -> str:
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            return TYPE_OPENERS[interview_type]

        build_context = f"\n\nProject context: {project.build_summary[:1000]}" if project.build_summary else ""
        company_style = get_company_style(target_company)

        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=300,
            system=f"""{DIFFICULTY_PERSONAS[difficulty]}
{TYPE_SYSTEM_PROMPTS[interview_type]}{company_style}

Project: {project.name} for {project.company}
Stack: {project.stack}{build_context}

You are starting a {interview_type} interview. Generate a natural opening question.
Keep it to 2-3 sentences max. Be conversational.""",
            messages=[{"role": "user", "content": "Start the interview."}]
        )
        return response.content[0].text.strip()
    except Exception:
        return TYPE_OPENERS[interview_type]
    finally:
        db.close()


def evaluate_answer(question: str, answer: str, project_context: str, interview_type: str, difficulty: str) -> dict:
    """Evaluate a candidate's answer and return structured feedback."""
    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=800,
            messages=[{"role": "user", "content": f"""Evaluate this interview answer.

Interview type: {interview_type}
Difficulty: {difficulty}
Project context: {project_context[:500]}

Question: {question}
Candidate answer: {answer}

Respond with JSON only:
{{
  "score": 0-100,
  "strengths": ["what they did well - be specific"],
  "weaknesses": ["what was missing or weak - be specific"],
  "tip": "one specific improvement tip",
  "ideal_answer": "A 3-5 sentence example of what a strong answer would sound like for this specific question and project"
}}"""}]
        )
        text = response.content[0].text.strip().replace("```json", "").replace("```", "").strip()
        return json.loads(text)
    except Exception:
        return {"score": 50, "strengths": [], "weaknesses": [], "tip": "Keep practicing.", "ideal_answer": ""}


def get_next_question(
    session_id: int,
    candidate_answer: str,
    project_id: str,
    interview_type: str,
    difficulty: str,
    target_company: str = ""
) -> dict:
    """Process candidate answer and return next interviewer message."""
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        build_context = project.build_summary[:1500] if project and project.build_summary else ""
        project_info = f"{project.name} ({project.company}) - {project.stack}" if project else project_id
        company_style = get_company_style(target_company)

        # Get conversation history
        messages = db.query(InterviewMessage).filter(
            InterviewMessage.session_id == session_id
        ).order_by(InterviewMessage.created_at).all()

        # Build conversation for Claude
        history = []
        for msg in messages:
            role = "assistant" if msg.role == "interviewer" else "user"
            history.append({"role": role, "content": msg.content})

        # Add candidate's latest answer
        history.append({"role": "user", "content": candidate_answer})

        # Get message count to know when to wrap up
        msg_count = len(messages)
        wrap_up = msg_count >= 8  # wrap up after ~4 exchanges

        wrap_instruction = ""
        if wrap_up:
            wrap_instruction = "\nThis is the final question. After their answer, wrap up the interview professionally and thank them."

        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=400,
            system=f"""{DIFFICULTY_PERSONAS[difficulty]}
{TYPE_SYSTEM_PROMPTS[interview_type]}{company_style}

Project: {project_info}
Build context: {build_context}

You are conducting a {interview_type} interview. Respond to the candidate's answer
with a follow-up question or probe. Keep responses to 2-4 sentences.
Never break character as the interviewer.{wrap_instruction}""",
            messages=history
        )

        next_question = response.content[0].text.strip()

        # Save candidate answer to DB
        last_interviewer_msg = None
        for msg in reversed(messages):
            if msg.role == "interviewer":
                last_interviewer_msg = msg.content
                break

        evaluation = {}
        if last_interviewer_msg:
            evaluation = evaluate_answer(
                last_interviewer_msg,
                candidate_answer,
                build_context,
                interview_type,
                difficulty
            )

        candidate_msg = InterviewMessage(
            session_id=session_id,
            role="candidate",
            content=candidate_answer,
            evaluation=json.dumps(evaluation),
        )
        db.add(candidate_msg)

        # Save interviewer response
        interviewer_msg = InterviewMessage(
            session_id=session_id,
            role="interviewer",
            content=next_question,
            evaluation="",
        )
        db.add(interviewer_msg)
        db.commit()

        return {
            "message": next_question,
            "evaluation": evaluation,
            "is_final": wrap_up,
            "message_count": msg_count + 2,
        }
    except Exception as e:
        return {"message": "Could you elaborate on that?", "evaluation": {}, "is_final": False, "message_count": 0}
    finally:
        db.close()


def complete_interview(session_id: int) -> dict:
    """Generate final score and feedback for the completed interview."""
    db = SessionLocal()
    try:
        session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
        if not session:
            return {}

        messages = db.query(InterviewMessage).filter(
            InterviewMessage.session_id == session_id,
            InterviewMessage.role == "candidate"
        ).all()

        evaluations = []
        for msg in messages:
            if msg.evaluation:
                try:
                    evaluations.append(json.loads(msg.evaluation))
                except Exception:
                    pass

        if not evaluations:
            return {"score": 0, "feedback": "No answers recorded."}

        avg_score = sum(e.get("score", 0) for e in evaluations) / len(evaluations)
        all_strengths = [s for e in evaluations for s in e.get("strengths", [])]
        all_weaknesses = [w for e in evaluations for w in e.get("weaknesses", [])]

        # Generate final summary
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=600,
            messages=[{"role": "user", "content": f"""You just completed a {session.interview_type} interview at {session.difficulty} difficulty.

Average answer score: {avg_score:.0f}/100
Key strengths observed: {', '.join(all_strengths[:5])}
Key weaknesses observed: {', '.join(all_weaknesses[:5])}

Write a brief interview debrief (3-4 sentences) covering:
1. Overall performance assessment
2. Top 2 things they did well
3. Top 2 areas to improve before the real interview
4. One specific action item

Be direct and specific. This is coaching feedback."""}]
        )

        feedback = response.content[0].text.strip()
        final_score = int(avg_score)

        session.status = "completed"
        session.score = final_score
        session.feedback = feedback
        session.completed_at = datetime.now(timezone.utc)
        db.commit()

        return {
            "score": final_score,
            "feedback": feedback,
            "strengths": list(set(all_strengths))[:4],
            "weaknesses": list(set(all_weaknesses))[:4],
        }
    except Exception as e:
        return {"score": 0, "feedback": str(e)}
    finally:
        db.close()
