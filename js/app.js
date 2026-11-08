import { CONFIG } from "./config.js?v=20261108n";
import { backend, isDemo } from "./backend.js?v=20261108n";
import { setupMusic, startMusic, stopMusic } from "./music.js?v=20261108n";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const FADE_OUT_MS = 2900;      // duración de la ráfaga de viento que se lleva los textos
const REVEAL_STEP_S = 2.7;     // segundos entre cada texto que aparece (antes 1.7: +1 s)
const STEP_BY_SCENE = { intro: 1.2, plan: 2.1, drinks: 2.2, final: 2.4 };
const REVEAL_START_S = 0.6;
const OPEN_DELAY_MS = 1500;    // pausa entre el clic y la apertura de la puerta (la música ya está sonando)
const SPLIT_SEL = ".eyebrow, .title, .lead, .question, .warning, .plan li > b, .plan li > span, .seq";

const stage = $("#stage");
const loginEl = $("#login");
const state = { draft: null, mixes: {}, opening: false, storyToken: 0, tap: null, user: null, response: null, selected: new Set(), busy: false, current: null, unsubAdmin: null };

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
  const wa = $("#btn-whatsapp");
  wa.hidden = !CONFIG.whatsapp;
  if (CONFIG.whatsapp) wa.href = CONFIG.whatsapp;
  $("#btn-maps").href = `https://www.google.com/maps/dir/?api=1&destination=${q}`;
  $("#btn-admin").hidden = !isAdmin(u);
  $("#btn-reset").hidden = !isAdmin(u);
  $("#btn-music").hidden = true;       // aparece cuando se abre la puerta
}

/* ---------- Texto letra a letra (humo) ---------- */
function unsplit(el) {
  el.querySelectorAll(".w").forEach((w) => w.replaceWith(document.createTextNode(w.textContent)));
  el.normalize();
}
function splitEl(el) {
  unsplit(el);
  const label = el.textContent.trim();
  const total = Math.max(1, label.replace(/\s/g, "").length);
  let ci = 0;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((tok) => {
          if (!tok) return;
          if (/^\s+$/.test(tok)) { frag.append(document.createTextNode(" ")); return; }
          const w = document.createElement("span");
          w.className = "w"; w.setAttribute("aria-hidden", "true");
          for (const chr of tok) {
            const c = document.createElement("span");
            c.className = "ch"; c.textContent = chr;
            const f = ci / total;                       // las letras de la izquierda se van antes
            c.style.setProperty("--ci", ci);
            c.style.setProperty("--ld", `${(f * 0.7 + rnd(0, 0.35)).toFixed(2)}s`);
            c.style.setProperty("--dx", `${Math.round(rnd(90, 280) + f * 80)}px`);
            c.style.setProperty("--dy", `${Math.round(rnd(-70, 25))}px`);
            c.style.setProperty("--r", `${Math.round(rnd(-35, 35))}deg`);
            w.append(c); ci++;
          }
          frag.append(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && !n.classList.contains("w")) walk(n);
    });
  };
  walk(el);
  el.setAttribute("aria-label", label);
  el.classList.add("split");
}

// Espera que se puede saltar tocando la pantalla
function waitOrTap(ms) {
  return new Promise((res) => {
    const done = () => { clearTimeout(t); state.tap = null; res(); };
    const t = setTimeout(done, ms);
    state.tap = done;
  });
}
document.addEventListener("click", () => state.tap?.());

