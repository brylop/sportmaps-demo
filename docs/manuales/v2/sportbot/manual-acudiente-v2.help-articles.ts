/**
 * Centro de Ayuda / Mapi — contenido del «Manual del acudiente» (V2), versión ACADEMIAS.
 * Fuente: docs/manuales/v2/academias/manual-acudiente-v2.pdf (probado en dev el 2026-10-26).
 *
 * LISTO PARA PEGAR en bff/src/data/help-articles.ts (este archivo NO edita ese).
 * Respeta HelpArticle / ContentBlock y los categoryId de helpCategories.
 *
 * Qué hacer con cada uno:
 *   1. `inscripcion-padre-paso-a-paso`  → REEMPLAZA el `body` (y title/excerpt) del artículo existente:
 *      hoy no menciona el código de escuela ni «Agregar hijo», y habla de «Mis Hijos» del menú viejo.
 *   2. `acudiente-app-guia`             → NUEVO (no hay ningún artículo general del acudiente).
 *   3. `acudiente-pagos-comprobante`    → NUEVO (los de `pagos-finanzas` son todos de la escuela:
 *      `registrar-pago-manual`, `configurar-wompi-pagos-online`; no reemplaza ninguno).
 *   4. `acudiente-ficha-del-hijo`       → NUEVO (progreso, asistencia, informes, partidos, documentos, carnet).
 *   5. `unirse-escuela-con-codigo`      → NUEVO (función nueva del 2026-10-26).
 * `atleta-inscribirse-evento`, `atleta-mis-inscripciones` y `paciente-mis-citas-wellness` siguen vigentes:
 * se enlazan desde `related`, no se tocan.
 *
 * OJO: Mapi también lee `bff/src/data/app-map.ts` (rol `parent`, líneas ~405-460), que todavía describe el
 * menú V1 («Principal / Seguimiento / Mi Actividad», «Mis Pagos → Pendientes»). Con eso respondió en la
 * prueba «Abre Pagos en el menú lateral (sección Seguimiento)». Actualizarlo junto con estos artículos.
 */
import type { HelpArticle } from '../../../../bff/src/data/help-articles';

