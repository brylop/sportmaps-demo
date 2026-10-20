/**
 * Artículo NUEVO para `bff/src/data/help-articles.ts` (Mapi / Centro de
 * Ayuda). Slug nuevo `carnets-digitales`: no reemplaza ninguno. Antes de
 * escribirlo se buscó en el corpus: no hay artículo de carnets. Solo
 * `tomar-asistencia-coach` menciona el escaneo del carnet (sección 2), y
 * `bff/src/data/app-map.ts` ya tiene las tareas "Emitir carnets digitales" y
 * "Ver el carnet de mi hijo"; este artículo es coherente con las dos.
 *
 * Contenido = versión ACADEMIAS del manual
 * docs/manuales/academias/carnets-digitales.pdf (sin notas internas).
 *
 * Cómo aplicar: pegar el objeto de abajo dentro del array exportado de
 * help-articles.ts (categoría `operacion-diaria`). El import de tipos es solo
 * para que este archivo compile suelto; al pegar, sobra.
 */

import type { HelpArticle } from "../../../../bff/src/data/help-articles"; // ajustar al pegar

export const carnetsDigitales: HelpArticle = {
  slug: "carnets-digitales",
  categoryId: "operacion-diaria",
  title: "Carnets digitales: cómo generarlos y cómo les llegan a las familias",
  excerpt:
    "Diseñar la plantilla, emitir el carnet uno por uno o por equipo completo, imprimirlo en PDF y hacerlo llegar a las familias por la app, por WhatsApp o en imagen.",
  readTime: "6 min",
  targetRole: ["school", "parent", "coach"],
  body: [
    {
      type: "p",
      content:
        "Cada deportista puede tener un carnet digital con la marca de la escuela, su foto, su equipo y un código QR. Quien escanea el QR ve el carnet en línea y sabe al instante si está vigente, vencido o revocado. Lo administra el owner o un admin desde Documentos e Identidad → Carnets.",
    },
    {
      type: "table",
      headers: ["Pestaña", "Para qué sirve"],
      rows: [
        ["Emitir nuevo", "Deportistas con el estado de su carnet, filtros por equipo y sede, emisión uno por uno o en lote."],
        ["Carnets emitidos", "Los carnets que ya salieron: ver, enviar a la familia, revocar y PDF por equipo."],
        ["Plantillas", "El diseño: colores, disposición, datos visibles y plantilla predeterminada."],
      ],
    },
    { type: "h2", content: "1. Diseñar la plantilla (una sola vez)" },
    {
      type: "ol",
      items: [
        "Ve a Carnets → pestaña Plantillas y pulsa Nueva.",
        "Elige una combinación lista (Federación, Club moderno, Sobrio, Alto impacto o Energía) o arma la tuya: disposición, color principal y segundo color, textura, forma de la foto y color del texto.",
        "Escribe el nombre (ej. 'Carnet 2026') y el encabezado; opcionalmente una imagen de fondo y una nota legal para el reverso.",
        "En 'Campos visibles en el carnet' prende o apaga foto, documento, equipo, sede, vigencia, estado de cuota, RH, EPS, talla y contacto de emergencia. Lo que apagues tampoco se muestra al escanear el QR.",
        "Marca Predeterminada y Activa y pulsa Crear plantilla.",
      ],
    },
    {
      type: "callout",
      variant: "warning",
      content:
        "Al emitir, en el campo Plantilla elige tu plantilla por su nombre (la predeterminada aparece con una ★). La opción 'Predeterminada de la escuela' deja el carnet con el diseño básico de SportMaps.",
    },
    { type: "h2", content: "2. Emitir el carnet de un deportista" },
    {
      type: "ol",
      items: [
        "En la pestaña Emitir nuevo busca al deportista por nombre o documento, o filtra por equipo y sede.",
        "Pulsa Emitir en su fila.",
        "Elige la plantilla por su nombre y ajusta la fecha 'Vence el' (por defecto, un año).",
        "Pulsa Emitir. Se abre la vista previa: frente con foto, equipo, estado de cuota y QR; con 'Ver reverso', los datos de emergencia.",
      ],
    },
    {
      type: "table",
      headers: ["El botón de la fila dice", "Qué pasa"],
      rows: [
        ["Emitir", "El deportista no tiene carnet: se crea la versión 1."],
        ["Renovar", "El carnet venció: se reemplaza por una versión nueva."],
        ["Reemitir", "Tiene uno vigente: el anterior queda revocado y sale una versión nueva. El QR viejo deja de servir."],
      ],
    },
    { type: "h2", content: "3. Emitir los carnets de un equipo completo" },
    {
      type: "ol",
      items: [
        "En Emitir nuevo elige la categoría en 'Todos los equipos'.",
        "Pulsa la tarjeta 'Sin carnet' y luego 'Seleccionar esta página' (o 'Seleccionar los N sin carnet' para todas las páginas).",
        "Revisa la fecha de Vence y pulsa 'Emitir seleccionados'. Al terminar aparece 'Emitidos N carnet(s)'.",
      ],
    },
    {
      type: "callout",
      variant: "info",
      content:
        "La emisión en lote sale con el diseño básico de SportMaps. Si quieres tu plantilla en un carnet emitido así, usa Reemitir en su fila y elige la plantilla por nombre.",
    },
    { type: "h2", content: "4. Imprimir por equipo y revocar" },
    {
      type: "ul",
      items: [
        "Imprimir: en Carnets emitidos elige el equipo y pulsa Descargar PDF. Sale un A4 con nueve carnets por hoja en tamaño tarjeta (CR80), listo para imprimir, recortar y plastificar.",
        "Revocar: botón Revocar en la fila, con un motivo opcional. Al escanear el QR aparece 'Carnet revocado'. No se puede deshacer; para dar uno nuevo, se emite otra vez.",
        "Vencidos: el carnet vence solo en su fecha. En Emitir nuevo su botón pasa a decir Renovar.",
      ],
    },
    { type: "h2", content: "5. Cómo le llega el carnet a la familia" },
    {
      type: "table",
      headers: ["Camino", "Cómo funciona"],
      rows: [
        ["En la app", "Apenas se emite, aparece en 'Carnets de mis hijos' de la cuenta del acudiente. No hay que hacer nada más."],
        ["Por WhatsApp", "Botón Enviar (en la fila) o 'Enviar al padre' (en la vista previa): arma el mensaje 'Carnet deportivo de [nombre] — valida y consúltalo aquí: [enlace]' y tú eliges el chat de la familia."],
        ["Impreso", "Descargar PDF por equipo."],
        ["Imagen", "Descargar PNG desde la vista previa."],
      ],
    },
    {
      type: "callout",
      variant: "tip",
      content:
        "Cuando emites, el carnet queda de inmediato en la app de cada familia con cuenta. Para que se enteren, avísales con el botón Enviar o con un mensaje general por tu canal habitual: 'ya está el carnet de tu hijo en SportMaps, menú Carnets de mis hijos'.",
    },
    {
      type: "callout",
      variant: "warning",
      content:
        "El enlace es público: quien lo tenga (o escanee el QR) ve el carnet con los datos que la plantilla deja visibles. Mándalo solo a la familia y, si no quieres que se vea el contacto de emergencia o el estado de la cuota, apágalos en la plantilla.",
    },
    { type: "h2", content: "6. Qué ve la familia" },
    {
      type: "ol",
      items: [
        "El acudiente entra con su cuenta y abre Mi Actividad → Carnets de mis hijos (en el celular, el menú se abre con el botón de la esquina superior izquierda). Un deportista adulto lo encuentra como Mis Carnets.",
        "Ve los carnets de todos sus hijos, con equipo, sede, vencimiento y estado. Si un carnet se reemitió, la versión anterior aparece como Revocado: la que sirve es la Vigente.",
        "Al tocar el carnet lo puede guardar con Descargar PNG o abrir la página del QR con 'Abrir público'.",
      ],
    },
    {
      type: "table",
      headers: ["Etiqueta de cuota en el carnet", "Significado"],
      rows: [
        ["Cuota al día", "Los pagos están al día."],
        ["Próxima a vencer", "Se acerca la fecha del próximo pago."],
        ["Cuota vencida", "Hay un pago vencido; la página le pide a la familia ponerse al día."],
      ],
    },
    { type: "h2", content: "7. El carnet en la cancha" },
    {
      type: "p",
      content:
        "El coach toma asistencia con el QR: Asistencias → Escanear carnet, y escanea uno tras otro; cada lectura marca Presente en la sesión de hoy, sin elegir equipo. Si alguien del staff escanea el QR con la cámara normal del teléfono y ya tiene sesión en SportMaps, la página del carnet le muestra el Panel de staff con el botón Marcar asistencia.",
    },
    { type: "h2", content: "Si la familia no ve el carnet" },
    {
      type: "table",
      headers: ["Revisar", "Cómo se arregla"],
      rows: [
        ["En Emitir nuevo el deportista dice 'Sin carnet'", "Todavía no se emitió: pulsar Emitir en su fila."],
        ["El acudiente entra con otra cuenta o el hijo no está vinculado a la suya", "Mandarle el enlace con Enviar, y vincular el hijo a su cuenta para que lo vea en la app."],
        ["La familia ve un carnet 'Revocado'", "Es la versión anterior: que abra el que dice Vigente."],
        ["Al escanear sale vencido", "Renovar desde Emitir nuevo."],
        ["El botón Emitir está gris", "El deportista no tiene cuenta ni ficha de menor válida: completar su registro."],
        ["Salió sin los colores de la escuela", "Se emitió con 'Predeterminada de la escuela' o en lote: Reemitir y elegir la plantilla por su nombre."],
      ],
    },
  ],
  related: ["tomar-asistencia-coach", "invitar-padres-vinculacion"],
};
