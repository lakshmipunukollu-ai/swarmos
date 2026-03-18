"""
RAG engine for SwarmOS.
Chunks source files, generates embeddings, and retrieves relevant context.
Uses sentence-transformers (local, no API key needed).
Model: all-MiniLM-L6-v2 (80MB, 384 dimensions, fast)
"""

import re
import os
from typing import Optional
from pathlib import Path
from sqlalchemy.orm import Session

# Lazy load the model so startup isn't slow
_model = None

def get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer('all-MiniLM-L6-v2')
    return _model


def chunk_code(content: str, file_path: str, chunk_size: int = 40) -> list[dict]:
    """
    Splits source code into meaningful chunks.
    Tries to split on function/class boundaries, falls back to line-based chunking.
    chunk_size: number of lines per chunk
    """
    lines = content.splitlines()
    chunks = []

    # Detect language
    ext = file_path.rsplit(".", 1)[-1].lower() if "." in file_path else ""

    # Find natural split points (function/class definitions)
    split_points = [0]
    for i, line in enumerate(lines):
        stripped = line.strip()
        # Python
        if ext == "py" and (stripped.startswith("def ") or stripped.startswith("class ") or stripped.startswith("async def ")):
            if i > 0:
                split_points.append(i)
        # TypeScript/JavaScript
        elif ext in ("ts", "tsx", "js", "jsx"):
            if re.match(r"^(export\s+)?(async\s+)?function\s+\w+", stripped):
                if i > 0:
                    split_points.append(i)
            elif re.match(r"^(export\s+)?(default\s+)?class\s+\w+", stripped):
                if i > 0:
                    split_points.append(i)
        # Go
        elif ext == "go" and re.match(r"^func\s+\w+", stripped):
            if i > 0:
                split_points.append(i)

    # If no natural splits found, use line-based chunking
    if len(split_points) <= 1:
        for i in range(0, len(lines), chunk_size):
            split_points.append(i)
        split_points = sorted(set(split_points))

    # Create chunks from split points
    for idx, start in enumerate(split_points):
        end = split_points[idx + 1] if idx + 1 < len(split_points) else len(lines)

        # Merge small chunks with next chunk
        if end - start < 5 and idx + 1 < len(split_points):
            continue

        # Limit chunk size
        chunk_lines = lines[start:min(start + chunk_size * 2, end)]
        chunk_content = "\n".join(chunk_lines).strip()

        if not chunk_content or len(chunk_content) < 20:
            continue

        # Detect chunk type
        first_line = chunk_lines[0].strip() if chunk_lines else ""
        chunk_type = "code"
        if first_line.startswith("def ") or first_line.startswith("async def ") or re.match(r"^(export\s+)?(async\s+)?function", first_line):
            chunk_type = "function"
        elif first_line.startswith("class ") or re.match(r"^(export\s+)?class\s+", first_line):
            chunk_type = "class"
        elif first_line.startswith("#") or first_line.startswith("//"):
            chunk_type = "comment"

        chunks.append({
            "content": chunk_content,
            "chunk_index": idx,
            "chunk_type": chunk_type,
            "start_line": start + 1,
            "end_line": min(start + chunk_size * 2, end),
            "file_path": file_path,
        })

    return chunks


def embed_chunks(chunks: list[dict]) -> list[list[float]]:
    """Generate embeddings for a list of chunks."""
    if not chunks:
        return []
    model = get_model()
    texts = [f"{c['file_path']}\n{c['content']}" for c in chunks]
    embeddings = model.encode(texts, show_progress_bar=False, batch_size=32)
    return embeddings.tolist()


def embed_query(query: str) -> list[float]:
    """Generate embedding for a search query."""
    model = get_model()
    embedding = model.encode([query], show_progress_bar=False)
    return embedding[0].tolist()


def index_project_files(
    project_id: str,
    files: dict[str, str],  # {file_path: content}
    db: Session,
    replace: bool = True,
) -> int:
    """
    Index a project's source files into the vector store.
    files: dict of {file_path: file_content}
    Returns number of chunks created.
    """
    from models import CodeChunk

    if replace:
        db.query(CodeChunk).filter(CodeChunk.project_id == project_id).delete()
        db.commit()

    all_chunks = []
    for file_path, content in files.items():
        if not content or len(content) < 50:
            continue
        chunks = chunk_code(content, file_path)
        for chunk in chunks:
            chunk["project_id"] = project_id
        all_chunks.extend(chunks)

    if not all_chunks:
        return 0

    # Generate embeddings in batches
    embeddings = embed_chunks(all_chunks)

    # Save to DB
    for chunk_data, embedding in zip(all_chunks, embeddings):
        chunk = CodeChunk(
            project_id=chunk_data["project_id"],
            file_path=chunk_data["file_path"],
            chunk_index=chunk_data["chunk_index"],
            content=chunk_data["content"],
            chunk_type=chunk_data["chunk_type"],
            start_line=chunk_data["start_line"],
            end_line=chunk_data["end_line"],
            embedding=embedding,
        )
        db.add(chunk)

    db.commit()
    return len(all_chunks)


def retrieve_relevant_chunks(
    project_id: str,
    query: str,
    db: Session,
    top_k: int = 5,
    chunk_type_filter: Optional[str] = None,
) -> list[dict]:
    """
    Retrieve the most relevant code chunks for a query using cosine similarity.
    Returns list of chunk dicts with content, file_path, similarity score.
    """
    from models import CodeChunk
    from sqlalchemy import text as sql_text

    query_embedding = embed_query(query)
    embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"

    type_filter = ""
    if chunk_type_filter:
        type_filter = f"AND chunk_type = '{chunk_type_filter}'"

    result = db.execute(sql_text(f"""
        SELECT
            id, file_path, content, chunk_type, start_line, end_line,
            1 - (embedding <=> '{embedding_str}'::vector) as similarity
        FROM code_chunks
        WHERE project_id = :project_id {type_filter}
        ORDER BY embedding <=> '{embedding_str}'::vector
        LIMIT :top_k
    """), {"project_id": project_id, "top_k": top_k})

    rows = result.fetchall()
    return [
        {
            "id": row[0],
            "file_path": row[1],
            "content": row[2],
            "chunk_type": row[3],
            "start_line": row[4],
            "end_line": row[5],
            "similarity": float(row[6]),
        }
        for row in rows
        if float(row[6]) > 0.3  # minimum similarity threshold
    ]


def get_rag_context(
    project_id: str,
    query: str,
    db: Session,
    top_k: int = 5,
) -> str:
    """
    Returns formatted RAG context string for injection into Claude prompts.
    Falls back to empty string if no chunks found.
    """
    chunks = retrieve_relevant_chunks(project_id, query, db, top_k=top_k)
    if not chunks:
        return ""

    context_parts = []
    for chunk in chunks:
        context_parts.append(
            f"=== {chunk['file_path']} (lines {chunk['start_line']}-{chunk['end_line']}, "
            f"similarity: {chunk['similarity']:.2f}) ===\n{chunk['content']}"
        )

    return "\n\n".join(context_parts)
