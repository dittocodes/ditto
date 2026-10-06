"""Create the application database on local/server MySQL if it does not exist."""
from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

try:
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
except ImportError:
    pass

import os

from sqlalchemy import create_engine, text


def _parse_mysql_url(url: str) -> tuple[str, str]:
    """Return (server_url without database, database name)."""
    if not url.startswith("mysql"):
        raise SystemExit(f"DATABASE_URL must be MySQL, got: {url[:40]}...")
    parsed = urlparse(url.replace("mysql+pymysql://", "mysql://", 1))
    db_name = (parsed.path or "").lstrip("/") or "menteetracker"
    user = parsed.username or "root"
    password = unquote(parsed.password or "")
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or 3306
    # Rebuild server URL (no database in path)
    if password:
        auth = f"{user}:{parsed.password}@"  # keep encoded password from original URL
    else:
        auth = f"{user}@"
    server_url = f"mysql+pymysql://{auth}{host}:{port}/"
    return server_url, db_name


def main() -> None:
    url = os.getenv(
        "DATABASE_URL",
        "mysql+pymysql://root:password@127.0.0.1:3306/menteetracker",
    )
    server_url, db_name = _parse_mysql_url(url)
    if not re.match(r"^[a-zA-Z0-9_]+$", db_name):
        raise SystemExit(f"Invalid database name: {db_name!r}")

    print(f"Ensuring database `{db_name}` on {server_url.split('@')[-1]}...")
    try:
        engine = create_engine(server_url, pool_pre_ping=True)
        with engine.connect() as conn:
            conn.execute(
                text(
                    f"CREATE DATABASE IF NOT EXISTS `{db_name}` "
                    "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
                )
            )
            conn.commit()
    except Exception as exc:
        print("\nCould not connect to MySQL or create database:", exc)
        print(
            "\nCheck that MySQL80 is running (Workbench → Local instance MySQL80), "
            "host/port/user/password in .env DATABASE_URL, then retry."
        )
        raise SystemExit(1) from exc
    print(f"Database `{db_name}` is ready.")


if __name__ == "__main__":
    main()
