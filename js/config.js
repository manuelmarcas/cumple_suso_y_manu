// ============================================================
//  CONFIGURACIÓN DEL EVENTO  ·  edita solo este archivo
// ============================================================
export const CONFIG = {
  anfitriones: "Suso y Manu",

  // Cuentas de Google que ven el botón "Ver votaciones".
  // (Las reglas de Firestore deben tener el mismo email: ver firestore.rules)
  admins: ["manumarcas9711@gmail.com"],

  fechaTexto: "Sábado 14 de noviembre",
  horaTexto: "19:00",

  lugarNombre: "Casa de Marcas",
  direccion: "Calle Polo y Peyrolón, 23, Valencia",

  // Opciones de bebida (id = lo que se guarda en la base de datos)
  bebidas: [
    { id: "agua",    label: "Agua",      icon: "💧" },
    { id: "cocacola", label: "Coca-Cola", icon: "🥤" },
    { id: "vermut",  label: "Vermut",    icon: "🍷" },
    { id: "cerveza", label: "Cerveza",   icon: "🍺" },
    { id: "ginebra", label: "Ginebra",   icon: "🍸" },
    { id: "ron",     label: "Ron",       icon: "🏴‍☠️" },
    { id: "whisky",  label: "Whisky",    icon: "🥃" },
    { id: "vodka",   label: "Vodka",     icon: "🧊" },
  ],

  // Música de ambiente (archivo en assets/). Deja archivo vacío para desactivarla. volumen: 0 a 1
  musica: { archivo: "assets/musica.mp3?v=20261108f", volumen: 0.4 },

  // Enlace de invitación al grupo de WhatsApp (se muestra al final). Vacío = no se muestra.
  whatsapp: "https://chat.whatsapp.com/KS1LXPhpvAyG5FdK2N8CBg?s=cl&p=a&iam=2",

  // Si es true, quien dijo "no" ve un enlace muy discreto para cambiar de opinión
  // (contradice el aviso de "no habrá marcha atrás").
  permitirCambiarRespuesta: false, // false = "no hay marcha atrás", como avisa la web
};