export const acudienteV2HelpArticles: HelpArticle[] = [
  // ── 1. REEMPLAZA inscripcion-padre-paso-a-paso ─────────────────────────────
  {
    slug: 'inscripcion-padre-paso-a-paso',
    categoryId: 'para-padres-atletas',
    title: 'Cómo me registro como acudiente y veo a mi hijo',
    excerpt:
      'Tres caminos para que tu hijo aparezca en tu cuenta: la invitación de la escuela, el código de la escuela o registrarlo tú.',
    readTime: '3 min',
    targetRole: ['parent'],
    body: [
      {
        type: 'p',
        content:
          'Para ver a tu hijo en SportMaps necesitas una cuenta de acudiente y que tu hijo quede ligado a esa cuenta. Hay tres caminos; usa el que te corresponda.',
      },
      { type: 'h2', content: 'Camino 1: la escuela te invitó' },
      {
        type: 'ol',
        items: [
          'Abre la invitación que te llegó al correo o al WhatsApp.',
          'Toca el enlace y crea tu contraseña (o entra con Google).',
          'Listo: tu hijo aparece en la pestaña Hijos con su equipo y su profe.',
        ],
      },
      { type: 'h2', content: 'Camino 2: ya creaste la cuenta y no ves a tu hijo' },
      {
        type: 'p',
        content:
          'Pídele a la escuela su código (3 letras y 4 caracteres, por ejemplo CAM-ABUP). En Inicio aparece «¿Ya tienes escuela?»: tócalo, escribe el código y sigue los pasos. La escuela te asigna la categoría. Ver «Unirme a mi escuela con el código».',
      },
      { type: 'h2', content: 'Camino 3: registrarlo tú' },
      {
        type: 'ol',
        items: [
          'Abre la pestaña Hijos.',
          'Toca «Agregar hijo» arriba a la derecha.',
          'Llena los datos básicos (nombre, fecha de nacimiento, documento) y la parte médica.',
        ],
      },
      {
        type: 'callout',
        variant: 'tip',
        content:
          'Al crear la cuenta, en el segundo paso hay un campo opcional «¿Ya tienes escuela? Ingresa su código». Si lo llenas, al terminar quedas directo en la solicitud a tu escuela.',
      },
      {
        type: 'callout',
        variant: 'info',
        content:
          'Usa siempre el mismo correo con el que la escuela registró a tu hijo. Si entras con otro correo, tu hijo no aparece.',
      },
    ],
    related: ['unirse-escuela-con-codigo', 'acudiente-app-guia'],
  },

  // ── 2. NUEVO acudiente-app-guia ────────────────────────────────────────────
  {
    slug: 'acudiente-app-guia',
    categoryId: 'para-padres-atletas',
    title: 'La app del acudiente: qué hay en cada pestaña',
    excerpt:
      'Inicio, Calendario, Hijos, Pagos y Más: dónde está cada cosa en la app de familias.',
    readTime: '4 min',
    targetRole: ['parent'],
    body: [
      {
        type: 'p',
        content:
          'La app de familias está hecha para el celular. Todo está en cinco pestañas en la barra de abajo. Lo que no cabe en las primeras cuatro está en Más: no se quitó nada.',
      },
      {
        type: 'table',
        headers: ['Pestaña', 'Para qué sirve', 'Lo más usado'],
        rows: [
          ['Inicio', 'Lo importante de hoy', 'Saldo y botón Pagar, próximo entreno, tarjeta de cada hijo con la frase del profe, torneos abiertos'],
          ['Calendario', 'Entrenos, partidos y torneos de tus hijos', 'Próximos (día por día), Torneos (inscribir), Mes (cuadrícula)'],
          ['Hijos', 'La ficha de cada hijo', 'Progreso, Asistencia, Informes, Ficha y salud (documentos y carnet)'],
          ['Pagos', 'Lo que debes y lo que pagaste', 'Por pagar, Pagados, subir comprobante, estado de cuenta'],
          ['Más', 'Todo lo demás', 'Inscripciones y planes, Mis eventos y torneos, Carnets, Constancias, Tienda y Mis compras, Salud, Mis citas, Escribirle al club, Centro de ayuda, Notificaciones, Mi cuenta'],
        ],
      },
      { type: 'h2', content: 'Inicio' },
      {
        type: 'ul',
        items: [
          'Arriba, una frase: «Tienes 3 cobros pendientes» o «Todo al día». El botón verde te lleva a pagar.',
          'Debajo, el próximo entreno de cualquiera de tus hijos: quién, cuándo y dónde.',
          'La tarjeta de cada hijo con su equipo, su profe, si debe algo y la frase del profe del último informe. «Ver cómo va» abre su ficha.',
          'Si a la ficha le falta un dato importante (por ejemplo la EPS), Inicio te lo pregunta con botones.',
        ],
      },
      { type: 'h2', content: 'Calendario' },
      {
        type: 'p',
        content:
          'El calendario lo publica la escuela; tú lo recibes. Ves los eventos de todos tus hijos juntos, con el nombre de cada uno. Tú no creas ni cambias eventos: si algo está mal, escríbele al club.',
      },
      { type: 'h2', content: 'Para volver' },
      {
        type: 'p',
        content:
          'En las pantallas internas (un informe, un carnet, el estado de cuenta) arriba aparece «Volver a …» con la pestaña de donde saliste. El botón redondo de abajo a la derecha es Mapi, el asistente: pregúntale cómo hacer cualquier cosa.',
      },
      {
        type: 'callout',
        variant: 'tip',
        content:
          'Tus datos, tus avisos y tu contraseña están en un solo lugar: Más → Mi cuenta (Perfil, Notificaciones, Privacidad y Seguridad).',
      },
    ],
    related: ['acudiente-ficha-del-hijo', 'acudiente-pagos-comprobante', 'atleta-inscribirse-evento'],
  },

  // ── 3. NUEVO acudiente-pagos-comprobante ───────────────────────────────────
  {
    slug: 'acudiente-pagos-comprobante',
    categoryId: 'pagos-finanzas',
    title: 'Pagar la mensualidad y subir el comprobante (familias)',
    excerpt:
      'Cómo pagar en línea, cómo subir el comprobante de una transferencia y dónde ver el estado de cuenta de cada hijo.',
    readTime: '4 min',
    targetRole: ['parent'],
    body: [
      {
        type: 'p',
        content:
          'Todo está en la pestaña Pagos. Arriba ves cuánto debes. Cada cobro ya viene marcado: si los vas a pagar todos, no tienes que tocar nada más.',
      },
      { type: 'h2', content: 'Pagar en línea (tarjeta, PSE o Nequi)' },
      {
        type: 'ol',
        items: [
          'Abre Pagos → Por pagar. Si quieres dejar un cobro para después, desmárcalo: el total se recalcula.',
          'Toca «Pagar N cobros». Se pagan uno por uno, con el valor de cada cobro.',
          'Elige «Pagar online». Revisa el valor, el recargo por pago en línea si tu escuela lo cobra, y el total.',
          'Toca el botón de pagar: vas a la pasarela segura. Al terminar, el cobro pasa a Pagados.',
        ],
      },
      { type: 'h2', content: 'Ya transferí: subir el comprobante' },
      {
        type: 'ol',
        items: [
          'En Pagos, toca «Ya transferí: subir el comprobante».',
          'En la ventana, elige «Transferencia / Nequi / Daviplata». Aparecen los datos de la cuenta de la escuela.',
          'En «Sube tu comprobante» elige la foto o el PDF y espera «Comprobante cargado».',
          'Confirma. Sale «Pago registrado. Validaremos tu comprobante pronto».',
        ],
      },
      {
        type: 'callout',
        variant: 'warning',
        content:
          'Al abrir la ventana desde «Ya transferí», revisa que esté elegida «Transferencia / Nequi / Daviplata» y no «Pagar online» antes de subir el comprobante.',
      },
      {
        type: 'p',
        content:
          'El cobro queda «En revisión» hasta que la escuela compare el comprobante con su cuenta. Cuando lo aprueba, pasa a Pagados y te llega el aviso «Pago confirmado». Un comprobante por cobro: si hiciste una sola transferencia por varios cobros, súbela en uno y avísale a la escuela.',
      },
      { type: 'h2', content: 'Pagados, recibos y estado de cuenta' },
      {
        type: 'ul',
        items: [
          'Pagados: todo lo que ya pagaste, con valor, medio y fecha. Los que tienen «Recibo» lo abren con un toque.',
          'Estado de cuenta: elige a tu hijo y ves, mes a mes, qué debe, qué está vencido y qué está en revisión, con «Pagar este cobro» en cada uno y el botón Imprimir (últimos 12 meses).',
          'Si pagaste en efectivo en la escuela, la escuela lo registra: no tienes que subir nada.',
        ],
      },
    ],
    related: ['acudiente-app-guia'],
  },

  // ── 4. NUEVO acudiente-ficha-del-hijo ──────────────────────────────────────
  {
    slug: 'acudiente-ficha-del-hijo',
    categoryId: 'para-padres-atletas',
    title: 'La ficha de tu hijo: progreso, informes, partidos, documentos y carnet',
    excerpt:
      'Qué ves en la pestaña Hijos: cómo va, si vino a los entrenos, los informes del profe, los partidos, los documentos y el carnet.',
    readTime: '5 min',
    targetRole: ['parent'],
    body: [
      {
        type: 'p',
        content:
          'En la pestaña Hijos eliges al hijo (si tienes varios) y ves cuatro pestañas: Progreso, Asistencia, Informes y Ficha y salud.',
      },
      {
        type: 'table',
        headers: ['Pestaña', 'Qué ves'],
        rows: [
          ['Progreso', 'Cada habilidad que mide el profe (de 1 a 5), si subió o bajó, y qué trabajar en casa. Solo se compara con su propio avance, nunca con otros niños. «Ver las gráficas» abre el detalle mes a mes.'],
          ['Asistencia', 'El porcentaje de cada mes y los últimos entrenos: Vino, Llegó tarde, No vino o Con excusa. Llegar tarde cuenta como haber venido.'],
          ['Informes', 'El informe del mes (con «Descargar PDF»), lo que trabajó el equipo en el entreno y los informes de partidos.'],
          ['Ficha y salud', 'Documento, EPS, tipo de sangre, alergias y contacto de emergencia («Corregir un dato»), los documentos y «Mostrar carnet».'],
        ],
      },
      { type: 'h2', content: 'Partidos y convocatorias' },
      {
        type: 'ul',
        items: [
          'Antes del partido: si tu hijo está convocado te llega el aviso «Convocatoria» con fecha, hora y lugar, y el partido aparece en tu Calendario con la nota de llegada y uniforme. Si no puede ir, avísale al profe o a la escuela por WhatsApp (Más → Escribirle al club).',
          'Después del partido: en Hijos → Informes → Informes de partidos ves el resultado, el resumen, cómo fue y qué van a mejorar. En «Tu respuesta» le puedes escribir al profe.',
          'Si la escuela comparte la evaluación del partido, la calificación de tu hijo aparece en Progreso. Cada familia ve solo la de su hijo.',
        ],
      },
      { type: 'h2', content: 'Documentos (todos opcionales)' },
      {
        type: 'p',
        content:
          'En Ficha y salud → Documentos hay diez tipos: documento del deportista (frente y reverso), foto, certificado de la EPS, paz y salvo, documento del acudiente (frente y reverso), firma del acudiente, firma del deportista y otro documento. Ninguno es obligatorio: súbelos si la escuela te los pide. Toca «Subir», elige una foto o PDF y queda «Cargado», con Ver y Cambiar.',
      },
      { type: 'h2', content: 'Carnet digital' },
      {
        type: 'p',
        content:
          'En Más → Carnets (o «Mostrar carnet» en la ficha) están los carnets de tus hijos. Al tocar uno se abre en grande con el código QR para la entrada de la escuela. Abajo: Ver el reverso, Descargar el carnet y Abrir el enlace para compartir.',
      },
      {
        type: 'callout',
        variant: 'tip',
        content:
          'Después de algunos entrenos te llega «¿Cómo estuvo el entreno de hoy?»: 5 preguntas de un toque, menos de 30 segundos. Le ayudan al profe a cuidar cuánto entrena tu hijo.',
      },
    ],
    related: ['acudiente-app-guia', 'atleta-inscribirse-evento'],
  },

  // ── 5. NUEVO unirse-escuela-con-codigo ─────────────────────────────────────
  {
    slug: 'unirse-escuela-con-codigo',
    categoryId: 'primeros-pasos',
    title: 'Unirme a mi escuela con el código',
    excerpt:
      'Si ya tienes cuenta y no ves a tu hijo ni a tu escuela, ingresa el código de la escuela y ella te asigna la categoría.',
    readTime: '2 min',
    targetRole: ['parent', 'athlete'],
    body: [
      {
        type: 'p',
        content:
          'Cada escuela tiene un código corto: 3 letras y 4 caracteres, por ejemplo CAM-ABUP. Pídeselo a tu escuela. Sirve para quien ya creó su cuenta y todavía no está unido a ninguna escuela.',
      },
      { type: 'h2', content: 'Dónde se ingresa' },
      {
        type: 'ul',
        items: [
          'En Inicio (y en Hijos) aparece «¿Ya tienes escuela? Ingresa el código que te dio tu escuela».',
          'Al crear la cuenta, el segundo paso trae el campo opcional «¿Ya tienes escuela? Ingresa su código».',
          'Si la escuela te mandó el enlace o el QR, ábrelo. Si no has entrado, te pide entrar o crear la cuenta y después usa el código solo.',
        ],
      },
      { type: 'h2', content: 'Los pasos' },
      {
        type: 'ol',
        items: [
          'Escribe el código y toca «Buscar mi escuela».',
          'Confirma que es tu escuela (nombre, logo y ciudad): «Sí, es mi escuela».',
          'Elige «Para mi hijo(a)» o «Para mí», escribe nombre completo y fecha de nacimiento, y si quieres la categoría que crees que le toca.',
          'Toca «Enviar solicitud». Mientras la escuela responde, Inicio muestra la solicitud y puedes cancelarla.',
        ],
      },
      {
        type: 'callout',
        variant: 'info',
        content:
          'La categoría que escribes es solo una sugerencia: la escuela decide. Al enviar la solicitud no se crea ningún cobro. Cuando la escuela asigna el equipo te llega el aviso de bienvenida y, si la categoría tiene mensualidad, el primer cobro según las reglas de la escuela.',
      },
      {
        type: 'p',
        content: 'Con el mismo código puedes unir a otro hijo: al final toca «Unir a otro hijo(a)».',
      },
    ],
    related: ['inscripcion-padre-paso-a-paso', 'acudiente-app-guia'],
  },
];
