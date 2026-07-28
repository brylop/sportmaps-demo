#!/usr/bin/env node
/**
 * check-migration-timestamps — evita colisiones de timestamp en migraciones.
 *
 * Dos sesiones/agentes trabajando en paralelo pueden crear migraciones con el
 * MISMO prefijo (YYYYMMDDHHMMSS). Con aplicación manual no rompe, pero ensucia
 * el orden y rompe `supabase db push` (versión = prefijo). Este chequeo falla
 * si hay dos archivos con el mismo prefijo.
 *
 * Corre en pre-commit (.husky) y en CI (ci.yml). Uso: node scripts/check-migration-timestamps.mjs
 *
 * REGLA: cada migración usa un timestamp ÚNICO. Para trabajo en paralelo, usa
 * la hora real con segundos (YYYYMMDDHHMMSS), no un contador ...0001/0002.
 */

import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');

// Baseline: colisiones YA existentes al agregar este chequeo (2026-07-11).
// Son migraciones inmutables + aplicación manual → no se renombran. Solo se
// previenen las NUEVAS. NO agregar timestamps a esta lista para "silenciar"
// una colisión nueva: la solución es renombrar tu migración a un prefijo único.
const GRANDFATHERED = new Set([
    '20260511000004', '20260511000005', '20260511000006',
    '20260519000001', '20260624000001', '20260707000001',
    '20260710000001', '20260710000002', '20260716000001',
    '20260723000001',
]);

let files;
try {
    files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
} catch (err) {
    console.error(`No pude leer ${migrationsDir}: ${err.message}`);
    process.exit(1);
}

const byVersion = new Map();
for (const f of files) {
    const m = f.match(/^(\d{14})_/);
    if (!m) continue; // nombre no estándar → se ignora
    const v = m[1];
    if (!byVersion.has(v)) byVersion.set(v, []);
    byVersion.get(v).push(f);
}

const known = [];
const fresh = [];
for (const [v, list] of byVersion) {
    if (list.length > 1) (GRANDFATHERED.has(v) ? known : fresh).push([v, list]);
}

if (known.length) {
    console.warn(`⚠️  ${known.length} colisiones de timestamp históricas (aceptadas, inmutables).`);
}

if (fresh.length) {
    console.error('\n❌ Colisión de timestamp en migraciones (dos archivos con el mismo prefijo):');
    for (const [v, list] of fresh) console.error(`   ${v}: ${list.join(', ')}`);
    console.error('\n   Arréglalo: renombra tu migración a un timestamp ÚNICO');
    console.error('   (YYYYMMDDHHMMSS con la hora real, no un contador ...0001/0002).\n');
    process.exit(1);
}

console.log(`✅ Migraciones: ${files.length} archivos, sin colisiones de timestamp nuevas.`);
