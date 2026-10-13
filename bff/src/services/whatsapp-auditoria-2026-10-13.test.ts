/**
 * Auditoría del bot de WhatsApp, 2026-10-13 (tráfico real 10-10 17:00 → 10-13).
 *
 *  1. El turno de redactar devolvió «Voy a consultar…» sin datos (2 de 8
 *     estados de pago): se detecta y va el respaldo determinista.
 *  2. «Recibimos tu pago en línea» a cobros que la escuela registró en efectivo
 *     o transferencia (3 de 3 avisos «en línea» eran falsos).
 *  3. `token_decrypt_failed` cerraba la fila en `failed` sin bajar el archivo:
 *     depende de QUÉ proceso tomó la fila, no del archivo → se reintenta.
 *
 * Datos inventados.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/supabase', () => ({ supabase: {} }));

import { prometeConsultarSinDatos } from './whatsapp-salida-segura';
import { pagadoEnLinea } from '../jobs/whatsapp-payment-outcome.job';
import { esTransitorio } from '../jobs/whatsapp-queue.job';

describe('1. prometeConsultarSinDatos', () => {
    it('la promesa sola → true', () => {
        expect(prometeConsultarSinDatos('Buenos días 👋 Voy a consultar el estado de tus pagos.')).toBe(true);
        expect(prometeConsultarSinDatos('¡Hola! Voy a consultar tus pagos de nuevo para darte el estado actualizado.')).toBe(true);
        expect(prometeConsultarSinDatos('Déjame revisar tus cobros y te cuento.')).toBe(true);
        expect(prometeConsultarSinDatos('Un momento, voy a verificar.')).toBe(true);
    });

    it('con datos (monto, enlace, fecha) → false', () => {
        expect(prometeConsultarSinDatos('Voy a revisar: tienes la mensualidad de octubre por $150.000.')).toBe(false);
        expect(prometeConsultarSinDatos('Voy a consultar… listo: debes 180.000.')).toBe(false);
        expect(prometeConsultarSinDatos('Te dejo el enlace y voy a revisar: https://app.example.co/p/x')).toBe(false);
        expect(prometeConsultarSinDatos('Voy a revisar el cobro que vence el 10 de octubre.')).toBe(false);
    });

    it('respuestas normales sin promesa → false', () => {
        expect(prometeConsultarSinDatos('¡Hola! ¿En qué te ayudo?')).toBe(false);
        expect(prometeConsultarSinDatos('Le paso tu caso a la escuela para que lo revise.')).toBe(false);
        expect(prometeConsultarSinDatos('')).toBe(false);
        expect(prometeConsultarSinDatos(null)).toBe(false);
    });
});

describe('2. pagadoEnLinea', () => {
    it('solo el canal online (webhook de Wompi / Mercado Pago)', () => {
        expect(pagadoEnLinea({ payment_channel: 'online' })).toBe(true);
        expect(pagadoEnLinea({ payment_channel: 'cash' })).toBe(false);
        expect(pagadoEnLinea({ payment_channel: 'transfer' })).toBe(false);
        expect(pagadoEnLinea({ payment_channel: 'manual' })).toBe(false);
        expect(pagadoEnLinea({ payment_channel: null })).toBe(false);
        expect(pagadoEnLinea({})).toBe(false);
    });
});

describe('3. esTransitorio', () => {
    it('token que no desencripta → se reintenta (otro proceso puede tomar la fila)', () => {
        expect(esTransitorio('token_decrypt_failed')).toBe(true);
    });
    it('lo de siempre no cambia', () => {
        expect(esTransitorio('network_error')).toBe(true);
        expect(esTransitorio('graph_media_503')).toBe(true);
        expect(esTransitorio('graph_media_404')).toBe(false);
        expect(esTransitorio('mime_no_soportado:image/gif')).toBe(false);
        expect(esTransitorio('integration_without_token')).toBe(false);
    });
});
