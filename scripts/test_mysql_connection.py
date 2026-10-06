"""Test MySQL connectivity using DATABASE_URL / .env settings."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text

from app.db.database import engine


def main() -> None:
    url = str(engine.url)
    safe = url.split("@")[-1] if "@" in url else url
    print(f"Connecting to …@{safe}")
    with engine.connect() as conn:
        row = conn.execute(text("SELECT 1 AS ok")).first()
        print(f"OK: {row[0] if row else 'no row'}")


if __name__ == "__main__":
    main()
