// scripts/migraciones-pendientes.mjs
//
// ¿Qué migraciones están en el repo pero NO aplicadas en la base?
//
// ── Por qué existe ──────────────────────────────────────────────────────────
// El despliegue de migraciones es MANUAL. El 2026-08-13 se escribió y commiteó
// `20260813133108_cerrar_fuga_de_payment_links_a_anon.sql`, que cerraba una fuga
// que exponía 93 tokens de pago a internet. Nunca se aplicó. Al día siguiente la
// fuga seguía viva y solo se descubrió por casualidad, auditando otra cosa.
//
// El commit existía, el fix estaba revisado, y no servía de nada.
//
// `migrations:check` compara el repo contra el ledger, y `migrations:drift`
// busca objetos que la base tiene y el repo no crea. Ninguno de los dos
// responde esta pregunta, que es la que importa después de escribir un fix:
// **¿esto ya está corriendo en producción?**
//
// Uso:
//   node scripts/migraciones-pendientes.mjs

import { createClient } from '../bff/node_modules/@supabase/supabase-js/dist/index.mjs';
import { config } from '../bff/node_modules/dotenv/lib/main.js';
import { readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: resolve(RAIZ, 'bff/.env') });

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
    console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en bff/.env');
    process.exit(1);
}

const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

// Vía RPC y no leyendo la tabla: PostgREST solo expone los esquemas `public` y
// `graphql_public`, así que `supabase_migrations.schema_migrations` es
// inalcanzable desde acá. La RPC vive en public y devuelve solo las versiones.
const { data: aplicadas, error } = await supabase.rpc('migraciones_aplicadas');

if (error) {
    console.error('No se pudo leer las migraciones aplicadas:', error.message);
    console.error('\nAlternativa a mano, en el SQL editor:');
    console.error('  select version from supabase_migrations.schema_migrations;');
    process.exit(1);
}

// Se cruza por NOMBRE, no por versión.
//
// Cuando una migración se aplica con una herramienta (el MCP de Supabase, el
// dashboard), la base le asigna SU PROPIO timestamp y la versión deja de
// coincidir con la del archivo:
//
//   archivo  20260814193412_guardar_fondo_del_icono_pwa.sql
//   base     20260814193503  guardar_fondo_del_icono_pwa
//
// Comparando por versión, todas esas salían como pendientes. Un detector que
// grita de más es peor que no tenerlo: se aprende a ignorarlo y el día que
// avisa de verdad no lo mira nadie. El `name` sí coincide con el slug.
const nombresAplicados = new Set((aplicadas ?? []).map((r) => r.name).filter(Boolean));
const versionesAplicadas = new Set((aplicadas ?? []).map((r) => r.version));

const archivos = (await readdir(resolve(RAIZ, 'supabase/migrations')))
    .filter((f) => f.endsWith('.sql'))
    .sort();

// ── Solo se evalúa lo RECIENTE, y es a propósito ────────────────────────────
//
// El repo y la base divergieron hace tiempo: hay 583 migraciones aplicadas
// contra 358 archivos, y los slugs viejos no coinciden porque buena parte del
// esquema se construyó fuera del repo (lo mismo que mide `migrations:drift`).
//
// Sin corte, esta herramienta reporta ~314 "pendientes" que en realidad están
// aplicadas, y con eso no sirve para nada: nadie lee una lista de 314 alarmas
// falsas, y el día que aparece la de verdad se pierde entre el ruido.
//
// Acotado a lo reciente responde con certeza la única pregunta que importa
// después de escribir un fix: ¿esto ya está corriendo?
const DIAS = Number(process.argv.find((a) => a.startsWith('--dias='))?.split('=')[1] ?? 30);
const corte = new Date(Date.now() - DIAS * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10).replace(/-/g, '');

const conVersion = archivos
    .map((f) => {
        const version = f.split('_')[0];
        // <version>_<slug>.sql → slug
        const slug = f.slice(version.length + 1).replace(/\.sql$/, '');
        return { archivo: f, version, slug };
    })
    .filter((m) => /^\d{14}$/.test(m.version));

const recientes = conVersion.filter((m) => m.version.slice(0, 8) >= corte);

const pendientes = recientes.filter(
    (m) => !nombresAplicados.has(m.slug) && !versionesAplicadas.has(m.version),
);

console.log(`Repo:      ${archivos.length} migraciones (${recientes.length} de los últimos ${DIAS} días)`);
console.log(`Base:      ${versionesAplicadas.size} aplicadas`);
console.log(`Evaluadas: desde ${corte}  ·  las anteriores no se evalúan (repo y base divergieron)`);
console.log('');

if (pendientes.length === 0) {
    console.log('✅ Todas las migraciones recientes del repo están registradas.');
    process.exit(0);
}

console.log(`⚠️  ${pendientes.length} SIN REGISTRO DE APLICACIÓN:\n`);
for (const m of pendientes) console.log(`   ${m.archivo}`);

console.log(`
─────────────────────────────────────────────────────────────────────────────
IMPORTANTE: esto dice "sin registro", NO "sin aplicar".

Lo que se corre desde el SQL editor de Supabase cambia la base pero NO escribe
en schema_migrations. Comprobado: 20260802224625_children_rls_solo_staff figura
acá y su policy SÍ existe en la base — se aplicó por esa vía.

Así que esta lista es un punto de partida para verificar, no un veredicto. Para
cada una que importe, confirmá contra el objeto real:

    select policyname, qual from pg_policies where tablename = '...';
    select prosrc from pg_proc where proname = '...';

Para que esta herramienta pueda dar un veredicto, las migraciones tienen que
aplicarse por una vía que deje registro (el CLI de Supabase o apply_migration),
no pegando SQL en el editor. Mientras se use el editor, lo que está vivo en la
base es indistinguible de lo que nunca se corrió.
─────────────────────────────────────────────────────────────────────────────`);

// Exit 1 para poder usarlo como gate si algún día se cierra el uso del editor.
process.exit(1);
