/**
 * Contenido para Sportbot / Centro de Ayuda — versión ACADEMIAS del manual
 * docs/manuales/academias/mesociclo-mes-siguiente.pdf (2026-10-02).
 *
 * Cómo usarlo: REEMPLAZA el artículo existente con slug "planes-entrenamiento"
 * en bff/src/data/help-articles.ts (mismo slug, para no romper enlaces). El
 * actual describe "Entrenamiento → Planes → Nuevo plan", que no es la pantalla
 * real: los planes por equipo son el mesociclo de "Sesiones de Entrenamiento".
 */
import type { HelpArticle } from "../../../bff/src/data/help-articles";

export const planesEntrenamiento: HelpArticle = {
  slug: "planes-entrenamiento",
  categoryId: "operacion-diaria",
  title: "Mesociclo del mes y sesiones por día",
  excerpt:
    "Crea el mesociclo del mes siguiente sin perder el anterior, carga la sesión de cualquier día de la semana (también fines de semana) y recupera sesiones que no aparecían.",
  readTime: "4 min",
  targetRole: ["coach", "school"],
  body: [
    {
      type: "p",
      content:
        "El mesociclo es el plan del mes de una categoría: fechas, objetivo, modelo de juego y sus 4 semanas. Dentro de cada semana cargas las sesiones día por día.",
    },
    {
      type: "callout",
      variant: "info",
      content: "Menú lateral → Sesiones de Entrenamiento (Métricas y Rendimiento) → elige tu categoría",
    },
    { type: "h2", content: "Crear el mesociclo del mes siguiente" },
    {
      type: "ol",
      items: [
        "Abre la categoría. Arriba ves su mesociclo con fechas y objetivo.",
        "Pulsa 'Nuevo mesociclo'. Está siempre, aunque la categoría ya tenga el del mes pasado.",
        "Revisa las fechas: el inicio viene el día siguiente al cierre del mes anterior y el fin 4 semanas después. También vienen el número de sesiones, la duración y el modelo de juego del mes anterior.",
        "Escribe el objetivo del mes y pulsa 'Crear Mesociclo'. Las 4 semanas se generan solas.",
      ],
    },
    {
      type: "callout",
      variant: "tip",
      content:
        "Con más de un mesociclo aparece un selector debajo del título. Por defecto se abre el mes en curso (o el próximo, si todavía no empezó); desde ahí vuelves al anterior para ver su cierre o exportar su PDF.",
    },
    {
      type: "callout",
      variant: "warning",
      content:
        "Un mes no se puede cruzar con otro de la misma categoría: si eliges fechas que pisan el mes anterior, la app te avisa y no lo crea.",
    },
    { type: "h2", content: "Cargar la sesión de cualquier día" },
    {
      type: "ol",
      items: [
        "Abre la semana: aparecen todos sus días, también sábado y domingo.",
        "En el día que quieres, pulsa '+ Crear sesión'.",
        "La fecha ya viene puesta. Escribe el objetivo y, si quieres, calentamiento, ejercicios, materiales y notas.",
        "Pulsa 'Crear Sesión'. El día queda como Entrenamiento con la sesión debajo.",
      ],
    },
    {
      type: "ul",
      items: [
        "¿Dos sesiones el mismo día (gimnasio y cancha)? 'Agregar otra' en ese día.",
        "¿Partido, descanso, regenerativo o activación? 'Agregar día' al final de la semana, con su intensidad planeada. Los días de descanso no ofrecen crear sesión.",
      ],
    },
    { type: "h2", content: "Sesiones que no aparecían" },
    {
      type: "p",
      content:
        "Si creaste una sesión antes de crear el mesociclo del mes, quedó guardada pero sin día del plan. Ahora aparece en su fecha, en color durazno, con el botón 'Enganchar': un toque y queda en su día. Las sesiones sueltas que no caen en el mes que estás viendo salen abajo, en 'Sesiones sin semana'.",
    },
    {
      type: "callout",
      variant: "warning",
      content:
        "Si ves dos sesiones sueltas iguales el mismo día, puede ser la misma guardada dos veces. Ábrelas antes de engancharlas.",
    },
    {
      type: "table",
      headers: ["Quieres…", "Cómo"],
      rows: [
        ["Planear el mes siguiente", "'Nuevo mesociclo' en la categoría"],
        ["Ver el mes anterior", "Selector debajo del título del mesociclo"],
        ["Cargar la sesión del domingo", "Semana → día → '+ Crear sesión'"],
        ["Recuperar una sesión que no se veía", "'Enganchar' en su día"],
        ["Borrar un mesociclo mal creado", "'Eliminar' (las sesiones no se borran: quedan en 'Sesiones sin semana')"],
      ],
    },
    {
      type: "p",
      content:
        "Si no ves 'Nuevo mesociclo' o todos los días de la semana, cierra la app o la pestaña del navegador y vuelve a abrirla.",
    },
  ],
  related: ["evaluaciones-jugadores", "tomar-asistencia-coach"],
};
