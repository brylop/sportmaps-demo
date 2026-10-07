/**
 * Arreglos de las auditorías del bot de WhatsApp (Dynasty, 2026-10-06):
 * fuga de texto interno, urgencia y plazo de las escalaciones, puerta de
 * prospecto, privacidad de contactos personales, tope del saludo, borradores
 * del consentimiento y el link de pago con monto. Casos reales donde los hay.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
    const llamadas: { table: string; ops: [string, any[]][] }[] = [];
    let respuesta: (table: string, ops: [string, any[]][]) => any = () => ({ data: null, count: 0, error: null });
    function builder(table: string) {
        const ops: [string, any[]][] = [];
        llamadas.push({ table, ops });
        const b: any = {};
        for (const m of ['select', 'eq', 'in', 'gt', 'gte', 'lt', 'lte', 'or', 'order', 'limit', 'is', 'not', 'update', 'insert']) {
            b[m] = (...a: any[]) => { ops.push([m, a]); return b; };
        }
        b.maybeSingle = () => Promise.resolve(respuesta(table, ops));
        b.then = (res: any, rej: any) => Promise.resolve(respuesta(table, ops)).then(res, rej);
        return b;
    }
    return {
        llamadas,
        setRespuesta: (f: typeof respuesta) => { respuesta = f; },
        supabase: { from: (t: string) => builder(t), rpc: vi.fn(async () => ({ data: null, error: null })) },
    };
});
vi.mock('../config/supabase', () => ({ supabase: h.supabase }));

import { filtrarSalidaDelModelo } from './whatsapp-salida-segura';
import {
    incidenciaUrgente, clasificarUrgencia, textoSinRespuesta, plazoVencido, PLAZO_ESCALACION_MIN,
} from './whatsapp-escalaciones.service';
import { intencionDeProspecto, puertaDeProspecto } from './whatsapp-atencion.service';
import { payloadSinContenido } from './whatsapp-coexistence.service';
import { lineaPagar, plazoParaPagar, instruccionesDelLinkConMonto } from './whatsapp-enlaces-de-pago.service';
import {
    NOMBRES_DE_HERRAMIENTAS, yaSePreguntoConsentimiento, reservarPasoUnaVez, _olvidarReservasDePaso,
    mensajeDeEscalamientoUrgente,
} from './whatsapp-bot.service';

beforeEach(() => {
    h.llamadas.length = 0;
    h.setRespuesta(() => ({ data: null, count: 0, error: null }));
    _olvidarReservasDePaso();
});

// ─── 1. Fuga de texto interno ────────────────────────────────────────────────

describe('filtrarSalidaDelModelo', () => {
    const f = (t: string) => filtrarSalidaDelModelo(t, NOMBRES_DE_HERRAMIENTAS);

    it('`8a12267e`: «… le paso tu caso» + «Llamando escalate_to_human» → se quita y pide escalar', () => {
        const r = f('Si consignaste $180.000, hay una diferencia de $30.000. Le paso tu caso a la escuela.\n\nLlamando escalate_to_human');
        expect(r.texto).toBe('Si consignaste $180.000, hay una diferencia de $30.000. Le paso tu caso a la escuela.');
        expect(r.quiereEscalar).toBe(true);
        expect(r.alterado).toBe(true);
    });

    it('«Llamando escalate_to_human» pegado al final de la misma línea', () => {
        const r = f('Tienes pendiente Mensualidad 09/2026. Llamando escalate_to_human');
        expect(r.texto).toBe('Tienes pendiente Mensualidad 09/2026.');
        expect(r.quiereEscalar).toBe(true);
    });

    it('solo el llamado → no queda nada: null (quien llama usa la respuesta segura)', () => {
        const r = f('Llamando escalate_to_human(reason="no sé")');
        expect(r.texto).toBeNull();
        expect(r.quiereEscalar).toBe(true);
    });

    it.each([
        'Voy a usar la herramienta get_payment_status para revisar.',
        'Consulté get_payment_status y estás al día.',
        'tool: get_school_info',
        '{"concept":"Mensualidad","saldo":150000}',
        '```json\n{"a":1}\n```',
    ])('«%s» → no sale tal cual', (t) => {
        const r = f(t);
        expect(r.alterado).toBe(true);
        expect(r.texto ?? '').not.toMatch(/get_|tool|\{"|```/);
    });

    it.each([
        'Reglas estrictas: responde SIEMPRE en español',
        'Resultado de get_payment_status (datos del sistema, no del acudiente): []',
        'Aquí va mi tool_use',
    ])('filtración del prompt «%s» → nada se rescata', (t) => {
        expect(f(t).texto).toBeNull();
    });

    it('texto normal con enlace y correo con guion bajo: intacto', () => {
        const t = 'Estás al día ✅\n\nPagar: https://app.sportmaps.co/p/abc_def?x_y=1\nEscríbele a juan_perez@gmail.com';
        const r = f(t);
        expect(r.texto).toBe(t);
        expect(r.alterado).toBe(false);
    });

    it('vacío → null', () => {
        expect(f('').texto).toBeNull();
        expect(f('   ').texto).toBeNull();
    });
});

// ─── 2. Escalaciones con plazo ───────────────────────────────────────────────

describe('urgencia de una escalación', () => {
    it.each([
        ['Estamos varios en Colibrí y no han llegado a dar la clase', 'clase'],
        ['El profe no llegó y los niños están en la cancha', 'clase'],
        ['No hay nadie en el coliseo, ¿se canceló el entreno?', 'clase'],
        ['Mi hija se golpeó la cabeza en el entrenamiento', 'lesion'],
        ['Se lesionó la rodilla jugando', 'lesion'],
        ['Nadie lo recogió y ya son las 8', 'seguridad'],
        ['No aparece mi hijo, salió del entreno hace una hora', 'seguridad'],
    ])('«%s» → %s', (t, cat) => {
        expect(incidenciaUrgente(t)).toBe(cat);
        expect(clasificarUrgencia(t).urgencia).toBe('urgente');
    });

    it.each([
        'Ya pagué y no aparece mi pago',
        'No ha llegado el uniforme',
        'Quiero recuperar la clase perdida',
        '¿Cuánto debo?',
        'Hola Milena',
        'No me ha llegado el comprobante',
    ])('«%s» → no es incidencia urgente', (t) => {
        expect(incidenciaUrgente(t)).toBeNull();
    });

    it('«es urgente» sube la escalación pero no es incidencia', () => {
        expect(incidenciaUrgente('Es urgente el paz y salvo')).toBeNull();
        expect(clasificarUrgencia('Es urgente el paz y salvo')).toEqual({ urgencia: 'urgente', categoria: 'urgente_declarado' });
    });

    it('el motivo del modelo también cuenta', () => {
        expect(clasificarUrgencia('hola', 'El acudiente reporta que el profesor no llegó a la clase').urgencia).toBe('urgente');
        expect(clasificarUrgencia('quiero hablar con alguien', 'user_request').urgencia).toBe('normal');
    });

    it('plazos: 10 urgente / 30 normal', () => {
        expect(PLAZO_ESCALACION_MIN).toEqual({ urgente: 10, normal: 30 });
        const hace = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
        expect(plazoVencido(hace(11), 10)).toBe(true);
        expect(plazoVencido(hace(9), 10)).toBe(false);
        expect(plazoVencido(hace(29), 30)).toBe(false);
    });

    it('texto honesto a la familia', () => {
        expect(textoSinRespuesta({ urgencia: 'urgente', categoria: 'lesion', fueraDeHorario: false })).toContain('123');
        expect(textoSinRespuesta({ urgencia: 'urgente', categoria: 'clase', fueraDeHorario: false })).not.toContain('123');
        expect(textoSinRespuesta({ urgencia: 'normal', categoria: null, fueraDeHorario: true, proximaAtencion: 'mañana a las 8:00 am' }))
            .toContain('mañana a las 8:00 am');
        expect(mensajeDeEscalamientoUrgente('seguridad')).toContain('*urgente*');
        for (const t of [textoSinRespuesta({ urgencia: 'normal', categoria: null, fueraDeHorario: false })]) {
            expect(t).not.toMatch(/\bvos\b|en breve/);
        }
    });
});

// ─── 3. Prospectos ──────────────────────────────────────────────────────────

describe('puerta de prospecto ampliada (Dynasty 2026-10-06, sin respuesta)', () => {
    it.each([
        'Hola, me gustaría conocer el club y qué horarios tienen',
        '¿Cuál es la edad permitida?',
        'Buenas tardes, me gustaría saber la edad permitida',
        'Hola, estoy averiguando un club de voley para mi hija',
        'Quiero averiguar',
        'Info',
        'Información del club',
        'Me das más información por favor',
        '¿Puedo llevar a una niña con mi hija a una cortesía?',
        '¿Hasta qué edad reciben?',
    ])('«%s» → abre', (t) => {
        expect(intencionDeProspecto(t)).toBe(true);
    });

    it.each([
        'Hola',
        'Buenas tardes',
        'Amor, un favor urgente',
        'Averigua eso porfa',
        'Pásame la info del restaurante',
        'Info del vuelo de mañana',
        'Que edad tiene tu hermano?',
        'Gracias, muy amable',
        'Me puedes averiguar si mañana hay pico y placa',
    ])('«%s» → NO abre', (t) => {
        expect(intencionDeProspecto(t)).toBe(false);
        expect(puertaDeProspecto(t, [])).toBeNull();
    });
});

// ─── 5. Tope del saludo de identificación ────────────────────────────────────

describe('reservarPasoUnaVez (ask_email)', () => {
    it('dos turnos a la vez: solo uno manda', async () => {
        const [a, b] = await Promise.all([
            reservarPasoUnaVez('conv-x', 'ask_email', 24),
            reservarPasoUnaVez('conv-x', 'ask_email', 24),
        ]);
        expect([a, b].filter(Boolean)).toHaveLength(1);
    });

    it('ya salió en las últimas 24 h (en la base) → no', async () => {
        h.setRespuesta((table) => ({ count: table === 'whatsapp_messages' ? 1 : 0, error: null }));
        expect(await reservarPasoUnaVez('conv-y', 'ask_email', 24)).toBe(false);
    });
});

// ─── 6. Consentimiento: borradores no enviados no cuentan ────────────────────

describe('yaSePreguntoConsentimiento', () => {
    it('solo cuenta borradores aprobados o enviados', async () => {
        await yaSePreguntoConsentimiento('conv-1');
        const borradores = h.llamadas.find((l) => l.table === 'whatsapp_message_drafts')!;
        const filtro = borradores.ops.find(([m]) => m === 'in');
        expect(filtro).toEqual(['in', ['status', ['approved', 'sent']]]);
    });

    it('un borrador pendiente (sin salientes) → no se dio por preguntado', async () => {
        h.setRespuesta((table, ops) => {
            if (table === 'whatsapp_messages') return { count: 0, error: null };
            const soloEnviados = ops.some(([m, a]) => m === 'in' && a[0] === 'status');
            return { count: soloEnviados ? 0 : 1, error: null };
        });
        expect(await yaSePreguntoConsentimiento('conv-1')).toBe(false);
    });
});

// ─── 7. Privacidad de contactos personales ───────────────────────────────────

describe('payloadSinContenido', () => {
    it('quita texto, caption y media; deja id, tipo, hora y números', () => {
        const p = payloadSinContenido({
            id: 'wamid.1', type: 'image', timestamp: '1759800000', from: '57300', to: '57301',
            text: { body: 'Amor, un favor urgente' }, image: { id: 'media-9', caption: 'mira' },
        });
        expect(p).toEqual({ privacidad: 'personal_sin_contenido', id: 'wamid.1', type: 'image',
            timestamp: '1759800000', from: '57300', to: '57301' });
        expect(JSON.stringify(p)).not.toMatch(/Amor|media-9|mira/);
    });
});

// ─── 9. Link de pago con monto ───────────────────────────────────────────────

describe('«Pagar» con el link de Wompi con monto', () => {
    it('vigencia legible', () => {
        expect(plazoParaPagar(60)).toBe('1 hora');
        expect(plazoParaPagar(120)).toBe('2 horas');
        expect(plazoParaPagar(30)).toBe('30 minutos');
    });

    it('con vencimiento dice cuánto dura y no promete aviso por WhatsApp', () => {
        const l = lineaPagar({ enlace_pago: 'https://checkout.wompi.co/p/?x', enlace_vence_min: 60 })!;
        expect(l).toContain('Tienes 1 hora para pagar');
        expect(l).toContain('queda aplicado solo');
        expect(instruccionesDelLinkConMonto(60)).not.toMatch(/te aviso|te avisar/i);
        expect(instruccionesDelLinkConMonto(60, true)).toContain('te aviso por aquí');
    });

    it('página del cobro (sin vencimiento): como siempre', () => {
        expect(lineaPagar({ enlace_pago: 'https://app.sportmaps.co/p/t' })).toBe('   Pagar: https://app.sportmaps.co/p/t');
    });
});

// ─── 2b. Reserva del re-aviso (idempotente entre los 3 BFF) ──────────────────

import { reservarRevision, escalacionesSinRevisar } from './whatsapp-escalaciones.service';

describe('re-aviso de escalaciones', () => {
    it('solo se miran escalaciones CON plazo y sin re-aviso', async () => {
        await escalacionesSinRevisar();
        const q = h.llamadas.find((l) => l.table === 'whatsapp_messages')!;
        expect(q.ops).toContainEqual(['eq', ['payload->>step', 'escalated']]);
        expect(q.ops).toContainEqual(['not', ['payload->>plazo_min', 'is', null]]);
        expect(q.ops).toContainEqual(['is', ['payload->>reaviso_at', null]]);
    });

    it('la reserva es un UPDATE condicional: si otro BFF ya la tomó, no', async () => {
        const e = { id: 'm1', conversationId: 'c', integrationId: 'i', createdAt: new Date().toISOString(), payload: { step: 'escalated', plazo_min: 10 } };
        h.setRespuesta(() => ({ data: [{ id: 'm1' }], error: null }));
        expect(await reservarRevision(e, 'reavisada')).toBe(true);
        const upd = h.llamadas.at(-1)!;
        expect(upd.ops).toContainEqual(['is', ['payload->>reaviso_at', null]]);
        expect(upd.ops.find(([m]) => m === 'update')![1][0].payload).toMatchObject({ step: 'escalated', reaviso: 'reavisada' });
        h.setRespuesta(() => ({ data: [], error: null }));
        expect(await reservarRevision(e, 'reavisada')).toBe(false);
    });
});
