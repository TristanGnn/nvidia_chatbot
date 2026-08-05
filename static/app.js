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

  if (role === "assistant") {
    // les réponses du modèle arrivent en Markdown -> rendu via md.js
    bubble.classList.add("markdown");
    bubble.innerHTML = renderMarkdown(text);
  } else {
    bubble.textContent = text;
  }

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
  let bubble = null;      // créée au premier fragment reçu
  let full = "";
  let lastPaint = 0;

  // md.js tolère un bloc de code encore ouvert : rien à assainir avant le rendu
  const paint = () => {
    bubble.innerHTML = renderMarkdown(full);
    scrollToBottom();
    lastPaint = performance.now();
  };

  try {
    const res = await fetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, history: history })
    });

    if (!res.ok) throw new Error("HTTP " + res.status);
    if (!res.body) throw new Error("flux non supporté par ce navigateur");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { value, done } = await reader.read();
      // stream: true -> gère les caractères accentués coupés entre deux paquets
      const piece = done ? decoder.decode() : decoder.decode(value, { stream: true });

      if (piece) {
        if (!bubble) {                       // premier fragment : les points cèdent la place
          typing.remove();
          bubble = addMessage("assistant", "");
          bubble.classList.add("streaming");
        }
        full += piece;
        // on ne re-parse pas le Markdown à chaque token, ~20 fois/seconde suffit
        if (performance.now() - lastPaint > 50) paint();
      }

      if (done) break;
    }

    if (!bubble) {
      typing.remove();
      bubble = addMessage("assistant", "(réponse vide)");
    } else {
      paint();                               // rendu final, complet
      bubble.classList.remove("streaming");
    }

    history.push({ role: "assistant", content: full });

  } catch (err) {
    const message = "Impossible de joindre l'assistant : " + err.message;

    if (bubble) {
      // une réponse partielle est déjà affichée : on la garde et on signale la coupure
      bubble.classList.remove("streaming");
      const note = document.createElement("p");
      note.className = "stream-error";
      note.textContent = message;
      bubble.appendChild(note);
    } else {
      typing.remove();
      addMessage("assistant", message).classList.add("bubble-error");
    }
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

// bouton "Copier" des blocs de code (délégation : ils sont créés à la volée)
chat.addEventListener("click", (e) => {
  const btn = e.target.closest(".code-copy");
  if (!btn) return;

  const code = btn.closest(".code-block").querySelector("code").textContent;
  navigator.clipboard.writeText(code).then(() => {
    btn.textContent = "Copié !";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = "Copier";
      btn.classList.remove("copied");
    }, 1500);
  });
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
