/**
 * Grupos por edad: rango de cada grupo (equipo → categoría → atletas activos →
 * nombre) y la respuesta «Para 12 años le corresponde *Infantil Femenino*».
 *
 * Los equipos imitan a Dynasty con la distribución REAL medida el 2026-10-07
 * (percentiles 5–95 de edades de sus atletas activos), sin datos de personas.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/supabase', () => ({ supabase: {} }));
vi.mock('./push.service', () => ({ sendToUser: vi.fn() }));
vi.mock('./avisos-correo.service', () => ({ destinatariosDeEscuela: vi.fn(), enviarConReserva: vi.fn() }));

import {
    construirRangos, elegirGrupo, textoGrupoParaEdad, textoDesdeQueEdad, preguntaGrupoPorEdad,
    horarioCompacto, rangoHorario, aniosEnNombre, type EquipoCrudo, type AtletaCrudo, type RangoGrupo,
} from './grupos-por-edad.service';
import {
    responderGrupoPorEdad, iniciarCortesia, perfilReciente, leerPerfil,
    type CtxCortesia, type EstadoCortesia, type FranjaCortesia,
} from './whatsapp-clase-cortesia.service';

// 2026-10-07 08:00 en Bogotá.
const AHORA = new Date('2026-10-07T13:00:00Z');
const nac = (edad: number) => `${2026 - edad}-01-15`;

/** Atletas de un equipo: edades, y cuántas f/m tienen género cargado. */
function atletas(teamId: string, edades: number[], f = 0, m = 0): AtletaCrudo[] {
    return edades.map((e, i) => ({
        teamId, fechaNacimiento: nac(e), genero: i < f ? 'F' : i < f + m ? 'male' : null,
    }));
}
const rep = (desde: number, hasta: number, veces = 3) =>
    Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i).flatMap((e) => Array(veces).fill(e));

const SCHED_INF_F = [{ day: 1, time: '18:30', end: '20:30' }, { day: 3, time: '18:30', end: '20:30' },
    { day: 6, time: '11:00', end: '13:00' }, { day: 0, time: '11:00', end: '13:00' }];

const EQUIPOS: EquipoCrudo[] = [
    { id: 'inf-f', name: 'INFANTIL FEMENINO', schedule: SCHED_INF_F },
    { id: 'inf-m', name: 'INFANTIL MASCULINO', schedule: [{ day: 2, time: '18:30', end: '20:30' }] },
    { id: 'mini', name: 'MINIVOLLEY BENJAMINES', schedule: [{ day: 1, time: '17:00', end: '19:00' }] },
    { id: 'interm', name: 'INTERMEDIO', schedule: null },
    { id: 'men-f', name: 'MENORES FEMENINO', schedule: null },
    { id: 'jmf', name: 'JUVENIL MAYORES FEMENINO', admite_nuevos: false },
    { id: 'jmm', name: 'JUVENIL MAYORES MASCULINO' },
    { id: 'seniors', name: 'SENIORS', schedule: [{ day: 1, time: '20:00', end: '22:00' }, { day: 4, time: '20:00', end: '22:00' }] },
    { id: 'dup', name: 'MINIVOLLEY -BENJAMINES (DUPLICADO - NO USAR)' },
];
const ATLETAS: AtletaCrudo[] = [
    ...atletas('inf-f', rep(12, 15, 5), 20, 0),
    ...atletas('inf-m', rep(9, 15, 2), 4, 10),
    ...atletas('mini', [...rep(8, 13, 4), 6, 14, 2026 - 2026], 20, 2),   // un recién nacido = error de carga
    ...atletas('interm', rep(11, 16, 4), 23, 0),
    ...atletas('men-f', rep(15, 17, 4), 10, 0),
    ...atletas('jmf', rep(17, 21, 1)),
    ...atletas('jmm', rep(17, 20, 2), 0, 5),
    ...atletas('seniors', [...rep(18, 56, 1), 9], 2, 3),
];

const RANGOS = construirRangos(EQUIPOS, ATLETAS, AHORA);
const R = (id: string) => RANGOS.find((r) => r.teamId === id)!;

