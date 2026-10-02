/**
 * Contenido para el Centro de Ayuda / Sportbot (`bff/src/data/help-articles.ts`)
 * que acompaña al manual `docs/manuales/academias/informe-mensual-besser.pdf`.
 * APLICADO el 2026-10-02 en bff/src/data/help-articles.ts (lo pidió el
 * usuario). Este archivo queda como registro de lo que se cargó.
 *
 * Dos piezas:
 *
 * 1. `informeMensualCoachArticle` — artículo NUEVO, slug `informe-mensual-coach`
 *    (no existía ninguno sobre el Informe Mensual). Pegarlo dentro del array
 *    exportado de artículos, por ejemplo justo después de `reportes-coach`.
 *    Es genérico (sirve para cualquier escuela): lo propio de Besser vive solo
 *    en el PDF.
 *
 * 2. `reportesCoachBody` — REEMPLAZO del `body` del artículo existente
 *    `reportes-coach` (~línea 1230). El actual describe pestañas que ya no
 *    existen (General, Evaluaciones, Partidos, Uniformes), filtros por fecha
 *    y exportar a Excel. Las reales son Asistencia, Nómina, Resultados y
 *    Goleadores, con «Exportar PDF» e «Informe grupal del mes». Se conserva
 *    el mismo slug/categoryId para no romper los `related` que lo apuntan; se
 *    sugiere también actualizar su `excerpt` (abajo) y agregar
 *    "informe-mensual-coach" a su `related`.
 */

import type { ContentBlock, HelpArticle } from "../help-articles"; // ajustar el import relativo al pegar

