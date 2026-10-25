import { describe, expect, it } from 'vitest';
import {
    clasesDelMes, mesAnteriorBogota, propuestaDePlan, razonLegible, rangoMes, restarMeses, resumirAsistenciaMes,
    nombrePlan, pesos, type PlanTier, type RegistroAsistencia,
} from './plan-por-asistencia.service';
import { claveAviso, decidirAviso, textoAviso, type ContextoAviso } from './plan-por-asistencia-aviso.service';

const P = (id: string, name: string, price: number, max: number | null, is_active = true): PlanTier => ({ id, name, price, max_sessions: max, is_active });
const BASIC = P('basic', 'PLAN  BASIC SENIORS -4 CLASES AL MES ', 90000, 4);
const START = P('start', 'PLAN START ', 90000, 4);
const SEN8 = P('sen8', 'SENIORS 8 Clases', 130000, 8);
const PRO = P('pro', 'PLAN PRO', 150000, 8);
const ELITE = P('elite', 'PLAN ELITE ', 180000, 12);
const DYN = P('dyn', 'PLAN DYNASTY ', 210000, 16);
const SEL = P('sel', 'PLAN SELECCION DYNASTY', 250000, null);
const PLANES = [BASIC, START, SEN8, PRO, ELITE, DYN, SEL];

const prop = (actual: PlanTier | null, clases: Array<number | null>, extra: object = {}) =>
    propuestaDePlan({ planActual: actual, planes: PLANES, clasesPorMes: clases, ...extra });

describe('propuestaDePlan: sube', () => {
    it('8 clases en PRO (8) → nada; 9 → ELITE', () => {
        expect(prop(PRO, [8, 8])).toEqual({ tipo: 'nada', motivo: 'dentro_del_plan' });
        expect(prop(PRO, [9])).toMatchObject({ tipo: 'cambiar', direction: 'up', plan: { id: 'elite' } });
    });
    it('12 clases en PRO → ELITE (el más barato con tope >= 12), no DYNASTY', () => {
        expect(prop(PRO, [12])).toMatchObject({ plan: { id: 'elite' } });
    });
    it('13 clases en PRO → DYNASTY', () => {
        expect(prop(PRO, [13])).toMatchObject({ plan: { id: 'dyn' } });
    });
    it('más clases que el plan más alto con tope → nada (SELECCIÓN no es candidato)', () => {
        expect(prop(DYN, [20])).toEqual({ tipo: 'nada', motivo: 'sin_plan_superior' });
    });
    it('umbral: con umbral 1, 9 clases en PRO no sube; 10 sí', () => {
        expect(prop(PRO, [9], { umbral: 1 })).toMatchObject({ tipo: 'nada' });
        expect(prop(PRO, [10], { umbral: 1 })).toMatchObject({ tipo: 'cambiar', plan: { id: 'elite' } });
    });
    it('START y BASIC (mismo precio y clases) no se cambian entre sí', () => {
        expect(prop(START, [4])).toMatchObject({ tipo: 'nada' });
        expect(prop(START, [5])).toMatchObject({ tipo: 'cambiar', direction: 'up', plan: { id: 'sen8' } });
    });
    it('SENIORS 8 con 9 clases sube a ELITE (no a PRO, que tiene el mismo tope)', () => {
        expect(prop(SEN8, [9])).toMatchObject({ plan: { id: 'elite' } });
    });
    it('empate de precio entre candidatos: elige el de menor tope', () => {
        const a = P('a', 'A', 100000, 10);
        const b = P('b', 'B', 100000, 12);
        expect(propuestaDePlan({ planActual: START, planes: [START, a, b], clasesPorMes: [9] })).toMatchObject({ plan: { id: 'a' } });
    });
    it('plan inactivo no es candidato', () => {
        const r = propuestaDePlan({ planActual: PRO, planes: [PRO, P('e', 'E', 180000, 12, false), DYN], clasesPorMes: [10] });
        expect(r).toMatchObject({ plan: { id: 'dyn' } });
    });
});