/* Bienvenida: textos de uno en uno, en el mismo sitio, hasta la pregunta */
async function runStory(scene) {
  const token = ++state.storyToken;
  const story = $(".story", scene), ask = $(".ask", scene);
  story.hidden = false; ask.hidden = true;
  $$(".seq", story).forEach((e) => { e.hidden = true; e.classList.remove("in", "out"); });
  await sleep(700);
  for (const el of $$(".seq", story)) {
    if (token !== state.storyToken) return;
    const n = el.textContent.replace(/\s/g, "").length;
    el.hidden = false; void el.offsetWidth;
    el.classList.add("in");
    await sleep(n * 35 + 1700);                    // se escribe
    await waitOrTap(1500 + n * 22 + 1000);         // lectura (+1 s extra; un toque la salta)
    if (token !== state.storyToken) return;
    el.classList.remove("in"); el.classList.add("out");
    await sleep(FADE_OUT_MS + 400);                // se lo lleva el viento
    el.hidden = true; el.classList.remove("out");
  }
  if (token !== state.storyToken) return;
  story.hidden = true; ask.hidden = false;
  $$(".reveal", ask).forEach((el, i) => el.style.setProperty("--d", `${0.3 + i * 2.2}s`));
  void scene.offsetWidth;
  scene.classList.add("shown");
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
  if (id === "mixers") renderMixers();
  if (id === "final") $("#btn-edit-drinks").textContent = (state.response?.bebidas?.length ? "Cambiar mis bebidas" : "Elegir mi bebida");
  next.hidden = false;
  next.scrollTop = 0;
  $$(SPLIT_SEL, next).forEach(splitEl);
  const step = STEP_BY_SCENE[id] ?? REVEAL_STEP_S;
  const isStory = "seq" in next.dataset;
  if (!isStory) $$(".reveal", next).forEach((el, i) => el.style.setProperty("--d", `${REVEAL_START_S + i * step}s`));
  state.current = id;
  stage.dataset.scene = id;
  void next.offsetWidth;            // fuerza el estado inicial antes de animar
  if (isStory) runStory(next);
  else next.classList.add("shown");

  if (id === "farewell" && CONFIG.permitirCambiarRespuesta) {
    // aparece muy tarde y discreto
    const b = $("#btn-change-mind");
    b.hidden = false;
    b.style.setProperty("--d", "9s");
  }
}

/* ---------- Bebidas ---------- */
function renderDrinks() {
  state.selected = new Set(state.draft?.bebidas ?? state.response?.bebidas ?? []);
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

/* ---------- Mezclas (con qué se acompaña cada destilado) ---------- */
const spiritsSelected = () => CONFIG.bebidas.filter((d) => d.mezcla && state.selected.has(d.id));

function mixesComplete() {
  return spiritsSelected().every((d) => state.mixes[d.id]?.size > 0);
}

function renderMixers() {
  const saved = state.draft?.mezclas ?? state.response?.mezclas ?? {};
  state.mixes = {};
  const wrap = $("#mixers");
  wrap.replaceChildren();
  const refresh = () => {
    $("#btn-mixers-ok").disabled = !mixesComplete();
    $$(".mix-block", wrap).forEach((blk) => blk.classList.toggle("mix-missing", !state.mixes[blk.dataset.id]?.size));
  };
  for (const d of spiritsSelected()) {
    state.mixes[d.id] = new Set((saved[d.id] || []).filter((id) => CONFIG.mezclas.some((m) => m.id === id)));
    const blk = document.createElement("div"); blk.className = "mix-block"; blk.dataset.id = d.id;
    const h = document.createElement("h3"); h.className = "mix-title"; h.textContent = `${d.icon} ${d.label} con…`;
    const grid = document.createElement("div"); grid.className = "mix-grid";
    for (const m of CONFIG.mezclas) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "drink"; b.dataset.id = m.id;
      b.setAttribute("aria-pressed", String(state.mixes[d.id].has(m.id)));
      const ico = document.createElement("span"); ico.className = "ico"; ico.textContent = m.icon;
      const lab = document.createElement("span"); lab.textContent = m.label;
      b.append(ico, lab);
      b.addEventListener("click", () => {
        const set = state.mixes[d.id];
        set.has(m.id) ? set.delete(m.id) : set.add(m.id);
        b.setAttribute("aria-pressed", String(set.has(m.id)));
        refresh();
      });
      grid.append(b);
    }
    blk.append(h, grid); wrap.append(blk);
  }
  $("#btn-mixers-ok").disabled = !mixesComplete();
}

