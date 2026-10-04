import { describe, expect, it } from 'vitest';
import {
    calcularPendientes, contarPorVista, echosAutomaticos, esColumnaInexistente, estaPendiente, esTextoAutomatico,
    normalizarTextoEcho, vistaDeTipo,
} from './whatsapp-buzon';

describe('whatsapp-buzon', () => {
    it('vistaDeTipo: familias = familia, familia_sin_cuenta, ambiguo; el resto y NULL a otros', () => {
        expect(['familia', 'familia_sin_cuenta', 'ambiguo'].map(vistaDeTipo)).toEqual(['familias', 'familias', 'familias']);
        expect(['staff', 'desconocido', 'personal', null, undefined].map(vistaDeTipo))
            .toEqual(['otros', 'otros', 'otros', 'otros', 'otros']);
    });

    it('contarPorVista', () => {
        expect(contarPorVista([{ contact_kind: 'familia' }, { contact_kind: null }, { contact_kind: 'staff' }]))
            .toEqual({ familias: 1, otros: 2, todas: 3 });
    });

    it('pendiente usa wa_timestamp (hora real), no created_at (hora de importación del echo)', () => {
        const t = calcularPendientes([
            { conversation_id: 'c', direction: 'inbound', wa_timestamp: '2026-10-03T10:00:00Z', created_at: '2026-10-03T10:00:01Z' },
            // Echo importado después, pero escrito ANTES del entrante.
            { conversation_id: 'c', direction: 'outbound', wa_timestamp: '2026-10-03T09:00:00Z', created_at: '2026-10-03T11:00:00Z' },
        ]);
        expect(estaPendiente('open', t.get('c'))).toBe(true);
    });

    it('respondida, cerrada o sin entrantes → no pendiente', () => {
        const t = calcularPendientes([
            { conversation_id: 'c', direction: 'inbound', wa_timestamp: '2026-10-03T10:00:00Z' },
            { conversation_id: 'c', direction: 'outbound', wa_timestamp: '2026-10-03T10:05:00Z' },
            { conversation_id: 'd', direction: 'outbound', wa_timestamp: '2026-10-03T10:05:00Z' },
        ]);
        expect(estaPendiente('open', t.get('c'))).toBe(false);
        expect(estaPendiente('open', t.get('d'))).toBe(false);
        expect(estaPendiente('closed', { ultimoEntrante: 2, ultimoSaliente: 1 })).toBe(false);
        expect(estaPendiente('open', undefined)).toBe(false);
    });

    // ─── Echos automáticos de la app WhatsApp Business ───────────────────────
    const SALUDO = 'Gracias por comunicarte con Dynasty D.C😃🏐 Club y escuela de fútbol. En breve te respondemos.';
    const echo = (id: string, conv: string, texto: string, dia = 3, hora = 10) => ({
        id, conversation_id: conv, text_body: texto,
        wa_timestamp: new Date(Date.UTC(2026, 9, dia, hora)).toISOString(),
    });

    it('normalizarTextoEcho: tildes, mayúsculas, espacios y puntuación final no importan', () => {
        expect(normalizarTextoEcho('  Hola, ¿CÓMO   estás?! ')).toBe('hola, ¿como estas');
        expect(normalizarTextoEcho(SALUDO.toUpperCase() + '...'))
            .toBe(normalizarTextoEcho(SALUDO.normalize('NFD').replace(/[̀-ͯ]/g, '')));
        expect(normalizarTextoEcho(null)).toBe('');
    });

    it('mismo texto a 3 contactos distintos → automático (también el 1.º y el 2.º)', () => {
        const ids = echosAutomaticos([
            echo('a', 'c1', SALUDO), echo('b', 'c2', SALUDO.toUpperCase(), 3, 11), echo('c', 'c3', SALUDO + '.', 3, 12),
        ]);
        expect([...ids].sort()).toEqual(['a', 'b', 'c']);
    });

    it('mismo texto a solo 2 contactos (aunque sea 5 veces) → humano', () => {
        const ids = echosAutomaticos([
            echo('a', 'c1', SALUDO), echo('b', 'c2', SALUDO), echo('c', 'c1', SALUDO), echo('d', 'c2', SALUDO), echo('e', 'c1', SALUDO),
        ]);
        expect(ids.size).toBe(0);
        expect(esTextoAutomatico(normalizarTextoEcho(SALUDO), 2)).toBe(false);
        expect(esTextoAutomatico(normalizarTextoEcho(SALUDO), 3)).toBe(true);
    });

    it('texto corto repetido ("Hola cómo estás" a 3 contactos, medido en Dynasty) → humano', () => {
        const ids = echosAutomaticos([echo('a', 'c1', 'Hola cómo estás'), echo('b', 'c2', 'Hola cómo estás'), echo('c', 'c3', 'hola como estas')]);
        expect(ids.size).toBe(0);
    });

    it('los 3 contactos tienen que caer dentro de 7 días', () => {
        const separados = echosAutomaticos([echo('a', 'c1', SALUDO, 1), echo('b', 'c2', SALUDO, 5), echo('c', 'c3', SALUDO, 12)]);
        expect(separados.size).toBe(0);
        const juntos = echosAutomaticos([echo('a', 'c1', SALUDO, 1), echo('b', 'c2', SALUDO, 5), echo('c', 'c3', SALUDO, 7)]);
        expect(juntos.size).toBe(3);
    });

    it('pendiente ignora los salientes automáticos (marca en payload o columna alias)', () => {
        const t = calcularPendientes([
            { conversation_id: 'c', direction: 'inbound', wa_timestamp: '2026-10-03T10:00:00Z' },
            { conversation_id: 'c', direction: 'outbound', wa_timestamp: '2026-10-03T10:00:02Z', payload: { automatico: true } },
            { conversation_id: 'd', direction: 'inbound', wa_timestamp: '2026-10-03T10:00:00Z' },
            { conversation_id: 'd', direction: 'outbound', wa_timestamp: '2026-10-03T10:00:02Z', automatico: true },
            { conversation_id: 'e', direction: 'inbound', wa_timestamp: '2026-10-03T10:00:00Z' },
            { conversation_id: 'e', direction: 'outbound', wa_timestamp: '2026-10-03T10:00:02Z', payload: { automatico: true } },
            { conversation_id: 'e', direction: 'outbound', wa_timestamp: '2026-10-03T10:30:00Z', payload: { to: '57300' } },
        ]);
        expect(estaPendiente('open', t.get('c'))).toBe(true);
        expect(estaPendiente('open', t.get('d'))).toBe(true);
        expect(estaPendiente('open', t.get('e'))).toBe(false);
    });

    it('esColumnaInexistente reconoce los dos errores de PostgREST', () => {
        expect(esColumnaInexistente({ code: '42703', message: 'column x does not exist' })).toBe(true);
        expect(esColumnaInexistente({ code: 'PGRST204', message: "Could not find the 'x' column" })).toBe(true);
        expect(esColumnaInexistente({ code: '23514', message: 'check violation' })).toBe(false);
        expect(esColumnaInexistente(null)).toBe(false);
    });
});
