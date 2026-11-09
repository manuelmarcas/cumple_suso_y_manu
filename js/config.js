// ============================================================
//  CONFIGURACIÓN DEL EVENTO  ·  edita solo este archivo
// ============================================================
export const CONFIG = {
  anfitriones: "Suso y Manu",

  // Cuentas de Google que ven el botón "Ver votaciones".
  // (Las reglas de Firestore deben tener el mismo email: ver firestore.rules)
  admins: ["manumarcas9711@gmail.com", "jlimens@umh.es"],

  fechaTexto: "Sábado 14 de noviembre",
  horaTexto: "20:00",

  lugarNombre: "Casa de Marcas",
  direccion: "Calle Polo y Peyrolón, 23, Valencia",

  // Opciones de bebida, en el orden en que se muestran (2 por fila).
  // mezcla: true → al elegirla se pregunta con qué acompañarla.
  bebidas: [
    { id: "agua",    label: "Agua",    icon: "💧" },
    { id: "cerveza", label: "Cerveza", icon: "🍺" },
    { id: "vino",    label: "Vino",    icon: "🍷" },
    { id: "vermut",  label: "Vermut",  icon: "🫒" },
    { id: "ginebra", label: "Ginebra", icon: "🍸", mezcla: true },
    { id: "ron",     label: "Ron",     icon: "🏴‍☠️", mezcla: true },
    { id: "whisky",  label: "Whisky",  icon: "🥃", mezcla: true },
    { id: "vodka",   label: "Vodka",   icon: "🧊", mezcla: true },
  ],

  // Con qué se acompañan los destilados (se puede marcar más de uno).
  mezclas: [
    { id: "cocacola",      label: "Coca-Cola",     icon: "🥤" },
    { id: "fanta_naranja", label: "Fanta naranja", icon: "🍊" },
    { id: "fanta_limon",   label: "Fanta limón",   icon: "🍋" },
    { id: "tonica",        label: "Tónica",        icon: "🫧" },
  ],

  // Música de ambiente (archivo en assets/). Deja archivo vacío para desactivarla. volumen: 0 a 1
  musica: { archivo: "assets/musica.mp3?v=20261109a", volumen: 0.4, volumenInicial: 0.06 },

  // Enlace de invitación al grupo de WhatsApp (se muestra al final). Vacío = no se muestra.
  whatsapp: "https://chat.whatsapp.com/KS1LXPhpvAyG5FdK2N8CBg?s=cl&p=a&iam=2",

  // Si es true, quien dijo "no" ve un enlace muy discreto para cambiar de opinión
  // (contradice el aviso de "no habrá marcha atrás").
  permitirCambiarRespuesta: false, // false = "no hay marcha atrás", como avisa la web
};
