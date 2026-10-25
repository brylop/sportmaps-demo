/**
 * «Pago esperado» (spec whatsapp-conversacion-v2-dynasty §3.5). Los casos de los
 * montos que no cuadraban en Dynasty (2026-10-24): SIEMPRE menores al cobro,
 * porque la familia paga el plan viejo mientras el plan sube por clases
 * tomadas. Un monto menor es un ABONO; el plan nunca se cambia por el monto.
 */
import { describe, it, expect, vi } from 'vitest';

const selects: { table: string; cols: string }[] = [];
const filas: Record<string, any[]> = {};
vi.mock('../config/supabase', () => ({
    supabase: {
        from: (table: string) => {
            const c: any = {};
            c.select = (cols: string) => { selects.push({ table, cols }); return c; };
            for (const m of ['eq', 'in', 'or', 'limit', 'is']) c[m] = () => c;
            c.then = (ok: any, ko: any) => Promise.resolve({ data: filas[table] ?? [], error: null }).then(ok, ko);
            return c;
        },
    },
}));

import {
    cuotaVigente, conRecargoDeLink, armarCandidatos, proponerPorMonto, textoPropuesta, motivoConPropuesta,
    autoAprobacionPermitida, RECARGO_LINK_PCT, calcularCandidatosDePago, type DeportistaEsperado,
} from './whatsapp-pago-esperado.service';

const dep = (id: string, nombre: string, cuota: number | null, extra: Partial<DeportistaEsperado> = {}): DeportistaEsperado => ({
    id, tipo: 'child', nombre, cuota, fuenteCuota: cuota ? 'monthly_fee' : null,
    nombrePlan: null, precioPlan: null, inscripcion: null, parciales: [], ...extra,
});
const entrada = (monto: number | null, deportistas: DeportistaEsperado[], o: { destino?: boolean; noDup?: boolean } = {}) =>
    proponerPorMonto({
        monto, candidatos: armarCandidatos(deportistas), deportistasDeLaFamilia: deportistas.length,
        destinoDeLaEscuela: o.destino !== false, noDuplicado: o.noDup !== false,
    });

describe('cuotaVigente: monthly_fee → plan → equipo', () => {
    it('la cuota individual manda sobre el plan y el equipo', () => {
        expect(cuotaVigente({ monthlyFee: 180000, precioPlan: 150000, precioEquipo: 120000 })).toEqual({ cuota: 180000, fuente: 'monthly_fee' });
    });
    it('sin cuota individual, el precio del plan; sin plan, el del equipo', () => {
        expect(cuotaVigente({ monthlyFee: null, precioPlan: 150000, precioEquipo: 120000 })).toEqual({ cuota: 150000, fuente: 'plan' });
        expect(cuotaVigente({ monthlyFee: 0, precioPlan: null, precioEquipo: 120000 })).toEqual({ cuota: 120000, fuente: 'equipo' });
        expect(cuotaVigente({ monthlyFee: null, precioPlan: null, precioEquipo: null })).toEqual({ cuota: null, fuente: null });
    });
    it('beca (cuota 0 puesta a mano): no se espera nada y NO cae al plan', () => {
        expect(cuotaVigente({ monthlyFee: 0, feeIsManual: true, precioPlan: 150000, precioEquipo: null })).toEqual({ cuota: 0, fuente: 'monthly_fee' });
    });
});

describe('recargo del enlace de pago (5 %)', () => {
    it('180.000 → 189.000 (mismo redondeo del checkout)', () => {
        expect(RECARGO_LINK_PCT).toBe(5);
        expect(conRecargoDeLink(180000)).toBe(189000);
        expect(conRecargoDeLink(150000)).toBe(157500);
    });
    it('un monto igual a la cuota + 5 % es pago COMPLETO por el enlace, no abono ni sobrante', () => {
        const p = entrada(189000, [dep('c1', 'Sofía Pérez', 180000)]);
        expect(p.porRecargo).toBe(true);
        expect(p.candidato?.tipo).toBe('cuota_individual');
        expect(p.confianza).toBe('alta');
        expect(p.porQue).toContain('recargo del enlace de pago');
    });
});

