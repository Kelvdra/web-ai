const chatEl = document.getElementById("chat");
const heroEl = document.getElementById("hero");
const chatListEl = document.getElementById("chatList");

const form = document.getElementById("form");
const textEl = document.getElementById("text");
const sendBtn = document.getElementById("sendBtn");
const statusText = document.getElementById("statusText");

const fileInput = document.getElementById("fileInput");
const attachBtn = document.getElementById("attachBtn");
const fileRow = document.getElementById("fileRow");
const filePill = document.getElementById("filePill");
const removeFileBtn = document.getElementById("removeFileBtn");

const newChatBtn = document.getElementById("newChatBtn");
const clearBtn = document.getElementById("clearBtn");

const toast = document.getElementById("toast");

let selectedFile = null;
let typingId = null;

const LS_KEY = "ai_chat_sessions_v1";
let sessions = loadSessions();
let activeId = ensureActiveSession();

renderSidebar();
renderActiveChat();
textEl.focus();

function showToast(msg){
  toast.textContent = msg;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 1800);
}

function setStatus(s){ statusText.textContent = s; }

function autoResize(){
  textEl.style.height = "auto";
  const max = 160;
  textEl.style.height = Math.min(textEl.scrollHeight, max) + "px";
}

textEl.addEventListener("input", autoResize);

textEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey){
    e.preventDefault();
    form.requestSubmit();
  }
});

attachBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  selectedFile = f;
  filePill.textContent = `${f.name} · ${prettySize(f.size)}`;
  fileRow.classList.remove("hidden");
});

removeFileBtn.addEventListener("click", () => {
  selectedFile = null;
  fileInput.value = "";
  fileRow.classList.add("hidden");
  filePill.textContent = "";
});

newChatBtn.addEventListener("click", () => {
  const id = createSession();
  activeId = id;
  saveSessions();
  renderSidebar();
  renderActiveChat();
  showToast("New chat dibuat");
});

clearBtn.addEventListener("click", () => {
  const s = getActive();
  s.messages = [];
  s.title = "New chat";
  saveSessions();
  renderSidebar();
  renderActiveChat();
  showToast("Chat dibersihkan");
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = (textEl.value || "").trim();

  if (!text && !selectedFile) return;

  // add user message
  const s = getActive();
  const userMsg = { role:"user", text, hasFile: !!selectedFile, fileMeta: selectedFile ? { name: selectedFile.name, type: selectedFile.type, size: selectedFile.size } : null };
  s.messages.push(userMsg);

  if (s.title === "New chat" && text){
    s.title = makeTitle(text);
  }

  saveSessions();
  renderSidebar();
  appendMessageToUI(userMsg);

  // reset composer
  textEl.value = "";
  autoResize();
  selectedFile = null;
  fileInput.value = "";
  fileRow.classList.add("hidden");
  filePill.textContent = "";

  // lock ui
  sendBtn.disabled = true;
  textEl.disabled = true;
  attachBtn.disabled = true;

  setStatus("Sending…");
  showTyping();

  try {
    const formData = new FormData();
    formData.set("text", text);
    if (userMsg.fileMeta && userMsg.fileMeta.name && userMsg.hasFile) {
      // NOTE: kita butuh file asli untuk upload; tapi kita reset selectedFile di atas.
      // Jadi, supaya aman: pindahkan reset selectedFile setelah request.
      // Untuk versi cepat ini, kita bikin ulang: simpan file sebelum reset.
    }
  } catch {}

  // --- versi benar: ambil file sebelum reset ---
  // (kita re-implement agar file keupload)
});

form.removeEventListener("submit", () => {});
form.addEventListener("submit", submitHandler);

async function submitHandler(e){
  e.preventDefault();
  const raw = (textEl.value || "");
  const text = raw.trim();

  if (!text && !selectedFile) return;

  const fileToSend = selectedFile; // simpan dulu

  const s = getActive();
  const userMsg = { role:"user", text, hasFile: !!fileToSend, fileMeta: fileToSend ? { name: fileToSend.name, type: fileToSend.type, size: fileToSend.size } : null };
  s.messages.push(userMsg);

  if (s.title === "New chat" && text){
    s.title = makeTitle(text);
  }
  saveSessions();
  renderSidebar();
  appendMessageToUI(userMsg);

  // lock ui
  sendBtn.disabled = true;
  textEl.disabled = true;
  attachBtn.disabled = true;

  setStatus("Sending…");
  showTyping();

  try{
    const formData = new FormData();
    formData.set("text", raw); // keep newline
    if (fileToSend) formData.set("file", fileToSend);

    // reset composer AFTER building formData
    textEl.value = "";
    autoResize();
    selectedFile = null;
    fileInput.value = "";
    fileRow.classList.add("hidden");
    filePill.textContent = "";

    const res = await fetch("/chat", { method:"POST", body: formData });
    const data = await res.json();

    hideTyping();

    if (data?.result){
      const aiMsg = { role:"ai", text: String(data.result) };
      s.messages.push(aiMsg);
      saveSessions();
      appendMessageToUI(aiMsg);
      setStatus("Ready");
    } else {
      const errMsg = { role:"ai", text: `Error: ${String(data?.error || "Unknown error")}` };
      s.messages.push(errMsg);
      saveSessions();
      appendMessageToUI(errMsg);
      setStatus("Error");
    }
  } catch(err){
    hideTyping();
    const s2 = getActive();
    const errMsg = { role:"ai", text:"Network error. Periksa koneksi internet." };
    s2.messages.push(errMsg);
    saveSessions();
    appendMessageToUI(errMsg);
    setStatus("Offline");
  } finally {
    sendBtn.disabled = false;
    textEl.disabled = false;
    attachBtn.disabled = false;
    textEl.focus();
    chatEl.scrollTop = chatEl.scrollHeight;
  }
}

