import argparse
import sqlite3
from pathlib import Path
from database import DB, DATABASE_URL


def backup(destination):
    if DATABASE_URL:
        raise ValueError("For PostgreSQL use pg_dump; see HOSTING.md")
    target = Path(destination).resolve()
    if target == DB.resolve() or target.exists():
        raise ValueError("Choose a new backup filename, different from the database")
    target.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB.resolve().as_uri() + "?mode=ro", uri=True) as source:
        with sqlite3.connect(target) as copy:
            source.backup(copy)
    print(target)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Back up NutriDay SQLite database")
    parser.add_argument("destination")
    backup(parser.parse_args().destination)