describe('construirRangos', () => {
    it('infiere el rango de los atletas activos (p5–p95), sin los errores de carga', () => {
        expect(R('inf-f')).toMatchObject({ edadMin: 12, edadMax: 15, fuenteEdad: 'atletas', genero: 'f', generoExplicito: true, confianza: 'media' });
        expect(R('mini').edadMin).toBe(8);
        expect(R('mini').edadMax).toBe(13);
        expect(R('mini').genero).toBe('mixto');          // 20 f / 2 m = 91 % < 95 %
        expect(R('interm').genero).toBe('f');            // 23 f / 0 m
        expect(R('interm').generoExplicito).toBe(false);
    });

    it('grupo de adultos: sin techo de edad', () => {
        expect(R('seniors')).toMatchObject({ adultos: true, edadMax: null, nivel: 'adultos' });
        expect(R('seniors').edadMin).toBeGreaterThanOrEqual(18);
    });

    it('excluye los «NO USAR» y respeta «no admite nuevos»', () => {
        expect(RANGOS.find((r) => r.teamId === 'dup')).toBeUndefined();
        expect(R('jmf').admiteNuevos).toBe(false);
    });

    it('prioridad: age_min/age_max del equipo > categoría > atletas > año en el nombre', () => {
        const [conEquipo, conCategoria, porAnio] = construirRangos([
            { id: 'a', name: 'Sub-15', age_min: 13, age_max: 15 },
            { id: 'b', name: 'Pre juvenil', categoria: { birth_year_min: 2010, birth_year_max: 2011, rama: 'Femenino' } },
            { id: 'c', name: '2011 - ARRAYANES' },
        ], [...atletas('a', rep(5, 9)), ...atletas('c', [14, 15])], AHORA);
        expect(conEquipo).toMatchObject({ edadMin: 13, edadMax: 15, fuenteEdad: 'equipo', confianza: 'alta' });
        expect(conCategoria).toMatchObject({ edadMin: 14, edadMax: 16, fuenteEdad: 'categoria', genero: 'f', generoExplicito: true });
        // 2 atletas no alcanzan la muestra mínima → el año del nombre.
        expect(porAnio).toMatchObject({ edadMin: 14, edadMax: 15, fuenteEdad: 'nombre' });
        expect(aniosEnNombre('2013-2014 mixto')).toEqual([2013, 2014]);
    });

    it('«Infantil», «Menores», «Sub-15» en el nombre NO se traducen a edades', () => {
        const [r] = construirRangos([{ id: 'x', name: 'INFANTIL SUB-15 FEMENINO' }], [], AHORA);
        expect(r.edadMin).toBeNull();
        expect(r.edadMax).toBeNull();
        expect(r.genero).toBe('f');
    });
});

