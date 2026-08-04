/* ---------------------------------------------------------------
   Chat IA — logique de l'interface
   Chargé avec `defer` : le DOM est prêt quand ce script s'exécute.
   --------------------------------------------------------------- */

const chat     = document.getElementById("chat");
const welcome  = document.getElementById("welcome");
const form     = document.getElementById("composer");
const input    = document.getElementById("input");
const sendBtn  = document.getElementById("send-btn");
const clearBtn = document.getElementById("clear-btn");

// historique envoyé au backend : [{role: "user"|"assistant", content: "..."}]
let history = [];
let busy = false;

// --- rendu ------------------------------------------------------------

function hideWelcome() {
  const w = chat.querySelector(".welcome");
  if (w) w.remove();
}

function timeNow() {
  return new Date().toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" });
}

function addMessage(role, text) {
  hideWelcome();

  const row = document.createElement("div");
  row.className = "msg msg-" + role;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "Vous" : "IA";

  const bubbleWrap = document.createElement("div");
  bubbleWrap.className = "bubble-wrap";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  const meta = document.createElement("span");
  meta.className = "meta";
  meta.textContent = (role === "user" ? "Vous" : "Assistant") + " · " + timeNow();

  bubbleWrap.append(bubble, meta);
  row.append(avatar, bubbleWrap);
  chat.appendChild(row);
  scrollToBottom();

  return bubble;
}

function addTyping() {
  hideWelcome();

  const row = document.createElement("div");
  row.className = "msg msg-assistant typing-row";
  row.innerHTML =
    '<div class="avatar">IA</div>' +
    '<div class="bubble-wrap"><div class="bubble typing">' +
    '<span></span><span></span><span></span></div></div>';
  chat.appendChild(row);
  scrollToBottom();
  return row;
}

function scrollToBottom() {
  chat.scrollTop = chat.scrollHeight;
}

function setBusy(state) {
  busy = state;
  sendBtn.disabled = state;
  input.disabled = state;
  if (!state) input.focus();
}

// --- envoi ------------------------------------------------------------

async function send(text) {
  if (!text || busy) return;

  addMessage("user", text);
  history.push({ role: "user", content: text });

  input.value = "";
  autoGrow();
  setBusy(true);

  const typing = addTyping();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, history: history })
    });

    if (!res.ok) throw new Error("HTTP " + res.status);

    const data = await res.json();
    const reply = data.reply ?? data.response ?? data.content ?? "";

    typing.remove();
    addMessage("assistant", reply || "(réponse vide)");
    history.push({ role: "assistant", content: reply });

  } catch (err) {
    typing.remove();
    const bubble = addMessage("assistant", "Impossible de joindre l'assistant : " + err.message);
    bubble.classList.add("bubble-error");
  } finally {
    setBusy(false);
  }
}

// --- interactions -----------------------------------------------------

form.addEventListener("submit", (e) => {
  e.preventDefault();
  send(input.value.trim());
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send(input.value.trim());
  }
});

function autoGrow() {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 180) + "px";
}
input.addEventListener("input", autoGrow);

document.querySelectorAll(".suggestion").forEach((btn) => {
  btn.addEventListener("click", () => send(btn.textContent.trim()));
});

const welcomeTemplate = welcome.cloneNode(true);

clearBtn.addEventListener("click", () => {
  if (busy) return;
  history = [];
  chat.innerHTML = "";
  const fresh = welcomeTemplate.cloneNode(true);
  chat.appendChild(fresh);
  fresh.querySelectorAll(".suggestion").forEach((btn) => {
    btn.addEventListener("click", () => send(btn.textContent.trim()));
  });
  input.focus();
});

input.focus();
