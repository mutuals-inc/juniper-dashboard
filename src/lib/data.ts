import type { DmThread, ConversationLine } from "./db";

const API_BASE = process.env.JUNIPER_API_URL;
const USE_SQLITE = (process.env.JUNIPER_DATA_SOURCE || "").trim() !== "json";

async function fetchFromRemote<T>(path: string): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {};
  if (process.env.JUNIPER_API_KEY) {
    headers["Authorization"] = `Bearer ${process.env.JUNIPER_API_KEY}`;
  }
  const res = await fetch(url, { headers, next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function fromJson() {
  const threads = (await import("@/data/threads.json")).default as unknown as DmThread[];
  const messages = (await import("@/data/messages.json"))
    .default as unknown as Record<string, ConversationLine[]>;
  return { threads, messages };
}

export async function getThreads(query?: string): Promise<DmThread[]> {
  if (API_BASE) {
    const q = query ? `?q=${encodeURIComponent(query)}` : "";
    return fetchFromRemote(`/api/dm/threads${q}`);
  }
  if (USE_SQLITE) {
    const { getDmThreads, searchDmThreads } = await import("./db");
    return query ? searchDmThreads(query) : getDmThreads();
  }
  const { threads } = await fromJson();
  if (!query) return threads;
  const q = query.toLowerCase();
  return threads.filter(
    (t) =>
      t.handle?.toLowerCase().includes(q) ||
      String(t.user_id).includes(q) ||
      t.last_message_text?.toLowerCase().includes(q)
  );
}

export async function getMessages(
  userId: string,
  limit?: number
): Promise<ConversationLine[]> {
  if (API_BASE) {
    const q = limit ? `?limit=${limit}` : "";
    return fetchFromRemote(`/api/dm/messages/${userId}${q}`);
  }
  if (USE_SQLITE) {
    const { getDmMessages } = await import("./db");
    return getDmMessages(userId, limit);
  }
  const { messages } = await fromJson();
  const msgs = messages[userId] || [];
  return limit ? msgs.slice(0, limit) : msgs;
}
