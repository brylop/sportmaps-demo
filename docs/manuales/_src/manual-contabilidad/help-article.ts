/**
 * Contenido para Sportbot / Centro de Ayuda — versión ACADEMIAS del manual
 * docs/manuales/academias/manual-contabilidad.pdf (2026-10-05).
 *
 * Cómo usarlo: artículo NUEVO para pegar en `helpArticles` de
 * bff/src/data/help-articles.ts. No reemplaza nada: hoy no existe ningún slug
 * de contabilidad, gastos, nómina ni proveedores en ese archivo (grep del
 * 2026-10-05; lo único parecido es "organizer-finanzas-payouts", que es de
 * organizadores de eventos). Categoría existente: "pagos-finanzas".
 */
import type { HelpArticle } from "../../../../bff/src/data/help-articles";

export const contabilidadEscuela: HelpArticle = {
  slug: "contabilidad-escuela",
  categoryId: "pagos-finanzas",
  title: "Contabilidad: libro de caja, gastos, proveedores, nómina y tu contador",
  excerpt:
    "Mira ingresos y egresos mes por mes, registra gastos con comprobante, lleva las facturas de proveedores con abonos, calcula y paga la nómina, fija un presupuesto, exporta el estado de resultados e invita a tu contador con acceso de solo lectura.",
  readTime: "7 min",
  targetRole: ["school"],
  body: [
    {
      type: "p",
      content:
        "La contabilidad reúne el dinero que entra (los pagos de las familias, que llegan solos) y el que sale (gastos, proveedores y nómina). Está en el menú lateral, en Finanzas → Contabilidad, con cinco pantallas: Contabilidad (libro de caja), Proveedores, Nómina, Estado de resultados y Presupuesto.",
    },
    {
      type: "callout",
      variant: "info",
      content:
        "La Contabilidad viene incluida en el plan Elite o se activa como módulo aparte. Si al entrar ves un candado, pulsa \"Ver planes y activar\" o escríbenos por soporte.",
    },
    { type: "h2", content: "¿Quién ve qué?" },
    {
      type: "table",
      headers: ["Rol", "Qué puede hacer"],
      rows: [
        ["Dueño / administrador", "Todo: ver, registrar gastos, proveedores y facturas, abonar, calcular y pagar la nómina, fijar el presupuesto y exportar."],
        ["Contador", "Ver y exportar todo. No puede registrar, pagar ni calcular: esos botones no le aparecen."],
        ["Entrenador", "Nada de dinero: no ve la contabilidad ni los ingresos en su panel."],
        ["Familias y deportistas", "Solo sus propios cobros, en Mis Pagos."],
      ],
    },
    { type: "h2", content: "El libro de caja, mes por mes" },
    {
      type: "ol",
      items: [
        "Entra a Finanzas → Contabilidad. Abre en el mes actual; cambia el mes en el campo \"Mes\".",
        "Arriba ves Ingresos (pagos cobrados a las familias), Egresos (gastos, abonos a proveedores y nómina pagada) y Flujo neto. Siempre suman el mes completo.",
        "Abajo está cada movimiento. Origen \"Pago\" es un cobro a una familia; origen \"Gasto\" es un egreso que registró la escuela. El clip abre el comprobante.",
        "La lista trae los movimientos de 50 en 50. Si el mes tiene más, al final aparece \"Cargar más\" y el contador \"50 de N movimiento(s)\".",
      ],
    },
    {
      type: "callout",
      variant: "tip",
      content:
        "El ingreso cobrado sale de una sola fórmula: el Panel de Escuela (mes en curso), los indicadores de Gestión de Pagos (histórico), el libro (el mes que elijas) y el estado de resultados (el año) dan la misma cifra para el mismo período.",
    },
    { type: "h2", content: "Registrar un gasto con su comprobante" },
    {
      type: "ol",
      items: [
        "En Contabilidad, pulsa \"Registrar gasto\".",
        "Elige la categoría y escribe el concepto y el monto (obligatorios). La fecha es el día en que salió el dinero: decide en qué mes cae.",
        "Elige el método de pago y anota la referencia de la transferencia o del recibo.",
        "En \"Comprobante\" adjunta la foto o el PDF de la factura (PDF, PNG, JPG o WEBP).",
        "Pulsa \"Guardar gasto\". Queda como egreso pagado en el libro, en el estado de resultados y en lo ejecutado del presupuesto.",
      ],
    },
    {
      type: "callout",
      variant: "warning",
      content:
        "Los gastos no se borran ni se editan: así nadie puede desaparecer una salida de dinero. Revisa monto, fecha y categoría antes de guardar. Si te equivocaste, escríbenos por soporte con el concepto y la fecha: lo anulamos (deja de sumar, pero queda el registro) y tú registras el correcto.",
    },
    { type: "h2", content: "Proveedores y cuentas por pagar" },
    {
      type: "ol",
      items: [
        "En Finanzas → Contabilidad → Proveedores, pulsa \"+ Proveedor\" (solo el nombre es obligatorio; NIT, teléfono, contacto y correo ayudan a tu contador).",
        "Pulsa \"+ Factura\": proveedor, número, monto, categoría y fechas de emisión y vencimiento. Registrar la factura no mueve la caja: es una deuda.",
        "Para pagar, pulsa \"Pagar\" en la fila. Deja el monto vacío para pagar el saldo completo o escribe un valor menor para abonar.",
        "La factura pasa a \"Abonada\" y el saldo baja; con el último peso queda \"Pagada\". Cada pago entra al libro como egreso. Total por pagar y Vencido te dicen cuánto debes.",
      ],
    },
    { type: "h2", content: "Nómina" },
    {
      type: "ol",
      items: [
        "Pestaña Empleados → \"+ Empleado\": nombre, documento, contrato, salario base, clase ARL, auxilio de transporte, EPS y AFP. \"Inactivar\" lo saca de las próximas nóminas sin borrar su historia.",
        "Pestaña Nómina: elige mes y año y pulsa \"Calcular nómina\". El desprendible queda en Borrador; si corriges a un empleado, vuelve a calcular.",
        "El botón \"PDF\" abre el desprendible listo para imprimir.",
        "\"Pagar (caja $…)\" registra la nómina como un solo egreso. Lo que sale de la caja es el bruto (salario + auxilio) más los aportes patronales, no solo el neto. Pagar es definitivo.",
      ],
    },
    {
      type: "table",
      headers: ["Columna", "Qué es"],
      rows: [
        ["Deducciones", "Salud y pensión que se le descuentan al empleado."],
        ["Aportes patr.", "Lo que paga la escuela encima (pensión, ARL, caja; y salud, SENA e ICBF si no hay exoneración)."],
        ["Provisiones", "Lo que se guarda para prima, cesantías, intereses y vacaciones. No sale de la caja este mes."],
        ["Neto", "Lo que recibe el empleado."],
      ],
    },
    {
      type: "callout",
      variant: "info",
      content:
        "El salario mínimo, el auxilio de transporte y la UVT de cada año los actualiza SportMaps. Si al calcular ves \"Faltan los parámetros de nómina\", escríbenos por soporte.",
    },
    { type: "h2", content: "Presupuesto y estado de resultados" },
    {
      type: "ul",
      items: [
        "Presupuesto: escribe cuánto planeas gastar en el año por categoría y pulsa \"Guardar\". Verás lo ejecutado y el avance; si una categoría se pasa, la barra se pone roja (\"Excedido\").",
        "Estado de resultados: ingresos, egresos y resultado neto del año, el flujo de cada mes y los egresos por categoría.",
        "\"Exportar CSV\" descarga el estado de resultados del año para abrirlo en Excel o entregárselo al contador.",
      ],
    },
    { type: "h2", content: "Invitar a tu contador" },
    {
      type: "ol",
      items: [
        "Ve a Invitaciones → \"Nueva Invitación\" y elige el tipo \"Contador\".",
        "Escribe su correo o su WhatsApp y pulsa \"Crear & Copiar Link\". Envíale el enlace.",
        "Al abrirlo se registra y entra directo a su menú de Contabilidad: libro de caja, proveedores, nómina, estado de resultados y presupuesto.",
        "Ve los mismos números que tú, abre comprobantes, descarga el desprendible y exporta, pero no puede registrar, pagar ni calcular. Tampoco ve deportistas, equipos ni la gestión de cobros.",
      ],
    },
    {
      type: "cta",
      title: "Abrir la contabilidad",
      description: "Libro de caja del mes, con los ingresos y egresos de tu escuela.",
      href: "/accounting",
      label: "Ir a Contabilidad",
    },
  ],
  related: ["registrar-pago-manual"],
};
