// Débito automático F1 — prueba 1 del spec §14 con concurrencia REAL: tres conexiones
// llaman autopay_claim_due a la vez sobre el mismo cobro → un solo intento en la base.
// El runner SQL usa una conexión por archivo, por eso esta va aparte.
// Correr (gemelo local, `npm run qa:twin:up`):  node scripts/qa-twin/autopay-concurrencia.mjs
// Confirma el escenario de supabase/tests/autopay/_escenario.inc en el GEMELO y lo borra al final.
import { readFileSync } from 'node:fs';
import { twinClient } from './lib.mjs';
const fixture = readFileSync(new URL('../../supabase/tests/autopay/_escenario.inc', import.meta.url), 'utf8').replace(/^begin;/m, 'begin;') + "\nselect public.autopay_plan_cycles('2026-10-05');\nselect public.autopay_mark_noticed((select id from public.autopay_cycles where payment_id='00000000-0000-4000-f000-000000000003'), 154500, '2026-10-05');\ncommit;";
const setup = await twinClient();
await setup.query(fixture);
const claim = async (label) => {
  const c = await twinClient();
  await c.query('begin');
  const t0 = Date.now();
  const r = await c.query("select attempt_id from public.autopay_claim_due(50, 300, '2026-10-07')");
  await c.query('select pg_sleep(1)');   // sostiene el lock mientras la otra corre
  await c.query('commit'); await c.end();
  return { label, rows: r.rows.length, ms: Date.now() - t0 };
};
try {
  const out = await Promise.all([claim('A'), claim('B'), claim('C')]);
  const n = (await setup.query("select count(*)::int n from public.recurring_charge_attempts where payment_id='00000000-0000-4000-f000-000000000003'")).rows[0].n;
  console.log(JSON.stringify(out), 'intentos en la base:', n, n === 1 ? 'OK' : 'FALLO');
} finally {
  await setup.query(`
    delete from public.recurring_charge_attempts where payment_id='00000000-0000-4000-f000-000000000003';
    delete from public.autopay_cycles where payment_id='00000000-0000-4000-f000-000000000003';
    delete from public.recurring_subscriptions where school_id='00000000-0000-4000-b000-000000000001';
    delete from public.payment_consents where id='00000000-0000-4000-e000-0000000000c1';
    delete from public.payment_tokens where provider_payment_source_id=9001;
    delete from public.enrollments where id='00000000-0000-4000-e000-0000000000e1';
    delete from public.teams where id='00000000-0000-4000-e000-0000000000a1';
    update public.school_settings set autopay_enabled=false where school_id='00000000-0000-4000-b000-000000000001';
    update public.payments set due_date='2026-10-05', created_at='2026-10-04T01:00:41.616195+00:00' where id='00000000-0000-4000-f000-000000000003';`);
  const left = (await setup.query("select (select count(*) from public.recurring_subscriptions)+(select count(*) from public.autopay_cycles)+(select count(*) from public.recurring_charge_attempts) n")).rows[0].n;
  console.log('limpieza: filas autopay que quedan =', left);
  await setup.end();
}
