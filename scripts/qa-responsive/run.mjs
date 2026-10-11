// Auditoría responsive automatizada de SportMaps — TODAS las pantallas del menú
// de cada rol, en cada tamaño, densidad (escala de Windows / retina) y zoom.
//
//   node scripts/qa-responsive/run.mjs                       # todo, contra https://dev.sportmaps.co
//   node scripts/qa-responsive/run.mjs --base-url http://localhost:5173
//   node scripts/qa-responsive/run.mjs --roles parent,coach --viewports 360,390
//   node scripts/qa-responsive/run.mjs --passes base          # solo layout (sin densidad ni zoom)
//   node scripts/qa-responsive/run.mjs --routes "/students|/finances" --concurrency 4
//   node scripts/qa-responsive/run.mjs --out scripts/qa-responsive/out/despues-tokens
//   node scripts/qa-responsive/report.mjs <outDir>            # (lo corre run.mjs al final)
//   node scripts/qa-responsive/pdf.mjs <outDir> [destino.pdf]
//
// Pases: base (6 tamaños a 1x) · density (1440/1366/390 × escala 1/1.25/1.5/2)
//        · zoom (1440×900 a 80…200 %). Reanudable: cada "carril" (rol × config)
//        se guarda en results/ y se salta si ya existe (--fresh para rehacer).
//
// SOLO LECTURA: navega y captura con cuentas de Club Campestre Demo. Toda
// escritura (PATCH/PUT/DELETE, POST a tablas, RPC con nombre de mutación, POST
// al BFF) se intercepta y se responde 204 SIN llegar al servidor; queda
// registrada en blockedWrites. Las lecturas se cachean por rol para no repetir
// miles de consultas contra la Supabase compartida en los pases de densidad/zoom.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { extractRoutes, REPO } from './extract-routes.mjs';
import { ACCOUNTS, PASSWORD, EXTRA_ROUTES, VIEWPORTS, DENSITY, ZOOM, MOBILE_MAX, ROLES_WITHOUT_ACCOUNT } from './config.mjs';
import { inPageChecks } from './checks.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(REPO, 'frontend', 'package.json'));
const { chromium } = require('playwright');

// ── CLI ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1];
  return process.env[`QA_${name.toUpperCase().replace(/-/g, '_')}`] ?? def;
};
const flag = (name) => argv.includes(`--${name}`);
const BASE_URL = (arg('base-url', process.env.BASE_URL || 'https://dev.sportmaps.co')).replace(/\/$/, '');
const ROLES = arg('roles', Object.keys(ACCOUNTS).join(',')).split(',').map((s) => s.trim()).filter(Boolean);
const VP_FILTER = arg('viewports', '') ? arg('viewports').split(',') : null;
const PASSES = arg('passes', 'base,density,zoom').split(',');
const CONCURRENCY = Number(arg('concurrency', 3));
const ROUTE_RE = arg('routes', '') ? new RegExp(arg('routes')) : null;
const LIMIT = Number(arg('limit', 0));
const today = new Date().toLocaleDateString('sv-SE'); // fecha local YYYY-MM-DD
const OUT = path.resolve(arg('out', path.join(here, 'out', `baseline-${today}`)));
const SETTLE_MS = Number(arg('settle', 900));

// ── Supabase (para login programático) ──────────────────────────────────────
function readEnv() {
  const env = {};
  for (const f of ['.env', '.env.local']) {
    const fp = path.join(REPO, 'frontend', f);
    if (!fs.existsSync(fp)) continue;
    for (const line of fs.readFileSync(fp, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"#]*)"?\s*$/);
      if (m) env[m[1]] = m[2].trim();
    }
  }
  return env;
}
const ENV = readEnv();
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || ENV.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || ENV.VITE_SUPABASE_PUBLISHABLE_KEY || ENV.VITE_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY en frontend/.env');
const SB_REF = new URL(SUPABASE_URL).host.split('.')[0];

