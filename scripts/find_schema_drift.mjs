#!/usr/bin/env node
/**
 * find_schema_drift.mjs
 *
 * Genera un SQL que lista los objetos que EXISTEN en la base y que NINGUNA
 * migración del repo crea.
 *
 * Por qué así y no un volcado completo: `public` tiene cientos de tablas y
 * funciones, y pegar todo eso de vuelta es inmanejable. En vez de traer la base
 * entera y filtrar acá, este script extrae del repo lo que las migraciones SÍ
 * crean, lo embebe en la consulta, y la base devuelve únicamente la diferencia.
 * Salida chica y precisa.
 *
 * Motivo: la deriva viene apareciendo de a una, cada vez que se toca algo —
 * 5 tablas, is_parent_of_child, school_staff.coach_auth_id, tres columnas de
 * attendance_records, upsert_attendance_record. Esto la mide de una vez.
 *
 * Uso:
 *   node scripts/find_schema_drift.mjs           # escribe scripts/_drift_check.sql
 *   node scripts/find_schema_drift.mjs --stats   # además resume lo extraído
 *
 * Después: pegar scripts/_drift_check.sql en el SQL Editor de Supabase.
 *
 * Limitación honesta: el parseo es por regex sobre SQL, no un parser real. Puede
 * pasar por alto objetos creados dentro de EXECUTE con cadenas armadas
 * dinámicamente. Por eso el resultado es un PUNTO DE PARTIDA a revisar, no un
 * veredicto — un falso positivo se descarta mirando la migración que lo crea.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raizRepo = join(dirname(fileURLToPath(import.meta.url)), '..');
const dirMigraciones = join(raizRepo, 'supabase', 'migrations');
const salida = join(raizRepo, 'scripts', '_drift_check.sql');

const archivos = readdirSync(dirMigraciones)
    .filter((f) => f.endsWith('.sql'))
    .sort();

const tablas = new Set();
const funciones = new Set();
/** @type {Map<string, Set<string>>} tabla -> columnas */
const columnas = new Map();

const agregarColumna = (tabla, columna) => {
    if (!columnas.has(tabla)) columnas.set(tabla, new Set());
    columnas.get(tabla).add(columna.toLowerCase());
};

/**
 * Extrae los nombres de columna del cuerpo de un CREATE TABLE.
 * Se queda con el primer identificador de cada línea de nivel superior y
 * descarta las que arrancan con palabra clave de constraint.
 */
function columnasDelCuerpo(cuerpo) {
    const encontradas = [];
    let profundidad = 0;
    let linea = '';

    for (const ch of cuerpo) {
        if (ch === '(') profundidad++;
        if (ch === ')') profundidad--;
        if (ch === ',' && profundidad === 0) {
            encontradas.push(linea);
            linea = '';
        } else {
            linea += ch;
        }
    }
    encontradas.push(linea);

    const palabrasClave = /^(constraint|primary|unique|foreign|check|exclude|like|inherits)\b/i;
    return encontradas
        .map((l) => l.trim().replace(/^--.*$/gm, '').trim())
        .filter((l) => l && !palabrasClave.test(l))
        .map((l) => l.match(/^"?([a-z_][a-z0-9_]*)"?/i)?.[1])
        .filter(Boolean);
}

for (const archivo of archivos) {
    // Quitar comentarios de línea: dentro de ellos hay DDL de ejemplo que
    // ensuciaría el inventario (M0 y M3 citan columnas en sus notas).
    const sql = readFileSync(join(dirMigraciones, archivo), 'utf8')
        .replace(/^\s*--.*$/gm, '');

    for (const m of sql.matchAll(
        /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?\s*\(/gi,
    )) {
        const tabla = m[1].toLowerCase();
        tablas.add(tabla);

        // Recortar el cuerpo balanceando paréntesis desde el que abre.
        let i = m.index + m[0].length;
        let profundidad = 1;
        const inicio = i;
        while (i < sql.length && profundidad > 0) {
            if (sql[i] === '(') profundidad++;
            else if (sql[i] === ')') profundidad--;
            i++;
        }
        for (const col of columnasDelCuerpo(sql.slice(inicio, i - 1))) {
            agregarColumna(tabla, col);
        }
    }

    for (const m of sql.matchAll(
        /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi,
    )) {
        funciones.add(m[1].toLowerCase());
    }

    // ALTER TABLE x ADD COLUMN [IF NOT EXISTS] y  — incluye los ADD COLUMN
    // encadenados de una misma sentencia.
    for (const m of sql.matchAll(
        /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?([\s\S]*?);/gi,
    )) {
        const tabla = m[1].toLowerCase();
        for (const c of m[2].matchAll(
            /ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([a-z_][a-z0-9_]*)"?/gi,
        )) {
            agregarColumna(tabla, c[1]);
        }
    }
}

const comillas = (s) => `'${s.replace(/'/g, "''")}'`;
const listaValores = (conjunto) =>
    conjunto.size === 0
        ? '(SELECT NULL::text WHERE false)'
        : `VALUES ${[...conjunto].sort().map((v) => `(${comillas(v)})`).join(', ')}`;

// Una fila por tabla con un array de columnas, no un par por columna: son ~2600
// columnas y el SQL pasaba de 2600 líneas, incómodo de pegar en el editor.
// Agrupado son ~190 filas.
const filasColumna = [...columnas.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tabla, cols]) => {
        const arr = [...cols].sort().map(comillas).join(',');
        return `(${comillas(tabla)}, ARRAY[${arr}]::text[])`;
    });
