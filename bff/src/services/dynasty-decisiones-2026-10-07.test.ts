/**
 * Decisiones de la dueña de Dynasty (2026-10-07) que quedaron en código:
 * atención presencial y «qué llevar» por escuela, y el banco en el nombre de
 * las llaves Bre-B.
 */
import { describe, it, expect } from 'vitest';
import { textoLimpio } from './whatsapp-ajustes-escuela.service';
import { nombreDeCuenta } from './whatsapp-medios-de-pago.service';
import { lineasQueLlevar, QUE_LLEVAR, type FranjaCortesia } from './whatsapp-clase-cortesia.service';
import { textoRecordatorio } from './recordatorio-cortesia.service';
import { fallbackInfoEscuela, type InfoDeEscuela } from './whatsapp-info-escuela.service';

const INDICACIONES = 'Ropa de entrenamiento. Al llegar, la administración está en el ingreso por la parte derecha del coliseo, segundo piso.';
const PRESENCIAL = 'Club de voleibol Coliseo Dynasty, Cl. 12 Bis #71g-09, Bogotá. Desde las 4 p. m. hasta las 9 p. m.';

describe('textoLimpio', () => {
    it('recorta, colapsa espacios y descarta lo vacío o lo que no es texto', () => {
        expect(textoLimpio('  hola   mundo \n')).toBe('hola mundo');
        expect(textoLimpio('   ')).toBeNull();
        expect(textoLimpio(null)).toBeNull();
        expect(textoLimpio(42)).toBeNull();
        expect(textoLimpio('x'.repeat(500))?.length).toBe(400);
    });
});

describe('nombreDeCuenta', () => {
    it('Dynasty: «Bre-B Bancolombia» sale tal cual', () => {
        expect(nombreDeCuenta('breb', 'Bre-B Bancolombia')).toBe('Bre-B Bancolombia');
    });
    it('una etiqueta que no nombra el canal se le suma', () => {
        expect(nombreDeCuenta('breb', 'Bancolombia')).toBe('Bre-B Bancolombia');
    });
    it('sin etiqueta o con la etiqueta igual al tipo, queda el tipo', () => {
        expect(nombreDeCuenta('breb', '')).toBe('Bre-B');
        expect(nombreDeCuenta('breb', 'bre b')).toBe('Bre-B');
        expect(nombreDeCuenta('nequi', null)).toBe('Nequi');
    });
    it('tipo desconocido: la etiqueta o «Cuenta»', () => {
        expect(nombreDeCuenta('otro', 'Caja')).toBe('Caja');
        expect(nombreDeCuenta('otro', '')).toBe('Cuenta');
    });
});

describe('lineasQueLlevar', () => {
    it('con indicaciones de la escuela, van tal cual y sin el «dile al entrenador»', () => {
        const t = lineasQueLlevar(INDICACIONES);
        expect(t).toContain(INDICACIONES);
        expect(t).not.toContain(QUE_LLEVAR);
        expect(t).not.toContain('entrenador');
        expect(t).toContain('*gratis*');
    });
    it('sin indicaciones, el texto genérico de siempre', () => {
        expect(lineasQueLlevar(null)).toContain(QUE_LLEVAR);
        expect(lineasQueLlevar('  ')).toContain('dile al entrenador');
    });
});

describe('textoRecordatorio con indicaciones', () => {
    const franja: FranjaCortesia = {
        id: 'f1', grupo: 'INFANTIL FEMENINO', fecha: '2026-10-10', horaInicio: '16:00', horaFin: '18:00',
        sede: 'Coliseo Dynasty', cupos: 999,
    } as FranjaCortesia;
    const base = { saludo: 'Ana', atleta: 'Sofía', esAcudiente: true, escuela: 'DYNASTY VOLLEY CLUB', franja };

    it('usa las de la escuela si existen', () => {
        const t = textoRecordatorio('vispera', { ...base, indicaciones: INDICACIONES });
        expect(t).toContain(INDICACIONES);
        expect(t).not.toContain(QUE_LLEVAR);
    });
    it('sin ellas, el genérico', () => {
        expect(textoRecordatorio('vispera', base)).toContain(QUE_LLEVAR);
    });
});

describe('fallbackInfoEscuela con atención presencial', () => {
    const info: InfoDeEscuela = {
        nombre: 'DYNASTY VOLLEY CLUB', ciudad: 'BOGOTA', direccion: null, sedes: ['Coliseo Dynasty'],
        deportes: [], grupos: [], categorias: [], horario_atencion: 'lunes de 08:00 a 22:59',
        atencion_presencial: PRESENCIAL, no_disponible: [],
    };
    it('la presencial manda sobre el horario del chat', () => {
        const t = fallbackInfoEscuela(info);
        expect(t).toContain(PRESENCIAL);
        expect(t).not.toContain('22:59');
    });
    it('sin presencial, queda el horario de atención de siempre', () => {
        expect(fallbackInfoEscuela({ ...info, atencion_presencial: null })).toContain('22:59');
    });
});
