import { useMemo, useState } from "react";
import { AdminLayout } from "../components/AdminLayout";
import "./LiveChatPage.css";

type ChatMessage = {
  id: string;
  author: string;
  role: string;
  text: string;
  when: string;
  fromAdmin?: boolean;
};

type ChatSession = {
  id: string;
  name: string;
  preview: string;
  when: string;
  avatarUrl?: string | null;
  subtitle?: string;
  messages: ChatMessage[];
};

export function LiveChatPage() {
  const [sessions] = useState<ChatSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const selected = useMemo(
    () => sessions.find((session) => session.id === selectedId) || null,
    [selectedId, sessions]
  );

  const activeCount = sessions.length;

  return (
    <AdminLayout
      title="Live Chat"
      titleAccent
      breadcrumbs={[
        { label: "Home", to: "/overview" },
        { label: "Help Desk" },
        { label: "Live Chat" }
      ]}
    >
      <div className="livechat-page">
        <aside className="livechat-queue">
          <header className="livechat-queue__header">
            <h2>Active Queue</h2>
            <p>
              {activeCount} Session{activeCount === 1 ? "" : "s"} In Progress
            </p>
          </header>

          <div className="livechat-queue__list">
            {sessions.length === 0 ? (
              <div className="livechat-empty">No active sessions.</div>
            ) : (
              sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  className={`livechat-queue__item${selectedId === session.id ? " is-active" : ""}`}
                  onClick={() => setSelectedId(session.id)}
                >
                  <span className="livechat-avatar">
                    {session.avatarUrl ? <img src={session.avatarUrl} alt="" /> : null}
                  </span>
                  <span className="livechat-queue__meta">
                    <strong>{session.name}</strong>
                    <em>{session.preview}</em>
                  </span>
                  <span className="livechat-queue__when">{session.when}</span>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="livechat-panel">
          {!selected ? (
            <div className="livechat-empty livechat-empty--panel">
              {sessions.length === 0
                ? "Live chat sessions will appear here when users connect."
                : "Select a session from the queue."}
            </div>
          ) : (
            <>
              <header className="livechat-panel__header">
                <div className="livechat-panel__user">
                  <span className="livechat-avatar livechat-avatar--lg">
                    {selected.avatarUrl ? <img src={selected.avatarUrl} alt="" /> : null}
                  </span>
                  <div>
                    <h3>{selected.name}</h3>
                    {selected.subtitle ? <p>{selected.subtitle}</p> : null}
                  </div>
                </div>
                <div className="livechat-panel__actions">
                  <button type="button" aria-label="Voice call" className="livechat-icon-btn">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6 19.8 19.8 0 01-3.1-8.7A2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.3 1.8.6 2.6a2 2 0 01-.5 2.1L8.1 9.9a16 16 0 006 6l1.5-1.1a2 2 0 012.1-.4c.8.3 1.7.5 2.6.6a2 2 0 011.7 2z" />
                    </svg>
                  </button>
                  <button type="button" aria-label="Video call" className="livechat-icon-btn">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <rect x="2" y="6" width="13" height="12" rx="2" />
                      <path d="M15 10l6-3v10l-6-3v-4z" />
                    </svg>
                  </button>
                </div>
              </header>

              <div className="livechat-messages">
                {selected.messages.length === 0 ? (
                  <div className="livechat-empty">No messages yet.</div>
                ) : (
                  selected.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`livechat-bubble${msg.fromAdmin ? " livechat-bubble--admin" : ""}`}
                    >
                      <div className="livechat-bubble__meta">
                        <strong>
                          {msg.author} | {msg.role}
                        </strong>
                        <em>{msg.when}</em>
                      </div>
                      <p>{msg.text}</p>
                    </div>
                  ))
                )}
              </div>

              <footer className="livechat-composer">
                <div className="livechat-composer__tags">
                  <span className="livechat-tag">
                    {activeCount} Session{activeCount === 1 ? "" : "s"} In Progress
                  </span>
                </div>
                <form
                  className="livechat-composer__row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setDraft("");
                  }}
                >
                  <input
                    type="text"
                    placeholder="Type a message…"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <button type="submit" className="livechat-send" aria-label="Send">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  </button>
                </form>
              </footer>
            </>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
