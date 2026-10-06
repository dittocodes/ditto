"""Create ORM tables on the configured MySQL database (from DATABASE_URL in .env)."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sqlalchemy import inspect, text

from app.db.database import Base, engine, DATABASE_URL, get_db_info, SessionLocal  # noqa: E402
from app.db.models.registry import import_all_models

import_all_models()


def main() -> None:
    info = get_db_info()
    print(f"Target: {DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else DATABASE_URL}")
    print(f"Host: {info.get('host')}  DB: {info.get('database')}")
    try:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        table_count = len(inspect(engine).get_table_names())
        db.close()
    except Exception as exc:
        print("\nSchema init failed:", exc)
        err = str(exc).lower()
        if "1130" in err or "not allowed" in err:
            print(
                "\nRemote MySQL rejected your IP (1130). Use local MySQL in .env or ask DBA for GRANT.\n"
            )
        elif "2003" in err or "10061" in err or "can't connect" in err:
            print(
                "\nMySQL is not reachable. Start the MySQL80 Windows service or Workbench "
                "Local instance, then verify DATABASE_URL host/port.\n"
            )
        elif "1045" in err or "access denied" in err:
            print("\nWrong MySQL username/password in DATABASE_URL (.env).\n")
        elif "1049" in err or "unknown database" in err:
            print("\nDatabase missing. Run: python scripts/ensure_mysql_database.py\n")
        raise SystemExit(1) from exc
    print(f"All ORM tables are present ({table_count} tables, create_all completed).")


if __name__ == "__main__":
    main()
