/**
 * Contenido del «Manual del entrenador V2» (versión ACADEMIAS) listo para pegar en
 * `bff/src/data/help-articles.ts`. NO está aplicado: este archivo es el snippet.
 *
 * Qué hacer con cada pieza (los slugs existentes se greppearon el 2026-10-26):
 *
 *   NUEVOS (agregar al arreglo exportado de artículos):
 *     - entrenador-app-v2          → cómo está organizada la app del entrenador (5 pestañas)
 *     - partidos-entrenador        → partidos: programar, convocar, resultado, evaluar, reporte
 *     - sesiones-entrenador-v2     → Hoy · Semana · Plan del mes, modo cancha, planificación completa
 *     - planillas-y-matriculas-coach → planillas en papel por foto y hojas de matrícula
 *       ⚠ Publicar la parte de PLANILLAS solo cuando se corrija el bug B2 (planillas por foto
 *         fallan siempre) y el B4 (no hay botón para subir una). Ver docs/manuales/v2/pruebas-entrenador-v2.md.
 *
 *   REEMPLAZOS (mismo slug, categoryId y related; cambia `title`, `excerpt`, `readTime` y `body`):
 *     - tomar-asistencia-coach     → decía «editable 7 días» y no tenía el flujo V2 (Vino/Faltó/Excusa/Tarde,
 *                                     Deshacer, Cerrar la lista, corregir hoy/ayer, Evaluar al equipo).
 *     - evaluaciones-jugadores     → describía un menú «Evaluaciones» con slider 0-100 que ya no es el flujo:
 *                                     hoy se evalúa el entreno (Bien/Normal/Le costó) y el partido (criterios 1-5).
 *
 *   SIN CAMBIOS pero relacionados: planes-entrenamiento, reportes-coach, informe-mensual-coach,
 *   encuestas-asistencia, calendario-reservas (este último es de canchas; el calendario de eventos del
 *   entrenador va dentro de `partidos-entrenador`).
 *
 * Cómo aplicar: copiar los objetos de `nuevos` al arreglo de artículos, y en los dos reemplazos
 * sustituir los campos indicados del objeto con ese `slug`. Ajustar el import al pegar.
 */

import type { ContentBlock, HelpArticle } from "../../../../bff/src/data/help-articles"; // ajustar al pegar