/* ---------- UI render ---------- */
function renderSidebar(){
  chatListEl.innerHTML = "";
  sessions
    .sort((a,b) => b.updatedAt - a.updatedAt)
    .forEach(s => {
      const item = document.createElement("div");
      item.className = "chat-item" + (s.id === activeId ? " active" : "");
      item.innerHTML = `
        <div class="chat-item-title" title="${escapeHtml(s.title)}">${escapeHtml(s.title)}</div>
        <div class="chat-item-actions">
          <button class="mini-btn" title="Delete">🗑</button>
        </div>
      `;

      item.addEventListener("click", (e) => {
        const delBtn = e.target.closest(".mini-btn");
        if (delBtn){
          deleteSession(s.id);
          return;
        }
        activeId = s.id;
        saveSessions();
        renderSidebar();
        renderActiveChat();
      });

      chatListEl.appendChild(item);
    });
}

function renderActiveChat(){
  // clear all messages but keep hero if empty
  // easiest: rebuild content section
  chatEl.innerHTML = "";
  const s = getActive();

  if (!s.messages.length){
    chatEl.appendChild(heroEl);
    heroEl.style.display = "";
  } else {
    heroEl.style.display = "none";
    s.messages.forEach(m => appendMessageToUI(m, true));
  }

  chatEl.scrollTop = chatEl.scrollHeight;
}

function appendMessageToUI(msg, skipSave=false){
  if (heroEl && msg) heroEl.style.display = "none";

  const wrap = document.createElement("div");
  wrap.className = "msg " + (msg.role === "user" ? "user" : "ai");

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = msg.role === "user" ? "🙂" : "🤖";

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  let html = "";

  // file meta display (simple)
  if (msg.hasFile && msg.fileMeta){
    html += `<div class="muted small">📎 ${escapeHtml(msg.fileMeta.name)} · ${prettySize(msg.fileMeta.size)}</div><div style="height:8px"></div>`;
  }

  html += renderMessageText(msg.text);

  bubble.innerHTML = html;

  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  chatEl.appendChild(wrap);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function showTyping(){
  if (typingId) return;

  const wrap = document.createElement("div");
  wrap.className = "msg ai";
  wrap.id = "typing";

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = "🤖";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = `
    <div class="typing">
      <span class="dot"></span><span class="dot"></span><span class="dot"></span>
    </div>
  `;

  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  chatEl.appendChild(wrap);

  typingId = "typing";
  chatEl.scrollTop = chatEl.scrollHeight;
}

function hideTyping(){
  const el = document.getElementById("typing");
  if (el) el.remove();
  typingId = null;
}

/* ---------- Text rendering: codeblock + copy ---------- */
function renderMessageText(text){
  const safe = escapeHtml(String(text));

  // code blocks ```lang ... ```
  const re = /```(\w+)?\s*([\s\S]*?)```/g;
  let out = safe.replace(re, (_, lang, code) => {
    const id = "code-" + Math.random().toString(36).slice(2,10);
    const language = (lang || "text").toLowerCase();
    return `
      <div class="codeblock">
        <div class="codebar">
          <span class="lang">${language}</span>
          <button class="copy" data-code="${id}">Copy</button>
        </div>
        <pre id="${id}"><code>${code.trim()}</code></pre>
      </div>
    `;
  });

  // backtick inline highlight
  out = out.replace(/`(.*?)`/g, `<span style="padding:0 4px;border-radius:6px;background:rgba(245,158,11,.16);border:1px solid rgba(245,158,11,.20);">$1</span>`);

  // bold ** ** dan * *
  out = out.replace(/\*\*(.*?)\*\*/g, `<strong style="font-size:1.02em;">$1</strong>`);
  out = out.replace(/\*(.*?)\*/g, `<strong>$1</strong>`);

  // newline
  out = out.replace(/\n/g, "<br>");
  return out;
}

document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".copy");
  if (!btn) return;
  const id = btn.getAttribute("data-code");
  const el = document.getElementById(id);
  if (!el) return;

  try{
    await navigator.clipboard.writeText(el.textContent);
    btn.classList.add("copied");
    btn.textContent = "Copied";
    setTimeout(() => {
      btn.classList.remove("copied");
      btn.textContent = "Copy";
    }, 1200);
  } catch {
    showToast("Gagal copy");
  }
});

/* ---------- sessions ---------- */
function loadSessions(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSessions(){
  sessions.forEach(s => s.updatedAt = Date.now());
  localStorage.setItem(LS_KEY, JSON.stringify(sessions));
}

function createSession(){
  const id = "s_" + Math.random().toString(36).slice(2,10);
  const s = { id, title:"New chat", messages:[], createdAt: Date.now(), updatedAt: Date.now() };
  sessions.push(s);
  return id;
}

function deleteSession(id){
  sessions = sessions.filter(x => x.id !== id);
  if (!sessions.length){
    activeId = createSession();
  } else if (!sessions.find(x => x.id === activeId)){
    activeId = sessions[0].id;
  }
  saveSessions();
  renderSidebar();
  renderActiveChat();
  showToast("Chat dihapus");
}

function ensureActiveSession(){
  if (!sessions.length) return createSession();
  // pick newest
  sessions.sort((a,b) => b.updatedAt - a.updatedAt);
  return sessions[0].id;
}

function getActive(){
  return sessions.find(s => s.id === activeId) || sessions[0];
}

function makeTitle(text){
  const t = text.replace(/\s+/g," ").trim();
  return t.length > 36 ? t.slice(0,36) + "…" : t || "New chat";
}

function prettySize(bytes){
  const mb = bytes / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(1)} KB`;
}

function escapeHtml(str){
  return str
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
