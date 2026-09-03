/**
 * Help Center — corpus portado desde la landing (`frontend/src/lib/help-articles.ts`)
 * para alimentar la tool `search_help_articles` del bot de soporte in-app
 * (MOD-21 S1, `docs/specs/soporte-in-app-chat-y-bot.md` §5). Es contenido de
 * LECTURA para el LLM — no se renderiza acá. Si la landing actualiza su
 * copia, portar el diff manualmente (no hay build compartido entre los dos
 * repos).
 */

export type ContentBlock =
  | { type: "p"; content: string }
  | { type: "h2"; content: string }
  | { type: "h3"; content: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "quote"; content: string; author?: string }
  | { type: "callout"; variant: "info" | "tip" | "warning"; content: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "cta"; title: string; description: string; href: string; label: string }
  | { type: "img"; src: string; alt: string; caption?: string };

export type HelpRole = "school" | "parent" | "coach" | "athlete" | "all";

export interface HelpCategory {
  id: string;
  title: string;
  emoji: string;
  description: string;
  /** Para qué roles aplica esta categoría */
  roles: HelpRole[];
}

export interface HelpArticle {
  slug: string;
  categoryId: string;
  title: string;
  excerpt: string;
  readTime: string;
  /** A quién va dirigido principalmente */
  targetRole: HelpRole[];
  body: ContentBlock[];
  related?: string[];
}

export interface HelpFAQ {
  question: string;
  answer: string;
}

export const helpCategories: HelpCategory[] = [
  {
    id: "primeros-pasos",
    title: "Primeros pasos",
    emoji: "🚀",
    description: "Onboarding, login y configuración inicial de tu cuenta",
    roles: ["all"],
  },
  {
    id: "pagos-finanzas",
    title: "Pagos y Finanzas",
    emoji: "💳",
    description: "Wompi, pagos manuales, recordatorios y plantillas",
    roles: ["school", "parent"],
  },
  {
    id: "gestion-alumnos",
    title: "Gestión de alumnos",
    emoji: "👥",
    description: "Inscripciones, padres, sedes y equipos",
    roles: ["school"],
  },
  {
    id: "operacion-diaria",
    title: "Operación diaria",
    emoji: "📅",
    description: "Asistencia, calendario, reservas y reportes",
    roles: ["school", "coach"],
  },
  {
    id: "para-padres-atletas",
    title: "Para padres y atletas",
    emoji: "🏃",
    description: "Vincular tu cuenta, pagar mensualidades, ver progreso",
    roles: ["parent", "athlete"],
  },
  {
    id: "entrenadores-personales",
    title: "Entrenadores personales",
    emoji: "🏋️",
    description: "Onboarding, clientes, rutinas, agenda y cobros — para coaches independientes",
    roles: ["coach"],
  },
  {
    id: "organizadores-eventos",
    title: "Organizadores de eventos",
    emoji: "🏆",
    description: "Crear eventos, inscripciones, finanzas y reportes",
    roles: ["all"],
  },
  {
    id: "tiendas-proveedores",
    title: "Tiendas y proveedores",
    emoji: "🛍️",
    description: "Productos, servicios, citas, promociones y envíos",
    roles: ["all"],
  },
];

