// Capa de datos: Firebase (real) o modo demo (localStorage) si aún no hay configuración.
import { firebaseConfig, googleClientId } from "./firebase-config.js?v=20261111a";

const SDK = "https://www.gstatic.com/firebasejs/10.12.2";
const COLECCION = "respuestas";

export const isDemo = String(firebaseConfig.apiKey).startsWith("TU_");

async function makeFirebase() {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`),
  ]);
  const app = initializeApp(firebaseConfig);
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);
  const provider = new A.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  // Login con la ventana de Google (Google Identity Services) -> credencial de Firebase.
  // Evita la página intermedia de Firebase, que en Safari/iPhone falla con "missing initial state".
  const gis = googleClientId ? new Promise((res) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client"; s.async = true;
    s.onload = () => res(true); s.onerror = () => res(false);
    document.head.append(s);
  }) : Promise.resolve(false);
  let gisOk = false;
  gis.then((ok) => { gisOk = ok && !!window.google?.accounts?.oauth2; });

  function gisToken() {
    return new Promise((resolve, reject) => {
      const fail = (code) => reject(Object.assign(new Error(code), { code }));
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: googleClientId,
        scope: "openid email profile",
        prompt: "select_account",
        callback: (r) => (r.access_token ? resolve(r.access_token)
          : fail(r.error === "access_denied" ? "auth/popup-closed-by-user" : `auth/gis-${r.error || "error"}`)),
        error_callback: (e) => fail(e?.type === "popup_closed" ? "auth/popup-closed-by-user"
          : e?.type === "popup_failed_to_open" ? "auth/popup-blocked" : `auth/gis-${e?.type || "error"}`),
      });
      client.requestAccessToken();      // debe ejecutarse dentro del toque del usuario (abre la ventana)
    });
  }

  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  const pick = (u) => u && { uid: u.uid, nombre: u.displayName || "", email: u.email || "", foto: u.photoURL || null };

  return {
    onAuth(cb) { return A.onAuthStateChanged(auth, (u) => cb(pick(u))); },
    async signIn() {
      if (gisOk) {
        const token = await gisToken();
        await A.signInWithCredential(auth, A.GoogleAuthProvider.credential(null, token));
        return;
      }
      try {
        await A.signInWithPopup(auth, provider);
      } catch (e) {
        // La redirección de Firebase no funciona en Safari/iPhone (almacenamiento particionado): no se usa ahí.
        if (e.code === "auth/popup-blocked" && !isIOS) return A.signInWithRedirect(auth, provider);
        throw e;
      }
    },
    signOut() { return A.signOut(auth); },
    async getResponse(uid) {
      const s = await F.getDoc(F.doc(db, COLECCION, uid));
      return s.exists() ? s.data() : null;
    },
    deleteResponse(uid) { return F.deleteDoc(F.doc(db, COLECCION, uid)); },
    // Solo administradores: pasa a una persona a "no asiste" (las reglas lo restringen a eso)
    marcarNoAsiste(uid) {
      return F.updateDoc(F.doc(db, COLECCION, uid), { asiste: false, actualizado: F.serverTimestamp() });
    },
    saveResponse(user, { asiste, bebidas, mezclas }) {
      return F.setDoc(F.doc(db, COLECCION, user.uid), {
        nombre: user.nombre, email: user.email, foto: user.foto,
        asiste, bebidas, mezclas: mezclas || {}, actualizado: F.serverTimestamp(),
      });
    },
    subscribeAll(cb, onError) {
      return F.onSnapshot(F.collection(db, COLECCION),
        (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
    },
  };
}

function makeDemo() {
  const KEY = "demo_respuestas", UKEY = "demo_user";
  const read = () => JSON.parse(localStorage.getItem(KEY) || "{}");
  const listeners = new Set();
  const emit = () => listeners.forEach((f) => f());
  const demoUser = { uid: "demo-uid", nombre: "Manuel Martin Castrillo", email: "manumarcas9711@gmail.com", foto: null };
  let authCb = null;
  return {
    onAuth(cb) { authCb = cb; cb(localStorage.getItem(UKEY) ? demoUser : null); return () => {}; },
    async signIn() { localStorage.setItem(UKEY, "1"); authCb(demoUser); },
    async signOut() { localStorage.removeItem(UKEY); authCb(null); },
    async getResponse(uid) { return read()[uid] || null; },
    async deleteResponse(uid) {
      const all = read(); delete all[uid];
      localStorage.setItem(KEY, JSON.stringify(all)); emit();
    },
    async marcarNoAsiste(uid) {
      const all = read();
      if (all[uid]) { all[uid].asiste = false; localStorage.setItem(KEY, JSON.stringify(all)); emit(); }
    },
    async saveResponse(user, { asiste, bebidas, mezclas }) {
      const all = read();
      all[user.uid] = { nombre: user.nombre, email: user.email, foto: user.foto, asiste, bebidas, mezclas: mezclas || {} };
      localStorage.setItem(KEY, JSON.stringify(all));
      emit();
    },
    subscribeAll(cb) {
      const f = () => cb(Object.entries(read()).map(([id, v]) => ({ id, ...v })));
      listeners.add(f); f();
      return () => listeners.delete(f);
    },
  };
}

export const backend = isDemo ? makeDemo() : await makeFirebase();
