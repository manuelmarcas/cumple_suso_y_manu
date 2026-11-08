// Música de ambiente con el reproductor de YouTube (oculto) + botón ♪ para silenciar.
import { CONFIG } from "./config.js";

const cfg = CONFIG.musica || {};
// playing: YouTube confirma que suena · muted: la persona la ha silenciado a propósito
const state = { player: null, ready: false, playing: false, muted: false, fade: null };
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
  const p = state.player; if (!p?.setVolume) return;
  const from = p.getVolume?.() ?? 0, steps = 30; let i = 0;
  state.fade = setInterval(() => {
    i++; p.setVolume(Math.round(from + (target - from) * (i / steps)));
    if (i >= steps) clearInterval(state.fade);
  }, ms / steps);
}

function play() {
  if (!state.ready) return;
  try {
    state.player.setVolume(0);
    state.player.playVideo();
    fadeTo(cfg.volumen ?? 40);
  } catch (e) { console.warn("Música:", e); }
}

function pause() {
  clearInterval(state.fade);
  try { state.player?.pauseVideo(); } catch {}
}

/** Se llama desde un gesto del usuario (toque/clic). Reintenta en cada gesto hasta que suena. */
export function startMusic() {
  if (!cfg.youtubeId || state.muted || state.playing) return;
  play();
}

export function stopMusic() {
  pause();
  state.playing = false;
  setBtn();
}

export function setupMusic() {
  if (!cfg.youtubeId) return;

  btn()?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (state.playing) { state.muted = true; pause(); }
    else { state.muted = false; play(); }
    setBtn();
  });

  // Los navegadores móviles solo dejan sonar tras un gesto: "click" y "touchend" cuentan,
  // "pointerdown" no siempre. Se reintenta en cada gesto hasta que YouTube confirma que suena.
  const gesture = (e) => { if (e.target.closest?.("#btn-music")) return; startMusic(); };
  document.addEventListener("click", gesture, { passive: true });
  document.addEventListener("touchend", gesture, { passive: true });

  // El reproductor debe tener un tamaño real (YouTube exige >= 200x200) aunque sea invisible.
  const holder = document.createElement("div");
  holder.setAttribute("aria-hidden", "true");
  holder.style.cssText = "position:fixed;left:0;top:0;width:220px;height:220px;opacity:.001;pointer-events:none;z-index:-1;overflow:hidden";
  const target = document.createElement("div"); target.id = "yt-player";
  holder.append(target); document.body.append(holder);

  window.onYouTubeIframeAPIReady = () => {
    state.player = new YT.Player("yt-player", {
      width: 220, height: 220,
      videoId: cfg.youtubeId,
      playerVars: { controls: 0, disablekb: 1, playsinline: 1, loop: 1, playlist: cfg.youtubeId, rel: 0, modestbranding: 1, origin: location.origin },
      events: {
        onReady: () => { state.ready = true; },
        onStateChange: (e) => {
          if (e.data === 1) { state.playing = true; setBtn(); }                       // PLAYING
          else if (e.data === 2) { state.playing = false; setBtn(); }                 // PAUSED
          else if (e.data === 0) { state.player.seekTo(0); state.player.playVideo(); } // fin → bucle
        },
        onAutoplayBlocked: () => { state.playing = false; setBtn(); },
        onError: () => { console.warn("Música: el vídeo no se puede reproducir"); hideBtn(); },
      },
    });
  };
  const s = document.createElement("script");
  s.src = "https://www.youtube.com/iframe_api";
  s.onerror = hideBtn;
  document.head.append(s);
  setBtn();
}