/* ---------- Guardado ---------- */
async function save(patch) {
  const data = {
    asiste: patch.asiste ?? state.response?.asiste ?? false,
    bebidas: patch.bebidas ?? state.response?.bebidas ?? [],
    mezclas: patch.mezclas ?? state.response?.mezclas ?? {},
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

/* ---------- Puerta ---------- */
async function openDoor() {
  const door = $("#door");
  door.classList.add("open");
  stage.classList.add("open");          // se revela la imagen y la niebla
  const mb = $("#btn-music");
  mb.hidden = !CONFIG.musica?.archivo || mb.dataset.failed === "1";
  await sleep(3200);
  door.hidden = true;
}
function resetDoor() {
  const door = $("#door");
  door.hidden = false; door.classList.remove("open");
  stage.classList.remove("open");
  $("#btn-music").hidden = true;
}

/* ---------- Acciones ---------- */
const actions = {
  enter: () => {
    if (state.opening) return;
    state.opening = true;
    startMusic();                      // dentro del gesto del usuario: empieza a sonar, de menos a más
    return run(async () => {
      await sleep(OPEN_DELAY_MS);      // pausa: la canción arranca antes de que se abra la puerta
      openDoor();                      // la puerta se abre y entra la imagen
      // los textos de la entrada se van con el viento y, ya con la puerta abierta, aparecen los demás
      await goTo(routeScene(), { wait: 1000 });
    });
  },
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
    const bebidas = [...state.selected];
    if (spiritsSelected().length) {
      // hay destilados: antes de guardar se pregunta con qué los acompaña
      state.draft = { bebidas, mezclas: state.draft?.mezclas ?? state.response?.mezclas ?? {} };
      await goTo("mixers", { wait: 800 });
      return;
    }
    await save({ asiste: true, bebidas, mezclas: {} });
    state.draft = null;
    await goTo("final", { wait: 1500 });
  }),
  "mixers-ok": () => run(async () => {
    if (!mixesComplete()) return;
    const mezclas = {};
    for (const d of spiritsSelected()) mezclas[d.id] = CONFIG.mezclas.map((m) => m.id).filter((id) => state.mixes[d.id].has(id));
    await save({ asiste: true, bebidas: [...state.selected], mezclas });
    state.draft = null;
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
  stage.classList.add("on");           // puerta cerrada: la imagen y la música esperan al botón
  await sleep(900);

  return goTo("intro");                // pantalla de entrada: aquí se da el primer toque (música)
}

// Escena que toca según lo que la persona ya haya respondido
function routeScene() {
  const r = state.response;
  if (!r) return "welcome";
  if (r.asiste === false) return "farewell";
  return r.bebidas?.length ? "final" : "drinks";
}

function leaveExperience() {
  closeAdmin();
  stopMusic();
  state.storyToken++; state.tap = null;
  $$(".scene").forEach((s) => { s.hidden = true; s.classList.remove("shown", "leaving"); });
  $("#btn-change-mind").hidden = true;
  stage.classList.remove("on");
  stage.hidden = true;
  delete stage.dataset.scene;
  state.current = null; state.user = null; state.response = null; state.busy = false; state.opening = false; state.draft = null; state.mixes = {};
  resetDoor();
  loginEl.hidden = false;
  void loginEl.offsetWidth;
  loginEl.classList.remove("out");
}

let lastUid = null;
backend.onAuth((user) => {
  if (user && user.uid !== lastUid) { lastUid = user.uid; enterExperience(user); }
  else if (!user && lastUid) { lastUid = null; leaveExperience(); }
});

/* ---------- Reiniciar (solo admin, para probar el flujo desde cero) ---------- */
$("#btn-reset").addEventListener("click", async () => {
  if (!isAdmin(state.user) || state.busy) return;
  if (!confirm("¿Borrar tu respuesta y empezar de cero? (solo para pruebas)")) return;
  state.busy = true;
  try { await backend.deleteResponse(state.user.uid); }
  catch (e) {
    console.error(e); state.busy = false;
    return toast("No se pudo reiniciar. Revisa que las reglas de Firestore estén publicadas.");
  }
  closeAdmin();
  state.storyToken++; state.tap = null;                       // corta la historia si estaba en marcha
  stopMusic();
  $$(".scene").forEach((s) => { s.hidden = true; s.classList.remove("shown", "leaving"); });
  $("#btn-change-mind").hidden = true;
  delete stage.dataset.scene;
  state.current = null; state.response = null; state.selected = new Set(); state.draft = null; state.mixes = {}; state.opening = false;
  resetDoor();                                                // puerta cerrada, sin imagen ni música
  state.busy = false;
  await sleep(500);
  goTo("intro");
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

  const label = (id) => CONFIG.bebidas.find((d) => d.id === id);
  const byName = (x, y) => (x.nombre || x.email || "").localeCompare(y.nombre || y.email || "", "es");

  function personRow(r) {
    const p = el("div", "person");
    if (r.foto) { const img = el("img"); img.src = r.foto; img.alt = ""; img.referrerPolicy = "no-referrer"; p.append(img); }
    else p.append(el("div", "av", (r.nombre || r.email || "?").charAt(0).toUpperCase()));
    const who = el("div", "who");
    who.append(el("span", "who-name", r.nombre || r.email || "Sin nombre"));
    if (r.asiste) {
      const chips = el("div", "chips");
      if (r.bebidas?.length) {
        r.bebidas.map(label).filter(Boolean).forEach((d) => {
          const mix = (r.mezclas?.[d.id] || []).map((id) => CONFIG.mezclas.find((m) => m.id === id)?.label).filter(Boolean);
          chips.append(el("span", "dchip", `${d.icon} ${d.label}${mix.length ? " + " + mix.join(", ") : ""}`));
        });
      } else chips.append(el("span", "dchip dchip-none", "Sin elegir bebida"));
      who.append(chips);
    } else if (r.email) who.append(el("small", null, r.email));
    p.append(who);
    return p;
  }

  function group(title, list, cls) {
    const g = el("div", "group");
    g.append(el("h4", cls, `${title} (${list.length})`));
    if (!list.length) g.append(el("p", "empty", "Nadie por ahora."));
    [...list].sort(byName).forEach((r) => g.append(personRow(r)));
    return g;
  }

  // Combinados: cuántas personas quieren cada destilado con cada acompañante
  const combos = [];
  for (const d of CONFIG.bebidas.filter((x) => x.mezcla)) {
    for (const m of CONFIG.mezclas) {
      const n = si.filter((r) => r.bebidas?.includes(d.id) && r.mezclas?.[d.id]?.includes(m.id)).length;
      if (n) combos.push({ d, m, n });
    }
  }
  combos.sort((a, b) => b.n - a.n);
  const mixBox = el("div");
  if (combos.length) {
    mixBox.append(el("h4", null, "Combinados"));
    const cmax = combos[0].n;
    for (const c of combos) {
      const row = el("div", "bar-row");
      const bar = el("div", "bar"); const fill = el("i"); fill.style.width = `${(c.n / cmax) * 100}%`; bar.append(fill);
      row.append(el("span", null, `${c.d.icon} ${c.d.label} + ${c.m.label}`), bar, el("b", null, c.n));
      mixBox.append(row);
    }
    const tot = CONFIG.mezclas
      .map((m) => ({ m, n: combos.filter((c) => c.m.id === m.id).reduce((s, c) => s + c.n, 0) }))
      .filter((t) => t.n).map((t) => `${t.m.icon} ${t.m.label}: ${t.n}`).join("  ·  ");
    mixBox.append(el("p", "empty", `Acompañantes pedidos — ${tot}`));
  }

  const people = el("div");
  if (!rows.length) { people.append(el("h4", null, "Personas (0)"), el("p", "empty", "Aún no ha respondido nadie.")); }
  else people.append(group("Asisten", si, "h-si"), group("No asisten", no, "h-no"));

  body.replaceChildren(stats, bars, mixBox, people);
}

setupMusic();

if (isDemo) console.info("%cMODO DEMO: rellena js/firebase-config.js para usar Firebase.", "color:#ff2f62");
