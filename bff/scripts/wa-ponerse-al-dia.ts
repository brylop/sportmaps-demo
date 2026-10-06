/**
 * Ponerse al día con el WhatsApp de una escuela: TODO lo que quedó sin
 * respuesta con la ventana de 24 h abierta, cada conversación con una acción
 * explícita (reglas en src/services/whatsapp-ponerse-al-dia.service.ts):
 *
 *   a) cierre       «gracias / ok / vale / 👍» → se da por atendida, sin enviar
 *   b) comprobante  imagen/PDF de familia → a la cola si nunca entró; si ya se
 *                   procesó en silencio (recuperación del 5-oct), el estado de
 *                   sus comprobantes y cobros
 *   c) turno        pregunta de familia o prospecto → turno real del bot
 *                   (audios transcritos primero si hoy se puede)
 *   d) revisar      personal, saludo suelto de desconocido, dudoso → NO se
 *                   envía; queda listado para la escuela
 *   e) borradores   los `pending` viejos pasan a 'expired' en a/b/c
 *
 *   cd bff
 *   npx tsx scripts/wa-ponerse-al-dia.ts --escuela <school_id>              # simulación
 *   npx tsx scripts/wa-ponerse-al-dia.ts --escuela <school_id> --aplicar    # actúa (en auto ENVÍA)
 *   opcional: --solo-borradores (solo conversaciones con borradores huérfanos)
 *
 * SIMULACIÓN: corre el camino REAL del bot dentro de `simularEnvios` (`deliver`
 * anota en vez de enviar) y con `fetch` vigilado: toda escritura a la base
 * (POST/PATCH/DELETE a PostgREST, RPC que no sea de lectura, Edge Functions) y
 * todo POST a Meta/correo se BLOQUEA y se responde vacío. Solo salen los POST
 * al modelo (Anthropic/Gemini/Groq/OpenAI/DeepSeek) y la transcripción de
 * audios. Limitación: la clasificación usa `contact_kind` guardado y la
 * vinculación por teléfono (`wa_identify_by_phone`, que escribe) no corre.
 */

import 'dotenv/config';

if (!process.env.FRONTEND_URL || /localhost|127\.0\.0\.1/.test(process.env.FRONTEND_URL)) {
    process.env.FRONTEND_URL = 'https://app.sportmaps.co';
}

function arg(nombre: string): string | null {
    const i = process.argv.indexOf(nombre);
    return i >= 0 ? process.argv[i + 1] ?? null : null;
}
const ESCUELA = arg('--escuela');
const APLICAR = process.argv.includes('--aplicar');

