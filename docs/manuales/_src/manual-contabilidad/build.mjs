// Genera el manual de Contabilidad en sus dos versiones (interno / academias)
// como HTML + PDF, con las capturas reales de ./shots/ (capture.mjs).
//
//   node docs/manuales/_src/manual-contabilidad/build.mjs
//
// Sistema visual: el de todos los manuales (memoria feedback_pdf_manual_template,
// docs/manuales/README.md). Chromium de Playwright hace los recortes y el PDF.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../..');
const require = createRequire(path.join(repo, 'frontend', 'package.json'));
const { chromium } = require('playwright');

const SHOTS = path.join(here, 'shots');
const CROPS = path.join(here, 'shots', 'crops');
const OUT = {
  academias: path.join(repo, 'docs/manuales/academias/manual-contabilidad'),
  interno: path.join(repo, 'docs/manuales/interno/manual-contabilidad'),
};
const SCALE = 2;

// Coordenadas en CSS px (las capturas son 1600×1000 o 1600×H, @2x).
const CROP_DEFS = {
  'menu.png':              { src: '05-libro-junio-top.png',       x: 0,   y: 505, w: 256,  h: 312 },
  'libro-junio.png':       { src: '05-libro-junio-top.png',       x: 290, y: 250, w: 1270, h: 400 },
  'cargar-mas.png':        { src: '05-cargar-mas.png',            x: 290, y: 650, w: 1270, h: 300 },
  'cargar-mas-despues.png':{ src: '05-cargar-mas-despues.png',    x: 290, y: 820, w: 1270, h: 180 },
  'panel-kpis.png':        { src: '01-panel-owner.png',           x: 272, y: 170, w: 1310, h: 166 },
  'pagos-kpis.png':        { src: '19-gestion-pagos.png',         x: 272, y: 160, w: 1310, h: 156 },
  'edr-kpis.png':          { src: '17-estado-resultados.png',     x: 290, y: 190, w: 1270, h: 130 },
  'dialogo-gasto.png':     { src: '03-dialogo-gasto.png',         x: 544, y: 150, w: 512,  h: 700 },
  'libro-octubre.png':     { src: '22-libro-octubre-final.png',   x: 290, y: 255, w: 1270, h: 625 },
  'dialogo-proveedor.png': { src: '08-dialogo-proveedor.png',     x: 544, y: 300, w: 512,  h: 400 },
  'dialogo-factura.png':   { src: '09-dialogo-factura.png',       x: 544, y: 261, w: 512,  h: 478 },
  'dialogo-abono.png':     { src: '10-dialogo-abono.png',         x: 544, y: 339, w: 512,  h: 323 },
  'proveedores.png':       { src: '11-proveedores-con-factura.png', x: 290, y: 100, w: 1270, h: 625 },
  'dialogo-empleado.png':  { src: '12-dialogo-empleado.png',      x: 544, y: 260, w: 512,  h: 480 },
  'empleados.png':         { src: '13-empleados.png',             x: 290, y: 245, w: 1270, h: 255 },
  'nomina.png':            { src: '14-nomina-borrador-full.png',  x: 289, y: 250, w: 1260, h: 780 },
  'presupuesto.png':       { src: '16-presupuesto-guardado.png',  x: 289, y: 102, w: 1260, h: 1012 },
  'edr-grafico.png':       { src: '17-estado-resultados.png',     x: 285, y: 95,  w: 1275, h: 670 },
  'edr-tabla.png':         { src: '17-estado-resultados.png',     x: 285, y: 778, w: 1275, h: 450 },
  'invitar-contador.png':  { src: '18-invitar-contador.png',      x: 544, y: 94,  w: 512,  h: 812 },
  'coach-panel.png':       { src: '20-coach-panel.png',           x: 0,   y: 0,   w: 1590, h: 760 },
  'coach-denegado.png':    { src: '21-coach-accounting.png',      x: 576, y: 308, w: 448,  h: 384 },
};

async function makeCrops(browser) {
  fs.mkdirSync(CROPS, { recursive: true });
  const page = await browser.newPage();
  for (const [out, def] of Object.entries(CROP_DEFS)) {
    const src = path.join(SHOTS, def.src);
    if (!fs.existsSync(src)) throw new Error(`Falta la captura ${def.src}. Corre capture.mjs primero — este manual no lleva mockups.`);
    const b64 = fs.readFileSync(src).toString('base64');
    const cropped = await page.evaluate(async ([b64, d, s]) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = d.w * s; c.height = d.h * s;
      c.getContext('2d').drawImage(img, d.x * s, d.y * s, d.w * s, d.h * s, 0, 0, d.w * s, d.h * s);
      return c.toDataURL('image/png').split(',')[1];
    }, [b64, def, SCALE]);
    fs.writeFileSync(path.join(CROPS, out), Buffer.from(cropped, 'base64'));
  }
  await page.close();
}

