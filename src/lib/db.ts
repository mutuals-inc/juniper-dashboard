import Database from "better-sqlite3";
import path from "path";

const DB_PATH =
  process.env.JUNIPER_DB_PATH ||
  path.resolve(process.cwd(), "..", "juniper_memory.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH, { readonly: true });
    _db.pragma("journal_mode = WAL");
  }
  return _db;
}

export interface ConversationLine {
  id: number;
  user_id: string;
  timestamp: string;
  role: "user" | "assistant";
  text: string;
  scope: string;
  message_id: number | null;
}

export interface DmThread {
  user_id: string;
  handle: string | null;
  avatar_url: string | null;
  message_count: number;
  user_message_count: number;
  juniper_message_count: number;
  last_message_at: string;
  last_message_text: string;
  last_message_role: string;
}

export function getDmThreads(): DmThread[] {
  const db = getDb();
  const rows = db
    .prepare(
      `
    SELECT
      c.user_id,
      m.value as handle,
      a.value as avatar_url,
      COUNT(*) as message_count,
      SUM(CASE WHEN c.role = 'user' THEN 1 ELSE 0 END) as user_message_count,
      SUM(CASE WHEN c.role = 'assistant' THEN 1 ELSE 0 END) as juniper_message_count,
      MAX(c.timestamp) as last_message_at,
      (SELECT text FROM conversations c2 WHERE c2.user_id = c.user_id AND c2.scope = 'dm' ORDER BY c2.id DESC LIMIT 1) as last_message_text,
      (SELECT role FROM conversations c3 WHERE c3.user_id = c.user_id AND c3.scope = 'dm' ORDER BY c3.id DESC LIMIT 1) as last_message_role
    FROM conversations c
    LEFT JOIN user_meta m ON c.user_id = m.user_id AND m.key = 'handle'
    LEFT JOIN user_meta a ON c.user_id = a.user_id AND a.key = 'avatar'
    WHERE c.scope = 'dm'
    GROUP BY c.user_id
    ORDER BY MAX(c.id) DESC
    `
    )
    .all() as DmThread[];

  return rows.map((r) => ({ ...r, user_id: String(r.user_id) }));
}

export function getDmMessages(
  userId: string,
  limit = 200
): ConversationLine[] {
  const db = getDb();
  const rows = db
    .prepare(
      `
    SELECT id, user_id, timestamp, role, text, scope, message_id
    FROM conversations
    WHERE user_id = ? AND scope = 'dm'
    ORDER BY id ASC
    LIMIT ?
    `
    )
    .all(userId, limit) as ConversationLine[];

  return rows.map((r) => ({ ...r, user_id: String(r.user_id) }));
}

export function searchDmThreads(query: string): DmThread[] {
  const db = getDb();
  const rows = db
    .prepare(
      `
    SELECT
      c.user_id,
      m.value as handle,
      a.value as avatar_url,
      COUNT(*) as message_count,
      SUM(CASE WHEN c.role = 'user' THEN 1 ELSE 0 END) as user_message_count,
      SUM(CASE WHEN c.role = 'assistant' THEN 1 ELSE 0 END) as juniper_message_count,
      MAX(c.timestamp) as last_message_at,
      (SELECT text FROM conversations c2 WHERE c2.user_id = c.user_id AND c2.scope = 'dm' ORDER BY c2.id DESC LIMIT 1) as last_message_text,
      (SELECT role FROM conversations c3 WHERE c3.user_id = c.user_id AND c3.scope = 'dm' ORDER BY c3.id DESC LIMIT 1) as last_message_role
    FROM conversations c
    LEFT JOIN user_meta m ON c.user_id = m.user_id AND m.key = 'handle'
    LEFT JOIN user_meta a ON c.user_id = a.user_id AND a.key = 'avatar'
    WHERE c.scope = 'dm'
      AND (m.value LIKE ? OR c.user_id LIKE ? OR EXISTS (
        SELECT 1 FROM conversations cs WHERE cs.user_id = c.user_id AND cs.scope = 'dm' AND cs.text LIKE ?
      ))
    GROUP BY c.user_id
    ORDER BY MAX(c.id) DESC
    `
    )
    .all(`%${query}%`, `%${query}%`, `%${query}%`) as DmThread[];

  return rows.map((r) => ({ ...r, user_id: String(r.user_id) }));
}
