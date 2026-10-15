// Manual de Dreamers Gymnastics (familias + escuela), en sus dos versiones
// (interno / academias), HTML + PDF, con las capturas reales de ./shots/.
//
//   node docs/manuales/_src/dreamers/build.mjs
//
// Las capturas salen de capture.mjs contra el GEMELO local (copia anonimizada de
// Dreamers con nombres ficticios), nunca de la base viva. Sistema visual: el de
// todos los manuales (docs/manuales/README.md, manual.css).

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, here, repo } from './lib.mjs';

const SHOTS = path.join(here, 'shots');
// Dos manuales separados (familias / administración), cada uno en dos versiones.
const AUD = {
  familias: { name: 'dreamers-familias', title: 'Dreamers Gymnastics: manual para familias',
    sub: 'Todo lo que hace el acudiente en SportMaps: ver el plan y el banco de horas de cada hija, agendar clases, entrar al gimnasio con el torniquete, pagar la mensualidad y hacer seguimiento.',
    pill: 'Para acudientes', chapters: [7, 7] },
  administracion: { name: 'dreamers-administracion', title: 'Dreamers Gymnastics: manual de administración',
    sub: 'Lo que hace la administración del gimnasio en SportMaps: deportistas, inscripciones, planes, aprobación de comprobantes, configuración de cobros, torniquetes, banco de horas e informes.',
    pill: 'Para la administración', chapters: [7, 8] },
};
const outFor = (aud, ver) => path.join(repo, 'docs/manuales', ver, AUD[aud].name);

// ── Piezas ────────────────────────────────────────────────────────────────
function img(file, caption, style) {
  const fp = path.join(SHOTS, file + '.png');
  if (!fs.existsSync(fp)) throw new Error(`Falta la captura ${file}. Corre capture.mjs: este manual no lleva mockups.`);
  const b64 = fs.readFileSync(fp).toString('base64');
  return `<div class="shot-wrap"><img class="shot" style="${style}" src="data:image/png;base64,${b64}" alt="${caption}"/>` +
    (caption ? `<div class="shot-caption">${caption}</div>` : '') + `</div>`;
}
// Capturas de pantalla completa (apaisadas) a todo el ancho; diálogos y tarjetas
// con el alto que pide cada paso.
function dims(file) { const b = fs.readFileSync(path.join(SHOTS, file + '.png')); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; }
const shot = (file, caption, maxH = 300) => {
  const { w, h } = dims(file);
  return w / h > 1.45 && w >= 3000 ? img(file, caption, 'width:100%;max-height:none') : img(file, caption, `max-height:${maxH}px`);
};
const step = (n, title, body, pic = '') =>
  `<div class="step"><div class="step-head"><div class="step-badge">${n}</div><div class="step-title">${title}</div></div>${body}${pic}</div>`;
const p = (html, cls = '') => `<p${cls ? ` class="${cls}"` : ''}>${html}</p>`;
const warn = (tag, html) => `<div class="callout warn"><span class="tag">${tag}</span>${html}</div>`;
const tip = (tag, html) => `<div class="callout tip"><span class="tag">${tag}</span>${html}</div>`;
const internal = (html) => `<div class="callout internal"><span class="tag">🔒 Interno</span>${html}</div>`;
const chapter = (n, title, crumb, intro) =>
  `<div class="chap"><div class="chapter-head"><div class="chapter-badge">${n}</div><h2 class="chapter-title">${title}</h2></div>` +
  `<div class="breadcrumb">${crumb}</div><hr class="chapter-rule" />${intro ? p(intro) : ''}</div>`;
const part = (letter, title, sub) =>
  `<div class="part"><div class="part-letter">${letter}</div><h2 class="part-title">${title}</h2><p class="part-sub">${sub}</p></div>`;
const table = (head, rows) =>
  `<table class="tbl"><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr>` +
  rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('') + `</table>`;
const twoUp = (a, b) => `<div class="two-up"><div>${a}</div><div>${b}</div></div>`;

