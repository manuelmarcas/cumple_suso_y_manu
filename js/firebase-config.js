// Configuración de la app web de Firebase (proyecto: cumplesusoymanu).
// Estos valores NO son secretos; la seguridad la dan las reglas de Firestore (firestore.rules).
//
// Si algún día vuelve a tener valores "TU_...", la web funciona en MODO DEMO
// (datos solo en el navegador) para poder probarla en local.
export const firebaseConfig = {
  apiKey: "AIzaSyCQ9YFcxE-T8_EH-4QiqEq4oJJRmzvVY0U",
  authDomain: "cumplesusoymanu.firebaseapp.com",
  projectId: "cumplesusoymanu",
  storageBucket: "cumplesusoymanu.firebasestorage.app",
  messagingSenderId: "233302776798",
  appId: "1:233302776798:web:1939ee9839d86b866f5b4f",
};

// ID de cliente web de Google (Firebase → Authentication → Método de inicio de sesión → Google →
// "Configuración del SDK web" → ID de cliente web). Si se rellena, el login usa la ventana de
// Google directamente (más fiable en iPhone/Safari). Requiere añadir https://manuelmarcas.github.io
// en "Orígenes de JavaScript autorizados" de ese cliente en Google Cloud Console → Credenciales.
// Si se deja vacío, se usa el login estándar de Firebase.
export const googleClientId = "";
