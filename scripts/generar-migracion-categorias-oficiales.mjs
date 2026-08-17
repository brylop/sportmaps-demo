#!/usr/bin/env node
// ============================================================================
// Genera la migración que sube el catálogo de deportes del FRONTEND a la BASE.
//
// El problema: hay dos catálogos y no hablan entre sí.
//
//   frontend/src/lib/constants/sportsCatalog.ts  79 deportes, TODOS con
//       categorías de competencia ricas (pruebas, modalidades, edades, pesos).
//       Fuente IOC / ASOIF / ARISF / AIMS / IPC. Es el que se hizo para torneos
//       y el que usan CreateTeamModal, OfferingsManagement y RegisterPage.
//
//   public.sports_categories                     99 deportes, solo 21 con
//       `categorias_oficiales` poblado.
//
// Al vivir como constante del frontend, el catálogo bueno **no lo puede usar
// nadie más**: ni el BFF, ni las RPC, ni las policies, ni ningún módulo que
// corra en la base. Por eso cada pantalla que necesita categorías termina
// inventándoselas.
//
// Esta migración lo sube a la base para que sea una sola fuente. NO pisa los 21
// que ya están poblados —pueden estar curados a mano— y reporta en cuáles
// difieren, para que alguien decida.
//
// Uso:  node scripts/generar-migracion-categorias-oficiales.mjs
//       (imprime el SQL; redirigirlo al archivo de migración)
// ============================================================================
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TS = 'frontend/src/lib/constants/sportsCatalog.ts';

// El archivo es datos puros: se le quitan los tipos y se carga como CommonJS.
// Parsear objetos JS anidados con regex sería frágil; esto usa el parser real.
let src = readFileSync(TS, 'utf8');
// Se toma SOLO el literal del arreglo: lo que viene después son helpers con
// tipos que no hacen falta y que no compilan como CommonJS.
const desde = src.indexOf('export const SPORTS_CATALOG');
const hasta = src.indexOf('\n];', desde);
if (desde < 0 || hasta < 0) {
    console.error(`No encontré el arreglo SPORTS_CATALOG en ${TS}. ¿Cambió de forma?`);
    process.exit(1);
}
src = src.slice(desde, hasta + 3)
    .replace(/export const SPORTS_CATALOG:[^=]+=/, 'const SPORTS_CATALOG =')
    // Aserciones de tipo dentro de los datos: `'x' as CategoriaGlobal`.
    .replace(/ as [A-Za-z_][A-Za-z0-9_]*(\[\])?/g, '');
src += '\nmodule.exports = { SPORTS_CATALOG };\n';

const tmp = join(tmpdir(), `sportscat-${Date.now()}.cjs`);
writeFileSync(tmp, src, 'utf8');
let SPORTS_CATALOG;
try {
    ({ SPORTS_CATALOG } = createRequire(import.meta.url)(tmp));
} finally {
    try { unlinkSync(tmp); } catch { /* da igual */ }
}

const conCat = SPORTS_CATALOG.filter(
    (s) => s.categoriasCompetencia && Object.keys(s.categoriasCompetencia).length > 0,
);

const esc = (o) => JSON.stringify(o).replace(/'/g, "''");

const lineas = conCat.map((s) => `    ('${s.slug}', '${esc(s.categoriasCompetencia)}'::jsonb)`).join(',\n');

process.stdout.write(`-- ============================================================================
-- Catálogo de deportes: una sola fuente de verdad
--
-- GENERADO por scripts/generar-migracion-categorias-oficiales.mjs desde
-- ${TS}. No editar a mano: regenerar.
--
-- Por qué: el catálogo bueno —${SPORTS_CATALOG.length} deportes con categorías de competencia
-- según IOC/ASOIF/ARISF/AIMS/IPC, el que se armó para torneos— vive como
-- constante del FRONTEND. Ahí no lo puede usar nadie más: ni el BFF, ni las
-- RPC, ni ningún módulo que corra en la base. Por eso cada pantalla que
-- necesita categorías termina inventándoselas, y por eso 'sports_categories'
-- tiene solo 21 de 99 deportes con 'categorias_oficiales'.
--
-- Qué hace: rellena 'categorias_oficiales' SOLO donde está vacío. Los que ya
-- tienen contenido NO se tocan: pueden haber sido curados a mano. La consulta
-- final reporta en cuáles difieren, para decidirlos aparte.
--
-- Reversible: no borra ni cambia nada existente.
-- ============================================================================

BEGIN;

WITH catalogo(slug, categorias) AS (
  VALUES
${lineas}
)
UPDATE public.sports_categories sc
   SET categorias_oficiales = c.categorias
  FROM catalogo c
 WHERE sc.slug = c.slug
   AND (sc.categorias_oficiales IS NULL
        OR sc.categorias_oficiales = '{}'::jsonb);

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Cobertura después de aplicar.
-- ────────────────────────────────────────────────────────────────────────────
SELECT count(*)                                                                       AS deportes,
       count(*) FILTER (WHERE categorias_oficiales IS NOT NULL
                          AND categorias_oficiales <> '{}'::jsonb)                    AS con_categorias,
       count(*) FILTER (WHERE categorias_oficiales IS NULL
                          OR categorias_oficiales = '{}'::jsonb)                      AS aun_vacios
  FROM public.sports_categories;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Los que quedan sin categorías: no están en el catálogo del frontend.
--    Es la lista de trabajo para completar el mapeo.
-- ────────────────────────────────────────────────────────────────────────────
SELECT name, slug, federacion_internacional, estado_olimpico
  FROM public.sports_categories
 WHERE categorias_oficiales IS NULL OR categorias_oficiales = '{}'::jsonb
 ORDER BY name;
`);

process.stderr.write(`\n✓ ${conCat.length} deportes con categorías leídos de ${TS}\n`);
