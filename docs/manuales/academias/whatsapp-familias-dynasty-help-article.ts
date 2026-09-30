/**
 * Artículo NUEVO para `bff/src/data/help-articles.ts` (Sportbot / Centro de
 * Ayuda). Slug nuevo `whatsapp-asistente-familias`: no reemplaza ninguno
 * (ningún slug existente habla del asistente de WhatsApp para acudientes).
 *
 * Es la versión genérica del PDF `whatsapp-familias-dynasty.pdf`: no nombra a
 * la escuela ni su número, porque el Centro de Ayuda lo ven todas.
 *
 * Cómo aplicar: pegar el objeto de abajo dentro del array exportado de
 * help-articles.ts (categoría `para-padres-atletas`). El import de tipos es
 * solo para que este archivo compile suelto; al pegar, sobra.
 */

import type { HelpArticle } from "../help-articles"; // ajustar al pegar

export const whatsappAsistenteFamilias: HelpArticle = {
  slug: "whatsapp-asistente-familias",
  categoryId: "para-padres-atletas",
  title: "WhatsApp de tu escuela: consultar pagos y enviar comprobantes",
  excerpt:
    "Cómo usar el asistente automático del WhatsApp de la escuela: te reconoce por tu número, te dice cuánto debes, cómo pagar, registra tu comprobante y te pasa con una persona cuando hace falta.",
  readTime: "4 min",
  targetRole: ["parent"],
  body: [
    {
      type: "p",
      content:
        "Si tu escuela activó el asistente de WhatsApp, le escribes al mismo número de siempre y te contesta primero un asistente automático, a cualquier hora. Cuando algo se sale de lo que puede resolver, te pasa con una persona de la escuela en el mismo chat.",
    },
    { type: "h2", content: "Qué puedes hacer por el chat" },
    {
      type: "ul",
      items: [
        "Consultar tus pagos: qué debes, qué está en revisión y qué ya quedó confirmado.",
        "Saber cómo pagar: las cuentas de la escuela y el enlace para pagar en línea.",
        "Enviar la foto o el PDF del comprobante para que quede registrado en tu pago.",
        "Preguntar por la sede, las categorías y los horarios de entrenamiento.",
        "Recibir recordatorios de pago y avisos de tu atleta, si los activas.",
        "Hablar con una persona de la escuela.",
      ],
    },
    { type: "h2", content: "Tu primer mensaje" },
    {
      type: "p",
      content:
        "Escribe «Hola». No te pide contraseña ni código: te reconoce por el número de celular registrado en tu cuenta de acudiente.",
    },
    {
      type: "ul",
      items: [
        "Si te reconoce, te pregunta si quieres recibir avisos por ahí. Responde SÍ para activarlos.",
        "Si tu número está en la escuela pero no tienes cuenta, te manda un enlace para crearla. Usa el mismo correo que viene escrito en el formulario y, cuando termines, vuelve a escribir «Hola».",
        "Si tu número aparece en dos cuentas, no muestra datos y le avisa a la escuela para que lo corrija contigo.",
      ],
    },
    {
      type: "callout",
      variant: "tip",
      content:
        "Escribe desde el celular que diste a la escuela. Si escribes desde otro número, el asistente no te va a reconocer.",
    },
    { type: "h2", content: "Consultar pagos y cómo pagar" },
    {
      type: "p",
      content:
        "Escribe «cuánto debo» o «mis pagos» y te muestra lo pendiente con su fecha de vencimiento y lo resuelto en los últimos 60 días. Escribe «cómo pago» y te da las cuentas de la escuela, el enlace a Mis Pagos para pagar en línea, y te recuerda que puedes mandar el comprobante por el chat.",
    },
    {
      type: "table",
      headers: ["Estado", "Qué significa"],
      rows: [
        ["Pendiente", "Todavía no se ha pagado."],
        ["Comprobante en revisión", "Mandaste el soporte y la escuela lo está revisando."],
        ["Pagado y confirmado por la escuela", "No debes nada de ese cobro."],
        ["Rechazado", "La escuela no pudo validar el comprobante; te dice el motivo."],
      ],
    },
    { type: "h2", content: "Enviar el comprobante" },
    {
      type: "ol",
      items: [
        "Manda una foto clara o el PDF del comprobante, donde se vean el valor, la fecha, la cuenta de destino y el número de aprobación.",
        "El asistente lo aplica a tu cobro y te dice a cuál. Si tienes varios pendientes, te pregunta a cuál va: respóndele con el número, o «ninguno» si no sabes.",
        "Cuando la escuela lo confirma, te llega el aviso por el mismo chat. Si no lo pudo validar, te dice por qué para que mandes el correcto.",
      ],
    },
    {
      type: "callout",
      variant: "warning",
      content:
        "Cada comprobante se aplica a un solo cobro. Si una transferencia cubre dos meses, escríbele a la escuela para que la reparta. Si el comprobante muestra una cuenta que no es de la escuela, el asistente te avisa: revisa la llave o el número antes de volver a transferir.",
    },
    { type: "h2", content: "Hablar con una persona" },
    {
      type: "p",
      content:
        "Escribe «quiero hablar con una persona», o pregunta algo que el asistente no pueda resolver (inscripciones nuevas, cambios de categoría, descuentos, uniformes, torneos). Te pasa con la escuela y, si es fuera del horario de atención, te dice cuándo te responden. El asistente no escucha notas de voz ni ve videos: escríbele el mensaje.",
    },
    { type: "h2", content: "Activar o apagar los avisos" },
    {
      type: "table",
      headers: ["Escribe", "Qué pasa"],
      rows: [
        ["SÍ (cuando te lo pregunta)", "Activa los recordatorios de pago y los avisos de tu atleta."],
        ["STOP o baja", "Deja de enviarte mensajes automáticos. Igual puedes seguir preguntando."],
        ["ACTIVAR", "Vuelve a prender los avisos."],
      ],
    },
    {
      type: "callout",
      variant: "info",
      content:
        "El asistente solo muestra información de tu familia, y solo cuando escribes desde el celular registrado. Nunca te va a pedir tu contraseña ni datos de tarjetas.",
    },
  ],
  related: ["registrar-pago-manual"],
};