// ── Contenido: cada entrada del array es UNA página ───────────────────────
function pages(isInternal, aud) {
  const I = (html) => (isInternal ? internal(html) : '');
  const pgs = [];

  // ── Reglas de Dreamers ──
  pgs.push(
    chapter('★', 'Las reglas de Dreamers, en una página', 'Lo que aplica a todas las familias',
      aud === 'familias'
        ? 'Este manual es para las familias de <b>Dreamers Gymnastics</b>: lo que hace el acudiente desde su celular o computador. Antes de los pasos, estas son las reglas con las que funciona la cuenta:'
        : 'Este manual es para la administración de <b>Dreamers Gymnastics</b>. Estas son las reglas con las que funciona la cuenta; las familias reciben la misma página en su manual:') +
    table(['Tema', 'Cómo funciona en Dreamers'], [
      ['<b>Plan mensual</b>', 'Cada deportista tiene un plan (por ejemplo <b>PGC16x4</b> = 16 sesiones de 4 horas). El plan trae un <b>banco de horas</b> para el mes: PGC16x4 = 64 horas.'],
      ['<b>Al inscribirse</b>', 'Se cobra una sola vez la <b>inscripción ($120.000)</b> y el <b>seguro de accidentes ($150.000)</b>, además de la primera mensualidad. El seguro se cobra como máximo una vez cada 12 meses.'],
      ['<b>Mensualidad</b>', 'Se genera para el mes completo y vence el <b>día 1</b>. Hay <b>5 días de gracia</b> para pagar.'],
      ['<b>Recargo por mora</b>', 'Si pasan los 5 días de gracia sin pago, se suma un <b>5 %</b> una sola vez. El primer mes de una inscripción nueva no lleva recargo.'],
      ['<b>Hermanas</b>', 'Desde la <b>segunda hija</b> activa de la misma familia, la mensualidad lleva <b>5 % de descuento</b>. La primera (la inscripción más antigua) paga completo.'],
      ['<b>Cómo se paga</b>', 'Transferencia a <b>Bancolombia</b>, llave <b>Bre-B</b> o el <b>QR</b> del gimnasio, y se sube la foto del comprobante en la app. La administración lo revisa y lo aprueba.'],
      ['<b>Comprobante en revisión</b>', 'Mientras la administración revisa un comprobante que ya subiste, la cuota cuenta como pagada.'],
      ['<b>Horas del mes</b>', 'Las horas que no se usan <b>se pierden al cierre del mes</b>; no se acumulan para el siguiente.'],
    ]) +
    I('Valores leídos de la base viva el 2026-10-14 (<code>school_settings</code> de <code>57ba9352…</code>): corte 1, gracia 5, mora 5 % con <code>late_fee_skip_signup_month</code>, hermanos 5 % sin escalones (<code>sibling_discount_tiers</code> NULL), <code>pending_proof_counts_as_paid=true</code>, cuotas apagadas, <code>auto_cancel_overdue_enabled=false</code> (la mora <b>no cancela</b>). <b>Corte 1 / gracia 5 los guardó la cuenta owner el 13-oct 18:50</b> y reemplazaron la regla acordada de corte 5 / gracia 0 (U2 de <code>docs/specs/dreamers-cierre-total.md</code>): confirmar con Dreamers antes de enviar este manual; si vuelven a 5/0, cambiar esta tabla.')
  );

  // ══════════════ PARTE A — FAMILIAS ══════════════
  pgs.push(
    chapter(1, 'Entrar y conocer el panel', 'app.sportmaps.co → Iniciar sesión → Dashboard',
      'El acudiente entra con el correo y la contraseña de su cuenta. Una sola cuenta sirve para todas sus hijas.') +
    step(1, 'El panel de inicio',
      p('Arriba aparecen el nombre del gimnasio y los resúmenes (hijas registradas, asistencia, pagos pendientes). A la derecha, las <b>notificaciones</b>: clases agendadas, cobros nuevos y avisos del gimnasio. En el menú de la izquierda están <b>Mis Hijos</b>, <b>Mis Inscripciones</b> y <b>Pagos</b>, que son las tres pantallas que más se usan.'),
      shot('p01', 'Panel del acudiente. Los nombres de este manual son ficticios.', 330)) +
    tip('Desde el celular', 'La app funciona igual en el navegador del celular. En el menú inferior están Inicio, Hijos y Pagos.')
  );

  pgs.push(
    chapter(2, 'El plan y el banco de horas de cada hija', 'Menú → Mi actividad → Mis Inscripciones',
      'Aquí se ve qué plan tiene cada hija y cuántas horas le quedan en el mes.') +
    step(1, 'Elegir a la hija',
      p('Arriba a la derecha están las hijas de la familia: se pulsa el nombre para cambiar. La tarjeta morada muestra el <b>plan</b> (ej. PGC16X4) y las clases disponibles.'),
      shot('p02', 'Mis Inscripciones de Sara: su plan, sus clases programadas y la sede.', 300)) +
    step(2, 'Leer el banco de horas',
      p('Debajo del plan está el <b>Banco de horas</b>: las horas <b>disponibles</b>, las <b>incluidas</b> en el plan, las <b>reservadas</b> (clases agendadas que aún no pasan) y las <b>consumidas</b> (las que ya registró el torniquete). El período va del 1 al último día del mes.'),
      shot('p02b', 'Banco de horas: 64 incluidas, 6 consumidas, 58 disponibles.', 170))
  );

  pgs.push(
    chapter(3, 'Agendar una clase', 'Mis Inscripciones → tarjeta del plan → "Toca para gestionar clases"',
      'Agendar aparta el cupo con la coach y reserva las horas en el banco.') +
    step(1, 'Elegir cómo agendar',
      p('<b>Por bloque</b> agenda la duración estándar del plan (en PGC16x4, 4 horas). <b>Sesión personalizada</b> deja elegir cuántas horas: sirve cuando quedan horas del mes por usar.'),
      shot('p03', 'Las dos formas de agendar.', 250)) +
    step(2, 'Elegir el día y la hora',
      p('Los días en verde tienen clases. Al tocar un día aparecen los horarios con la coach, el tipo (personal o grupal) y los cupos libres. Se pulsa <b>Agendar</b>.'),
      shot('p05', 'Viernes 16: clase grupal de 4:00 p. m. con 12 cupos libres.', 330))
  );

  pgs.push(
    step(3, 'Confirmar',
      p('La ventana de confirmación repite el día, el horario y la coach. Al pulsar <b>Confirmar</b> llega una notificación de "Clase agendada" y la clase aparece en <b>Clases programadas</b>.'),
      twoUp(shot('p06', 'Confirmar la clase.', 300), shot('p06d', 'La clase ya aparece en Clases programadas.', 140))) +
    warn('Si no deja agendar', '<b>"El plan ha expirado"</b>: la mensualidad del mes no está pagada o el plan venció; al pagar se habilita de nuevo. <b>"No alcanzan las horas"</b>: el banco del mes no tiene saldo para ese bloque; se puede elegir una sesión personalizada más corta o hablar con la administración. Si un día no muestra horarios, la coach de ese nivel todavía no tiene horario cargado: avisarle a la administración.') +
    I('Reservar daba 500 a todos los acudientes de Dreamers hasta el arreglo A1 del 13-oct (<code>attendance_sessions</code> sin <code>start_time</code>). Verificar que el BFF desplegado lo tenga antes de enviar el manual. Pendientes ligados: <code>reserve_hour_bank</code> descuenta del período de HOY y no del de la fecha reservada (F1), y Athenea/Mariapaz (USAG Nivel 1) no ven horarios porque esa coach no tiene <code>coach_availability</code> (F5).')
  );

  pgs.push(
    chapter(4, 'La entrada al gimnasio y cómo se cuentan las horas', 'Torniquete de entrada y de salida',
      'Cada deportista marca con su <b>huella o PIN</b> en el torniquete al <b>entrar</b> y al <b>salir</b>. Con esas dos marcas se descuentan las horas del banco. No hay que hacer nada en la app.') +
    table(['Regla', 'Qué significa'], [
      ['<b>Llegar antes</b>', 'Se puede entrar hasta <b>10 minutos</b> antes sin que cuenten.'],
      ['<b>Salir después</b>', 'Se puede salir hasta <b>20 minutos</b> después sin que cuenten.'],
      ['<b>Redondeo</b>', 'Pasadas esas gracias, el tiempo se cuenta en <b>horas enteras hacia arriba</b>: 15 minutos de más cuentan como una hora más.'],
      ['<b>Salir y volver</b>', 'Si sale y vuelve a entrar en <b>5 minutos</b> o menos, es la misma visita.'],
      ['<b>Olvidó marcar la salida</b>', 'La visita se cierra sola a las <b>10:00 p. m.</b> o a las <b>6 horas</b>, y la administración confirma la hora real de salida.'],
      ['<b>Horas de más</b>', 'Si en el mes se usan más horas de las del plan, la administración puede cobrar la diferencia al valor de la hora del plan.'],
    ]) +
    table(['Ejemplo (plan de bloques de 4 h)', 'Horas que se descuentan'], [
      ['Entra 3:50 p. m., sale 8:15 p. m.', '<b>4 h</b> (todo cae dentro de las gracias)'],
      ['Entra 4:00 p. m., sale 8:45 p. m.', '<b>5 h</b> (se pasó 15 min de la gracia de salida → una hora más)'],
      ['Sale a las 6:00 al baño y vuelve a las 6:04', 'Sigue siendo una sola visita'],
    ]) +
    I('Parámetros vivos: <code>hours_entry_grace_minutes=10</code>, <code>hours_exit_grace_minutes=20</code>, <code>hours_reentry_merge_minutes=5</code>, <code>hours_billing_rounding=hour_up</code>, <code>hours_max_visit_minutes=360</code>, <code>hours_closing_time=22:00</code>. Las gracias se restan una vez por visita, no por clase (D-17): el ejemplo 2 da 4 h 45 brutas − 30 = 4 h 15 → 5 h. Siete planes no tienen horas cargadas (PGP8x1, PGC12x3+2, PGC16x3, PGC20x2/3/4, PGP4x1): esas deportistas no tienen banco (Avril y Zoe en PGP8x1). <b>Bloqueo por mora en el torniquete: APAGADO</b> (<code>access_auto_block_overdue_enabled=false</code> desde el 06-oct, sin autor); por eso este manual no le promete a la familia que la entrada se bloquea por deuda. Revisar U3 (95 <code>disable_user</code> sin <code>enable_user</code>).')
  );

  pgs.push(
    chapter(5, 'Pagar la mensualidad', 'Menú → Seguimiento → Pagos',
      'Cada cobro aparece con el nombre de la hija, el mes, el valor y su estado: <b>Pendiente</b>, <b>Por validar</b> (ya subiste el comprobante) o <b>Aprobado</b>.') +
    step(1, 'Ver lo pendiente',
      p('Arriba están los totales: cobros pendientes, monto pendiente y pagos realizados. Si un cobro dice <b>"Incluye recargo por mora"</b>, ya pasaron los 5 días de gracia. Cada cobro pendiente tiene su botón <b>Pagar</b>.'),
      shot('p07', 'Mis Pagos: la mensualidad de octubre de Isabella está pendiente.', 300)) +
    step(2, 'Transferir y subir el comprobante',
      p('Al pulsar <b>Pagar</b> aparecen las cuentas de Dreamers: <b>Bancolombia ahorros 65000001701</b>, la llave <b>Bre-B 0067173591</b> y el <b>QR</b> (se puede ampliar). Haces la transferencia desde tu banco o billetera, vuelves a la app y en <b>Sube tu comprobante</b> eliges la foto o el PDF. Luego pulsas <b>Pagar</b>.', 'no-shot'))
  );
  pgs.push(
    twoUp(shot('p09', 'Cuentas de Dreamers y QR, con el comprobante listo para enviar.', 640),
      `<div class="side-text">${p('<b>Titular:</b> Inversiones Cardona Herrera SAS<br><b>NIT:</b> 901231071')}` +
      tip('Para que lo aprueben rápido', 'Transfiere el <b>valor exacto</b> del cobro (con recargo, si lo tiene) y sube una foto donde se lean el valor, la fecha y la referencia. Un comprobante por cobro.') +
      warn('Si pagaste menos', 'La administración puede registrarlo como <b>abono</b> o pedirte la diferencia con una <b>glosa</b>, que te llega como notificación.') + `</div>`) +
    step(3, 'Esperar la aprobación',
      p('El cobro pasa a <b>Por validar</b>. Cuando la administración lo aprueba, cambia a <b>Aprobado</b> y te llega la notificación. Mientras está en revisión cuenta como pagado.'),
      shot('p10', 'El cobro de Isabella queda "Por validar" apenas se envía el comprobante.', 260))
  );

  pgs.push(
    step(4, 'Adelantar un mes o pagar sin esperar el cobro',
      p('Con <b>Nuevo Pago</b> (arriba a la derecha en Mis Pagos) eliges a la hija y se abre el mismo formulario de transferencia y comprobante.'),
      shot('p12', 'Nuevo Pago: para quién es el pago, con el valor mensual de cada hija.', 330)) +
    step(5, 'Estado de cuenta',
      p('Los botones <b>Estado de cuenta</b> de cada hija muestran lo facturado, lo pagado, el saldo y la mora de los últimos 12 meses, mes por mes. Tiene botón <b>Imprimir</b>.'),
      shot('p13', 'Estado de cuenta de Sara.', 300)) +
    I('La tarjeta "Factura electrónica — ¿Quieres factura a tu nombre?" aparece en Mis Pagos aunque Dreamers <b>no tiene facturador configurado</b> (<code>electronic_invoice_providers</code> sin fila): por eso no se menciona en la versión para la escuela. "Nuevo Pago" también ofrece artículos si hay catálogo: Dreamers tiene <code>merchandise_enabled=true</code> y un solo artículo activo, <b>"pruebas" de $100.000</b>, que las familias pueden ver. Apagarlo o borrarlo antes de enviar el manual.')
  );

  pgs.push(
    chapter(6, 'Seguimiento de las hijas', 'Menú → Mis Hijos · Seguimiento → Asistencias',
      '') +
    step(1, 'Mis Hijos',
      p('Una tarjeta por hija con su nivel (USAG), la disciplina y accesos directos a <b>Progreso</b>, <b>Asistencia</b> e <b>Informes</b>. Con <b>Subir documentos</b> se cargan los papeles que pida el gimnasio. <b>Registrar Hijo</b> sirve para agregar a otra hija a la cuenta.'),
      shot('p14', 'Mis Hijos: las tres hermanas de la familia Gómez.', 250)) +
    step(2, 'Asistencias',
      p('Se elige a la hija y aparecen la tasa de asistencia, las clases con presente, ausente y tarde, y el historial por fecha.'),
      shot('p16', 'Registro de asistencia de Valentina.', 280)) +
    I('<b>Mis Hijos estaba roto en producción para TODOS los acudientes</b> (todas las escuelas) desde que se creó <code>school_sibling_links</code> (migración <code>20261013192946</code>, hermanos escalonados): la consulta <code>children → schools(name)</code> quedó ambigua y PostgREST responde PGRST201 ("Error al cargar tus hijos"). Verificado contra la viva el 14-oct. Arreglo de una línea en <code>MyChildrenPage.tsx</code> (<code>schools!children_school_id_fkey</code>), <b>sin commitear ni desplegar</b> al cerrar este manual. La pausa por vacaciones no aparece en esta pantalla porque Dreamers no la tiene habilitada.')
  );

  pgs.push(
    chapter(7, 'Preguntas frecuentes de las familias', '', '') +
    table(['Pregunta', 'Respuesta'], [
      ['¿Cuándo llega el cobro del mes?', 'El cobro del mes completo se genera para el día 1. Hay 5 días de gracia; después se suma el 5 %.'],
      ['¿Por qué mi segunda hija paga menos?', 'Desde la segunda hija activa hay 5 % de descuento en la mensualidad. La primera es la que tiene la inscripción más antigua.'],
      ['¿Por qué me cobran inscripción y seguro?', 'Son pagos únicos al entrar al gimnasio: inscripción $120.000 y seguro de accidentes $150.000 (el seguro, máximo una vez al año).'],
      ['Subí el comprobante, ¿ya quedó pagado?', 'Queda <b>Por validar</b> y cuenta como pagado mientras la administración lo revisa. Si lo rechazan, el cobro vuelve a pendiente y te llega el motivo.'],
      ['¿Las horas que no usé pasan al otro mes?', 'No. El banco de horas se reinicia el día 1; lo que no se usó se pierde.'],
      ['Mi hija se quedó más tiempo, ¿qué pasa?', 'Se descuentan más horas del banco. Si el mes cierra con más horas de las del plan, la administración puede cobrar la diferencia.'],
      ['No me deja agendar', 'Revisa que la mensualidad esté pagada y que haya horas disponibles. Si el día no tiene horarios, avisa a la administración.'],
      ['Olvidé marcar la salida', 'La administración confirma la hora real de salida; las horas se ajustan con esa hora.'],
    ]) +
    tip('Ayuda', 'Para cualquier duda sobre cobros, horas o clases, escribe a la administración de Dreamers por <b>Mensajes</b> en la app o en recepción.')
  );

  // ══════════════ PARTE B — ESCUELA ══════════════
  const famEnd = pgs.length;
  pgs.push(
    chapter(1, 'Panel y lista de deportistas', 'Menú → Principal → Dashboard · Deportistas', '') +
    step(1, 'Deportistas',
      p('La lista muestra a cada deportista con su <b>nivel (USAG)</b>, su <b>plan</b>, las <b>horas disponibles</b> del banco, el acudiente, la mensualidad y el <b>estado de pago</b> (Al día, Pendiente, Vencido, con lo que debe). Los recuadros de arriba filtran por estado.'),
      shot('o02', 'Deportistas: estado de pago y horas disponibles de cada una.', 330))
  );

  pgs.push(
    step(2, 'Ficha de la deportista',
      p('Con <b>Ver</b> se abre la ficha: datos personales, equipo y plan, <b>saldo pendiente</b> con el detalle de cada cobro, plan activo con su vigencia, el <b>banco de horas</b> (incluidas, reservadas, consumidas) y el enlace <b>Ver reporte de ingresos/salidas</b> con cada marcación del torniquete.'),
      shot('o19', 'Ficha de Sara: saldo, plan PGC16x4 y banco de horas.', 640))
  );

  pgs.push(
    chapter(2, 'Inscribir a una deportista', 'Deportistas → Agregar Atleta',
      'Al inscribir con un plan, el sistema genera solo la <b>inscripción</b>, el <b>seguro</b> y la <b>primera mensualidad</b>. No hay que crear esos cobros a mano.') +
    step(1, 'Menor de edad o atleta adulta',
      p('<b>Menor de edad</b> pide los datos de la niña y del acudiente; el acudiente recibe una invitación por correo para activar su cuenta. <b>Atleta adulta</b> es para quien se inscribe por sí misma.'),
      shot('o03', 'Tipo de registro.', 160)) +
    step(2, 'Datos, nivel y plan',
      p('Se completan los datos de la menor y del acudiente, la <b>sede</b>, el <b>equipo</b> (nivel USAG) y el <b>plan</b>. Si tiene una hermana inscrita se marca <b>¿Tiene un hermano inscrito?</b> para aplicar el descuento.'),
      shot('o03b', 'Registrar menor de edad.', 420))
  );

  pgs.push(
    chapter(3, 'Planes, inscripción y seguro', 'Gestión deportiva → Equipos y Planes → Mis Planes', '') +
    step(1, 'Los planes de Dreamers',
      p('Cada plan (Recreativa, Adultos, Competencia, Pre-competencia) tiene sus tarifas: las horas del <b>banco</b> por mes, las horas por clase, los días por semana y el precio. Debajo de cada tarifa se ven la inscripción y el seguro que se cobran al inscribir.'),
      shot('o04', 'Plan Gimnasia Recreativa con sus cinco tarifas.', 320)) +
    step(2, 'Inscripción y seguro',
      p('El botón <b>Inscripción y seguro</b> fija esos dos valores en varias tarifas a la vez. Un campo vacío quita ese cobro. Solo afecta a las deportistas que se inscriban de ahí en adelante.'),
      shot('o05', 'Pagos únicos al inscribirse, aplicados a las 23 tarifas.', 330)) +
    I('Tarifas sin banco de horas: PGP8x1, PGC12x3+2, PGC16x3, PGC20x2, PGC20x3, PGC20x4 y PGP4x1 (esta además con inscripción 0 y sin seguro: ¿a propósito?). CPP1x1 y CPG1x2 son clases sueltas, sin inscripción ni seguro. Decisión pendiente de Dreamers (§3.4 del cierre total).')
  );

  pgs.push(
    chapter(4, 'Aprobar comprobantes', 'Finanzas → Pagos → pestaña Cobros',
      'Cada comprobante que sube una familia llega a <b>Cobros por Aprobar</b>. Es la tarea diaria más importante: hasta que se aprueba, el pago no entra a la contabilidad.') +
    step(1, 'Revisar la fila',
      p('Cada fila trae la fecha, la deportista, el acudiente, el monto, el medio y el botón <b>Ver</b> del comprobante. Las acciones son <b>Aprobar</b>, <b>Rechazar</b> y <b>Glosar</b>.'),
      shot('o07', 'El comprobante de Isabella, esperando aprobación.', 90)) +
    step(2, 'Aprobar',
      p('La ventana muestra el valor esperado. Hay que abrir <b>Ver comprobante</b> y comprobar el valor, la fecha y que el destino sea una cuenta de Dreamers. Si está completo, se marca la casilla de verificación y se pulsa <b>Aprobar</b>. Si pagaron menos, <b>no se aprueba</b>: se usa <b>Glosar</b> para pedir el resto, o <b>Registrar abono</b> con el monto real.'),
      shot('o07b', 'Aprobar cobro: verificar el comprobante antes de aprobar.', 420))
  );

  pgs.push(
    step(3, 'Listo',
      p('El cobro pasa a pagado, la familia recibe la notificación y, si era la mensualidad, la vigencia del plan se extiende hasta fin de mes.'),
      shot('o07c', 'Sin pendientes: el cobro quedó aprobado.', 260)) +
    step(4, 'Pagos en efectivo o que llegan por otro lado',
      p('<b>Registrar pago</b> (arriba en Gestión de Pagos) sirve para efectivo o transferencias que no subieron por la app: se elige el medio, la deportista, el concepto, el monto y la fecha.'),
      shot('o08', 'Registrar pago manual.', 360)) +
    I('No hay lector automático de comprobantes con veredicto en el gemelo (sin llaves de OCR), por eso la ventana dice "No se pudo leer el monto". En producción el OCR sí corre y la ventana puede mostrar "Pago completo / Registrar abono". <code>auto_approve_enabled=false</code>: todo pasa por revisión manual. Glosa automática encendida (5 días para responder). Cobros sin acudiente vinculado (Sofía, Avril, Zoe) no se pueden pagar por la app: Dreamers no tiene WhatsApp y <code>/p/:token</code> solo acepta comprobante por WhatsApp (F1).')
  );

  pgs.push(
    chapter(5, 'Configuración de cobros', 'Finanzas → Pagos → pestaña Config',
      'Aquí viven las reglas de la primera página. Cualquier cambio aplica desde el siguiente cobro; pulsar <b>Guardar Cambios</b> arriba a la derecha.') +
    twoUp(shot('o11a', 'Reglas de cobro: corte, ciclo, gracia, generación automática y hermanas.', 560),
      shot('o11b', 'Mora: 5 % después de la gracia y comprobante obligatorio.', 300) + shot('o11c', 'Recordatorios antes del vencimiento.', 240))
  );
  pgs.push(
    warn('Generar cobros automáticos', 'Si este interruptor está <b>apagado</b>, la mensualidad del mes <b>no se crea sola</b> el día 1 y las familias no ven nada que pagar. Debe estar <b>encendido</b>, o el mes se abre a mano desde la pestaña <b>Cierre</b>.') +
    step(1, 'Cierre del mes y cartera',
      p('La pestaña <b>Cierre</b> muestra, mes por mes, lo facturado, lo cobrado y lo pendiente, quién quedó debiendo y las acciones para cerrar el mes. Desde aquí también se abre el mes siguiente si la generación automática está apagada.'),
      shot('o10', 'Cierre: cartera pendiente de septiembre.', 280)) +
    step(2, 'Equipos y Planes',
      p('Vista de cobro por equipo y plan: quién está al día, quién debe y cuánto, con los recargos de mora ya sumados.'),
      shot('o09', 'Cobros agrupados por equipo y plan.', 260)) +
    I('<b>U1 urgente:</b> en la viva <code>auto_generate_payments=false</code> desde el 13-oct 18:50 (lo guardó la owner): <b>noviembre no se va a facturar</b> si nadie lo prende o abre el mes. La captura muestra el estado vivo (apagado) a propósito. Glosas (pestaña Glosas) quedan con la misma lógica que el resto de escuelas.')
  );

  pgs.push(
    chapter(6, 'Torniquetes y banco de horas', 'Sedes e instalaciones → Control de Acceso',
      'Las marcaciones de los torniquetes de entrada y salida descuentan las horas del banco. Esta pantalla es donde se corrige lo que el torniquete no pudo cerrar solo.') +
    step(1, 'Visitas pendientes de revisión',
      p('Si alguien no marcó la salida, la visita se cierra sola y aparece aquí como <b>auto-cerrada</b>. Se ajusta la fecha y hora real y se pulsa <b>Confirmar salida</b>: con eso se descuentan las horas correctas.', 'no-shot')) +
    step(2, 'Horas por encima del plan',
      p('Al cerrar el mes, si una deportista usó más horas de las de su plan, el sistema <b>sugiere</b> un cobro: horas de más × valor de la hora del plan. <b>Confirmar</b> crea el cobro (vence a los 5 días); <b>Descartar</b> lo ignora. El interruptor de arriba apaga las sugerencias.', 'no-shot')) +
    shot('o13', 'Control de Acceso: visitas por confirmar, horas de más, torniquetes y apertura manual.', 420) +
    step(3, 'Apertura manual',
      p('<b>Abrir Entrada</b> y <b>Abrir Salida</b> abren el torniquete desde la app, sin huella.', 'no-shot')) +
    I('La sugerencia de la captura es real del gemelo: <b>$419.188 a Edna (dueña)</b> por horas de agosto, sobre una inscripción cancelada (U4). Descartarla en la viva; el generador debe excluir canceladas y dueños (F1). En la captura la dueña aparece con nombre ficticio.')
  );

  pgs.push(
    step(4, 'Dispositivos',
      p('<b>Configurar</b> lista los torniquetes del gimnasio y permite editarlos o agregar uno.'),
      shot('o15', 'Torniquete de entrada y de salida.', 200)) +
    step(5, 'Modo Recepción',
      p('<b>Finanzas → Modo Recepción</b> deja una pantalla abierta en recepción que muestra en vivo quién entra, con sonido. Hay que tocar <b>Activar recepción</b> una vez por sesión para que el navegador permita el sonido.', 'no-shot')) +
    (isInternal
      ? step(6, '🔒 Vencidos (bloqueo por mora)',
        p('El botón <b>Vencidos</b> lista a quienes tienen pago vencido y huella registrada, con <b>Restaurar</b> para habilitarlos un día. Solo tiene efecto con el bloqueo por mora encendido, que en Dreamers está apagado; por eso no va en la versión para la escuela. La excepción manual se re-bloqueaba a los 15 min hasta el arreglo A3 (13-oct, sin desplegar).'),
        shot('o14', 'Vencidos.', 300))
      : '')
  );

  pgs.push(
    chapter(7, 'Asistencias e informe mensual', 'Gestión deportiva → Asistencias · Informe Mensual', '') +
    step(1, 'Asistencias',
      p('El calendario del día con los niveles (USAG Nivel 1 a 7) y los planes. Al pulsar un equipo se toma o se revisa la asistencia de esa clase.'),
      shot('o17', 'Asistencias por nivel.', 300)) +
    step(2, 'Informe mensual',
      p('Genera los borradores del informe de cada deportista, muestra la cobertura por equipo (cuántos informes están escritos, revisados y publicados) y quién los publica. Dreamers publica los informes desde la administración.'),
      shot('o18', 'Informe Mensual de octubre.', 300))
  );

  if (isInternal) {
    pgs.push(
      chapter(8, 'Estado real de Dreamers al 14-oct', 'Solo equipo SportMaps — revisar antes de enviar', '') +
      table(['#', 'Tema', 'Estado', 'Qué hacer'], [
        ['U1', 'Generación automática', '<code>auto_generate_payments=false</code> desde 13-oct', 'Confirmar con Dreamers y prender, o abrir noviembre a mano'],
        ['U2', 'Corte 1 / gracia 5', 'Revirtió la regla 5/0 acordada', 'Confirmar; si vuelve a 5/0, cambiar la página de reglas'],
        ['U3', 'Torniquete', '95 <code>disable_user</code> sin <code>enable_user</code> (06-oct)', 'Revisar en el MB360 y habilitar'],
        ['U4', 'Horas de más a la dueña', 'Sugerencia de $419.188', 'Descartar'],
        ['—', 'Bloqueo por mora', 'Apagado', 'Re-prender con la prueba F4; no prometerlo a las familias'],
        ['—', 'Mis Hijos (todas las escuelas)', 'PGRST201 por <code>school_sibling_links</code>', 'Commitear y desplegar el arreglo de <code>MyChildrenPage.tsx</code>'],
        ['—', 'Artículo "pruebas" $100.000', 'Activo y visible para familias', 'Borrarlo o desactivarlo'],
        ['—', 'Factura electrónica', 'Sin facturador; la tarjeta igual aparece', 'No ofrecerla'],
        ['—', 'Pausa por vacaciones', 'Apagada (<code>pause_parent_can_request</code> sí está en true)', 'Si la quieren, prenderla y agregar un paso al manual'],
        ['—', 'Carnets', '0 plantillas, 0 emitidos', 'No mencionarlos'],
        ['—', 'Hermanos escalonados (2.ª 5 %, 3.ª 10 %)', 'F2 sin aplicar', 'Al aplicarse, cambiar la fila de hermanas'],
        ['—', 'Planes sin horas', '7 tarifas', 'Cargar horas (F5)'],
      ]) +
      tip('Cómo se hicieron las capturas', 'Gemelo Docker local con <code>node scripts/qa-twin/clonar-dreamers.mjs</code> (copia del 13-oct), renombrado a "Dreamers Gymnastics", con <b>nombres ficticios</b> (familia Gómez = Athenea/Bella/Mariapaz; Paula Herrera = Edna) y las cuentas bancarias reales de Dreamers copiadas de la viva. Configuración del gemelo alineada a la viva (corte 1, gracia 5, sin generación automática). Se agendó una clase y se subió y aprobó un comprobante de ejemplo, solo en el gemelo. Regenerar: <code>ONLY=… node docs/manuales/_src/dreamers/capture.mjs</code> y <code>build.mjs</code>.')
    );
  }
  return aud === 'familias' ? pgs.slice(0, famEnd) : [pgs[0], ...pgs.slice(famEnd)];
}