const totalColumnas = [...columnas.values()].reduce((n, s) => n + s.size, 0);

const sqlSalida = `-- =============================================================================
-- _drift_check.sql — GENERADO por scripts/find_schema_drift.mjs. No editar a mano.
--
-- Devuelve los objetos que existen en la base y que ninguna migración del repo
-- crea. Salida vacía = no hay deriva detectable.
--
-- Inventario extraído del repo: ${tablas.size} tablas, ${funciones.size} funciones,
-- ${totalColumnas} columnas, sobre ${archivos.length} migraciones.
--
-- Un solo SELECT (gotchas del editor de Supabase: sin CREATE TEMP TABLE, sin
-- RAISE NOTICE). Solo lee catálogo: no toma locks ni modifica nada.
-- =============================================================================

WITH repo_tablas(nombre) AS (${listaValores(tablas)}),
     repo_funciones(nombre) AS (${listaValores(funciones)}),
     repo_columnas(tabla, cols) AS (${
         filasColumna.length === 0
             ? '(SELECT NULL::text, NULL::text[] WHERE false)'
             : `VALUES ${filasColumna.join(',\n            ')}`
     })

-- ── Tablas que la base tiene y el repo no crea ───────────────────────────────
SELECT 'tabla'::text            AS tipo,
       c.relname::text          AS objeto,
       ''::text                 AS detalle,
       c.reltuples::bigint      AS filas_aprox
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname NOT IN (SELECT nombre FROM repo_tablas)

UNION ALL

-- ── Funciones que la base tiene y el repo no crea ────────────────────────────
-- Se excluyen las de extensiones (uuid-ossp, pgcrypto, postgis…): no son deriva,
-- las instala CREATE EXTENSION.
SELECT 'funcion',
       p.proname::text,
       pg_get_function_identity_arguments(p.oid),
       NULL
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname NOT IN (SELECT nombre FROM repo_funciones)
  AND NOT EXISTS (
      SELECT 1 FROM pg_depend d
      WHERE d.objid = p.oid AND d.deptype = 'e'
  )

UNION ALL

-- ── Columnas sin versionar, en tablas que el repo SÍ crea ────────────────────
-- El caso de school_staff.coach_auth_id y de attendance_records.user_id: la
-- tabla está versionada y la columna no.
SELECT 'columna',
       c.relname::text || '.' || a.attname::text,
       format_type(a.atttypid, a.atttypmod)
           || CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END,
       NULL
FROM pg_attribute a
JOIN pg_class     c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND a.attnum > 0
  AND NOT a.attisdropped
  AND c.relname IN (SELECT nombre FROM repo_tablas)
  AND NOT EXISTS (
      SELECT 1 FROM repo_columnas rc
      WHERE rc.tabla = c.relname AND a.attname = ANY (rc.cols)
  )

ORDER BY 1, 2;
`;

writeFileSync(salida, sqlSalida, 'utf8');

console.log(`✅ ${salida.replace(raizRepo + '\\', '').replace(raizRepo + '/', '')}`);
console.log(
    `   Inventario del repo: ${tablas.size} tablas · ${funciones.size} funciones · ` +
    `${totalColumnas} columnas · ${archivos.length} migraciones leídas.`,
);

if (process.argv.includes('--stats')) {
    // Control del parseo. Cada caso tiene una respuesta conocida, así que si el
    // extractor se rompe (un regex que deja de matchear, por ejemplo) se nota acá
    // en vez de producir una lista de deriva falsa.
    const casos = [
        // Las 5 tablas de rendimiento YA están versionadas desde M0, así que ahora
        // deben figurar como creadas. Antes de M0 no lo estaban.
        ['tabla creada (M0)',        tablas.has('performance_entries'),                        true],
        ['tabla creada (base)',      tablas.has('school_staff'),                               true],
        ['columna versionada',       columnas.get('school_staff')?.has('email') ?? false,      true],
        // Deriva conocida: deben seguir AUSENTES del inventario del repo.
        ['coach_auth_id sin versionar',
            columnas.get('school_staff')?.has('coach_auth_id') ?? false,                       false],
        ['attendance_records.user_id sin versionar',
            columnas.get('attendance_records')?.has('user_id') ?? false,                       false],
    ];

    console.log('\n   Control del parseo:');
    let fallos = 0;
    for (const [etiqueta, real, esperado] of casos) {
        const ok = real === esperado;
        if (!ok) fallos++;
        console.log(`     ${ok ? '✓' : '✗'} ${etiqueta} → ${real} (esperado ${esperado})`);
    }
    console.log(fallos === 0
        ? '   Extractor sano.'
        : `   ⚠️  ${fallos} control(es) fallando: revisar los regex antes de confiar en la salida.`);
}
