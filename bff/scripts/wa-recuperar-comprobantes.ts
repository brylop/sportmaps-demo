/**
 * Recupera en lote los comprobantes que llegaron por WhatsApp y nadie leyó, y
 * los deja EN REVISIÓN de la escuela. No le escribe a nadie y no aprueba nada.
 *
 *   cd bff
 *   npx tsx scripts/wa-recuperar-comprobantes.ts --escuela <school_id>                    # simulación (NO escribe)
 *   npx tsx scripts/wa-recuperar-comprobantes.ts --escuela <school_id> --desde 2026-10-02
 *   npx tsx scripts/wa-recuperar-comprobantes.ts --escuela <school_id> --aplicar          # escribe
 *   opcionales: --concurrencia 2 (OCR en paralelo) · --reintentos 3 (vueltas extra para el OCR saturado)
 *
 * QUÉ TOMA
 *
 * Filas de `whatsapp_inbound_queue` de esa escuela, con media_id, en:
 *   - ignored + 'bot_apagado'              (el worker las cerró sin mirarlas)
 *   - ignored + 'contacto sin identificar' (el bug viejo que pedía el correo)
 *   - pending                               (el cron está frenado)
 *
 * Lo ya procesado por este script queda con `error_message` 'recuperado: …' y
 * otro estado, así que una segunda corrida no lo vuelve a tomar (idempotente).
 *
 * QUÉ HACE CON CADA UNA — la regla está en services/whatsapp-recuperacion.service.ts
 *
 *   baja el archivo de Meta (~30 días de vida) → lo guarda donde el worker →
 *   OCR → identifica a la familia por el teléfono → mismo motor del worker
 *   para el cobro → si hay UN cobro posible: `awaiting_approval` con el
 *   comprobante y su veredicto. Todo lo demás (ya registrado, sin cobro,
 *   ambiguo, sin cuenta…) queda en el buzón con su motivo.
 *
 * EN SIMULACIÓN
 *
 * No escribe nada: ni la cola, ni el bucket, ni los cobros, ni la RPC de
 * identificación (que vincula conversaciones). Sí baja cada archivo a MEMORIA
 * y llama al OCR — es una lectura externa, sin efectos — para que la tabla
 * muestre lo que de verdad pasaría.
 */

import 'dotenv/config';
import { supabase } from '../src/config/supabase';
import type { WhatsAppIntegration } from '../src/services/whatsapp.service';
import {
    recuperarFilaDeCola, MOTIVOS_RECUPERABLES, type FilaParaRecuperar,
    type ResultadoRecuperacion, type CacheEscuela,
} from '../src/services/whatsapp-recuperacion.service';

function arg(nombre: string): string | null {
    const i = process.argv.indexOf(nombre);
    return i >= 0 ? process.argv[i + 1] ?? null : null;
}

const ESCUELA = arg('--escuela');
const DESDE = arg('--desde');
const APLICAR = process.argv.includes('--aplicar');

const cop = (n: number | null | undefined) =>
    n === null || n === undefined ? '—'
        : new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