// ── Piezas ────────────────────────────────────────────────────────────────
function img(file, caption, style) {
  const fp = fs.existsSync(path.join(CROPS, file)) ? path.join(CROPS, file) : path.join(SHOTS, file);
  if (!fs.existsSync(fp)) throw new Error(`Falta ${file}`);
  const b64 = fs.readFileSync(fp).toString('base64');
  return `<div class="shot-wrap"><img class="shot" style="${style}" src="data:image/png;base64,${b64}" alt="${caption}"/>` +
    (caption ? `<div class="shot-caption">${caption}</div>` : '') + `</div>`;
}
const crop = (file, caption, width) => img(file, caption, `width:${width}px;max-height:none`);

const step = (n, title, body, pic = '') =>
  `<div class="step"><div class="step-head"><div class="step-badge">${n}</div><div class="step-title">${title}</div></div>${body}${pic}</div>`;
const p = (html, cls = '') => `<p${cls ? ` class="${cls}"` : ''}>${html}</p>`;
const warn = (tag, html) => `<div class="callout warn"><span class="tag">${tag}</span>${html}</div>`;
const tip = (tag, html) => `<div class="callout tip"><span class="tag">${tag}</span>${html}</div>`;
const internal = (html) => `<div class="callout internal"><span class="tag">🔒 Interno</span>${html}</div>`;
const chapter = (n, title, crumb, intro) =>
  `<div class="chapter-head"><div class="chapter-badge">${n}</div><h2 class="chapter-title">${title}</h2></div>` +
  `<div class="breadcrumb">${crumb}</div><hr class="chapter-rule" />${intro ? p(intro) : ''}`;
const table = (headers, rows) =>
  `<table class="tbl"><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>` +
  rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('') + `</table>`;
const twoCol = (a, b) => `<div style="display:flex;gap:18px;align-items:flex-start"><div style="flex:1">${a}</div><div style="flex:1">${b}</div></div>`;

