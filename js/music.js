// Música de ambiente (archivo mp3 propio) + botón ♪ para silenciar.
import { CONFIG } from "./config.js?v=20261108c";

const cfg = CONFIG.musica || {};
// playing: el audio suena de verdad · muted: la persona la ha silenciado a propósito
const state = { audio: null, playing: false, muted: false, fade: null };
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
  b.classList.toggle("pulse", !state.playing && !state.muted);
  b.setAttribute("aria-pressed", String(state.playing));
  b.title = state.playing ? "Silenciar música" : "Activar música";
}

function fadeTo(target, ms = 4000) {
  clearInterval(state.fade);
  const a = state.audio; if (!a) return;
  const from = a.volume, steps = 30; let i = 0;
  state.fade = setInterval(() => {
    i++; a.volume = Math.min(1, Math.max(0, from + (target - from) * (i / steps)));
    if (i >= steps) clearInterval(state.fade);
  }, ms / steps);
}

function play() {
  const a = state.audio; if (!a) return;
  a.volume = 0;
  const p = a.play();
  // Si el navegador lo bloquea, se reintenta en el siguiente toque
  p?.then(() => fadeTo(cfg.volumen ?? 0.4)).catch(() => { state.playing = false; setBtn(); });
}

/** Se llama desde un gesto del usuario (toque/clic). Reintenta en cada gesto hasta que suena. */
export function startMusic() {
  if (!state.audio || state.muted || state.playing) return;
  play();
}

export function stopMusic() {
  clearInterval(state.fade);
  state.audio?.pause();
  state.playing = false;
  setBtn();
}

export function setupMusic() {
  if (!cfg.archivo) return;

  const a = new Audio(cfg.archivo);
  a.loop = true; a.preload = "auto"; a.volume = 0;
  a.addEventListener("playing", () => { state.playing = true; setBtn(); });
  a.addEventListener("pause", () => { state.playing = false; setBtn(); });
  a.addEventListener("error", () => { console.warn("Música: no se pudo cargar el audio"); hideBtn(); });
  state.audio = a;

  btn()?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (state.playing) { state.muted = true; clearInterval(state.fade); a.pause(); }
    else { state.muted = false; play(); }
    setBtn();
  });

  // Los navegadores móviles solo dejan sonar tras un gesto ("click" y "touchend" cuentan).
  const gesture = (e) => { if (e.target.closest?.("#btn-music")) return; startMusic(); };
  document.addEventListener("click", gesture, { passive: true });
  document.addEventListener("touchend", gesture, { passive: true });
  setBtn();
}
