/* global React, ReactDOM */

const { useState, useEffect, useRef } = React;

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
  if (data.error) throw new Error(data.error.message || "Signup failed");
  return data;
}

async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (data.error || data.error_code) throw new Error(data.error_description || "Login failed");
  return data;
}

const ROOMS = [
  { id: "general", label: "general", emoji: "💬" },
  { id: "study", label: "study-group", emoji: "📚" },
  { id: "announcements", label: "announcements", emoji: "📢" },
  { id: "off-topic", label: "off-topic", emoji: "🎮" },
  { id: "assignments", label: "assignments", emoji: "📝" },
];

const COLORS = ["#6C63FF","#FF6584","#43B89C","#F4A261","#4FC3F7"];
const randomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];
const timeStr = (ts) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function StudentSpace() {
  const [screen, setScreen] = useState("login");
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

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (!session) return;
    loadMessages();
    clearInterval(pollRef.current);
    pollRef.current = setInterval(loadMessages, 3000);
    return () => clearInterval(pollRef.current);
  }, [activeRoom, session]);

  async function loadMessages() {
    try {
      const data = await sbFetch(`/messages?room=eq.${activeRoom}&order=created_at.asc&limit=50`,
        { headers: { Authorization: `Bearer ${session.access_token}` } });
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
      if (!userId) throw new Error("Check your email for confirmation, then log in.");
      await sbFetch("/profiles", { method: "POST",
        body: JSON.stringify({ id: userId, username, avatar_color: randomColor() }) });
      setAuthErr("✅ Account created! Please log in.");
      setScreen("login");
    } catch (e) { setAuthErr(e.message); }
    setLoading(false);
  }

  async function handleLogin() {
    if (!email || !password) return setAuthErr("Enter email and password.");
    setLoading(true); setAuthErr("");
    try {
      const data = await signIn(email, password);
      const profiles = await sbFetch(`/profiles?id=eq.${data.user?.id}`,
        { headers: { Authorization: `Bearer ${data.access_token}` } });
      if (!profiles.length) throw new Error("Profile not found. Please sign up first.");
      setSession(data); setProfile(profiles[0]); setScreen("chat");
    } catch (e) { setAuthErr(e.message); }
    setLoading(false);
  }

  async function sendMessage() {
    if (!input.trim() || !session || !profile) return;
    setSending(true);
    try {
      await sbFetch("/messages", { method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ user_id: session.user.id, username: profile.username,
          avatar_color: profile.avatar_color, room: activeRoom, content: input.trim() }) });
      setInput(""); await loadMessages();
    } catch (e) {}
    setSending(false);
  }

  function logout() {
    setSession(null); setProfile(null); setMessages([]);
    setScreen("login"); setEmail(""); setPassword("");
    clearInterval(pollRef.current);
  }

  const s = {
    authWrap: { minHeight:"100vh", background:"#0d1520", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"sans-serif", padding:16 },
    authCard: { background:"#111827", border:"1px solid #1e2d3d", borderRadius:20, padding:"36px 28px", width:"100%", maxWidth:360, textAlign:"center" },
    inp: { width:"100%", background:"#1e2a3a", border:"1px solid #2d3f55", borderRadius:10, padding:"11px 14px", color:"#e2e8f0", fontSize:14, outline:"none", marginBottom:10, boxSizing:"border-box", display:"block" },
    btn: { width:"100%", background:"#6C63FF", border:"none", borderRadius:10, padding:12, color:"#fff", fontWeight:700, fontSize:15, cursor:"pointer" },
    app: { display:"flex", height:"100vh", background:"#0d1520", fontFamily:"sans-serif", overflow:"hidden", position:"relative" },
    sidebar: { width:220, background:"#111827", display:"flex", flexDirection:"column", borderRight:"1px solid #1e2d3d", flexShrink:0, position:"fixed", height:"100%", zIndex:20, transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)", transition:"transform 0.2s" },
    overlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:10 },
    main: { flex:1, display:"flex", flexDirection:"column", overflow:"hidden", marginLeft:0 },
    bubble: { padding:"9px 13px", color:"#e2e8f0", fontSize:14, lineHeight:1.5, wordBreak:"break-word" },
    av: { width:32, height:32, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:700, fontSize:11, flexShrink:0 },
  };

  if (screen !== "chat") {
    const isLogin = screen === "login";
    return React.createElement("div", { style: s.authWrap },
      React.createElement("div", { style: s.authCard },
        React.createElement("div", { style: { fontSize:44, marginBottom:10 } }, "🎓"),
        React.createElement("h1", { style: { color:"#e2e8f0", fontWeight:800, fontSize:24, margin:"0 0 4px" } }, "CampusHub"),
        React.createElement("p", { style: { color:"#64748b", fontSize:13, marginBottom:24 } }, isLogin ? "Welcome back 👋" : "Join your campus community"),
        !isLogin && React.createElement("input", { style: s.inp, placeholder:"Your name", value:username, onChange:e=>setUsername(e.target.value) }),
        React.createElement("input", { style: s.inp, placeholder:"Email address", value:email, type:"email", onChange:e=>setEmail(e.target.value) }),
        React.createElement("input", { style: s.inp, placeholder:"Password", value:password, type:"password", onChange:e=>setPassword(e.target.value) }),
        authErr && React.createElement("div", { style:{ color: authErr.startsWith("✅") ? "#4ade80" : "#f87171", fontSize:13, marginBottom:10 } }, authErr),
        React.createElement("button", { style:{ ...s.btn, opacity: loading ? 0.6 : 1 }, onClick: isLogin ? handleLogin : handleSignup, disabled:loading },
          loading ? "Please wait..." : isLogin ? "Log in →" : "Create account →"),
        React.createElement("button", { style:{ background:"none", border:"none", color:"#6C63FF", fontSize:13, cursor:"pointer", marginTop:14 },
          onClick:()=>{ setScreen(isLogin ? "signup" : "login"); setAuthErr(""); } },
          isLogin ? "No account? Sign up" : "Have an account? Log in")
      )
    );
  }

  const currentRoom = ROOMS.find(r => r.id === activeRoom);

  return React.createElement("div", { style: s.app },
    sidebarOpen && React.createElement("div", { style: s.overlay, onClick:()=>setSidebarOpen(false) }),
    React.createElement("aside", { style: s.sidebar },
      React.createElement("div", { style:{ display:"flex", alignItems:"center", gap:10, padding:"16px 16px 12px", borderBottom:"1px solid #1e2d3d" } },
        React.createElement("span", { style:{fontSize:20} }, "🎓"),
        React.createElement("span", { style:{ color:"#e2e8f0", fontWeight:800, fontSize:15 } }, "CampusHub")
      ),
      React.createElement("div", { style:{ color:"#475569", fontSize:10, fontWeight:700, letterSpacing:1.2, padding:"14px 16px 6px" } }, "ROOMS"),
      ...ROOMS.map(room => React.createElement("button", {
        key: room.id,
        style:{ display:"block", width:"100%", textAlign:"left", padding:"8px 16px", border:"none", cursor:"pointer", fontSize:13, borderRadius:6, margin:"1px 0",
          background: activeRoom===room.id ? "rgba(108,99,255,0.2)" : "transparent",
          color: activeRoom===room.id ? "#a89eff" : "#94a3b8", fontWeight: activeRoom===room.id ? 700 : 400 },
        onClick:()=>{ setActiveRoom(room.id); setSidebarOpen(false); }
      }, `${room.emoji} ${room.label}`)),
      React.createElement("div", { style:{ marginTop:"auto", padding:"12px 14px", borderTop:"1px solid #1e2d3d", display:"flex", alignItems:"center", gap:8 } },
        React.createElement("div", { style:{ ...s.av, background: profile?.avatar_color || "#6C63FF" } }, profile?.username?.slice(0,2).toUpperCase()),
        React.createElement("div", { style:{flex:1} },
          React.createElement("div", { style:{ color:"#e2e8f0", fontSize:13, fontWeight:600 } }, profile?.username),
        ),
        React.createElement("button", { style:{ background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:16 }, onClick:logout }, "⏻")
      )
    ),
    React.createElement("main", { style: s.main },
      React.createElement("div", { style:{ padding:"12px 16px", borderBottom:"1px solid #1e2d3d", background:"#111827", display:"flex", alignItems:"center", gap:12 } },
        React.createElement("button", { style:{ background:"none", border:"none", color:"#94a3b8", fontSize:20, cursor:"pointer" }, onClick:()=>setSidebarOpen(!sidebarOpen) }, "☰"),
        React.createElement("div", null,
          React.createElement("div", { style:{ color:"#e2e8f0", fontWeight:700, fontSize:14 } }, `${currentRoom?.emoji} ${currentRoom?.label}`),
          React.createElement("div", { style:{ color:"#475569", fontSize:11 } }, `${messages.length} messages`)
        )
      ),
      React.createElement("div", { style:{ flex:1, overflowY:"auto", padding:16, display:"flex", flexDirection:"column", gap:12 } },
        messages.length === 0 && React.createElement("div", { style:{ color:"#475569", textAlign:"center", marginTop:40 } }, "No messages yet — say hello! 👋"),
        ...messages.map(msg => {
          const isOwn = msg.user_id === session?.user?.id;
          return React.createElement("div", { key:msg.id, style:{ display:"flex", alignItems:"flex-end", gap:8, flexDirection: isOwn ? "row-reverse" : "row" } },
            React.createElement("div", { style:{ ...s.av, background: msg.avatar_color || "#6C63FF" } }, msg.username?.slice(0,2).toUpperCase()),
            React.createElement("div", { style:{ maxWidth:"68%", display:"flex", flexDirection:"column", alignItems: isOwn ? "flex-end" : "flex-start" } },
              React.createElement("div", { style:{ marginBottom:3 } },
                React.createElement("span", { style:{ color: isOwn ? "#a89eff" : (msg.avatar_color||"#6C63FF"), fontWeight:700, fontSize:12 } }, isOwn ? "You" : msg.username),
                React.createElement("span", { style:{ color:"#475569", fontSize:11, marginLeft:6 } }, timeStr(msg.created_at))
              ),
              React.createElement("div", { style:{ ...s.bubble, background: isOwn ? "#6C63FF" : "#1e2a3a",
                borderRadius: isOwn ? "18px 18px 4px 18px" : "18px 18px 18px 4px" } }, msg.content)
            )
          );
        }),
        React.createElement("div", { ref: bottomRef })
      ),
      React.createElement("div", { style:{ padding:"12px 16px", borderTop:"1px solid #1e2d3d", background:"#111827", display:"flex", gap:8, alignItems:"center" } },
        React.createElement("input", { style:{ flex:1, background:"#1e2a3a", border:"1px solid #2d3f55", borderRadius:12, padding:"10px 14px", color:"#e2e8f0", fontSize:14, outline:"none" },
          placeholder:`Message #${currentRoom?.label}...`, value:input, onChange:e=>setInput(e.target.value),
          onKeyDown:e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); sendMessage(); } } }),
        React.createElement("button", { style:{ width:38, height:38, borderRadius:"50%", background:"#6C63FF", border:"none", color:"#fff", fontSize:18, cursor:"pointer", fontWeight:700, opacity: input.trim()&&!sending ? 1 : 0.4 },
          onClick:sendMessage, disabled:!input.trim()||sending }, sending ? "…" : "↑")
      )
    )
  );
}

window.StudentSpace = StudentSpace;