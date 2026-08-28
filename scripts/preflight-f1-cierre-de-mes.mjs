// ============================================================================
// Preflight del plan F1 — Cierre de Mes (docs/plan-f1-cierre-de-mes.md §6)
// READ-ONLY, vía REST con la service key de bff/.env.
//
// V1. ¿monthly_closes ya existe en la base viva? (el repo dice que no)
// V2. Volumen de 'rejected' con period_year poblado — decide si cuenta como
//     cartera pendiente o se excluye igual que 'cancelled' (§3.1 del plan).
// V3. Cuántos payments activos (no cancelled/rejected/failed) no tienen
//     period_year — hueco heredado del plan F0, cuantifica el riesgo de que
//     el snapshot de cierre subcuente facturación real.
// ============================================================================
import { conectar } from './lib/supabase-rest.mjs';

const { url, H, proyecto } = conectar();
console.log('='.repeat(78));
console.log('Proyecto :', proyecto);
console.log('Preflight: F1 Cierre de Mes (READ-ONLY)');
console.log('='.repeat(78));

// V1 — ¿existe monthly_closes?
{
  const r = await fetch(`${url}/rest/v1/monthly_closes?select=id&limit=1`, { headers: H });
  const t = await r.text();
  console.log('\n--- V1: ¿monthly_closes existe? ---');
  if (r.status === 404 || /does not exist|PGRST205/.test(t)) {
    console.log('NO existe (esperado — F1 sin construir).');
  } else if (r.ok) {
    console.log('⚠️  EXISTE en la base viva y el repo no lo sabía. Filas de ejemplo:', t.slice(0, 300));
  } else {
    console.log(`Respuesta inesperada (${r.status}):`, t.slice(0, 300));
  }
}

// V2 — 'rejected' con period_year poblado, agrupado por periodo
{
  const rows = await (async () => {
    const out = [];
    const PAGE = 1000;
    for (let off = 0; ; off += PAGE) {
      const u = `${url}/rest/v1/payments?select=period_year,period_month,amount&status=eq.rejected&period_year=not.is.null&limit=${PAGE}&offset=${off}`;
      const r = await fetch(u, { headers: H });
      const t = await r.text();
      if (!r.ok) { console.error('ERROR V2:', t.slice(0, 200)); process.exit(1); }
      const j = JSON.parse(t);
      out.push(...j);
      if (j.length < PAGE) break;
    }
    return out;
  })();
  console.log('\n--- V2: rejected con period_year poblado ---');
  console.log(`Total filas: ${rows.length} · Monto total: $${rows.reduce((s, r) => s + Number(r.amount || 0), 0).toLocaleString('es-CO')}`);
  const porPeriodo = new Map();
  for (const r of rows) {
    const k = `${r.period_year}-${String(r.period_month).padStart(2, '0')}`;
    const acc = porPeriodo.get(k) || { count: 0, monto: 0 };
    acc.count++; acc.monto += Number(r.amount || 0);
    porPeriodo.set(k, acc);
  }
  [...porPeriodo.entries()].sort().reverse().slice(0, 12).forEach(([k, v]) => {
    console.log(`  ${k}: ${v.count} cobro(s) · $${v.monto.toLocaleString('es-CO')}`);
  });
}

// V3 — activos sin period_year
{
  const estadosExcluidos = ['cancelled', 'rejected', 'failed'];
  const rows = await (async () => {
    const out = [];
    const PAGE = 1000;
    for (let off = 0; ; off += PAGE) {
      const u = `${url}/rest/v1/payments?select=id,status,amount,due_date&period_year=is.null&status=not.in.(${estadosExcluidos.join(',')})&limit=${PAGE}&offset=${off}`;
      const r = await fetch(u, { headers: H });
      const t = await r.text();
      if (!r.ok) { console.error('ERROR V3:', t.slice(0, 200)); process.exit(1); }
      const j = JSON.parse(t);
      out.push(...j);
      if (j.length < PAGE) break;
    }
    return out;
  })();
  console.log('\n--- V3: activos (no cancelled/rejected/failed) sin period_year ---');
  console.log(`Total: ${rows.length} · Monto: $${rows.reduce((s, r) => s + Number(r.amount || 0), 0).toLocaleString('es-CO')}`);
  const porEstado = new Map();
  for (const r of rows) porEstado.set(r.status, (porEstado.get(r.status) || 0) + 1);
  [...porEstado.entries()].forEach(([k, v]) => console.log(`  ${k}: ${v}`));
}

console.log('\n' + '='.repeat(78));
