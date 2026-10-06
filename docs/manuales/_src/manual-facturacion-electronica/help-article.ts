/**
 * Artículo NUEVO para `bff/src/data/help-articles.ts` (Sportbot / Centro de
 * Ayuda). Slug nuevo `facturacion-electronica-escuela`: hoy no hay ningún
 * artículo de facturación electrónica en el corpus.
 *
 * ADEMÁS hay que corregir la FAQ "¿SportMaps emite facturas electrónicas?"
 * (help-articles.ts, ~l. 2617): dice que "en plan Elite tenemos integración con
 * Siigo y Alegra", y eso es falso. Respuesta sugerida al final de este archivo.
 *
 * Cómo aplicar: pegar el objeto dentro del array `helpArticles` (categoría
 * `pagos-finanzas`) y reemplazar la respuesta de la FAQ. El import de tipos es
 * solo para que este archivo compile suelto; al pegar, sobra.
 *
 * Contenido = versión ACADEMIAS del manual
 * docs/manuales/academias/manual-facturacion-electronica.pdf (sin notas internas
 * ni nombre del proveedor).
 */

import type { HelpArticle, HelpFAQ } from "../../../../bff/src/data/help-articles"; // ajustar al pegar

export const facturacionElectronicaEscuela: HelpArticle = {
  slug: "facturacion-electronica-escuela",
  categoryId: "pagos-finanzas",
  title: "Facturación electrónica DIAN: configurar, emitir, consultar y anular",
  excerpt:
    "Qué necesita la escuela, cómo conectar el proveedor de facturación, qué datos del acudiente se piden, cómo salen las facturas (solas o por periodo), cómo consultarlas y cómo anular con nota crédito.",
  readTime: "7 min",
  targetRole: ["school", "parent"],
  body: [
    {
      type: "p",
      content:
        "SportMaps genera la factura electrónica de cada cobro pagado de tu escuela (mensualidades, inscripciones, torneos y ventas de la tienda) y la envía a la DIAN a través de un proveedor tecnológico autorizado. La factura sale a nombre de tu escuela, con tu NIT y tu resolución.",
    },
    { type: "h2", content: "Qué necesita la escuela antes de empezar" },
    {
      type: "ul",
      items: [
        "RUT actualizado y NIT de la escuela.",
        "Habilitación como facturador electrónico ante la DIAN y una resolución de numeración con prefijo y rango.",
        "Una cuenta con un proveedor de facturación electrónica con acceso por API: Client ID, Client Secret, usuario y contraseña.",
        "El número del rango de facturas en el portal del proveedor y, para poder anular, el de un rango de notas crédito.",
        "El código DANE del municipio de la escuela (ej. 11001 para Bogotá).",
      ],
    },
    {
      type: "callout",
      variant: "tip",
      content:
        "Empieza en modo pruebas. Cuando todo cuadre, cambia a producción y emite primero un solo documento antes de facturar el mes completo.",
    },
    { type: "h2", content: "Dónde está" },
    {
      type: "p",
      content:
        "Si tu escuela tiene Contabilidad: Finanzas → Contabilidad → Contabilidad, pestaña Facturación electrónica. Si no: Finanzas → Facturación electrónica. Configuran y emiten el dueño y los administradores; el contador solo consulta.",
    },
    { type: "h2", content: "Conectar el proveedor" },
    {
      type: "ol",
      items: [
        "En la tarjeta Facturador electrónico pulsa Configurar.",
        "Elige el proveedor y deja Modo pruebas encendido para el primer ensayo.",
        "Pega Client ID, Client Secret, usuario y contraseña (se guardan cifradas y no se vuelven a mostrar: al editar hay que escribirlas de nuevo).",
        "Escribe el rango de numeración de facturas y el de notas crédito tal como aparecen en el portal del proveedor.",
        "Escribe el municipio por defecto (código DANE de 5 dígitos, con el cero inicial).",
        "Deja encendido Servicios excluidos de IVA para mensualidades y clases, y guarda.",
      ],
    },
    {
      type: "callout",
      variant: "warning",
      content:
        "Si antes facturabas con otro proveedor usando la misma resolución, pídele al nuevo que ajuste su consecutivo al último número usado + 1 antes de conectar SportMaps. Si no, la DIAN rechaza la primera factura por 'documento procesado anteriormente'.",
    },
    { type: "h2", content: "Datos del acudiente que se necesitan" },
    {
      type: "table",
      headers: ["Dato", "Si falta"],
      rows: [
        ["Tipo y número de documento", "El pago no se factura y aparece en 'Datos fiscales faltantes'."],
        ["Dirección", "Igual: no se factura hasta completarla."],
        ["Municipio (con código DANE)", "Se factura igual, con el municipio de la escuela."],
        ["Correo y teléfono", "Se toman de la cuenta del acudiente."],
        ["Pagador vinculado al cobro", "Sin acudiente (o deportista adulto con cuenta) no hay a quién facturar: se arregla en la ficha del deportista."],
      ],
    },
    {
      type: "p",
      content:
        "Cuando un acudiente paga por la app por primera vez, SportMaps le pide estos datos antes de pagar y los guarda. Para pagos en efectivo o transferencia, al registrar el pago manual aparece '¿Desea factura electrónica?' para completarlos ahí. La pestaña 'Datos fiscales faltantes' lista a todos los pagadores con pagos cobrados que no se pueden facturar, con su contacto y el botón Completar datos. Completar el dato habilita la factura, pero no la emite.",
    },
    { type: "h2", content: "Cómo se emiten las facturas" },
    {
      type: "ul",
      items: [
        "Automática: cada 15 minutos se facturan los cobros que pasaron a pagado en los últimos 3 días, sin importar cómo se pagaron. Solo se factura lo pagado.",
        "Por periodo: los pagos de más de 3 días no se facturan solos. En 'Emitir facturas de un periodo' eliges las fechas de pago, revisas cuántos documentos salen y por cuánto, y confirmas. Máximo 92 días y 200 documentos por corrida; se puede repetir sin duplicar.",
        "Usa 'Emitir como máximo' = 1 para probar con un documento antes de emitir el resto.",
        "Cada factura consume un número de la resolución que no se recupera.",
      ],
    },
    { type: "h2", content: "Estados de una factura" },
    {
      type: "table",
      headers: ["Estado", "Qué hacer"],
      rows: [
        ["Validada por la DIAN", "Nada: es un documento legal vigente."],
        ["Emitida · esperando DIAN", "Esperar: el número y el CUFE llegan en minutos."],
        ["En cola (nuestra)", "No gastó número; se reintenta sin costo con una nueva corrida."],
        ["Rechazada", "Leer el motivo en su fila, corregir el dato y volver a emitir el periodo."],
        ["Anulada", "Quedó sin efecto por una nota crédito; su número sigue consumido."],
      ],
    },
    {
      type: "p",
      content:
        "En la lista de Facturas emitidas, el botón Ver abre la factura en la página del proveedor, con el PDF, el XML y el QR de la DIAN. Cada fila muestra el CUFE y un código de referencia para buscarla en el portal del proveedor. La familia ve el botón FACTURA en Mis Pagos.",
    },
    { type: "h2", content: "Anular una factura con nota crédito" },
    {
      type: "p",
      content:
        "Una factura validada no se borra: se anula con una nota crédito desde el botón Anular de su fila. Solo aparece en facturas validadas y exige que el facturador tenga rango de notas crédito. Se elige el motivo (anulación completa, devolución, rebaja, ajuste de precio o descuento), se escribe una observación y se confirma. La nota crédito también consume un número de su propio rango.",
    },
    {
      type: "callout",
      variant: "warning",
      content:
        "Un pago con factura vigente no se puede pasar de pagado a pendiente, rechazado o anulado. Primero se anula la factura con nota crédito. Para un caso excepcional, escribe a soporte de SportMaps: solo el equipo puede hacerlo y queda registrado con el motivo.",
    },
    { type: "h2", content: "Ventas de la tienda" },
    {
      type: "p",
      content:
        "Las órdenes pagadas de la tienda de la escuela también se facturan solas, con la escuela como emisor. Los productos van gravados con IVA incluido en el precio (19% por defecto) y el costo de envío va en un renglón aparte llamado 'Envío', excluido de IVA.",
    },
    { type: "h2", content: "Si una factura no salió" },
    {
      type: "ol",
      items: [
        "El facturador no está configurado o aparece Deshabilitado.",
        "El pago no está pagado: apruébalo y la factura sale en los siguientes 15 minutos.",
        "Al pagador le faltan datos: complétalos en 'Datos fiscales faltantes'.",
        "El cobro no tiene pagador vinculado: corrígelo en la ficha del deportista.",
        "El pago tiene más de 3 días: emítelo con 'Emitir facturas de un periodo'.",
        "Quedó Rechazada: corrige el dato que dice el motivo y vuelve a emitir.",
      ],
    },
  ],
  related: ["registrar-pago-manual", "configurar-wompi-pagos-online"],
};

/** Reemplazo sugerido de la FAQ desactualizada (help-articles.ts ~l. 2617). */
export const faqFacturacionElectronica: HelpFAQ = {
  question: "¿SportMaps emite facturas electrónicas?",
  answer:
    "Sí. SportMaps se conecta con el proveedor de facturación electrónica de tu escuela y emite la factura DIAN de cada cobro pagado (mensualidades, inscripciones y ventas de la tienda), a nombre de tu escuela. Se activa en Finanzas → Facturación electrónica. Consulta el artículo 'Facturación electrónica DIAN' para ver los requisitos.",
};