// ─────────────────────────────────────────────────────────────────────────────
// NUEVOS
// ─────────────────────────────────────────────────────────────────────────────
export const nuevos: HelpArticle[] = [
  {
    slug: "entrenador-app-v2",
    categoryId: "operacion-diaria",
    title: "La app del entrenador: Hoy, Equipos, Sesiones, Asistencia y Más",
    excerpt:
      "Cómo está organizada la app del entrenador en el celular: qué hay en cada una de las cinco pestañas de abajo y qué hacer la primera vez que entras.",
    readTime: "4 min",
    targetRole: ["coach"],
    body: [
      {
        type: "p",
        content:
          "La app del entrenador está pensada para el celular, en la cancha: botones grandes y una sola cosa por pantalla. Todo lo que haces a diario está en las cinco pestañas de abajo; lo que usas pocas veces está en «Más». En el computador, las mismas secciones salen en el menú de la izquierda.",
      },
      {
        type: "table",
        headers: ["Pestaña", "Para qué la usas"],
        rows: [
          ["Hoy", "Qué entrenas hoy o mañana y lo pendiente: evaluar un entreno, convocar a un partido, publicar el informe."],
          ["Equipos", "Tus equipos, sus deportistas y su ficha, los partidos y convocatorias, y el informe del mes."],
          ["Sesiones", "El entreno de hoy, la semana y el plan del mes; abrir la sesión en modo cancha."],
          ["Asistencia", "Tomar lista, escanear carnets en la entrada, el historial y las planillas en papel."],
          ["Más", "Calendario, informes, rutinas, dotación, salud del equipo, mensajes, anuncios, encuestas, ayuda y tu cuenta."],
        ],
      },
      { type: "h2", content: "La primera vez que entras" },
      {
        type: "ol",
        items: [
          "La app te pide tu perfil profesional: nombre, documento, WhatsApp y deporte principal (la foto es opcional). Toca «Siguiente».",
          "Si tienes licencias o certificados, agrégalos con su archivo (PDF o foto). Puedes dejarlo para después.",
          "Toca «Guardar Perfil». Tus datos los cambias luego en Más → Mi perfil.",
        ],
      },
      { type: "h2", content: "Hoy: lo que toca y lo pendiente" },
      {
        type: "p",
        content:
          "Arriba ves si entrenas hoy o qué entrenas mañana («Preparar el entreno de mañana» te lleva a Sesiones). Debajo, en amarillo, los pendientes con su botón: «Falta evaluar el entreno», «Convocar al partido», «Informe por publicar». «Más tarde» lo esconde por ahora.",
      },
      { type: "h2", content: "Equipos" },
      {
        type: "ul",
        items: [
          "Cada equipo tiene tres pestañas: Deportistas, Partidos y convocatorias, y Evaluar.",
          "En Deportistas ves a cada uno con su acudiente y si está al día o vencido (solo el estado, no los valores).",
          "Al tocar un deportista: Escribir al acudiente (WhatsApp), Felicitar (le llega a la familia) y Ver ficha.",
          "Para inscribir, mover o dar de alta deportistas: Ver ficha → «Ver todo en Mis deportistas», si tu escuela te dio ese permiso.",
        ],
      },
      { type: "h2", content: "Más" },
      {
        type: "table",
        headers: ["Entrada", "Qué hay"],
        rows: [
          ["Agenda y citas", "Clases fijas asignadas y tus horarios disponibles."],
          ["Calendario", "Entrenos, partidos y torneos; crear eventos."],
          ["Informe mensual", "Tu nota del mes por equipo, publicar y enviar a las familias."],
          ["Informes del entreno", "Asistencia, nómina y resultados del equipo; informe grupal y PDF."],
          ["Rutinas · Mi dotación · Salud del equipo", "Biblioteca de rutinas, lo que tienes a cargo y quién puede entrenar (sin diagnósticos)."],
          ["Mensajes · Anuncios · Encuestas", "Conversaciones, anuncios y encuestas de asistencia."],
          ["Ayuda y Cuenta", "WhatsApp de la escuela, Mapi, Centro de ayuda, notificaciones, perfil, cambiar de escuela o rol, cerrar sesión."],
        ],
      },
      {
        type: "callout",
        variant: "tip",
        content: "Varias acciones (convocar, felicitar, evaluar el entreno) te dan unos segundos para «Deshacer». Espera a que desaparezca el aviso antes de cerrar la app.",
      },
    ],
    related: ["partidos-entrenador", "sesiones-entrenador-v2", "tomar-asistencia-coach", "evaluaciones-jugadores"],
  },
  {
    slug: "partidos-entrenador",
    categoryId: "operacion-diaria",
    title: "Partidos: programar, convocar, registrar el resultado, evaluar y reportar",
    excerpt:
      "Todo el partido en una sola pantalla: Programar → Convocar → Resultado (goles, asistencias y tarjetas) → Evaluar → Reporte. También desde el calendario.",
    readTime: "6 min",
    targetRole: ["coach", "school"],
    body: [
      {
        type: "p",
        content:
          "Cada partido vive en una sola pantalla con cinco pasos en orden: Programar, Convocar, Resultado, Evaluar y Reporte. Los pasos hechos quedan con un chulo y puedes volver a cualquiera.",
      },
      { type: "callout", variant: "info", content: "Ruta: Equipos → tu equipo → Partidos y convocatorias → «+ Partido»" },
      { type: "h2", content: "1. Programar" },
      {
        type: "ul",
        items: [
          "Contra quién, fecha, hora (opcional), en casa o de visita, cancha, tipo (Amistoso, Liga, Copa, Torneo, Clasificatorio, Final) y una nota para las familias.",
          "Fecha futura: «Programar y convocar». El partido queda también en el calendario del equipo.",
          "Ya se jugó: «Ya se jugó: registrar el resultado» (o «Guardar y registrar el resultado» si la fecha es hoy o pasada) y vas directo al marcador.",
        ],
      },
      { type: "h2", content: "2. Convocar" },
      {
        type: "p",
        content:
          "Arranca con todo el equipo (o con la convocatoria del último partido). Toca a quien no va para quitarlo y luego «Convocar a N». Si las familias tienen cuenta, el botón dice «Convocar y avisar a N familias» y ves quién va, quién no y quién no ha respondido.",
      },
      { type: "h2", content: "3. Resultado" },
      {
        type: "ul",
        items: [
          "Marcador con + y − para cada lado.",
          "En fútbol, fútbol sala y microfútbol: toca una jugadora y anótale Gol, Asistencia, Amarilla, Roja o Autogol. Cada anotación se guarda al instante; con − la quitas.",
          "Tu marcador se llena solo con los goles anotados; si lo cambias a mano, la app te avisa si no cuadra.",
          "Toca «Guardar resultado».",
        ],
      },
      { type: "h2", content: "4. Evaluar" },
      {
        type: "p",
        content:
          "Solo se evalúa a las convocadas, con los criterios de tu escuela (de 1 a 5) y un comentario corto. Lo que dejes en blanco no se guarda. Si tu escuela comparte las evaluaciones de partido, aparece «Publicar a las familias»: cada familia ve solo la de su deportista.",
      },
      {
        type: "callout",
        variant: "warning",
        content: "Si dice «No hay criterios para evaluar», pídele a la administración que los defina: desde esa misma pantalla tiene el botón «Usar los criterios sugeridos para partidos».",
      },
      { type: "h2", content: "5. Reporte" },
      {
        type: "p",
        content:
          "Resumen, desarrollo del partido y aspectos a mejorar. Con «Publicar a las familias» se lo envías al equipo. «Guardar» y «Terminar»; luego puedes «Ver o editar el reporte».",
      },
      { type: "h2", content: "Falta el resultado, pizarra y lista de partidos" },
      {
        type: "ul",
        items: [
          "Un partido que ya pasó sin marcador aparece en «Falta el resultado»: tócalo para cerrarlo.",
          "«Armar la alineación en la pizarra» abre la cancha: eliges la formación, ubicas a los convocados y guardas.",
          "«Ver todos los partidos» muestra la lista completa del equipo.",
        ],
      },
      { type: "h2", content: "Crear el partido desde el calendario" },
      {
        type: "ol",
        items: [
          "Más → Calendario → «Nuevo Evento».",
          "Para quién: el equipo. Tipo: Partido Oficial. La app pide el rival y si juegan en casa o de visita.",
          "Al crearlo queda el evento y el partido. En el detalle del día aparece «Abrir partido».",
        ],
      },
      { type: "callout", variant: "tip", content: "Si se aplaza, cambia la fecha en «Programar»: el calendario se actualiza solo. Si se cancela, «Cancelar este partido»." },
    ],
    related: ["entrenador-app-v2", "evaluaciones-jugadores", "reportes-coach"],
  },
  {
    slug: "sesiones-entrenador-v2",
    categoryId: "operacion-diaria",
    title: "Sesiones: el entreno de hoy, la semana, el plan del mes y el modo cancha",
    excerpt:
      "Cómo ver y planear tus entrenos desde el celular, abrir la sesión en la cancha con letra grande y armar el plan del mes en la planificación completa.",
    readTime: "4 min",
    targetRole: ["coach"],
    body: [
      { type: "p", content: "La pestaña Sesiones tiene tres vistas: Hoy, Semana y Plan del mes. Crear o editar sesiones y el plan se hace en la planificación completa (más cómoda en el computador)." },
      { type: "h2", content: "Semana" },
      { type: "p", content: "Cada día dice qué equipo entrena y si ya tiene sesión planeada. Al tocar un día con sesión ves sus bloques y los botones «Ver sesión» y «Abrir en la cancha». «Planear» te lleva a la planificación completa." },
      { type: "h2", content: "Modo cancha" },
      { type: "p", content: "«Abrir en la cancha» muestra un bloque a la vez en letra grande, con «Anterior» y «Siguiente». La pantalla no se apaga mientras estás ahí. «Salir» arriba a la derecha." },
      { type: "h2", content: "Plan del mes" },
      { type: "p", content: "Elige el equipo y ves el objetivo del mes, las cuatro semanas con su carga y el balance de entrenos hechos. Si no hay plan, «Crear el plan»." },
      { type: "h2", content: "Planificación completa" },
      {
        type: "ol",
        items: [
          "Elige el equipo en «Panel de Selección».",
          "Con el botón ⋯ del plan: «Nuevo mesociclo» (inicio, fin, objetivo general y modelo de juego), «Editar» o «Eliminar».",
          "En la semana, «Agregar sesión» → elige el día.",
          "Llena materiales, objetivo, principios de juego y los bloques (nombre, minutos, actividad, componente, objetivo, organización) o tráelos «Desde la biblioteca». La evaluación de la sesión es opcional.",
          "«Crear Sesión»: queda en su día y en Sesiones → Semana del celular.",
        ],
      },
    ],
    related: ["planes-entrenamiento", "entrenador-app-v2", "tomar-asistencia-coach"],
  },
  {
    slug: "planillas-y-matriculas-coach",
    categoryId: "operacion-diaria",
    title: "Planillas de asistencia en papel y hojas de matrícula por foto",
    excerpt:
      "Si la asistencia o una inscripción se llenó en papel, tómale una foto: el sistema lee los nombres y alguien revisa antes de guardar. Nada se guarda solo.",
    readTime: "3 min",
    targetRole: ["coach", "school"],
    body: [
      { type: "h2", content: "Planillas de asistencia" },
      {
        type: "ol",
        items: [
          "En «Planillas por revisar», toca «Subir planilla» y toma la foto de la hoja completa, de frente y con buena luz (también se puede mandar por el WhatsApp de la escuela).",
          "La planilla queda en la lista: ves la foto y una grilla con cada deportista y fecha. Corrige lo que haga falta.",
          "Solo se guarda lo que dejes marcado al tocar «Guardar». «Descartar» la saca de la lista.",
        ],
      },
      { type: "callout", variant: "info", content: "Como entrenador ves solo las planillas que tú subiste. Las pendientes salen como aviso en Asistencia → Historial." },
      { type: "h2", content: "Hojas de matrícula (si tu escuela lo permite)" },
      {
        type: "p",
        content:
          "Tu escuela puede dejarte subir la foto de la ficha de inscripción en papel. Tú tomas la foto; la escuela revisa los datos que el sistema leyó y crea al deportista. Si no está habilitado verás «Tu escuela no tiene habilitado que los entrenadores suban hojas de matrícula».",
      },
      {
        type: "table",
        headers: ["Quién", "Qué hace"],
        rows: [
          ["Entrenador", "Ficha del deportista → «Ver todo en Mis deportistas» → subir hoja de matrícula."],
          ["Administración", "Activa el permiso en Pagos → Config → Permisos → «Coaches pueden subir hojas de matrícula» y revisa en «Matrículas por revisar» (Crear atleta o Descartar)."],
        ],
      },
    ],
    related: ["tomar-asistencia-coach", "registrar-nuevo-atleta"],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// REEMPLAZO: tomar-asistencia-coach (mismo slug, categoryId y related)
// ─────────────────────────────────────────────────────────────────────────────
export const tomarAsistenciaCoach = {
  title: "Tomar asistencia: lista, cerrar, corregir, evaluar el entreno y escanear carnets",
  excerpt:
    "La lista arranca con todos en «Vino»: toca solo al que no vino (Faltó, Excusa o Tarde). Guardar, cerrar, corregir hoy o ayer, evaluar al equipo y escanear el carnet en la entrada.",
  readTime: "5 min",
  body: [
    { type: "callout", variant: "info", content: "Ruta: barra de abajo → Asistencia (pestañas Tomar lista e Historial)" },
    { type: "h2", content: "Tomar lista" },
    {
      type: "ol",
      items: [
        "Elige el equipo (si tienes uno solo entra directo) y el día: Hoy o Ayer.",
        "Toca a cada deportista para cambiar su estado: Vino → Faltó → Excusa → Tarde. Quien avisó por WhatsApp que no venía arranca con excusa.",
        "En «Más opciones» marca si fue una clase secundaria (descuenta de las clases secundarias del plan).",
        "Toca «Guardar lista». Tienes unos segundos para «Deshacer»; luego queda «Lista guardada».",
      ],
    },
    { type: "callout", variant: "tip", content: "Sin señal, la lista se guarda en el teléfono y sube sola cuando vuelva la conexión. No cierres sesión mientras tanto." },
    { type: "h2", content: "Cerrar y corregir" },
    {
      type: "ul",
      items: [
        "«Cerrar la lista» la deja fija: no se puede cambiar sin reabrirla. Después puedes calificar el entreno.",
        "«Corregir» está disponible para la lista de hoy y la de ayer. Más atrás, la corrige la escuela.",
      ],
    },
    { type: "h2", content: "Evaluar al equipo" },
    {
      type: "p",
      content:
        "«Evaluar al equipo» muestra solo a los que vinieron, todos en «Normal». Toca al que le fue «Bien» o al que «Le costó» (o «A todos: Bien»), escribe una nota para las familias si quieres y «Guardar evaluación»: las familias reciben «Así le fue hoy».",
    },
    { type: "h2", content: "Historial" },
    { type: "p", content: "El % de asistencia del mes, cuántos entrenos tienen lista, quién falta mucho y cada entreno con «vinieron N de M». Si llegaron planillas en papel por foto, el aviso sale aquí arriba." },
    { type: "h2", content: "Escanear carnets en la entrada" },
    {
      type: "p",
      content:
        "«Escanear carnets en la entrada» abre la cámara (acepta el permiso la primera vez). Cada deportista muestra el QR de su carnet digital y queda presente al toque, sin elegir equipo antes. Escanear dos veces no duplica.",
    },
    { type: "h2", content: "Torniquete" },
    { type: "p", content: "Si tu escuela tiene control de acceso, la entrada por el torniquete se registra sola; no tienes que hacer nada." },
  ] as ContentBlock[],
};

// ─────────────────────────────────────────────────────────────────────────────
// REEMPLAZO: evaluaciones-jugadores (mismo slug, categoryId y related)
// ─────────────────────────────────────────────────────────────────────────────
export const evaluacionesJugadores = {
  title: "Evaluar a tus deportistas: después del entreno y después del partido",
  excerpt:
    "Dos evaluaciones: la del entreno (Bien · Normal · Le costó, un toque por deportista) y la del partido (criterios de tu escuela de 1 a 5, solo a las convocadas).",
  readTime: "3 min",
  body: [
    { type: "h2", content: "Después del entreno" },
    {
      type: "ol",
      items: [
        "Toma la lista y ciérrala (Asistencia → Guardar lista → Cerrar la lista), o toca el pendiente «Falta evaluar el entreno» en Hoy.",
        "«Evaluar al equipo»: todos arrancan en «Normal». Toca solo al que le fue «Bien» o al que «Le costó».",
        "Si quieres, «Felicitar» a alguien y una nota para las familias.",
        "«Guardar evaluación»: las familias de los que vinieron reciben «Así le fue hoy».",
      ],
    },
    { type: "h2", content: "Después del partido" },
    {
      type: "ol",
      items: [
        "Abre el partido (Equipos → Partidos) y ve al paso «Evaluar».",
        "Toca cada convocada y califica de 1 a 5 los criterios de tu escuela; deja un comentario corto.",
        "«Guardar evaluación». Si tu escuela comparte las evaluaciones de partido, «Publicar a las familias»: cada familia ve solo la de su deportista.",
      ],
    },
    { type: "callout", variant: "warning", content: "Los criterios de partido los define la administración. Si ves «No hay criterios para evaluar», pídeselo." },
    { type: "callout", variant: "tip", content: "Lo que dejes en blanco no se guarda: evalúa solo lo que viste." },
  ] as ContentBlock[],
};
