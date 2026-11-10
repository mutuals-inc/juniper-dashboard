"""Export juniper_memory.db DM data to JSON files for static Vercel deployment.

Run this whenever you want to update the dashboard with fresh data.
The dashboard reads these JSON files when JUNIPER_API_URL is not set and
better-sqlite3 is not available (i.e., on Vercel serverless).

Usage:
  python scripts/export-db.py
  JUNIPER_DB_PATH=/path/to/db python scripts/export-db.py
"""

import json
import os
import sqlite3
from pathlib import Path

DB_PATH = os.environ.get(
    "JUNIPER_DB_PATH",
    str(Path(__file__).parent.parent.parent / "juniper_memory.db"),
)
OUT_DIR = Path(__file__).parent.parent / "src" / "data"


def main():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # Export threads
    rows = conn.execute("""
        SELECT
            c.user_id, m.value as handle, a.value as avatar_url,
            COUNT(*) as message_count,
            SUM(CASE WHEN c.role='user' THEN 1 ELSE 0 END) as user_message_count,
            SUM(CASE WHEN c.role='assistant' THEN 1 ELSE 0 END) as juniper_message_count,
            MAX(c.timestamp) as last_message_at,
            (SELECT text FROM conversations c2 WHERE c2.user_id=c.user_id AND c2.scope='dm' ORDER BY c2.id DESC LIMIT 1) as last_message_text,
            (SELECT role FROM conversations c3 WHERE c3.user_id=c.user_id AND c3.scope='dm' ORDER BY c3.id DESC LIMIT 1) as last_message_role
        FROM conversations c
        LEFT JOIN user_meta m ON c.user_id=m.user_id AND m.key='handle'
        LEFT JOIN user_meta a ON c.user_id=a.user_id AND a.key='avatar'
        WHERE c.scope='dm'
        GROUP BY c.user_id ORDER BY MAX(c.id) DESC
    """).fetchall()
    threads = []
    for r in rows:
        t = dict(r)
        t["user_id"] = str(t["user_id"])
        threads.append(t)
    (OUT_DIR / "threads.json").write_text(json.dumps(threads, default=str))
    print(f"Exported {len(threads)} threads")

    # Export all DM messages grouped by user
    messages = {}
    for thread in threads:
        uid = thread["user_id"]
        rows = conn.execute("""
            SELECT id, user_id, timestamp, role, text, scope, message_id
            FROM conversations WHERE user_id=? AND scope='dm'
            ORDER BY id ASC
        """, (uid,)).fetchall()
        msgs = []
        for r in rows:
            m = dict(r)
            m["user_id"] = str(m["user_id"])
            if m.get("message_id"):
                m["message_id"] = str(m["message_id"])
            msgs.append(m)
        messages[uid] = msgs
    (OUT_DIR / "messages.json").write_text(json.dumps(messages, default=str))
    print(f"Exported messages for {len(messages)} users")

    conn.close()
    print(f"Data written to {OUT_DIR}")


if __name__ == "__main__":
    main()