async function login(email) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    if (res.ok) return res.json();
    if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 15000 * attempt)); continue; }
    throw new Error(`Login ${email}: ${res.status} ${await res.text()}`);
  }
  throw new Error(`Login ${email}: rate limit persistente`);
}

// ── Configs (tamaño × densidad × zoom) ──────────────────────────────────────
function buildConfigs() {
  const cfgs = [];
  if (PASSES.includes('base')) for (const v of VIEWPORTS) {
    cfgs.push({ pass: 'base', id: `v${v.id}`, width: v.width, height: v.height, dsf: 1, label: `${v.width}×${v.height} · ${v.label}`, vpId: v.id });
  }
  if (PASSES.includes('density')) for (const s of DENSITY.sizes) for (const sc of DENSITY.scales) {
    // 1440@1 y 390@1 ya los cubre el pase base: no se duplican.
    if (sc === 1 && VIEWPORTS.some((v) => v.width === s.width && v.height === s.height) && PASSES.includes('base')) continue;
    cfgs.push({ pass: 'density', id: `d${s.id}@${sc}`, width: s.width, height: s.height, dsf: sc, label: `${s.width}×${s.height} @${sc * 100}%`, vpId: s.id });
  }
  if (PASSES.includes('zoom')) for (const z of ZOOM.levels) {
    if (z === 1 && PASSES.includes('base')) continue; // = v1440
    const w = Math.round(ZOOM.base.width / z), h = Math.round(ZOOM.base.height / z);
    cfgs.push({ pass: 'zoom', id: `z${Math.round(z * 100)}`, width: w, height: h, dsf: z, zoom: z, label: `zoom ${Math.round(z * 100)}% (${w}×${h} CSS)`, vpId: String(ZOOM.base.width) });
  }
  return VP_FILTER ? cfgs.filter((c) => VP_FILTER.includes(c.vpId) || VP_FILTER.includes(c.id)) : cfgs;
}

// ── Escrituras bloqueadas + caché de lecturas ───────────────────────────────
const MUTATING_RPC = /^(create|insert|update|delete|remove|upsert|set|open|close|mark|register|apply|approve|reject|cancel|generate|emit|send|record|log|track|save|assign|enroll|invite|accept|claim|issue|void|anular|crear|registrar|aprobar|marcar|cerrar|abrir|emitir|enviar|guardar|asignar|toggle|bump|increment|consume|redeem|reserve|book|pay|refund|sync|import|upload|admin_set|grant|revoke|reset|purge|archive|restore|seed|touch|ack|dismiss|read_all|mark_)/i;
const BFF_READ_POST = /(by-ids|search|query|lookup|preview|resolve|batch-get|bulk-get|\/stats|summary|\/list$|\/check|\/validate-|\/quote|\/calculate|\/estimate)/i; // nunca /chat (gasta cuota LLM)
const isBackend = (u) => u.host.endsWith('.supabase.co') || /bff|onrender\.com/.test(u.host);
function writeDecision(req) {
  const u = new URL(req.url());
  const m = req.method();
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return null;
  if (u.pathname.startsWith('/auth/v1/token')) return null;               // refresco de sesión
  if (u.pathname.startsWith('/auth/v1/logout')) return 'logout';
  if (u.host.endsWith('.supabase.co')) {
    if (m !== 'POST') return `${m} ${u.pathname}`;
    const rpc = u.pathname.match(/\/rest\/v1\/rpc\/([^/?]+)/);
    if (rpc) return MUTATING_RPC.test(rpc[1]) ? `RPC ${rpc[1]}` : null;
    if (u.pathname.startsWith('/storage/v1/object/list/') || u.pathname.startsWith('/storage/v1/object/sign/')) return null; // listar / URL firmada = lectura
    if (u.pathname.startsWith('/rest/v1/') || u.pathname.startsWith('/storage/v1/object')) return `POST ${u.pathname}`;
    if (u.pathname.startsWith('/functions/v1/')) return `POST ${u.pathname}`;
    return null;
  }
  // POST de LECTURA conocidos del BFF (consultas por lote / búsqueda)
  if (isBackend(u) && m === 'POST' && BFF_READ_POST.test(u.pathname)) return null;
  if (isBackend(u)) return `${m} ${u.pathname}`;
  if (m === 'POST' && /vitals|insights|analytics|collect|sentry|posthog/.test(u.host + u.pathname)) return `telemetry ${u.host}`;
  return null;
}

