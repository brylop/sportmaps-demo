/**
 * Artículo NUEVO listo para pegar en `bff/src/data/help-articles.ts`, sacado de
 * la versión academias de `dreamers-familias.pdf`. NO está aplicado
 * (patrón por defecto de feedback_pdf_manual_template: solo el contenido).
 *
 * Es genérico: no nombra a Dreamers ni pone montos, porque el Centro de Ayuda lo
 * ven todas las escuelas. Las reglas propias de Dreamers (corte, gracia, 5 %,
 * inscripción y seguro, cuentas) quedan solo en el PDF.
 *
 * No hay hoy un slug sobre banco de horas ni torniquete para familias (grep de
 * "banco de horas" en help-articles.ts: 0 resultados), así que no reemplaza nada.
 * Cómo aplicar: agregar el objeto al array exportado de artículos.
 */

import type { HelpArticle } from "../help-articles"; // ajustar el import relativo al pegar

export const bancoDeHorasFamiliasArticle: HelpArticle = {
  slug: "banco-de-horas-familias",
  categoryId: "para-padres-atletas",
  title: "Banco de horas: agendar clases, entrar con el torniquete y pagar",
  excerpt:
    "Cómo ver las horas del plan de tu hijo/a, agendar una clase, cómo se descuentan las horas en el torniquete y cómo pagar la mensualidad con comprobante.",
  readTime: "5 min",
  targetRole: ["parent"],
  body: [
    {
      type: "p",
      content:
        "Si la escuela trabaja con banco de horas, cada plan trae un número de horas para el mes. Las ves en Mis Inscripciones, se reservan al agendar y se descuentan con las marcas del torniquete.",
    },
    { type: "h2", content: "1. Ver las horas del mes" },
    {
      type: "ol",
      items: [
        "Abre Mis Inscripciones en el menú.",
        "Arriba a la derecha, toca el nombre de tu hijo/a.",
        "Debajo de la tarjeta del plan está el Banco de horas: disponibles, incluidas, reservadas (clases agendadas que aún no pasan) y consumidas (las que registró el torniquete).",
      ],
    },
    {
      type: "callout",
      variant: "info",
      content: "El banco se reinicia el día 1 de cada mes. Las horas que no se usan no pasan al mes siguiente.",
    },
    { type: "h2", content: "2. Agendar una clase" },
    {
      type: "ol",
      items: [
        "En Mis Inscripciones, toca la tarjeta del plan («Toca para gestionar clases»).",
        "Elige Por bloque (la duración estándar del plan) o Sesión personalizada (tú eliges cuántas horas).",
        "Toca un día en verde, elige el horario con la coach y pulsa Agendar.",
        "Revisa el resumen y pulsa Confirmar. La clase aparece en Clases programadas y te llega una notificación.",
      ],
    },
    {
      type: "callout",
      variant: "warning",
      content:
        "Si dice «El plan ha expirado», la mensualidad no está pagada o el plan venció: al pagar se habilita. Si no alcanzan las horas, elige una sesión más corta o habla con la escuela.",
    },
    { type: "h2", content: "3. Cómo se descuentan las horas en el torniquete" },
    {
      type: "p",
      content:
        "Tu hijo/a marca con huella o PIN al entrar y al salir. Con esas dos marcas se calcula el tiempo. La escuela configura unos minutos de gracia al llegar y al salir que no se cuentan, y puede contar el tiempo extra en horas enteras.",
    },
    {
      type: "ul",
      items: [
        "Si sale y vuelve a entrar a los pocos minutos, sigue siendo la misma visita.",
        "Si olvida marcar la salida, la visita se cierra sola y la escuela confirma la hora real.",
        "Si en el mes usa más horas de las del plan, la escuela puede cobrar la diferencia.",
      ],
    },
    { type: "h2", content: "4. Pagar la mensualidad con comprobante" },
    {
      type: "ol",
      items: [
        "Abre Pagos. Cada cobro pendiente tiene su botón Pagar.",
        "Verás las cuentas y el QR de la escuela. Transfiere el valor exacto desde tu banco o billetera.",
        "En «Sube tu comprobante» elige la foto o el PDF y pulsa Pagar.",
        "El cobro queda Por validar hasta que la escuela lo aprueba; te llega una notificación cuando cambia a Aprobado.",
      ],
    },
    {
      type: "callout",
      variant: "tip",
      content:
        "Para que lo aprueben rápido: un comprobante por cobro, con el valor, la fecha y la referencia legibles. Con Nuevo Pago puedes adelantar un mes, y con Estado de cuenta ves lo facturado y pagado de los últimos 12 meses.",
    },
  ],
  related: ["inscripcion-padre-paso-a-paso"],
};
