// scripts/qa-twin/sql-runner.mjs — `npm run qa:sql -- <archivo.sql | carpeta> [...]`
//
// Corre casos SQL (RLS, permisos, invariantes) contra el GEMELO LOCAL y reporta
// caso por caso. Solo localhost: aborta si el destino no es 127.0.0.1/localhost
// o si contiene el ref de produccion. No hay modo "viva".
//
// Convencion de un caso (un archivo = un caso):
//   begin;
//     set local role authenticated;
//     select set_config('request.jwt.claims', json_build_object('sub','<uuid>','role','authenticated')::text, true);
//     do $$ begin … raise exception 'FALLO: …' si algo no es lo esperado … end $$;
//   rollback;
// PASA si el archivo termina sin error. FALLA si cualquier sentencia da error.
// Los RAISE NOTICE se muestran como detalle. Los UUID de los actores estan en
// la vista qa_twin.actores (leerla ANTES de `set local role`).
//
// Variables: QA_TWIN_DB_URL (default postgresql://postgres:postgres@127.0.0.1:54322/postgres).

import { readFileSync, statSync, readdirSync } from 'node:fs';
import { resolve, relative, join } from 'node:path';
import { RAIZ, twinClient } from './lib.mjs';

const args = process.argv.slice(2).filter((a) => a !== '--');
if (!args.length) {
    console.error('Uso: npm run qa:sql -- <archivo.sql | carpeta> [...]');
    process.exit(2);
}

const archivos = [];
for (const a of args) {
    const p = resolve(process.cwd(), a);
    let st;
    try { st = statSync(p); } catch { console.error(`No existe: ${a}`); process.exit(2); }
    if (st.isDirectory()) {
        for (const f of readdirSync(p).filter((f) => f.endsWith('.sql')).sort()) archivos.push(join(p, f));
    } else archivos.push(p);
}

let fallos = 0;
const t0 = Date.now();
for (const f of archivos) {
    const nombre = relative(RAIZ, f).replaceAll('\\', '/');
    const c = await twinClient();
    const avisos = [];
    c.on('notice', (n) => avisos.push(n.message));
    const t = Date.now();
    try {
        await c.query(readFileSync(f, 'utf8'));
        console.log(`PASA  ${nombre}  (${Date.now() - t} ms)`);
        for (const a of avisos) console.log(`        · ${a}`);
    } catch (e) {
        fallos++;
        console.log(`FALLA ${nombre}  [${e.code ?? '?'}] ${e.message}`);
        for (const a of avisos) console.log(`        · ${a}`);
        if (e.where) console.log(`        en: ${e.where.split('\n')[0]}`);
        try { await c.query('rollback'); } catch { /* sin transaccion abierta */ }
    } finally {
        await c.end();
    }
}
console.log(`\n${archivos.length - fallos}/${archivos.length} casos pasan (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
process.exit(fallos ? 1 : 0);