const caches = new Map(); // role → Map(key → {status, headers, body})
async function setupRouting(context, role, sink) {
  if (!caches.has(role)) caches.set(role, new Map());
  const cache = caches.get(role);
  await context.route('**/*', async (route) => {
    const req = route.request();
    let u;
    try { u = new URL(req.url()); } catch { return route.continue(); }
    const block = writeDecision(req);
    if (block) {
      sink.blockedWrites.push(block);
      return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' }, body: '' });
    }
    const cacheable = isBackend(u) && !u.pathname.startsWith('/auth/') && !u.pathname.startsWith('/realtime/')
      && (req.method() === 'GET' || (req.method() === 'POST' && u.pathname.includes('/rpc/')));
    if (!cacheable) return route.continue();
    const key = `${req.method()} ${req.url()} ${req.method() === 'POST' ? req.postData() || '' : ''}`;
    const hit = cache.get(key);
    if (hit) return route.fulfill(hit);
    // reintento: un "Failed to fetch" en la app la manda a /login y falsea la pantalla
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const resp = await route.fetch({ timeout: 25000 });
        const body = await resp.body();
        const entry = { status: resp.status(), headers: resp.headers(), body };
        if (resp.status() >= 500 && attempt < 3) { await new Promise((r) => setTimeout(r, 800 * attempt)); continue; }
        if (resp.status() < 500 && body.length < 3_000_000) cache.set(key, entry);
        return route.fulfill(entry).catch(() => {});
      } catch {
        if (attempt === 3) return route.continue().catch(() => {});
        await new Promise((r) => setTimeout(r, 800 * attempt));
      }
    }
  });
}

