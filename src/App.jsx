import { useState, useEffect, useRef } from "react";

// ─── Supabase config ───────────────────────────────────────────────
const SUPABASE_URL = "https://vwrqdstapeguqjvlwrps.supabase.co";
const SUPABASE_KEY = "sb_publishable_Irsq6di1d317hycpvsD__A_YTQD60ra";

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

async function signUp(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || data.msg || "Signup failed");
  return data;
}

async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (data.error || data.error_code) throw new Error(data.error_description || data.msg || "Login failed");
  return data;
}

// ─── Constants ────────────────────────────────────────────────────
const ROOMS = [
  { id: "general", label: "general", emoji: "💬" },
  { id: "study", label: "study-group", emoji: "📚" },
  { id: "announcements", label: "announcements", emoji: "📢" },
  { id: "off-topic", label: "off-topic", emoji: "🎮" },
  { id: "assignments", label: "assignments", emoji: "📝" },
];

const COLORS = ["#6C63FF","#FF6584","#43B89C","#F4A261","#4FC3F7","#FF8A65","#A29BFE"];
const randomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];

function timeAgo(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── Main App ─────────────────────────────────────────────────────
export default function StudentSpace() {
  const [screen, setScreen] = useState("login"); // login | signup | chat
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [authErr, setAuthErr] = useState("");
  const [loading, setLoading] = useState(false);

  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [activeRoom, setActiveRoom] = useState("general");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const bottomRef = useRef(null);
  const pollRef = useRef(null);

  // scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // load messages when room changes
  useEffect(() => {
    if (!session) return;
    loadMessages();
    clearInterval(pollRef.current);
    pollRef.current = setInterval(loadMessages, 3000);
    return () => clearInterval(pollRef.current);
  }, [activeRoom, session]);

  async function loadMessages() {
    try {
      const data = await sbFetch(
        `/messages?room=eq.${activeRoom}&order=created_at.asc&limit=50`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      setMessages(data);
    } catch (e) {}
  }

  async function handleSignup() {
    if (!email || !password || !username) return setAuthErr("Fill in all fields.");
    if (password.length < 6) return setAuthErr("Password must be at least 6 characters.");
    setLoading(true); setAuthErr("");
    try {
      const data = await signUp(email, password);
      const userId = data.user?.id;
      if (!userId) throw new Error("Signup incomplete — check your email for confirmation, then log in.");
      const color = randomColor();
      await sbFetch("/profiles", {
        method: "POST",
        body: JSON.stringify({ id: userId, username, avatar_color: color }),
      });
      setAuthErr("✅ Account created! Please log in.");
      setScreen("login");
    } catch (e) {
      setAuthErr(e.message);
    }
    setLoading(false);
  }

  async function handleLogin() {
    if (!email || !password) return setAuthErr("Enter email and password.");
    setLoading(true); setAuthErr("");
    try {
      const data = await signIn(email, password);
      const userId = data.user?.id;
      const profiles = await sbFetch(`/profiles?id=eq.${userId}`, {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      if (!profiles.length) throw new Error("Profile not found. Please sign up first.");
      setSession(data);
      setProfile(profiles[0]);
      setScreen("chat");
    } catch (e) {
      setAuthErr(e.message);
    }
    setLoading(false);
  }

  async function sendMessage() {
    if (!input.trim() || !session || !profile) return;
    setSending(true);
    try {
      await sbFetch("/messages", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          user_id: session.user.id,
          username: profile.username,
          avatar_color: profile.avatar_color,
          room: activeRoom,
          content: input.trim(),
        }),
      });
      setInput("");
      await loadMessages();
    } catch (e) {}
    setSending(false);
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function logout() {
    setSession(null); setProfile(null); setMessages([]);
    setScreen("login"); setEmail(""); setPassword("");
    clearInterval(pollRef.current);
  }

  // ── Auth screens ─────────────────────────────────────────────────
  if (screen !== "chat") {
    const isLogin = screen === "login";
    return (
      <div style={s.authWrap}>
        <div style={s.authCard}>
          <div style={s.authLogo}>🎓</div>
          <h1 style={s.authTitle}>StudentSpace</h1>
          <p style={s.authSub}>{isLogin ? "Welcome back 👋" : "Join your campus community"}</p>

          {!isLogin && (
            <input style={s.inp} placeholder="Your name" value={username}
              onChange={e => setUsername(e.target.value)} />
          )}
          <input style={s.inp} placeholder="Email address" value={email}
            onChange={e => setEmail(e.target.value)} type="email" />
          <input style={s.inp} placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)} type="password"
            onKeyDown={e => e.key === "Enter" && (isLogin ? handleLogin() : handleSignup())} />

          {authErr && (
            <div style={{ ...s.errBox, color: authErr.startsWith("✅") ? "#4ade80" : "#f87171" }}>
              {authErr}
            </div>
          )}

          <button style={{ ...s.authBtn, opacity: loading ? 0.6 : 1 }}
            onClick={isLogin ? handleLogin : handleSignup} disabled={loading}>
            {loading ? "Please wait..." : isLogin ? "Log in →" : "Create account →"}
          </button>

          <button style={s.switchBtn}
            onClick={() => { setScreen(isLogin ? "signup" : "login"); setAuthErr(""); }}>
            {isLogin ? "No account? Sign up" : "Have an account? Log in"}
          </button>
        </div>
      </div>
    );
  }

  // ── Chat screen ──────────────────────────────────────────────────
  const currentRoom = ROOMS.find(r => r.id === activeRoom);

  return (
    <div style={s.app}>
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div style={s.overlay} onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside style={{ ...s.sidebar, transform: sidebarOpen ? "translateX(0)" : undefined }}>
        <div style={s.sidebarTop}>
          <span style={{ fontSize: 20 }}>🎓</span>
          <span style={s.sidebarTitle}>StudentSpace</span>
        </div>

        <div style={s.roomsLabel}>ROOMS</div>
        {ROOMS.map(room => (
          <button key={room.id} style={{
            ...s.roomBtn,
            background: activeRoom === room.id ? "rgba(108,99,255,0.2)" : "transparent",
            color: activeRoom === room.id ? "#a89eff" : "#94a3b8",
            fontWeight: activeRoom === room.id ? 700 : 400,
          }} onClick={() => { setActiveRoom(room.id); setSidebarOpen(false); }}>
            {room.emoji} {room.label}
          </button>
        ))}

        <div style={s.profileTag}>
          <div style={{ ...s.av, background: profile?.avatar_color || "#6C63FF", fontSize: 12 }}>
            {profile?.username?.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600 }}>{profile?.username}</div>
            <div style={{ color: "#475569", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 110 }}>{session?.user?.email}</div>
          </div>
          <button style={s.logoutBtn} onClick={logout} title="Log out">⏻</button>
        </div>
      </aside>

      {/* Main */}
      <main style={s.main}>
        <div style={s.chatHeader}>
          <button style={s.menuBtn} onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
          <div>
            <div style={s.roomName}>{currentRoom?.emoji} {currentRoom?.label}</div>
            <div style={s.roomSub}>{messages.length} messages</div>
          </div>
        </div>

        <div style={s.msgs}>
          {messages.length === 0 && (
            <div style={s.emptyMsg}>No messages yet — say hello! 👋</div>
          )}
          {messages.map(msg => {
            const isOwn = msg.user_id === session?.user?.id;
            return (
              <div key={msg.id} style={{ ...s.msgRow, flexDirection: isOwn ? "row-reverse" : "row" }}>
                <div style={{ ...s.av, background: msg.avatar_color || "#6C63FF", fontSize: 11, flexShrink: 0 }}>
                  {msg.username?.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ maxWidth: "68%", display: "flex", flexDirection: "column", alignItems: isOwn ? "flex-end" : "flex-start" }}>
                  <div style={{ marginBottom: 3 }}>
                    <span style={{ color: isOwn ? "#a89eff" : (msg.avatar_color || "#6C63FF"), fontWeight: 700, fontSize: 12 }}>
                      {isOwn ? "You" : msg.username}
                    </span>
                    <span style={{ color: "#475569", fontSize: 11, marginLeft: 6 }}>{timeAgo(msg.created_at)}</span>
                  </div>
                  <div style={{
                    ...s.bubble,
                    background: isOwn ? "#6C63FF" : "#1e2a3a",
                    borderRadius: isOwn ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  }}>
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div style={s.inputRow}>
          <input style={s.chatInp} placeholder={`Message #${currentRoom?.label}...`}
            value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey} />
          <button style={{ ...s.sendBtn, opacity: input.trim() && !sending ? 1 : 0.4 }}
            onClick={sendMessage} disabled={!input.trim() || sending}>
            {sending ? "…" : "↑"}
          </button>
        </div>
      </main>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
const s = {
  authWrap: { minHeight: "100vh", background: "#0d1520", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter','Segoe UI',sans-serif", padding: 16 },
  authCard: { background: "#111827", border: "1px solid #1e2d3d", borderRadius: 20, padding: "36px 28px", width: "100%", maxWidth: 360, textAlign: "center" },
  authLogo: { fontSize: 44, marginBottom: 10 },
  authTitle: { color: "#e2e8f0", fontWeight: 800, fontSize: 24, margin: "0 0 4px" },
  authSub: { color: "#64748b", fontSize: 13, marginBottom: 24 },
  inp: { width: "100%", background: "#1e2a3a", border: "1px solid #2d3f55", borderRadius: 10, padding: "11px 14px", color: "#e2e8f0", fontSize: 14, outline: "none", marginBottom: 10, boxSizing: "border-box" },
  errBox: { fontSize: 13, marginBottom: 10, padding: "8px 12px", background: "rgba(255,100,100,0.08)", borderRadius: 8 },
  authBtn: { width: "100%", background: "#6C63FF", border: "none", borderRadius: 10, padding: 12, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", transition: "opacity 0.2s" },
  switchBtn: { background: "none", border: "none", color: "#6C63FF", fontSize: 13, cursor: "pointer", marginTop: 14 },
  app: { display: "flex", height: "100vh", background: "#0d1520", fontFamily: "'Inter','Segoe UI',sans-serif", overflow: "hidden", position: "relative" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 10 },
  sidebar: { width: 220, background: "#111827", display: "flex", flexDirection: "column", borderRight: "1px solid #1e2d3d", flexShrink: 0, zIndex: 20, transition: "transform 0.2s", "@media(max-width:600px)": { position: "fixed", height: "100%", transform: "translateX(-100%)" } },
  sidebarTop: { display: "flex", alignItems: "center", gap: 10, padding: "16px 16px 12px", borderBottom: "1px solid #1e2d3d" },
  sidebarTitle: { color: "#e2e8f0", fontWeight: 800, fontSize: 15 },
  roomsLabel: { color: "#475569", fontSize: 10, fontWeight: 700, letterSpacing: 1.2, padding: "14px 16px 6px" },
  roomBtn: { display: "block", width: "100%", textAlign: "left", padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 13, borderRadius: 6, margin: "1px 0", transition: "all 0.15s" },
  profileTag: { marginTop: "auto", padding: "12px 14px", borderTop: "1px solid #1e2d3d", display: "flex", alignItems: "center", gap: 8 },
  av: { width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700 },
  logoutBtn: { background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 16, padding: 4 },
  main: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 },
  chatHeader: { padding: "12px 16px", borderBottom: "1px solid #1e2d3d", background: "#111827", display: "flex", alignItems: "center", gap: 12 },
  menuBtn: { background: "none", border: "none", color: "#94a3b8", fontSize: 20, cursor: "pointer", padding: 0 },
  roomName: { color: "#e2e8f0", fontWeight: 700, fontSize: 14 },
  roomSub: { color: "#475569", fontSize: 11, marginTop: 1 },
  msgs: { flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 12 },
  emptyMsg: { color: "#475569", textAlign: "center", marginTop: 40, fontSize: 14 },
  msgRow: {  I display: "flex", alignItems: "flex-end", gap: 8 },
  bubble: { padding: "9px 13px", color: "#e2e8f0", fontSize: 14, lineHeight: 1.5, wordBreak: "break-word" },
  inputRow: { padding: "12px 16px", borderTop: "1px solid #1e2d3d", background: "#111827", display: "flex", gap: 8, alignItems: "center" },
  chatInp: { flex: 1, background: "#1e2a3a", border: "1px solid #2d3f55", borderRadius: 12, padding: "10px 14px", color: "#e2e8f0", fontSize: 14, outline: "none" },
  sendBtn: { width: 38, height: 38, borderRadius: "50%", background: "#6C63FF", border: "none", color: "#fff", fontSize: 18, cursor: "pointer", fontWeight: 700, flexShrink: 0 },
};
