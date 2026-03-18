
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
        model="claude-sonnet-4-20250514",
        max_tokens=8000,
        system="You are a code editor. Output only changed files as: File: `path` then triple backtick lang, content, triple backtick",
        messages=[{"role": "user", "content": prompt}]
    )
    text = response.content[0].text
    matches = re.findall(r"File:\s*`([^`]+)`\s*\n```\w*\n(.*?)```", text, re.DOTALL)
    for fpath, fcontent in matches:
        full = repo_root / fpath.strip()
        full.parent.mkdir(parents=True, exist_ok=True)
        full.write_text(fcontent)
        print("  +", fpath.strip())
    if not matches:
        Path("/tmp/claude_out.txt").write_text(text)
        print("No files applied. See /tmp/claude_out.txt")

if __name__ == "__main__":
    run_prompt(sys.argv[1])