// ── utilidades ──────────────────────────────────────────────────────────────
const slug = (s) => s.replace(/^\//, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 80) || 'root';
const ensure = (p) => { fs.mkdirSync(p, { recursive: true }); return p; };

async function auditRoute(page, ctxInfo, route, cfg, role, retry = 0) {
  const sink = ctxInfo.sink;
  sink.console = []; sink.failed = []; sink.pageErrors = []; sink.blockedWrites = [];
  const t0 = Date.now();
  const rec = { role, cfg: cfg.id, pass: cfg.pass, path: route.path, routeId: route.id || route.path, title: route.title, group: route.group };
  try {
    await page.goto(BASE_URL + route.path, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: Number(arg('idle', 8000)) }).catch(() => {});
    // esperar a que se vaya el spinner global si existe
    await page.waitForFunction(() => !document.querySelector('.animate-spin') || document.querySelector('main h1, main h2'), null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(SETTLE_MS);
    // steps: una o varias secuencias alternativas (la primera que funcione)
    const seqs = route.stepsAlt || (route.steps ? [route.steps] : []);
    let stepErr = null;
    for (const seq of seqs) {
      try {
        for (const st of seq) {
          const loc = st.click.startsWith('role=')
            ? page.getByRole(st.click.match(/role=(\w+)/)[1], { name: st.click.match(/name="([^"]+)"/)[1], exact: true })
            : page.locator(st.click);
          await loc.first().click({ timeout: 5000 });
          await page.waitForTimeout(700);
        }
        stepErr = null; break;
      } catch (e) { stepErr = e; await page.keyboard.press('Escape').catch(() => {}); }
    }
    if (stepErr) rec.stepError = String(stepErr.message || stepErr).split('\n')[0].slice(0, 200);
    rec.finalUrl = new URL(page.url()).pathname;
    rec.redirected = rec.finalUrl !== route.path.split('?')[0];
    rec.authLost = /\/login|\/auth/.test(rec.finalUrl);
    // un tropiezo de red manda a /login aunque la sesión siga viva: reintentar una vez
    if (rec.authLost && retry === 0) { await page.waitForTimeout(2500); return auditRoute(page, ctxInfo, route, cfg, role, 1); }
    rec.retried = retry > 0;
    rec.checks = await page.evaluate(inPageChecks, { mobileMax: MOBILE_MAX });
    // capturas
    const dir = ensure(path.join(OUT, 'shots', role, slug(rec.routeId)));
    const base = path.join(dir, cfg.id.replace(/[@.]/g, '_'));
    if (cfg.pass === 'base') {
      await page.screenshot({ path: `${base}.jpg`, fullPage: true, type: 'jpeg', quality: 55, scale: 'css', timeout: 30000 }).catch(() => {});
      await page.screenshot({ path: `${base}.thumb.jpg`, type: 'jpeg', quality: 50, scale: 'css' });
      rec.shot = path.relative(OUT, `${base}.jpg`).replace(/\\/g, '/');
      rec.thumb = path.relative(OUT, `${base}.thumb.jpg`).replace(/\\/g, '/');
    } else if (cfg.pass === 'density' && cfg.dsf !== 1 && cfg.dsf !== 2 && cfg.width >= 1366) {
      // escala de Windows: captura a resolución de dispositivo para ver el borroso real
      await page.screenshot({ path: `${base}.jpg`, type: 'jpeg', quality: 80, scale: 'device' });
      rec.shot = rec.thumb = path.relative(OUT, `${base}.jpg`).replace(/\\/g, '/');
    } else if (cfg.pass === 'zoom') {
      await page.screenshot({ path: `${base}.thumb.jpg`, type: 'jpeg', quality: 50, scale: 'css' });
      rec.thumb = path.relative(OUT, `${base}.thumb.jpg`).replace(/\\/g, '/');
    }
  } catch (e) {
    rec.error = String(e.message || e).split('\n')[0].slice(0, 300);
  }
  rec.console = sink.console.slice(0, 15);
  rec.consoleCount = sink.console.length;
  rec.failed = sink.failed.slice(0, 20);
  rec.failedCount = sink.failed.length;
  rec.pageErrors = sink.pageErrors.slice(0, 8);
  rec.blockedWrites = [...new Set(sink.blockedWrites)].slice(0, 10);
  rec.ms = Date.now() - t0;
  return rec;
}

async function runLane(browser, lane) {
  const { role, cfg, routes } = lane;
  const file = path.join(OUT, 'results', `${role}__${cfg.id.replace(/[@.]/g, '_')}.json`);
  if (fs.existsSync(file) && !flag('fresh')) { lane.skipped = true; return; }
  const session = await login(ACCOUNTS[role].email);
  const context = await browser.newContext({
    viewport: { width: cfg.width, height: cfg.height }, deviceScaleFactor: cfg.dsf,
    isMobile: false, hasTouch: cfg.width < 768, locale: 'es-CO', timezoneId: 'America/Bogota',
    serviceWorkers: 'block', // el SW cachea builds viejos (ver memoria PWA)
  });
  await context.addInitScript(([key, value]) => {
    try {
      window.localStorage.setItem(key, value);
      // no mostrar banners de instalación/cookies/tours que tapan el layout
      window.localStorage.setItem('pwa-install-dismissed', String(Date.now()));
    } catch {}
  }, [`sb-${SB_REF}-auth-token`, JSON.stringify(session)]);
  const sink = { console: [], failed: [], pageErrors: [], blockedWrites: [] };
  await setupRouting(context, role, sink);
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !/Error registrando SW/.test(m.text())) sink.console.push(m.text().slice(0, 240)); });
  page.on('pageerror', (e) => sink.pageErrors.push(String(e.message).slice(0, 240)));
  page.on('response', (r) => {
    if (r.status() >= 400) {
      const u = r.url();
      if (/\/auth\/v1\/user/.test(u) && r.status() === 401) return;
      sink.failed.push({ status: r.status(), method: r.request().method(), url: u.replace(/apikey=[^&]+/, 'apikey=…').slice(0, 220) });
    }
  });
  page.on('requestfailed', (r) => {
    const f = r.failure()?.errorText || '';
    if (/ERR_ABORTED|NS_BINDING_ABORTED/.test(f)) return;
    sink.failed.push({ status: 0, method: r.method(), url: r.url().slice(0, 220), error: f });
  });
  const ctxInfo = { sink };
  const results = [];
  for (const route of routes) {
    const rec = await auditRoute(page, ctxInfo, route, cfg, role);
    rec.cfgLabel = cfg.label; rec.width = cfg.width; rec.height = cfg.height; rec.dsf = cfg.dsf; rec.zoom = cfg.zoom || 1;
    results.push(rec);
    process.stdout.write(rec.error ? 'x' : '.');
  }
  await context.close();
  ensure(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify({ role, cfg, results }, null, 0));
}

