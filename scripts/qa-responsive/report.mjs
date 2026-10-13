// Informe de la auditoría responsive: summary.json + report.md + report.html
//   node scripts/qa-responsive/report.mjs scripts/qa-responsive/out/baseline-YYYY-MM-DD
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { classify, zoomMissing, mapSource, pageFileFor, CATEGORIES } from './lib.mjs';

const NON_LAYOUT = new Set(['console', 'http5xx', 'http4xx', 'pageError']);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const shortSel = (s) => (s || '').split(' > ').slice(-2).join(' > ');
const normUrl = (u) => (u || '').replace(/[?#].*$/, '').replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id');

export function loadRecords(outDir) {
  const dir = path.join(outDir, 'results');
  const recs = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const r of j.results) recs.push(r);
  }
  return recs;
}

export function analyze(outDir) {
  const plan = JSON.parse(fs.readFileSync(path.join(outDir, 'plan.json'), 'utf8'));
  const recs = loadRecords(outDir);
  const key = (r) => `${r.role}|${r.routeId}`;
  const base1440 = new Map(recs.filter((r) => r.cfg === 'v1440').map((r) => [key(r), r]));
  for (const r of recs) {
    r.pageFile = pageFileFor(r.path)?.file || null;
    const c = classify(r);
    r.status = c.status; r.issues = c.issues;
    if (r.pass === 'zoom' && r.status !== 'error') {
      const miss = zoomMissing(base1440.get(key(r)), r);
      r.zoomMissing = miss;
      const hard = miss.filter((m) => m.unreachable), soft = miss.filter((m) => !m.unreachable);
      if (hard.length) { r.issues.push({ cat: 'zoomMissing', sev: 'fail', n: hard.length, samples: hard.map((m) => ({ text: `${m.key} — ${m.why}` })) }); r.status = 'fail'; }
      if (soft.length) { r.issues.push({ cat: 'zoomVariant', sev: 'warn', n: soft.length, samples: soft.map((m) => ({ text: `${m.key} — ${m.why}` })) }); if (r.status === 'pass') r.status = 'warn'; }
    }
  }
  const valid = recs.filter((r) => r.status !== 'error');
  const rate = (list) => {
    const v = list.filter((r) => r.status !== 'error');
    const ok = v.filter((r) => r.status !== 'fail').length;
    const clean = v.filter((r) => r.status === 'pass').length;
    return { total: list.length, valid: v.length, errors: list.length - v.length, pass: ok, fail: v.length - ok, clean, passRate: pct(ok, v.length), cleanRate: pct(clean, v.length) };
  };
  const groupBy = (list, fn) => { const m = new Map(); for (const r of list) { const k = fn(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); } return m; };
  const base = recs.filter((r) => r.pass === 'base');
  const summary = {
    baseUrl: plan.baseUrl, date: plan.date, configs: plan.configs, skippedRoles: plan.skippedRoles, accounts: plan.accounts,
    routesPerRole: Object.fromEntries(Object.entries(plan.routes).map(([k, v]) => [k, v.length])),
    totals: {
      routes: Object.values(plan.routes).reduce((n, v) => n + v.length, 0),
      uniquePaths: new Set(Object.values(plan.routes).flat().map((r) => r.id || r.path)).size,
      records: recs.length,
      screenshots: recs.filter((r) => r.shot).length + recs.filter((r) => r.thumb && r.thumb !== r.shot).length,
      fullPageShots: recs.filter((r) => r.pass === 'base' && r.shot).length,
      errors: recs.filter((r) => r.status === 'error').length,
      redirected: base.filter((r) => r.redirected && !r.authLost).length,
    },
    byPass: Object.fromEntries([...groupBy(recs, (r) => r.pass)].map(([k, v]) => [k, rate(v)])),
    byRole: Object.fromEntries([...groupBy(base, (r) => r.role)].map(([k, v]) => [k, rate(v)])),
    byViewport: Object.fromEntries([...groupBy(base, (r) => r.cfg)].map(([k, v]) => [k, { ...rate(v), label: v[0].cfgLabel }])),
    byDensity: Object.fromEntries([...groupBy(recs.filter((r) => r.pass === 'density' || (r.pass === 'base' && ['v1440', 'v390'].includes(r.cfg))), (r) => `${r.width}×${r.height}@${r.dsf}`)].sort((x, y) => x[0].localeCompare(y[0], 'es', { numeric: true })).map(([k, v]) => [k, {
      ...rate(v), pixelated: v.filter((r) => r.issues.some((i) => i.cat === 'pixelated')).length,
      blur: v.filter((r) => r.issues.some((i) => i.cat === 'blur')).length,
      tabsBar: v.filter((r) => r.issues.some((i) => i.cat === 'tabsBar')).length,
    }])),
    byZoom: Object.fromEntries([...groupBy(recs.filter((r) => r.pass === 'zoom' || r.cfg === 'v1440'), (r) => `${Math.round((r.zoom || 1) * 100)}%`)].map(([k, v]) => [k, {
      ...rate(v), missing: v.filter((r) => (r.zoomMissing || []).some((m) => m.unreachable)).length, variant: v.filter((r) => (r.zoomMissing || []).some((m) => !m.unreachable)).length, overflow: v.filter((r) => r.issues.some((i) => i.cat === 'overflow')).length,
    }])),
  };
  // categorías: pantallas afectadas por pase
  const catCount = {};
  for (const r of valid) for (const i of r.issues) {
    catCount[i.cat] ??= { label: CATEGORIES[i.cat]?.label || i.cat, sev: i.sev, screens: 0, routes: new Set(), byPass: {} };
    catCount[i.cat].screens++; catCount[i.cat].routes.add(`${r.role}|${r.routeId}`);
    catCount[i.cat].byPass[r.pass] = (catCount[i.cat].byPass[r.pass] || 0) + 1;
  }
  summary.categories = Object.fromEntries(Object.entries(catCount).map(([k, v]) => [k, { ...v, routes: v.routes.size }]));

  // top problemas: (categoría, archivo fuente | imagen | selector)
  const groups = new Map();
  for (const r of valid) for (const i of r.issues) {
    if (NON_LAYOUT.has(i.cat)) continue;
    const seenSig = new Set();
    for (const s of (i.samples || []).slice(0, 4)) {
      let sig, file = null, src = null, mapped = [];
      if (i.cat === 'pixelated' || i.cat === 'pixelatedSoft') { src = normUrl(s.src); sig = `${i.cat}|${src}`; }
      else if (i.cat === 'fontFallback') sig = i.cat;
      // contenido tapado por la barra inferior: la causa es el padding inferior del
      // scroller (<main> del layout), no el elemento tapado
      else if (i.cat === 'navHidden' && /main/.test(r.checks?.primaryScroller || '')) { file = 'frontend/src/layouts/AuthLayout.tsx'; sig = `${i.cat}|${file}`; }
      else if (i.cat === 'zoomMissing' || i.cat === 'zoomVariant' || i.cat === 'sidebarClipped') { sig = `${i.cat}|${r.pageFile || r.path}`; file = r.pageFile; }
      else {
        mapped = mapSource(s, r.pageFile);
        const global = s.region && !['main', 'dialog'].includes(s.region);
        file = mapped[0]?.file || (global ? `(layout: ${s.region})` : r.pageFile);
        sig = `${i.cat}|${file || shortSel(s.sel)}`;
      }
      if (seenSig.has(sig)) continue;
      seenSig.add(sig);
      if (!groups.has(sig)) groups.set(sig, { cat: i.cat, label: CATEGORIES[i.cat]?.label || i.cat, sev: i.sev, file, src, alt: new Set(), screens: new Set(), routes: new Set(), cfgs: new Set(), roles: new Set(), examples: [] });
      const g = groups.get(sig);
      g.screens.add(`${r.role}|${r.routeId}|${r.cfg}`); g.routes.add(r.routeId); g.cfgs.add(r.cfg); g.roles.add(r.role);
      mapped.slice(1, 3).forEach((m) => g.alt.add(m.file));
      if (g.examples.length < 4) g.examples.push({ role: r.role, route: r.routeId, cfg: r.cfg, sel: s.sel, text: s.text, extra: s.natural ? `${s.natural} natural → ${s.required} requerido (${s.upscale}×)` : s.w ? `${s.w}×${s.h}px` : s.fontSize ? `${s.fontSize}px` : s.px ? `${s.px}px` : s.reasons ? s.reasons.join(', ') : '' });
    }
  }
  const sevW = { fail: 3, warn: 1 };
  const top = [...groups.values()].map((g) => ({
    ...g, alt: [...g.alt].filter((f) => f !== g.file), screens: g.screens.size, routes: [...g.routes], cfgs: [...g.cfgs], roles: [...g.roles],
    score: g.screens.size * sevW[g.sev] + g.routes.size * 5 * sevW[g.sev],
  })).sort((a, b) => b.score - a.score);
  summary.top = top.slice(0, 250);
  // Top 15 del PDF: las 10 fallas más extendidas + las 5 advertencias más extendidas
  // (si no, «texto < 12px» en el sidebar tapa todo lo que rompe de verdad).
  const fails = top.filter((g) => g.sev === 'fail'), warns = top.filter((g) => g.sev === 'warn');
  const nf = Math.min(fails.length, Math.max(10, 15 - warns.length));
  summary.top15 = [...fails.slice(0, nf), ...warns.slice(0, 15 - nf)];

  // zoom: qué desaparece por pantalla y nivel
  const zoomRows = [];
  for (const r of recs.filter((x) => x.pass === 'zoom' && (x.zoomMissing || []).length)) {
    zoomRows.push({ role: r.role, route: r.routeId, zoom: Math.round(r.zoom * 100), unreachable: r.zoomMissing.filter((m) => m.unreachable).map((m) => `${m.key} (${m.why})`), missing: r.zoomMissing.map((m) => `${m.key} (${m.why})`), pageFile: r.pageFile, thumb: r.thumb });
  }
  summary.zoom = zoomRows;
  // consola y red (agrupado)
  const net = new Map();
  for (const r of valid.filter((x) => x.pass === 'base')) {
    for (const f of r.failed) { const k = `${f.status} ${f.method} ${normUrl(f.url)}`; net.set(k, (net.get(k) || new Set()).add(`${r.role}|${r.routeId}`)); }
    for (const c of r.console) { const k = `console: ${c.replace(/https?:\/\/\S+/g, '…').slice(0, 140)}`; net.set(k, (net.get(k) || new Set()).add(`${r.role}|${r.routeId}`)); }
    for (const e of r.pageErrors) { const k = `pageerror: ${e.slice(0, 140)}`; net.set(k, (net.get(k) || new Set()).add(`${r.role}|${r.routeId}`)); }
  }
  summary.network = [...net].map(([k, v]) => ({ what: k, screens: v.size, where: [...v].slice(0, 6) })).sort((a, b) => b.screens - a.screens).slice(0, 40);
  summary.blockedWrites = [...new Set(recs.flatMap((r) => r.blockedWrites || []))];
  summary.errors = recs.filter((r) => r.status === 'error').slice(0, 40).map((r) => ({ role: r.role, route: r.routeId, cfg: r.cfg, error: r.error || `redirigida a ${r.finalUrl}` }));
  // pantallas por rol con peor puntaje (para el PDF)
  const worst = {};
  for (const [role, list] of groupBy(base, (r) => r.role)) {
    const byRoute = groupBy(list, (r) => r.routeId);
    worst[role] = [...byRoute].map(([route, rs]) => {
      const s = rs.reduce((n, r) => n + r.issues.reduce((m, i) => m + (i.sev === 'fail' ? 10 : NON_LAYOUT.has(i.cat) ? 0 : 1), 0), 0);
      const pick = (id) => rs.find((r) => r.cfg === id);
      return { route, title: rs[0].title, pageFile: rs[0].pageFile, score: s, fails: rs.filter((r) => r.status === 'fail').map((r) => r.cfg),
        issues: [...new Set(rs.flatMap((r) => r.issues.filter((i) => i.sev === 'fail' || !NON_LAYOUT.has(i.cat)).map((i) => `${CATEGORIES[i.cat]?.label || i.cat}`)))],
        details: rs.flatMap((r) => r.issues.filter((i) => i.sev === 'fail').map((i) => ({ cfg: r.cfg, cat: i.cat, sample: i.samples?.[0] }))).slice(0, 8),
        t390: (pick('v390') || pick('v360') || pick('v430'))?.thumb, t768: (pick('v768') || pick('v1024'))?.thumb, s390: pick('v390')?.shot, s768: pick('v768')?.shot };
    }).sort((a, b) => b.score - a.score);
  }
  summary.worst = worst;
  return { summary, recs };
}

