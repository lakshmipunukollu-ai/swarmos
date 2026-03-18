#!/usr/bin/env python3
"""
One-time script to import all historical agent logs into the BuildLog table.
Run from the backend directory:
  python scripts/import_logs.py

Safe to run multiple times — uses line count watermark to avoid duplicates.
"""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from models import create_tables
from services.watcher import import_all_project_logs

if __name__ == "__main__":
    print("Creating tables if needed...")
    create_tables()
    print(f"SWARM_PROJECTS_DIR: {os.getenv('SWARM_PROJECTS_DIR', '~/gauntlet-swarm/projects')}")
    print("Importing logs...")
    total = import_all_project_logs()
    print(f"\nDone. Total lines imported: {total}")