async function main() {
  const allRoles = [...new Set([...ROLES, ...Object.keys(ROLES_WITHOUT_ACCOUNT)])];
  const nav = await extractRoutes(allRoles.filter((r) => r !== 'facility_manager'));
  const skippedRoles = Object.entries(ROLES_WITHOUT_ACCOUNT)
    .map(([role, why]) => ({ role, why, navRoutes: (nav[role] || []).length }));
  const plan = {};
  for (const role of ROLES) {
    if (!ACCOUNTS[role]) { console.warn(`[skip] ${role}: sin cuenta demo`); continue; }
    const seen = new Set();
    let routes = [...(nav[role] || []), ...(EXTRA_ROUTES[role] || []).map((r) => ({ ...r, group: 'Detalle' }))]
      .filter((r) => { const k = r.id || r.path; return !seen.has(k) && seen.add(k); });
    if (ROUTE_RE) routes = routes.filter((r) => ROUTE_RE.test(r.path) || ROUTE_RE.test(r.id || ''));
    if (LIMIT) routes = routes.slice(0, LIMIT);
    plan[role] = routes;
  }
  const configs = buildConfigs();
  ensure(OUT);
  fs.writeFileSync(path.join(OUT, 'plan.json'), JSON.stringify({
    baseUrl: BASE_URL, date: new Date().toISOString(), passes: PASSES, configs, accounts: ACCOUNTS,
    skippedRoles, routes: plan,
  }, null, 1));
  const lanes = [];
  // orden: base primero (llena la caché de lecturas), luego densidad y zoom
  for (const cfg of configs) for (const role of Object.keys(plan)) lanes.push({ role, cfg, routes: plan[role] });
  const totalPages = lanes.reduce((n, l) => n + l.routes.length, 0);
  console.log(`BASE_URL=${BASE_URL}\nroles=${Object.keys(plan).join(',')} configs=${configs.length} carriles=${lanes.length} páginas=${totalPages}\nsalida: ${OUT}`);
  // Dos navegadores: ≥768 con scrollbars clásicas reales (Windows/escritorio);
  // <768 con scrollbars superpuestas como un teléfono (no roban ancho).
  const desktop = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] });
  const phone = await chromium.launch();
  const browserFor = (cfg) => (cfg.width < 768 ? phone : desktop);
  let next = 0, done = 0;
  const t0 = Date.now();
  async function worker() {
    while (next < lanes.length) {
      const lane = lanes[next++];
      try { await runLane(browserFor(lane.cfg), lane); } catch (e) { console.error(`\n[carril ${lane.role}/${lane.cfg.id}] ${e.message}`); }
      done++;
      if (!lane.skipped) console.log(`\n[${done}/${lanes.length}] ${lane.role} ${lane.cfg.id} · ${Math.round((Date.now() - t0) / 60000)} min`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await desktop.close(); await phone.close();
  if (!flag('no-report')) {
    const { buildReport } = await import('./report.mjs');
    await buildReport(OUT);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
