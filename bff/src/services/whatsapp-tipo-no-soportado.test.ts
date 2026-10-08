/**
 * Dynasty 2026-10-07 18:32–18:37: una familia mandó 13 videos seguidos (del
 * entrenamiento, junto con fotos) y el bot respondió 13 veces «No puedo ver
 * videos…». Regla: contestar SOLO si el texto cercano habla de pago, y como
 * mucho una vez cada 24 h por conversación; la ráfaga la frena además
 * `reservarPasoUnaVez` (en memoria). Datos de ejemplo.
 */
import { describe, it, expect } from 'vitest';
import { respuestaATipoNoSoportado, PASO_TIPO_NO_SOPORTADO, type FilaReciente } from './whatsapp-reglas-turno';

const AHORA = Date.parse('2026-10-07T23:40:00Z');
const hace = (s: number) => new Date(AHORA - s * 1000).toISOString();
const video = (s: number): FilaReciente => ({ direction: 'inbound', type: 'video', text_body: null, created_at: hace(s) });
const foto = (s: number): FilaReciente => ({ direction: 'inbound', type: 'image', text_body: null, created_at: hace(s) });
const texto = (s: number, t: string): FilaReciente => ({ direction: 'inbound', type: 'text', text_body: t, created_at: hace(s) });
const respuesta = (s: number): FilaReciente => ({
    direction: 'outbound', type: 'text', text_body: 'No puedo ver videos…', ai_generated: true,
    payload: { step: `${PASO_TIPO_NO_SOPORTADO}_video` }, created_at: hace(s),
});

/** Simula la ráfaga: cada video ve lo anterior y, si el bot responde, queda en las filas. */
function rafaga(previas: FilaReciente[], n: number): number {
    const filas = [...previas];
    let enviados = 0;
    for (let i = n; i > 0; i--) {
        const ahora = AHORA - i * 20_000;
        filas.push({ ...video(0), created_at: new Date(ahora).toISOString() });
        if (respuestaATipoNoSoportado(null, filas, ahora)) {
            enviados++;
            filas.push({ ...respuesta(0), created_at: new Date(ahora + 2000).toISOString() });
        }
    }
    return enviados;
}

describe('videos de una familia', () => {
    it('13 videos seguidos con fotos y sin texto → 0 mensajes', () => {
        const previas = [foto(400), foto(399), foto(398), foto(397)];
        expect(rafaga(previas, 13)).toBe(0);
    });

    it('13 videos tras «te envío el comprobante» → 1 mensaje', () => {
        expect(rafaga([texto(120, 'Te envío el comprobante de la mensualidad')], 13)).toBe(1);
    });

    it('el pie del video habla de pago → sí', () => {
        expect(respuestaATipoNoSoportado('pago de octubre', [], AHORA)).toBe(true);
    });

    it('texto de pago de hace más de 15 min → no', () => {
        expect(respuestaATipoNoSoportado(null, [texto(20 * 60, 'ya pagué la mensualidad')], AHORA)).toBe(false);
    });

    it('ya se respondió en 24 h → no, aunque hable de pago', () => {
        expect(respuestaATipoNoSoportado('comprobante', [respuesta(3 * 3600)], AHORA)).toBe(false);
    });

    it('charla del entrenamiento («miren el saque de la niña») → no', () => {
        expect(respuestaATipoNoSoportado(null, [texto(60, 'miren el saque de la niña')], AHORA)).toBe(false);
    });
});
