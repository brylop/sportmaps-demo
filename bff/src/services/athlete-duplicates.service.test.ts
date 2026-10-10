/**
 * UNA regla de duplicados (spec cobros-multiples §16.3): documento o nombre =
 * duplicado; teléfono solo = informativo (hermanos comparten acudiente).
 * Con la RPC `_find_athlete_duplicates` (F1) y, mientras no exista, la regla
 * local que reproduce el viejo `findExistingAthlete` del alta.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EstadoFalso } from './charge-batches.test-helpers';

const estado = vi.hoisted(() => ({ ref: null as unknown as EstadoFalso }));
vi.mock('../config/supabase', async () => {
    const h = await import('./charge-batches.test-helpers');
    estado.ref = h.estadoVacio();
    return { supabase: h.supabaseFalso(new Proxy({} as EstadoFalso, { get: (_t, k) => (estado.ref as any)[k] })) };
});

const {
    buscarCoincidencias, buscarDuplicadoParaAlta, camposDeCoincidencia, esDuplicado, normalizarTelefono, enmascararDocumento,
} = await import('./athlete-duplicates.service');

const ESC = 'esc-1';

beforeEach(() => {
    estado.ref.rpc = {};
    estado.ref.llamadasRpc = [];
    estado.ref.erroresTabla = {};
    estado.ref.tablas = {
        children: [
            // Hermanas Ariza: mismo acudiente, nombres distintos.
            { id: 'k1', school_id: ESC, full_name: 'Mariana Ariza Sánchez', doc_number: '1011111111', parent_id: null, parent_name_temp: 'Luz', parent_phone_temp: '+57 300 123 4567' },
            { id: 'k2', school_id: ESC, full_name: 'Sofia Ariza Sánchez', doc_number: '1011111112', parent_id: null, parent_name_temp: 'Luz', parent_phone_temp: '3001234567' },
            { id: 'k-otra', school_id: 'esc-2', full_name: 'Julieta Mayorga', doc_number: '999' },
        ],
        unregistered_athletes: [
            { id: 'u1', school_id: ESC, full_name: 'Daimaris Vasquez Perez', doc_number: '52000111', phone: '3109876543', guardian_phone: null },
        ],
        profiles: [],
    };
});

describe('piezas de la regla', () => {
    it('matched_by de la RPC en cualquier forma', () => {
        expect(camposDeCoincidencia('doc_number,nombre')).toEqual(['documento', 'nombre']);
        expect(camposDeCoincidencia(['telefono'])).toEqual(['telefono']);
        expect(camposDeCoincidencia('documento_casi_igual')).toEqual(['documento']);
    });
    it('teléfono solo NO es duplicado', () => {
        expect(esDuplicado(['telefono'])).toBe(false);
        expect(esDuplicado(['telefono', 'nombre'])).toBe(true);
        expect(esDuplicado(['documento'])).toBe(true);
    });
    it('normaliza teléfono y enmascara documento', () => {
        expect(normalizarTelefono('+57 (300) 123-4567')).toBe('3001234567');
        expect(normalizarTelefono('123')).toBeNull();
        expect(enmascararDocumento('1011111111')).toBe('•••••••111');
    });
});

describe('con la RPC de F1', () => {
    it('llama _find_athlete_duplicates con la firma de §16.3 y marca duplicados', async () => {
        estado.ref.rpc._find_athlete_duplicates = () => ({
            data: [
                { table_name: 'children', id: 'k2', full_name: 'Sofia Ariza Sánchez', doc_masked: '•••112', guardian: 'Luz', matched_by: 'telefono' },
                { table_name: 'unregistered_athletes', id: 'u1', full_name: 'Daimaris Vasquez Perez', doc_masked: '•••111', guardian: null, matched_by: ['nombre'] },
            ],
        });
        const r = await buscarCoincidencias(ESC, { fullName: 'Daimaris Vasquez', phone: '3001234567' });
        expect(estado.ref.llamadasRpc[0].args).toEqual({ p_school_id: ESC, p_full_name: 'Daimaris Vasquez', p_doc_number: null, p_phone: '3001234567' });
        expect(r.map((c) => [c.id, c.es_duplicado, c.athlete_type])).toEqual([['u1', true, 'unregistered'], ['k2', false, 'child']]);
        expect(r[1].motivo).toBe('mismo acudiente que Sofia Ariza Sánchez');
    });

    it('un error real de la RPC se propaga (no cae a la regla local)', async () => {
        estado.ref.rpc._find_athlete_duplicates = () => ({ error: { code: '57014', message: 'statement timeout' } });
        await expect(buscarCoincidencias(ESC, { fullName: 'x y z' })).rejects.toThrow(/timeout/);
    });
});

describe('regla local (F1 sin aplicar)', () => {
    it('hermana con el mismo teléfono: aparece como informativa, no como duplicado', async () => {
        const r = await buscarCoincidencias(ESC, { fullName: 'Valentina Ariza Sánchez', phone: '300 123 4567' });
        expect(r.map((c) => c.id).sort()).toEqual(['k1', 'k2']);
        expect(r.every((c) => !c.es_duplicado && c.matched_by.join() === 'telefono')).toBe(true);
    });

    it('nombre con otras tildes/mayúsculas = duplicado; documento exacto = duplicado', async () => {
        expect((await buscarCoincidencias(ESC, { fullName: 'MARIANA ARIZA SANCHEZ' }))[0]).toMatchObject({ id: 'k1', es_duplicado: true });
        expect((await buscarCoincidencias(ESC, { docNumber: '52000111' }))[0]).toMatchObject({ id: 'u1', matched_by: ['documento'] });
    });

    it('nunca devuelve personas de otra escuela', async () => {
        expect(await buscarCoincidencias(ESC, { fullName: 'Julieta Mayorga' })).toEqual([]);
    });

    it('buscador: nombre parcial aparece (no duplicado); alta: no', async () => {
        const b = await buscarCoincidencias(ESC, { fullName: 'ariza' }, { modo: 'buscador' });
        expect(b.map((c) => c.id).sort()).toEqual(['k1', 'k2']);
        expect(b.every((c) => !c.es_duplicado)).toBe(true);
        expect(await buscarCoincidencias(ESC, { fullName: 'ariza' }, { modo: 'alta' })).toEqual([]);
    });
});

describe('buscarDuplicadoParaAlta (regresión de students-create-one)', () => {
    it('mismo resultado que el viejo findExistingAthlete: documento antes que nombre', async () => {
        const d = await buscarDuplicadoParaAlta(ESC, { docNumber: '1011111112', fullName: 'Mariana Ariza Sanchez' });
        expect(d).toMatchObject({ table: 'children', id: 'k2', matched_by: 'doc_number' });
        expect(d?.doc_number).toBe('•••••••112'); // enmascarado en el 409
    });

    it('por nombre normalizado contra unregistered_athletes', async () => {
        expect(await buscarDuplicadoParaAlta(ESC, { fullName: 'daimaris  vásquez pérez' }))
            .toMatchObject({ table: 'unregistered_athletes', id: 'u1', matched_by: 'nombre' });
    });

    it('teléfono solo no bloquea el alta (hermanos)', async () => {
        expect(await buscarDuplicadoParaAlta(ESC, { fullName: 'Valentina Ariza', phone: '3001234567' })).toBeNull();
    });

    it('sin datos → null sin consultar', async () => {
        expect(await buscarDuplicadoParaAlta(ESC, {})).toBeNull();
        expect(estado.ref.llamadasRpc).toHaveLength(0);
    });

    it('con la RPC: un adulto con cuenta (profiles) no se devuelve al alta', async () => {
        estado.ref.rpc._find_athlete_duplicates = () => ({
            data: [{ table_name: 'profiles', id: 'p1', full_name: 'Ana', doc_masked: null, guardian: null, matched_by: 'nombre' }],
        });
        expect(await buscarDuplicadoParaAlta(ESC, { fullName: 'Ana' })).toBeNull();
    });
});