// ── Contenido: cada entrada del array es UNA página ───────────────────────
function pages(isInternal) {
  const I = (html) => (isInternal ? internal(html) : '');
  const pgs = [];

  // ── Cap. 1 — Dónde está y quién lo ve ──
  pgs.push(
    chapter(1, 'Dónde está la contabilidad y quién la ve', 'Menú lateral → Finanzas → Contabilidad',
      'La contabilidad reúne en un solo lugar el dinero que entra (los pagos de las familias) y el que sale (gastos, proveedores y nómina). Tiene cinco pantallas, todas dentro de <b>Finanzas → Contabilidad</b>.') +
    `<div style="display:flex;gap:22px;align-items:flex-start">
      <div style="flex:0 0 250px">${crop('menu.png', 'El submenú, tal como lo ve el dueño.', 240)}</div>
      <div style="flex:1">${table(['Pantalla', 'Para qué sirve'], [
        ['<b>Contabilidad</b>', 'Libro de caja del mes: ingresos, egresos y flujo neto. Aquí se registran los gastos.'],
        ['<b>Proveedores</b>', 'Proveedores, facturas por pagar y sus abonos.'],
        ['<b>Nómina</b>', 'Empleados, cálculo del mes, desprendible y pago.'],
        ['<b>Estado de resultados</b>', 'El año completo por mes y por categoría, con exportación a CSV.'],
        ['<b>Presupuesto</b>', 'Cuánto planeas gastar por categoría y cuánto llevas.'],
      ])}</div></div>` +
    step(1, '¿Quién ve qué?', table(['Rol', 'Qué puede hacer en Contabilidad'], [
      ['<b>Dueño / administrador</b>', 'Todo: ver, registrar gastos, proveedores y facturas, abonar, liquidar y pagar la nómina, fijar el presupuesto, exportar.'],
      ['<b>Contador</b> (rol nuevo)', 'Ver y exportar todo. <b>No</b> puede registrar, pagar ni liquidar: esos botones no le aparecen.'],
      ['<b>Entrenador</b>', 'Nada de dinero. No ve la contabilidad ni los ingresos en su panel (capítulo 8).'],
      ['<b>Familias y deportistas</b>', 'Solo sus propios cobros, en Mis Pagos. Nunca la contabilidad de la escuela.'],
    ])) +
    tip('Cómo se activa', 'La Contabilidad viene incluida en el plan <b>Elite</b> o se activa como módulo aparte. Si al entrar ves un candado con "Este módulo no está activo en tu plan", pulsa <b>Ver planes y activar</b> o escríbenos por soporte.')
  );

  // ── Cap. 2 — Libro de caja ──
  pgs.push(
    chapter(2, 'El libro de caja, mes por mes', 'Finanzas → Contabilidad → pestaña Libro de caja',
      'El libro muestra <b>un mes a la vez</b>. Arriba, tres totales del mes completo; abajo, cada movimiento con su fecha, tipo, concepto, origen y monto.') +
    step(1, 'Elegir el mes',
      p('Abre en el mes actual. Cambia el mes en el campo <b>Mes</b> y todo se recalcula: <b>Ingresos</b> (pagos cobrados a las familias), <b>Egresos</b> (gastos, abonos a proveedores y nómina pagada) y <b>Flujo neto</b> (la resta). Las tarjetas Todos / Ingresos / Egresos filtran la lista.'),
      crop('libro-junio.png', 'Junio de 2026 en el club demo: 46 ingresos, 6 egresos.', 696)) +
    step(2, 'Cómo leer cada fila',
      p('<b>Origen "Pago"</b> = un cobro a una familia que ya quedó pagado. <b>Origen "Gasto"</b> = un egreso que registró la escuela (gasto, abono a un proveedor o nómina). El clip junto a un egreso abre su comprobante, si lo tiene. Los pagos de las familias entran solos: <b>no hay que registrarlos aquí</b>.', 'no-shot')) +
    I('Fuente: <code>finance_ledger_page</code> (keyset por <code>(fecha DESC, id DESC)</code>, 50 por página) y <code>finance_ledger_totals</code> (totales del servidor, nunca la suma de la página), migración <code>20261003202421</code>. Con sede activa, el libro incluye los movimientos <b>sin sede</b> (regla A3). El clip aparece en <b>todos</b> los egresos, tengan o no adjunto; sin adjunto responde "Sin comprobante" (hueco menor).')
  );
  pgs.push(
    step(3, 'Meses con muchos movimientos: "Cargar más"',
      p('La lista trae los movimientos de <b>50 en 50</b>. Si el mes tiene más, al final aparece <b>Cargar más</b> y, abajo a la izquierda, cuántos ves de cuántos hay ("50 de 52 movimiento(s)").'),
      crop('cargar-mas.png', 'Final de la lista de junio: 50 de 52 y el botón Cargar más.', 640) +
      crop('cargar-mas-despues.png', 'Después de pulsarlo: 52 de 52.', 640)) +
    tip('Los totales no dependen de lo que hayas cargado', 'Ingresos, Egresos y Flujo neto siempre suman el <b>mes completo</b>, aunque en la lista veas solo los primeros 50. Antes los totales se calculaban con lo que había llegado a la pantalla y podían quedarse cortos.') +
    warn('Movimientos sin fecha', 'Si la escuela importó pagos antiguos sin fecha, junto al mes aparece una casilla "Incluir N movimiento(s) sin fecha". No se suman a ningún mes hasta que se marque la casilla, para que no se pierdan en silencio.') +
    I('<b>Gate del módulo (cap. 1):</b> gate doble: el menú se oculta con el addon <code>accounting</code> (<code>navigation.ts</code>, <code>moduleKey: finanzas_contabilidad</code>) y la base exige el addon para escribir (<code>finance_permission</code> devuelve false en <code>write/pay/void/close</code> sin addon, migración <code>20261003202416</code>). La <b>lectura</b> sigue sin addon a propósito (N4: Dynasty factura con <code>invoicing</code> sin <code>accounting</code>). En el demo el addon estaba apagado y se prendió para este manual.')
  );
  pgs.push(
    step(4, 'Una sola cifra de ingresos en todas partes',
      p('El ingreso cobrado sale de <b>una sola fórmula</b>, la misma en el <b>Panel de Escuela</b> ("Ingresos del Mes"), en los indicadores de <b>Gestión de Pagos</b> y en el <b>libro de caja</b> y el estado de resultados. Si dos pantallas miran el mismo período, dan el mismo número, al peso.'),
      crop('panel-kpis.png', 'Panel de Escuela: Ingresos del Mes de octubre = $0, igual que el libro de octubre.', 696) +
      crop('pagos-kpis.png', 'Gestión de Pagos: Ingresos Totales (histórico) $39.010.000…', 696) +
      crop('edr-kpis.png', '…y Estado de resultados 2026: Ingresos $39.010.000. En el demo todos los cobros son de 2026, por eso coinciden.', 696)) +
    tip('Qué período mira cada pantalla', '<b>Panel</b>: el mes en curso. <b>Gestión de Pagos</b>: histórico, todos los meses. <b>Libro</b>: el mes que elijas. <b>Estado de resultados</b>: el año que elijas. Para comparar, compara el mismo período.') +
    I('Fórmula única <code>finance_income_summary</code> / <code>finance_income_lines</code> (migración <code>20261003202419</code>, invariante IC6): <code>paid</code> → <code>LEAST(amount, COALESCE(amount_paid, amount))</code>, <code>partial</code> → <code>amount_paid</code>. Consumidores: <code>cash_ledger</code>, <code>school_payment_kpis</code>, <code>fetchMonthlyRevenue</code> (panel) y <code>finance_pnl_monthly</code>. Verificado en las capturas: $39.010.000 en KPIs y EdR.')
  );

  // ── Cap. 3 — Gastos ──
  pgs.push(
    chapter(3, 'Registrar un gasto con su comprobante', 'Contabilidad → botón "Registrar gasto"',
      'Todo lo que sale de la caja y no es un abono a proveedor ni la nómina se registra aquí: arriendo, servicios, implementos, transporte, publicidad…') +
    step(1, 'Llenar el formulario',
      p('<b>Categoría</b>, <b>Concepto</b> y <b>Monto</b> son obligatorios. La <b>Fecha</b> es el día en que salió el dinero (decide en qué mes cae). Elige el <b>método de pago</b>, anota la <b>referencia</b> de la transferencia o del recibo y, en <b>Comprobante</b>, adjunta la foto o el PDF de la factura (PDF, PNG, JPG o WEBP).') +
      `<div style="display:flex;gap:20px;align-items:flex-start"><div style="flex:0 0 400px">${crop('dialogo-gasto.png', 'Registrar gasto: arriendo de octubre con su cuenta de cobro adjunta.', 390)}</div>
        <div style="flex:1">${p('<b>Guardar gasto</b> lo deja como egreso <b>pagado</b>: aparece de inmediato en el libro del mes, en el estado de resultados y en lo "Ejecutado" del presupuesto.')}
        ${tip('Buena práctica', 'Adjunta siempre el comprobante: es lo que tu contador va a pedir. Las fotos se comprimen solas al subir.')}</div></div>`)
  );
  pgs.push(
    step(2, 'Verlo en el libro',
      p('El gasto queda en el mes de su fecha, con el clip para abrir el comprobante. En la captura también aparece el abono a un proveedor del capítulo 4: entra al libro solo, con origen "Gasto".'),
      crop('libro-octubre.png', 'Octubre: el gasto de arriendo y el abono al proveedor.', 696)) +
    warn('Los gastos no se borran ni se editan', 'Un egreso registrado queda en el libro para siempre: así nadie puede desaparecer una salida de dinero. <b>Revisa monto, fecha y categoría antes de guardar.</b> Si te equivocaste, escríbenos por soporte con el concepto y la fecha del gasto: lo <b>anulamos</b> (deja de sumar, pero queda el registro de quién lo hizo y cuándo) y tú registras el correcto.') +
    I('Hoy <b>no existe "Anular" en la interfaz ni una RPC de anulación</b> de gastos (el spec §3.5 la pide: botón con motivo ≥ 10 caracteres y reverso). La base ya prohíbe <code>UPDATE/DELETE</code> de <code>expenses</code> a <code>authenticated</code> (M4 <code>20261003202424</code>) y audita en <code>audit_logs</code> con <code>old_data/new_data</code>. Soporte anula con <code>update expenses set status=\'void\'</code> como postgres (el libro solo suma <code>status=\'paid\'</code>); queda auditado. Tampoco se pueden registrar montos negativos para compensar (<code>zAmountPositive</code>).')
  );

  // ── Cap. 4 — Proveedores ──
  pgs.push(
    chapter(4, 'Proveedores y cuentas por pagar', 'Finanzas → Contabilidad → Proveedores',
      'Cuando un proveedor te entrega una factura que pagarás después (a 30 días, por cuotas), regístrala aquí. La pantalla te dice cuánto debes en total y cuánto está vencido.') +
    twoCol(
      step(1, 'Crear el proveedor',
        p('Botón <b>+ Proveedor</b>. Solo el nombre es obligatorio; el NIT/CC, teléfono, contacto y correo ayudan a tu contador.'),
        crop('dialogo-proveedor.png', 'Nuevo proveedor.', 320)),
      step(2, 'Registrar su factura',
        p('Botón <b>+ Factura</b>: proveedor, número de factura, monto, categoría (la usa el estado de resultados), fecha de emisión y de vencimiento.'),
        crop('dialogo-factura.png', 'Factura FE-1043 a 30 días.', 320))) +
    tip('Registrar la factura no mueve la caja', 'Una factura por pagar es una <b>deuda</b>, no un egreso: el libro de caja no cambia hasta que la pagas (paso 3).')
  );
  pgs.push(
    step(3, 'Pagar todo o abonar',
      p('En la fila de la factura, <b>Pagar</b>. Deja el monto vacío para pagar el <b>saldo completo</b>, o escribe un valor menor para un <b>abono</b>. Fecha, método y referencia del giro. Cada pago entra al libro de caja como egreso, con la categoría de la factura.'),
      crop('dialogo-abono.png', 'Abono de $800.000 sobre un saldo de $1.850.000.', 400)) +
    step(4, 'Seguir el saldo',
      p('La factura pasa a <b>Abonada</b> y el <b>Saldo</b> baja. <b>Total por pagar</b> suma los saldos abiertos; <b>Vencido</b>, los que pasaron su fecha (se marcan "Vencida"). Al pagar el último peso queda <b>Pagada</b>. El sistema no deja pagar más que el saldo.'),
      crop('proveedores.png', 'Saldo $1.050.000 después del abono.', 470)) +
    I('<code>pay_supplier_bill</code> (DEFINER, <code>FOR UPDATE</code>, CHECK <code>amount_paid &lt;= amount</code>) crea un <code>expenses</code> con concepto "Pago proveedor: …". No hay editar/anular factura ni proveedor en la UI, ni "un giro que paga N facturas", ni antigüedad 0-30/31-60 (spec §5.3, fases futuras).')
  );

  // ── Cap. 5 — Nómina ──
  pgs.push(
    chapter(5, 'Nómina: empleados, cálculo, desprendible y pago', 'Finanzas → Contabilidad → Nómina',
      'La nómina se hace en tres pasos: tener a los empleados al día, <b>calcular</b> el mes (queda en borrador para revisar) y <b>pagar</b>, que es lo único que mueve la caja.') +
    step(1, 'Agregar empleados',
      p('Pestaña <b>Empleados → + Empleado</b>: nombre, documento, tipo de contrato, salario base, clase de riesgo ARL, si aplica auxilio de transporte, EPS y AFP. <b>Editar</b> corrige los datos; <b>Inactivar</b> lo saca de las próximas nóminas sin borrar su historia.') +
      crop('dialogo-empleado.png', 'Nuevo empleado.', 360) + crop('empleados.png', 'La lista de empleados activos, con Editar e Inactivar.', 640))
  );
  pgs.push(
    step(2, 'Calcular el mes',
      p('Pestaña <b>Nómina</b>: elige mes y año y pulsa <b>Calcular nómina</b>. Aparece el <b>desprendible</b> en estado <b>Borrador</b>. Mientras esté en borrador puedes corregir un empleado y volver a calcular: el borrador se rehace.'),
      crop('nomina.png', 'Octubre de 2026 calculado, en borrador.', 640)) +
    table(['Columna', 'Qué es'], [
      ['Salario / Auxilio', 'Lo que devenga el empleado (el auxilio solo si aplica).'],
      ['Deducciones', 'Lo que se le descuenta: salud y pensión del empleado.'],
      ['Aportes patr.', 'Lo que paga la escuela encima: pensión, ARL, caja de compensación (y salud, SENA e ICBF cuando no hay exoneración; la etiqueta "exon." lo indica).'],
      ['Provisiones', 'Lo que se va guardando para prima, cesantías, intereses y vacaciones. <b>No sale de la caja este mes.</b>'],
      ['Neto', 'Lo que recibe el empleado.'],
    ])
  );
  pgs.push(
    step(3, 'Desprendible en PDF',
      p('El botón <b>PDF</b> abre el desprendible del mes listo para imprimir o guardar, con todos los empleados y sus totales.', 'no-shot')) +
    step(4, 'Pagar: qué sale de la caja',
      p('El botón dice exactamente cuánto saldrá: <b>Pagar (caja $…)</b>. Ese valor es el <b>bruto</b> (salario + auxilio) <b>más los aportes patronales</b>. En el ejemplo: $2.100.000 + $249.095 + $346.962 = <b>$2.696.057</b>. No es el neto: lo que se descuenta al empleado también sale de la caja (va a la seguridad social), y los aportes de la escuela también.', 'no-shot')) +
    warn('Pagar es definitivo', 'Al pagar, la nómina queda <b>Pagada</b>, entra al libro como un solo egreso de la categoría Nómina y ya no se recalcula. Revisa el borrador antes. Pagarla dos veces no duplica el egreso.') +
    tip('Salario mínimo, auxilio y UVT: los actualiza SportMaps', 'Los parámetros de cada año (salario mínimo, auxilio de transporte, UVT, porcentajes) los carga el equipo de SportMaps. Si al calcular ves "Faltan los parámetros de nómina de 2027", escríbenos por soporte: no tienes que configurar nada.') +
    I('<code>post_payroll_run</code> crea el egreso por <code>total_gross + total_employer</code> (Fase 1 <code>20261002130001</code> / <code>20261003201142</code>; antes era <code>total_net</code>) y es idempotente. <code>run_payroll</code> sin <code>/12</code> en intereses de cesantías. Parámetros en <code>/admin/payroll-config</code> (super admin); hoy solo existe <b>2026</b> (SMMLV 1.750.905): <b>hay que cargar 2027 antes del 1-ene</b> o nadie podrá calcular enero. No hay aviso automático (spec N10). Tampoco hay anular nómina pagada, salario integral, FSP escalonado, retención en la fuente ni pago de provisiones (spec §4).')
  );

  // ── Cap. 6 — Presupuesto ──
  pgs.push(
    chapter(6, 'Presupuesto anual por categoría', 'Finanzas → Contabilidad → Presupuesto',
      'Escribe cuánto planeas gastar en el año por categoría y pulsa <b>Guardar</b>. La pantalla compara contra lo <b>Ejecutado</b> (los egresos pagados del año en esa categoría) y muestra el avance; si una categoría se pasa, la barra se pone roja con la etiqueta "Excedido".') +
    crop('presupuesto.png', 'Presupuesto 2026 del club demo: arriendo, servicios, insumos y marketing.', 560) +
    tip('Cambiar de año', 'El campo <b>Año</b> muestra el presupuesto de otro año. Las categorías sin valor quedan "Sin presupuesto" y no cuentan en el total presupuestado.') +
    I('El ejecutado se lee de <code>expenses</code> directo (no de la fórmula única) y solo egresos; no hay presupuesto de ingresos ni mensual (<code>period_month = 0</code>). Al contador las casillas le aparecen <b>editables</b> aunque no tenga botón Guardar (la base le niega el upsert): confunde.')
  );

  // ── Cap. 7 — Estado de resultados ──
  pgs.push(
    chapter(7, 'Estado de resultados y exportar a CSV', 'Finanzas → Contabilidad → Estado de resultados',
      'El año completo: ingresos, egresos y resultado neto, el flujo de cada mes y en qué se fue el dinero por categoría.') +
    crop('edr-grafico.png', 'Estado de resultados 2026 del club demo.', 580) +
    crop('edr-tabla.png', 'Egresos por categoría, con su porcentaje del total.', 440) +
    step(1, 'Exportar CSV',
      p('<b>Exportar CSV</b> descarga <code>estado-resultados-2026.csv</code> con el resumen, los egresos por categoría y el flujo de los 12 meses, para abrirlo en Excel o entregárselo al contador.', 'no-shot')) +
    I('Agregado en el servidor (<code>finance_pnl_monthly</code>). El CSV sale <b>sin BOM y con coma</b>: en Excel en español las tildes salen rotas ("CategorÃ­a") y todo cae en una columna; una categoría con coma rompe la fila (no hay comillas). Tampoco existe exportar el <b>detalle</b> del libro (movimiento por movimiento), que es lo que pide un contador (spec §5.8: <code>;</code>, UTF-8 con BOM, libro diario).')
  );

  // ── Cap. 8 — Contador y coach ──
  pgs.push(
    chapter(8, 'Invitar a tu contador', 'Menú lateral → Invitaciones → Nueva Invitación → Contador',
      'El rol <b>Contador</b> es para la persona que lleva tus libros: ve toda la contabilidad y exporta, pero no puede registrar, pagar ni liquidar nada.') +
    `<div style="display:flex;gap:20px;align-items:flex-start"><div style="flex:0 0 300px">${crop('invitar-contador.png', 'Nueva invitación con el tipo Contador.', 290)}</div><div style="flex:1">` +
    step(1, 'Crear la invitación', p('En <b>Invitaciones</b>, <b>Nueva Invitación</b> y el tipo <b>🧾 Contador</b>. Escribe su correo (o su WhatsApp) y pulsa <b>Crear &amp; Copiar Link</b>. Envíale el enlace.', 'no-shot')) +
    step(2, 'El contador crea su cuenta', p('Al abrir el enlace se registra y entra directo a su menú <b>Contabilidad</b>: Libro de caja, Proveedores, Nómina, Estado de resultados y Presupuesto.', 'no-shot')) +
    step(3, 'Qué ve y qué no', p('Ve los mismos números que tú, abre comprobantes, descarga el desprendible y exporta el CSV. <b>No</b> le aparecen Registrar gasto, + Proveedor, + Factura, Pagar, Calcular nómina ni Guardar presupuesto. Tampoco ve deportistas, equipos ni la gestión de cobros.', 'no-shot')) +
    `</div></div>` +
    tip('Para quitarle el acceso', 'Desactívalo como a cualquier otro miembro del equipo de tu escuela.') +
    I('Rol <code>accountant</code>: en el enum <code>user_role</code> (<code>20261003202413</code>) y en <code>school_members</code>; <code>accept_invitation_pro</code> pone <code>profiles.role</code> y la membresía. Se excluye de <code>staff_school_ids()</code>/<code>user_staff_school_ids()</code> (N1) para que no pueda marcar pagos ni tocar equipos. <b>Este manual no trae capturas de la vista del contador</b>: crear una cuenta de prueba no se autorizó en esta sesión. Hoy hay <b>0 contadores</b> en toda la base: el flujo de invitación completo no se ha probado de punta a punta en un ambiente desplegado.')
  );
  pgs.push(
    chapter(9, 'El entrenador no ve dinero', 'Panel de Entrenador', 'El coach trabaja con sus equipos, la asistencia y las sesiones. Su panel no muestra ingresos y la contabilidad no le aparece en el menú; si abre el enlace directo, ve "Acceso Denegado".') +
    crop('coach-panel.png', 'Panel del entrenador de tenis del club demo: deportistas, equipos, eventos y asistencia. Sin ingresos.', 640) +
    crop('coach-denegado.png', 'Lo que ve el coach si entra a /accounting.', 300) +
    I('Antes el coach veía "Ingresos del mes" (C4) por dos vías: <code>useDashboardStatsReal</code> y la policy <code>Payments: select staff</code>. Ahora <code>roleRequestsSchoolRevenue</code> no lo incluye y <code>finance_income_summary</code> le responde 42501. El bloqueo de la ruta es de <code>routePermissions</code> (sin <code>coach</code>).')
  );

  if (isInternal) {
    pgs.push(
      chapter(10, 'Notas internas: tienda, huecos y datos del demo', 'Solo equipo SportMaps — no prometer a la escuela', '') +
      warn('Ventas de la tienda: todavía NO llegan al libro', 'Las ventas de la tienda escolar (addon <code>store</code>) no aparecen en el libro de caja ni en el estado de resultados. La tabla <code>accounting_outbox</code> existe (migración <code>20261003202429</code>), pero no hay <code>process_accounting_outbox()</code> ni cron que la postee (spec contabilidad-v2 §6). Si una escuela vende en la tienda, sus ingresos de tienda quedan <b>fuera</b> de la contabilidad hasta la fase correspondiente. No decirlo como "ya integrado".') +
      table(['Hueco', 'Dónde', 'Nota'], [
        ['Anular un gasto', 'Libro de caja', 'No hay botón ni RPC; solo soporte por SQL. El spec pide Anular con motivo y reverso.'],
        ['Exportar el libro (detalle)', 'Libro / EdR', 'Solo hay CSV del resumen anual, con coma y sin BOM.'],
        ['Parámetros de nómina 2027', '/admin/payroll-config', 'Solo existe 2026. Sin aviso de fin de año.'],
        ['Clip en todos los egresos', 'Libro de caja', 'Aunque no tengan comprobante.'],
        ['Inputs editables para el contador', 'Presupuesto', 'Sin botón Guardar, pero las casillas se dejan escribir.'],
        ['Editar / anular factura de proveedor', 'Proveedores', 'No existe; tampoco antigüedad de saldos.'],
        ['Vista del contador sin probar en vivo', 'Rol accountant', '0 contadores en la base.'],
      ]) +
      tip('Datos que dejó este manual en el demo (Club Campestre Demo, 2026-10-05)', 'Addon <code>accounting</code> prendido (fila <code>85e3173c…</code>, estaba apagado). 10 gastos de junio-agosto por SQL (referencia <code>DEMO-MANUAL</code>), 1 gasto de octubre con comprobante, 1 proveedor (Deportes El Campeón S.A.S.), 1 factura FE-1043 con 1 abono de $800.000 (genera 1 egreso), 1 empleada (Andrea Molina Ruiz), 1 nómina de octubre en <b>borrador</b> (no pagada) y 4 filas de presupuesto 2026. Ningún cobro aprobado, nada de facturación electrónica. Lista exacta de IDs en el informe de la sesión.') +
      p('<b>Regenerar:</b> <code>node docs/manuales/_src/manual-contabilidad/capture.mjs</code> (reanudable; <code>ONLY=05,17</code> para rehacer capturas sueltas sin volver a escribir) y luego <code>build.mjs</code>.')
    );
  }
  return pgs;
}