describe('armarCandidatos', () => {
    it('cuota, precio del plan distinto, inscripción, saldo de un abonado y suma de hermanos', () => {
        const a = dep('c1', 'Sofía Pérez', 180000, { precioPlan: 150000, nombrePlan: 'PRO', inscripcion: 50000,
            parciales: [{ paymentId: 'p1', concepto: 'Mensualidad 09/2026', total: 150000, pagado: 100000 }] });
        const b = dep('c2', 'Tomás Pérez', 150000);
        const c = armarCandidatos([a, b]);
        const tipos = c.map((x) => `${x.tipo}:${x.monto}`);
        expect(tipos).toEqual(expect.arrayContaining([
            'cuota_individual:180000', 'precio_plan:150000', 'inscripcion:50000', 'saldo_parcial:50000',
            'cuota_individual:150000', 'suma_hermanos:330000',
        ]));
    });
    it('cuota == precio del plan: un solo candidato (no se duplica)', () => {
        const c = armarCandidatos([dep('c1', 'Sofía Pérez', 150000, { precioPlan: 150000 })]);
        expect(c.filter((x) => x.monto === 150000)).toHaveLength(1);
    });
    it('NUNCA incluye el precio de un plan AJENO al deportista (regla descartada: «el monto es el de otro plan → cambiar de plan»)', () => {
        const c = armarCandidatos([dep('c1', 'Sofía Pérez', 150000, { nombrePlan: 'PRO' })]);
        expect(c.map((x) => x.tipo)).toEqual(['cuota_individual']);
    });
});

describe('los montos MENORES de Dynasty son abonos: el plan no se cambia', () => {
    // [cobro/cuota, lo que pagó]
    const casos: [string, number, number][] = [
        ['Isabella', 180000, 150000], ['Valerie', 210000, 180000], ['Mariana', 150000, 90000],
        ['Sarah', 180000, 130000], ['Rodrigo', 130000, 90000], ['Alexander', 150000, 130000], ['Laurent', 90000, 45000],
    ];
    for (const [nombre, cuota, pago] of casos) {
        it(`${nombre}: pagó ${pago} de una cuota de ${cuota} → abono en revisión, saldo ${cuota - pago}`, () => {
            const p = entrada(pago, [dep('c1', `${nombre} Gómez`, cuota)]);
            expect(p.accion).toBe('abono_en_revision');
            expect(p.confianza).toBe('media');
            expect(p.saldo).toBe(cuota - pago);
            expect(p.candidato?.tipo).toBe('cuota_individual');
            expect(p.porQue).toContain('el plan NO se cambia');
            expect(textoPropuesta(p)).toContain('abono a');
            expect(textoPropuesta(p)).not.toMatch(/cambia(r)? de plan/i);
        });
    }
    it('aunque el monto sea EXACTAMENTE el precio de otro plan (130.000 con cuota de 150.000), es abono: nunca «cambia de plan»', () => {
        const p = entrada(130000, [dep('c1', 'Sofía Pérez', 150000, { nombrePlan: 'PRO' })]);
        expect(p.accion).toBe('abono_en_revision');
        expect(p.candidato?.etiqueta).not.toMatch(/SENIORS/i);
    });
    it('pagar el precio BASE del plan (150.000) cuando la cuota vigente subió a 180.000: abono, no «pago completo» ni cambio de plan', () => {
        const p = entrada(150000, [dep('c1', 'Isabella Gómez', 180000, { precioPlan: 150000, nombrePlan: 'PRO' })]);
        expect(p.accion).toBe('abono_en_revision');
        expect(p.confianza).toBe('media');
        expect(p.saldo).toBe(30000);
        expect(p.candidato?.tipo).toBe('cuota_individual');
        expect(p.porQue).toContain('el plan NO se cambia');
    });
    it('menos del 20 % de la cuota no es un abono: a la bandeja', () => {
        const p = entrada(20000, [dep('c1', 'Sofía Pérez', 150000)]);
        expect(p.accion).toBe('bandeja');
        expect(p.confianza).toBe('baja');
    });
    it('un abono nunca es confianza alta ni se aplica por el camino existente', () => {
        const p = entrada(150000, [dep('c1', 'Sofía Pérez', 180000)]);
        expect(p.confianza).not.toBe('alta');
        expect(p.accion).not.toBe('camino_existente');
    });
    it('menor a las cuotas de VARIOS hermanos: no se adivina de quién es el abono', () => {
        const p = entrada(100000, [dep('c1', 'Sofía Pérez', 150000), dep('c2', 'Tomás Pérez', 180000)]);
        expect(p.accion).toBe('bandeja');
        expect(p.alternativas).toHaveLength(2);
    });
});