describe('elegirGrupo + texto', () => {
    it('niña de 12 → Infantil Femenino, con su horario', () => {
        const perfil = { edad: 12, genero: 'f' as const };
        const e = elegirGrupo(RANGOS, perfil);
        expect(e.principal?.teamId).toBe('inf-f');
        expect(textoGrupoParaEdad(e, perfil)).toBe(
            'Para 12 años le corresponde *Infantil Femenino* (lunes y miércoles 6:30–8:30 p. m.; ' +
            'sábado y domingo 11 a. m.–1 p. m.). La escuela te lo confirma en la primera clase.');
    });

    it('niño de 8 → Minivolley Benjamines (los femeninos quedan fuera)', () => {
        const e = elegirGrupo(RANGOS, { edad: 8, genero: 'm' });
        expect(e.principal?.teamId).toBe('mini');
        expect(e.cercano).toBe(false);
    });

    it('adulta de 23 → Seniors (Juvenil Mayores Femenino no recibe nuevos)', () => {
        const e = elegirGrupo(RANGOS, { edad: 23, genero: 'f', adulto: true });
        expect(e.principal?.teamId).toBe('seniors');
        expect(textoGrupoParaEdad(e, { edad: 23 })).toContain('Para 23 años le corresponde *Seniors*');
    });

    it('12 años sin decir si es niña o niño: los dos grupos explícitos', () => {
        const e = elegirGrupo(RANGOS, { edad: 12 });
        expect(e.porGenero?.f.teamId).toBe('inf-f');
        expect(e.porGenero?.m.teamId).toBe('inf-m');
        expect(textoGrupoParaEdad(e, { edad: 12 })).toMatch(/\*Infantil Femenino\*.* si es niña, o \*Infantil Masculino\*.* si es niño/);
    });

    it('7 años: ninguno lo incluye → el más cercano, dicho como tal', () => {
        const e = elegirGrupo(RANGOS, { edad: 7 });
        expect(e).toMatchObject({ cercano: true });
        expect(e.principal?.teamId).toBe('mini');
        expect(textoGrupoParaEdad(e, { edad: 7 })).toContain('el grupo más cercano es *Minivolley Benjamines*');
    });

    it('«¿desde qué edad reciben?»', () => {
        expect(textoDesdeQueEdad(RANGOS)).toMatch(/^La escuela recibe desde los \*8 años\* \(\*Minivolley Benjamines\*.*y tiene grupo para adultos \(\*Seniors\*\)/);
    });

    it('rango con datos de la escuela (age_min) no lleva la frase de «te confirma»', () => {
        const rangos: RangoGrupo[] = construirRangos([{ id: 'a', name: 'Sub-13', age_min: 11, age_max: 13 }], [], AHORA);
        expect(textoGrupoParaEdad(elegirGrupo(rangos, { edad: 12 }), { edad: 12 })).toBe('Para 12 años le corresponde *Sub-13*.');
    });
});

describe('preguntaGrupoPorEdad', () => {
    it.each([
        ['¿Qué grupo le corresponde a mi hija de 12?', 'grupo'],
        ['en qué categoría quedaría un niño de 8 años', 'grupo'],
        ['Mi hija tiene 14, ¿en qué grupo iría?', 'grupo'],
        ['¿Reciben niños de 5?', 'grupo'],
        ['¿Desde qué edad reciben?', 'desde'],
        ['qué edades manejan', 'desde'],
        ['¿En qué grupo va mi hijo?', null],
        ['¿A qué hora entrena el grupo de mi hijo?', null],
        ['tengo 2 hijos', null],
    ])('%s → %s', (texto, esperado) => {
        expect(preguntaGrupoPorEdad(texto)).toBe(esperado);
    });
});

describe('horario compacto', () => {
    it('junta días con la misma hora y separa subgrupos', () => {
        expect(rangoHorario('16:00', '18:00')).toBe('4–6 p. m.');
        expect(rangoHorario('07:00', '09:00')).toBe('7–9 a. m.');
        expect(horarioCompacto([{ day: 2, time: '16:00', end: '18:00' }, { day: 4, time: '16:00', end: '18:00' }]))
            .toBe('martes y jueves 4–6 p. m.');
        expect(horarioCompacto([
            { day: 1, time: '16:00', end: '18:00', group: 'Origen' },
            { day: 2, time: '16:00', end: '18:00', group: 'Evolución' },
        ])).toBe('Origen: lunes 4–6 p. m. | Evolución: martes 4–6 p. m.');
    });
});

// ─── Con el bot: no re-preguntar la edad, no repetir la lista ───────────────

interface Enviado { texto: string; step: string; estado: EstadoCortesia | null; botones?: any[] }

const F = (id: string, teamId: string, grupo: string, fecha: string, hora = '18:30'): FranjaCortesia => ({
    id, grupo, fecha, horaInicio: hora, horaFin: '20:30', sede: 'Coliseo', cupos: 3, teamId,
    edadMin: R(teamId).edadMin, edadMax: R(teamId).edadMax,
});
const FRANJAS = [
    F('f1', 'inf-f', 'INFANTIL FEMENINO', '2026-10-08'),
    F('f2', 'inf-f', 'INFANTIL FEMENINO', '2026-10-10', '11:00'),
    F('f3', 'inf-f', 'INFANTIL FEMENINO', '2026-10-11', '11:00'),
    F('f4', 'inf-f', 'INFANTIL FEMENINO', '2026-10-13'),
    F('f5', 'inf-f', 'INFANTIL FEMENINO', '2026-10-15'),
    F('m1', 'mini', 'MINIVOLLEY BENJAMINES', '2026-10-08', '17:00'),
    F('m2', 'mini', 'MINIVOLLEY BENJAMINES', '2026-10-12', '17:00'),
    F('s1', 'seniors', 'SENIORS', '2026-10-08', '20:00'),
];

function armar(op: { previo?: string[]; listado?: boolean } = {}) {
    const enviados: Enviado[] = [];
    let estado: EstadoCortesia | null = null;
    const ctx: CtxCortesia = {
        conversationId: 'conv-1', schoolId: 'school-1', contactWaId: '573001112233',
        enviar: async (texto, step, est, botones) => { enviados.push({ texto, step, estado: est, botones }); estado = est; },
        leerEstado: async () => estado,
        franjas: async () => FRANJAS,
        reservaVigente: async () => null,
        reservar: vi.fn(),
        cancelar: vi.fn(),
        avisarEscuela: vi.fn(async () => {}),
        ahora: () => AHORA,
        rangos: async () => RANGOS,
        perfilPrevio: async () => perfilReciente((op.previo ?? []).join('\n')),
        listadoReciente: async () => !!op.listado,
    };
    return { ctx, enviados };
}

describe('responderGrupoPorEdad (bot)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('niña de 12: el grupo una vez y «¿te reservo?» con 3 horarios en botones, no la lista', async () => {
        const { ctx, enviados } = armar();
        expect(await responderGrupoPorEdad(ctx, '¿Qué grupo le corresponde a mi hija de 12?', { step: 'grupo_por_edad' })).toBe(true);
        expect(enviados).toHaveLength(1);
        expect(enviados[0].texto).toMatch(/^Para 12 años le corresponde \*Infantil Femenino\* \(lunes y miércoles/);
        expect(enviados[0].texto).toContain('¿Te reservo una *clase de cortesía* gratis?');
        expect(enviados[0].botones).toHaveLength(3);
        expect(enviados[0].estado?.paso).toBe('elegir_franja');
        expect(enviados[0].estado?.datos.edad).toBe(12);
    });

    it('niño de 8 → Minivolley', async () => {
        const { ctx, enviados } = armar();
        await responderGrupoPorEdad(ctx, 'en qué grupo quedaría mi hijo de 8 años', { step: 'g' });
        expect(enviados[0].texto).toMatch(/^Para 8 años le corresponde \*Minivolley Benjamines\*/);
        expect(enviados[0].botones?.every((b: any) => b.id.startsWith('sm_cc_f:m'))).toBe(true);
    });

    it('adulta de 23 → Seniors', async () => {
        const { ctx, enviados } = armar();
        await responderGrupoPorEdad(ctx, 'tengo 23 años y soy mujer, ¿en qué grupo quedaría?', { step: 'g' });
        expect(enviados[0].texto).toMatch(/^Para 23 años le corresponde \*Seniors\*/);
    });

    it('ya dijo la edad hace días: no la vuelve a preguntar', async () => {
        const { ctx, enviados } = armar({ previo: ['hola, info para mi hija de 12 años'] });
        await responderGrupoPorEdad(ctx, '¿Y qué grupo le corresponde?', { step: 'g' });
        expect(enviados[0].texto).not.toMatch(/qué \*edad\*/);
        expect(enviados[0].texto).toMatch(/^Para 12 años le corresponde \*Infantil Femenino\*/);
    });

    it('«mi hija tiene 14» después de haber dicho 12: gana la nueva', async () => {
        const { ctx, enviados } = armar({ previo: ['para mi hija de 12 años', 'mi hija tiene 14'] });
        await responderGrupoPorEdad(ctx, '¿qué grupo le corresponde?', { step: 'g' });
        expect(enviados[0].texto).toMatch(/^Para 14 años le corresponde \*Infantil Femenino\*/);
        expect(perfilReciente('para mi hija de 12 años\nmi hija tiene 14')?.edad).toBe(14);
    });

    it('sin edad dicha nunca: la pregunta, una sola, y queda esperando la respuesta', async () => {
        const { ctx, enviados } = armar();
        await responderGrupoPorEdad(ctx, '¿En qué categoría quedaría mi hija?', { step: 'g' });
        expect(enviados[0].texto).toBe('¿Qué *edad* tiene? Con eso te digo qué grupo le corresponde.');
        expect(enviados[0].estado?.paso).toBe('perfil');
    });

    it('no es la pregunta → false (sigue el bot)', async () => {
        const { ctx, enviados } = armar();
        expect(await responderGrupoPorEdad(ctx, '¿cuánto debo?', { step: 'g' })).toBe(false);
        expect(enviados).toHaveLength(0);
    });

    it('«mi hija de 12» se lee como edad', () => {
        expect(leerPerfil('info para mi hija de 12')).toMatchObject({ edad: 12, genero: 'f', menor: true });
    });
});

