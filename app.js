/* AI Studio - luxe UI
   Endpoint: POST /chat  (expects JSON { result } or { error })
*/

const chat = document.getElementById("chat");
const form = document.getElementById("form");
const textarea = document.getElementById("text");
const fileUpload = document.getElementById("fileUpload");
const attachBtn = document.getElementById("attachBtn");

const filePreview = document.getElementById("filePreview");
const previewContent = document.getElementById("previewContent");
const removeFileBtn = document.getElementById("removeFile");

const toast = document.getElementById("toast");
const chips = document.getElementById("chips");

const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");

const clearChatBtn = document.getElementById("clearChat");
const toggleThemeBtn = document.getElementById("toggleTheme");
const sendBtn = document.getElementById("sendBtn");

let selectedFile = null;
let isTyping = false;
let themeMode = "dark"; // placeholder kalau nanti mau tambah light theme

function setStatus(type, text) {
  statusText.textContent = text;
  if (type === "ok") {
    statusDot.style.background = "var(--ok)";
    statusDot.style.boxShadow = "0 0 0 8px rgba(52,211,153,0.12)";
  } else if (type === "warn") {
    statusDot.style.background = "var(--warn)";
    statusDot.style.boxShadow = "0 0 0 8px rgba(245,158,11,0.12)";
  } else if (type === "bad") {
    statusDot.style.background = "var(--bad)";
    statusDot.style.boxShadow = "0 0 0 8px rgba(251,113,133,0.12)";
  } else {
    statusDot.style.background = "rgba(255,255,255,0.6)";
    statusDot.style.boxShadow = "none";
  }
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 2200);
}

function autoResize(el) {
  el.style.height = "auto";
  const max = 140;
  el.style.height = Math.min(el.scrollHeight, max) + "px";
}

textarea.addEventListener("input", () => autoResize(textarea));

attachBtn.addEventListener("click", () => fileUpload.click());

fileUpload.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (file) showFilePreview(file);
});

removeFileBtn.addEventListener("click", removeFilePreview);

chips?.addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;
  const prompt = btn.getAttribute("data-prompt") || "";
  textarea.value = prompt;
  autoResize(textarea);
  textarea.focus();
});

/* ---------- Formatting helpers ---------- */
function escapeHtml(str) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function processTextFormatting(text) {
  // **bold bigger**
  text = text.replace(/\*\*(.*?)\*\*/g, `<span style="font-weight:700;font-size:1.05em;">$1</span>`);
  // *bold*
  text = text.replace(/\*(.*?)\*/g, `<span style="font-weight:700;">$1</span>`);
  return text;
}

function processHighlightedText(text) {
  // `highlight`
  return text.replace(/`(.*?)`/g, `<span class="hl">$1</span>`);
}

function processCodeBlocks(raw) {
  // raw is HTML-escaped already; allow ```lang ... ```
  const re = /```(\w+)?\s*([\s\S]*?)```/g;

  return raw.replace(re, (_, lang, code) => {
    const language = (lang || "text").toLowerCase();
    const codeId = "code-" + Math.random().toString(36).slice(2, 10);
    const clean = code.trim();

    return `
      <div class="codeblock">
        <div class="codeblock__bar">
          <span class="codeblock__lang">${language}</span>
          <button class="copy" type="button" data-code-id="${codeId}">Copy</button>
        </div>
        <pre id="${codeId}"><code>${clean}</code></pre>
      </div>
    `;
  });
}

/* ---------- Media helpers ---------- */
function getFileKind(file) {
  if (!file?.type) return "file";
  if (file.type === "application/pdf") return "pdf";
  return file.type.split("/")[0]; // image, video, audio
}