function md(summary) {
  const L = [];
  const t = summary.totals;
  L.push(`# Auditoría responsive — ${summary.baseUrl}`, '', `Fecha: ${summary.date.slice(0, 16).replace('T', ' ')} UTC · rutas auditadas: ${t.routes} (${t.uniquePaths} únicas) · registros: ${t.records} · capturas: ${t.screenshots} (${t.fullPageShots} de página completa) · errores de carga: ${t.errors}`, '');
  L.push('Criterio: una pantalla **pasa** si no tiene hallazgos de severidad *falla* (las advertencias no la tumban). «Limpia» = sin hallazgos de ningún tipo.', '');
  L.push('## Por rol (pase base, 6 tamaños)', '', '| Rol | Pantallas | Pasan | % pasa | % limpia | Errores |', '|---|---|---|---|---|---|');
  for (const [k, v] of Object.entries(summary.byRole)) L.push(`| ${k} | ${v.valid} | ${v.pass} | ${v.passRate}% | ${v.cleanRate}% | ${v.errors} |`);
  L.push('', '## Por tamaño (pase base)', '', '| Tamaño | Pantallas | % pasa | % limpia |', '|---|---|---|---|');
  for (const [k, v] of Object.entries(summary.byViewport)) L.push(`| ${v.label} | ${v.valid} | ${v.passRate}% | ${v.cleanRate}% |`);
  L.push('', '## Densidad (escala Windows / retina)', '', '| Config | Pantallas | % pasa | con imagen pixelada | con texto borroso | scrollbar en pestañas/filtros |', '|---|---|---|---|---|---|');
  for (const [k, v] of Object.entries(summary.byDensity)) L.push(`| ${k} | ${v.valid} | ${v.passRate}% | ${v.pixelated} | ${v.blur} | ${v.tabsBar} |`);
  L.push('', '## Zoom del navegador (1440×900)', '', '| Zoom | Pantallas | % pasa | con controles inalcanzables | con controles ausentes (breakpoint) | con desborde |', '|---|---|---|---|---|---|');
  for (const [k, v] of Object.entries(summary.byZoom).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) L.push(`| ${k} | ${v.valid} | ${v.passRate}% | ${v.missing} | ${v.variant} | ${v.overflow} |`);
  L.push('', '## Categorías', '', '| Categoría | Sev. | Pantallas | Rutas |', '|---|---|---|---|');
  for (const [, v] of Object.entries(summary.categories).sort((a, b) => b[1].screens - a[1].screens)) L.push(`| ${v.label} | ${v.sev} | ${v.screens} | ${v.routes} |`);
  L.push('', '## Top 15 (10 fallas + 5 advertencias más extendidas)', '');
  (summary.top15 || []).forEach((g, i) => L.push(`${i + 1}. [${g.sev}] **${g.label}** — ${g.file ? '`' + g.file + '`' : g.src ? 'imagen `' + g.src + '`' : '(sin mapeo)'} · ${g.screens} pantallas, ${g.routes.length} rutas`));
  L.push('', '## Todos los problemas agrupados (por puntaje)', '');
  summary.top.slice(0, 30).forEach((g, i) => {
    L.push(`${i + 1}. **${g.label}** — ${g.file ? `\`${g.file}\`` : g.src ? `imagen \`${g.src}\`` : '(sin mapeo)'}${g.alt.length ? ` (o ${g.alt.map((a) => `\`${a}\``).join(', ')})` : ''} · ${g.screens} pantallas, ${g.routes.length} rutas, roles ${g.roles.join(', ')}`);
    for (const e of g.examples.slice(0, 2)) L.push(`   - ${e.role} ${e.route} @${e.cfg}: \`${shortSel(e.sel) || ''}\` ${e.text ? `«${e.text}»` : ''} ${e.extra || ''}`);
  });
  L.push('', '## Zoom: qué deja de verse', '');
  for (const z of summary.zoom.slice(0, 80)) L.push(`- ${z.role} ${z.route} @${z.zoom}%: ${z.missing.slice(0, 6).join('; ')}`);
  L.push('', '## Consola y red (pase base)', '', '| Qué | Pantallas |', '|---|---|');
  for (const n of summary.network) L.push(`| ${n.what.replace(/\|/g, '/')} | ${n.screens} |`);
  L.push('', '## Roles sin cuenta demo (saltados)', '');
  for (const s of summary.skippedRoles) L.push(`- **${s.role}** (${s.navRoutes} rutas en el menú): ${s.why}`);
  L.push('', `## Escrituras bloqueadas (modo solo lectura)`, '', summary.blockedWrites.map((b) => `- ${b}`).join('\n'));
  if (summary.errors.length) { L.push('', '## Errores de carga', ''); for (const e of summary.errors) L.push(`- ${e.role} ${e.route} @${e.cfg}: ${e.error}`); }
  return L.join('\n');
}