async function main() {
    if (!ESCUELA || !/^[0-9a-f-]{36}$/i.test(ESCUELA)) {
        console.error('Uso: npx tsx scripts/wa-recuperar-comprobantes.ts --escuela <school_id> [--desde YYYY-MM-DD] [--aplicar]');
        process.exit(1);
    }
    if (DESDE && !/^\d{4}-\d{2}-\d{2}$/.test(DESDE)) {
        console.error('--desde debe ser YYYY-MM-DD');
        process.exit(1);
    }

    console.log(APLICAR
        ? '>>> MODO APLICAR: estampa cobros en revisión y cierra filas. NO responde a nadie, NO aprueba.'
        : '>>> SIMULACIÓN: no escribe nada. Para aplicar, agregar --aplicar.');

    let q = supabase.from('whatsapp_inbound_queue')
        .select('id, integration_id, school_id, wa_phone_number, wa_message_id, wa_timestamp, media_id, '
            + 'media_mime_type, storage_path, retries, status, error_message, created_at')
        .eq('school_id', ESCUELA)
        .not('media_id', 'is', null)
        .or(`status.eq.pending,and(status.eq.ignored,error_message.in.(${MOTIVOS_RECUPERABLES.map((m) => `"${m}"`).join(',')}))`)
        .order('created_at', { ascending: true });
    if (DESDE) q = q.gte('created_at', `${DESDE}T00:00:00-05:00`);
    const { data: filas, error } = await q;
    if (error) { console.error('No se pudo leer la cola:', error.message); process.exit(1); }
    const lista = (filas ?? []) as FilaParaRecuperar[];
    console.log(`Filas a revisar: ${lista.length}\n`);
    if (lista.length === 0) return;

    // Una integración por escuela: el token para bajar los archivos.
    const integraciones = new Map<string, WhatsAppIntegration>();
    for (const id of new Set(lista.map((f) => f.integration_id))) {
        const { data } = await supabase.from('school_whatsapp_integrations').select('*').eq('id', id).single();
        if (data) integraciones.set(id, data as WhatsAppIntegration);
    }

    // Nombres para la tabla (solo lectura).
    const nombres = new Map<string, string>();
    const nombreDe = async (id: string | null | undefined) => {
        if (!id) return '—';
        if (!nombres.has(id)) {
            const { data } = await supabase.from('profiles').select('full_name').eq('id', id).maybeSingle();
            nombres.set(id, (data as any)?.full_name ?? id.slice(0, 8));
        }
        return nombres.get(id)!;
    };

    const cache: CacheEscuela = {};
    const filasTabla: Record<string, string>[] = [];
    const totales = new Map<string, number>();
    const aplicados: { fila: string; pago: string; monto: number | null }[] = [];

    // De a CONCURRENCIA filas a la vez: el OCR tarda 5-20 s por archivo y en
    // serie 57 filas pasan de diez minutos. La tabla conserva el orden.
    const CONCURRENCIA = Number(arg('--concurrencia') ?? 2);
    const resultados: ResultadoRecuperacion[] = new Array(lista.length);
    let siguiente = 0;
    const trabajador = async () => {
        while (siguiente < lista.length) {
            const i = siguiente++;
            const fila = lista[i];
            const wa = integraciones.get(fila.integration_id);
            resultados[i] = !wa
                ? { decision: 'reintentar', motivo: 'la integración no existe', ocr: null }
                : await recuperarFilaDeCola(fila, wa, { aplicar: APLICAR, cache });
            process.stderr.write(`  ${i + 1}/${lista.length} ${resultados[i].decision}
`);
        }
    };
    await Promise.all(Array.from({ length: Math.max(1, CONCURRENCIA) }, trabajador));

    // Lo transitorio (OCR saturado: 429 de OpenAI por tokens/minuto, 503 de
    // Gemini) se reintenta acá mismo, con pausa, antes de darlo por pendiente.
    // En --aplicar la fila ya volvió a su estado, así que reintentarla es seguro.
    const REINTENTOS = Number(arg('--reintentos') ?? 3);
    for (let vuelta = 1; vuelta <= REINTENTOS; vuelta++) {
        const pendientes = resultados.map((r, i) => (r.decision === 'reintentar' ? i : -1)).filter((i) => i >= 0);
        if (pendientes.length === 0) break;
        process.stderr.write(`  reintento ${vuelta}/${REINTENTOS}: ${pendientes.length} fila(s), esperando 45 s…
`);
        await new Promise((ok) => setTimeout(ok, 45_000));
        for (const i of pendientes) {
            const fila = lista[i];
            const wa = integraciones.get(fila.integration_id);
            if (wa) resultados[i] = await recuperarFilaDeCola(fila, wa, { aplicar: APLICAR, cache });
            process.stderr.write(`  ${i + 1}/${lista.length} ${resultados[i].decision}
`);
        }
    }

    for (let i = 0; i < lista.length; i++) {
        const fila = lista[i];
        const r = resultados[i];
        totales.set(r.decision, (totales.get(r.decision) ?? 0) + 1);
        if (r.decision === 'en_revision' && r.pago) aplicados.push({ fila: fila.id, pago: r.pago.id, monto: r.ocr?.amount ?? null });

        filasTabla.push({
            fila: fila.id.slice(0, 8),
            llegó: fila.created_at.slice(0, 16).replace('T', ' '),
            origen: `${fila.status}${fila.error_message ? `/${fila.error_message}` : ''}`.slice(0, 30),
            tel: `…${fila.wa_phone_number.slice(-4)}`,
            familia: r.parentId ? (await nombreDe(r.parentId)).slice(0, 28) : '—',
            monto: cop(r.ocr?.amount),
            fecha_comp: r.ocr?.date ?? '—',
            cobro: r.pago ? `${(r.pago.concept ?? r.pago.id).slice(0, 40)} (${cop(r.pago.amount)})` : (r.pagoRegistradoId ? `ya: ${r.pagoRegistradoId.slice(0, 8)}` : '—'),
            decisión: r.decision,
            motivo: r.motivo.slice(0, 80),
        });
    }

    console.table(filasTabla);
    console.log('\nTotales por decisión:');
    for (const [k, v] of Array.from(totales.entries()).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(22)} ${v}`);
    const suma = aplicados.reduce((s, a) => s + (a.monto ?? 0), 0);
    console.log(`\n${APLICAR ? 'Quedaron' : 'Quedarían'} EN REVISIÓN: ${aplicados.length} comprobante(s) por ${cop(suma)} (leído).`);
    if (!APLICAR) console.log('\nNada se escribió. Para aplicar: agregar --aplicar.');
}

main().catch((err) => { console.error(err); process.exit(1); });
