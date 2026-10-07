/**
 * Informe de cartera (services/informe-cartera.service).
 *
 * Lo que se vigila:
 *   · morosos por familia: dos hermanos con el mismo acudiente = una familia;
 *     días de mora, meses adeudados, total y orden por monto;
 *   · anulados/rechazados no entran (solo llegan vivos), parcial cuenta saldo;
 *   · atleta dado de baja: su cobro vivo NO es mora, va a «bajas con saldo»;
 *   · pendientes del mes en curso y comprobantes en revisión;
 *   · inactividad solo en equipos que toman asistencia;
 *   · activación por escuela (NULL = automático según la cancelación);
 *   · periodo semanal (lunes COT) y kill-switch;
 *   · CSV sin fórmulas inyectables.
 *
 * Cero red: Supabase y correo moqueados.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
    reservas: new Set<string>(),
    enviados: [] as any[],
}));

vi.mock('../config/supabase', () => ({ supabase: { from: () => { throw new Error('sin base en esta prueba'); } } }));

vi.mock('./avisos-correo.service', async (orig) => {
    const real = await orig<typeof import('./avisos-correo.service')>();
    return {
        ...real,
        destinatariosDeEscuela: vi.fn(async () => ({ escuela: 'Club', correos: ['duena@club.co'] })),
        enviarConReserva: vi.fn(async (p: any) => {
            if (estado.reservas.has(p.clave)) return 'duplicado';
            estado.reservas.add(p.clave);
            estado.enviados.push(p);
            return 'enviado';
        }),
    };
});

import {
    atletasSinAsistencia, claveInforme, construirInforme, esHoraDelInforme, informeACsv, informeActivo,
    informeVacio, lineaResumenDiario, lunesDeLaSemana, runInformeCarteraSemanal, htmlInforme,
    type DatosCartera, type PagoCartera,
} from './informe-cartera.service';

const HOY = '2026-10-07';

function pago(p: Partial<PagoCartera> & { id: string }): PagoCartera {
    return {
        parent_id: null, user_id: null, child_id: null, unregistered_athlete_id: null,
        concept: 'Mensualidad', amount: 150000, amount_paid: 0, status: 'pending', due_date: null,
        payment_type: 'subscription', payment_category: 'mensualidad', period_year: null, period_month: null,
        ...p,
    };
}

function datos(pagos: PagoCartera[], extra: Partial<DatosCartera> = {}): DatosCartera {
    return {
        schoolId: 'esc-1',
        escuela: 'Club Prueba',
        pagos,
        duplicadosExcluidos: 0,
        hijos: new Map([
            ['h1', { id: 'h1', full_name: 'Ana Hija', is_active: true, parent_id: 'pa1' }],
            ['h2', { id: 'h2', full_name: 'Beto Hijo', is_active: true, parent_id: 'pa1' }],
            ['h3', { id: 'h3', full_name: 'Caro Sola', is_active: true, parent_id: null, parent_name_temp: 'Doña Temp', parent_phone_temp: '3001112233' }],
            ['h4', { id: 'h4', full_name: 'Dani Baja', is_active: false, parent_id: 'pa2', updated_at: '2026-09-20T10:00:00Z' }],
            ['h5', { id: 'h5', full_name: 'Eli Vieja', is_active: false, parent_id: 'pa2', updated_at: '2026-05-01T10:00:00Z' }],
        ]),
        noRegistrados: new Map(),
        perfiles: new Map([
            ['pa1', { id: 'pa1', full_name: 'Papá Uno', email: 'uno@x.co', phone: '3000000001' }],
            ['pa2', { id: 'pa2', full_name: 'Mamá Dos', email: 'dos@x.co', phone: null }],
            ['ad1', { id: 'ad1', full_name: 'Adulto Atleta', email: 'ad@x.co', phone: null }],
        ]),
        membresiasAtleta: new Map([['ad1', [{ status: 'active' }]]]),
        asistencia: null,
        ...extra,
    };
}

describe('construirInforme — morosos', () => {
    const pagos = [
        // Familia pa1: dos hijos, agosto y septiembre vencidos + una inscripción.
        pago({ id: 'p1', child_id: 'h1', status: 'overdue', due_date: '2026-08-10', period_year: 2026, period_month: 8 }),
        pago({ id: 'p2', child_id: 'h2', status: 'overdue', due_date: '2026-09-10', period_year: 2026, period_month: 9 }),
        pago({ id: 'p3', child_id: 'h1', status: 'pending', due_date: '2026-09-15', concept: 'Inscripción 2026', payment_type: 'one_time', payment_category: null, amount: 80000 }),
        // Contacto temporal (sin cuenta): parcial, cuenta el saldo.
        pago({ id: 'p4', child_id: 'h3', status: 'partial', due_date: '2026-09-30', amount: 150000, amount_paid: 100000, period_year: 2026, period_month: 9 }),
        // Adulto que se paga solo.
        pago({ id: 'p5', user_id: 'ad1', status: 'overdue', due_date: '2026-09-05', amount: 200000, period_year: 2026, period_month: 9 }),
        // Por vencer este mes.
        pago({ id: 'p6', child_id: 'h1', status: 'pending', due_date: '2026-10-10', period_year: 2026, period_month: 10 }),
        // Mes que viene: no es «por vencer del mes».
        pago({ id: 'p7', child_id: 'h2', status: 'pending', due_date: '2026-11-10', period_year: 2026, period_month: 11 }),
        // Comprobante en revisión (vencido y todo): no es mora, está en revisión.
        pago({ id: 'p8', child_id: 'h3', status: 'awaiting_approval', due_date: '2026-09-10', updated_at: '2026-10-06T15:00:00Z' }),
        // Atleta dado de baja hace poco y otro hace mucho: no son mora.
        pago({ id: 'p9', child_id: 'h4', status: 'overdue', due_date: '2026-09-10' }),
        pago({ id: 'p10', child_id: 'h5', status: 'overdue', due_date: '2026-04-10', amount: 120000 }),
    ];
    const inf = construirInforme(datos(pagos), HOY, 'https://app.sportmaps.co/finances', 14);

    it('agrupa por familia y ordena por monto', () => {
        expect(inf.morosos.familias).toBe(3);
        const [primera] = inf.morosos.filas;
        expect(primera.familia).toBe('Papá Uno');
        expect(primera.total).toBe(380000);
        expect(primera.cobros).toBe(3);
        expect(primera.atletas).toEqual(['Ana Hija', 'Beto Hijo']);
        expect(primera.meses).toBe(2);
        expect(primera.diasMora).toBe(58); // 10-ago → 7-oct
        expect(primera.mensualidades).toBe(300000);
        expect(primera.otros).toBe(80000);
        expect(inf.morosos.filas.map((f) => f.total)).toEqual([380000, 200000, 50000]);
    });

    it('usa el contacto temporal cuando el acudiente no tiene cuenta, y el saldo del parcial', () => {
        const temp = inf.morosos.filas.find((f) => f.familia === 'Doña Temp')!;
        expect(temp.total).toBe(50000);
        expect(temp.telefono).toBe('3001112233');
    });

    it('totales, por mes y por antigüedad', () => {
        expect(inf.morosos.total).toBe(630000);
        expect(inf.morosos.atletas).toBe(4);
        expect(inf.morosos.porMes).toEqual([
            { mes: '2026-08', cobros: 1, total: 150000 },
            { mes: '2026-09', cobros: 4, total: 480000 },
        ]);
        expect(inf.morosos.porAntiguedad.map((t) => t.tramo)).toEqual(['1-30 días', '31-60 días']);
    });

    it('pendientes del mes en curso y comprobantes en revisión', () => {
        expect(inf.pendientes.porVencer.map((c) => c.vence)).toEqual(['2026-10-10']);
        expect(inf.pendientes.porVencerTotal).toBe(150000);
        expect(inf.pendientes.enRevision).toHaveLength(1);
        expect(inf.pendientes.enRevision[0].desde).toBe('2026-10-06T15:00:00Z');
    });

    it('el atleta dado de baja no es moroso: va a bajas con saldo (recientes con detalle, viejas resumidas)', () => {
        expect(inf.morosos.filas.some((f) => f.familia === 'Mamá Dos')).toBe(false);
        expect(inf.inactivos.bajasConSaldo).toEqual([
            { atleta: 'Dani Baja', familia: 'Mamá Dos', bajaAprox: '2026-09-20', cobros: 1, saldo: 150000 },
        ]);
        expect(inf.inactivos.bajasAntiguas).toEqual({ atletas: 1, saldo: 120000 });
    });

    it('línea para el resumen diario', () => {
        expect(lineaResumenDiario(inf)).toBe('cartera: 3 familia(s) en mora por $630.000, 1 comprobante(s) de pago en revisión');
    });

    it('el correo escapa nombres y lleva el enlace a la cartera', () => {
        const html = htmlInforme(construirInforme(datos([
            pago({ id: 'x', child_id: 'h1', status: 'overdue', due_date: '2026-09-01' }),
        ], { perfiles: new Map([['pa1', { id: 'pa1', full_name: '<script>x</script>' }]]) }), HOY, 'https://app.sportmaps.co/finances', 14));
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
        expect(html).toContain('https://app.sportmaps.co/finances');
    });

    it('sin nada vivo, el informe está vacío', () => {
        expect(informeVacio(construirInforme(datos([]), HOY, 'u', 14))).toBe(true);
    });
});

describe('atletasSinAsistencia', () => {
    const atletas = [
        { clave: 'child:a', nombre: 'Viene', equipos: ['t1'], equipo: 'Sub 12' },
        { clave: 'child:b', nombre: 'Dejó de venir', equipos: ['t1'], equipo: 'Sub 12' },
        { clave: 'child:c', nombre: 'Nunca vino', equipos: ['t1'], equipo: 'Sub 12' },
        { clave: 'child:d', nombre: 'Equipo sin planilla', equipos: ['t2'], equipo: 'Sub 15' },
    ];
    const registros = [
        { clave: 'child:a', team_id: 't1', fecha: '2026-10-01', status: 'present' },
        { clave: 'child:b', team_id: 't1', fecha: '2026-09-01', status: 'present' },
        { clave: 'child:b', team_id: 't1', fecha: '2026-10-01', status: 'absent' },
        { clave: 'child:d', team_id: 't2', fecha: '2026-08-01', status: 'present' },
    ];

    it('solo acusa en equipos que tomaron asistencia en la ventana', () => {
        const r = atletasSinAsistencia(atletas, registros, HOY, 14);
        expect(r.conDatos).toBe(true);
        expect(r.filas.map((f) => f.atleta)).toEqual(['Nunca vino', 'Dejó de venir']);
        expect(r.filas[1]).toMatchObject({ ultimaAsistencia: '2026-09-01', dias: 36 });
    });

    it('sin registros en la ventana no hay datos (nadie queda como inactivo)', () => {
        const r = atletasSinAsistencia(atletas, registros.filter((x) => x.fecha < '2026-09-20'), HOY, 14);
        expect(r).toEqual({ conDatos: false, filas: [] });
    });
});

describe('activación y periodo', () => {
    it('NULL = automático: activo solo si la cancelación automática está apagada', () => {
        expect(informeActivo({ cartera_report_enabled: null, auto_cancel_overdue_enabled: false })).toBe(true);
        expect(informeActivo({ cartera_report_enabled: null, auto_cancel_overdue_enabled: true })).toBe(false);
        expect(informeActivo({ cartera_report_enabled: true, auto_cancel_overdue_enabled: true })).toBe(true);
        expect(informeActivo({ cartera_report_enabled: false, auto_cancel_overdue_enabled: false })).toBe(false);
        expect(informeActivo(null)).toBe(false);
    });

    it('el periodo es el lunes de la semana en hora de Colombia', () => {
        // Lunes 12-oct 07:10 COT = 12:10 UTC.
        expect(lunesDeLaSemana(new Date('2026-10-12T12:10:00Z'))).toBe('2026-10-12');
        // Domingo 18-oct 23:00 COT (lunes 04:00 UTC): sigue siendo la semana del 12.
        expect(lunesDeLaSemana(new Date('2026-10-19T04:00:00Z'))).toBe('2026-10-12');
        expect(claveInforme('e', '2026-10-12')).toBe('informe_cartera:e:2026-10-12');
    });

    it('solo los lunes desde las 7:00 COT', () => {
        expect(esHoraDelInforme(new Date('2026-10-12T12:00:00Z'))).toBe(true);  // lun 7:00
        expect(esHoraDelInforme(new Date('2026-10-12T11:59:00Z'))).toBe(false); // lun 6:59
        expect(esHoraDelInforme(new Date('2026-10-13T12:00:00Z'))).toBe(false); // mar
    });
});

describe('runInformeCarteraSemanal', () => {
    beforeEach(() => { delete process.env.DISABLE_INFORME_CARTERA; });

    it('kill-switch: no lee ni manda nada', async () => {
        process.env.DISABLE_INFORME_CARTERA = 'true';
        // Si leyera la base, el mock lanzaría.
        expect(await runInformeCarteraSemanal(new Date('2026-10-12T12:10:00Z'))).toEqual({});
    });

    it('fuera de horario no hace nada', async () => {
        expect(await runInformeCarteraSemanal(new Date('2026-10-13T12:10:00Z'))).toEqual({});
    });
});

describe('informeACsv', () => {
    it('separa con ; lleva BOM y neutraliza fórmulas', () => {
        const inf = construirInforme(datos([
            pago({ id: 'x', child_id: 'h1', status: 'overdue', due_date: '2026-09-01' }),
        ], { perfiles: new Map([['pa1', { id: 'pa1', full_name: '=HYPERLINK("x")', phone: '+57 300' }]]) }), HOY, 'u', 14);
        const csv = informeACsv(inf);
        expect(csv.startsWith('﻿')).toBe(true);
        expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
        expect(csv).toContain("'+57 300");
        expect(csv).toContain('Familia;Teléfono;Correo');
    });
});

describe('enviarPlantilla sin plantilla (avisos-correo)', () => {
    it('con tipo null manda el HTML propio, sin pasar por una plantilla de send-email', async () => {
        const { enviarPlantilla } = await import('./avisos-correo.service');
        const cuerpos: any[] = [];
        const fetchOrig = globalThis.fetch;
        globalThis.fetch = vi.fn(async (_u: any, init: any) => {
            cuerpos.push(JSON.parse(init.body));
            return new Response(JSON.stringify({ results: [{ id: 'm-1' }] }), { status: 200 });
        }) as any;
        try {
            const r = await enviarPlantilla(null, ['duena@club.co'], {}, { subject: 'Informe', titulo: 'T', lineas: ['no va'], html: '<table>x</table>' });
            expect(r).toEqual({ ok: true, messageId: 'm-1' });
            expect(cuerpos).toEqual([{ batch: [{ to: 'duena@club.co', subject: 'Informe', html: '<table>x</table>' }] }]);
        } finally {
            globalThis.fetch = fetchOrig;
        }
    });
});