function html(summary, recs) {
  const st = (s) => ({ pass: '#1f9d55', warn: '#d69e2e', fail: '#e53e3e', error: '#718096' }[s] || '#999');
  const byRole = new Map();
  for (const r of recs) { if (!byRole.has(r.role)) byRole.set(r.role, new Map()); const m = byRole.get(r.role); if (!m.has(r.routeId)) m.set(r.routeId, []); m.get(r.routeId).push(r); }
  const cfgOrder = summary.configs.map((c) => c.id);
  const rows = (obj, cols) => Object.entries(obj).map(([k, v]) => `<tr><td>${esc(v.label || k)}</td>${cols.map((c) => `<td>${esc(typeof c === 'function' ? c(v) : v[c])}</td>`).join('')}</tr>`).join('');
  let h = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Auditoría responsive</title><style>
  :root{--bg:#fff;--fg:#1a202c;--mut:#718096;--line:#e2e8f0;--card:#f7fafc}
  @media (prefers-color-scheme:dark){:root{--bg:#111827;--fg:#e5e7eb;--mut:#9ca3af;--line:#374151;--card:#1f2937}}
  body{font:14px/1.45 Inter,system-ui,sans-serif;background:var(--bg);color:var(--fg);margin:0;padding:16px;max-width:1500px;margin:auto}
  table{border-collapse:collapse;margin:8px 0 20px}td,th{border:1px solid var(--line);padding:4px 8px;text-align:left;vertical-align:top}th{background:var(--card)}
  h1{font-size:22px}h2{margin-top:32px;border-bottom:2px solid #2a7a3f;padding-bottom:4px}h3{margin:20px 0 6px}
  .grid{display:flex;gap:8px;overflow-x:auto;padding-bottom:6px}.cell{flex:0 0 auto;width:150px;font-size:11px}
  .cell img{width:150px;height:200px;object-fit:cover;object-position:top;border:3px solid;border-radius:6px;display:block}
  .pill{display:inline-block;padding:0 6px;border-radius:9px;color:#fff;font-size:11px;margin:1px}
  details{margin:4px 0 14px;font-size:12px}code{font-size:11px;background:var(--card);padding:0 3px;border-radius:3px;word-break:break-all}
  .mut{color:var(--mut)}</style></head><body>`;
  const t = summary.totals;
  h += `<h1>Auditoría responsive · ${esc(summary.baseUrl)}</h1><p class="mut">${esc(summary.date)} · ${t.routes} rutas · ${t.records} registros · ${t.screenshots} capturas · ${t.errors} errores de carga. Pasa = sin hallazgos de severidad «falla».</p>`;
  h += `<h2>Por rol (base)</h2><table><tr><th>Rol</th><th>Pantallas</th><th>% pasa</th><th>% limpia</th><th>Errores</th></tr>${rows(summary.byRole, ['valid', (v) => v.passRate + '%', (v) => v.cleanRate + '%', 'errors'])}</table>`;
  h += `<h2>Por tamaño (base)</h2><table><tr><th>Tamaño</th><th>Pantallas</th><th>% pasa</th><th>% limpia</th></tr>${rows(summary.byViewport, ['valid', (v) => v.passRate + '%', (v) => v.cleanRate + '%'])}</table>`;
  h += `<h2>Densidad</h2><table><tr><th>Config</th><th>Pantallas</th><th>% pasa</th><th>Pixeladas</th><th>Borroso</th><th>Scrollbar pestañas</th></tr>${rows(summary.byDensity, ['valid', (v) => v.passRate + '%', 'pixelated', 'blur', 'tabsBar'])}</table>`;
  h += `<h2>Zoom</h2><table><tr><th>Zoom</th><th>Pantallas</th><th>% pasa</th><th>Controles inalcanzables</th><th>Ausentes (breakpoint)</th><th>Desborde</th></tr>${rows(Object.fromEntries(Object.entries(summary.byZoom).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))), ['valid', (v) => v.passRate + '%', 'missing', 'variant', 'overflow'])}</table>`;
  h += `<h2>Top problemas</h2><table><tr><th>#</th><th>Problema</th><th>Archivo probable</th><th>Pantallas</th><th>Rutas</th><th>Ejemplo</th></tr>` + summary.top.slice(0, 40).map((g, i) =>
    `<tr><td>${i + 1}</td><td><span class="pill" style="background:${st(g.sev)}">${g.sev}</span> ${esc(g.label)}</td><td><code>${esc(g.file || g.src || '—')}</code>${g.alt.length ? `<div class="mut">o ${g.alt.map((a) => `<code>${esc(a)}</code>`).join(' ')}</div>` : ''}</td><td>${g.screens}</td><td>${g.routes.length}<div class="mut">${esc(g.routes.slice(0, 5).join(', '))}</div></td><td>${g.examples.slice(0, 2).map((e) => `${esc(e.role)} ${esc(e.route)} @${esc(e.cfg)}<br><code>${esc(shortSel(e.sel))}</code> ${esc(e.text || '')} ${esc(e.extra || '')}`).join('<hr>')}</td></tr>`).join('') + `</table>`;
  h += `<h2>Zoom: qué deja de verse</h2><table><tr><th>Rol</th><th>Ruta</th><th>Zoom</th><th>Controles</th></tr>${summary.zoom.map((z) => `<tr><td>${esc(z.role)}</td><td>${esc(z.route)}</td><td>${z.zoom}%</td><td>${esc(z.missing.slice(0, 8).join(' · '))}</td></tr>`).join('')}</table>`;
  h += `<h2>Consola y red</h2><table><tr><th>Qué</th><th>Pantallas</th></tr>${summary.network.map((n) => `<tr><td><code>${esc(n.what)}</code></td><td>${n.screens}</td></tr>`).join('')}</table>`;
  h += `<h2>Roles sin cuenta demo</h2><ul>${summary.skippedRoles.map((s) => `<li><b>${esc(s.role)}</b> (${s.navRoutes} rutas): ${esc(s.why)}</li>`).join('')}</ul>`;
  h += `<h2>Detalle por rol → ruta → tamaño</h2>`;
  for (const [role, routes] of byRole) {
    h += `<h3 id="${esc(role)}">${esc(role)} <span class="mut">${esc(summary.accounts[role]?.who || '')}</span></h3>`;
    for (const [route, rs] of routes) {
      rs.sort((a, b) => cfgOrder.indexOf(a.cfg) - cfgOrder.indexOf(b.cfg));
      const baseRs = rs.filter((r) => r.pass === 'base');
      const other = rs.filter((r) => r.pass !== 'base');
      h += `<div><b>${esc(route)}</b> <span class="mut">${esc(rs[0].title || '')} · ${esc(rs[0].pageFile || '')}</span><div class="grid">` +
        baseRs.map((r) => `<div class="cell"><a href="${esc(r.shot || '')}" target="_blank"><img loading="lazy" src="${esc(r.thumb || '')}" style="border-color:${st(r.status)}" alt=""></a>${esc(r.cfg)} <span class="pill" style="background:${st(r.status)}">${r.status}</span></div>`).join('') +
        `</div><div>${other.map((r) => `<span class="pill" style="background:${st(r.status)}" title="${esc(r.issues.filter((i) => i.sev === 'fail').map((i) => i.cat).join(', '))}">${esc(r.cfg)}</span>`).join('')}</div>` +
        `<details><summary>hallazgos</summary>${rs.filter((r) => r.issues.length).map((r) => `<div><b>${esc(r.cfg)}</b>: ${r.issues.map((i) => `<span class="pill" style="background:${st(i.sev)}">${esc(CATEGORIES[i.cat]?.label || i.cat)} ×${i.n}</span>`).join(' ')}<ul>${r.issues.filter((i) => i.sev !== 'warn' || ['touch', 'pixelatedSoft', 'tabsBar'].includes(i.cat)).map((i) => `<li>${esc(CATEGORIES[i.cat]?.label || i.cat)}: ${(i.samples || []).slice(0, 3).map((s) => `<code>${esc(shortSel(s.sel) || '')}</code> ${esc(s.text || '')} ${esc(s.natural ? `${s.natural}→${s.required}` : s.w ? `${s.w}×${s.h}` : '')}`).join(' · ')}</li>`).join('')}</ul></div>`).join('')}</details></div>`;
    }
  }
  return h + '</body></html>';
}

export async function buildReport(outDir) {
  const { summary, recs } = analyze(outDir);
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 1));
  fs.writeFileSync(path.join(outDir, 'report.md'), md(summary));
  fs.writeFileSync(path.join(outDir, 'report.html'), html(summary, recs));
  console.log(`informe: ${path.join(outDir, 'report.html')}`);
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  let dir = process.argv[2];
  if (!dir) { const outs = fs.readdirSync(path.join(here, 'out')).sort(); dir = path.join(here, 'out', outs[outs.length - 1]); }
  await buildReport(path.resolve(dir));
}
