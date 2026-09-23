/**
 * Artículo NUEVO para `bff/src/data/help-articles.ts` (Sportbot / Centro de
 * Ayuda). Slug nuevo `calendario-equipos-familias`: no reemplaza ninguno.
 *
 * Por qué no se toca `calendario-reservas`: ese artículo habla del calendario
 * de reservas de canchas e instalaciones; este es el calendario de EVENTOS por
 * equipo (entrenamientos, partidos, avisos) y cómo lo ven las familias. Son
 * dos cosas distintas y conviene que el bot las distinga.
 *
 * Cómo aplicar: pegar el objeto de abajo dentro del array exportado de
 * help-articles.ts (categoría `operacion-diaria`). El import de tipos es solo
 * para que este archivo compile suelto; al pegar, sobra.
 */

import type { HelpArticle } from "../help-articles"; // ajustar al pegar

export const calendarioEquiposFamilias: HelpArticle = {
  slug: "calendario-equipos-familias",
  categoryId: "operacion-diaria",
  title: "Calendario por equipos: publicar entrenamientos y partidos para las familias",
  excerpt:
    "Cómo el coach o la administración publica un evento para una categoría o para toda la escuela, y cómo lo ven los papás en su Calendario Familiar.",
  readTime: "4 min",
  targetRole: ["school", "coach", "parent"],
  body: [
    {
      type: "p",
      content:
        "Desde Calendario, el coach (o el owner/admin) publica entrenamientos, partidos, reuniones y avisos. Cada evento se publica para una categoría, para toda la escuela o solo para quien lo crea. Lo que cambia entre las tres opciones es quién lo ve.",
    },
    { type: "h2", content: "Antes de empezar: cada equipo con su coach" },
    {
      type: "p",
      content:
        "El coach solo puede publicar para las categorías que tiene asignadas. Si una categoría no le aparece al crear un evento, el owner o un admin la revisa en Equipos y Planes → Mis Equipos y le asigna el coach. El owner y los admins ven todas las categorías de la escuela.",
    },
    { type: "h2", content: "Publicar un entrenamiento o un partido" },
    {
      type: "ol",
      items: [
        "Abre Calendario y pulsa Nuevo Evento (o selecciona primero el día en la cuadrícula).",
        "Escribe el título.",
        "En 'Para quién' elige la categoría, 'Toda la escuela' o 'Solo para mí'.",
        "Completa el tipo de evento, la fecha y hora de inicio y fin, y la ubicación.",
        "Pulsa Crear. La tarjeta muestra la etiqueta de la categoría: esa es la confirmación de que las familias lo van a ver.",
      ],
    },
    {
      type: "table",
      headers: ["Opción de 'Para quién'", "Quién lo ve", "Cuándo usarla"],
      rows: [
        ["Una categoría", "Las familias de ese equipo y el staff de la escuela", "Entrenamientos, partidos y citaciones de esa categoría"],
        ["Toda la escuela", "Todas las familias y todo el staff", "Reunión de padres, festivo sin entrenamiento, evento del club"],
        ["Solo para mí", "Nadie más", "Recordatorios personales del coach"],
      ],
    },
    {
      type: "callout",
      variant: "warning",
      content:
        "Un evento 'Solo para mí' no le llega a ningún papá. Si la intención es que las familias lo vean, tiene que ir a una categoría o a toda la escuela. Si el coach tiene una sola categoría, ya viene preseleccionada; si tiene varias, el formulario no deja guardar hasta elegir una.",
    },
    { type: "h2", content: "Corregir, mover a otro equipo o eliminar" },
    {
      type: "p",
      content:
        "Al pasar el mouse sobre la tarjeta aparece el lápiz (solo para quien creó el evento y para el owner/admin). Se abre el mismo formulario: cambiar 'Para quién' mueve el evento a otra categoría o a toda la escuela, y el botón Eliminar lo borra para todos, con confirmación. Si un partido se aplazó, es mejor editar la fecha que borrarlo y crear otro.",
    },
    {
      type: "callout",
      variant: "info",
      content:
        "Los eventos creados antes de esta actualización quedaron como 'Solo para mí', porque el formulario anterior no preguntaba el equipo. Abre cada evento futuro con el lápiz y elígele la categoría.",
    },
    { type: "h2", content: "Qué ve la familia" },
    {
      type: "p",
      content:
        "El acudiente entra con su cuenta y abre Calendario Familiar. Ve los eventos de las categorías donde tiene un hijo inscrito y los de toda la escuela, con hora, lugar, tipo y nombre de la categoría. Puede crear sus propios recordatorios, pero no puede editar ni borrar lo que publica la escuela.",
    },
    {
      type: "callout",
      variant: "tip",
      content:
        "Una familia que se inscribió por el QR y todavía debe el primer pago ya ve el calendario de su categoría. No hay que esperar a que pague para que sepa cuándo entrena.",
    },
    { type: "h2", content: "Si un papá no ve un evento" },
    {
      type: "ol",
      items: [
        "La tarjeta del evento no tiene etiqueta de equipo ni 'Toda la escuela': quedó 'Solo para mí'. El coach lo abre con el lápiz y elige la categoría.",
        "El hijo no está inscrito en esa categoría (en Deportistas aparece 'Sin equipo' o en otra): asígnale la categoría desde su ficha.",
        "El papá entra con otra cuenta distinta a la del acudiente registrado: debe usar el correo con el que se inscribió al hijo, o la escuela vincula el hijo a su cuenta.",
        "Está en otro mes del calendario: pulsa 'Hoy'.",
      ],
    },
    {
      type: "p",
      content:
        "Si un deportista se inscribió por el QR eligiendo una categoría sin plan y sin precio, la inscripción queda activa de inmediato y aparece en su categoría. Los que sí tienen un primer pago pendiente aparecen cuando la escuela aprueba ese pago.",
    },
  ],
  related: ["calendario-reservas", "tomar-asistencia-coach"],
};