describe('confianza', () => {
    it('ALTA: deportista único + monto exacto + destino de la escuela + no repetido → camino existente', () => {
        const p = entrada(180000, [dep('c1', 'Sofía Pérez', 180000)]);
        expect(p.confianza).toBe('alta');
        expect(p.accion).toBe('camino_existente');
    });
    it('destino ajeno o comprobante repetido bajan a media (se pregunta / se revisa)', () => {
        expect(entrada(180000, [dep('c1', 'Sofía Pérez', 180000)], { destino: false }).confianza).toBe('media');
        expect(entrada(180000, [dep('c1', 'Sofía Pérez', 180000)], { noDup: false }).confianza).toBe('media');
    });
    it('MEDIA: con hermanos, aunque el monto distinga a uno, se confirma de quién es (botones)', () => {
        const p = entrada(180000, [dep('c1', 'Sofía Pérez', 180000), dep('c2', 'Tomás Pérez', 150000)]);
        expect(p.confianza).toBe('media');
        expect(p.accion).toBe('preguntar');
        expect(p.candidato?.deportistas).toEqual(['Sofía Pérez']);
        expect(p.porQue).toContain('varios deportistas');
    });
    it('hermanos con la MISMA cuota: ambiguo → pregunta con las alternativas, sin candidato', () => {
        const p = entrada(150000, [dep('c1', 'Sofía Pérez', 150000), dep('c2', 'Tomás Pérez', 150000)]);
        expect(p.accion).toBe('preguntar');
        expect(p.candidato).toBeNull();
        expect(p.alternativas.map((a) => a.deportistas[0])).toEqual(['Sofía Pérez', 'Tomás Pérez']);
    });
    it('la suma exacta de los hermanos es UN candidato (alta si destino y no repetido)', () => {
        const p = entrada(330000, [dep('c1', 'Sofía Pérez', 180000), dep('c2', 'Tomás Pérez', 150000)]);
        expect(p.candidato?.tipo).toBe('suma_hermanos');
        expect(p.confianza).toBe('alta');
    });
    it('inscripción y saldo de un abonado se reconocen por monto', () => {
        const d = dep('c1', 'Sofía Pérez', 180000, { inscripcion: 50000, parciales: [{ paymentId: 'p1', concepto: 'Mensualidad 09/2026', total: 150000, pagado: 100000 }] });
        expect(entrada(50000, [{ ...d, parciales: [] }]).candidato?.tipo).toBe('inscripcion');
        // inscripción y saldo del mismo valor: ambiguo
        expect(entrada(50000, [d]).accion).toBe('preguntar');
        const saldo = entrada(50000, [{ ...d, inscripcion: null }]);
        expect(saldo.candidato?.tipo).toBe('saldo_parcial');
        // Un saldo de abono lo aplica una persona: nunca confianza alta.
        expect(saldo.confianza).toBe('media');
        expect(saldo.accion).toBe('bandeja');
    });
    it('baja: monto ilegible, sin candidatos, o monto que no calza con nada', () => {
        expect(entrada(null, [dep('c1', 'Sofía Pérez', 180000)]).accion).toBe('bandeja');
        expect(entrada(180000, []).accion).toBe('bandeja');
        const mayor = entrada(500000, [dep('c1', 'Sofía Pérez', 180000)]);
        expect(mayor.confianza).toBe('baja');
        expect(mayor.porQue).toContain('es mayor');
    });
});

