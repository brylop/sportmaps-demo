/**
 * Contenido para Mapi / Centro de Ayuda — versión ACADEMIAS del manual
 * docs/manuales/academias/guia-registro-pagos-manual.pdf (2026-10-17).
 *
 * Cómo usarlo: REEMPLAZA el `body` (y título/excerpt) del artículo existente con
 * slug "registrar-pago-manual" en bff/src/data/help-articles.ts (mismo slug, para
 * no romper los `related` de "configurar-wompi-pagos-online" y
 * "plantillas-recordatorios"). El actual describe el viejo modal «Registrar pago»
 * (un solo formulario Efectivo/Transferencia, "Guardar y confirmar", salda TODOS
 * los pendientes de una vez) y promete que el correo de confirmación sale solo:
 * nada de eso es el flujo de «Cobros y pagos».
 *
 * OJO: el modal nuevo está detrás de una bandera (VITE_COBROS_Y_PAGOS /
 * localStorage 'sportmaps:cobros-y-pagos'). No publicar este artículo hasta que
 * la bandera esté encendida para las escuelas; si no, Mapi describiría una
 * pantalla que aún no ven.
 */
import type { HelpArticle } from "../../../bff/src/data/help-articles";

export const registrarPagoManual: HelpArticle = {
  slug: "registrar-pago-manual",
  categoryId: "pagos-finanzas",
  title: "Cobros y pagos: registrar un pago por fuera, crear cobros y dar descuentos",
  excerpt:
    "Una sola ventana para anotar lo que la familia pagó en efectivo o transferencia, crear cobros nuevos (torneo, uniforme, mensualidad), aplicar descuentos con motivo, cobrarle lo mismo a un equipo y corregir lo que se pueda.",
  readTime: "8 min",
  targetRole: ["school"],
  body: [
    {
      type: "p",
      content:
        "«Cobros y pagos» es una sola ventana para todo lo que se hace con el dinero de un deportista: registrar lo que la familia ya pagó, crear cobros nuevos, aplicar descuentos con su motivo y cobrarle lo mismo a todo un equipo. Reemplaza al botón «Registrar pago» de antes.",
    },
    { type: "h2", content: "Dónde se abre" },
    {
      type: "table",
      headers: ["Desde", "Cómo"],
      rows: [
        ["Pagos", "Gestión de Pagos → botón «Cobros y pagos» (arriba a la derecha). Abre en blanco: eliges a quién."],
        ["Deportistas", "El lápiz de la fila → «Editar estado de cuenta». Abre con el deportista ya elegido y fijo. En el celular: tres puntos de la tarjeta → «Cobros y pagos»."],
        ["Equipos", "Mis Equipos → «Cobrar a este equipo». Abre en modo «Varios atletas» con el equipo elegido."],
      ],
    },
    {
      type: "callout",
      variant: "info",
      content:
        "Solo lo ven el dueño y los administradores de la escuela. El entrenador no registra dinero. El contador ve la pestaña «Operaciones», sin botones para anular.",
    },
    { type: "h2", content: "Registrar lo que una familia ya pagó" },
    {
      type: "ol",
      items: [
        "Elige el atleta: busca por nombre, acudiente o teléfono. «Atleta nuevo» crea uno y avisa si ya existe alguien parecido.",
        "En «Cobros pendientes · marca los que cubre» marca solo los cobros que la familia pagó. Un cobro con comprobante en revisión o con un pago en línea en curso sale bloqueado, con el motivo escrito.",
        "Al marcar un cobro aparece «Pagar» con el saldo completo (puedes escribir menos) y el botón «Descuento».",
        "Si pagó algo que aún no estaba cobrado, en «Nuevos cobros» pulsa «Agregar cobro»: tipo, detalle, valor y vencimiento (por defecto 10 días). Queda marcado «Pagar»; desmárcalo para dejarlo solo cobrado.",
        "A la derecha, «Ya lo pagaron» (encendido por defecto): elige Efectivo o Transferencia, la fecha del pago (hoy o anterior, nunca futura), una referencia opcional y, en transferencia, el comprobante opcional. «Se registran $X» suma todo lo marcado.",
        "Revisa la vista previa (se calcula sola unos segundos después de cada cambio; «Actualizar» la fuerza) y pulsa el botón principal.",
        "Sale «Listo» con el resumen. El pago aparece enseguida en Pagos → Historial como «Pagado».",
      ],
    },
    {
      type: "table",
      headers: ["Tipo de cobro", "Qué es"],
      rows: [
        ["Mensualidad", "La cuota del mes. Da vigencia y es la única que puede entrar en mora."],
        ["Inscripción, Seguro", "Se cobran una vez (el seguro no se repite si ya se cobró en los últimos 12 meses)."],
        ["Artículos / uniformes, Torneo, Clase extra, Vacacional, Viaje, Otro cobro", "Cobros únicos: no generan mora."],
        ["Horas adicionales", "El excedente del banco de horas. Solo lo cobra el dueño."],
      ],
    },
    { type: "h3", content: "El botón principal" },
    {
      type: "table",
      headers: ["El botón dice", "Qué hace"],
      rows: [
        ["Generar 1 · Pagar 2", "Crea 1 cobro nuevo y registra el pago de 2 cobros"],
        ["Generar 2", "Solo crea cobros; nadie pagó"],
        ["Registrar pago / Registrar pago (3)", "Solo registra el pago de 1 (o 3) cobros que ya existían"],
        ["Guardar descuentos", "Solo aplica descuentos o condonaciones, sin registrar pago"],
      ],
    },
    {
      type: "p",
      content:
        "Si está apagado, a la izquierda aparece el motivo: «Elige el atleta.», «Marca un cobro pendiente o agrega un cobro nuevo.» (arriba dice «Se registran $0.»), «Corrige lo marcado en rojo.» (un cobro nuevo sin valor, un descuento sin motivo, una fecha de pago futura o un vencimiento anterior a hoy) o «Calculando la vista previa…».",
    },
    {
      type: "callout",
      variant: "tip",
      content:
        "Los cobros nuevos no se avisan a la familia por correo ni WhatsApp (los ve en su app): la casilla «Avisar por correo/WhatsApp» viene apagada. Al registrar un pago, la familia recibe la notificación «Pago registrado» con el total.",
    },
    { type: "h2", content: "Descuentos, mora y «No cobrar»" },
    {
      type: "p",
      content:
        "Todo descuento exige motivo y queda registrado: quién lo aplicó, cuándo, con qué motivo y cuál era el valor original. Solo lo hace el dueño o un administrador; la familia ve el valor final, no el motivo.",
    },
    {
      type: "ul",
      items: [
        "Descuento en un cobro: valor + % o $ + motivo (Pronto pago, Varios meses juntos, Hermanos, Beca, Convenio, Cortesía, Ajuste de precio, Error de cobro u Otro). Se calcula sobre el valor sin recargo de mora y nunca deja el cobro por debajo de lo ya abonado.",
        "Descuento general (interruptor arriba a la derecha): reparte un solo descuento entre varios cobros; por defecto, los que no tienen descuento propio. Un % se aplica igual a cada cobro; un valor fijo se reparte en proporción a lo que vale cada uno.",
        "Condonar recargo: en un cobro vencido con recargo de mora aparece «Condonar recargo ($…)». Condona todo o la parte que escribas.",
        "«No cobrar»: exonera el cobro con motivo obligatorio. En una mensualidad queda pagada en $0 y cuenta para la vigencia; en un cobro único, el cobro se anula. Solo si nadie ha abonado.",
        "Pagar menos de lo que se debe: eliges «Abono — queda debiendo $X» o «Cerrar el cobro — los $X son descuento» (con motivo).",
      ],
    },
    { type: "h2", content: "Cobrarle lo mismo a varios atletas" },
    {
      type: "p",
      content:
        "Cambia a «Varios atletas» (o usa «Cobrar a este equipo»). En este modo la ventana solo genera cobros; para registrar pagos, abre un atleta.",
    },
    {
      type: "ol",
      items: [
        "¿A quiénes? Equipo, Categoría, Plan o A mano. Desmarca a quien no va.",
        "¿Qué se cobra? Tipo, detalle, valor y vencimiento: el mismo cobro para todos. «Descuento para todos» aplica el mismo % o valor.",
        "Revisa la vista previa: cuántos cobros se crean y «Se omiten N» con la razón (ya tiene la mensualidad de ese mes, seguro en los últimos 12 meses, ya tiene ese cobro creado hoy, no tiene inscripción activa…). Si algún atleta no tiene acudiente vinculado, puedes omitirlo.",
        "Pulsa «Generar N». Queda como una operación y cada familia recibe una sola notificación dentro de la app.",
      ],
    },
    {
      type: "callout",
      variant: "warning",
      content:
        "En el modo «Varios atletas» se omite a quien no tiene una inscripción activa, aunque lo hayas marcado a mano. Límites: 200 atletas y 600 cobros por lote; el vencimiento no puede ser anterior a hoy.",
    },
    { type: "h2", content: "Corregir un error: qué se puede y qué no" },
    {
      type: "table",
      headers: ["Quiero…", "¿Se puede?", "Cómo"],
      rows: [
        ["Cambiar un dato antes de confirmar", "Sí", "Todo se edita hasta pulsar el botón; «Cancelar» no guarda nada"],
        ["Deshacer cobros creados por error y que nadie ha pagado", "Sí", "Pagos → Operaciones → «Anular lote» (o desde la pantalla de resultado, apenas confirmas)"],
        ["Quitar un descuento de un cobro que sigue abierto", "Sí", "Operaciones → «Ver detalle» → «Quitar descuento», con motivo"],
        ["Rechazar un comprobante que no corresponde", "Sí", "Pagos → Cobros por Aprobar → «Rechazar»"],
        ["Cambiar monto, fecha o método de un pago ya registrado", "No existe todavía", "—"],
        ["Borrar o devolver un pago ya registrado", "No existe todavía", "—"],
        ["Cambiar el valor de un cobro ya creado", "No existe todavía", "Anular el lote y crear el cobro de nuevo"],
      ],
    },
    {
      type: "callout",
      variant: "warning",
      content:
        "Lo ya pagado es definitivo. «Anular lote» no toca lo pagado, lo que está en revisión ni lo facturado, y pide un motivo; antes dice cuántos cobros se anularán y por cuánto. Las mensualidades anuladas se vuelven a generar con el ciclo normal del mes. «Quitar descuento» solo funciona mientras nadie haya pagado ese cobro. Hoy no hay forma, desde la app, de corregir un pago ya registrado: hay que pedirle la corrección al equipo de SportMaps.",
    },
    {
      type: "p",
      content:
        "La pestaña Pagos → Operaciones guarda cada operación: fecha, quién, a quién, cobros creados, pagos registrados, descuentos, recargo condonado y estado (Vigente, Anulado en parte o Anulado).",
    },
    { type: "h2", content: "Dónde se refleja" },
    {
      type: "table",
      headers: ["Sección", "Qué cambia"],
      rows: [
        ["Deportistas", "«Al día» cuando ya no le queda nada vencido ni pendiente"],
        ["Recordatorios de cobro", "Un cobro pagado sale de la lista; uno nuevo sin pagar entra"],
        ["Pagos → Historial", "El pago aparece como Pagado, con método, fecha y mes que cubre"],
        ["Pagos → Operaciones", "La operación completa: qué se creó, qué se pagó, qué se descontó y quién"],
        ["Estadísticas de Pagos", "Suma a «Ingresos Totales» y «Transacciones»"],
        ["App de la familia", "Ve el pago como «Pagado» y los cobros nuevos como pendientes; recibe «Pago registrado»"],
      ],
    },
    { type: "h2", content: "Preguntas frecuentes" },
    { type: "h3", content: "Un padre me pagó, pero tiene varios cobros pendientes, ¿qué hago?" },
    {
      type: "p",
      content:
        "Marca en «Cobros pendientes» los que cubre el pago; ya no se cierra todo de una vez. Si pagó menos de lo que debía, escribe el valor en «Pagar» y elige si queda como abono o se cierra el cobro con la diferencia como descuento.",
    },
    { type: "h3", content: "Me equivoqué al registrar un pago, ¿cómo lo corrijo?" },
    {
      type: "p",
      content:
        "Si todavía no pulsaste el botón, corrige en la ventana. Si ya lo confirmaste, hoy no hay opción para editar ni anular un pago registrado: pídele la corrección al equipo de SportMaps. Si lo que te equivocaste fue crear cobros y nadie los ha pagado, usa «Anular lote».",
    },
    { type: "h3", content: "¿Cuál es la diferencia con el pago en línea?" },
    {
      type: "table",
      headers: ["Cobros y pagos (por fuera)", "Pago en línea (Wompi / enlace)"],
      rows: [
        ["La escuela registra el pago", "La familia paga desde su celular"],
        ["Queda pagado al instante", "Queda pendiente hasta que la pasarela confirma"],
        ["Para efectivo y transferencias ya recibidos", "Para tarjeta o PSE"],
      ],
    },
    {
      type: "p",
      content:
        "Si la familia tiene un pago en línea en curso o un comprobante en revisión, el cobro sale bloqueado en la ventana hasta que se resuelva.",
    },
    { type: "h3", content: "¿Por qué no veo el botón «Cobros y pagos»?" },
    {
      type: "p",
      content: "Es solo para el dueño y los administradores de la escuela. El entrenador no registra dinero.",
    },
    {
      type: "cta",
      title: "¿Necesitas configurar Wompi para pagos online?",
      description: "Tenemos guía paso a paso.",
      href: "/ayuda/configurar-wompi-pagos-online",
      label: "Ver guía Wompi",
    },
  ],
  related: ["plantillas-recordatorios", "configurar-wompi-pagos-online"],
};
