#!/usr/bin/env node
/**
 * Prueba de carga de la página pública de torneos en vivo (GET /api/v1/tournament-live/public/:slug/live).
 *
 * Simula N espectadores que refrescan cada `--interval` segundos durante `--minutes` minutos
 * (con If-None-Match, como el navegador) y reporta p50/p95/p99, errores, 304 y solicitudes/s.
 *
 * ⚠️ La base es UNA SOLA para dev, staging y producción. Úsalo SOLO con un torneo de prueba y
 *    FUERA de horario de operación de los clubes. El BFF cachea 5 s por torneo: lo esperado es
 *    ~1 consulta a la base cada 5 s sin importar los espectadores.
 *
 * Uso:
 *   node scripts/torneos-carga.mjs --url https://<bff>/api/v1/tournament-live/public/<slug>/live \
 *        --viewers 500 --interval 10 --minutes 30 [--ramp 30]
 *
 * Meta (plan §0.1): p95 ≤ 1 s a 500 espectadores, 0 errores 5xx, 429 = 0.
 */
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true']);
  return acc;
}, []));

const url = args.url;
if (!url) { console.error('Falta --url'); process.exit(1); }
const viewers = Number(args.viewers ?? 100);
const interval = Number(args.interval ?? 10) * 1000;
const minutes = Number(args.minutes ?? 1);
const ramp = Number(args.ramp ?? 10) * 1000;

const lat = [];
const stats = { ok: 0, notModified: 0, rateLimited: 0, serverErr: 0, otherErr: 0, netErr: 0 };
const endAt = Date.now() + minutes * 60_000;

async function viewer(i) {
  await new Promise((r) => setTimeout(r, (i / viewers) * ramp)); // arranque escalonado
  let etag = null;
  while (Date.now() < endAt) {
    const t0 = performance.now();
    try {
      const res = await fetch(url, { headers: etag ? { 'if-none-match': etag } : {} });
      lat.push(performance.now() - t0);
      if (res.status === 200) { stats.ok++; etag = res.headers.get('etag'); await res.arrayBuffer(); }
      else if (res.status === 304) stats.notModified++;
      else if (res.status === 429) stats.rateLimited++;
      else if (res.status >= 500) stats.serverErr++;
      else stats.otherErr++;
    } catch { stats.netErr++; }
    await new Promise((r) => setTimeout(r, interval * (0.9 + Math.random() * 0.2)));
  }
}

const pct = (arr, p) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor((p / 100) * arr.length))] : 0);

console.log(`Carga: ${viewers} espectadores · refresco ${interval / 1000}s · ${minutes} min → ${url}`);
const started = Date.now();
await Promise.all(Array.from({ length: viewers }, (_, i) => viewer(i)));
const secs = (Date.now() - started) / 1000;
lat.sort((a, b) => a - b);
const total = lat.length;
console.log(JSON.stringify({
  solicitudes: total, por_segundo: Number((total / secs).toFixed(1)),
  p50_ms: Math.round(pct(lat, 50)), p95_ms: Math.round(pct(lat, 95)), p99_ms: Math.round(pct(lat, 99)), max_ms: Math.round(lat[lat.length - 1] ?? 0),
  ...stats,
}, null, 2));
const bad = stats.serverErr + stats.netErr + stats.rateLimited;
console.log(bad === 0 && pct(lat, 95) <= 1000 ? '✅ Dentro de la meta' : '❌ Fuera de la meta (revisa p95, 5xx y 429)');
process.exit(bad === 0 ? 0 : 1);