describe('propuestaDePlan: baja y exclusiones', () => {
    it('0 clases en un mes de la ventana no baja de plan (ausente o planilla incompleta)', () => {
        expect(prop(ELITE, [0, 3])).toEqual({ tipo: 'nada', motivo: 'baja_sin_clases_en_la_ventana' });
        expect(prop(PRO, [3, 0])).toEqual({ tipo: 'nada', motivo: 'baja_sin_clases_en_la_ventana' });
    });
    it('ELITE con 8 clases un solo mes → no baja (sin 2 meses)', () => {
        expect(prop(ELITE, [8])).toEqual({ tipo: 'nada', motivo: 'baja_sin_meses_suficientes' });
    });
    it('ELITE con 8 y 7 clases (dos meses seguidos) → baja al más barato con tope >= 8', () => {
        expect(prop(ELITE, [8, 7])).toMatchObject({ tipo: 'cambiar', direction: 'down', plan: { id: 'sen8' } });
    });
    it('ELITE con 8 y 11 → no baja (un mes por encima del plan inferior)', () => {
        expect(prop(ELITE, [8, 11])).toEqual({ tipo: 'nada', motivo: 'baja_aun_no_sostenida' });
    });
    it('un mes de la ventana sin asistencia registrada → no baja', () => {
        expect(prop(ELITE, [8, null])).toEqual({ tipo: 'nada', motivo: 'baja_sin_meses_suficientes' });
    });
    it('ELITE con 9 clases (entre 8 y 12) → se queda', () => {
        expect(prop(ELITE, [9, 9])).toEqual({ tipo: 'nada', motivo: 'dentro_del_plan' });
    });
    it('baja_meses=1 baja de inmediato; baja_meses=3 exige 3', () => {
        expect(prop(ELITE, [7], { bajaMeses: 1 })).toMatchObject({ direction: 'down' });
        expect(prop(ELITE, [7, 7], { bajaMeses: 3 })).toMatchObject({ motivo: 'baja_sin_meses_suficientes' });
        expect(prop(ELITE, [7, 7, 6], { bajaMeses: 3 })).toMatchObject({ direction: 'down' });
    });
    it('DYNASTY con 12 y 10 clases → baja a ELITE (cabe 12)', () => {
        expect(prop(DYN, [12, 10])).toMatchObject({ direction: 'down', plan: { id: 'elite' } });
    });
    it('plan mínimo (4 clases) no baja', () => {
        expect(prop(START, [1, 1])).toEqual({ tipo: 'nada', motivo: 'sin_plan_inferior' });
    });
    it('PRO con pocas clases no baja a SENIORS 8 (mismo tope) sino a un plan de 4', () => {
        expect(prop(PRO, [3, 2])).toMatchObject({ direction: 'down', plan: { max_sessions: 4 } });
    });
    it('mes sin sesiones registradas → no se propone nada (no es 0 clases)', () => {
        expect(prop(PRO, [null, null])).toEqual({ tipo: 'nada', motivo: 'sin_asistencia_del_mes' });
    });
    it('SELECCIÓN (sin tope) no se calcula', () => {
        expect(prop(SEL, [20, 20])).toEqual({ tipo: 'nada', motivo: 'plan_sin_tope' });
    });
    it('cuota manual (beca) se salta', () => {
        expect(prop(PRO, [12], { feeIsManual: true })).toEqual({ tipo: 'nada', motivo: 'cuota_manual' });
    });
    it('plan no encontrado', () => {
        expect(prop(null, [12])).toEqual({ tipo: 'nada', motivo: 'plan_no_encontrado' });
    });
});

const reg = (over: Partial<RegistroAsistencia>): RegistroAsistencia => ({
    child_id: 'c1', user_id: null, unregistered_athlete_id: null, team_id: 't1', attendance_date: '2026-09-03', status: 'present', ...over,
});

describe('conteo de asistencia', () => {
    it('cuenta present y late, distintos días; absent no; un día repetido cuenta 1', () => {
        const r = resumirAsistenciaMes([
            reg({ attendance_date: '2026-09-01' }), reg({ attendance_date: '2026-09-01', status: 'late' }),
            reg({ attendance_date: '2026-09-03', status: 'late' }), reg({ attendance_date: '2026-09-05', status: 'absent' }),
        ]);
        expect(r.clasesPorAtleta.get('child_id:c1')).toBe(2);
    });
    it('también por unregistered_athlete_id y user_id', () => {
        const r = resumirAsistenciaMes([
            reg({ child_id: null, unregistered_athlete_id: 'u1' }), reg({ child_id: null, user_id: 'p1' }),
        ]);
        expect(r.clasesPorAtleta.get('unregistered_athlete_id:u1')).toBe(1);
        expect(r.clasesPorAtleta.get('user_id:p1')).toBe(1);
    });
    it('equipo con registros y atleta sin asistencias = 0 clases; equipo sin registros = null', () => {
        const r = resumirAsistenciaMes([reg({ child_id: 'otro' })]);
        expect(clasesDelMes(r, 'child_id:c1', 't1')).toBe(0);
        expect(clasesDelMes(r, 'child_id:c1', 't2')).toBeNull();
    });
    it('sin equipo: hay datos solo si el propio atleta tiene registro', () => {
        const r = resumirAsistenciaMes([reg({ status: 'absent' })]);
        expect(clasesDelMes(r, 'child_id:c1', null)).toBe(0);
        expect(clasesDelMes(r, 'child_id:zz', null)).toBeNull();
    });
    it('mes completamente vacío (como oct-2026 en Dynasty) → null para todos', () => {
        expect(clasesDelMes(resumirAsistenciaMes([]), 'child_id:c1', 't1')).toBeNull();
    });
});

