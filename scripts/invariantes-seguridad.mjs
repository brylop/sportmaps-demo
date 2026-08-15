// scripts/invariantes-seguridad.mjs
//
// Afirma contra la BASE VIVA las reglas de seguridad que no se pueden romper.
//
// ── Por qué existe ──────────────────────────────────────────────────────────
// El 2026-08-14 se encontraron cinco fugas hacia internet abierto —datos
// bancarios de 305 escuelas, tokens de pago, correos y teléfonos del staff,
// reservas, leads— y dos escaladas de privilegios, una de las cuales permitía
// entrar como staff a CUALQUIER escuela de la plataforma.
//
// Ninguna se detectó leyendo el repo. Aparecieron consultando pg_policies.
//
// Y el registro de migraciones no sirve de fuente de verdad: lo que se corre
// desde el SQL editor cambia la base sin dejar rastro en schema_migrations, así
// que hay 82 migraciones que figuran "sin registro" y en su mayoría SÍ están
// aplicadas. Preguntarle al repo qué está vivo es preguntarle a quien no sabe.
//
// Esto le pregunta a la base. Sobrevive al SQL editor, a la deriva de esquema y
// a los cambios hechos a mano.
//
// Uso:
//   npm run seguridad:invariantes
//
// Sale con código 1 si hay violaciones CRÍTICAS, para poder usarlo como gate.
// Las ALTA y MEDIA se listan pero no bloquean: son deuda a bajar, no incendios.

import { createClient } from '../bff/node_modules/@supabase/supabase-js/dist/index.mjs';
import { config } from '../bff/node_modules/dotenv/lib/main.js';
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
const { data, error } = await supabase.rpc('invariantes_seguridad');

if (error) {
    console.error('No se pudo ejecutar invariantes_seguridad():', error.message);
    console.error('¿Está aplicada la migración 20260814195349?');
    process.exit(1);
}

const violaciones = data ?? [];

const DESCRIPCION = {
    I1_tabla_privada_publica:
        'Tabla con datos privados legible SIN autenticación. La llave anónima viaja en el bundle del frontend: esto es público en internet.',
    I2_familia_puede_escribir:
        'Una policy de escritura usa user_school_ids(), que incluye a padres y atletas. Para escribir van user_staff_school_ids() o user_admin_school_ids().',
    I3_for_all_sin_with_check:
        'FOR ALL sin WITH CHECK: PostgreSQL valida los INSERT con la expresión de USING. Si esa expresión describe "mi fila" pero no acota la escuela, cualquiera se inserta donde quiera.',
    I4_definer_sin_search_path:
        'SECURITY DEFINER sin search_path fijo: quien controle el search_path de la sesión puede hacer que resuelva a SUS objetos, con los permisos del dueño.',
};

const porGravedad = { CRITICA: [], ALTA: [], MEDIA: [] };
for (const v of violaciones) (porGravedad[v.gravedad] ??= []).push(v);

const criticas = porGravedad.CRITICA.length;

if (violaciones.length === 0) {
    console.log('✅ Todos los invariantes de seguridad se cumplen.');
    process.exit(0);
}

for (const gravedad of ['CRITICA', 'ALTA', 'MEDIA']) {
    const lista = porGravedad[gravedad] ?? [];
    if (!lista.length) continue;

    const icono = gravedad === 'CRITICA' ? '🔴' : gravedad === 'ALTA' ? '🟠' : '🟡';
    console.log(`\n${icono} ${gravedad} — ${lista.length}\n`);

    const porInvariante = new Map();
    for (const v of lista) {
        if (!porInvariante.has(v.invariante)) porInvariante.set(v.invariante, []);
        porInvariante.get(v.invariante).push(v);
    }

    for (const [inv, items] of porInvariante) {
        console.log(`  ${inv}  (${items.length})`);
        console.log(`  ${DESCRIPCION[inv] ?? ''}`);
        // Se listan hasta 15 y se dice cuántas quedaron: truncar en silencio
        // haría creer que el problema es más chico de lo que es.
        for (const v of items.slice(0, 15)) console.log(`     · ${v.objeto} — ${v.detalle}`);
        if (items.length > 15) console.log(`     … y ${items.length - 15} más`);
        console.log('');
    }
}

if (criticas > 0) {
    console.log('─'.repeat(77));
    console.log(`${criticas} violación(es) CRÍTICA(s): hay datos privados accesibles sin autenticación.`);
    console.log('Verificá cada una ejecutando como anon antes de asumir que es falso positivo:');
    console.log('    set local role anon;  select count(*) from public.<tabla>;');
    process.exit(1);
}

console.log('─'.repeat(77));
console.log('Sin violaciones CRÍTICAS. Las ALTA y MEDIA son deuda a bajar.');
process.exit(0);
