/**
 * Reemplazo propuesto para el artículo `tomar-asistencia-coach` en
 * `bff/src/data/help-articles.ts` (líneas ~677-726 en la versión leída para
 * armar esto). NO está aplicado — este archivo es el snippet listo para
 * pegar, tal como pide el patrón por defecto (`feedback_pdf_manual_template`,
 * política "solo el contenido, listo para pegar" salvo que se pida cargarlo
 * directo en código).
 *
 * Por qué se reemplaza en vez de crear un slug nuevo: el artículo actual dice
 * "editable 24h después de finalizada" (falso — son 7 días para coach, sin
 * tope para admin/owner/super_admin) y no menciona ni Excusado, ni el
 * escaneo de carnet, ni el descuento/devolución de créditos, ni el
 * torniquete. Se reemplaza completo el `body`, se deja el mismo `slug`,
 * `categoryId` y `related` para no romper los artículos que ya lo referencian
 * (calendario-reservas, planes-entrenamiento, evaluaciones-jugadores,
 * encuestas-asistencia, reportes-financieros-asistencia).
 *
 * Cómo aplicar: en bff/src/data/help-articles.ts, ubicar el objeto con
 * `slug: "tomar-asistencia-coach"` (dentro del array exportado) y reemplazar
 * su campo `body` (y opcionalmente `excerpt`/`readTime`) por lo de abajo.
 */

import type { ContentBlock } from "../help-articles"; // ajustar el import relativo al pegar

export const tomarAsistenciaCoachBody: ContentBlock[] = [
  {
    type: "p",
    content:
      "SportMaps registra la asistencia de tres formas distintas — según cómo llegue el atleta. Esta guía cubre las tres, en el orden en que se usan normalmente.",
  },
  { type: "h2", content: "1. Lista manual por equipo o plan (la más usada)" },
  {
    type: "p",
    content:
      "Desde Asistencias, elegís el equipo o plan (o SportMaps auto-selecciona la sesión del día si solo hay una). La lista carga con todos los atletas en Presente por defecto — solo tenés que destildar a quien no vino, en vez de tocar a cada uno.",
  },
  {
    type: "ol",
    items: [
      "Abrí Asistencias y elegí el equipo o plan",
      "La lista carga con todos en Presente",
      "Tocá el estado que corresponda a cada excepción: Ausente, Tarde o Excusado",
      "Guardá asistencia",
      "(Opcional) Finalizá la sesión cuando termines",
    ],
  },
  {
    type: "table",
    headers: ["Estado", "Qué significa"],
    rows: [
      ["Presente", "Vino a la sesión. Es el estado por defecto."],
      ["Ausente", "No vino. Si venía de Presente, se le devuelve el crédito."],
      ["Tarde", "Vino, pero después de empezada la sesión."],
      ["Excusado", "No vino, con una razón que la escuela acepta (no cuenta igual que un Ausente sin más para las alertas de riesgo)."],
    ],
  },
  {
    type: "callout",
    variant: "info",
    content:
      "Marcar Presente (viniendo de otro estado) descuenta una clase del plan del atleta, o usa una reserva del mismo día si ya la tenía (ahí no se descuenta doble). Si el plan está vencido o sin clases disponibles, la asistencia se registra igual — nunca se bloquea la lista por eso — y el padre recibe el aviso.",
  },
  { type: "h3", content: "Corregir un día anterior" },
  {
    type: "p",
    content:
      "El campo 'Día de la lista' permite retroceder la fecha. Un coach puede retroceder hasta 7 días; un admin, owner o super_admin no tiene tope. Las fechas futuras siempre se rechazan.",
  },
  { type: "h3", content: "Finalizar y reabrir" },
  {
    type: "p",
    content:
      "Al finalizar una sesión, cualquier atleta con inscripción activa que no quedó con ningún registro se marca automáticamente como Ausente, y se notifica al padre (o al atleta si es adulto). Si un atleta acumula ausencias seguidas hasta cruzar un umbral (2 por defecto, configurable por la escuela), se avisa al dueño de la escuela. Si algo quedó mal marcado, 'Reabrir para corregir' desbloquea la sesión con la misma regla de 7 días / sin tope.",
  },
  {
    type: "callout",
    variant: "warning",
    content:
      "Corrección importante: antes decíamos que una sesión finalizada quedaba editable por 24 horas. Eso no es así — el límite real es 7 días para coach, y sin tope para admin, owner o super_admin.",
  },
  { type: "h2", content: "2. Escaneo del carnet digital (QR)" },
  {
    type: "p",
    content:
      "Es una capa rápida sobre la lista manual, no un reemplazo: sirve para marcar Presente en el momento en que el atleta llega, sin abrir la lista completa. Desde Asistencias, tocá 'Escanear carnet' y apuntá la cámara al QR del carnet digital de cada atleta — no hace falta elegir equipo antes, el carnet ya sabe a cuál pertenece.",
  },
  {
    type: "ul",
    items: [
      "Solo marca Presente — nunca Ausente ni Tarde, y nunca toca una sesión ya finalizada",
      "El carnet debe estar activo (no revocado ni vencido) y el atleta debe tener inscripción activa",
      "Si el equipo tiene más de un bloque de sesión el mismo día, el sistema no adivina: rechaza el check-in en vez de elegir mal",
      "Escanear el mismo carnet dos veces para la misma sesión es seguro — no descuenta el crédito dos veces",
      "Es solo en vivo: no admite fechas retroactivas",
    ],
  },
  { type: "h2", content: "3. Automático por torniquete de acceso (si tu escuela lo tiene)" },
  {
    type: "p",
    content:
      "Si tu escuela tiene instalado un torniquete biométrico de control de acceso, la asistencia se registra sola cuando el atleta entra: no hay pantalla ni botón, es 100% automático. Al pasar por el torniquete (evento de entrada), si el sistema resuelve al atleta con una inscripción activa, se marca Presente con la misma lógica que el escaneo de carnet.",
  },
  {
    type: "callout",
    variant: "tip",
    content:
      "Si un atleta aparece 'presente' sin que nadie de la escuela lo haya marcado, casi siempre es esto: entró por el torniquete y el sistema lo resolvió solo. No es un error. El acceso físico (si la puerta se abre o no) y el registro de asistencia son decisiones independientes — una nunca bloquea a la otra.",
  },
];

/* Snippet completo del objeto HelpArticle, por si se prefiere reemplazar el bloque entero: */
export const tomarAsistenciaCoachArticle = {
  slug: "tomar-asistencia-coach",
  categoryId: "operacion-diaria",
  title: "Cómo tomar asistencia (lista manual, carnet QR y torniquete)",
  excerpt:
    "Las tres formas reales en que SportMaps registra asistencia: lista manual por equipo/plan, escaneo del carnet digital, y check-in automático por torniquete.",
  readTime: "4 min",
  targetRole: ["coach", "school"],
  body: tomarAsistenciaCoachBody,
  related: ["calendario-reservas", "reportes-financieros-asistencia"],
};