describe('fechas y textos', () => {
    it('mes anterior en Bogotá, incluido el cambio de año y la medianoche UTC', () => {
        expect(mesAnteriorBogota(new Date('2026-10-01T11:00:00Z'))).toEqual({ year: 2026, month: 9 });
        expect(mesAnteriorBogota(new Date('2027-01-01T06:00:00Z'))).toEqual({ year: 2026, month: 12 });
        // 1-oct 02:00 UTC = 30-sep 21:00 Bogotá: el mes en curso es septiembre, el anterior agosto
        expect(mesAnteriorBogota(new Date('2026-10-01T02:00:00Z'))).toEqual({ year: 2026, month: 8 });
    });
    it('rangoMes y restarMeses', () => {
        expect(rangoMes(2026, 12)).toEqual({ desde: '2026-12-01', hasta: '2027-01-01' });
        expect(restarMeses(2026, 1, 1)).toEqual({ year: 2025, month: 12 });
        expect(restarMeses(2026, 9, 0)).toEqual({ year: 2026, month: 9 });
    });
    it('nombres y razón legible', () => {
        expect(nombrePlan(BASIC)).toBe('BASIC SENIORS');
        expect(nombrePlan(PRO)).toBe('PRO');
        expect(pesos(180000)).toBe('$180.000');
        expect(razonLegible(12, 9, PRO, ELITE, 'up')).toBe('tomó 12 clases en septiembre; su plan PRO incluye 8');
        expect(razonLegible(1, 9, PRO, ELITE, 'up')).toContain('1 clase en');
    });
});

describe('aviso a la familia', () => {
    const p = { child_id: 'c1', user_id: null, unregistered_athlete_id: null, period_year: 2026, period_month: 10 };
    const ctx = (o: Partial<ContextoAviso> = {}): ContextoAviso => ({
        modo: 'auto', destinatarioUserId: 'u1', clavesYaAvisadas: new Set(), contactadaHoy: false, canalUltimaSemana: null, ...o,
    });
    it('texto corto con primer nombre, mes, plan y precio', () => {
        const t = textoAviso({ atleta: 'Sofía Pérez', clases_mes: 12, period_month: 10, to_plan: 'PLAN ELITE ', to_amount: 180000, from_plan: 'PLAN PRO', direction: 'up' });
        expect(t.mensaje).toBe('Sofía tomó 12 clases en octubre: su plan pasa a ELITE, $180.000 al mes.');
    });
    it('en modo sombra o apagado nunca se avisa', () => {
        expect(decidirAviso(p, ctx({ modo: 'sombra' }))).toEqual({ enviar: false, motivo: 'modo_no_auto' });
        expect(decidirAviso(p, ctx({ modo: 'apagado' }))).toEqual({ enviar: false, motivo: 'modo_no_auto' });
    });
    it('en auto avisa por in-app con clave estable', () => {
        expect(decidirAviso(p, ctx())).toEqual({ enviar: true, canal: 'inapp', clave: claveAviso('child_id:c1', 2026, 10) });
    });
    it('sin destinatario, ya avisado, contactada hoy o canal de la semana WhatsApp → no', () => {
        expect(decidirAviso(p, ctx({ destinatarioUserId: null }))).toMatchObject({ motivo: 'sin_destinatario' });
        expect(decidirAviso(p, ctx({ clavesYaAvisadas: new Set([claveAviso('child_id:c1', 2026, 10)]) }))).toMatchObject({ motivo: 'ya_avisado' });
        expect(decidirAviso(p, ctx({ contactadaHoy: true }))).toMatchObject({ motivo: 'contactada_hoy' });
        expect(decidirAviso(p, ctx({ canalUltimaSemana: 'whatsapp' }))).toMatchObject({ motivo: 'canal_semana_whatsapp' });
    });
});
