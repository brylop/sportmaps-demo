/**
 * Artículo NUEVO propuesto para el Centro de Ayuda / Sportbot:
 * `bff/src/data/help-articles.ts`. NO está aplicado — es el contenido listo
 * para pegar (patrón `feedback_pdf_manual_template`: "solo el contenido").
 *
 * Sugerencia de cabecera del HelpArticle:
 *   slug:        "entrenador-categorias-y-segundo-equipo"
 *   categoryId:  el mismo de "tomar-asistencia-coach" (ver helpCategories)
 *   title:       "Entrenador: categorías, deportistas y grupo de arqueros"
 *   excerpt:     "Cómo un entrenador crea su categoría, inscribe o mueve
 *                 deportistas, arma un grupo transversal (arqueros) sin sacarlos
 *                 de su categoría, pasa lista y planea sesiones."
 *   readTime:    "6 min"
 *   targetRole:  "coach"
 *   related:     ["tomar-asistencia-coach", "planes-entrenamiento"]
 *
 * Es genérico (no nombra a ninguna escuela): "crear categoría", "agregar
 * deportista" y "agregarlo también" solo aparecen en escuelas que tengan esas
 * opciones activadas por SportMaps; el texto lo dice.
 */

import type { ContentBlock } from "../help-articles"; // ajustar el import relativo al pegar

export const entrenadorCategoriasSegundoEquipoBody: ContentBlock[] = [
  {
    type: "p",
    content:
      "Esta guía cubre lo que hace un entrenador en SportMaps con sus categorías: verlas, crear una nueva (si la escuela lo permite), inscribir o mover deportistas, armar un grupo transversal como un equipo de arqueros, pasar lista y planear sesiones.",
  },
  { type: "h2", content: "Tus categorías" },
  {
    type: "p",
    content:
      "En el menú lateral, Mis Equipos muestra solo las categorías donde la escuela te asignó como entrenador. Cada fila trae el deporte, la sede, el entrenador y cuántos deportistas hay sobre el cupo. Si te falta una categoría, pídele al administrador que te asigne; no necesitas otra cuenta.",
  },
  {
    type: "callout",
    variant: "info",
    content:
      "Si tu escuela activó la opción, arriba a la derecha verás Nuevo Equipo. Llenas nombre, deporte, categoría, capacidad y sede, y quedas como su entrenador. Cambiar quién entrena una categoría siempre es de la administración.",
  },
  { type: "h2", content: "Inscribir deportistas" },
  {
    type: "ol",
    items: [
      "En la fila de la categoría pulsa el ícono de la persona con + (Gestionar Deportistas).",
      "Arriba están los inscritos; abajo, los deportistas de la escuela que todavía no están en esa categoría. Busca por nombre.",
      "Pulsa Inscribir. Si el deportista no tiene otra categoría, queda inscrito de inmediato.",
      "Remover lo saca solo de esta categoría.",
    ],
  },
  { type: "h2", content: "Si ya está en otra categoría: agregarlo también o moverlo" },
  {
    type: "p",
    content:
      "Cuando el deportista ya tiene una categoría, al pulsar Inscribir aparece la pregunta \"ya tiene equipo\" con dos opciones.",
  },
  {
    type: "table",
    headers: ["Opción", "Qué pasa", "Cuándo usarla"],
    rows: [
      ["Agregarlo también", "Queda en las dos categorías. La segunda no genera cobro.", "Equipo de arqueros, preparación física, selección: sigue en su categoría y además entrena con el grupo."],
      ["Moverlo", "Sale de la categoría anterior y entra a esta.", "Cambio de categoría por edad o nivel."],
    ],
  },
  {
    type: "callout",
    variant: "tip",
    content:
      "Equipo de arqueros: crea una sola vez la categoría (por ejemplo \"Equipo Arqueros\") y agrega a cada arquero con Agregarlo también. Puedes pasar lista y planear sesiones solo para ese grupo, y cada arquero sigue en su categoría por edad.",
  },
  {
    type: "callout",
    variant: "warning",
    content:
      "\"Agregarlo también\" solo aparece en escuelas que tienen habilitado el segundo equipo. Si no te sale, la escuela puede pedirlo a SportMaps. Un deportista con plan de pago se mueve desde su ficha en Deportistas, donde se ajusta el cobro.",
  },
  { type: "h3", content: "Dos detalles que confunden" },
  {
    type: "ul",
    items: [
      "El contador de la tarjeta (0/20) puede no incluir a los que agregaste con \"Agregarlo también\". La cuenta correcta está dentro de Inscribir Deportistas y en Asistencias.",
      "En Mis Deportistas cada uno aparece con su categoría principal (la primera). El segundo equipo sí sale en Asistencias, Sesiones y Reportes.",
    ],
  },
  { type: "h2", content: "Asistencia con dos categorías" },
  {
    type: "p",
    content:
      "Cada categoría tiene su propia lista por día. Un arquero puede quedar presente en la lista de su categoría y también en la del equipo de arqueros el mismo día: son listas separadas y las dos cuentan en su historial.",
  },
  { type: "h2", content: "Sesiones y mesociclo" },
  {
    type: "p",
    content:
      "En Métricas y Rendimiento eliges la categoría, y desde ahí creas el mesociclo del mes o sesiones sueltas. Para el grupo de arqueros seleccionas esa categoría y planeas igual: sus sesiones quedan separadas. La dirección de la escuela ve todas las sesiones de la semana de todos los entrenadores.",
  },
  { type: "h2", content: "Reportes" },
  {
    type: "p",
    content:
      "En Reportes, con la categoría elegida, la pestaña Asistencia muestra el porcentaje del mes por deportista y marca a los que están por debajo del 70%.",
  },
];