// ─── Guarda de escrituras (solo simulación) ──────────────────────────────────
// Se instala ANTES de importar el cliente de Supabase: supabase-js toma el
// `fetch` global al crearse.
const HOSTS_LLM = /(^|\.)(api\.anthropic\.com|api\.groq\.com|api\.openai\.com|api\.deepseek\.com|generativelanguage\.googleapis\.com)$/;
const RPC_LECTURA = new Set([
    'wa_get_payment_status', 'list_open_trial_slots_public', 'wa_can_send_template', 'wa_es_familia_sin_registrar',
    'wa_identify_staff_admin_by_phone', 'wa_invitacion_pendiente_por_telefono',
]);
const bloqueadas: string[] = [];
if (!APLICAR) {
    // Sin push ni web push en la simulación.
    delete process.env.FIREBASE_SERVICE_ACCOUNT;
    delete process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    delete process.env.VAPID_PRIVATE_KEY;
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: any, init?: any) => {
        const url = new URL(typeof input === 'string' ? input : input?.url ?? String(input));
        const metodo = String(init?.method ?? input?.method ?? 'GET').toUpperCase();
        if (metodo === 'GET' || metodo === 'HEAD') return original(input, init);
        if (HOSTS_LLM.test(url.hostname)) return original(input, init);
        const rpc = url.pathname.match(/\/rest\/v1\/rpc\/([a-z0-9_]+)/i)?.[1];
        if (rpc && RPC_LECTURA.has(rpc)) return original(input, init);
        bloqueadas.push(`${metodo} ${url.hostname}${url.pathname}`);
        const cuerpo = rpc ? 'null' : '[]';
        return new Response(cuerpo, { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
}

const enmascarar = (tel: string) => {
    const d = String(tel || '').replace(/\D/g, '');
    return d.length > 4 ? `${'•'.repeat(Math.max(0, d.length - 4))}${d.slice(-4)}` : d;
};
const horas = (ms: number) => `${Math.floor(ms / 3_600_000)}h ${String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, '0')}m`;
const sangria = (t: string, n = 6) => String(t).split('\n').map((l) => ' '.repeat(n) + l).join('\n');
const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' });

const ACCION_LETRA: Record<string, string> = { cierre: 'a', comprobante: 'b', turno: 'c', revisar: 'd' };
const corto = (t: string | null | undefined, n = 90) => {
    const x = String(t ?? '').replace(/\s+/g, ' ').trim();
    return x.length > n ? `${x.slice(0, n - 1)}…` : x;
};

async function main(): Promise<void> {
    if (!ESCUELA) {
        console.error('Uso: npx tsx scripts/wa-ponerse-al-dia.ts --escuela <school_id> [--aplicar] [--solo-borradores]');
        process.exit(1);
    }
    const { supabase } = await import('../src/config/supabase');
    const { simularEnvios } = await import('../src/services/whatsapp-bot.service');
    const svc = await import('../src/services/whatsapp-ponerse-al-dia.service');

    const { data: integ, error } = await supabase.from('school_whatsapp_integrations')
        .select('id, school_id, phone_number_id, waba_id, display_phone_number, access_token_encrypted, verify_token, status')
        .eq('school_id', ESCUELA).maybeSingle();
    if (error || !integ) throw new Error(`Sin integración de WhatsApp para ${ESCUELA}: ${error?.message ?? ''}`);
    const integration = integ as any;
    const { data: ajustes } = await supabase.from('whatsapp_settings')
        .select('mode, ai_enabled, assisted_until, transcribir_audios').eq('integration_id', integration.id).maybeSingle();

    const lista = await svc.listarPorResponder(integration, { soloConBorradores: process.argv.includes('--solo-borradores') });
    const cola = await svc.estadoDeCola(lista);
    const { vocativosDeEscuela } = await import('../src/services/whatsapp-bot.service');
    const equipo = await vocativosDeEscuela(ESCUELA);
    console.log(`\n${APLICAR ? 'APLICANDO' : 'SIMULACIÓN (no se envía ni se escribe nada)'} — escuela ${ESCUELA}`);
    console.log(`Ajustes: mode=${(ajustes as any)?.mode} · ai_enabled=${(ajustes as any)?.ai_enabled} · assisted_until=${(ajustes as any)?.assisted_until ?? '-'} · transcribir_audios=${(ajustes as any)?.transcribir_audios}`);
    console.log(`Sin respuesta con ventana abierta: ${lista.length} · borradores pending en ellas: ${lista.reduce((n, c) => n + c.borradores.length, 0)}`);
    if (APLICAR && (ajustes as any)?.mode !== 'auto') {
        console.log('⚠ La escuela NO está en modo auto: los turnos dejarán borradores nuevos en vez de enviar.');
    }

    const totales: Record<string, number> = {};
    const tabla: string[] = [];
    let n = 0;
    for (const c of lista) {
        n++;
        const decision = svc.accionDeConversacion(c, cola, equipo);
        const letra = ACCION_LETRA[decision.accion] + (decision.comprobante ? `:${decision.comprobante}` : '');
        totales[letra] = (totales[letra] ?? 0) + 1;
        const ultimo = c.entrantes[c.entrantes.length - 1];
        const ultimoTxt = ultimo.tipo === 'text' || ultimo.tipo === 'interactive' || ultimo.tipo === 'button'
            ? ultimo.texto : `(${ultimo.tipo})${ultimo.texto ? ` ${ultimo.texto}` : ''}`;
        console.log(`\n${n}. ${c.contactName ?? '(sin nombre)'} · ${enmascarar(c.contactWaId)} · ${c.contactKind ?? '?'} · ventana ${horas(c.restanteMs)} · ACCIÓN ${letra} — ${decision.motivo}`);
        for (const e of c.entrantes.slice(-6)) {
            const tr = e.tipo === 'audio'
                ? (e.transcripcion?.al_bot ? ` [transcrito] ${e.texto ?? ''}` : e.transcripcion ? ' [transcripción no apta]' : ' [sin transcribir]')
                : '';
            const enCola = cola.get(e.waMessageId);
            console.log(`     ${hora(e.creado)} ${e.tipo}${e.tipo === 'audio' ? tr : e.texto ? `: ${corto(e.texto, 140)}` : ''}${enCola ? ` [cola: ${enCola.status}]` : ''}`);
        }
        if (c.borradores.length) {
            const dup = c.borradores.length - new Set(c.borradores.map((b) => b.texto)).size;
            console.log(`   e) borradores viejos: ${c.borradores.length}${dup ? ` (${dup} duplicado/s)` : ''} → ${decision.accion === 'revisar' ? 'se dejan para la escuela' : "'expired'"}`);
        }
        let propuesta = '';
        if (!APLICAR) {
            const { resultado, salidas } = await simularEnvios(() => svc.ejecutarAccion(integration, c, decision, { simular: true }));
            console.log(`   hoy: ${resultado.hecho}${resultado.detalle ? ` (${resultado.detalle})` : ''}`);
            for (const s of salidas) {
                console.log(`   respuesta [${s.step ?? '-'}]:\n${sangria(s.texto)}`);
                if (s.botones.length) console.log(`      botones: ${s.botones.join(' | ')}`);
            }
            propuesta = salidas.length ? salidas.map((s) => corto(s.texto, 70)).join(' / ') : `(${resultado.hecho})`;
        } else {
            const r = await svc.ejecutarAccion(integration, c, decision);
            console.log(`   hecho: ${r.hecho}${r.detalle ? ` (${r.detalle})` : ''}`);
            propuesta = r.hecho;
        }
        tabla.push([String(n).padStart(2), corto(c.contactName ?? '(sin nombre)', 18).padEnd(18), enmascarar(c.contactWaId).slice(-6),
            (c.contactKind ?? '?').padEnd(18), corto(ultimoTxt, 34).padEnd(34), horas(c.restanteMs).padStart(7),
            letra.padEnd(13), propuesta].join(' | '));
    }

    console.log('\n═══ TABLA ═══');
    console.log([' #', 'nombre'.padEnd(18), 'tel   ', 'tipo'.padEnd(18), 'último'.padEnd(34), 'ventana', 'acción'.padEnd(13), 'respuesta'].join(' | '));
    for (const f of tabla) console.log(f);
    console.log('\nTotales por acción (a cierre · b comprobante · c turno · d revisar):');
    for (const [k, v] of Object.entries(totales).sort()) console.log(`   ${k}: ${v}`);

    if (!APLICAR) {
        const resumen = new Map<string, number>();
        for (const b of bloqueadas) resumen.set(b, (resumen.get(b) ?? 0) + 1);
        console.log(`\n(Escrituras/envíos bloqueados por la simulación: ${bloqueadas.length})`);
        for (const [k, v] of resumen) console.log(`   ${v}× ${k}`);
    }
}

main().then(() => process.exit(0)).catch((e) => {
    console.error(e);
    process.exit(1);
});
