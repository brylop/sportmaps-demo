/**
 * Humo del conjunto, lado WEBHOOK (spec conversación v2 §3.8): el coach escribe
 * «lista» → grupos; elige grupo → lista numerada; «faltaron 2 y 4» → guarda
 * (guardarSesionAsistencia simulado). Todo pasa por `handleBotTurn` de la ruta,
 * con el servicio de asistencia y el envío REALES sobre una base en memoria.
 * Nada de Meta ni de la base viva.
 *
 * También: con el asistente APAGADO el coach igual registra asistencia; el
 * mensaje que no es de asistencia sigue el flujo normal; y a una familia no se
 * le pregunta a la base «¿es staff?» más de una vez en 5 minutos.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const db = vi.hoisted(() => ({
    t: {} as Record<string, any[]>,
    staffRpc: 0,
    esStaff: true,
    seq: 0,
}));
const enviados = vi.hoisted(() => ({
    texto: [] as string[],
    botones: [] as { cuerpo: string; ids: string[] }[],
}));

vi.mock('../config/supabase', () => {
    const builder = (name: string) => {
        const rows = () => (db.t[name] ??= []);
        const f: ((r: any) => boolean)[] = [];
        let op = 'select'; let payload: any; let single = false; let lim = Infinity;
        const api: any = {
            select: () => api,
            eq: (c: string, v: any) => { f.push((r) => r[c] === v); return api; },
            in: (c: string, v: any[]) => { f.push((r) => v.includes(r[c])); return api; },
            is: (c: string, v: any) => { f.push((r) => (r[c] ?? null) === v); return api; },
            gte: (c: string, v: any) => { f.push((r) => r[c] >= v); return api; },
            order: () => api,
            limit: (n: number) => { lim = n; return api; },
            insert: (p: any) => { op = 'insert'; payload = p; return api; },
            update: (p: any) => { op = 'update'; payload = p; return api; },
            maybeSingle: () => { single = true; return api; },
            single: () => { single = true; return api; },
            then: (ok: any, ko: any) => {
                let r: any;
                if (op === 'insert') {
                    const row = { id: `${name}-${++db.seq}`, created_at: new Date().toISOString(), ...payload };
                    rows().push(row); r = { data: row, error: null };
                } else {
                    const sel = rows().filter((x) => f.every((fn) => fn(x)));
                    if (op === 'update') { sel.forEach((x) => Object.assign(x, payload)); r = { data: sel, error: null }; }
                    else r = { data: single ? (sel[0] ?? null) : sel.slice(0, lim), error: null };
                }
                return Promise.resolve(r).then(ok, ko);
            },
        };
        return api;
    };
    return {
        supabase: {
            from: builder,
            rpc: (n: string) => {
                if (n === 'wa_identify_staff_by_phone') {
                    db.staffRpc++;
                    return Promise.resolve({
                        data: db.esStaff
                            ? { resultado: 'staff', profile_id: 'coach-1', role: 'coach', school_id: 'escuela-1' }
                            : { resultado: 'no_staff' },
                        error: null,
                    });
                }
                return Promise.resolve({ data: null, error: null });
            },
            storage: { from: () => ({ upload: () => Promise.resolve({ error: null }), remove: () => Promise.resolve({ error: null }) }) },
        },
    };
});

const reg = vi.hoisted(() => ({ guardar: vi.fn(), fecha: vi.fn() }));
vi.mock('./attendance-register.service', () => ({ guardarSesionAsistencia: reg.guardar, resolverFechaDeTrabajo: reg.fecha }));
vi.mock('./attendance-sheet-ocr.service', async (orig) => ({ ...(await orig<any>()), extractAttendanceSheet: vi.fn() }));

const atencion = vi.hoisted(() => ({
    debeAtender: vi.fn(),
    botEncendido: vi.fn(async () => false),
}));
vi.mock('./whatsapp-atencion.service', async () => {
    const real = await vi.importActual<typeof import('./whatsapp-atencion.service')>('./whatsapp-atencion.service');
    return { ...real, debeAtender: atencion.debeAtender, botEncendido: atencion.botEncendido };
});
vi.mock('./llm.service', () => ({ chatWithTools: vi.fn() }));
vi.mock('./whatsapp.service', () => ({
    sendTextMessage: vi.fn(async (_i: any, _to: string, t: string) => { enviados.texto.push(t); return { ok: true, waMessageId: 'wamid.t' }; }),
    sendInteractiveButtons: vi.fn(async (_i: any, _to: string, cuerpo: string, bs: any[]) => {
        enviados.botones.push({ cuerpo, ids: bs.map((b) => b.id) });
        return { ok: true, waMessageId: 'wamid.b' };
    }),
    aFormatoWhatsApp: (t: string) => t,
    verifyWebhookSignature: vi.fn(),
    resolveIntegration: vi.fn(),
    parseInboundMessages: vi.fn(() => []),
    parseStatuses: vi.fn(() => []),
    markAsRead: vi.fn(),
    downloadMedia: vi.fn(),
}));
vi.mock('./whatsapp-optin.service', () => ({ estaDadoDeBaja: vi.fn(async () => false), AVISO_DADO_DE_BAJA: '' }));
vi.mock('./whatsapp-horario.service', () => ({
    estadoDeHorario: vi.fn(async () => ({ fueraDeHorario: false })),
    mensajeDeEscalamiento: vi.fn(() => 'En breve te contactan.'),
}));
vi.mock('./push.service', () => ({ sendToUser: vi.fn() }));
vi.mock('./whatsapp-medios-de-pago.service', () => ({ mediosDePago: vi.fn() }));
vi.mock('./whatsapp-info-escuela.service', () => ({ infoDeEscuela: vi.fn(), fallbackInfoEscuela: vi.fn() }));
vi.mock('./whatsapp-respuesta-de-cobro.service', () => ({ resolverRespuestaDeCobro: vi.fn(async () => false) }));
vi.mock('../utils/emailClient', () => ({ emailClient: { send: vi.fn() } }));
vi.mock('./avisos-correo.service', () => ({ avisarEscalamientoPorCorreo: vi.fn(async () => {}) }));
vi.mock('./whatsapp-queue.service', () => ({ encolarAdjunto: vi.fn() }));
vi.mock('./whatsapp-coexistence.service', () => ({
    procesarEchos: vi.fn(), procesarHistorial: vi.fn(), registrarAppState: vi.fn(),
}));

import { handleBotTurn, esCandidatoDeAsistencia, limpiarCacheStaff } from '../routes/whatsapp';

const ESC = 'escuela-1';
const INTEGRATION = { id: 'integ-1', school_id: ESC } as any;
const TEL = '573001112233';
const req = { log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } } as any;
let n = 0;
const texto = (t: string) => ({ type: 'text', textBody: t, botonId: null, contactWaId: TEL, waMessageId: `w${++n}`, contactName: 'Coach' }) as any;
const boton = (id: string) => ({ type: 'interactive', textBody: 'x', botonId: id, contactWaId: TEL, waMessageId: `w${++n}`, contactName: 'Coach' }) as any;

beforeEach(() => {
    n = 0;
    limpiarCacheStaff();
    enviados.texto.length = 0; enviados.botones.length = 0;
    db.staffRpc = 0; db.esStaff = true; db.seq = 0;
    const roster = ['Ana Lopez Ruiz', 'Bea Mora Diaz', 'Cata Rey Paz', 'Dani Sol Vega', 'Eva Cruz Pena'];
    db.t = {
        teams: [
            { id: 'T-NE', name: 'NUEVA ERA', is_active: true, school_id: ESC, schedule: [{ day: 2, time: '17:00', end: '19:00', place: 'Coliseo' }] },
            { id: 'T-IN', name: 'INTERMEDIO', is_active: true, school_id: ESC, schedule: [{ day: 4, time: '16:00', end: '18:00', place: 'Coliseo' }] },
        ],
        enrollments: roster.map((_x, i) => ({ school_id: ESC, status: 'active', team_id: 'T-NE', child_id: `ne-${i}` })),
        children: roster.map((x, i) => ({ id: `ne-${i}`, full_name: x })),
        profiles: [], unregistered_athletes: [],
        school_staff: [{ id: 'st-1', coach_auth_id: 'coach-1', school_id: ESC }],
        team_coaches: [{ team_id: 'T-NE', coach_id: 'st-1' }, { team_id: 'T-IN', coach_id: 'st-1' }],
        attendance_sheet_intake: [],
    };
    reg.guardar.mockReset(); reg.fecha.mockReset();
    reg.fecha.mockImplementation(async (f: string) => ({ ok: true, date: f, esRetroactiva: false }));
    reg.guardar.mockResolvedValue({ ok: true, sessionId: 'ses-1', date: '2026-10-20', creditOutcomes: {}, sesionCreada: true });
    // El asistente está APAGADO y el coach no es «familia»: el bot jamás le contestaría.
    atencion.debeAtender.mockReset();
    atencion.debeAtender.mockResolvedValue({ atender: false, tipo: 'desconocido', botEncendido: false, tomada: false, tambienFamilia: false });
});

describe('esCandidatoDeAsistencia (filtro gratis antes de la base)', () => {
    it('sí: botón asis_*, «lista», respuesta corta con forma de lista', () => {
        expect(esCandidatoDeAsistencia({ type: 'interactive', textBody: 'x', botonId: 'asis_guardar:1' })).toBe(true);
        expect(esCandidatoDeAsistencia({ type: 'text', textBody: 'Lista', botonId: null })).toBe(true);
        expect(esCandidatoDeAsistencia({ type: 'text', textBody: 'faltaron 3 y 7', botonId: null })).toBe(true);
        expect(esCandidatoDeAsistencia({ type: 'text', textBody: 'todos', botonId: null })).toBe(true);
    });
    it('no: charla normal, textos largos, audios, botones de otro flujo', () => {
        expect(esCandidatoDeAsistencia({ type: 'text', textBody: 'Hola, buenas tardes', botonId: null })).toBe(false);
        expect(esCandidatoDeAsistencia({ type: 'text', textBody: 'Hola buenas, quisiera saber el estado de cuenta de mi hijo de los últimos 3 meses por favor', botonId: null })).toBe(false);
        expect(esCandidatoDeAsistencia({ type: 'audio', textBody: 'lista', botonId: null })).toBe(false);
        expect(esCandidatoDeAsistencia({ type: 'interactive', textBody: 'x', botonId: 'sm_cc_confirmar' })).toBe(false);
    });
});

describe('webhook — asistencia del coach con el asistente apagado', () => {
    it('«lista» → grupos; grupo → lista numerada; «faltaron 2 y 4» → guarda', async () => {
        await handleBotTurn(req, INTEGRATION, 'conv-1', texto('lista'));
        expect(enviados.botones).toHaveLength(1);
        expect(enviados.botones[0].ids.every((id) => id.startsWith('asis_grupo:'))).toBe(true);
        expect(enviados.botones[0].ids).toContain('asis_grupo:T-NE');
        // No pasó por el bot: ni siquiera se preguntó si atiende al contacto.
        expect(atencion.debeAtender).not.toHaveBeenCalled();

        await handleBotTurn(req, INTEGRATION, 'conv-1', boton('asis_grupo:T-NE'));
        const lista = enviados.texto.at(-1)!;
        expect(lista).toMatch(/1\. Ana Lopez Ruiz\n2\. Bea Mora Diaz/);

        await handleBotTurn(req, INTEGRATION, 'conv-1', texto('faltaron 2 y 4'));
        expect(reg.guardar).toHaveBeenCalledTimes(1);
        const arg = JSON.stringify(reg.guardar.mock.calls[0]);
        expect(arg).toContain('coach-1');
        expect(enviados.texto.at(-1)).toMatch(/guard/i);
        expect(atencion.debeAtender).not.toHaveBeenCalled();
    });

    it('un mensaje de staff que NO es de asistencia sigue el flujo normal (sin identificar al staff)', async () => {
        await handleBotTurn(req, INTEGRATION, 'conv-1', texto('Hola buenas tardes'));
        expect(db.staffRpc).toBe(0);
        expect(atencion.debeAtender).toHaveBeenCalledTimes(1);
        expect(enviados.texto).toHaveLength(0);
    });

    it('familia que escribe «3» o «todos»: se identifica UNA vez (cache 5 min) y el bot sigue normal', async () => {
        db.esStaff = false;
        await handleBotTurn(req, INTEGRATION, 'conv-9', texto('todos'));
        await handleBotTurn(req, INTEGRATION, 'conv-9', texto('3'));
        await handleBotTurn(req, INTEGRATION, 'conv-9', texto('lista'));
        expect(db.staffRpc).toBe(1);
        expect(atencion.debeAtender).toHaveBeenCalledTimes(3);
        expect(enviados.texto).toHaveLength(0);
        expect(enviados.botones).toHaveLength(0);
    });

    it('con la baja pedida (optedOut) no corre la asistencia', async () => {
        await handleBotTurn(req, INTEGRATION, 'conv-1', texto('lista'), true);
        expect(db.staffRpc).toBe(0);
        expect(enviados.botones).toHaveLength(0);
    });
});
