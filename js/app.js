import { CONFIG } from "./config.js";
import { backend, isDemo } from "./backend.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const FADE_OUT_MS = 2200;      // duración del desvanecimiento en niebla
const REVEAL_STEP_S = 1.7;     // segundos entre cada texto que aparece
const REVEAL_START_S = 0.6;

const stage = $("#stage");
const loginEl = $("#login");
const state = { user: null, response: null, selected: new Set(), busy: false, current: null, unsubAdmin: null };

/* ---------- Utilidades ---------- */
function toast(msg, ms = 4500) {
  const t = $("#toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.hidden = true), ms);
}
const isAdmin = (u) => !!u && CONFIG.admins.map((e) => e.toLowerCase()).includes((u.email || "").toLowerCase());
const firstName = (u) => (u.nombre || u.email || "").trim().split(/\s+/)[0] || "viajero";

function fillTexts() {
  const u = state.user;
  $$("[data-name]").forEach((el) => (el.textContent = firstName(u)));
  $$("[data-hora]").forEach((el) => (el.textContent = CONFIG.horaTexto));
  $$("[data-fecha]").forEach((el) => (el.textContent = CONFIG.fechaTexto));
  $$("[data-lugar]").forEach((el) => (el.textContent = CONFIG.lugarNombre));
  $$("[data-direccion]").forEach((el) => (el.textContent = CONFIG.direccion));
  const q = encodeURIComponent(CONFIG.direccion);
  $("#btn-maps").href = `https://www.google.com/maps/dir/?api=1&destination=${q}`;
  $("#btn-admin").hidden = !isAdmin(u);
}

/* ---------- Escenas ---------- */
async function goTo(id, { wait = 0 } = {}) {
  const cur = state.current && $(`#scene-${state.current}`);
  if (cur) {
    cur.classList.remove("shown");
    cur.classList.add("leaving");
    await sleep(FADE_OUT_MS);
    cur.classList.remove("leaving");
    cur.hidden = true;
  }
  if (wait) await sleep(wait);

  const next = $(`#scene-${id}`);
  if (id === "final") $("#map").src = `https://www.google.com/maps?q=${encodeURIComponent(CONFIG.direccion)}&output=embed`;
  if (id === "drinks") renderDrinks();
  if (id === "final") $("#btn-edit-drinks").textContent = (state.response?.bebidas?.length ? "Cambiar mis bebidas" : "Elegir mi bebida");
  next.hidden = false;
  next.scrollTop = 0;
  $$(".reveal", next).forEach((el, i) => el.style.setProperty("--d", `${REVEAL_START_S + i * REVEAL_STEP_S}s`));
  state.current = id;
  stage.dataset.scene = id;
  void next.offsetWidth;            // fuerza el estado inicial antes de animar
  next.classList.add("shown");

  if (id === "farewell" && CONFIG.permitirCambiarRespuesta) {
    // aparece muy tarde y discreto
    const b = $("#btn-change-mind");
    b.hidden = false;
    b.style.setProperty("--d", "9s");
  }
}

/* ---------- Bebidas ---------- */
function renderDrinks() {
  state.selected = new Set(state.response?.bebidas || []);
  const wrap = $("#drinks");
  wrap.replaceChildren();
  for (const d of CONFIG.bebidas) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "drink"; b.dataset.id = d.id;
    b.setAttribute("aria-pressed", String(state.selected.has(d.id)));
    const ico = document.createElement("span"); ico.className = "ico"; ico.textContent = d.icon;
    const lab = document.createElement("span"); lab.textContent = d.label;
    b.append(ico, lab);
    b.addEventListener("click", () => {
      state.selected.has(d.id) ? state.selected.delete(d.id) : state.selected.add(d.id);
      b.setAttribute("aria-pressed", String(state.selected.has(d.id)));
      $("#btn-drinks-ok").disabled = state.selected.size === 0;
    });
    wrap.append(b);
  }
  $("#btn-drinks-ok").disabled = state.selected.size === 0;
  $("#drinks-error").hidden = true;
}

/* ---------- Guardado ---------- */
async function save(patch) {
  const data = {
    asiste: patch.asiste ?? state.response?.asiste ?? false,
    bebidas: patch.bebidas ?? state.response?.bebidas ?? [],
  };
  await backend.saveResponse(state.user, data);
  state.response = { ...(state.response || {}), ...data };
}

async function run(fn) {
  if (state.busy) return;
  state.busy = true;
  try { await fn(); }
  catch (e) {
    console.error(e);
    toast(e?.code === "permission-denied"
      ? "No se pudo guardar (permisos). Avisa a Manu."
      : "No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.");
  }
  finally { state.busy = false; }
}

/* ---------- Acciones ---------- */
const actions = {
  yes: () => run(async () => {
    await save({ asiste: true });
    await goTo("plan", { wait: 3000 });
  }),
  no: () => run(async () => {
    await save({ asiste: false, bebidas: [] });
    await goTo("farewell", { wait: 2500 });
  }),
  "change-mind": () => run(async () => {
    $("#btn-change-mind").hidden = true;
    await goTo("welcome", { wait: 800 });
  }),
  "to-drinks": () => run(() => goTo("drinks")),
  "drinks-ok": () => run(async () => {
    if (state.selected.size === 0) return;
    await save({ asiste: true, bebidas: [...state.selected] });
    await goTo("final", { wait: 1500 });
  }),
  skip: () => run(() => goTo("final")),
};

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (el && actions[el.dataset.action]) actions[el.dataset.action]();
});