// ─────────────────────────────────────────────────────────────────────────────
// 1. Artículo nuevo: informe-mensual-coach
// ─────────────────────────────────────────────────────────────────────────────
export const informeMensualCoachArticle: HelpArticle = {
  slug: "informe-mensual-coach",
  categoryId: "operacion-diaria",
  title: "Informe Mensual: nota del equipo, publicar, revisar y enviar a las familias",
  excerpt:
    "Cada mes, cada deportista evaluado recibe un informe con lo que más mejoró, su asistencia y la nota de su entrenador. Así se escribe la nota, se publica, se revisa el PDF y se envía.",
  readTime: "5 min",
  targetRole: ["coach", "school"],
  body: [
    {
      type: "p",
      content:
        "El Informe Mensual le cuenta a cada familia cómo le fue a su hijo o hija en el mes: lo que más mejoró, sus métricas por área, su asistencia, goles y asistencias, y la nota del entrenador. Hay dos informes: el individual (uno por deportista, lo recibe la familia) y el grupal (uno por equipo, solo lo ven el entrenador y la administración).",
    },
    { type: "callout", variant: "info", content: "Menú: Informe Mensual" },
    { type: "h2", content: "El proceso del mes" },
    {
      type: "ol",
      items: [
        "Los borradores se crean solos para cada deportista que tuvo al menos una evaluación en el mes.",
        "El entrenador escribe la nota de cada equipo.",
        "Se publica y se revisa el PDF de cada deportista.",
        "Se envía a las familias (correo con el enlace y notificación en la app).",
      ],
    },
    {
      type: "callout",
      variant: "tip",
      content:
        "Publicar no envía. Entre los dos pasos tienes tiempo de abrir cada PDF y revisar que todo esté bien.",
    },
    { type: "h2", content: "1. Elegir el mes y leer la cobertura" },
    {
      type: "p",
      content:
        "Arriba eliges el mes y el año; la pantalla arranca en el mes en curso. La tabla de cobertura muestra por equipo cuántos deportistas hay, cuántos tienen nota, cuántos faltan, cuántos se publicaron y cuántas familias ya lo leyeron. «Sin medir» son los que no tuvieron ninguna evaluación en el mes: a ellos no se les crea informe.",
    },
    { type: "h2", content: "2. Escribir la nota del equipo" },
    {
      type: "ol",
      items: [
        "En «Nota del equipo», elige el equipo.",
        "En «Cómo le fue al equipo», escribe lo que trabajaron, cómo respondió el grupo y qué sigue (mínimo 20 caracteres).",
        "Pulsa «Guardar nota».",
      ],
    },
    {
      type: "callout",
      variant: "warning",
      content:
        "La nota del equipo es obligatoria: sin ella el informe no se puede publicar. Al guardar, el cuadro se vacía; es normal, la nota quedó guardada. Si la vuelves a guardar, reemplaza la anterior.",
    },
    { type: "h2", content: "3. Publicar" },
    {
      type: "p",
      content:
        "Con la nota guardada, pulsa «Publicar N informes». Publicar congela el informe como foto del mes: las evaluaciones que se carguen después ya no lo cambian. Repite con cada uno de tus equipos. Si quieres decirle algo puntual a una familia, antes de publicar usa «Nota individual» en la fila del deportista (es opcional).",
    },
    { type: "h2", content: "4. Revisar el PDF y enviar" },
    {
      type: "p",
      content:
        "Cada deportista publicado tiene «Ver PDF» y «Enviar». El PDF es exactamente lo que recibe la familia, con el logo y los colores del club. Para enviar: «Enviar» en una fila (solo ese) o «Enviar los publicados» (todos los de tus equipos que faltan). Al enviar aparece un chulo verde.",
    },
    {
      type: "callout",
      variant: "warning",
      content:
        "Solo le llega a una familia con cuenta en la app vinculada al deportista. Si no la tiene, la fila dice «sin acudiente» y no hay botón Enviar: el informe queda guardado y la familia lo verá cuando se registre.",
    },
    { type: "h2", content: "Quién publica y envía" },
    {
      type: "p",
      content:
        "Lo decide la administración en el selector «Quién publica y envía» de esta misma pantalla: «Solo la administración» (el entrenador escribe la nota y la escuela publica y envía) o «Cada entrenador, lo suyo» (cada entrenador publica y envía sus propios equipos). Generar borradores a mano es siempre de la administración.",
    },
    { type: "h2", content: "Si algo no cuadra" },
    {
      type: "table",
      headers: ["Lo que pasa", "Qué hacer"],
      rows: [
        ["«Publicar» está gris", "Revisa que elegiste el equipo y el mes correctos; puede que ya no haya informes pendientes"],
        ["Error: falta la nota del equipo", "Escríbela (20 caracteres o más) y pulsa «Guardar nota» antes de publicar"],
        ["Un deportista no tiene informe", "No tuvo evaluaciones en el mes, o se evaluó después del cierre: evalúalo y pide a la administración «Generar borradores»"],
        ["No aparece «Enviar» en un deportista", "No tiene acudiente con cuenta vinculada; hay que invitarlo"],
      ],
    },
    {
      type: "callout",
      variant: "tip",
      content:
        "Escribe la nota de tus equipos antes del día de envío del club (el 28 si no se cambió): ese día los informes que tienen nota se publican solos. Después solo te queda revisar y enviar.",
    },
  ],
  related: ["reportes-coach", "evaluaciones-jugadores", "tomar-asistencia-coach"],
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. Reemplazo del body de reportes-coach
// ─────────────────────────────────────────────────────────────────────────────
export const reportesCoachExcerpt =
  "Cada entrenador ve el resumen de sus equipos: jugadores, partidos, asistencia, victorias/empates/derrotas y goleadores. Desde ahí se abre el informe grupal del mes.";

export const reportesCoachBody: ContentBlock[] = [
  {
    type: "p",
    content:
      "Mientras la dirección ve métricas de toda la academia, cada entrenador ve solo lo de SUS equipos. El panel responde rápido a las preguntas de siempre: ¿cómo va la asistencia?, ¿cómo nos fue en los partidos?, ¿quién va marcando más goles?",
  },
  { type: "callout", variant: "info", content: "Menú: Reportes (panel del entrenador)" },
  { type: "h2", content: "Arriba: el equipo y los totales" },
  {
    type: "p",
    content:
      "Eliges el equipo y ves: jugadores, partidos, asistencia promedio, y victorias, empates y derrotas. Si hay jugadores por debajo del 70% de asistencia aparece una alerta en rojo.",
  },
  { type: "h2", content: "Pestañas" },
  {
    type: "table",
    headers: ["Pestaña", "Qué muestra", "De dónde sale"],
    rows: [
      ["Asistencia", "Porcentaje de cada jugador; los de menos del 70% marcados «Requiere atención»", "Asistencias"],
      ["Nómina", "La lista de jugadores del equipo", "Equipos"],
      ["Resultados", "Cada partido como Victoria, Empate o Derrota, con el marcador del club primero", "Resultados (partidos jugados, indicando local o visitante)"],
      ["Goleadores", "Goles y asistencias de cada jugador en la temporada", "Métricas «Goles» y «Asistencias» de la evaluación"],
    ],
  },
  {
    type: "callout",
    variant: "warning",
    content:
      "En la evaluación, «Goles» y «Asistencias» se escriben como el total que lleva el jugador en la temporada, no los del último partido: la tabla toma el último valor que registraste.",
  },
  { type: "h2", content: "Informe grupal del mes" },
  {
    type: "p",
    content:
      "El botón «Informe grupal del mes» (arriba a la derecha) abre el agregado mensual del equipo: cansancio, comprensión de las tareas, esfuerzo, satisfacción y aspectos a mejorar, a partir de las autoevaluaciones post-entrenamiento y de la evaluación del entrenador. Eliges equipo, mes y año, y se puede descargar en PDF. Este informe no se envía a las familias.",
  },
  { type: "h2", content: "Exportar" },
  {
    type: "p",
    content:
      "«Exportar PDF» descarga el resumen del equipo seleccionado. Sirve para una reunión con la dirección o con las familias.",
  },
];