function prettySize(bytes) {
  const mb = bytes / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(1)} KB`;
}

function showFilePreview(file) {
  selectedFile = file;

  const kind = getFileKind(file);
  previewContent.innerHTML = "";

  const icon = document.createElement("div");
  icon.style.width = "44px";
  icon.style.height = "44px";
  icon.style.borderRadius = "16px";
  icon.style.display = "grid";
  icon.style.placeItems = "center";
  icon.style.border = "1px solid rgba(255,255,255,0.14)";
  icon.style.background = "rgba(255,255,255,0.05)";
  icon.textContent =
    kind === "image" ? "🖼" :
    kind === "video" ? "🎬" :
    kind === "audio" ? "🎧" :
    kind === "pdf" ? "📄" : "📎";

  const meta = document.createElement("div");
  meta.className = "file-pill";
  meta.innerHTML = `
    <div class="file-pill__name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
    <div class="file-pill__meta">${kind.toUpperCase()} · ${prettySize(file.size)}</div>
  `;

  // image thumbnail
  if (kind === "image") {
    const thumb = document.createElement("img");
    thumb.src = URL.createObjectURL(file);
    thumb.onload = () => URL.revokeObjectURL(thumb.src);
    thumb.style.width = "44px";
    thumb.style.height = "44px";
    thumb.style.objectFit = "cover";
    thumb.style.borderRadius = "16px";
    thumb.style.border = "1px solid rgba(255,255,255,0.14)";
    previewContent.appendChild(thumb);
  } else {
    previewContent.appendChild(icon);
  }

  previewContent.appendChild(meta);
  filePreview.classList.remove("hidden");
}

function removeFilePreview() {
  selectedFile = null;
  fileUpload.value = "";
  previewContent.innerHTML = "";
  filePreview.classList.add("hidden");
}

function createMediaHTML(file, url) {
  const kind = getFileKind(file);

  if (kind === "image") {
    return `
      <div class="media">
        <img src="${url}" alt="image" />
      </div>
    `;
  }
  if (kind === "video") {
    return `
      <div class="media">
        <video src="${url}" controls></video>
      </div>
    `;
  }
  if (kind === "audio") {
    return `
      <div class="media" style="padding:12px;">
        <audio src="${url}" controls style="width:100%;"></audio>
      </div>
    `;
  }
  if (kind === "pdf") {
    return `
      <div class="media" style="padding:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;">
          <div style="font-weight:600;">${escapeHtml(file.name)}</div>
          <button class="copy" type="button" onclick="window.open('${url}','_blank')">Open</button>
        </div>
        <iframe class="media__pdf" src="${url}" title="${escapeHtml(file.name)}"></iframe>
      </div>
    `;
  }
  return "";
}

/* ---------- Message UI ---------- */
function appendMessage({ role, html, metaLabel }) {
  const wrap = document.createElement("div");
  wrap.className = `msg ${role === "user" ? "msg--user" : "msg--ai"}`;

  const bubble = document.createElement("div");
  bubble.className = `bubble ${role === "user" ? "bubble--user" : "bubble--ai"}`;

  const pipClass = role === "user" ? "pip pip--user" : "pip";
  const label = metaLabel || (role === "user" ? "You" : "AI");

  bubble.innerHTML = `
    <div class="bubble__meta">
      <span class="${pipClass}"></span>
      <span>${escapeHtml(label)}</span>
    </div>
    <div class="bubble__content">${html}</div>
  `;

  wrap.appendChild(bubble);
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
}

function showTyping() {
  if (isTyping) return;
  isTyping = true;

  const wrap = document.createElement("div");
  wrap.id = "typingIndicator";
  wrap.className = "msg msg--ai";

  const bubble = document.createElement("div");
  bubble.className = "bubble bubble--ai";

  bubble.innerHTML = `
    <div class="bubble__meta">
      <span class="pip"></span>
      <span>AI</span>
    </div>
    <div class="bubble__content">
      <div class="typing" aria-label="AI is typing">
        <span class="typing__dot"></span>
        <span class="typing__dot"></span>
        <span class="typing__dot"></span>
      </div>
    </div>
  `;

  wrap.appendChild(bubble);
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
}

function hideTyping() {
  const el = document.getElementById("typingIndicator");
  if (el) el.remove();
  isTyping = false;
}

/* copy handler */
document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".copy");
  if (!btn) return;

  const codeId = btn.getAttribute("data-code-id");
  if (!codeId) return;

  const el = document.getElementById(codeId);
  if (!el) return;

  try {
    await navigator.clipboard.writeText(el.textContent);
    btn.classList.add("copied");
    btn.textContent = "Copied";
    setTimeout(() => {
      btn.classList.remove("copied");
      btn.textContent = "Copy";
    }, 1600);
  } catch {
    showToast("Gagal menyalin.");
  }
});

/* ---------- actions ---------- */
clearChatBtn.addEventListener("click", () => {
  // keep welcome message? you can choose.
  chat.innerHTML = "";
  showToast("Chat dibersihkan.");
});

toggleThemeBtn.addEventListener("click", () => {
  // placeholder: kamu bisa bikin light theme dengan body[data-theme="light"]
  themeMode = themeMode === "dark" ? "dark" : "dark";
  showToast("Theme toggle (placeholder).");
});

/* submit */
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const text = textarea.value || "";
  if (text.trim() === "" && !selectedFile) {
    textarea.focus();
    return;
  }

  setStatus("warn", "Sending…");

  // build user HTML
  let userHtml = "";
  let fileUrl = "";

  const formData = new FormData();
  formData.set("text", text);

  if (selectedFile) {
    formData.set("file", selectedFile);
    fileUrl = URL.createObjectURL(selectedFile);
    userHtml += createMediaHTML(selectedFile, fileUrl);
  }

  if (text.trim() !== "") {
    let safe = escapeHtml(text).replace(/\n/g, "<br>");
    safe = processTextFormatting(safe);
    userHtml += (userHtml ? "<div style='height:10px;'></div>" : "") + safe;
  }

  appendMessage({ role: "user", html: userHtml, metaLabel: "You" });

  // lock ui
  sendBtn.disabled = true;
  textarea.disabled = true;
  attachBtn.disabled = true;

  // reset composer
  textarea.value = "";
  autoResize(textarea);
  removeFilePreview();
  textarea.focus();

  showTyping();

  try {
    const res = await fetch("/chat", { method: "POST", body: formData });
    const data = await res.json();

    hideTyping();

    if (data?.result) {
      // process AI response
      let safe = escapeHtml(String(data.result)).replace(/\n/g, "<br>");
      safe = processCodeBlocks(safe);
      safe = processHighlightedText(safe);
      safe = processTextFormatting(safe);

      appendMessage({ role: "ai", html: safe, metaLabel: "Rapthalia · AI" });
      setStatus("ok", "Ready");
    } else {
      appendMessage({
        role: "ai",
        html: `<span class="muted">Error:</span> ${escapeHtml(String(data?.error || "Unknown error"))}`,
        metaLabel: "System"
      });
      setStatus("bad", "Error");
    }
  } catch (err) {
    hideTyping();
    appendMessage({
      role: "ai",
      html: `<span class="muted">Network error.</span> Periksa koneksi internet.`,
      metaLabel: "System"
    });
    setStatus("bad", "Offline");
  } finally {
    sendBtn.disabled = false;
    textarea.disabled = false;
    attachBtn.disabled = false;
    textarea.focus();

    if (fileUrl) setTimeout(() => URL.revokeObjectURL(fileUrl), 1200);
  }
});

/* keyboard: Enter submit, Shift+Enter newline */
textarea.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});

/* initial */
setStatus("ok", "Ready");
textarea.focus();