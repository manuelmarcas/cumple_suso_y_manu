// Capa de datos: Firebase (real) o modo demo (localStorage) si aún no hay configuración.
import { firebaseConfig } from "./firebase-config.js?v=20261108c";

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

  const pick = (u) => u && { uid: u.uid, nombre: u.displayName || "", email: u.email || "", foto: u.photoURL || null };

  return {
    onAuth(cb) { return A.onAuthStateChanged(auth, (u) => cb(pick(u))); },
    async signIn() {
      try {
        await A.signInWithPopup(auth, provider);
      } catch (e) {
        if (e.code === "auth/popup-blocked") return A.signInWithRedirect(auth, provider);
        throw e;
      }
    },
    signOut() { return A.signOut(auth); },
    async getResponse(uid) {
      const s = await F.getDoc(F.doc(db, COLECCION, uid));
      return s.exists() ? s.data() : null;
    },
    saveResponse(user, { asiste, bebidas }) {
      return F.setDoc(F.doc(db, COLECCION, user.uid), {
        nombre: user.nombre, email: user.email, foto: user.foto,
        asiste, bebidas, actualizado: F.serverTimestamp(),
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
    async saveResponse(user, { asiste, bebidas }) {
      const all = read();
      all[user.uid] = { nombre: user.nombre, email: user.email, foto: user.foto, asiste, bebidas };
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