/* ---------- Login / sesión ---------- */
$("#btn-google").addEventListener("click", async (e) => {
  const btn = e.currentTarget, err = $("#login-error");
  err.hidden = true; btn.disabled = true;
  try { await backend.signIn(); }
  catch (ex) {
    if (ex?.code !== "auth/popup-closed-by-user" && ex?.code !== "auth/cancelled-popup-request") {
      console.error(ex);
      err.textContent = ex?.code === "auth/unauthorized-domain"
        ? "Este dominio no está autorizado en Firebase (Authentication → Configuración → Dominios autorizados)."
        : "No se pudo iniciar sesión. Inténtalo de nuevo.";
      err.hidden = false;
    }
  } finally { btn.disabled = false; }
});

$("#btn-logout").addEventListener("click", () => backend.signOut());

async function enterExperience(user) {
  state.user = user;
  fillTexts();
  try { state.response = await backend.getResponse(user.uid); }
  catch (e) {
    console.error(e);
    state.response = null;
    toast("No se pudo leer tu respuesta anterior (revisa las reglas de Firestore).");
  }

  loginEl.classList.add("out");
  await sleep(900);
  loginEl.hidden = true;
  stage.hidden = false;
  void stage.offsetWidth;
  stage.classList.add("on");           // 1º se carga la imagen (y la niebla)
  await sleep(2200);                   // 2º empiezan a aparecer los textos

  const r = state.response;
  if (!r) return goTo("welcome");
  if (r.asiste === false) return goTo("farewell");
  return goTo(r.bebidas?.length ? "final" : "drinks");
}

function leaveExperience() {
  closeAdmin();
  $$(".scene").forEach((s) => { s.hidden = true; s.classList.remove("shown", "leaving"); });
  $("#btn-change-mind").hidden = true;
  stage.classList.remove("on");
  stage.hidden = true;
  delete stage.dataset.scene;
  state.current = null; state.user = null; state.response = null; state.busy = false;
  loginEl.hidden = false;
  void loginEl.offsetWidth;
  loginEl.classList.remove("out");
}

let lastUid = null;
backend.onAuth((user) => {
  if (user && user.uid !== lastUid) { lastUid = user.uid; enterExperience(user); }
  else if (!user && lastUid) { lastUid = null; leaveExperience(); }
});

/* ---------- Panel admin ---------- */
const adminEl = $("#admin");
function closeAdmin() {
  adminEl.hidden = true;
  state.unsubAdmin?.(); state.unsubAdmin = null;
}
$("#admin-close").addEventListener("click", closeAdmin);
adminEl.addEventListener("click", (e) => { if (e.target === adminEl) closeAdmin(); });

$("#btn-admin").addEventListener("click", () => {
  if (!isAdmin(state.user)) return;
  adminEl.hidden = false;
  $("#admin-error").hidden = true;
  $("#admin-body").replaceChildren();
  state.unsubAdmin?.();
  state.unsubAdmin = backend.subscribeAll(renderAdmin, (e) => {
    console.error(e);
    const el = $("#admin-error");
    el.textContent = "No se pueden leer las votaciones. Comprueba que las reglas de Firestore están publicadas y que tu email es el de administrador.";
    el.hidden = false;
  });
});

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function renderAdmin(rows) {
  const body = $("#admin-body");
  const si = rows.filter((r) => r.asiste === true);
  const no = rows.filter((r) => r.asiste === false);
  const sinBebida = si.filter((r) => !r.bebidas?.length).length;

  const stats = el("div", "stats");
  for (const [n, l] of [[si.length, "Asisten"], [no.length, "No asisten"], [sinBebida, "Sin elegir bebida"]]) {
    const s = el("div", "stat"); s.append(el("b", null, n), el("span", null, l)); stats.append(s);
  }

  const bars = el("div");
  bars.append(el("h4", null, "Bebidas (entre quienes asisten)"));
  const max = Math.max(1, ...CONFIG.bebidas.map((d) => si.filter((r) => r.bebidas?.includes(d.id)).length));
  for (const d of CONFIG.bebidas) {
    const n = si.filter((r) => r.bebidas?.includes(d.id)).length;
    const row = el("div", "bar-row");
    const bar = el("div", "bar"); const fill = el("i"); fill.style.width = `${(n / max) * 100}%`; bar.append(fill);
    row.append(el("span", null, `${d.icon} ${d.label}`), bar, el("b", null, n));
    bars.append(row);
  }

  const people = el("div");
  people.append(el("h4", null, `Personas (${rows.length})`));
  if (!rows.length) people.append(el("p", "empty", "Aún no ha respondido nadie."));
  const label = (id) => CONFIG.bebidas.find((d) => d.id === id)?.label || id;
  [...rows].sort((a, b) => (b.asiste === true) - (a.asiste === true) || (a.nombre || "").localeCompare(b.nombre || "")).forEach((r) => {
    const p = el("div", "person");
    if (r.foto) { const img = el("img"); img.src = r.foto; img.alt = ""; img.referrerPolicy = "no-referrer"; p.append(img); }
    else p.append(el("div", "av", (r.nombre || "?").charAt(0).toUpperCase()));
    const who = el("div", "who", r.nombre || r.email || "Sin nombre");
    who.append(el("small", null, r.asiste ? (r.bebidas?.length ? r.bebidas.map(label).join(", ") : "Sin elegir bebida") : r.email || ""));
    p.append(who, el("span", `badge ${r.asiste ? "si" : "no"}`, r.asiste ? "Sí" : "No"));
    people.append(p);
  });

  body.replaceChildren(stats, bars, people);
}

if (isDemo) console.info("%cMODO DEMO: rellena js/firebase-config.js para usar Firebase.", "color:#ff2f62");
