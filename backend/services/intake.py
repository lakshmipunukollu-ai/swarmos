import anthropic
import os
import json

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


def analyze_brief(brief_text: str) -> dict:
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        messages=[{"role": "user", "content": f"""You are a senior AI engineer analyzing a project brief.
Extract all information you can, then identify what's missing.

Brief:
{brief_text}

Respond ONLY with JSON (no markdown):
{{
  "project_name": "...",
  "company": "...",
  "problem_statement": "...",
  "recommended_stack": "Backend + Frontend",
  "key_features": ["...", "..."],
  "missing_info": ["list what critical info is missing"],
  "follow_up_questions": ["targeted question for each missing piece, max 3"],
  "confidence": "high|medium|low",
  "ready_to_build": true|false,
  "estimated_minutes": 120
}}"""}]
    )
    text = response.content[0].text.strip().replace("```json", "").replace("```", "").strip()
    return json.loads(text)


def refine_with_answers(original_brief: str, analysis: dict, answers: str) -> dict:
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        messages=[{"role": "user", "content": f"""Update this project analysis with the user's answers.

Original brief: {original_brief}
Previous analysis: {json.dumps(analysis)}
User's answers to follow-up questions: {answers}

Respond ONLY with updated JSON in the same format. Set ready_to_build to true if all critical info is now available."""}]
    )
    text = response.content[0].text.strip().replace("```json", "").replace("```", "").strip()
    return json.loads(text)
