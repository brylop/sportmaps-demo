/**
 * Artículo NUEVO para `bff/src/data/help-articles.ts` (Mapi / Centro de
 * Ayuda). Slug nuevo `torneos-internos-inscribir-atleta`: no reemplaza ninguno
 * (el corpus solo tiene «Delegaciones», que es el flujo de torneos EXTERNOS).
 *
 * Cómo aplicar: pegar el objeto de abajo dentro del array exportado de
 * help-articles.ts (categoría `operacion-diaria`). El import de tipos es solo
 * para que este archivo compile suelto; al pegar, sobra.
 */

import type { HelpArticle } from "../help-articles"; // ajustar al pegar

export const torneosInternosInscribirAtleta: HelpArticle = {
  slug: "torneos-internos-inscribir-atleta",
  categoryId: "operacion-diaria",
  title: "Torneos internos: inscribir atletas desde la escuela",
  excerpt:
    "Cómo crear un torneo de tu escuela, gratis o con costo, y usar «Inscribir atleta» para anotar a tus deportistas sin esperar a las familias.",
  readTime: "5 min",
  targetRole: ["school"],
  body: [
    {
      type: "p",
      content:
        "En un torneo interno compiten solo los equipos de tu escuela. Con el botón «Inscribir atleta» tú mismo anotas a un deportista: la inscripción queda confirmada al instante y la familia recibe un aviso. Lo hace el owner o un administrador; el entrenador no puede inscribir.",
    },
    { type: "h2", content: "Antes de empezar" },
    {
      type: "ul",
      items: [
        "El módulo de Torneos tiene que estar activo (si no, «Crear torneo» muestra «Módulo de Torneos no activo»; se solicita desde Mi Plan).",
        "El torneo debe ser interno, tener al menos una categoría y estar publicado. Mientras sea borrador, el botón «Inscribir atleta» está apagado.",
        "Solo aparecen los deportistas activos registrados en tu escuela.",
      ],
    },
    { type: "h2", content: "Crear el torneo: gratis o con costo" },
    {
      type: "ol",
      items: [
        "Ve a Mis Torneos → Crear torneo.",
        "En «Alcance» elige «Interno (mis propios equipos)». La visibilidad pasa sola a «Solo mi escuela».",
        "En «Cobro de la inscripción», el interruptor «El torneo tiene costo» viene encendido. Si es gratis, apágalo: no se pide valor ni medios de pago y inscribir nunca genera cobro.",
        "Si tiene costo, marca los medios de pago que aceptas (solo aparecen los que ya configuraste en los datos de pago; «Efectivo» siempre está) y escribe el valor de la inscripción.",
        "Completa título, deporte, fecha, cierre de inscripciones (opcional), hora, dirección y ciudad, y pulsa «Crear torneo». Queda como borrador.",
        "Abre el torneo, entra a «Categorías y Precios», agrega al menos una categoría (por ejemplo «Sub 12»), guarda y pulsa «Publicar».",
      ],
    },
    {
      type: "callout",
      variant: "warning",
      content:
        "La tarifa de un torneo con costo vale hasta el cierre de inscripciones (o hasta la fecha del torneo si no pusiste cierre). Pasada esa fecha ya no se puede inscribir hasta que alargues «Válida hasta» en «Categorías y Precios».",
    },
    { type: "h2", content: "Usar el modal «Inscribir atleta»" },
    {
      type: "ol",
      items: [
        "Abre el torneo y entra a la pestaña «Inscritos». Pulsa «Inscribir atleta» (arriba a la derecha).",
        "El encabezado te recuerda qué va a pasar: «El torneo es gratis: no se cobra» o «Se crea el cobro al acudiente».",
        "Elige la categoría. Cada clic en «Inscribir» usa la categoría que esté elegida en ese momento.",
        "Escribe parte del nombre en «Buscar atleta» (no importan tildes ni mayúsculas) y pulsa «Inscribir» en la fila del deportista.",
        "Aparece un aviso: «quedó inscrito» (y, en un torneo con costo, «se creó el cobro al acudiente»). El modal sigue abierto para inscribir a más deportistas; ciérralo con la X.",
      ],
    },
    {
      type: "callout",
      variant: "info",
      content:
        "Si inscribes dos veces al mismo deportista en la misma categoría no se duplica nada: sale «Ya estaba inscrito», no se avisa otra vez a la familia ni se crea otro cobro. El modal no marca a quien ya está inscrito; míralo en la pestaña «Inscritos».",
    },
    {
      type: "callout",
      variant: "warning",
      content:
        "En un torneo con costo, un deportista sin acudiente asignado aparece con «Sin acudiente: asígnalo primero» y su botón queda apagado, porque el cobro necesita a quién cobrarle. Asígnale el acudiente desde su ficha en Deportistas. En un torneo gratis no hace falta acudiente.",
    },
    { type: "h2", content: "Qué pasa después" },
    {
      type: "table",
      headers: ["Quién", "Qué ocurre"],
      rows: [
        ["La inscripción", "Queda aprobada de inmediato; nadie tiene que revisarla."],
        ["La familia", "Recibe el aviso «Inscribieron a tu deportista en un torneo». En un torneo con costo, el aviso indica que tiene un cobro pendiente en Mis pagos."],
        ["El cobro", "Solo si el torneo tiene costo: «Inscripción torneo — (nombre) — (categoría)», pendiente, a nombre del acudiente."],
        ["Pago en efectivo", "Si el único medio es «Efectivo», la app no registra el pago sola: regístralo en Pagos cuando la familia pague en la escuela."],
        ["Etiquetas en Inscritos", "«Sin cobro» (torneo gratis), «Pendiente» (cobro sin pagar) o «Pagado»."],
        ["Armar equipos", "En «Sin equipo», marca a los inscritos, escribe el nombre del equipo y pulsa «Crear equipo»."],
      ],
    },
    { type: "h2", content: "Si algo falla" },
    {
      type: "table",
      headers: ["Lo que ves", "Qué hacer"],
      rows: [
        ["«Inscribir atleta» apagado", "El torneo sigue en borrador: agrega una categoría y publícalo."],
        ["«No hay una tarifa vigente configurada para este torneo todavía»", "La fecha límite de la tarifa ya pasó: en «Categorías y Precios» cambia «Válida hasta» a una fecha futura y guarda."],
        ["«El atleta está inactivo»", "Reactívalo en Deportistas si debe competir."],
        ["«No autorizado: este torneo no es de tu escuela»", "Entra con la cuenta del owner o de un administrador."],
        ["«Módulo de Torneos no activo»", "Solicítalo desde Mi Plan."],
        ["Un deportista no aparece en la lista", "Revisa que esté activo y que sea de tu escuela."],
      ],
    },
  ],
  related: [],
};