// ── Documento ─────────────────────────────────────────────────────────────
function cover(isInternal, nPages, aud) {
  const A = AUD[aud];
  return `<div class="page cover"><div class="cover-inner">
    <div><div class="logo"><span class="pin"></span>SportMaps</div></div>
    <div>
      <div class="cover-eyebrow"><span class="dot" style="background:${isInternal ? '#ff8833' : '#4fd17a'}"></span>${isInternal ? '🔒 Uso interno — no enviar a escuelas' : 'Guía de uso · Dreamers Gymnastics'}</div>
      <h1 class="cover-title">${A.title}</h1>
      <p class="cover-sub">${A.sub}</p>
      <div class="pills">
        <span class="pill">${A.pill}</span>
        <span class="pill">${A.chapters[isInternal ? 1 : 0]} capítulos · <span class="n-pages">${nPages}</span> páginas</span>
        <span class="pill">Capturas reales del producto</span>
        ${isInternal ? '<span class="pill" style="border-color:#ff8833;color:#ffcf9e">Uso interno</span>' : ''}
      </div>
    </div>
    <div class="cover-footer">SportMaps © 2026 · octubre · Nombres de deportistas y familias ficticios</div>
  </div></div>`;
}

const extraCss = `
.part { background: linear-gradient(155deg, #123416, #1c5c34); color: #f2f7f2; border-radius: 16px; padding: 22px 26px; margin-bottom: 26px; }
.part-letter { font-family: 'Baloo 2', sans-serif; font-size: 13px; font-weight: 800; letter-spacing: .12em; color: #ffcf9e; }
.part-letter::before { content: 'PARTE '; }
.part-title { font-size: 30px; font-weight: 800; margin: 2px 0 4px; }
.part-sub { margin: 0; font-size: 13.5px; color: #cfe8d6; line-height: 1.5; }
.two-up { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; align-items: start; margin: 6px 0 14px; }
.two-up .shot { max-width: 100%; }
.side-text p { font-size: 13.5px; line-height: 1.55; color: #33413a; margin: 0 0 10px; }
`;
const css = () => fs.readFileSync(path.join(here, 'manual.css'), 'utf8') + extraCss;

