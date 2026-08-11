import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const STORAGE_KEY = "ai-chat-history";

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function saveHistory(history) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export default function App() {
  const [history, setHistory] = useState(loadHistory);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // persist conversation to history after assistant finishes
  useEffect(() => {
    if (isStreaming || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role !== "assistant" || !last.content) return;

    setHistory((prev) => {
      const title = messages.find((m) => m.role === "user")?.content.slice(0, 40) || "New Chat";
      const existing = prev.find((c) => c.id === activeId);
      let updated;
      if (existing) {
        updated = prev.map((c) => c.id === activeId ? { ...c, messages } : c);
      } else {
        const newConvo = { id: Date.now(), title, messages };
        setActiveId(newConvo.id);
        updated = [newConvo, ...prev];
      }
      saveHistory(updated);
      return updated;
    });
  }, [isStreaming]);

  function newChat() {
    setActiveId(null);
    setMessages([]);
    setInput("");
  }

  function loadConvo(convo) {
    setActiveId(convo.id);
    setMessages(convo.messages);
    setInput("");
  }

  function deleteConvo(e, id) {
    e.stopPropagation();
    const updated = history.filter((c) => c.id !== id);
    saveHistory(updated);
    setHistory(updated);
    if (activeId === id) newChat();
  }

  async function sendMessage(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMessage = { role: "user", content: text };
    const nextMessages = [...messages, userMessage];

    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setInput("");
    setIsStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!res.ok || !res.body) throw new Error(`Request failed: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = JSON.parse(line.slice(6));
          if (payload.type === "text") appendToLast(payload.text);
          else if (payload.type === "error") appendToLast(`\n[error: ${payload.error}]`);
        }
      }
    } catch (err) {
      appendToLast(`\n[error: ${err.message}]`);
    } finally {
      setIsStreaming(false);
    }
  }

  function appendToLast(chunk) {
    setMessages((prev) => {
      const updated = [...prev];
      const i = updated.length - 1;
      updated[i] = { ...updated[i], content: updated[i].content + chunk };
      return updated;
    });
  }

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
        <div className="sidebar-header">
          <button className="new-chat-btn" onClick={newChat}>+ New Chat</button>
        </div>
        <div className="sidebar-list">
          {history.length === 0 && <p className="sidebar-empty">No conversations yet</p>}
          {history.map((c) => (
            <div
              key={c.id}
              className={`sidebar-item ${c.id === activeId ? "active" : ""}`}
              onClick={() => loadConvo(c)}
            >
              <span className="sidebar-title">{c.title}</span>
              <button className="delete-btn" onClick={(e) => deleteConvo(e, c.id)}>✕</button>
            </div>
          ))}
        </div>
      </aside>

      {/* Main */}
      <div className="app">
        <header className="header">
          <button className="toggle-btn" onClick={() => setSidebarOpen((o) => !o)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="online-dot" />
          <h1>AI Chat</h1>
        </header>

        <main className="chat-window">
          {messages.length === 0 && (
            <p className="empty-state">Send a message to start the conversation.</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`message ${m.role}`}>
              <span className="role-label">{m.role === "user" ? "You" : "Assistant"}</span>
              {m.role === "assistant" ? (
                <div className="markdown">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {m.content || (isStreaming && i === messages.length - 1 ? "…" : "")}
                  </ReactMarkdown>
                </div>
              ) : (
                <p>{m.content}</p>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </main>

        <form className="input-row" onSubmit={sendMessage}>
          <div className="input-wrap">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message..."
              disabled={isStreaming}
              autoFocus
            />
            <button type="submit" disabled={isStreaming || !input.trim()}>
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