describe('calcularCandidatosDePago (lectura)', () => {
    it('lee la cuota de enrollments con el hint de la FK a teams: sin él PostgREST responde PGRST201 (dos FKs a teams) y la lectura quedaba vacía en silencio', async () => {
        selects.length = 0;
        filas.children = [{ id: 'c1', full_name: 'Isabella Garzón' }];
        filas.enrollments = [{
            child_id: 'c1', unregistered_athlete_id: null, monthly_fee: 180000, fee_is_manual: false, status: 'active',
            plan: { name: 'PLAN ELITE', price: 180000, registration_fee: null }, team: { price_monthly: 0 },
        }];
        const r = await calcularCandidatosDePago({ schoolId: 's1', llaves: { childIds: ['c1'] }, monto: 150000 });
        expect(selects.find((s) => s.table === 'enrollments')!.cols).toContain('teams!enrollments_team_id_fkey(price_monthly)');
        expect(r.deportistas[0]).toMatchObject({ nombre: 'Isabella Garzón', cuota: 180000, fuenteCuota: 'monthly_fee' });
        expect(r.propuesta).toMatchObject({ accion: 'abono_en_revision', saldo: 30000 });
        delete filas.children; delete filas.enrollments;
    });
    it('sin inscripción activa (atleta dado de baja): no hay con qué calcular y va a la bandeja', async () => {
        filas.children = [{ id: 'c1', full_name: 'Natalia Aguirre' }];
        filas.enrollments = [];
        const r = await calcularCandidatosDePago({ schoolId: 's1', llaves: { childIds: ['c1'] }, monto: 180000 });
        expect(r.propuesta.accion).toBe('bandeja');
        expect(r.propuesta.porQue).toContain('no hay inscripción activa');
        delete filas.children; delete filas.enrollments;
    });
});

describe('motivoConPropuesta y autoaprobación', () => {
    it('el motivo original va primero y la propuesta nunca se recorta', () => {
        const base = 'monto_no_cuadra: ' + 'x'.repeat(600);
        const prop = 'Propuesta → deportista: Sofía Pérez · mes: octubre';
        const m = motivoConPropuesta(base, prop);
        expect(m.length).toBeLessThanOrEqual(500);
        expect(m.startsWith('monto_no_cuadra:')).toBe(true);
        expect(m.endsWith(prop)).toBe(true);
    });
    it('sin propuesta, el motivo tal cual (recortado a 500)', () => {
        expect(motivoConPropuesta('hola', null)).toBe('hola');
        expect(motivoConPropuesta('x'.repeat(700), undefined)).toHaveLength(500);
    });
    it('auto-aprobar solo si el ajuste de la escuela lo permite y el monto está bajo el tope; ante la duda, no', () => {
        expect(autoAprobacionPermitida({ auto_approve_enabled: true, auto_approve_max_amount: 200000 }, 180000)).toBe(true);
        expect(autoAprobacionPermitida({ auto_approve_enabled: true, auto_approve_max_amount: 100000 }, 180000)).toBe(false);
        expect(autoAprobacionPermitida({ auto_approve_enabled: false, auto_approve_max_amount: 200000 }, 180000)).toBe(false);
        expect(autoAprobacionPermitida({ auto_approve_enabled: true, auto_approve_max_amount: 0 }, 180000)).toBe(false);
        expect(autoAprobacionPermitida(null, 180000)).toBe(false);
        expect(autoAprobacionPermitida({ auto_approve_enabled: true, auto_approve_max_amount: 200000 }, null)).toBe(false);
    });
});
