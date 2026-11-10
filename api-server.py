"""Lightweight HTTP server that exposes the juniper_memory.db DM data.

Runs on the GCP VM alongside the bot. The Vercel-hosted dashboard calls this
to get conversation data without needing direct SQLite access.

Usage:
  python api-server.py                          # default port 8780
  DASHBOARD_PORT=8780 DASHBOARD_KEY=secret python api-server.py

Environment:
  JUNIPER_DB_PATH  path to juniper_memory.db (default: ../juniper_memory.db)
  DASHBOARD_PORT   port to listen on (default: 8780)
  DASHBOARD_KEY    optional bearer token for auth
"""

import json
import os
import sqlite3
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

DB_PATH = os.environ.get("JUNIPER_DB_PATH", str(Path(__file__).parent.parent / "juniper_memory.db"))
PORT = int(os.environ.get("DASHBOARD_PORT", "8780"))
API_KEY = os.environ.get("DASHBOARD_KEY", "")


def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


class Handler(BaseHTTPRequestHandler):
    _db = None

    @property
    def db(self):
        if Handler._db is None:
            Handler._db = get_db()
        return Handler._db

    def do_GET(self):
        if API_KEY:
            auth = self.headers.get("Authorization", "")
            if auth != f"Bearer {API_KEY}":
                self._json(401, {"error": "unauthorized"})
                return

        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        qs = parse_qs(parsed.query)

        if path == "/api/dm/threads":
            self._threads(qs)
        elif path.startswith("/api/dm/messages/"):
            user_id = path.split("/")[-1]
            self._messages(user_id, qs)
        elif path == "/health":
            self._json(200, {"ok": True})
        else:
            self._json(404, {"error": "not found"})

    def _threads(self, qs):
        query = qs.get("q", [None])[0]
        if query:
            like = f"%{query}%"
            rows = self.db.execute("""
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
                WHERE c.scope='dm' AND (m.value LIKE ? OR CAST(c.user_id AS TEXT) LIKE ?
                    OR EXISTS (SELECT 1 FROM conversations cs WHERE cs.user_id=c.user_id AND cs.scope='dm' AND cs.text LIKE ?))
                GROUP BY c.user_id ORDER BY MAX(c.id) DESC
            """, (like, like, like)).fetchall()
        else:
            rows = self.db.execute("""
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
        self._json(200, [dict(r) for r in rows])

    def _messages(self, user_id, qs):
        limit = int(qs.get("limit", ["200"])[0])
        rows = self.db.execute("""
            SELECT id, user_id, timestamp, role, text, scope, message_id
            FROM conversations WHERE user_id=? AND scope='dm'
            ORDER BY id ASC LIMIT ?
        """, (user_id, limit)).fetchall()
        self._json(200, [dict(r) for r in rows])

    def _json(self, status, data):
        body = json.dumps(data, default=str).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Authorization")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Dashboard API on :{PORT} (db: {DB_PATH})")
    server.serve_forever()
