#!/usr/bin/env node
// ============================================================================
// Gate: los errores de tipo que SÍ revientan en tiempo de ejecución
//
// ── Por qué existe ──────────────────────────────────────────────────────────
// Al mover el catálogo de deportes de una constante del frontend a la base
// (`165d457`) se quitaron los imports de `SPORTS_LIST` y `SPORTS_CATALOG` pero
// quedaron tres referencias vivas, y las tres se desplegaron a dev:
//
//   CreateTeamModal      `SPORTS_LIST` usado 6 líneas ANTES de declararlo con
//                        const. El modal se monta siempre, así que la zona
//                        muerta temporal mataba la página de Equipos entera —
//                        en toda escuela sin `sport_configs`, o sea todas
//                        menos dos.                                    TS2448
//   RegisterPage         `const sports = SPORTS_LIST;` a nivel de módulo, con
//                        el import ya borrado.                          TS2304
//   OfferingsManagement  `SPORTS_CATALOG.find(...)` al abrir el formulario de
//                        plan de una oferta con deporte.                TS2552
//
// Nada lo atrapó: `vite build` transpila con esbuild y **no typechequea**, y el
// `tsc` completo tarda >10 min y arroja ~300 errores preexistentes, así que dos
// nuevos se pierden en el ruido (ver `INF-8` en el ROADMAP).
//
// ── Qué hace ────────────────────────────────────────────────────────────────
// Corre el mismo `tsc` pero reporta SOLO los códigos que son fallas de runtime
// garantizadas, no diferencias de tipos. Cero falsos positivos: si esto sale en
// rojo, hay una pantalla que revienta.
//
// (Un primer intento buscaba identificadores en MAYÚSCULAS con expresiones
// regulares. Dio 281 falsos positivos —texto de JSX, formatos de fecha como
// 'MMM', siglas como EPS y NIT— y quedó inservible. El compilador ya sabe
// distinguirlos: no hay que reimplementarlo.)
//
// Uso:
//   node scripts/verificar-nombres-sin-declarar.mjs
//   npm run verificar:runtime
// ============================================================================
import { spawnSync } from 'node:child_process';

// Cada uno es un ReferenceError o un TypeError seguro al ejecutar.
const FATALES = {
    TS2304: 'nombre inexistente (import borrado, constante que ya no existe)',
    TS2552: 'nombre inexistente, con sugerencia del compilador',
    TS2448: 'variable con const/let usada ANTES de declararla (zona muerta temporal)',
    TS2449: 'clase usada antes de declararla',
};

const r = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['tsc', '--noEmit', '-p', 'tsconfig.app.json'],
    { cwd: 'frontend', encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: process.platform === 'win32' },
);

const salida = `${r.stdout ?? ''}${r.stderr ?? ''}`;
if (!salida.trim() && r.status !== 0) {
    console.error('tsc no produjo salida y falló. ¿Está instalado?');
    process.exit(2);
}

const lineas = salida.split(/\r?\n/);
const codigos = Object.keys(FATALES);
const fatales = lineas.filter((l) => codigos.some((c) => l.includes(`error ${c}:`)));
const total = lineas.filter((l) => /error TS\d+:/.test(l)).length;

console.log(`tsc reportó ${total} errores en total.`);
console.log(`De esos, ${fatales.length} son fallas de ejecución garantizadas:\n`);

if (fatales.length === 0) {
    if (total === 0) {
        console.log('✅ Ninguna, y tampoco hay errores de tipos: la base está limpia.');
        console.log('   Cualquier error nuevo es una regresión. El gate del pre-commit y del');
        console.log('   CI corre el tsc completo con -p, así que ya no hace falta este script');
        console.log('   como red — queda para diagnosticar rápido cuál error rompe una pantalla.');
    } else {
        console.log('✅ Ninguna. Los demás son diferencias de tipos: molestan, no rompen.');
    }
    process.exit(0);
}

for (const l of fatales) {
    const cod = codigos.find((c) => l.includes(`error ${c}:`));
    console.log(`⛔ ${l.trim()}`);
    console.log(`   → ${FATALES[cod]}\n`);
}
console.log('Cada uno rompe una pantalla en producción. No desplegar así.');
process.exit(1);
