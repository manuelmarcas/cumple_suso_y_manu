// Música de ambiente (archivo mp3 propio) + botón ♪ para silenciar.
import { CONFIG } from "./config.js?v=20261108l";

const cfg = CONFIG.musica || {};
// armed: ya se pulsó el botón de la puerta (hasta entonces NO suena nada)
// playing: el audio suena de verdad · muted: la persona la ha silenciado a propósito
const state = { audio: null, armed: false, playing: false, muted: false, fade: null };
const btn = () => document.getElementById("btn-music");

function hideBtn() {
  const b = btn();
  if (b) { b.dataset.failed = "1"; b.hidden = true; }
}

function setBtn() {
  const b = btn();
  if (!b) return;
  b.classList.toggle("off", !state.playing);
  // Si no suena y no está silenciada a propósito, el botón late para invitar a tocarlo
  b.classList.toggle("pulse", state.armed && !state.playing && !state.muted);
  b.setAttribute("aria-pressed", String(state.playing));
  b.title = state.playing ? "Silenciar música" : "Activar música";
}

// Sube de menos a más: se oye ya desde el clic y crece rápido al principio y más suave al final
function fadeTo(target, ms = 8000) {
  clearInterval(state.fade);
  const a = state.audio; if (!a) return;
  const from = a.volume, steps = 60; let i = 0;
  state.fade = setInterval(() => {
    i++; const k = i / steps;
    const e = 1 - (1 - k) * (1 - k);                  // ease-out
    a.volume = Math.min(1, Math.max(0, from + (target - from) * e));
    if (i >= steps) clearInterval(state.fade);
  }, ms / steps);
}

function play() {
  const a = state.audio; if (!a) return;
  a.volume = cfg.volumenInicial ?? 0.06;               // ya audible desde el primer instante
  const p = a.play();
  // Si el navegador lo bloquea, se reintenta en el siguiente toque
  p?.then(() => fadeTo(cfg.volumen ?? 0.4)).catch(() => { state.playing = false; setBtn(); });
}

/** Solo se llama desde el botón de la puerta (gesto del usuario): aquí empieza a sonar. */
export function startMusic() {
  state.armed = true;
  if (!state.audio || state.muted || state.playing) return;
  play();
}

export function stopMusic() {
  clearInterval(state.fade);
  state.audio?.pause();
  if (state.audio) state.audio.currentTime = 0;
  state.armed = false; state.playing = false; state.muted = false;
  setBtn();
}

export function setupMusic() {
  if (!cfg.archivo) return;

  const a = new Audio(cfg.archivo);
  a.loop = true; a.preload = "auto"; a.volume = 0;
  a.addEventListener("playing", () => { state.playing = true; setBtn(); });
  a.addEventListener("pause", () => { state.playing = false; setBtn(); });
  a.addEventListener("error", () => { console.warn("Música: no se pudo cargar el audio"); hideBtn(); });
  a.id = "musica"; document.body.append(a);   // sin controles: no se ve
  state.audio = a;

  btn()?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (state.playing) { state.muted = true; clearInterval(state.fade); a.pause(); }
    else { state.muted = false; play(); }
    setBtn();
  });

  // Si el navegador bloqueó el primer intento, se reintenta en el siguiente toque,
  // pero solo después de pulsar el botón de la puerta (antes no debe sonar nada).
  const gesture = (e) => { if (!state.armed || e.target.closest?.("#btn-music")) return; startMusic(); };
  document.addEventListener("click", gesture, { passive: true });
  document.addEventListener("touchend", gesture, { passive: true });
  setBtn();
}