describe('clase de cortesía con la edad de antes', () => {
    it('no vuelve a preguntar la edad y muestra solo su grupo', async () => {
        const { ctx, enviados } = armar({ previo: ['mi hija tiene 12 años'] });
        await iniciarCortesia(ctx, { texto: 'quiero una clase de cortesía' });
        expect(enviados[0].estado?.paso).toBe('elegir_franja');
        expect(enviados[0].texto).toContain('Para 12 años le corresponde *Infantil Femenino*');
        expect(enviados[0].estado?.datos.lista?.every((id) => id.startsWith('f'))).toBe(true);
        expect(enviados[0].estado?.datos.edad).toBe(12);
    });

    it('la lista ya salió en 24 h: hasta 3 opciones (botones), no la lista completa', async () => {
        const { ctx, enviados } = armar({ previo: ['mi hija tiene 12 años'], listado: true });
        await iniciarCortesia(ctx, { texto: 'quiero una clase de cortesía' });
        expect(enviados[0].botones).toHaveLength(3);
    });

    it('la lista ya salió y no se sabe la edad: no la repite, pregunta para quién es', async () => {
        const { ctx, enviados } = armar({ listado: true });
        await iniciarCortesia(ctx, { texto: 'clase de cortesía' });
        expect(enviados[0].texto).toMatch(/^Los horarios te los compartí arriba/);
        expect(enviados[0].estado?.paso).toBe('perfil');
    });
});
