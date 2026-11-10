"""Backfill Discord usernames for DM users in juniper_memory.db.

Fetches all guild members from the bot's server, matches them against
the DM user IDs in the database, and writes usernames + avatar URLs
into user_meta. Uses the guild members endpoint (which bots have access
to) rather than the users endpoint (which requires privileged access).

Usage:
  DISCORD_BOT_TOKEN=your-bot-token python backfill-handles.py

  # Or point at a specific DB:
  JUNIPER_DB_PATH=/path/to/juniper_memory.db DISCORD_BOT_TOKEN=... python backfill-handles.py
"""

import os
import sqlite3
import sys
import time
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
import json

DB_PATH = os.environ.get(
    "JUNIPER_DB_PATH",
    str(Path(__file__).parent.parent / "juniper_memory.db"),
)
TOKEN = os.environ.get("DISCORD_BOT_TOKEN", "")
GUILD_ID = os.environ.get("DISCORD_GUILD_ID", "")

if not TOKEN:
    print("Set DISCORD_BOT_TOKEN to the bot's token.")
    sys.exit(1)


def api_get(path: str) -> dict | list | None:
    url = f"https://discord.com/api/v10{path}"
    req = Request(url, headers={
        "Authorization": f"Bot {TOKEN}",
        "User-Agent": "DiscordBot (https://juniper.pi, 1.0)",
    })
    try:
        with urlopen(req) as resp:
            return json.loads(resp.read())
    except HTTPError as e:
        if e.code == 429:
            retry = float(e.headers.get("Retry-After", "2"))
            print(f"  rate limited, waiting {retry}s...")
            time.sleep(retry)
            return api_get(path)
        print(f"  API error for {path}: HTTP {e.code}")
        return None


def get_guild_id() -> str:
    if GUILD_ID:
        return GUILD_ID
    guilds = api_get("/users/@me/guilds")
    if not guilds:
        print("Could not fetch guilds.")
        sys.exit(1)
    guild = guilds[0]
    print(f"Using guild: {guild['name']} ({guild['id']})")
    return guild["id"]


def fetch_all_members(guild_id: str) -> dict[str, dict]:
    """Fetch all guild members, paginating with after= parameter."""
    members = {}
    after = "0"
    while True:
        batch = api_get(f"/guilds/{guild_id}/members?limit=1000&after={after}")
        if not batch:
            break
        for m in batch:
            user = m.get("user", {})
            uid = user.get("id")
            if uid:
                members[uid] = user
        if len(batch) < 1000:
            break
        after = batch[-1]["user"]["id"]
        time.sleep(0.5)
    return members


def main():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")

    rows = conn.execute(
        "SELECT DISTINCT user_id FROM conversations WHERE scope='dm'"
    ).fetchall()
    wanted = {str(r[0]) for r in rows}
    print(f"Found {len(wanted)} DM users to backfill in {DB_PATH}")

    guild_id = get_guild_id()
    print("Fetching guild members...")
    members = fetch_all_members(guild_id)
    print(f"Fetched {len(members)} guild members")

    filled = 0
    missing = 0
    for uid in sorted(wanted):
        user = members.get(uid)
        if not user:
            missing += 1
            continue

        username = user.get("username", "")
        display = user.get("global_name") or username
        avatar = user.get("avatar")
        avatar_url = (
            f"https://cdn.discordapp.com/avatars/{uid}/{avatar}.png"
            if avatar
            else None
        )

        conn.execute(
            "INSERT INTO user_meta (user_id, key, value) VALUES (?, 'handle', ?) "
            "ON CONFLICT (user_id, key) DO UPDATE SET value=excluded.value",
            (uid, display or username),
        )
        if avatar_url:
            conn.execute(
                "INSERT INTO user_meta (user_id, key, value) VALUES (?, 'avatar', ?) "
                "ON CONFLICT (user_id, key) DO UPDATE SET value=excluded.value",
                (uid, avatar_url),
            )
        conn.commit()
        filled += 1
        print(f"  {uid} -> {display or username}" + (f" (avatar)" if avatar_url else ""))

    print(f"\nDone: {filled} backfilled, {missing} not in guild (left server or test IDs).")
    conn.close()


if __name__ == "__main__":
    main()