// ── Documento ─────────────────────────────────────────────────────────────
function cover(isInternal, nChapters) {
  return `<div class="page cover"><div class="cover-inner">
    <div><div class="logo"><span class="pin"></span>SportMaps</div></div>
    <div>
      <div class="cover-eyebrow"><span class="dot" style="background:${isInternal ? '#ff8833' : '#4fd17a'}"></span>${isInternal ? '🔒 Uso interno — no enviar a escuelas' : 'Guía de uso · Academias'}</div>
      <h1 class="cover-title">Contabilidad de tu escuela</h1>
      <p class="cover-sub">Libro de caja por mes, gastos con comprobante, proveedores y abonos, nómina, presupuesto y estado de resultados. Y cómo darle acceso de solo lectura a tu contador.</p>
      <div class="pills">
        <span class="pill">Roles: Dueño/Admin · Contador</span>
        <span class="pill">${nChapters} capítulos</span>
        <span class="pill">Capturas reales del producto</span>
        ${isInternal ? '<span class="pill" style="border-color:#ff8833;color:#ffcf9e">Uso interno</span>' : ''}
      </div>
    </div>
    <div class="cover-footer">SportMaps © 2026 · octubre</div>
  </div></div>`;
}

const css = () => fs.readFileSync(path.join(here, 'manual.css'), 'utf8');

