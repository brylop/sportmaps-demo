/**
 * Los avisos existentes traducidos al canal de plataforma: claves estables por
 * evento, variables de plantilla sin saltos de línea (Meta 132018), cartera
 * solo con cifras (D11) y botón a la ruta de la app.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/supabase', () => ({ supabase: { from: () => { throw new Error('no debería consultar'); } } }));

import {
    avisoDeCaso, avisoDeCartera, avisoDeComprobantes, avisoDeCortesia, avisoDeResumen, espera, PLANTILLAS_PLATAFORMA,
} from './plataforma-wa-avisos.service';

const sinSaltos = (vs: string[]) => vs.every((v) => !/[\r\n\t]/.test(v) && v.trim().length > 0);
const AHORA = Date.parse('2026-10-09T15:00:00.000Z');

describe('avisos de plataforma', () => {
    it('comprobantes: clave por versión reclamada, espera del más antiguo', () => {
        const a = avisoDeComprobantes({
            schoolId: 'esc', version: 7, titulo: '3 comprobantes llevan más de 2 h sin revisar', mensaje: 'El más antiguo…',
            total: 5, masAntiguo: new Date(AHORA - 3 * 3600_000).toISOString(),
        }, 'Escuela Uno', AHORA);
        expect(a.clave).toBe('comprobantes:esc:v7');
        expect(a.plantilla).toEqual({ nombre: PLANTILLAS_PLATAFORMA.comprobantes, variables: ['Escuela Uno', '5', '3 h'] });
        expect(a.ruta).toBe('/payments-automation?tab=recurrent');
        // D9: se aprueba en la app, nunca desde WhatsApp.
        expect(a.texto).toContain('Se aprueban en SportMaps');
    });

    it('caso: escalación y retiro van por tipos distintos (preferencias), misma plantilla', () => {
        const base = { schoolId: 'esc', conversationId: 'c1', ancla: 'm1', etapa: 'inicial' as const, titulo: 'URGENTE en WhatsApp: Carolina', cuerpo: 'Motivo: posible lesión.' };
        const esc = avisoDeCaso({ ...base, urgente: true, retiro: false }, 'Escuela Uno');
        const ret = avisoDeCaso({ ...base, urgente: false, retiro: true }, 'Escuela Uno');
        expect(esc.tipo).toBe('escalacion');
        expect(esc.urgente).toBe(true);
        expect(ret.tipo).toBe('retiro');
        expect(esc.clave).toBe('caso:c1:m1:inicial');
        expect(esc.ruta).toBe('/whatsapp?conversacion=c1');
        expect(sinSaltos(esc.plantilla.variables)).toBe(true);
    });

    it('cortesía: usa la clave del aviso in-app', () => {
        const a = avisoDeCortesia({ schoolId: 'esc', clave: 'wa_clase_cortesia:llegada:l1:f1', titulo: 'Llegó un prospecto a su clase de cortesía', cuerpo: 'Sofía — Sub 12. Ya está en la sede.' }, 'Escuela Uno');
        expect(a.clave).toBe('wa_clase_cortesia:llegada:l1:f1');
        expect(a.ruta).toBe('/whatsapp?tab=cortesias');
        expect(sinSaltos(a.plantilla.variables)).toBe(true);
    });

    it('resumen: el texto lista las partes y las cortesías de hoy; la plantilla, en una línea', () => {
        const a = avisoDeResumen({
            schoolId: 'esc', escuela: 'Escuela Uno', fecha: '2026-10-09',
            partes: ['3 familia(s) sin respuesta', '1 clase(s) de cortesía hoy y mañana'],
            cortesiasDeHoy: ['9:00 a. m. · Sofía — Sub 12'],
        });
        expect(a.clave).toBe('resumen:esc:2026-10-09');
        expect(a.texto).toContain('• 3 familia(s) sin respuesta');
        expect(a.texto).toContain('9:00 a. m. · Sofía — Sub 12');
        expect(a.plantilla.variables[1]).toBe('3 familia(s) sin respuesta, 1 clase(s) de cortesía hoy y mañana');
    });

    it('cartera: solo cifras + enlace a Finanzas', () => {
        const a = avisoDeCartera({ schoolId: 'esc', escuela: 'Escuela Uno', lunes: '2026-10-05', familiasEnMora: 12, totalEnMora: 1850000, comprobantesEnRevision: 3 });
        expect(a.clave).toBe('cartera:esc:2026-10-05');
        expect(a.ruta).toBe('/finances');
        expect(a.plantilla.variables[0]).toBe('Escuela Uno');
        expect(a.plantilla.variables[1]).toBe('12');
        expect(a.plantilla.variables[2]).toMatch(/1\.850\.000/);
        expect(a.plantilla.variables[3]).toBe('3');
        expect(sinSaltos(a.plantilla.variables)).toBe(true);
    });

    it('espera', () => {
        expect(espera(45 * 60_000)).toBe('45 min');
        expect(espera(3 * 3600_000)).toBe('3 h');
        expect(espera(50 * 3600_000)).toBe('2 días');
    });
});

describe('las plantillas del catálogo calzan con lo que arma el código', () => {
    it('mismo número de variables y botón URL dinámico en app.sportmaps.co', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const dir = path.join(__dirname, '..', '..', 'whatsapp-templates', 'plataforma');
        const esperadas: Record<string, number> = {
            [PLANTILLAS_PLATAFORMA.comprobantes]: 3, [PLANTILLAS_PLATAFORMA.caso]: 2, [PLANTILLAS_PLATAFORMA.cortesia]: 2,
            [PLANTILLAS_PLATAFORMA.resumen]: 2, [PLANTILLAS_PLATAFORMA.cartera]: 4,
        };
        for (const [nombre, n] of Object.entries(esperadas)) {
            const p = JSON.parse(fs.readFileSync(path.join(dir, `${nombre}.json`), 'utf8'));
            expect(p.name).toBe(nombre);
            expect(p.category).toBe('UTILITY');
            expect(p.language).toBe('es_CO');
            const body = p.components.find((c: any) => c.type === 'BODY');
            const vars = [...body.text.matchAll(/\{\{(\d+)\}\}/g)].map((m: any) => Number(m[1]));
            expect(Math.max(...vars)).toBe(n);
            expect(body.example.body_text[0]).toHaveLength(n);
            const boton = p.components.find((c: any) => c.type === 'BUTTONS').buttons[0];
            expect(boton).toMatchObject({ type: 'URL', url: 'https://app.sportmaps.co/{{1}}' });
        }
    });
});