function html(isInternal, aud) {
  const body = pages(isInternal, aud);
  const total = body.length + 1;
  const foot = (n) => `<div class="footer${isInternal ? ' internal-mark' : ''}"><span>SportMaps · ${isInternal ? 'Uso interno' : 'Guía de uso · Dreamers Gymnastics'}</span><span>Página ${n} de ${total}</span></div>`;
  return `<!doctype html><html><head><meta charset="utf-8" /><title>${AUD[aud].title} (${isInternal ? 'Interno' : 'Academias'})</title><style>${css()}</style></head><body>` +
    cover(isInternal, total, aud) +
    body.map((pg, i) => `<div class="page">${pg}${foot(i + 2)}</div>`).join('\n') +
    `</body></html>`;
}

async function render() {
  const browser = await chromium.launch();
  try {
    for (const [aud, ver] of Object.keys(AUD).flatMap((a) => ['academias', 'interno'].map((v) => [a, v]))) {
      const base = outFor(aud, ver);
      const isInternal = ver === 'interno';
      fs.mkdirSync(path.dirname(base), { recursive: true });
      fs.writeFileSync(`${base}.html`, html(isInternal, aud), 'utf8');
      const page = await browser.newPage();
      await page.goto(pathToFileURL(`${base}.html`).href);
      await page.waitForFunction(() => [...document.images].every((img) => img.complete && img.naturalHeight > 0));
      await page.evaluate(() => document.fonts.ready);
      // Paginador: lo que no cabe en una hoja pasa a una hoja nueva (mismo pie),
      // y se renumera. Un bloque solo que no cabe encoge sus imágenes.
      await page.evaluate(({ label, internalMark }) => {
        const LIMIT = 1056;
        const pagesEls = () => [...document.querySelectorAll('.page:not(.cover)')];
        const fresh = () => { const d = document.createElement('div'); d.className = 'page'; const f = document.createElement('div'); f.className = 'footer' + (internalMark ? ' internal-mark' : ''); d.appendChild(f); return d; };
        for (let guard = 0; guard < 400; guard++) {
          const pg = pagesEls().find((el) => el.scrollHeight > LIMIT); if (!pg) break;
          const blocks = [...pg.children].filter((c) => !c.classList.contains('footer'));
          if (blocks.length === 1) { const imgs = [...blocks[0].querySelectorAll('img')]; imgs.forEach((im) => { im.style.maxHeight = Math.floor(im.getBoundingClientRect().height * 0.9) + 'px'; im.style.width = 'auto'; }); continue; }
          // Antes de mover: si lo que sobra es poco, encoger la última imagen.
          const over = pg.scrollHeight - LIMIT;
          const lastBlock = blocks[blocks.length - 1];
          const shortText = !lastBlock.querySelector('img') && lastBlock.getBoundingClientRect().height < 160;
          const lastImgs = [...(shortText ? pg : lastBlock).querySelectorAll('img')];
          const im = lastImgs[lastImgs.length - 1];
          if (im && !im.dataset.shrunk) {
            const h = im.getBoundingClientRect().height;
            im.dataset.shrunk = '1';
            if (over + 8 < h * 0.35) { im.style.maxHeight = Math.floor(h - over - 8) + 'px'; im.style.width = 'auto'; continue; }
          }
          let next = pg.nextElementSibling;
          if (!next || !next.dataset.cont) { next = fresh(); next.dataset.cont = '1'; pg.after(next); }
          let last = blocks[blocks.length - 1];
          // no dejar un título de capítulo huérfano al pie
          const prev = blocks[blocks.length - 2];
          next.insertBefore(last, next.firstChild);
          if (prev && prev.classList.contains('chap') && blocks.length > 2) {
            next.insertBefore(prev, next.firstChild);
            const prev2 = blocks[blocks.length - 3];
            if (prev2 && prev2.classList.contains('part') && blocks.length > 3) next.insertBefore(prev2, next.firstChild);
          }
        }
        const all = pagesEls(); const total = all.length + 1;
        all.forEach((el, i) => { el.querySelector('.footer').innerHTML = `<span>${label}</span><span>Página ${i + 2} de ${total}</span>`; });
        document.querySelectorAll('.cover .n-pages').forEach((e) => (e.textContent = total));
      }, { label: isInternal ? 'SportMaps · Uso interno' : 'SportMaps · Guía de uso · Dreamers Gymnastics', internalMark: isInternal });
      fs.writeFileSync(`${base}.html`, await page.content(), 'utf8');
      // Una página que desborda se recorta en silencio (overflow:hidden): avisar.
      const overflow = await page.evaluate(() =>
        [...document.querySelectorAll('.page')].map((el, i) => ({ n: i + 1, h: el.scrollHeight })).filter((x) => x.h > 1056));
      if (overflow.length) console.warn(`⚠️  ${aud}/${ver}: páginas que desbordan 1056px →`, JSON.stringify(overflow));
      await page.pdf({ path: `${base}.pdf`, width: '816px', height: '1056px', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
      const n = await page.evaluate(() => document.querySelectorAll('.page').length);
      await page.close();
      console.log(`✅ ${aud}/${ver}: ${base}.pdf (${n} páginas)`);
    }
  } finally {
    await browser.close();
  }
}

render().catch((e) => { console.error(e); process.exit(1); });
