// PDF del informe responsive (Chromium de Playwright, page.pdf).
//   node scripts/qa-responsive/pdf.mjs <outDir> [docs/qa-responsive-baseline.pdf]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { REPO } from './extract-routes.mjs';
import { analyze } from './report.mjs';
import { CATEGORIES } from './lib.mjs';

const require = createRequire(path.join(REPO, 'frontend', 'package.json'));
const { chromium } = require('playwright');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const shortSel = (s) => (s || '').split(' > ').slice(-2).join(' > ');
const ROLE_ES = { school: 'Escuela (owner)', school_admin: 'Admin de escuela (coordinador)', coach: 'Entrenador', parent: 'Acudiente', athlete: 'Atleta', reporter: 'Auditor (reporter)' };

function bar(v) {
  const c = v >= 90 ? '#2a7a3f' : v >= 70 ? '#d69e2e' : '#e53e3e';
  return `<span class="nowrap"><span class="bar"><span style="width:${Math.max(2, v)}%;background:${c}"></span></span><b>${v}%</b></span>`;
}

export async function buildPdf(outDir, dest) {
  const { summary } = analyze(outDir);
  const t = summary.totals;
  const img = (rel) => (rel ? pathToFileURL(path.join(outDir, rel)).href : '');
  const zoomSorted = Object.entries(summary.byZoom).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
  const cats = Object.entries(summary.categories).sort((a, b) => (a[1].sev === b[1].sev ? b[1].screens - a[1].screens : a[1].sev === 'fail' ? -1 : 1));
  const baseRate = summary.byPass.base || {};

  let h = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Auditoría responsive</title>
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  @page{size:Letter;margin:14mm 13mm 16mm}
  *{box-sizing:border-box}
  body{font:10.5px/1.45 Inter,system-ui,sans-serif;color:#1a202c;margin:0}
  h1,h2,h3{font-family:'Baloo 2',Inter,sans-serif;margin:0}
  h2{font-size:21px;color:#123416;border-bottom:3px solid #2a7a3f;padding-bottom:3px;margin:0 0 10px}
  h3{font-size:14px;color:#1c5c34;margin:12px 0 5px}
  .brk{break-before:page}
  .cover{background:radial-gradient(120% 90% at 15% 95%,#2a7a3f,transparent 55%),linear-gradient(155deg,#123416,#0f2614 45%,#0c1f10);color:#fff;border-radius:14px;padding:26px 28px;margin-bottom:14px}
  .cover h1{font-size:30px;line-height:1.1}.cover p{opacity:.85;margin:6px 0 0}
  .pills span{display:inline-block;border:1px solid rgba(255,255,255,.35);border-radius:20px;padding:2px 10px;margin:10px 6px 0 0;font-size:10px}
  .kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:0 0 12px}
  .kpi{background:#f3f8f4;border:1px solid #d6e9db;border-radius:10px;padding:8px}.kpi b{display:block;font:800 20px 'Baloo 2';color:#1c5c34}.kpi span{color:#4a5568;font-size:9.5px}
  table{width:100%;border-collapse:collapse;margin:4px 0 10px}th,td{border-bottom:1px solid #e2e8f0;padding:3px 5px;text-align:left;vertical-align:top}th{background:#f3f8f4;font-weight:600;font-size:9.5px}
  .two{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  td{white-space:normal}.nowrap{white-space:nowrap}
  .bar{display:inline-block;width:56px;height:7px;background:#edf2f7;border-radius:4px;vertical-align:middle;margin-right:5px;overflow:hidden}.bar>span{display:block;height:100%}
  code{font-size:8.5px;background:#f7fafc;border:1px solid #edf2f7;border-radius:3px;padding:0 3px;word-break:break-all}
  .sev{display:inline-block;color:#fff;border-radius:8px;padding:0 6px;font-size:8.5px;font-weight:600}.fail{background:#e53e3e}.warn{background:#d69e2e}
  .note{background:#fff3e8;border:1px solid #ffb877;border-radius:8px;padding:6px 9px;margin:6px 0;font-size:9.5px}
  .tip{background:#eaf7ee;border:1px solid #79c98f;border-radius:8px;padding:6px 9px;margin:6px 0;font-size:9.5px}
  .screen{break-inside:avoid;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;margin:0 0 10px}
  .screen .shots{display:flex;gap:10px;align-items:flex-start;margin-top:6px}
  .screen figure{margin:0}.screen figcaption{font-size:9px;color:#4a5568;margin-top:2px}
  .s390{width:150px;height:325px;object-fit:cover;object-position:top;border:1px solid #cbd5e0;border-radius:8px}
  .s768{width:244px;height:325px;object-fit:cover;object-position:top;border:1px solid #cbd5e0;border-radius:8px}
  .issues{flex:1;font-size:9px}.issues li{margin-bottom:2px}
  .mut{color:#718096}
  ol.top li{margin-bottom:6px;break-inside:avoid}
</style></head><body>`;

  // ── 1. resumen ────────────────────────────────────────────────────────────
  h += `<div class="cover"><h1>Auditoría responsive<br>de SportMaps</h1><p>Línea base antes de migrar px fijos a tokens de tamaño · ${esc(summary.baseUrl)} · ${esc(new Date(summary.date).toLocaleDateString("sv-SE"))}</p>
  <div class="pills"><span>${Object.keys(summary.byRole).length} roles con cuenta demo</span><span>${t.routes} pantallas por rol (${t.uniquePaths} únicas)</span><span>${summary.configs.length} configuraciones: 6 tamaños · densidad · zoom</span><span>Club Campestre Demo · solo lectura</span></div></div>`;
  h += `<div class="kpis"><div class="kpi"><b>${t.records}</b><span>pantallas×config evaluadas</span></div><div class="kpi"><b>${t.screenshots}</b><span>capturas (${t.fullPageShots} de página completa)</span></div><div class="kpi"><b>${baseRate.passRate ?? '–'}%</b><span>pasan (pase base, 6 tamaños)</span></div><div class="kpi"><b>${baseRate.cleanRate ?? '–'}%</b><span>limpias (sin ninguna advertencia)</span></div><div class="kpi"><b>${t.errors}</b><span>errores de carga</span></div></div>`;
  h += `<div class="tip"><b>CÓMO LEERLO</b> — una pantalla <b>pasa</b> si no tiene hallazgos de severidad <span class="sev fail">falla</span> (desborde horizontal, contenido tapado por la barra inferior, pestañas cortadas, doble scroll, modal con botones fuera, imagen pixelada ≥1.5×, fuente caída, control inalcanzable con zoom). Las <span class="sev warn">advertencias</span> (toque &lt;44px, texto &lt;12px, inputs &lt;16px, scrollbars visibles…) no la tumban pero se cuentan.</div>`;
  h += `<div class="two"><div><h3>Por rol (pase base)</h3><table><tr><th>Rol</th><th>Pant.</th><th>Pasan</th><th>Limpias</th></tr>${Object.entries(summary.byRole).map(([k, v]) => `<tr><td>${esc(ROLE_ES[k] || k)}</td><td>${v.valid}</td><td>${bar(v.passRate)}</td><td>${v.cleanRate}%</td></tr>`).join('')}</table></div>
  <div><h3>Por tamaño (pase base)</h3><table><tr><th>Tamaño</th><th>Pant.</th><th>Pasan</th><th>Limpias</th></tr>${Object.entries(summary.byViewport).map(([k, v]) => `<tr><td>${esc(v.label)}</td><td>${v.valid}</td><td>${bar(v.passRate)}</td><td>${v.cleanRate}%</td></tr>`).join('')}</table></div></div>`;
  // densidad como matriz tamaño × escala: «% pasa · pantallas con imagen pixelada / texto borroso»
  const sizes = [...new Set(Object.keys(summary.byDensity).map((k) => k.split('@')[0]))];
  const scales = [...new Set(Object.keys(summary.byDensity).map((k) => k.split('@')[1]))].sort((a, b) => a - b);
  h += `<div class="two"><div><h3>Densidad (escala de Windows / retina)</h3><table><tr><th>Tamaño</th>${scales.map((s) => `<th>${Math.round(s * 100)} %</th>`).join('')}</tr>${sizes.map((sz) => `<tr><td>${esc(sz)}</td>${scales.map((sc) => { const v = summary.byDensity[`${sz}@${sc}`]; return `<td>${v ? `<b>${v.passRate}%</b><br><span class="mut">px ${v.pixelated} · bl ${v.blur}</span>` : '—'}</td>`; }).join('')}</tr>`).join('')}</table><p class="mut">px = pantallas con imagen pixelada ≥1.5× · bl = con texto potencialmente borroso.</p></div>
  <div><h3>Zoom del navegador (ventana 1440×900)</h3><table><tr><th>Zoom</th><th>% pasa</th><th>Inalcanz.</th><th>Ausentes</th><th>Desborde</th></tr>${zoomSorted.map(([k, v]) => `<tr><td>${esc(k)}</td><td><b>${v.passRate}%</b></td><td>${v.missing}</td><td>${v.variant ?? 0}</td><td>${v.overflow}</td></tr>`).join('')}</table></div></div>`;

  // ── 2. top 15 ─────────────────────────────────────────────────────────────
  h += `<div class="brk"></div><h2>Top 15 problemas y archivo fuente probable</h2>
  <p class="mut">Agrupados por (tipo de problema, archivo que pinta el elemento). El archivo se infiere cruzando el className y el texto del elemento con <code>frontend/src</code>, ponderando la página de la ruta (App.tsx) y lo que importa. Se listan las 10 fallas más extendidas y las 5 advertencias más extendidas (puntaje = pantallas afectadas + 5 × rutas distintas).</p><ol class="top">`;
  for (const g of summary.top15 || summary.top.slice(0, 15)) {
    h += `<li><span class="sev ${g.sev}">${g.sev === 'fail' ? 'falla' : 'advertencia'}</span> <b>${esc(g.label)}</b> — ${g.file ? `<code>${esc(g.file)}</code>` : g.src ? `imagen <code>${esc(g.src)}</code>` : '(sin mapeo)'}${g.alt.length ? ` <span class="mut">(o ${g.alt.slice(0, 2).map((a) => `<code>${esc(a)}</code>`).join(', ')})</span>` : ''}<br>
    <span class="mut">${g.screens} pantallas · ${g.routes.length} rutas (${esc(g.routes.slice(0, 6).join(', '))}${g.routes.length > 6 ? '…' : ''}) · configs ${esc(g.cfgs.slice(0, 8).join(' '))}${g.cfgs.length > 8 ? '…' : ''} · ${esc(g.roles.join(', '))}</span><br>
    ${g.examples.slice(0, 2).map((e) => `Ej.: ${esc(e.role)} <b>${esc(e.route)}</b> @${esc(e.cfg)} → <code>${esc(shortSel(e.sel))}</code> ${e.text ? `«${esc(e.text.slice(0, 50))}»` : ''} ${esc(e.extra || '')}`).join('<br>')}</li>`;
  }
  h += `</ol>`;

  // ── 3. categorías + pestañas/scroll/densidad ──────────────────────────────
  h += `<div class="brk"></div><h2>Hallazgos por categoría</h2><table><tr><th>Categoría</th><th>Sev.</th><th>Pantallas×config</th><th>Rutas</th><th>base</th><th>densidad</th><th>zoom</th></tr>${cats.map(([, v]) => `<tr><td>${esc(v.label)}</td><td><span class="sev ${v.sev}">${v.sev === 'fail' ? 'falla' : 'adv.'}</span></td><td>${v.screens}</td><td>${v.routes}</td><td>${v.byPass.base || 0}</td><td>${v.byPass.density || 0}</td><td>${v.byPass.zoom || 0}</td></tr>`).join('')}</table>`;
  const pick = (cat, n = 8) => summary.top.filter((g) => g.cat === cat).slice(0, n);
  const section = (title, catsList, note) => {
    const items = catsList.flatMap((c) => pick(c));
    if (!items.length) return `<h3>${title}</h3><p class="mut">Sin hallazgos.</p>`;
    return `<h3>${title}</h3>${note ? `<p class="mut">${note}</p>` : ''}<table><tr><th>Problema</th><th>Dónde</th><th>Pant.</th><th>Ejemplo</th></tr>${items.map((g) => `<tr><td>${esc(g.label)}</td><td><code>${esc(g.file || g.src || '—')}</code></td><td>${g.screens}</td><td>${esc(g.examples[0]?.route || '')} @${esc(g.examples[0]?.cfg || '')} ${esc(g.examples[0]?.extra || '')}</td></tr>`).join('')}</table>`;
  };
  h += section('Imágenes pixeladas (natural &lt; renderizado × devicePixelRatio)', ['pixelated', 'pixelatedSoft'], 'Logos, avatares, íconos y banners servidos con menos píxeles de los que pide la pantalla a esa densidad.');
  h += section('Texto borroso y fuentes', ['blur', 'fontFallback']);
  h += section('Scrollbars', ['doubleScroll', 'unexpectedH', 'tabsBar'], 'A 1440 y 1366 se capturó con scrollbars clásicas de Windows (no superpuestas) para ver las que aparecen en pestañas y filtros.');
  h += section('Pestañas (Tabs / TabsList)', ['tabsClipped', 'tabsNoIndicator', 'tabsSmall', 'tabsTruncated']);

  // ── 4. zoom ───────────────────────────────────────────────────────────────
  h += `<div class="brk"></div><h2>Zoom: qué deja de verse por pantalla y nivel</h2>
  <p class="mut">Simulado fielmente: zoom Z sobre ventana de 1440×900 = viewport (1440/Z × 900/Z) CSS con deviceScaleFactor Z (dispara los breakpoints igual que Ctrl +/−). Se compara el inventario de botones/pestañas/enlaces alcanzables a 100 % contra cada nivel.</p>
  <div class="note"><b>DOS TIPOS</b> — <b>inalcanzable</b> = el control existe pero queda recortado o fuera de pantalla sin scroll (bug seguro). <b>Ausente</b> = a ese zoom el layout pasó a otro breakpoint (a 200 % la ventana mide 720 px CSS: entra el diseño de celular) y el control no se renderiza o está oculto por CSS; puede ser intencional, conviene revisarlo.</div>`;
  const zrows = summary.zoom.filter((z) => z.unreachable.length).concat(summary.zoom.filter((z) => !z.unreachable.length));
  h += `<table><tr><th>Rol</th><th>Pantalla</th><th>Zoom</th><th>Inalcanzables</th><th>Ausentes (breakpoint)</th></tr>${zrows.slice(0, 70).map((z) => `<tr><td>${esc(z.role)}</td><td>${esc(z.route)}</td><td>${z.zoom}%</td><td>${esc(z.unreachable.slice(0, 5).join(' · ')) || '—'}</td><td class="mut">${esc(z.missing.filter((m) => !z.unreachable.includes(m)).slice(0, 5).join(' · ')) || '—'}</td></tr>`).join('')}</table>${zrows.length > 70 ? `<p class="mut">… y ${zrows.length - 70} más en report.html.</p>` : ''}`;

  // ── 5. consola/red + roles saltados + método ──────────────────────────────
  h += `<div class="brk"></div><h2>Consola, red y alcance</h2><h3>Errores de consola y peticiones fallidas (pase base)</h3><table><tr><th>Qué</th><th>Pantallas</th></tr>${summary.network.slice(0, 14).map((n) => `<tr><td><code>${esc(n.what.replace(/\s+/g, " ").slice(0, 130))}</code></td><td>${n.screens}</td></tr>`).join('')}</table>`;
  h += `<h3>Roles sin cuenta demo en Club Campestre Demo (no auditados)</h3><table><tr><th>Rol</th><th>Rutas en el menú</th><th>Motivo</th></tr>${summary.skippedRoles.map((s) => `<tr><td>${esc(s.role)}</td><td>${s.navRoutes}</td><td>${esc(s.why)}</td></tr>`).join('')}</table>`;
  h += `<h3>Cuentas usadas</h3><table>${Object.entries(summary.accounts).map(([k, v]) => `<tr><td>${esc(ROLE_ES[k] || k)}</td><td>${esc(v.email)}</td><td>${esc(v.who)}</td><td>${summary.routesPerRole[k] ?? 0} pantallas</td></tr>`).join('')}</table>`;
  h += `<div class="tip"><b>SOLO LECTURA</b> — toda escritura (PATCH/PUT/DELETE, POST a tablas, RPC con nombre de mutación, POST al BFF) se interceptó y respondió 204 sin llegar al servidor. Bloqueadas en esta corrida: ${esc(summary.blockedWrites.slice(0, 14).join(' · '))}${summary.blockedWrites.length > 14 ? '…' : ''}.</div>`;

  // ── 6. peores pantallas por rol ───────────────────────────────────────────
  for (const [role, list] of Object.entries(summary.worst)) {
    const worst = list.filter((w) => w.score > 0).slice(0, 4);
    h += `<div class="brk"></div><h2>${esc(ROLE_ES[role] || role)} — pantallas más afectadas</h2><p class="mut">${esc(summary.accounts[role]?.who || '')} · ${summary.byRole[role]?.passRate ?? '–'}% pasa en el pase base · capturas a 390 (iPhone 14) y 768 (tablet vertical), parte superior.</p>`;
    if (!worst.length) h += `<p>Sin fallas en este rol.</p>`;
    for (const w of worst) {
      h += `<div class="screen"><b>${esc(w.route)}</b> <span class="mut">${esc(w.title || '')} · <code>${esc(w.pageFile || '')}</code> · fallas en: ${esc(w.fails.join(' ') || 'ninguna (solo advertencias)')}</span>
      <div class="shots"><figure><img class="s390" src="${img(w.t390)}"><figcaption>390×844</figcaption></figure><figure><img class="s768" src="${img(w.t768)}"><figcaption>768×1024</figcaption></figure>
      <div class="issues"><b>Hallazgos</b><ul>${w.issues.slice(0, 9).map((i) => `<li>${esc(i)}</li>`).join('')}</ul>${w.details.length ? `<b>Detalle de fallas</b><ul>${w.details.slice(0, 5).map((d) => `<li>@${esc(d.cfg)} ${esc(CATEGORIES[d.cat]?.label || d.cat)}: <code>${esc(shortSel(d.sample?.sel || ''))}</code> ${esc((d.sample?.text || '').slice(0, 60))}</li>`).join('')}</ul>` : ''}</div></div></div>`;
    }
  }
  h += `</body></html>`;

  const htmlPath = path.join(outDir, 'report-pdf.html');
  fs.writeFileSync(htmlPath, h);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 30000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await page.pdf({
    path: dest, format: 'Letter', printBackground: true, preferCSSPageSize: true,
    displayHeaderFooter: true, headerTemplate: '<span></span>',
    footerTemplate: `<div style="font:8px Inter,sans-serif;color:#718096;width:100%;padding:0 13mm;display:flex;justify-content:space-between"><span>SportMaps · Auditoría responsive · uso interno</span><span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>`,
  });
  await browser.close();
  console.log(`PDF: ${dest}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  let dir = process.argv[2];
  if (!dir) { const outs = fs.readdirSync(path.join(here, 'out')).filter((d) => d.startsWith('baseline')).sort(); dir = path.join(here, 'out', outs[outs.length - 1]); }
  const dest = path.resolve(process.argv[3] || path.join(REPO, 'docs', 'qa-responsive-baseline.pdf'));
  await buildPdf(path.resolve(dir), dest);
}
