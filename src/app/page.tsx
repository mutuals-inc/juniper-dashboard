"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface DmThread {
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

interface Message {
  id: number;
  user_id: string;
  timestamp: string;
  role: "user" | "assistant";
  text: string;
}

function timeAgo(ts: string): string {
  const now = Date.now();
  const then = new Date(ts).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(ts: string): string {
  return new Date(ts).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function userColor(userId: string): string {
  const colors = [
    "#5865f2",
    "#57f287",
    "#fee75c",
    "#eb459e",
    "#ed4245",
    "#f47b67",
    "#e8a553",
    "#3ba55d",
    "#9b59b6",
    "#1abc9c",
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return colors[Math.abs(hash) % colors.length];
}

function Avatar({
  name,
  userId,
  size = 32,
  isJuniper = false,
  avatarUrl,
}: {
  name: string;
  userId: string;
  size?: number;
  isJuniper?: boolean;
  avatarUrl?: string | null;
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={{
          width: size,
          height: size,
          minWidth: size,
          borderRadius: "50%",
          objectFit: "cover",
        }}
      />
    );
  }
  const bg = isJuniper ? "#e07b39" : userColor(userId);
  const initial = isJuniper ? "J" : name.charAt(0).toUpperCase() || "?";
  return (
    <div
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: "50%",
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.45,
        fontWeight: 600,
        color: "#fff",
      }}
    >
      {initial}
    </div>
  );
}

function ThreadList({
  threads,
  selectedId,
  onSelect,
  search,
  onSearch,
}: {
  threads: DmThread[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  search: string;
  onSearch: (q: string) => void;
}) {
  return (
    <div
      style={{
        width: 320,
        minWidth: 320,
        background: "var(--bg-secondary)",
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid var(--bg-tertiary)",
        height: "100%",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 10px",
          borderBottom: "1px solid var(--bg-tertiary)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          height: 48,
        }}
      >
        <Avatar name="J" userId="juniper" size={28} isJuniper />
        <span
          style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}
        >
          Juniper Pi
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 11,
            color: "var(--text-muted)",
            background: "var(--bg-tertiary)",
            padding: "2px 8px",
            borderRadius: 10,
          }}
        >
          {threads.length} DMs
        </span>
      </div>

      {/* Search */}
      <div style={{ padding: "8px 10px" }}>
        <input
          type="text"
          placeholder="Search DMs..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "7px 10px",
            background: "var(--bg-tertiary)",
            border: "none",
            borderRadius: 4,
            color: "var(--text-primary)",
            fontSize: 13,
            outline: "none",
          }}
        />
      </div>

      {/* Thread list */}
      <div style={{ flex: 1, overflow: "auto", padding: "0 6px" }}>
        {threads.map((t) => {
          const name = t.handle || `User ${String(t.user_id).slice(-4)}`;
          const active = t.user_id === selectedId;
          return (
            <button
              key={t.user_id}
              onClick={() => onSelect(t.user_id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "8px 6px",
                background: active
                  ? "var(--bg-active)"
                  : "transparent",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                textAlign: "left",
                color: "var(--text-primary)",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => {
                if (!active)
                  e.currentTarget.style.background = "var(--bg-message-hover)";
              }}
              onMouseLeave={(e) => {
                if (!active)
                  e.currentTarget.style.background = "transparent";
              }}
            >
              <Avatar name={name} userId={t.user_id} size={36} avatarUrl={t.avatar_url} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {name}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      flexShrink: 0,
                      marginLeft: 6,
                    }}
                  >
                    {timeAgo(t.last_message_at)}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    marginTop: 1,
                  }}
                >
                  {t.last_message_role === "assistant" ? (
                    <span style={{ color: "var(--accent-juniper)" }}>
                      Juniper:{" "}
                    </span>
                  ) : null}
                  {t.last_message_text}
                </div>
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text-muted)",
                  background: "var(--bg-tertiary)",
                  padding: "1px 6px",
                  borderRadius: 8,
                  flexShrink: 0,
                }}
              >
                {t.message_count}
              </div>
            </button>
          );
        })}
        {threads.length === 0 && (
          <div
            style={{
              padding: 20,
              textAlign: "center",
              color: "var(--text-muted)",
            }}
          >
            No conversations found
          </div>
        )}
      </div>
    </div>
  );
}

function shouldGroup(prev: Message | null, curr: Message): boolean {
  if (!prev) return false;
  if (prev.role !== curr.role) return false;
  const diff =
    new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime();
  return diff < 5 * 60 * 1000;
}

function shouldShowDate(prev: Message | null, curr: Message): boolean {
  if (!prev) return true;
  const d1 = new Date(prev.timestamp).toDateString();
  const d2 = new Date(curr.timestamp).toDateString();
  return d1 !== d2;
}

