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
    "Cómo crear un torneo de tu escuela (o convertir un cobro del catálogo en torneo), gratis o con costo, y usar «Inscribir atleta» para anotar a hijos y atletas adultos sin esperar a las familias.",
  readTime: "6 min",
  targetRole: ["school"],
  body: [
    {
      type: "p",
      content:
        "En un torneo interno compiten solo los equipos de tu escuela. Con el botón «Inscribir atleta» tú mismo anotas a un deportista, hijo o atleta adulto: la inscripción queda confirmada al instante y se avisa a la familia (o al propio atleta adulto). Lo hace el owner o un administrador; el entrenador no puede inscribir.",
    },
    { type: "h2", content: "Antes de empezar" },
    {
      type: "ul",
      items: [
        "El módulo de Torneos tiene que estar activo (si no, «Crear torneo» muestra «Módulo de Torneos no activo»; se solicita desde Mi Plan).",
        "El torneo debe ser interno, tener al menos una categoría y estar publicado. Mientras sea borrador, el botón «Inscribir atleta» está apagado.",
        "Aparecen los hijos y los atletas adultos activos registrados en tu escuela.",
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
        "La tarifa de un torneo con costo vale hasta el cierre de inscripciones (o hasta la fecha del torneo si no pusiste cierre). Pasada esa fecha las familias ya no pueden inscribirse solas, pero tú sí puedes seguir inscribiendo (se usa la última tarifa configurada). Si pones un cupo, nadie podrá inscribirse más allá de ese número: súbelo en la pestaña Info si hace falta.",
    },
    { type: "h2", content: "Si el cobro ya está en el catálogo" },
    {
      type: "ol",
      items: [
        "Ve a Pagos → Config → «Cobros sueltos». Cada cobro de tipo Torneo muestra «Crear en Torneos» y «Vincular…».",
        "«Crear en Torneos» abre «Crear torneo» ya prellenado con el nombre, el valor, el cupo y la fecha del cobro (torneo interno). Completa deporte, dirección y ciudad y guarda: el torneo queda como borrador y vinculado al cobro.",
        "«Vincular…» enlaza el cobro con un torneo interno que ya exista y que todavía no tenga cobro: un torneo = un cobro.",
        "Un cobro vinculado ya no se vende como cobro suelto (ni en el pago del padre ni por WhatsApp): se paga inscribiendo en el torneo, así nadie paga dos veces. El ícono de cadena rota lo desvincula.",
      ],
    },
    {
      type: "callout",
      variant: "warning",
      content:
        "Si una familia ya pagó ese cobro como cobro suelto antes de vincularlo, ese pago no se convierte en inscripción: inscribe al deportista en el torneo y revisa que no se le cobre dos veces.",
    },
    { type: "h2", content: "Usar el modal «Inscribir atleta»" },
    {
      type: "ol",
      items: [
        "Abre el torneo y entra a la pestaña «Inscritos». Pulsa «Inscribir atleta» (arriba a la derecha).",
        "El encabezado te recuerda qué va a pasar: «El torneo es gratis: no se cobra» o «Se crea el cobro al acudiente».",
        "Elige la categoría. Cada clic en «Inscribir» usa la categoría que esté elegida en ese momento.",
        "Escribe parte del nombre en «Buscar atleta» (no importan tildes ni mayúsculas) y pulsa «Inscribir» en la fila del deportista. Los atletas adultos llevan la etiqueta «Adulto».",
        "Aparece un aviso: «quedó inscrito» (y, en un torneo con costo, «se creó el cobro al acudiente»). El modal sigue abierto para inscribir a más deportistas; ciérralo con la X.",
      ],
    },
    {
      type: "callout",
      variant: "info",
      content:
        "Quien ya está inscrito en la categoría elegida aparece con «Ya inscrito en esta categoría» y su botón apagado. Si lo repites desde otra pantalla no se duplica nada: sale «Ya estaba inscrito», no se avisa otra vez ni se crea otro cobro.",
    },
    {
      type: "callout",
      variant: "warning",
      content:
        "En un torneo con costo, un hijo sin acudiente asignado aparece con «Sin acudiente: asígnalo primero» y su botón queda apagado, porque el cobro necesita a quién cobrarle. Asígnale el acudiente desde su ficha en Deportistas. En un torneo gratis no hace falta acudiente, y un atleta adulto siempre puede inscribirse: él mismo paga.",
    },
    { type: "h2", content: "Qué pasa después" },
    {
      type: "table",
      headers: ["Quién", "Qué ocurre"],
      rows: [
        ["La inscripción", "Queda aprobada de inmediato; nadie tiene que revisarla."],
        ["La familia o el atleta adulto", "Recibe el aviso «Inscribieron a tu deportista en un torneo». En un torneo con costo, el aviso indica que tiene un cobro pendiente en Mis pagos."],
        ["El cobro", "Solo si el torneo tiene costo: «Inscripción torneo — (nombre) — (categoría)», pendiente, a nombre del acudiente (o del propio atleta si es adulto). Suma como ingreso de Torneo en Finanzas."],
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
        ["«El torneo llegó a su cupo (N)…»", "Ya hay tantos inscritos como el cupo: súbelo en la pestaña Info y guarda."],
        ["«Ese torneo ya está vinculado a otro cobro»", "Un torneo solo puede tener un cobro del catálogo: desvincula el otro o elige otro torneo."],
        ["«El atleta está inactivo» o «Ese atleta no pertenece a esta escuela o está inactivo»", "Reactívalo en Deportistas si debe competir."],
        ["«No autorizado: este torneo no es de tu escuela»", "Entra con la cuenta del owner o de un administrador."],
        ["«Módulo de Torneos no activo»", "Solicítalo desde Mi Plan."],
        ["Un deportista no aparece en la lista", "Revisa que esté activo y que sea de tu escuela."],
      ],
    },
  ],
  related: [],
};
