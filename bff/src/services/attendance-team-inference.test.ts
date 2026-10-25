/**
 * Inferencia de equipo + cruce de nombres, con datos REALES de Dynasty:
 *  · horarios: teams.schedule (fixture sin datos personales);
 *  · hojas de septiembre: docs/dynasty-planillas-septiembre-2026/ (transcripción
 *    + cruce_asistencia.json). El roster de cada equipo sale de los atletas que el
 *    cruce manual encontró en la base (con su equipo REAL, también los que figuran
 *    en una hoja ajena: es el ruido que habrá en producción). Las hojas son mitades
 *    disjuntas de un mismo equipo, por eso no se puede dejar una hoja afuera. Si los
 *    docs no están, esos casos se saltan.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    puntuarNombre, mejorCoincidencia, inferirEquipo, franjasActivas, fechaSesionSugerida,
    cruzarConRoster, resumenPlanilla, relojColombia,
    type RosterEquipo, type AtletaRoster, type FilaPlanilla,
} from './attendance-team-inference';
import { interpretarMarca } from './attendance-sheet-ocr.service';
import { HORARIOS_DYNASTY } from './__fixtures__/dynasty-horarios';

const DIR = resolve(__dirname, '../../../docs/dynasty-planillas-septiembre-2026');
const hayDocs = existsSync(resolve(DIR, 'cruce_asistencia.json'));
const cargar = (f: string) => JSON.parse(readFileSync(resolve(DIR, f), 'utf-8'));

// Colombia = UTC-5 (sin horario de verano). 2026-10-20 es martes.
const col = (iso: string) => new Date(`${iso}-05:00`);

const rosterSimple = (id: string, name: string, nombres: string[]): RosterEquipo => ({
    team_id: id, team_name: name, atletas: nombres.map((n, i) => ({ id: `${id}-${i}`, nombre: n })),
});

describe('puntuarNombre — apellidos primero vs nombres primero', () => {
    it('reordena, ignora tildes y partículas', () => {
        expect(puntuarNombre('PEREZ JOSE DAVID', 'JOSE DAVID PEREZ CASTELLANOS')).toBeGreaterThanOrEqual(0.95);
        expect(puntuarNombre('DEL CAMPO VIOLETA', 'Violeta del Campo Garzón')).toBeGreaterThanOrEqual(0.95);
        expect(puntuarNombre('CORTES VASQUEZ DANA', 'Danna Sofía Cortés Vásquez')).toBeGreaterThanOrEqual(0.85);
        expect(puntuarNombre('ESCOBAR BENITES MARIA PAULA', 'MARIA PAULA ESCOBAR BENITEZ')).toBeGreaterThanOrEqual(0.9);
    });
    it('el apellido pesa: mismo nombre, otro apellido no pasa el umbral', () => {
        expect(puntuarNombre('GARCIA MARIA JOSE', 'Maria Jose Moreno Salas')).toBeLessThan(0.75);
        expect(puntuarNombre('CRUZ CATALINA', 'Catalina Pardo')).toBeLessThan(0.75);
    });
    it('apodo/abreviatura cuenta menos que el token completo', () => {
        const a = puntuarNombre('FONTECHA MALEJA', 'Maria Alejandra Fontecha Gonzalez');
        expect(a).toBeGreaterThan(0.5);
        expect(a).toBeLessThan(0.95);
    });
    it('duplicados casi idénticos en el roster → ambiguo', () => {
        const c = mejorCoincidencia('RAMIREZ SOFIA', [{ id: '1', nombre: 'Sofia Ramirez Diaz' }, { id: '2', nombre: 'Sofia Ramirez Luna' }]);
        expect(c.ambiguo).toBe(true);
    });
});

describe('interpretarMarca — leyenda de Milena 2026-10-05', () => {
    it.each(['✓', 'X', 'x', 'R', 'VR', '✓R', 'R✓', '/', 'VA', 'R tachada', 'R(tachada)', '✓(rojo)', 'x (azul)', 'X (tenue)', '✓(sobrescrito)'.replace('sobrescrito', 'rojo')])(
        '%s → asistió', (m) => expect(interpretarMarca(m)).toBe('asistio'));
    it.each(['', null, undefined, '  ', '-'])('vacío %s → sin marca (NO falta)', (m) => expect(interpretarMarca(m as any)).toBe('sin_marca'));
    it.each(['✓ tachado', 'X tachada', 'X(sobre ✓)', 'garabato', 'borron azul', 'Repetida', 'Incapacidad', 'Retirada', '29', 'C', 'Y', 'x (con tachon)'])(
        '%s → dudosa (no se interpreta)', (m) => expect(interpretarMarca(m)).toBe('dudosa'));
});

describe('horarios', () => {
    it('relojColombia: martes 17:30 hora Colombia', () => {
        expect(relojColombia(col('2026-10-20T17:30:00'))).toMatchObject({ dow: 2, min: 17 * 60 + 30, fecha: '2026-10-20' });
    });
    it('martes 17:30: franjas simultáneas en lugares distintos (Nueva Era Coliseo vs Menores Fem White Nido)', () => {
        const a = franjasActivas(HORARIOS_DYNASTY, col('2026-10-20T17:30:00'));
        const nombres = a.map((f) => `${f.team_name}${f.group ? ' · ' + f.group : ''}@${f.place}`);
        expect(nombres).toContain('NUEVA ERA@Coliseo Dynasty DC');
        expect(nombres).toContain('MENORES FEMENINO · White@Cancha externa Nido del Colibrí');
        expect(a.every((f) => f.team_id !== 'JUV-F')).toBe(true);
    });
    it('fuera de ±2 h no hay franja', () => {
        expect(franjasActivas(HORARIOS_DYNASTY, col('2026-10-20T03:00:00'))).toEqual([]);
    });
    it('foto el martes 21:00 sin fecha en la hoja → la sesión es la de hoy', () => {
        const nuevaEra = HORARIOS_DYNASTY.find((h) => h.team_id === 'N-ERA')!;
        expect(fechaSesionSugerida(nuevaEra.schedule, col('2026-10-20T21:00:00'))).toEqual({ fecha: '2026-10-20', origen: 'hoy' });
    });
    it('día sin clase → la última clase de los últimos 7 días; sin horario → hoy', () => {
        const sen = HORARIOS_DYNASTY.find((h) => h.team_id === 'SEN')!; // lun y jue
        expect(fechaSesionSugerida(sen.schedule, col('2026-10-21T10:00:00'))).toEqual({ fecha: '2026-10-19', origen: 'ultima_clase' }); // miércoles → lunes
        expect(fechaSesionSugerida(null, col('2026-10-21T10:00:00'))).toEqual({ fecha: '2026-10-21', origen: 'sin_horario' });
    });
});

describe('inferirEquipo — casos sintéticos', () => {
    const A = rosterSimple('A', 'NUEVA ERA', ['Ana Lopez Ruiz', 'Bea Mora Diaz', 'Cata Rey Paz', 'Dani Sol Vega', 'Eva Cruz Pena']);
    const B = rosterSimple('B', 'INTERMEDIO', ['Fani Gil Soto', 'Gabi Toro Mejia', 'Hana Luna Rios', 'Ivy Cano Ortiz', 'Juli Vera Pinto']);
    const hor = HORARIOS_DYNASTY;

    it('≥70 % de un equipo → ese, aunque el remitente sea coach de todos', () => {
        const r = inferirEquipo({
            nombresOCR: ['LOPEZ ANA', 'MORA BEA', 'REY CATA', 'SOL DANI', 'GIL FANI'], encabezadoOCR: null,
            ahora: col('2026-10-20T12:00:00'), rosters: [A, B], horarios: hor,
        });
        expect(r.team_id).toBe('A');
        expect(r.confianza).toBe('alta');
    });
    it('«Retirada»/vacíos no cuentan; nombre tachado no rompe', () => {
        const r = inferirEquipo({
            nombresOCR: ['LOPEZ ANA', 'MORA BEA', 'REY CATA', '', '   '], ahora: col('2026-10-20T12:00:00'),
            rosters: [A, B], horarios: hor,
        });
        expect(r.team_id).toBe('A');
    });
    it('hoja con dos equipos mezclados → partición por rosters', () => {
        const r = inferirEquipo({
            nombresOCR: ['LOPEZ ANA', 'MORA BEA', 'REY CATA', 'GIL FANI', 'TORO GABI', 'LUNA HANA'], ahora: col('2026-10-20T12:00:00'),
            rosters: [A, B], horarios: hor,
        });
        expect(r.team_id).toBeNull();
        expect(r.particion?.map((p) => p.team_id).sort()).toEqual(['A', 'B']);
        expect(r.particion!.find((p) => p.team_id === 'A')!.nombres).toHaveLength(3);
    });
    it('empate sin encabezado → desempata el horario (solo uno con clase ahora)', () => {
        // Mismo nombre en ambos rosters (ex-miembro): martes 17:30 solo NUEVA ERA (id N-ERA) tiene clase.
        const ne = rosterSimple('N-ERA', 'NUEVA ERA', ['Ana Lopez Ruiz', 'Bea Mora Diaz', 'Cata Rey Paz']);
        const mf = rosterSimple('SEN', 'SENIORS', ['Ana Lopez Ruiz', 'Bea Mora Diaz', 'Cata Rey Paz']);
        const r = inferirEquipo({
            nombresOCR: ['LOPEZ ANA', 'MORA BEA', 'REY CATA'], ahora: col('2026-10-20T17:30:00'),
            rosters: [ne, mf], horarios: hor,
        });
        expect(r.team_id).toBe('N-ERA');
        expect(r.confianza).toBe('media');
    });
    it('empate total sin pistas → pregunta con candidatos', () => {
        const ne = rosterSimple('N-ERA', 'NUEVA ERA', ['Ana Lopez Ruiz', 'Bea Mora Diaz', 'Cata Rey Paz']);
        const mf = rosterSimple('INF-F', 'INFANTIL FEMENINO', ['Ana Lopez Ruiz', 'Bea Mora Diaz', 'Cata Rey Paz']);
        const r = inferirEquipo({
            nombresOCR: ['LOPEZ ANA', 'MORA BEA', 'REY CATA'], ahora: col('2026-10-20T03:00:00'),
            rosters: [ne, mf], horarios: hor,
        });
        expect(r.team_id).toBeNull();
        expect(r.candidatos.map((c) => c.team_id).sort()).toEqual(['INF-F', 'N-ERA']);
    });
    it('el encabezado desempata cuando los nombres empatan', () => {
        const ne = rosterSimple('N-ERA', 'NUEVA ERA', ['Ana Lopez Ruiz', 'Bea Mora Diaz', 'Cata Rey Paz']);
        const mf = rosterSimple('INF-F', 'INFANTIL FEMENINO', ['Ana Lopez Ruiz', 'Bea Mora Diaz', 'Cata Rey Paz']);
        const r = inferirEquipo({
            nombresOCR: ['LOPEZ ANA', 'MORA BEA', 'REY CATA'], encabezadoOCR: 'ASISTENCIA SEPTIEMBRE - NUEVA ERA',
            ahora: col('2026-10-20T03:00:00'), rosters: [ne, mf], horarios: hor,
        });
        expect(r.team_id).toBe('N-ERA');
    });
    it('nombres ganan sobre un encabezado contradictorio, pero baja la confianza', () => {
        const r = inferirEquipo({
            nombresOCR: ['LOPEZ ANA', 'MORA BEA', 'REY CATA', 'SOL DANI'], encabezadoOCR: 'INTERMEDIO',
            ahora: col('2026-10-20T12:00:00'), rosters: [A, B], horarios: hor,
        });
        expect(r.team_id).toBe('A');
        expect(r.confianza).toBe('media');
        expect(r.motivo).toContain('INTERMEDIO');
    });
    it('JUVENIL MAYORES FEMENINO sin horario: igual se infiere por nombres', () => {
        const jf = rosterSimple('JUV-F', 'JUVENIL MAYORES FEMENINO', ['Ana Lopez Ruiz', 'Bea Mora Diaz', 'Cata Rey Paz', 'Dani Sol Vega']);
        const r = inferirEquipo({
            nombresOCR: ['LOPEZ ANA', 'MORA BEA', 'REY CATA', 'SOL DANI'], ahora: col('2026-10-20T12:00:00'),
            rosters: [jf, B], horarios: hor,
        });
        expect(r.team_id).toBe('JUV-F');
    });
    it('sin nombres reconocidos → pregunta', () => {
        const r = inferirEquipo({ nombresOCR: ['ZZZ QQQ', 'XXX WWW'], ahora: col('2026-10-20T12:00:00'), rosters: [A, B], horarios: hor });
        expect(r.team_id).toBeNull();
        expect(r.confianza).toBe('baja');
    });
});

describe.skipIf(!hayDocs)('inferirEquipo — las hojas reales de septiembre (roster = atletas de la base con su equipo real)', () => {
    const cruce = hayDocs ? cargar('cruce_asistencia.json') : { hojas: [] };
    const trans: any[] = hayDocs
        ? ['transcripcion_01_08.json', 'transcripcion_09_16.json', 'transcripcion_17_24.json', 'transcripcion_25_32.json'].flatMap(cargar)
        : [];
    const hojasConEquipo: any[] = cruce.hojas.filter((h: any) => h.equipo_app && !h.grupo_inferido);

    const rosterSin = (_idxExcluido: number): RosterEquipo[] => {
        const porEquipo = new Map<string, Map<string, AtletaRoster>>();
        for (const h of cruce.hojas) {
            for (const f of h.filas ?? []) {
                const m = f.match;
                if (!m?.athlete_id || !m.team_bd || m.tipo === 'ambiguo' || m.team_bd.startsWith('(')) continue;
                const mp = porEquipo.get(m.team_bd) ?? new Map();
                mp.set(m.athlete_id, { id: m.athlete_id, nombre: m.nombre_bd });
                porEquipo.set(m.team_bd, mp);
            }
        }
        return [...porEquipo.entries()].map(([name, mp]) => ({ team_id: name, team_name: name, atletas: [...mp.values()] }));
    };

    it('hay hojas de asistencia con equipo conocido para probar', () => {
        expect(hojasConEquipo.length).toBeGreaterThanOrEqual(10);
    });

    it('acierta el equipo en la gran mayoría de las hojas (nombres de la hoja transcritos a mano vs roster de la base)', () => {
        const resultados: Array<{ idx: number; esperado: string; obtenido: string | null; confianza: string; particion: boolean }> = [];
        for (const h of hojasConEquipo) {
            const t = trans.find((x) => x.idx === h.idx_imagen);
            const nombres: string[] = (t?.filas ?? []).map((f: any) => f.nombre);
            const r = inferirEquipo({
                nombresOCR: nombres, encabezadoOCR: t?.titulo ?? null, ahora: col('2026-10-03T12:00:00'),
                rosters: rosterSin(h.idx_imagen), horarios: [],
            });
            resultados.push({ idx: h.idx_imagen, esperado: h.equipo_app, obtenido: r.team_id, confianza: r.confianza, particion: !!r.particion });
        }
        const ok = resultados.filter((r) => r.obtenido === r.esperado).length;
        // El error caro es equivocarse CON seguridad: con confianza alta el bot sigue directo al resumen;
        // con media/baja pregunta el equipo con botones antes de mostrar nada.
        const malosSeguros = resultados.filter((r) => r.obtenido && r.obtenido !== r.esperado && r.confianza === 'alta');
        expect(malosSeguros, JSON.stringify(malosSeguros)).toEqual([]);
        expect(ok / resultados.length).toBeGreaterThanOrEqual(0.7);
    });

    it('cruce con el roster: coincide con el cruce manual y el resumen sale con el formato pedido', () => {
        const h = hojasConEquipo.find((x: any) => x.equipo_app === 'NUEVA ERA')!;
        const t = trans.find((x) => x.idx === h.idx_imagen);
        // roster = la gente que el cruce manual asignó a ese equipo en cualquier hoja
        const ros = rosterSin(-1).find((r) => r.team_id === 'NUEVA ERA')!;
        const ids = new Set(ros.atletas.map((a) => a.id));
        const filas: FilaPlanilla[] = t.filas.map((f: any) => ({
            nombre: f.nombre,
            struck: /retirad/i.test(f.nota ?? ''),
            marcasPorFecha: Object.fromEntries(
                t.dias.map((d: number) => [`2026-09-${String(d).padStart(2, '0')}`, interpretarMarca(f.marcas?.[String(d)])]),
            ),
        }));
        const fechas = t.dias.map((d: number) => `2026-09-${String(d).padStart(2, '0')}`);
        const c = cruzarConRoster(filas, ros.atletas, fechas);
        // Filas donde el cruce manual encontró un atleta de este equipo: nuestro cruce automático debe dar el MISMO atleta.
        let comparables = 0; let iguales = 0;
        h.filas.forEach((fm: any, i: number) => {
            const manual = fm.match?.athlete_id;
            if (!manual || !ids.has(manual) || fm.match.tipo === 'ambiguo') return;
            comparables++;
            if (c.filas[i].atletaId === manual) iguales++;
        });
        expect(comparables).toBeGreaterThanOrEqual(8);
        expect(iguales / comparables).toBeGreaterThanOrEqual(0.9);
        const dia = c.porFecha.find((d) => d.presentes.length > 0)!;
        expect(resumenPlanilla('Nueva Era', dia, c.noEncontradas.length)).toMatch(/^Nueva Era, \d+-sep: \d+ presentes, \d+ sin marca/);
    });
});

describe('cruzarConRoster', () => {
    const roster: AtletaRoster[] = [
        { id: '1', nombre: 'Ana Lopez Ruiz' }, { id: '2', nombre: 'Bea Mora Diaz' }, { id: '3', nombre: 'Cata Rey Paz' },
    ];
    const F = '2026-10-22';
    const fila = (nombre: string, m: 'asistio' | 'sin_marca' | 'dudosa' | null, extra: Partial<FilaPlanilla> = {}): FilaPlanilla =>
        ({ nombre, marcasPorFecha: m ? { [F]: m } : {}, ...extra });

    it('presentes, sin marca (NO falta), no encontrada con sugerencia, retirada ignorada', () => {
        const c = cruzarConRoster([
            fila('LOPEZ ANA', 'asistio'),
            fila('MORA BEA', null),                      // celda vacía
            fila('RUIZ LUZ', 'asistio'),                 // solo calza el apellido → no encontrada, sugiere a Ana
            fila('PEREZ ZOE', 'asistio'),
            fila('GOMEZ LUZ', 'asistio', { struck: true, nota: 'Retirada' }),
        ], roster, [F]);
        const d = c.porFecha[0];
        expect(d.presentes.map((f) => f.atletaId)).toContain('1');
        expect(d.sinMarca.map((f) => f.atletaId)).toEqual(['2']);
        expect(c.noEncontradas.map((f) => f.nombreHoja)).toContain('PEREZ ZOE');
        expect(c.ignoradas).toHaveLength(1);
        expect(c.noEncontradas.find((f) => f.nombreHoja === 'RUIZ LUZ')?.sugerencia?.id).toBe('1');
        expect(resumenPlanilla('Intermedio', d, c.noEncontradas.length)).toMatch(/^Intermedio, 22-oct: \d+ presentes, 1 sin marca/);
    });
    it('el mismo atleta en dos filas → duplicados; solo una queda asignada', () => {
        const c = cruzarConRoster([fila('LOPEZ ANA', 'asistio'), fila('LOPEZ RUIZ ANA', 'asistio')], roster, [F]);
        expect(c.duplicados).toHaveLength(1);
        expect(c.duplicados[0].atletaId).toBe('1');
        expect(c.porFecha[0].presentes).toHaveLength(1);
        expect(c.ambiguas).toHaveLength(1);
    });
    it('marca dudosa no cuenta como presente ni como sin marca', () => {
        const c = cruzarConRoster([fila('LOPEZ ANA', 'dudosa')], roster, [F]);
        expect(c.porFecha[0].presentes).toHaveLength(0);
        expect(c.porFecha[0].sinMarca).toHaveLength(0);
        expect(c.porFecha[0].dudosas).toHaveLength(1);
    });
});