export const helpArticles: HelpArticle[] = [
  // ===========================================================================
  // Artículos completos basados en guías oficiales del producto
  // ===========================================================================
  {
    slug: "registrar-pago-manual",
    categoryId: "pagos-finanzas",
    title: "Cómo registrar un pago manual (efectivo o transferencia)",
    excerpt:
      "Cuando un padre te paga en efectivo o por transferencia, registra el pago en SportMaps para cerrar la deuda y notificar automáticamente.",
    readTime: "6 min",
    targetRole: ["school"],
    body: [
      {
        type: "p",
        content:
          "Cuando un padre o atleta te paga directamente — ya sea en efectivo en la escuela o por transferencia bancaria — puedes registrar ese pago en SportMaps para que: (1) el estudiante aparezca como 'Al día', (2) desaparezca de la lista de Recordatorios de cobro, (3) el padre reciba notificación + correo de confirmación, y (4) el pago quede en el historial financiero.",
      },
      { type: "h2", content: "Cómo registrar un pago" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Gestión de Pagos → Cobros",
      },
      { type: "h3", content: "Paso 1 — Abrir el formulario" },
      {
        type: "p",
        content:
          "Haz clic en el botón 'Registrar pago' en la parte superior derecha de la página de Gestión de Pagos.",
      },
      { type: "h3", content: "Paso 2 — Seleccionar el método de pago" },
      {
        type: "table",
        headers: ["Botón", "Cuándo usarlo"],
        rows: [
          ["Efectivo (verde)", "El padre pagó en persona con dinero en efectivo"],
          ["Transferencia (azul)", "El padre hizo una transferencia o consignación bancaria"],
        ],
      },
      { type: "h3", content: "Paso 3 — Seleccionar el estudiante" },
      {
        type: "p",
        content:
          "Abre el desplegable 'Estudiante / Atleta' y selecciona a quien corresponde el pago. Si el estudiante es menor de edad, verás el nombre del acudiente entre paréntesis.",
      },
      { type: "h3", content: "Paso 4 — Completar los datos del pago" },
      {
        type: "table",
        headers: ["Campo", "Qué poner"],
        rows: [
          [
            "Concepto de pago",
            "Describe qué se está pagando. Por defecto: 'Mensualidad' (editable). Ej: 'Uniforme', 'Torneo', 'Inscripción'",
          ],
          [
            "Monto ($ COP)",
            "El valor que recibiste. Escribe solo el número sin puntos ni signos",
          ],
          [
            "Fecha del pago",
            "La fecha en que recibiste el dinero. Por defecto: hoy (editable)",
          ],
        ],
      },
      { type: "h3", content: "Paso 5 — Confirmar" },
      {
        type: "p",
        content: "Haz clic en 'Guardar y confirmar'.",
      },
      { type: "h2", content: "Qué pasa cuando confirmas" },
      {
        type: "ol",
        items: [
          "Salda la deuda completa — si el estudiante tenía pagos pendientes o vencidos, TODOS se marcan como pagados",
          "Si no había deuda — se crea un nuevo registro de pago con estado 'Pagado'",
          "Notificación al padre — si el padre tiene cuenta en SportMaps, recibe notificación in-app",
          "Correo de confirmación — si tiene email registrado, recibe correo automático",
          "Historial actualizado — el pago aparece en 'Historial' con el método (CASH o TRANSFER) y referencia única",
        ],
      },
      { type: "h2", content: "Dónde se reflejan los cambios" },
      {
        type: "table",
        headers: ["Sección", "Antes", "Después"],
        rows: [
          ["Estudiantes", "Badge rojo 'Vencido' o amarillo 'Pendiente'", "Badge verde 'Al día'"],
          ["Recordatorios", "Aparece en lista con días de mora", "Desaparece de la lista"],
          ["Historial de pagos", "Solo mostraba cobro pendiente", "Muestra el pago como 'Pagado'"],
          ["Estadísticas", "No sumaba en ingresos", "Se suma a 'Pagos exitosos'"],
        ],
      },
      { type: "h2", content: "Preguntas frecuentes específicas" },
      { type: "h3", content: "Un padre me pagó pero tiene varios cobros pendientes, ¿qué hago?" },
      {
        type: "p",
        content:
          "Solo registra UN pago. El sistema automáticamente marca TODOS los cobros pendientes y vencidos de ese estudiante como pagados.",
      },
      { type: "h3", content: "¿Cuál es la diferencia entre 'Registrar pago' y el pago online?" },
      {
        type: "table",
        headers: ["Registro manual", "Pago online (Wompi/link)"],
        rows: [
          ["La escuela registra el pago", "El padre paga desde su celular"],
          ["Se marca pagado al instante", "'Pendiente' hasta que el gateway confirma"],
          ["Para efectivo y transferencias ya recibidas", "Para pagos con tarjeta o PSE"],
        ],
      },
      { type: "h3", content: "¿Puedo registrar un monto diferente al cobro original?" },
      {
        type: "p",
        content:
          "Sí. El sistema registra el monto que ingreses. Si el cobro original era $35.000 y el padre pagó $40.000, puedes registrar $40.000. El sistema guarda el monto pagado sin importar el valor original del cobro.",
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
  },
  {
    slug: "plantillas-recordatorios",
    categoryId: "pagos-finanzas",
    title: "Configurar plantillas de recordatorios y enviar cobros",
    excerpt:
      "Activa plantillas de recordatorio, personaliza el mensaje y envía cobros por WhatsApp o email — individual o masivo.",
    readTime: "7 min",
    targetRole: ["school"],
    body: [
      { type: "h2", content: "Parte 1: Configurar las plantillas (una sola vez)" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Finanzas → Plantillas",
      },
      { type: "h3", content: "Paso 1 — Revisar las plantillas disponibles" },
      {
        type: "p",
        content: "La página muestra las plantillas organizadas por tipo:",
      },
      {
        type: "table",
        headers: ["Tipo", "Cuándo se usa"],
        rows: [
          ["Recordatorio Previo", "Días antes de que venza el pago"],
          ["Día de Vencimiento", "El mismo día que vence"],
          ["Mora / Vencido", "Cuando ya pasó la fecha de pago"],
          ["Pago Confirmado", "Cuando recibes un pago"],
          ["Abono Recibido", "Cuando recibes un pago parcial"],
        ],
      },
      {
        type: "p",
        content:
          "Cada tipo tiene varias variantes (amigable, corto, formal). Todas vienen preconfiguradas.",
      },
      { type: "h3", content: "Paso 2 — Activar o desactivar plantillas" },
      {
        type: "p",
        content:
          "Cada plantilla tiene un switch a la derecha. Solo las plantillas activas aparecerán como opción en Recordatorios.",
      },
      { type: "h3", content: "Paso 3 — Personalizar un mensaje (opcional)" },
      {
        type: "ol",
        items: [
          "Haz clic en 'Editar' en cualquier plantilla",
          "Modifica el texto usando variables que se reemplazan automáticamente",
          "Haz clic en 'Vista Previa' para ver con datos de ejemplo",
          "Haz clic en 'Guardar'",
        ],
      },
      { type: "h3", content: "Variables disponibles" },
      {
        type: "table",
        headers: ["Variable", "Se reemplaza por"],
        rows: [
          ["{{nombre_padre}}", "Nombre del acudiente"],
          ["{{nombre_atleta}}", "Nombre del deportista"],
          ["{{monto}}", "Valor del pago (ej: $150.000)"],
          ["{{fecha_vencimiento}}", "Fecha límite de pago"],
          ["{{dias_mora}}", "Días vencidos"],
          ["{{nombre_escuela}}", "Nombre de tu academia"],
          ["{{link_pago}}", "Link para pagar online"],
          ["{{equipo}}", "Equipo o programa"],
          ["{{plan}}", "Plan contratado"],
          ["{{banco}}", "Datos bancarios de la escuela"],
          ["{{nequi}}", "Número de Nequi de la escuela"],
        ],
      },
      {
        type: "callout",
        variant: "tip",
        content:
          "Si quieres volver al mensaje original, haz clic en 'Restaurar'. Las plantillas preconfiguradas están probadas en cientos de academias — solo personaliza si tienes un motivo claro.",
      },
      { type: "h2", content: "Parte 2: Enviar recordatorios" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Finanzas → Recordatorios",
      },
      { type: "h3", content: "Paso 1 — Ver pagos pendientes" },
      {
        type: "p",
        content:
          "La página carga automáticamente todos los pagos pendientes y vencidos. Verás tarjetas resumen (contactos, pendientes, vencidos, monto total) y una tabla con cada pago.",
      },
      { type: "h3", content: "Paso 2 — Filtrar (opcional)" },
      {
        type: "ul",
        items: [
          "Por estado: Todos / Pendientes / Vencidos",
          "Por plan: filtra por un plan específico",
        ],
      },
      { type: "h3", content: "Paso 3 — Elegir plantilla" },
      {
        type: "ul",
        items: [
          "'Plantilla automática' (por defecto): el sistema elige según el estado — Recordatorio Previo, Día de Vencimiento o Mora",
          "Plantilla específica: abre el dropdown y selecciona la que quieras",
        ],
      },
      { type: "h3", content: "Paso 4 — Enviar por WhatsApp (individual)" },
      {
        type: "ol",
        items: [
          "Haz clic en el ícono de WhatsApp al lado de cualquier pago",
          "Se abre WhatsApp Web con el mensaje ya escrito",
          "Solo dale 'Enviar' en WhatsApp",
        ],
      },
      { type: "h3", content: "Paso 5 — Enviar por Email (selección)" },
      {
        type: "ol",
        items: [
          "Selecciona los pagos con checkboxes (o todos con el checkbox del encabezado)",
          "Haz clic en 'Enviar (X)' — envía email a todos los seleccionados con email registrado",
          "Verás resumen de cuántos se enviaron",
        ],
      },
      { type: "h3", content: "Paso 6 — Enviar todos por email (masivo)" },
      {
        type: "p",
        content:
          "Haz clic en 'Enviar todos por email' — envía recordatorio a TODOS los padres con pagos pendientes de una sola vez.",
      },
      {
        type: "cta",
        title: "¿Quieres automatizar todo esto con WhatsApp AI?",
        description:
          "Con WhatsApp AI los recordatorios se mandan solos. Sin clicks. Sin olvidos.",
        href: "/blog/cobranza-whatsapp-ai-sportmaps",
        label: "Ver cómo funciona",
      },
    ],
    related: ["registrar-pago-manual", "configurar-wompi-pagos-online"],
  },
  // ===========================================================================
  // Artículos basados en features del producto
  // ===========================================================================
  {
    slug: "primer-login-escuela",
    categoryId: "primeros-pasos",
    title: "Primer login: crea tu cuenta y configura tu escuela",
    excerpt:
      "Los primeros 15 minutos en SportMaps: crear cuenta, completar perfil de escuela y configurar tu primera sede.",
    readTime: "5 min",
    targetRole: ["school"],
    body: [
      {
        type: "p",
        content:
          "Crear tu cuenta de SportMaps toma menos de 15 minutos. Esta guía te lleva paso a paso desde el registro hasta tener tu primera sede lista para inscribir alumnos.",
      },
      { type: "h2", content: "Paso 1 — Crear cuenta" },
      {
        type: "ol",
        items: [
          "Ve a app.sportmaps.co/auth",
          "Haz clic en 'Registrarse'",
          "Ingresa tu email y crea una contraseña (también puedes usar Google OAuth)",
          "Confirma tu email haciendo clic en el link que recibiste",
        ],
      },
      { type: "h2", content: "Paso 2 — Seleccionar rol 'Escuela'" },
      {
        type: "p",
        content:
          "Después de confirmar el email, eliges qué tipo de cuenta eres. Selecciona 'Escuela / Academia'. Esto te lleva al wizard de onboarding.",
      },
      { type: "h2", content: "Paso 3 — Wizard de configuración" },
      {
        type: "p",
        content: "El wizard te pide la información básica en 4 pasos:",
      },
      {
        type: "ol",
        items: [
          "Datos de la escuela: nombre, deporte principal, descripción",
          "Sede principal: ciudad, dirección, capacidad estimada",
          "Plan inicial: empezás en Free Start (gratis hasta 20 alumnos)",
          "Equipo: opcional, podés invitar coaches y staff después",
        ],
      },
      {
        type: "callout",
        variant: "tip",
        content:
          "No tenés que llenar todo perfecto en este momento — podés volver a editar cualquier campo desde Configuración después.",
      },
      { type: "h2", content: "Paso 4 — Primera acción recomendada" },
      {
        type: "p",
        content:
          "Una vez completado el wizard, tu dashboard te muestra 3 botones grandes: 'Invitar primer alumno', 'Configurar Wompi para pagos' y 'Agregar tu primer equipo'. Empezá por el que tenga más urgencia para tu operación.",
      },
      {
        type: "cta",
        title: "Siguiente paso lógico",
        description: "Configurar Wompi te permite cobrar online desde el día 1.",
        href: "/ayuda/configurar-wompi-pagos-online",
        label: "Configurar Wompi",
      },
    ],
    related: ["configurar-wompi-pagos-online", "invitar-padres-vinculacion"],
  },
  {
    slug: "configurar-wompi-pagos-online",
    categoryId: "pagos-finanzas",
    title: "Configurar Wompi: empieza a cobrar online en 10 minutos",
    excerpt:
      "Conecta tu cuenta de Wompi a SportMaps para que los padres paguen con tarjeta, PSE o link de pago directo.",
    readTime: "6 min",
    targetRole: ["school"],
    body: [
      {
        type: "p",
        content:
          "Wompi es la pasarela de pagos integrada nativamente en SportMaps. Conectándola, tus padres pagan con tarjeta de crédito/débito o PSE en menos de 30 segundos, y el pago se concilia automáticamente con el cobro del alumno.",
      },
      {
        type: "callout",
        variant: "info",
        content:
          "Si no tienes cuenta Wompi todavía, créala primero en wompi.co. Es gratis abrir la cuenta — solo cobran comisión por transacción.",
      },
      { type: "h2", content: "Paso 1 — Obtener tus llaves de Wompi" },
      {
        type: "ol",
        items: [
          "Entra a tu dashboard Wompi (comercio.wompi.co)",
          "Ve a 'Desarrolladores' → 'API Keys'",
          "Copia tu 'Llave pública' (empieza con pub_prod_...)",
          "Copia tu 'Llave privada' (empieza con prv_prod_...) — esta es secreta, nunca la compartas",
        ],
      },
      { type: "h2", content: "Paso 2 — Pegar las llaves en SportMaps" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Configuración → Pagos → Pasarela Wompi",
      },
      {
        type: "ol",
        items: [
          "Pega la llave pública en el campo 'Wompi Public Key'",
          "Pega la llave privada en el campo 'Wompi Private Key'",
          "Selecciona modo: 'Producción' (cobros reales) o 'Pruebas' (sandbox)",
          "Haz clic en 'Guardar y validar conexión'",
        ],
      },
      {
        type: "callout",
        variant: "tip",
        content:
          "Te recomendamos arrancar en modo Pruebas. SportMaps incluye datos de tarjetas de test para que valides el flujo completo sin cobrar a nadie real.",
      },
      { type: "h2", content: "Paso 3 — Configurar webhook" },
      {
        type: "p",
        content:
          "Wompi notifica a SportMaps cuando un pago se aprueba o rechaza. La URL del webhook aparece en pantalla — cópiala y pégala en Wompi:",
      },
      {
        type: "ol",
        items: [
          "Vuelve a tu dashboard Wompi → 'Desarrolladores' → 'Eventos'",
          "Pega la URL del webhook que te dio SportMaps",
          "Marca eventos: 'transaction.updated', 'nequi_token.updated'",
          "Guarda",
        ],
      },
      { type: "h2", content: "Paso 4 — Validar con un cobro de prueba" },
      {
        type: "p",
        content:
          "Crea un cobro de $1.000 a tu propio email. Páguelo con la tarjeta de test que aparece en pantalla. Si el pago se marca como 'Pagado' automáticamente, el webhook funciona.",
      },
      { type: "h2", content: "Datos de tarjeta de prueba" },
      {
        type: "table",
        headers: ["Campo", "Valor"],
        rows: [
          ["Número", "4242 4242 4242 4242"],
          ["CVC", "123"],
          ["Fecha", "Cualquier fecha futura"],
          ["Resultado", "Aprobada"],
        ],
      },
      {
        type: "cta",
        title: "¿Prefieres registrar pagos manuales?",
        description: "También soportamos efectivo y transferencias.",
        href: "/ayuda/registrar-pago-manual",
        label: "Ver guía manual",
      },
    ],
    related: ["registrar-pago-manual", "plantillas-recordatorios"],
  },
  {
    slug: "invitar-padres-vinculacion",
    categoryId: "gestion-alumnos",
    title: "Invitar a un padre y vincularlo con su hijo",
    excerpt:
      "Cómo enviar invitaciones a padres para que tengan su propia cuenta y vean a sus hijos en SportMaps.",
    readTime: "4 min",
    targetRole: ["school"],
    body: [
      {
        type: "p",
        content:
          "Cuando inscribes un alumno menor de edad, su padre/acudiente necesita una cuenta para pagar online y ver el progreso. SportMaps te permite invitarlo en 30 segundos.",
      },
      { type: "h2", content: "Método 1: Invitación por email" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Gestión → Invitaciones → 'Nueva invitación'",
      },
      {
        type: "ol",
        items: [
          "Selecciona el alumno al que se va a vincular",
          "Ingresa el email del padre/acudiente",
          "Haz clic en 'Enviar invitación'",
          "El padre recibe email con link único. Al hacer clic, crea cuenta y ya queda vinculado al alumno",
        ],
      },
      { type: "h2", content: "Método 2: Link compartible (sin email)" },
      {
        type: "p",
        content:
          "Si el padre no tiene email o prefieres mandarle por WhatsApp, genera un link único:",
      },
      {
        type: "ol",
        items: [
          "En 'Invitaciones' → 'Generar link de un solo uso'",
          "Copia el link generado",
          "Envíalo por WhatsApp al padre",
          "Al hacer clic, crea cuenta y queda vinculado al alumno automáticamente",
        ],
      },
      { type: "h2", content: "Método 3: QR para inscripciones presenciales" },
      {
        type: "p",
        content:
          "Si haces inscripciones en persona (jornada de inscripción, torneo), imprime un QR único por alumno. El padre escanea con su celular y queda vinculado al instante.",
      },
      {
        type: "callout",
        variant: "info",
        content:
          "Menú: Gestión → Estudiantes → seleccionar alumno → 'QR de vinculación familiar'",
      },
      {
        type: "cta",
        title: "¿Cómo funciona del lado del padre?",
        description:
          "Ve la guía para padres sobre cómo inscribirse y vincularse.",
        href: "/ayuda/inscripcion-padre-paso-a-paso",
        label: "Guía para padres",
      },
    ],
    related: ["inscripcion-padre-paso-a-paso", "configurar-sedes-equipos"],
  },
  {
    slug: "configurar-sedes-equipos",
    categoryId: "gestion-alumnos",
    title: "Configurar sedes, equipos y staff",
    excerpt:
      "Estructura tu academia: agrega sedes adicionales, crea equipos por edad/nivel y asigna coaches.",
    readTime: "5 min",
    targetRole: ["school"],
    body: [
      {
        type: "p",
        content:
          "SportMaps soporta operación multi-sede desde el plan Pro. Cada sede puede tener sus propios equipos, coaches asignados y horarios. Acá te explicamos cómo configurarlo todo.",
      },
      { type: "h2", content: "Agregar una sede" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Configuración → Sedes → 'Nueva sede'",
      },
      {
        type: "ol",
        items: [
          "Nombre de la sede (ej: 'Sede Norte', 'Sede Salitre')",
          "Dirección y ciudad",
          "Capacidad (cantidad máxima de alumnos)",
          "Coordinador de sede (opcional — un staff member específico)",
          "Guardar",
        ],
      },
      { type: "h2", content: "Crear equipos" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Equipos → 'Nuevo equipo'",
      },
      {
        type: "p",
        content:
          "Un equipo es la unidad básica de agrupación. Por ejemplo: 'Pre-juvenil masculino sub-12', 'Femenino sub-14', 'Veteranos'. Cada equipo se asigna a una sede.",
      },
      {
        type: "ol",
        items: [
          "Nombre del equipo",
          "Sede a la que pertenece",
          "Rango de edad (opcional)",
          "Coach principal asignado",
          "Plan asociado (Mensualidad estándar, Beca, etc.)",
        ],
      },
      { type: "h2", content: "Invitar staff (coaches, asistentes)" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Staff → 'Invitar miembro'",
      },
      {
        type: "ol",
        items: [
          "Email del coach o asistente",
          "Rol: Coach / Asistente / Administrador de sede",
          "Sedes a las que tiene acceso",
          "Equipos asignados (si es coach)",
          "Enviar invitación",
        ],
      },
      {
        type: "callout",
        variant: "tip",
        content:
          "Los coaches solo ven los equipos que les asignaste. Los administradores de sede ven todo lo de su sede. El admin general (vos) ve todo.",
      },
    ],
    related: ["invitar-padres-vinculacion", "tomar-asistencia-coach"],
  },
  {
    slug: "tomar-asistencia-coach",
    categoryId: "operacion-diaria",
    title: "Cómo tomar asistencia en cada sesión (para coaches)",
    excerpt:
      "Desde la app del coach: marca asistencia, registra atrasos y deja notas por estudiante en menos de 2 minutos.",
    readTime: "3 min",
    targetRole: ["coach"],
    body: [
      {
        type: "p",
        content:
          "La toma de asistencia es la acción más frecuente para un coach. SportMaps la diseñó para que sea rápida — menos de 2 minutos para un equipo de 20 alumnos.",
      },
      { type: "h2", content: "Desde el celular" },
      {
        type: "ol",
        items: [
          "Abre la app SportMaps en tu celular (o app.sportmaps.co)",
          "En el dashboard, verás tus sesiones del día. Haz clic en la que vas a iniciar",
          "Se carga la lista de estudiantes del equipo",
          "Por cada alumno: toca Presente / Tarde / Ausente",
          "(Opcional) Toca el ícono de nota para dejar comentario corto del alumno",
          "Cuando termines, toca 'Finalizar sesión'",
        ],
      },
      { type: "h2", content: "Quién ve la asistencia" },
      {
        type: "ul",
        items: [
          "Los padres reciben notificación cuando su hijo se marca como Presente",
          "El admin de la escuela ve un reporte semanal de asistencia por equipo",
          "El supervisor puede auditar cualquier asistencia (corregir errores)",
        ],
      },
      { type: "h2", content: "Si te equivocaste" },
      {
        type: "p",
        content:
          "Si marcaste un alumno como Ausente por error, abre la sesión nuevamente (queda editable por 24h después de finalizada) y corrige. Después de 24h, solo el admin puede modificar — pídeselo.",
      },
      {
        type: "callout",
        variant: "tip",
        content:
          "Truco: si tu equipo tiene 'presentes habituales' del 90%+, usá el botón 'Marcar todos como presentes' y luego solo cambiá los ausentes específicos. Ahorra 80% del tiempo.",
      },
    ],
    related: ["calendario-reservas", "reportes-financieros-asistencia"],
  },
  {
    slug: "inscripcion-padre-paso-a-paso",
    categoryId: "para-padres-atletas",
    title: "Cómo me registro como padre y vinculo a mi hijo",
    excerpt:
      "La guía corta para padres: aceptar invitación, crear cuenta, ver a tu hijo y empezar a pagar mensualidades online.",
    readTime: "3 min",
    targetRole: ["parent"],
    body: [
      {
        type: "p",
        content:
          "Si tu hijo está inscrito en una escuela que usa SportMaps, te enviaron una invitación por email, WhatsApp o QR. Aceptarla toma 2 minutos.",
      },
      { type: "h2", content: "Opción A: Recibiste un email" },
      {
        type: "ol",
        items: [
          "Abre el email de SportMaps en tu celular o computadora",
          "Haz clic en el botón grande 'Aceptar invitación'",
          "Crea una contraseña (o entra con Google)",
          "Listo: ya ves a tu hijo en tu cuenta",
        ],
      },
      { type: "h2", content: "Opción B: Recibiste un link por WhatsApp" },
      {
        type: "ol",
        items: [
          "Abre el link",
          "Crea cuenta con tu email + contraseña (o Google)",
          "Listo: la vinculación con tu hijo es automática",
        ],
      },
      { type: "h2", content: "Opción C: Escaneaste un QR en la escuela" },
      {
        type: "ol",
        items: [
          "El QR abre directamente la app",
          "Te pide email + contraseña",
          "Quedas vinculado al hijo cuyo QR escaneaste",
        ],
      },
      { type: "h2", content: "Qué podés hacer una vez vinculado" },
      {
        type: "ul",
        items: [
          "Ver perfil y progreso de tu hijo (asistencia, evaluaciones)",
          "Pagar mensualidades online con tarjeta o PSE (Wompi)",
          "Recibir notificaciones de pagos próximos y sesiones",
          "Chatear con la escuela y coaches",
          "Reservar clases adicionales o eventos",
        ],
      },
      {
        type: "callout",
        variant: "tip",
        content:
          "Si tenés más de un hijo en la misma escuela, cada uno te llega como invitación separada. Aceptás cada una y todos quedan en tu misma cuenta.",
      },
    ],
    related: ["invitar-padres-vinculacion"],
  },
  {
    slug: "calendario-reservas",
    categoryId: "operacion-diaria",
    title: "Calendario, reservas y disponibilidad de canchas",
    excerpt:
      "Configurá el calendario de tu academia, abrí reservas para padres y gestioná disponibilidad de canchas/instalaciones.",
    readTime: "5 min",
    targetRole: ["school", "coach"],
    body: [
      {
        type: "p",
        content:
          "El módulo de Calendario te permite mostrar todas las clases regulares, eventos especiales y disponibilidad de canchas en una sola vista. Padres y atletas pueden reservar sesiones desde su app.",
      },
      { type: "h2", content: "Configurar horario regular" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Calendario → 'Crear horario recurrente'",
      },
      {
        type: "ol",
        items: [
          "Selecciona el equipo o programa",
          "Días de la semana en que se entrena",
          "Hora de inicio y fin",
          "Sede / cancha donde se realiza",
          "Coach principal",
          "Guardar — se crean automáticamente las sesiones del semestre",
        ],
      },
      { type: "h2", content: "Configurar canchas / instalaciones" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Configuración → Instalaciones",
      },
      {
        type: "p",
        content:
          "Cada cancha o instalación tiene su propia agenda. Si dos equipos chocan en la misma cancha, el sistema te lo avisa al crear el horario.",
      },
      { type: "h2", content: "Reservas por parte de padres/atletas" },
      {
        type: "p",
        content:
          "Si activás reservas en un equipo, los padres pueden inscribir a su hijo a sesiones adicionales (clases extras, recuperación de sesiones perdidas). Configuralo desde Equipos → seleccionar equipo → 'Permitir reservas'.",
      },
      {
        type: "callout",
        variant: "tip",
        content:
          "Si tu academia hace clases libres (no por equipo fijo) — por ejemplo gimnasio o yoga — todos los slots son 'reservables' por defecto. El padre elige el horario que le sirve.",
      },
    ],
    related: ["tomar-asistencia-coach", "reportes-financieros-asistencia"],
  },
  {
    slug: "planes-entrenamiento",
    categoryId: "operacion-diaria",
    title: "Crear planes de entrenamiento para tus equipos",
    excerpt:
      "Diseña planes de entrenamiento por equipo con objetivos, ciclos y ejercicios. Los coaches lo ven en su dashboard.",
    readTime: "4 min",
    targetRole: ["coach", "school"],
    body: [
      {
        type: "p",
        content:
          "Los planes de entrenamiento te permiten estructurar la temporada por equipo: objetivos por mes, ciclos de carga, evaluaciones programadas. Los coaches lo ven en su dashboard y los atletas pueden consultar las rutinas asignadas.",
      },
      { type: "h2", content: "Crear un plan nuevo" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Entrenamiento → Planes",
      },
      {
        type: "ol",
        items: [
          "Selecciona el equipo desde el dropdown superior",
          "Haz clic en 'Nuevo plan'",
          "Completa: nombre del plan, periodo (ej: 'Pre-temporada Abril-Mayo')",
          "Define objetivos del ciclo (técnico, físico, táctico)",
          "Agrega sesiones por semana con ejercicios específicos",
          "Guardar — el plan queda visible para el coach del equipo y para los atletas inscritos",
        ],
      },
      { type: "h2", content: "Qué incluir en cada plan" },
      {
        type: "ul",
        items: [
          "Objetivos medibles (ej: '80% de pases acertados', 'Resistencia 30 min')",
          "Frecuencia: cuántas sesiones por semana",
          "Carga de entrenamiento: alta / media / baja por sesión",
          "Evaluaciones intermedias (cada 4-6 semanas)",
          "Notas sobre lesiones o restricciones individuales",
        ],
      },
      {
        type: "callout",
        variant: "tip",
        content:
          "Si tu academia tiene varios equipos con metodología similar, copia un plan existente y ajusta solo lo específico — ahorra 30 minutos por equipo.",
      },
      { type: "h2", content: "Eliminar o modificar un plan" },
      {
        type: "p",
        content:
          "Desde la lista de planes, cada uno tiene su botón de editar y eliminar. Eliminar un plan no borra los registros de asistencia ni evaluaciones asociadas — solo el plan en sí.",
      },
      {
        type: "cta",
        title: "Evaluá el progreso de cada jugador",
        description: "Las evaluaciones cierran el ciclo de entrenamiento.",
        href: "/ayuda/evaluaciones-jugadores",
        label: "Ver guía de evaluaciones",
      },
    ],
    related: ["evaluaciones-jugadores", "tomar-asistencia-coach"],
  },
  {
    slug: "evaluaciones-jugadores",
    categoryId: "operacion-diaria",
    title: "Evaluar a jugadores: habilidades, progreso y comentarios",
    excerpt:
      "Registra evaluaciones técnicas, físicas y tácticas de cada jugador con escala 0-100 y comentarios. Los padres lo ven en su app.",
    readTime: "3 min",
    targetRole: ["coach"],
    body: [
      {
        type: "p",
        content:
          "Las evaluaciones de SportMaps son simples a propósito: el coach define una habilidad, le pone un puntaje 0-100 con slider y agrega comentarios cortos. El padre lo ve en el progreso del hijo. Sin formularios kilométricos.",
      },
      { type: "h2", content: "Crear una evaluación" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Evaluaciones (en panel de coach)",
      },
      {
        type: "ol",
        items: [
          "Selecciona el equipo del jugador",
          "Selecciona el jugador específico",
          "Ingresa el nombre de la habilidad (ej: 'Pase corto', 'Resistencia aeróbica', 'Lectura de juego')",
          "Mueve el slider entre 0 y 100 para indicar el nivel actual",
          "Agrega comentarios opcionales (qué notaste, qué trabajar)",
          "Haz clic en 'Guardar'",
        ],
      },
      { type: "h2", content: "Buenas prácticas" },
      {
        type: "ul",
        items: [
          "Usa lenguaje claro: 'Pase corto' es mejor que 'Habilidad técnica 1'",
          "Evalúa al menos 3 habilidades por jugador cada 4-6 semanas",
          "Sé constructivo en comentarios — los padres los leen",
          "Marca evaluaciones consistentes en el tiempo (mismo nombre de habilidad) para que el padre vea progreso real",
        ],
      },
      {
        type: "callout",
        variant: "tip",
        content:
          "Las evaluaciones aparecen en orden cronológico inverso en el perfil del jugador. Si calificas 'Resistencia aeróbica' con 60 hoy y con 75 en 8 semanas, el padre ve esa mejora claramente.",
      },
      { type: "h2", content: "Quién ve las evaluaciones" },
      {
        type: "table",
        headers: ["Rol", "Qué ve"],
        rows: [
          ["Coach que la creó", "Todo, editar/eliminar"],
          ["Otros coaches del equipo", "Solo lectura"],
          ["Director / admin", "Todo, exportable"],
          ["Padre", "Solo las evaluaciones de su(s) hijo(s)"],
          ["Atleta mayor de edad", "Sus propias evaluaciones"],
        ],
      },
    ],
    related: ["planes-entrenamiento", "reportes-coach"],
  },
  {
    slug: "certificados-digitales",
    categoryId: "gestion-alumnos",
    title: "Generar certificados digitales (constancias)",
    excerpt:
      "Constancia de estudio, conducta, médica o de pago — con firma digital, plantillas personalizables y opción de cobrar por la emisión.",
    readTime: "5 min",
    targetRole: ["school"],
    body: [
      {
        type: "p",
        content:
          "Las certificaciones digitales reemplazan los típicos PDF que arma el administrativo a mano cada vez que un padre lo pide. Configurás la plantilla una vez, y desde ahí los emites con un clic o el padre las solicita y paga directamente.",
      },
      { type: "h2", content: "Tipos de certificado disponibles" },
      {
        type: "table",
        headers: ["Tipo", "Uso típico"],
        rows: [
          ["Constancia de estudio", "Para colegios, becas, descuentos"],
          ["Constancia de conducta", "Comportamiento y compromiso del atleta"],
          ["Constancia médica", "Aptitud física para competencia"],
          ["Constancia de pago", "Soporte de pagos al día"],
          ["Constancia de federación", "Aval ante ligas o federaciones"],
          ["Personalizada", "Cualquier otro caso (custom)"],
        ],
      },
      { type: "h2", content: "Configurar una plantilla" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Certificados → Plantillas → 'Nueva plantilla'",
      },
      {
        type: "ol",
        items: [
          "Nombre interno de la plantilla (ej: 'Constancia estudio 2026')",
          "Tipo (estudio / conducta / médica / pago / federación / personalizada)",
          "Título visible en el documento (ej: 'CONSTANCIA')",
          "Cuerpo del texto con variables auto-completadas",
          "Datos de firma: nombre, cargo, imagen de firma (opcional)",
          "Texto del pie de página (opcional, ej: dirección de la escuela)",
        ],
      },
      { type: "h2", content: "Variables disponibles" },
      {
        type: "table",
        headers: ["Variable", "Se reemplaza por"],
        rows: [
          ["{{atleta.nombre}}", "Nombre completo del deportista"],
          ["{{atleta.tipo_doc}}", "Tipo de documento (CC, TI, etc.)"],
          ["{{atleta.documento}}", "Número de documento"],
          ["{{equipo}}", "Equipo al que pertenece"],
          ["{{sede}}", "Sede de la escuela"],
          ["{{escuela.nombre}}", "Nombre de tu academia"],
          ["{{inscripcion.vence}}", "Fecha de vencimiento de la inscripción"],
          ["{{fecha_actual}}", "Fecha de emisión del certificado"],
        ],
      },
      { type: "h2", content: "Cobrar por la emisión (opcional)" },
      {
        type: "p",
        content:
          "Si activás 'Requiere pago' en la plantilla, los padres pueden solicitar el certificado desde su app y el sistema les cobra automáticamente (vía Wompi). Útil para constancias administrativas que ya cobrás manualmente. Define monto y moneda.",
      },
      {
        type: "callout",
        variant: "tip",
        content:
          "Activá 'Plantilla por defecto' en la más usada de cada tipo. Cuando emitís un certificado nuevo, esa aparece preseleccionada.",
      },
      { type: "h2", content: "Verificación pública" },
      {
        type: "p",
        content:
          "Cada certificado emitido tiene un código de verificación pública. Quien lo reciba (colegio, federación) puede verificarlo en sportmaps.co/verificar sin tener cuenta. Esto previene falsificaciones.",
      },
    ],
    related: ["configurar-sedes-equipos"],
  },
  {
    slug: "wellness-citas-pacientes",
    categoryId: "operacion-diaria",
    title: "Wellness: agenda de citas y gestión de pacientes",
    excerpt:
      "Si tu academia incluye fisio, nutrición o psicología deportiva, gestiona citas, estados y pacientes en una sola vista.",
    readTime: "4 min",
    targetRole: ["school"],
    body: [
      {
        type: "p",
        content:
          "El módulo Wellness está pensado para academias con fisio o psicólogo deportivo interno (combo Academia Salud Deportiva). También sirve para centros de bienestar standalone.",
      },
      { type: "h2", content: "Vista de agenda" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Wellness → Agenda",
      },
      {
        type: "p",
        content:
          "La vista principal muestra citas de hoy y mañana en tarjetas separadas. Cada cita tiene su estado, hora, paciente y profesional asignado.",
      },
      { type: "h2", content: "Estados de una cita" },
      {
        type: "table",
        headers: ["Estado", "Significa"],
        rows: [
          ["Pendiente", "Reservada pero el paciente aún no confirma"],
          ["Confirmada", "Paciente confirmó asistencia"],
          ["Completada", "Cita realizada"],
          ["Cancelada", "Cancelada por paciente o profesional"],
        ],
      },
      { type: "h2", content: "Crear una cita manualmente" },
      {
        type: "ol",
        items: [
          "Botón 'Nueva cita' en la parte superior",
          "Selecciona paciente (o créalo si es nuevo)",
          "Profesional asignado y especialidad",
          "Fecha y hora (el sistema valida disponibilidad)",
          "Tipo de consulta (primera vez, seguimiento, urgencia)",
          "Notas internas (opcional, no las ve el paciente)",
        ],
      },
      { type: "h2", content: "Citas que el paciente reserva solo" },
      {
        type: "p",
        content:
          "Si activás 'Reservas online' en el plan Wellness Pro, el paciente puede reservar desde la app sin que tengas que hacer nada. Configurá disponibilidad por profesional desde Menú: Wellness → Configuración → Horarios.",
      },
      {
        type: "callout",
        variant: "tip",
        content:
          "WhatsApp AI puede confirmar citas automáticamente 24h antes. Activalo en Configuración → WhatsApp AI → módulos → 'Confirmaciones Wellness'. Reduce no-shows ~40%.",
      },
    ],
    related: ["calendario-reservas"],
  },
  {
    slug: "tienda-inventario-productos",
    categoryId: "gestion-alumnos",
    title: "Tienda: gestión de productos e inventario",
    excerpt:
      "Si vendés uniformes, accesorios o merchandising, controla stock, productos y alertas de bajo inventario desde un solo panel.",
    readTime: "4 min",
    targetRole: ["school"],
    body: [
      {
        type: "p",
        content:
          "El módulo Tienda funciona como un mini-marketplace integrado: productos, stock, pedidos y conciliación con Wompi. Activado en el combo Academia + Tienda o como módulo independiente con Marketplace Pro.",
      },
      { type: "h2", content: "Vista de inventario" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Tienda → Inventario",
      },
      {
        type: "p",
        content:
          "El panel muestra 4 indicadores clave: Total Productos, Productos con Stock Bajo, Valor Total de Inventario y Productos sin Stock.",
      },
      { type: "h2", content: "Agregar un producto" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Tienda → Productos → 'Nuevo producto'",
      },
      {
        type: "ol",
        items: [
          "Nombre y descripción del producto",
          "Foto (recomendado mínimo 600×600px)",
          "Categoría (Uniforme / Accesorio / Equipamiento / Otros)",
          "Variantes (tallas, colores) — opcional",
          "Precio en COP",
          "Stock inicial",
          "Umbral de stock bajo (ej: si stock < 20 te alerta)",
        ],
      },
      { type: "h2", content: "Alerta de stock bajo" },
      {
        type: "p",
        content:
          "Cualquier producto con stock por debajo del umbral configurado aparece destacado en rojo en el panel de Inventario. Útil para reabastecer antes de quedar en cero. Por defecto el umbral es 20 unidades.",
      },
      { type: "h2", content: "Gestión de pedidos" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Tienda → Pedidos",
      },
      {
        type: "p",
        content:
          "Cada pedido (de padre o atleta) genera una orden con estado: Pendiente → Pago Confirmado → En preparación → Listo para retiro → Entregado. Marca el estado manualmente o automatiza con WhatsApp AI.",
      },
      {
        type: "callout",
        variant: "tip",
        content:
          "Si las tallas son críticas (uniformes para temporada), agregá la talla como variante separada. Si el padre selecciona M y no hay stock, no puede completar la compra — evita errores de despacho.",
      },
    ],
    related: ["configurar-wompi-pagos-online"],
  },
  {
    slug: "reportes-coach",
    categoryId: "operacion-diaria",
    title: "Reportes para coaches: asistencia, evaluaciones y resultados",
    excerpt:
      "Cada coach tiene un panel con métricas de sus equipos: asistencia, rendimiento, resultados de partidos y uniformes pendientes.",
    readTime: "4 min",
    targetRole: ["coach"],
    body: [
      {
        type: "p",
        content:
          "Mientras el director ve métricas de toda la academia, cada coach ve solo lo de SUS equipos. El panel está armado para responder en 30 segundos a las preguntas frecuentes: '¿cómo va el equipo este mes?', '¿quién tiene problemas de asistencia?', '¿qué pasó en el último partido?'.",
      },
      { type: "h2", content: "Pestañas del panel" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Reportes (en panel de coach)",
      },
      {
        type: "table",
        headers: ["Pestaña", "Contenido"],
        rows: [
          ["General", "Métricas resumen del equipo seleccionado"],
          ["Asistencia", "Porcentajes por sesión, ranking de asistencia individual"],
          ["Evaluaciones", "Progreso de cada jugador, comparativa vs equipo"],
          ["Partidos", "Resultados, goles, asistencias, tarjetas"],
          ["Uniformes", "Quién tiene/no tiene cada prenda"],
        ],
      },
      { type: "h2", content: "Filtros disponibles" },
      {
        type: "ul",
        items: [
          "Por equipo (si manejas varios)",
          "Por rango de fechas (último mes, semestre, año)",
          "Por jugador específico (drill-down)",
        ],
      },
      { type: "h2", content: "Exportar reportes" },
      {
        type: "p",
        content:
          "Cualquier pestaña tiene botón 'Descargar' que exporta a Excel/PDF. Útil cuando el director te pide un resumen escrito, o para reuniones con padres.",
      },
      {
        type: "callout",
        variant: "tip",
        content:
          "Las flechas verticales (↑↓-) al lado de cada métrica indican tendencia vs período anterior. Si la asistencia baja consecutivamente 2 semanas, vale la pena hablar con el equipo antes de que se vuelva un patrón.",
      },
    ],
    related: ["evaluaciones-jugadores", "tomar-asistencia-coach"],
  },
  {
    slug: "encuestas-asistencia",
    categoryId: "operacion-diaria",
    title: "Encuestas de asistencia: confirmar quién va a la próxima sesión",
    excerpt:
      "Manda un link a tu equipo, los padres confirman si su hijo va o no, ves la lista consolidada. Cero grupos de WhatsApp.",
    readTime: "3 min",
    targetRole: ["school", "coach"],
    body: [
      {
        type: "p",
        content:
          "Las encuestas reemplazan los típicos '¿quién va al partido del sábado?' por WhatsApp donde 30 padres responden desordenado. Generás un link único, lo compartís por WhatsApp, los padres confirman con un clic, y ves los confirmados en vivo.",
      },
      { type: "h2", content: "Crear una encuesta" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Encuestas → 'Nueva encuesta'",
      },
      {
        type: "ol",
        items: [
          "Nombre de la encuesta (ej: 'Partido vs Cóndores - Sábado 12 May')",
          "Selecciona equipo o lista de atletas",
          "Define las sesiones (puede ser una sola fecha o varias)",
          "Fecha de cierre (después no se pueden confirmar más)",
          "Crear",
        ],
      },
      { type: "h2", content: "Compartir el link" },
      {
        type: "p",
        content:
          "Cuando se crea, aparece un botón 'Compartir'. Copia el link y pegalo en el grupo de WhatsApp del equipo. Cada padre hace clic, ve solo a su(s) hijo(s), confirma o declina.",
      },
      {
        type: "callout",
        variant: "info",
        content:
          "El link es público (cualquiera con el link puede ver y confirmar). Es por diseño — no obliga al padre a tener cuenta SportMaps para responder.",
      },
      { type: "h2", content: "Ver resultados" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Encuestas → click en cualquier encuesta",
      },
      {
        type: "p",
        content:
          "Verás los confirmados de cada sesión, con nombre del atleta y avatar del padre que confirmó. Conteo total al inicio.",
      },
      { type: "h2", content: "Acciones del admin" },
      {
        type: "ul",
        items: [
          "'Cerrar encuesta' — bloquea más confirmaciones",
          "'Agregar manualmente' — útil si un padre confirma por WhatsApp directo y querés que aparezca en la lista",
          "'Eliminar confirmación' — si un padre canceló después",
        ],
      },
      {
        type: "callout",
        variant: "tip",
        content:
          "Para eventos grandes (torneos, festivales), creá la encuesta 1-2 semanas antes con fecha de cierre 48h antes del evento. Te da tiempo a planificar logística (canchas, transporte, refrigerios) con la lista confirmada.",
      },
    ],
    related: ["calendario-reservas", "tomar-asistencia-coach"],
  },
  {
    slug: "reportes-financieros-asistencia",
    categoryId: "operacion-diaria",
    title: "Reportes financieros y de asistencia",
    excerpt:
      "Los 5 reportes que todo director deportivo revisa cada semana: ingresos, mora, asistencia, churn y conversión.",
    readTime: "4 min",
    targetRole: ["school"],
    body: [
      {
        type: "p",
        content:
          "SportMaps incluye reportes pre-armados que cubren el 95% de lo que necesitás. Acá los 5 más usados y cómo leerlos.",
      },
      { type: "h2", content: "1. Reporte de ingresos mensuales" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Reportes → Financieros → Ingresos",
      },
      {
        type: "p",
        content:
          "Muestra todos los pagos exitosos del mes (Wompi + manual), agrupados por plan, sede y método de pago. Útil para conciliación contable.",
      },
      { type: "h2", content: "2. Reporte de mora" },
      {
        type: "p",
        content:
          "Lista todos los pagos con +X días de atraso (vos definís X). Indica el monto perdido si no se cobra, el padre asociado y los últimos contactos hechos.",
      },
      { type: "h2", content: "3. Asistencia por equipo" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Reportes → Operativos → Asistencia",
      },
      {
        type: "p",
        content:
          "Porcentaje de asistencia promedio por equipo en el último mes. Sirve para detectar equipos con problemas: si un equipo cae de 85% a 60% en un mes, algo está pasando.",
      },
      { type: "h2", content: "4. Churn mensual" },
      {
        type: "p",
        content:
          "% de alumnos que se dieron de baja en el mes. Meta: <3%. El reporte te muestra los motivos declarados (si los pediste al dar de baja).",
      },
      { type: "h2", content: "5. Conversión de inscripciones" },
      {
        type: "p",
        content:
          "De los padres que vieron tu página pública o respondieron una invitación, qué porcentaje terminó pagando la primera mensualidad. Mide la efectividad de tu onboarding.",
      },
      {
        type: "callout",
        variant: "tip",
        content:
          "Configurá alertas para que el sistema te avise por email cuando alguna métrica salga del rango aceptable. Menú: Reportes → Alertas.",
      },
    ],
    related: ["tomar-asistencia-coach", "plantillas-recordatorios"],
  },
  // ===========================================================================
  // Entrenadores personales (módulo trainer/ del producto)
  // ===========================================================================
  {
    slug: "trainer-onboarding",
    categoryId: "entrenadores-personales",
    title: "Setup inicial: los 6 pasos para empezar como entrenador",
    excerpt:
      "Onboarding guiado: deporte y experiencia, modalidad, disponibilidad, tarifas, métodos de cobro y perfil público.",
    readTime: "5 min",
    targetRole: ["coach"],
    body: [
      {
        type: "p",
        content:
          "El onboarding de Entrenador Personal toma ~10 minutos y al final te queda tu perfil público listo para captar clientes. Son 6 pasos que podés guardar y retomar.",
      },
      { type: "h2", content: "Los 6 pasos" },
      {
        type: "table",
        headers: ["#", "Paso", "Qué configurás"],
        rows: [
          ["1", "Tu Deporte", "Especialidades, años de experiencia, certificaciones"],
          ["2", "Modalidad", "Presencial / Virtual / Grupal y zonas donde entrenás"],
          ["3", "Disponibilidad", "Días y horarios disponibles cada semana"],
          ["4", "Tarifas", "Precio por sesión individual y por bonos de varias sesiones"],
          ["5", "Pagos", "Wompi, transferencia, efectivo — qué métodos aceptás"],
          ["6", "Perfil", "Foto, presentación y video opcional"],
        ],
      },
      {
        type: "callout",
        variant: "tip",
        content:
          "Los primeros 3 pasos podés saltarlos y volver, pero Tarifas + Perfil son los que más impactan tu conversión cuando un cliente potencial te encuentra.",
      },
      {
        type: "cta",
        title: "Editá tu perfil cuando quieras",
        description: "Cualquier cambio se refleja en tu link público.",
        href: "/ayuda/trainer-perfil-publico",
        label: "Guía de perfil público",
      },
    ],
    related: ["trainer-perfil-publico", "trainer-clientes"],
  },
  {
    slug: "trainer-perfil-publico",
    categoryId: "entrenadores-personales",
    title: "Configurá tu perfil público (tu link de captación)",
    excerpt:
      "Tu link público es lo que compartís en redes y WhatsApp para que potenciales clientes te encuentren y te contraten.",
    readTime: "3 min",
    targetRole: ["coach"],
    body: [
      {
        type: "p",
        content:
          "Cada entrenador tiene un perfil público en sportmaps.co/coach/[tu-nombre] que muestra tu foto, deportes, modalidades, tarifas y reseñas. Es lo que ves cuando das clic en 'Vista previa' desde tu perfil.",
      },
      { type: "h2", content: "Editar el perfil" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Mi Perfil Público",
      },
      {
        type: "ol",
        items: [
          "Presentación: 2-3 párrafos sobre ti, tu metodología, qué te diferencia",
          "Foto profesional (no selfie de gimnasio sin contexto)",
          "Modalidades y zonas — sé específico (ej: 'Funcional outdoor en Salitre' > 'Funcional en Bogotá')",
          "Tarifas visibles o 'A consultar' (la transparencia convierte mejor)",
          "Instagram y otros sociales si los tenés",
          "Guardar — el link público se actualiza en tiempo real",
        ],
      },
      {
        type: "callout",
        variant: "tip",
        content:
          "Pegá tu link público en tu bio de Instagram y en la firma de WhatsApp Business. Es el cambio más rentable que harás en este perfil.",
      },
    ],
    related: ["trainer-onboarding", "trainer-disponibilidad-tarifas"],
  },
  {
    slug: "trainer-clientes",
    categoryId: "entrenadores-personales",
    title: "Gestión de clientes: agregar, invitar y ver perfil completo",
    excerpt:
      "Tu lista de clientes con búsqueda, datos de contacto y perfil completo con progreso, entrenamientos, stats y objetivos.",
    readTime: "4 min",
    targetRole: ["coach"],
    body: [
      {
        type: "p",
        content:
          "La sección 'Gestión de Clientes' es tu CRM de entrenamiento personal. Acá ves a todos tus clientes activos, sus datos de contacto y un perfil detallado por cada uno.",
      },
      { type: "h2", content: "Agregar un cliente" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Clientes → botón 'Agregar' (UserPlus)",
      },
      {
        type: "ul",
        items: [
          "Crear cliente directamente con sus datos (nombre, email, teléfono)",
          "O enviar invitación por email — el cliente crea su cuenta y queda vinculado",
        ],
      },
      { type: "h2", content: "Buscar y filtrar" },
      {
        type: "p",
        content:
          "Búsqueda por nombre o email. Útil cuando tu lista pasa los 30-40 clientes.",
      },
      { type: "h2", content: "Perfil de un cliente" },
      {
        type: "p",
        content:
          "Al hacer clic en un cliente ves 4 pestañas: Entrenamiento (rutinas asignadas), Progreso (mejoras en habilidades), Stats (asistencia y consistencia) y Objetivos (metas que el cliente puso o vos definiste).",
      },
    ],
    related: ["trainer-rutinas", "trainer-perfil-publico"],
  },
  {
    slug: "trainer-rutinas",
    categoryId: "entrenadores-personales",
    title: "Crear rutinas y asignarlas a tus clientes",
    excerpt:
      "Diseñá rutinas reutilizables, asignalas a uno o varios clientes y monitorea cumplimiento.",
    readTime: "4 min",
    targetRole: ["coach"],
    body: [
      {
        type: "p",
        content:
          "Las rutinas en SportMaps son plantillas reutilizables. Creás una vez 'Full Body 45 min - Intermedio' y la asignás a 10 clientes diferentes. Cada uno la ve en su app.",
      },
      { type: "h2", content: "Crear una rutina" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Mis Rutinas → botón '+' (Plus)",
      },
      {
        type: "ol",
        items: [
          "Nombre claro (ej: 'Push - Hipertrofia', 'Cardio HIIT 20 min')",
          "Ejercicios: nombre, series, reps, descanso, peso si aplica",
          "Notas o video tutorial (opcional)",
          "Etiquetas: deporte, nivel, duración estimada",
          "Guardar — la rutina queda en tu biblioteca",
        ],
      },
      { type: "h2", content: "Asignar a un cliente" },
      {
        type: "p",
        content:
          "Desde el perfil del cliente → pestaña Entrenamiento → 'Asignar rutina' → seleccioná de tu biblioteca. El cliente la ve en su app y podés ver cuándo la completó.",
      },
      {
        type: "callout",
        variant: "tip",
        content:
          "Usá búsqueda y filtros en Mis Rutinas para encontrar rápido. Si tenés 50+ rutinas, organizá por etiquetas (cardio/fuerza/movilidad).",
      },
    ],
    related: ["trainer-clientes"],
  },
  {
    slug: "trainer-disponibilidad-tarifas",
    categoryId: "entrenadores-personales",
    title: "Configurar disponibilidad y tarifas",
    excerpt:
      "Definí qué días y horas atendés, y cuánto cobrás por sesión o por paquete de sesiones.",
    readTime: "3 min",
    targetRole: ["coach"],
    body: [
      { type: "h2", content: "Disponibilidad semanal" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Disponibilidad",
      },
      {
        type: "p",
        content:
          "Configurás qué días de la semana atendés y los rangos horarios de cada día. Ej: 'Lunes a Viernes 6am-10am y 5pm-9pm'. El cliente solo puede reservar dentro de esos rangos.",
      },
      {
        type: "ul",
        items: [
          "Podés bloquear fechas específicas (vacaciones, eventos)",
          "Podés diferenciar por modalidad: presencial L-V, virtual sábados",
          "El cliente ve solo los slots que YA tenés libres (no los reservados)",
        ],
      },
      { type: "h2", content: "Tarifas" },
      {
        type: "p",
        content:
          "Configurás precio por sesión individual y bonos de N sesiones con descuento. Ej: 1 sesión = $80.000, bono de 8 sesiones = $560.000 (= $70k c/u, 13% off).",
      },
      {
        type: "callout",
        variant: "tip",
        content:
          "Los bonos generan compromiso: el cliente que prepaga 8 sesiones es 3x más probable de completarlas. Considera empujar el bono como opción default en tu perfil.",
      },
    ],
    related: ["trainer-pagos-cobranza", "trainer-perfil-publico"],
  },
  {
    slug: "trainer-pagos-cobranza",
    categoryId: "entrenadores-personales",
    title: "Recibir pagos de tus clientes",
    excerpt:
      "Wompi para tarjeta/PSE, transferencia o efectivo. Conciliación automática y payout a tu cuenta.",
    readTime: "3 min",
    targetRole: ["coach"],
    body: [
      {
        type: "p",
        content:
          "Cuando un cliente reserva una sesión o paquete, paga directamente desde la app (Wompi) o registrás manualmente lo que recibiste en efectivo/transferencia.",
      },
      { type: "h2", content: "Métodos disponibles" },
      {
        type: "table",
        headers: ["Método", "Cuándo usar"],
        rows: [
          ["Wompi (tarjeta/PSE)", "Cliente paga online desde la app, recibís el pago en tu cuenta Wompi"],
          ["Transferencia bancaria", "Cliente transfiere a tu cuenta, vos registrás el pago manual"],
          ["Efectivo", "Cliente paga al final de la sesión, vos registrás manual"],
        ],
      },
      { type: "h2", content: "Ver tus cobros" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Pagos",
      },
      {
        type: "p",
        content:
          "Verás pagos recibidos, pagos pendientes y resumen mensual. Útil para tu contabilidad personal y declaración de renta.",
      },
      {
        type: "callout",
        variant: "tip",
        content:
          "Wompi te paga a tu cuenta bancaria automáticamente cada 24-48h. Configurá tu cuenta de payout en comercio.wompi.co.",
      },
    ],
    related: ["trainer-disponibilidad-tarifas", "configurar-wompi-pagos-online"],
  },
  // ===========================================================================
  // Organizadores de eventos (módulo organizer/ del producto)
  // ===========================================================================
  {
    slug: "organizer-onboarding",
    categoryId: "organizadores-eventos",
    title: "Setup inicial como organizador de eventos",
    excerpt:
      "Crea tu cuenta de organizador, selecciona deportes, sube documentación legal y comienza a publicar eventos.",
    readTime: "3 min",
    targetRole: ["all"],
    body: [
      {
        type: "p",
        content:
          "El onboarding de Organizador toma 5-10 minutos. Al final tenés capacidad de crear eventos públicos con inscripciones, pagos y boletería.",
      },
      { type: "h2", content: "Pasos del onboarding" },
      {
        type: "ol",
        items: [
          "Datos de la organización: nombre, ciudad, RUT/NIT, sitio web",
          "Deportes que organizas (al menos uno obligatorio)",
          "Documentación legal: certificados, permisos, seguros relevantes",
          "Datos bancarios para recibir pagos (cuenta y banco)",
          "Foto / logo del organizador",
        ],
      },
      {
        type: "callout",
        variant: "info",
        content:
          "Como Organizador no hay tier público de precios — todo es cotización a medida según volumen de eventos. Tras el onboarding ventas te contacta para definir tu plan.",
      },
      {
        type: "cta",
        title: "Crear tu primer evento",
        description: "El wizard de creación toma 10 minutos.",
        href: "/ayuda/organizer-crear-evento",
        label: "Ver guía",
      },
    ],
    related: ["organizer-crear-evento"],
  },
  {
    slug: "organizer-crear-evento",
    categoryId: "organizadores-eventos",
    title: "Crear un evento: wizard de 4 pasos",
    excerpt:
      "Info Básica → Categorías → Paquetes → Fechas y Reglas. Cada paso es independiente y guardable.",
    readTime: "5 min",
    targetRole: ["all"],
    body: [
      {
        type: "p",
        content:
          "El wizard de creación de evento te lleva por las 4 decisiones clave que necesita SportMaps para abrir inscripciones, cobrar y entregar boletería QR.",
      },
      { type: "h2", content: "Paso 1 — Info Básica" },
      {
        type: "ul",
        items: [
          "Nombre del evento",
          "Deporte y modalidad",
          "Ubicación (con dirección exacta — entra al mapa SportMaps)",
          "Imagen de portada",
          "Descripción visible al público",
        ],
      },
      { type: "h2", content: "Paso 2 — Categorías" },
      {
        type: "p",
        content:
          "Divisiones del evento (ej: Infantil sub-10, Juvenil sub-14, Élite, Veteranos). Definís edades, género y nivel para cada una. Esto permite que un mismo evento tenga inscripciones segmentadas.",
      },
      { type: "h2", content: "Paso 3 — Paquetes" },
      {
        type: "p",
        content:
          "Tarifas por fase. Típicamente: 'Early bird' (precio bajo, hasta X fecha) → 'Regular' → 'Last minute'. SportMaps cambia automáticamente el precio según la fecha.",
      },
      { type: "h2", content: "Paso 4 — Fechas y Reglas" },
      {
        type: "ul",
        items: [
          "Fecha del evento",
          "Fecha de cierre de inscripciones",
          "Documentos obligatorios (cédula, EPS, autorización menor)",
          "Política de cancelación y reembolsos",
          "Cantidad máxima de cupos por categoría",
        ],
      },
      {
        type: "callout",
        variant: "tip",
        content:
          "Podés guardar el evento en borrador en cualquier paso. Hasta que lo publiques, no aparece al público.",
      },
    ],
    related: ["organizer-gestionar-evento", "organizer-finanzas-payouts"],
  },
  {
    slug: "organizer-gestionar-evento",
    categoryId: "organizadores-eventos",
    title: "Gestionar un evento durante inscripciones",
    excerpt:
      "Ver inscritos en vivo, validar comprobantes, comunicar masivamente y exportar listas para el día del evento.",
    readTime: "4 min",
    targetRole: ["all"],
    body: [
      { type: "h2", content: "Panel del evento" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Eventos → click en un evento",
      },
      {
        type: "p",
        content:
          "Vista en tiempo real: cuántos inscritos por categoría, ingresos generados, documentos pendientes de validación, comunicaciones enviadas.",
      },
      { type: "h2", content: "Validar inscripciones" },
      {
        type: "p",
        content:
          "Si exigís documentos (cédula, EPS), las inscripciones quedan 'Pendientes de validación' hasta que aprobás. El atleta recibe notificación cuando lo aprobás.",
      },
      { type: "h2", content: "Comunicación masiva" },
      {
        type: "ul",
        items: [
          "Mandar email a todos los inscritos de una categoría",
          "Notificación in-app",
          "WhatsApp masivo si tenés módulo activado",
        ],
      },
      { type: "h2", content: "Día del evento" },
      {
        type: "p",
        content:
          "Boletería QR: cada inscrito tiene un código único. En la puerta usás la app móvil para escanearlo y marcar 'Asistió'. Lista exportable a Excel/PDF.",
      },
    ],
    related: ["organizer-crear-evento", "organizer-reportes-evento"],
  },
  {
    slug: "organizer-finanzas-payouts",
    categoryId: "organizadores-eventos",
    title: "Finanzas: cobros, conciliación y payout",
    excerpt:
      "Cómo se recauda el dinero del evento, conciliación con Wompi y pagos manuales, y payout a tu cuenta bancaria.",
    readTime: "4 min",
    targetRole: ["all"],
    body: [
      {
        type: "p",
        content:
          "SportMaps recauda el dinero de las inscripciones (vía Wompi) y te lo transfiere a tu cuenta bancaria según el cronograma de payout que pactemos en tu contrato.",
      },
      { type: "h2", content: "Métodos de cobro disponibles" },
      {
        type: "ul",
        items: [
          "Wompi: tarjeta de crédito/débito + PSE + Nequi (automático)",
          "Transferencia bancaria: el atleta transfiere y sube comprobante (max 5MB), vos validas",
          "Efectivo: el atleta paga en persona el día del evento (lo marcas manualmente)",
        ],
      },
      { type: "h2", content: "Conciliación" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Finanzas → Conciliación",
      },
      {
        type: "p",
        content:
          "Verás todos los pagos por estado: Confirmados, Pendientes (con comprobante), Rechazados. Conciliación 1-click si todo está OK.",
      },
      { type: "h2", content: "Payout a tu cuenta" },
      {
        type: "p",
        content:
          "Configurás cuenta bancaria en Settings → Datos bancarios. SportMaps transfiere según frecuencia pactada (semanal típicamente). La comisión se descuenta antes del payout.",
      },
    ],
    related: ["organizer-gestionar-evento", "configurar-wompi-pagos-online"],
  },
  {
    slug: "organizer-reportes-evento",
    categoryId: "organizadores-eventos",
    title: "Reportes post-evento",
    excerpt:
      "NPS de atletas, asistencia real vs inscritos, ingresos finales y métricas para comparar con eventos futuros.",
    readTime: "3 min",
    targetRole: ["all"],
    body: [
      {
        type: "p",
        content:
          "Después del evento, SportMaps consolida automáticamente los reportes que necesitás para decidir qué cambiar en el próximo.",
      },
      { type: "h2", content: "Reportes disponibles" },
      {
        type: "table",
        headers: ["Reporte", "Mide"],
        rows: [
          ["Asistencia", "% de inscritos que efectivamente fueron"],
          ["Ingresos finales", "Total recaudado por categoría/paquete"],
          ["NPS", "Qué tan probable es que recomienden tu evento"],
          ["Origen", "Cómo se enteraron del evento (UTM tracking)"],
          ["Demografía", "Edades, género, ciudad de los inscritos"],
        ],
      },
      {
        type: "callout",
        variant: "tip",
        content:
          "Comparalo con tus eventos anteriores en SportMaps. Si el NPS baja consistente, algo está pasando en la experiencia del día — no solo en marketing.",
      },
    ],
    related: ["organizer-gestionar-evento"],
  },
  // ===========================================================================
  // Tiendas y proveedores (módulo vendor/ del producto)
  // ===========================================================================
  {
    slug: "vendor-onboarding",
    categoryId: "tiendas-proveedores",
    title: "Setup inicial de tu tienda",
    excerpt:
      "Crea tu cuenta de vendor: nombre, ciudad, deportes que cubrís, datos bancarios para recibir pagos.",
    readTime: "3 min",
    targetRole: ["all"],
    body: [
      {
        type: "p",
        content:
          "El onboarding de Tienda es corto (5 min). Al final tenés tu perfil público de tienda visible en el mapa SportMaps y podés cargar productos.",
      },
      { type: "h2", content: "Datos requeridos" },
      {
        type: "ol",
        items: [
          "Nombre comercial de la tienda (obligatorio)",
          "Ciudad principal de operación (obligatorio)",
          "Deportes que cubrís (selección múltiple)",
          "Descripción corta",
          "Logo / imagen de portada",
          "Datos bancarios para payouts",
        ],
      },
      {
        type: "callout",
        variant: "tip",
        content:
          "La descripción aparece en tu perfil público — invierte 5 min haciéndola buena. Lo que cuenta: deportes, marcas que distribuyes, qué te diferencia.",
      },
    ],
    related: ["vendor-productos-catalogo"],
  },
  {
    slug: "vendor-productos-catalogo",
    categoryId: "tiendas-proveedores",
    title: "Catálogo de productos: agregar, editar, archivar",
    excerpt:
      "Carga productos con fotos, variantes, stock y precios. Archivá los que ya no vendés sin perder histórico.",
    readTime: "4 min",
    targetRole: ["all"],
    body: [
      { type: "h2", content: "Agregar un producto" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Mis Productos → '+ Nuevo producto'",
      },
      {
        type: "ol",
        items: [
          "Nombre, descripción y categoría",
          "Fotos (mínimo 1, recomendado 3 — frontal, detalle, contexto)",
          "Variantes si aplica (talla, color, modelo)",
          "Precio y stock por variante",
          "Marca si distribuís productos de marcas específicas",
          "Publicar (visible) o guardar como borrador",
        ],
      },
      { type: "h2", content: "Archivar productos" },
      {
        type: "p",
        content:
          "Si dejás de vender un producto, no lo elimines — archivalo. Así mantenés el histórico de pedidos pasados. Botón 'Archivar' en el menú del producto.",
      },
      {
        type: "callout",
        variant: "tip",
        content:
          "Marcas oficiales con precios mayoristas convierten 2x más que productos sin marca. Si revendés Adidas/Nike/Wilson, ponelo en el nombre del producto.",
      },
    ],
    related: ["vendor-payouts-shipping", "vendor-promociones"],
  },
  {
    slug: "vendor-citas-servicios",
    categoryId: "tiendas-proveedores",
    title: "Vender servicios (no solo productos): citas y agenda",
    excerpt:
      "Si vendés instalación, mantenimiento o servicio técnico, gestiona citas con agenda integrada.",
    readTime: "3 min",
    targetRole: ["all"],
    body: [
      {
        type: "p",
        content:
          "Si tu negocio incluye servicios (no solo productos físicos), SportMaps incluye un módulo de agendamiento. Útil para: mantenimiento de bicicletas, encordado de raquetas, fitting, etc.",
      },
      { type: "h2", content: "Configurar un servicio" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Mis Servicios → '+ Nuevo servicio'",
      },
      {
        type: "ul",
        items: [
          "Nombre del servicio (ej: 'Cambio de cubiertas + ajuste frenos')",
          "Duración estimada (afecta los slots disponibles)",
          "Precio",
          "Anticipo requerido (% del total, opcional)",
          "Días/horas disponibles",
        ],
      },
      { type: "h2", content: "Ver y gestionar citas" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Citas",
      },
      {
        type: "p",
        content:
          "Vista de agenda con citas por día. Cada cita tiene su estado (pendiente, confirmada, completada, cancelada) y los datos del cliente.",
      },
    ],
    related: ["vendor-productos-catalogo"],
  },
  {
    slug: "vendor-payouts-shipping",
    categoryId: "tiendas-proveedores",
    title: "Recibir pagos y configurar envíos",
    excerpt:
      "Cobros automáticos vía Wompi, payout a tu cuenta y configuración de envíos por ciudad o nacional.",
    readTime: "4 min",
    targetRole: ["all"],
    body: [
      { type: "h2", content: "Cómo se recibe el pago" },
      {
        type: "p",
        content:
          "Cuando un cliente compra, paga online (Wompi: tarjeta/PSE/Nequi). El dinero entra a la cuenta de SportMaps; te lo transferimos a tu cuenta bancaria según frecuencia pactada (típicamente semanal). La comisión se descuenta antes del payout.",
      },
      { type: "h2", content: "Ver payouts pendientes" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Pagos / Payouts",
      },
      {
        type: "p",
        content:
          "Verás monto disponible para retiro, monto en hold (pedidos no entregados aún) y histórico de payouts. Útil para tu conciliación contable.",
      },
      { type: "h2", content: "Configurar envíos" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Configuración → Envíos",
      },
      {
        type: "ul",
        items: [
          "Zonas que cubrís (tu ciudad, área metropolitana, nacional)",
          "Tarifas por zona o gratis sobre cierto monto",
          "Tiempos de entrega estimados",
          "Métodos: domicilio propio, integración Servientrega/Coordinadora, retiro en local",
        ],
      },
    ],
    related: ["vendor-productos-catalogo"],
  },
  {
    slug: "vendor-promociones",
    categoryId: "tiendas-proveedores",
    title: "Crear promociones y descuentos",
    excerpt:
      "Descuentos por código, 2x1, descuento por volumen, ofertas temporales. Configura una vez, corre solo.",
    readTime: "3 min",
    targetRole: ["all"],
    body: [
      { type: "h2", content: "Tipos de promociones" },
      {
        type: "table",
        headers: ["Tipo", "Ejemplo"],
        rows: [
          ["Código de descuento", "'FUTBOL10' → 10% off (compartible por marketing)"],
          ["Descuento por volumen", "Compra 3 cubiertas, paga 2"],
          ["Oferta temporal", "Black Friday: 30% en toda la tienda 3 días"],
          ["Descuento por primera compra", "Para nuevos clientes — captación"],
        ],
      },
      { type: "h2", content: "Crear una promoción" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Promociones → '+ Nueva'",
      },
      {
        type: "ol",
        items: [
          "Tipo de promoción",
          "Productos aplicables (todos / categoría / específicos)",
          "Valor del descuento (% o monto fijo)",
          "Fecha de inicio y fin",
          "Límite de usos totales o por cliente",
          "Código (si aplica)",
        ],
      },
      {
        type: "callout",
        variant: "tip",
        content:
          "Las promos con código compartible (no automáticas) convierten mejor porque crean sensación de exclusividad. 'FUTBOL10' > 'todos los productos -10% siempre'.",
      },
    ],
    related: ["vendor-productos-catalogo"],
  },
  // ===========================================================================
  // Atletas y padres (extensiones)
  // ===========================================================================
  {
    slug: "atleta-inscribirse-evento",
    categoryId: "para-padres-atletas",
    title: "Cómo inscribirte a un evento individual",
    excerpt:
      "Encontrar eventos cerca, llenar datos, subir documentos y pagar inscripción (online o transferencia).",
    readTime: "3 min",
    targetRole: ["athlete", "parent"],
    body: [
      {
        type: "p",
        content:
          "Inscribirse a un evento en SportMaps toma 3-5 minutos si tenés cuenta creada. Si es la primera vez, te toma 8-10 minutos (creás cuenta + inscribís).",
      },
      { type: "h2", content: "Pasos" },
      {
        type: "ol",
        items: [
          "Encontrá el evento en /eventos o en el mapa",
          "Click en 'Inscribirme' y elegí tu categoría (sub-12, juvenil, élite, etc.)",
          "Llenamos datos del atleta (los traemos del perfil si ya estás logueado)",
          "Subí documentos requeridos: cédula/TI, EPS, autorización si es menor",
          "Elegí método de pago: tarjeta (Wompi), PSE, Nequi o transferencia",
          "Si elegís transferencia: hacés la transferencia y subís el comprobante (max 5MB)",
        ],
      },
      { type: "h2", content: "Después de inscribirte" },
      {
        type: "ul",
        items: [
          "Email confirmación inmediata si pagaste online",
          "QR único de boletería en tu perfil",
          "Notificaciones cuando se acerca el evento",
          "Si pagaste por transferencia, esperás validación del organizador (24-48h típicamente)",
        ],
      },
    ],
    related: ["atleta-mis-inscripciones"],
  },
  {
    slug: "atleta-mis-inscripciones",
    categoryId: "para-padres-atletas",
    title: "Ver y gestionar mis inscripciones a eventos",
    excerpt:
      "Histórico de eventos inscritos, descarga de QR, certificados de participación y resultados.",
    readTime: "2 min",
    targetRole: ["athlete", "parent"],
    body: [
      { type: "h2", content: "Dónde ver tus inscripciones" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Mis Eventos / Mis Inscripciones",
      },
      {
        type: "p",
        content:
          "Verás todos los eventos a los que te inscribiste, divididos en: Próximos (te avisan cuando llegan), Pasados (con certificados/resultados), Pendientes de pago.",
      },
      { type: "h2", content: "Acciones disponibles" },
      {
        type: "ul",
        items: [
          "Descargar tu QR de boletería (también lo tenés en email)",
          "Ver resultados si el evento ya pasó (tiempos, posición)",
          "Descargar certificado de participación",
          "Pedir reembolso (sujeto a política del organizador)",
        ],
      },
    ],
    related: ["atleta-inscribirse-evento"],
  },
  {
    slug: "paciente-mis-citas-wellness",
    categoryId: "para-padres-atletas",
    title: "Ver mis citas con profesionales de bienestar",
    excerpt:
      "Si reservás citas con fisio, nutricionista o psicólogo deportivo, las gestionás desde una sola vista.",
    readTime: "2 min",
    targetRole: ["athlete", "parent"],
    body: [
      { type: "h2", content: "Ver tus citas" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Mis Citas",
      },
      {
        type: "p",
        content:
          "Vista con citas próximas y pasadas. Cada cita muestra: profesional, fecha y hora, ubicación o link de videollamada, motivo de consulta.",
      },
      { type: "h2", content: "Reservar nueva cita" },
      {
        type: "p",
        content:
          "Buscá el profesional en /bienestar, elegí horario disponible, confirmá. Si el profesional usa WhatsApp AI, recibís confirmación automática 24h antes.",
      },
      { type: "h2", content: "Cancelar / reprogramar" },
      {
        type: "p",
        content:
          "Hasta 12h antes podés cancelar sin penalización. Para reprogramar, cancelás y reservás de nuevo en otro horario disponible.",
      },
    ],
    related: [],
  },
  // ===========================================================================
  // Escuela — features avanzadas
  // ===========================================================================
  {
    slug: "escuela-pickup-monitor",
    categoryId: "gestion-alumnos",
    title: "Pickup Monitor: alertas en tiempo real cuando llega el padre",
    excerpt:
      "Sistema de alertas con ETA y placa del auto del padre para coordinar la salida segura de los alumnos.",
    readTime: "3 min",
    targetRole: ["school"],
    body: [
      {
        type: "p",
        content:
          "Pickup Monitor evita el caos de la salida: padres en doble fila, alumnos esperando en la calle, llamadas frenéticas. Cada padre activa la alerta cuando va llegando y vos sabés a qué auto sale qué niño.",
      },
      { type: "h2", content: "Cómo funciona" },
      {
        type: "ol",
        items: [
          "El padre tiene la app SportMaps con su placa de auto registrada",
          "Cuando va llegando, activa 'Voy en camino' (puede hacerse desde el auto vía Bluetooth)",
          "Tu pantalla de Pickup Monitor muestra: nombre del alumno, placa del auto, ETA estimado",
          "Cuando el padre está a <5 min, alerta de proximidad",
          "Cuando llega a zona de recogida, alerta 'Padre en puerta'",
          "Marcás 'Entregado' una vez que el alumno sale al auto",
        ],
      },
      { type: "h2", content: "Beneficios operativos" },
      {
        type: "ul",
        items: [
          "Cero tiempo de espera para padres (eficiencia)",
          "Trazabilidad de salidas (auditoría de seguridad)",
          "Reduce llamadas a la escuela",
          "Identificación visual del auto correcto",
        ],
      },
      {
        type: "callout",
        variant: "tip",
        content:
          "Activá Pickup Monitor 15 min antes del fin de la jornada para que los padres vean los slots disponibles y planifiquen mejor su llegada.",
      },
    ],
    related: ["calendario-reservas"],
  },
  {
    slug: "escuela-delegaciones",
    categoryId: "gestion-alumnos",
    title: "Delegaciones: subgrupos para torneos y eventos",
    excerpt:
      "Crea delegaciones (subgrupos de alumnos) para representar tu academia en torneos externos con logística centralizada.",
    readTime: "3 min",
    targetRole: ["school"],
    body: [
      {
        type: "p",
        content:
          "Una delegación es un subgrupo de alumnos de tu academia que participa de un evento externo (un torneo regional, una competencia inter-escuelas). SportMaps te deja gestionar la logística completa de esa delegación sin afectar el resto de la operación.",
      },
      { type: "h2", content: "Crear una delegación" },
      {
        type: "callout",
        variant: "info",
        content: "Menú: Mis Delegaciones → '+ Nueva delegación'",
      },
      {
        type: "ol",
        items: [
          "Nombre del torneo / evento al que participan",
          "Fechas del evento",
          "Lista de alumnos que viajan (selección múltiple)",
          "Coach / responsable que viaja",
          "Transporte, alojamiento, comidas (si aplica)",
          "Cobro adicional a padres si el evento lo requiere",
        ],
      },
      { type: "h2", content: "Lo que automatiza SportMaps" },
      {
        type: "ul",
        items: [
          "Comunicación masiva a padres de la delegación (no afecta al resto)",
          "Cobro de costos extras separado de la mensualidad",
          "Lista de viajeros exportable para hotel/transporte",
          "Documentos requeridos por evento (subir y validar)",
        ],
      },
      {
        type: "callout",
        variant: "tip",
        content:
          "Si vas al mismo torneo cada año, duplicá la delegación pasada y solo actualizá la lista de viajeros. Ahorra 30 min.",
      },
    ],
    related: ["organizer-crear-evento", "configurar-sedes-equipos"],
  },
  {
    slug: "registrar-nuevo-atleta",
    categoryId: "gestion-alumnos",
    title: "Registrar un nuevo atleta manualmente",
    excerpt:
      "Paso a paso para dar de alta un deportista desde el panel de escuela: datos del menor, acudiente, sede/equipo y su primer cobro.",
    readTime: "4 min",
    targetRole: ["school"],
    body: [
      {
        type: "p",
        content:
          "Cuando un deportista se inscribe en persona (no por QR ni auto-registro), lo das de alta tú mismo desde Deportistas. El sistema crea la inscripción, calcula el primer cobro y envía la invitación al acudiente automáticamente.",
      },
      {
        type: "callout",
        variant: "info",
        content: "Menú lateral → Deportistas → botón verde \"Agregar Atleta\"",
      },
      {
        type: "img",
        src: "https://luebjarufsiadojhvxgi.supabase.co/storage/v1/object/public/school-assets/help-articles/registrar-nuevo-atleta/01-lista.png",
        alt: "Lista de deportistas con el botón Agregar Atleta",
        caption: "La lista de Deportistas, con el botón \"Agregar Atleta\" arriba a la derecha.",
      },
      { type: "h2", content: "1. Elige el tipo de atleta" },
      {
        type: "p",
        content:
          "\"Menor de Edad\" pide datos de un acudiente que autoriza y paga; \"Atleta Adulto\" crea una cuenta que el propio deportista maneja. La mayoría de las escuelas usa \"Menor de Edad\".",
      },
      {
        type: "img",
        src: "https://luebjarufsiadojhvxgi.supabase.co/storage/v1/object/public/school-assets/help-articles/registrar-nuevo-atleta/02-tipo.png",
        alt: "Modal para elegir entre Menor de Edad y Atleta Adulto",
      },
      { type: "h2", content: "2. Datos del menor y del acudiente" },
      {
        type: "ul",
        items: [
          "Del menor: tipo de documento, nombre completo (obligatorio), fecha de nacimiento, género y grado escolar",
          "Del acudiente: nombre, correo y teléfono — quien va a pagar y autorizar",
        ],
      },
      {
        type: "img",
        src: "https://luebjarufsiadojhvxgi.supabase.co/storage/v1/object/public/school-assets/help-articles/registrar-nuevo-atleta/03-acudiente.png",
        alt: "Formulario con los datos del acudiente y los canales de invitación",
        caption: "Si el correo del acudiente no existe todavía en SportMaps, se le envía una invitación automática (y puedes generar un link de WhatsApp).",
      },
      { type: "h2", content: "3. Inscripción: sede, equipo y primer cobro" },
      {
        type: "p",
        content:
          "La sede es obligatoria. Si además eliges un equipo con mensualidad configurada, el campo \"Mensualidad\" se completa solo — se puede editar a mano para casos especiales (una beca, una tarifa individual). Antes de guardar, ves el primer cobro que se va a generar: monto y fecha de vencimiento.",
      },
      {
        type: "img",
        src: "https://luebjarufsiadojhvxgi.supabase.co/storage/v1/object/public/school-assets/help-articles/registrar-nuevo-atleta/04-inscripcion.png",
        alt: "Sección de inscripción con sede, equipo, mensualidad y el primer cobro calculado",
      },
      {
        type: "callout",
        variant: "tip",
        content: "Al guardar: el atleta queda activo, se crea el primer cobro pendiente, se invita al acudiente por correo y queda un acceso directo para reenviar la invitación por WhatsApp.",
      },
      {
        type: "img",
        src: "https://luebjarufsiadojhvxgi.supabase.co/storage/v1/object/public/school-assets/help-articles/registrar-nuevo-atleta/05-en-lista.png",
        alt: "El nuevo atleta ya aparece en la lista de Deportistas",
        caption: "El atleta queda visible de inmediato en la lista, con su mensualidad y estado de pago \"Pendiente\".",
      },
      {
        type: "cta",
        title: "¿Vas a inscribir a varios de una campaña o flyer?",
        description: "Usa un QR de inscripción para que los acudientes se registren solos y paguen la matrícula en el momento.",
        href: "/ayuda/qr-inscripcion-con-pago",
        label: "Ver guía de QR de inscripción",
      },
    ],
    related: ["qr-inscripcion-con-pago", "invitar-padres-vinculacion", "configurar-sedes-equipos"],
  },
  {
    slug: "qr-inscripcion-con-pago",
    categoryId: "gestion-alumnos",
    title: "Crear un QR de inscripción que cobra la matrícula",
    excerpt:
      "Genera un código QR para flyers o carteleras: el acudiente se registra solo y paga la inscripción en el momento, sin que tú captures nada a mano.",
    readTime: "4 min",
    targetRole: ["school"],
    body: [
      {
        type: "p",
        content:
          "A diferencia del registro manual, el QR de inscripción deja que el propio acudiente complete el registro desde su celular — ideal para jornadas de inscripción, flyers o campañas en redes. Quien escanea queda como acudiente y el menor que inscribe queda a su cargo.",
      },
      {
        type: "callout",
        variant: "info",
        content: "Menú lateral → Documentos e Identidad → QR de Inscripción → \"+ Nuevo QR\"",
      },
      {
        type: "img",
        src: "https://luebjarufsiadojhvxgi.supabase.co/storage/v1/object/public/school-assets/help-articles/qr-inscripcion-con-pago/01-nuevo-qr.png",
        alt: "Formulario para crear un nuevo código QR de inscripción",
      },
      { type: "h2", content: "Elige a qué aplica el QR" },
      {
        type: "ul",
        items: [
          "Abierto (equipos y planes): el acudiente elige equipo y plan al inscribirse",
          "Equipo específico, Plan específico o Sede específica: útil para una campaña de un solo deporte o sede",
        ],
      },
      { type: "h2", content: "Lo que activa el cobro de inscripción" },
      {
        type: "p",
        content:
          "Deja \"Monto fijo / promo\" vacío para cobrar el precio normal del equipo o plan elegido — solo úsalo para una promoción puntual. La parte clave: los interruptores \"Exigir primer pago al inscribirse\" y \"Aceptar pagos online\" vienen activados por defecto. Con ambos en verde, el acudiente paga la inscripción ahí mismo, antes de terminar el registro.",
      },
      {
        type: "img",
        src: "https://luebjarufsiadojhvxgi.supabase.co/storage/v1/object/public/school-assets/help-articles/qr-inscripcion-con-pago/02-form-lleno.png",
        alt: "Formulario de QR con los interruptores de pago activados en verde",
      },
      {
        type: "callout",
        variant: "warning",
        content: "Si necesitas que el QR NO cobre nada al inscribirse (por ejemplo, una clase de prueba gratuita), apaga \"Exigir primer pago al inscribirse\" antes de crear el código.",
      },
      { type: "h2", content: "Descarga y comparte" },
      {
        type: "p",
        content:
          "El código queda activo de inmediato, con su propio enlace y un tablero de scans, inscritos y pagos. Desde \"Ver QR\" descargas la imagen en PNG (WhatsApp/redes), SVG (impresión grande) o como póster listo para imprimir.",
      },
      {
        type: "img",
        src: "https://luebjarufsiadojhvxgi.supabase.co/storage/v1/object/public/school-assets/help-articles/qr-inscripcion-con-pago/03-ver-qr.png",
        alt: "Código QR generado con opciones de descarga en PNG, SVG y póster",
      },
      {
        type: "cta",
        title: "¿Vas a inscribir uno solo, en persona?",
        description: "Para un caso puntual (no una campaña), regístralo directamente tú desde Deportistas.",
        href: "/ayuda/registrar-nuevo-atleta",
        label: "Ver guía de registro manual",
      },
    ],
    related: ["registrar-nuevo-atleta", "invitar-padres-vinculacion"],
  },

];

export const helpFAQs: HelpFAQ[] = [
  {
    question: "¿Cómo recupero mi contraseña?",
    answer:
      "En la pantalla de login (app.sportmaps.co/auth), hacé clic en '¿Olvidaste tu contraseña?'. Recibirás un email con un link para restablecerla. El link es válido por 1 hora.",
  },
  {
    question: "¿SportMaps funciona en celular?",
    answer:
      "Sí. SportMaps es una PWA (Progressive Web App): funciona en el navegador del celular y podés instalarla como app desde Chrome/Safari ('Agregar a pantalla de inicio'). No hay app nativa separada todavía.",
  },
  {
    question: "¿Qué métodos de pago acepta SportMaps?",
    answer:
      "Online via Wompi: tarjetas de crédito/débito, PSE y Nequi. Offline: efectivo y transferencias bancarias (se registran manualmente en la app). Más métodos en roadmap (Bancolombia botón, Daviplata).",
  },
  {
    question: "¿Cómo activo WhatsApp AI para recordatorios automáticos?",
    answer:
      "WhatsApp AI viene incluido en Escuela Pro y planes superiores. Para activarlo: Configuración → WhatsApp AI → conectar número (5 minutos vía WhatsApp Business). El equipo de SportMaps te acompaña en el setup inicial sin costo.",
  },
  {
    question: "Un padre me pagó pero tiene varios cobros pendientes, ¿qué hago?",
    answer:
      "Registra UN solo pago en 'Gestión de Pagos → Cobros → Registrar pago'. El sistema marca automáticamente TODOS los cobros pendientes y vencidos de ese estudiante como pagados.",
  },
  {
    question: "¿Cuál es la diferencia entre registro manual y Wompi?",
    answer:
      "Registro manual: vos registras un pago que ya recibiste en efectivo o transferencia (queda pagado al instante). Wompi: el padre paga online desde su celular (queda pendiente hasta que el gateway confirma, normalmente <1 minuto).",
  },
  {
    question: "¿Puedo gestionar varias sedes desde una sola cuenta?",
    answer:
      "Sí. En plan Pro y superiores, podés crear múltiples sedes con sus propios equipos, coaches y reportes. Cada coach solo ve los equipos asignados; vos (admin) ves todo consolidado.",
  },
  {
    question: "¿Cómo invito a un padre que no tiene email?",
    answer:
      "Usá 'Link de un solo uso' (Invitaciones → Generar link) y envialo por WhatsApp. O genera un QR (Estudiantes → seleccionar alumno → 'QR de vinculación') que el padre escanea en persona.",
  },
  {
    question: "¿Cómo doy de baja un alumno?",
    answer:
      "Estudiantes → seleccionar alumno → 'Dar de baja'. Te pide un motivo (cancelación, traslado, falta de pago, etc.). El alumno queda inactivo pero sus datos históricos se preservan para reportes.",
  },
  {
    question: "¿SportMaps emite facturas electrónicas?",
    answer:
      "En el plan Pro generamos comprobantes de pago automáticos. Para facturación electrónica DIAN, en plan Elite tenemos integración con Siigo y Alegra. Si usás otra plataforma, podemos integrar via API.",
  },
  {
    question: "¿Qué pasa con mis datos si me doy de baja de SportMaps?",
    answer:
      "Te exportamos todo en CSV/Excel (alumnos, pagos, asistencia, equipos) sin costo. Conservamos tu información encriptada por 90 días por si querés volver — después se elimina permanentemente.",
  },
  {
    question: "¿Cómo contacto soporte técnico?",
    answer:
      "WhatsApp directo a +57 320 268 3539 (lunes-viernes 8am-6pm Colombia). Email a contacto@sportmaps.co. El equipo responde en menos de 2 horas en horario hábil.",
  },
];

export function getArticleBySlug(slug: string): HelpArticle | undefined {
  return helpArticles.find((a) => a.slug === slug);
}

export function getArticlesByCategory(categoryId: string): HelpArticle[] {
  return helpArticles.filter((a) => a.categoryId === categoryId);
}

export function getRelatedArticles(slugs: string[] = []): HelpArticle[] {
  return slugs
    .map(getArticleBySlug)
    .filter((a): a is HelpArticle => !!a);
}
