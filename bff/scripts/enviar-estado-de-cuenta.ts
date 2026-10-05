/**
 * Estado de cuenta por correo: UN mensaje por familia con todo lo que debe
 * (vencido + pendiente) y todo para pagar (botón /p/:token por cobro, QR,
 * cuentas de la escuela, WhatsApp para el comprobante). Herramienta MANUAL: la
 * lógica vive en src/services/estado-de-cuenta.service.ts, que también usa el
 * job mensual automático.
 *
 *   cd bff
 *   npx tsx scripts/enviar-estado-de-cuenta.ts --escuela <school_id>              # simulación: no manda nada
 *   npx tsx scripts/enviar-estado-de-cuenta.ts --escuela <school_id> --aplicar    # manda
 *
 * Opciones:
 *   --reenvio            clave de idempotencia propia (estado_de_cuenta_reenvio:<escuela>:<familia>:<fecha>):
 *                        la reserva del envío original no lo frena; correrlo dos veces el mismo día sí.
 *   --nota "<texto>"     aviso destacado arriba del correo (p.ej. la corrección del enlace).
 *   --canal correo|auto  default correo; 'auto' intenta WhatsApp (opt-in + plantilla aprobada) y si no, correo.
 *   --frontend <url>     base de los enlaces (default https://app.sportmaps.co).
 *   --bff <url>          base del PNG del QR (default https://bffprod.sportmaps.co).
 *
 * Reenvío del 2026-10-06 (Dynasty):
 *   npx tsx scripts/enviar-estado-de-cuenta.ts --escuela 2d509571-3238-4c04-ac3f-6dfe20539226 --reenvio \
 *     --nota "Corregimos el enlace del correo de ayer: ahora el botón te lleva directo a pagar." --aplicar
 *
 * Frenos (en el servicio):
 *   - Horario de cobranza (L-V 7-19, sábado 8-15, nunca domingos ni festivos).
 *   - Se salta a quien ya recibió un aviso de cobro o de vencido HOY.
 *   - Idempotente por familia y día (o mes, en el job): id determinístico en email_sends.
 *   - Cobros duplicados por pagador (findDuplicatePaymentIds) no se listan.
 *   - NO se lee FRONTEND_URL del .env: el 2026-10-05 los 304 correos salieron
 *     con «Ver y pagar» a localhost por eso. Los enlaces son SIEMPRE de
 *     producción salvo --frontend/--bff, y cualquier localhost/127.0.0.1/.local
 *     corta el script con error antes de mandar nada.
 */

import 'dotenv/config';
import { enviarEstadoDeCuenta } from '../src/services/estado-de-cuenta.service';
import { APP_PUBLICA_PROD, BFF_PUBLICO_PROD } from '../src/utils/url-publica-familias';

function arg(nombre: string): string | undefined {
    const i = process.argv.indexOf(nombre);
    return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
    const schoolId = arg('--escuela');
    const aplicar = process.argv.includes('--aplicar');
    const reenvio = process.argv.includes('--reenvio');
    if (!schoolId) throw new Error('Falta --escuela <school_id>');

    // Freno explícito además del del servicio (urlPublicaSegura): estas URLs
    // van a familias reales.
    const frontend = (arg('--frontend') || APP_PUBLICA_PROD).replace(/\/$/, '');
    const bff = (arg('--bff') || BFF_PUBLICO_PROD).replace(/\/$/, '');
    for (const u of [frontend, bff]) {
        if (/localhost|127\.0\.0\.1|\.local/i.test(u)) {
            throw new Error(`El enlace del correo apunta a ${u}. Los correos van a familias reales: usa la URL pública.`);
        }
    }
    const canal = arg('--canal') === 'auto' ? 'auto' : 'correo';

    const resumen = await enviarEstadoDeCuenta(schoolId, {
        modo: reenvio ? 'reenvio' : 'manual',
        aplicar,
        canal,
        nota: arg('--nota') ?? null,
        appUrl: frontend,
        bffUrl: bff,
    });
    console.log(JSON.stringify({ ...resumen, frontend, bff }, null, 2));
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