function ConversationView({
  userId,
  handle,
  avatarUrl,
  messages,
  loading,
}: {
  userId: string;
  handle: string | null;
  avatarUrl: string | null;
  messages: Message[];
  loading: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const name = handle || `User ${String(userId).slice(-4)}`;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages]);

  if (loading) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      {/* Chat header */}
      <div
        style={{
          height: 48,
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderBottom: "1px solid var(--bg-tertiary)",
          flexShrink: 0,
        }}
      >
        <span style={{ color: "var(--text-muted)", fontSize: 20 }}>@</span>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{name}</span>
        <span
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            marginLeft: 4,
          }}
        >
          ID: {userId}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
          <span
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              background: "var(--bg-tertiary)",
              padding: "3px 10px",
              borderRadius: 10,
            }}
          >
            {messages.filter((m) => m.role === "user").length} from them
          </span>
          <span
            style={{
              fontSize: 12,
              color: "var(--accent-juniper)",
              background: "var(--bg-tertiary)",
              padding: "3px 10px",
              borderRadius: 10,
            }}
          >
            {messages.filter((m) => m.role === "assistant").length} from Juniper
          </span>
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "16px 0",
        }}
      >
        {/* DM intro header */}
        <div style={{ padding: "16px 56px 24px", textAlign: "left" }}>
          <Avatar name={name} userId={userId} size={64} avatarUrl={avatarUrl} />
          <h2
            style={{
              fontSize: 24,
              fontWeight: 700,
              marginTop: 8,
              color: "var(--text-primary)",
            }}
          >
            {name}
          </h2>
          <p
            style={{
              color: "var(--text-muted)",
              fontSize: 14,
              marginTop: 4,
            }}
          >
            This is the beginning of your direct message history with{" "}
            <strong>{name}</strong>.
          </p>
        </div>

        {messages.map((msg, i) => {
          const prev = i > 0 ? messages[i - 1] : null;
          const grouped = shouldGroup(prev, msg);
          const showDate = shouldShowDate(prev, msg);
          const isJuniper = msg.role === "assistant";
          const authorName = isJuniper ? "Juniper Pi" : name;

          return (
            <div key={msg.id}>
              {showDate && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    margin: "16px 16px 8px",
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      background: "var(--border)",
                    }}
                  />
                  <span
                    style={{
                      padding: "0 8px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                    }}
                  >
                    {formatDate(msg.timestamp)}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      background: "var(--border)",
                    }}
                  />
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  padding: grouped
                    ? "1px 48px 1px 16px"
                    : "4px 48px 4px 16px",
                  marginTop: grouped ? 0 : 12,
                  gap: 12,
                  position: "relative",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background =
                    "var(--bg-message-hover)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                {grouped ? (
                  <div
                    style={{ width: 40, minWidth: 40, position: "relative" }}
                  >
                    <span
                      className="hover-time"
                      style={{
                        position: "absolute",
                        right: 0,
                        top: 2,
                        fontSize: 10,
                        color: "var(--text-muted)",
                        opacity: 0,
                        transition: "opacity 0.1s",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                ) : (
                  <Avatar
                    name={authorName}
                    userId={isJuniper ? "juniper" : msg.user_id}
                    size={40}
                    isJuniper={isJuniper}
                    avatarUrl={isJuniper ? null : avatarUrl}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {!grouped && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: 15,
                          color: isJuniper
                            ? "var(--accent-juniper)"
                            : userColor(msg.user_id),
                        }}
                      >
                        {authorName}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                        }}
                      >
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                  )}
                  <div
                    style={{
                      color: "var(--text-primary)",
                      fontSize: 15,
                      lineHeight: 1.4,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {msg.text}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Read-only footer */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid var(--bg-tertiary)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            background: "var(--input-bg)",
            borderRadius: 8,
            padding: "11px 16px",
            color: "var(--text-muted)",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            style={{ flexShrink: 0 }}
          >
            <path
              d="M13 8.5H3a.5.5 0 010-1h10a.5.5 0 010 1z"
              fill="currentColor"
            />
            <path
              d="M8 3a5 5 0 100 10A5 5 0 008 3zm0 9a4 4 0 110-8 4 4 0 010 8z"
              fill="currentColor"
            />
          </svg>
          Read-only view &mdash; monitoring Juniper&apos;s DMs
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-muted)",
        gap: 12,
      }}
    >
      <div style={{ fontSize: 48 }}>@</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-secondary)" }}>
        Select a conversation
      </div>
      <div style={{ fontSize: 14 }}>
        Choose a DM from the sidebar to view the conversation
      </div>
    </div>
  );
}

export default function DmDashboard() {
  const [threads, setThreads] = useState<DmThread[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchThreads = useCallback(async (q?: string) => {
    const url = q
      ? `/api/conversations?q=${encodeURIComponent(q)}`
      : "/api/conversations";
    const res = await fetch(url);
    const data = await res.json();
    setThreads(
      (data as DmThread[]).map((t) => ({ ...t, user_id: String(t.user_id) }))
    );
  }, []);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  const handleSearch = (q: string) => {
    setSearch(q);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchThreads(q || undefined);
    }, 250);
  };

  const handleSelect = async (userId: string) => {
    setSelectedId(userId);
    setLoading(true);
    const res = await fetch(`/api/conversations/${userId}`);
    const data = await res.json();
    setMessages(data);
    setLoading(false);
  };

  const selectedThread = threads.find((t) => t.user_id === selectedId);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <ThreadList
        threads={threads}
        selectedId={selectedId}
        onSelect={handleSelect}
        search={search}
        onSearch={handleSearch}
      />
      {selectedId ? (
        <ConversationView
          userId={selectedId}
          handle={selectedThread?.handle || null}
          avatarUrl={selectedThread?.avatar_url || null}
          messages={messages}
          loading={loading}
        />
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