function html(isInternal) {
  const body = pages(isInternal);
  const total = body.length + 1;
  const foot = (n) => `<div class="footer${isInternal ? ' internal-mark' : ''}"><span>SportMaps · ${isInternal ? 'Uso interno' : 'Guía de uso'}</span><span>Página ${n} de ${total}</span></div>`;
  return `<!doctype html><html><head><meta charset="utf-8" /><title>SportMaps — Contabilidad (${isInternal ? 'Interno' : 'Academias'})</title><style>${css()}</style></head><body>` +
    cover(isInternal, isInternal ? 10 : 9) +
    body.map((pg, i) => `<div class="page">${pg}${foot(i + 2)}</div>`).join('\n') +
    `</body></html>`;
}

async function render() {
  const browser = await chromium.launch();
  try {
    await makeCrops(browser);
    for (const [ver, base] of Object.entries(OUT)) {
      const isInternal = ver === 'interno';
      const doc = html(isInternal);
      fs.mkdirSync(path.dirname(base), { recursive: true });
      fs.writeFileSync(`${base}.html`, doc, 'utf8');
      const page = await browser.newPage();
      await page.goto('file:///' + `${base}.html`.replace(/\\/g, '/'));
      await page.waitForFunction(() => [...document.images].every((img) => img.complete && img.naturalHeight > 0));
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.evaluate(() =>
        [...document.querySelectorAll('.page')].map((el, i) => {
          // Además de scrollHeight: que el contenido no pise el pie (bottom > 1056 - 76).
          const top = el.getBoundingClientRect().top;
          const kids = [...el.children].filter((c) => !c.classList.contains('footer') && !c.classList.contains('cover-inner'));
          const bottom = Math.max(0, ...kids.map((c) => c.getBoundingClientRect().bottom - top));
          return { n: i + 1, h: el.scrollHeight, bottom: Math.round(bottom) };
        }).filter((x) => x.h > 1056 || x.bottom > 980));
      if (overflow.length) console.warn(`⚠️  ${ver}: páginas que desbordan 1056px →`, overflow);
      await page.pdf({ path: `${base}.pdf`, width: '816px', height: '1056px', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
      const n = await page.evaluate(() => document.querySelectorAll('.page').length);
      await page.close();
      console.log(`✅ ${ver}: ${base}.pdf (${n} páginas esperadas)`);
    }
  } finally {
    await browser.close();
  }
}

render().catch((e) => { console.error(e); process.exit(1); });
