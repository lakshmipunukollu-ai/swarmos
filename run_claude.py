import sys, re
from pathlib import Path
from anthropic import Anthropic

client = Anthropic()

def run_prompt(prompt_file):
    repo_root = Path("/Users/priyankapunukollu/Repos/swarmos")
    prompt_path = Path(prompt_file)
    if not prompt_path.exists():
        print("Not found:", prompt_file)
        sys.exit(1)
    prompt = prompt_path.read_text()
    print("Running:", prompt_path.name)
    response = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=8000,
        system="You are a code editor. Output only changed files as: File: `path` then triple backtick lang, content, triple backtick",
        messages=[{"role": "user", "content": prompt}]
    )
    text = response.content[0].text
    matches = re.findall(r"File:\s*`([^`]+)`\s*\n