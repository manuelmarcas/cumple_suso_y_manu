# Cumpleaños de Suso y Manu

Web de invitación y votaciones. Estática (GitHub Pages) + Firebase (Google Login + Firestore).

## Flujo

1. **Login** neutro con Google.
2. **Bienvenida** sobre la imagen de fondo: aparecen los textos poco a poco y la pregunta de asistencia.
   - **No** → se desvanece en niebla y se despide. Nada más.
   - **Sí** → niebla, 3 s después aparece el plan (tardeo, cena, previa, Akuarela) → votación de bebidas (multiselección) → gracias + ubicación y botón *Cómo llegar* (Google Maps).
3. Botón inferior **Saltar** (solo tras decir que sí) → va directo a la ubicación con la hora.
4. La cuenta de administrador ve el botón **Ver votaciones** (asistentes y recuento por bebida en tiempo real).

Quien vuelve a entrar ve directamente su estado (despedida, bebidas o ubicación).

## 1) Configurar Firebase

1. [Consola de Firebase](https://console.firebase.google.com) → tu proyecto → **Configuración del proyecto → Tus apps → Web (`</>`)** → registra la app y copia la configuración en `js/firebase-config.js`.
2. **Authentication → Sign-in method** → activa **Google**.
3. **Authentication → Settings → Authorized domains** → añade `manuelmarcas.github.io`.
4. **Firestore Database** → *Crear base de datos* (modo producción, región `eur3` o `europe-west`).
5. **Firestore → Reglas** → pega el contenido de `firestore.rules` y publica.

> La configuración de `firebase-config.js` no es secreta: la seguridad la dan las reglas
> (cada persona solo escribe su propia respuesta; solo el admin lee todas).

## 2) Editar los datos del evento

Todo en `js/config.js`: **fecha**, **dirección exacta** de la casa, hora, bebidas y cuentas admin.
Si cambias el email de admin, cámbialo también en `firestore.rules` (función `isAdmin`).

## 3) Publicar en GitHub Pages

```bash
git init -b main
git add .
git commit -m "Web de cumpleaños"
git remote add origin https://github.com/manuelmarcas/cumple_suso_y_manu.git
git push -u origin main
```

Después: repositorio → **Settings → Pages → Source: Deploy from a branch → `main` / `(root)`**.
La web quedará en `https://manuelmarcas.github.io/cumple_suso_y_manu/`.

## Probar en local

```bash
python3 -m http.server 8000     # y abre http://localhost:8000
```

Mientras `firebase-config.js` tenga los valores `TU_...`, funciona en **modo demo**
(sin Firebase, datos solo en tu navegador). Con Firebase real, `localhost` ya está autorizado por defecto.

## Estructura de datos

Colección `respuestas`, un documento por persona (id = uid de Google):

```json
{ "nombre": "…", "email": "…", "foto": "…", "asiste": true, "bebidas": ["cerveza", "ron"], "actualizado": "<timestamp>" }
```

## Notas

- Desde navegadores integrados (WhatsApp, Instagram) Google bloquea el login: abrir en Chrome/Safari.
- Cualquier cuenta de Google puede responder. Si quieres limitarlo a una lista de invitados, hay que añadir una lista de emails a las reglas.
