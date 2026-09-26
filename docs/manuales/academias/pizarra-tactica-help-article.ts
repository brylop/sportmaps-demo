/**
 * Artículo NUEVO propuesto para el Centro de Ayuda / Sportbot:
 * `bff/src/data/help-articles.ts`. NO está aplicado — es el contenido listo
 * para pegar (patrón `feedback_pdf_manual_template`: "solo el contenido").
 *
 * Sugerencia de cabecera del HelpArticle:
 *   slug:        "pizarra-tactica"
 *   categoryId:  el mismo de "planes-entrenamiento" (ver helpCategories)
 *   title:       "Pizarra táctica: jugadores, material, jugadas y modo arqueros"
 *   excerpt:     "Cómo armar una jugada o un ejercicio: jugadores o siluetas,
 *                 material con tamaño y giro, colores, líneas, balón en juego,
 *                 zoom para arqueros y plantillas reutilizables."
 *   readTime:    "7 min"
 *   targetRole:  "coach"
 *   related:     ["planes-entrenamiento", "tomar-asistencia-coach"]
 *   Video:       docs/manuales/video/pizarra-tactica.mp4 (si el centro de ayuda
 *                admite bloque de video, enlazarlo; si no, omitir).
 */

import type { ContentBlock } from "../help-articles"; // ajustar el import relativo al pegar

export const pizarraTacticaBody: ContentBlock[] = [
  {
    type: "p",
    content:
      "La pizarra táctica vive dentro de cada bloque de una sesión de entrenamiento (equipos de fútbol). Ahí colocas jugadores y material, dibujas líneas y recorridos del balón, animas la jugada y guardas el resultado en el bloque o como plantilla del equipo.",
  },
  { type: "h2", content: "Abrir la pizarra" },
  {
    type: "ol",
    items: [
      "Entra a Métricas y Rendimiento y elige el equipo.",
      "En la sesión, cada bloque tiene el botón Tablero táctico. Púlsalo.",
      "Arriba están la situación (Ataque, Defensa, Presión, Transición, Córner, Tiro libre, Penalti, Arqueros), las plantillas guardadas y las vistas. A la derecha, la plantilla del equipo; a la izquierda, al pulsar Pizarra, las herramientas.",
    ],
  },
  { type: "h2", content: "Jugadores: discos o siluetas" },
  {
    type: "p",
    content:
      "Arrastra cada jugador desde la plantilla hasta su posición; la × roja lo devuelve. Máximo 11 en cancha, el resto a la banca. El botón de la persona alterna entre discos con dorsal y siluetas; en siluetas el arquero sale con camiseta amarilla. Es una preferencia de tu pantalla y nunca muestra la foto del deportista.",
  },
  { type: "h2", content: "Material de entrenamiento" },
  {
    type: "p",
    content:
      "Once objetos: cono, plato, balón, arco, arco chico, vallita, aro, escalera, estaca, maniquí y rival. Elige uno y toca la cancha una vez por cada objeto. Arrástralo para moverlo.",
  },
  {
    type: "ul",
    items: [
      "Tocar un objeto lo selecciona (marco punteado, punto verde para girar, × para quitar). Tocar nunca borra.",
      "Con uno seleccionado, los deslizadores Tamaño (0,5× a 3×) y Giro lo cambian; +90° gira en cuartos. Sin nada seleccionado, fijan cómo se colocan los objetos nuevos.",
      "Duplicar copia el objeto con su tamaño, giro y color, un poco desplazado.",
      "Nueve colores para líneas, zonas y material. Blanco es el color natural de cada objeto.",
    ],
  },
  { type: "h2", content: "Líneas, balón en juego y reproducir" },
  {
    type: "p",
    content:
      "Flecha, Curva y Zona se dibujan arrastrando sobre la cancha; sus puntos blancos se ajustan después. Balón en juego tiene Pase, Remate y Penal: coloca un balón y arrastra desde él hasta el destino. Reproducir jugada anima todo a la vez (los jugadores recorren sus flechas y vuelven; el balón recorre su línea y en remate y penal se eleva) y al terminar deja todo como estaba.",
  },
  { type: "h2", content: "Modo arqueros" },
  {
    type: "p",
    content:
      "Elige la situación Arqueros y la cancha hace zoom al área. El botón de zoom de la barra alterna entre el área y la cancha completa sin perder nada.",
  },
  {
    type: "callout",
    variant: "warning",
    content:
      "Cambiar de situación borra las figuras dibujadas. Si solo quieres el zoom, usa el botón de zoom de la barra, no el selector de situación.",
  },
  { type: "h2", content: "Guardar" },
  {
    type: "table",
    headers: ["Botón", "Qué guarda", "Dónde lo encuentras después"],
    rows: [
      ["Guardar (verde)", "Jugadores y figuras de este bloque", "Al reabrir el Tablero táctico del mismo bloque"],
      ["Icono de marcador → nombre → OK", "Una plantilla de la situación elegida", "Desplegable Plantilla… en cualquier sesión del equipo; Actualizar guarda cambios sobre ella"],
    ],
  },
  {
    type: "callout",
    variant: "tip",
    content:
      "Para una fila de conos: coloca uno, ajusta tamaño y color, selecciónalo y pulsa Duplicar las veces que necesites. Para el arco del otro lado: colócalo y pulsa +90° dos veces.",
  },
];
