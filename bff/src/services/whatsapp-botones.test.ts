/**
 * Botones de respuesta rápida en la capa de Graph API (whatsapp.service):
 * forma exacta del payload, límites de Meta (3 botones, título de 20
 * caracteres) y que el id del botón tocado llegue desde el webhook.
 *
 * Sin red: `fetch` se reemplaza y se inspecciona lo que se habría mandado.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';

vi.mock('../config/supabase', () => ({ supabase: {} }));

import {
    payloadDeBotones, sendInteractiveButtons, parseInboundMessages, encryptToken,
    MAX_BOTONES, MAX_TITULO_BOTON,
} from './whatsapp.service';

const TEL = '573001112233';

describe('payloadDeBotones', () => {
    it('arma interactive/button con type reply por botón', () => {
        expect(payloadDeBotones(TEL, '¿Activamos los avisos?', [
            { id: 'sm_consentir_si', title: 'Sí, acepto' },
            { id: 'sm_consentir_no', title: 'No, gracias' },
        ])).toEqual({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: TEL,
            type: 'interactive',
            interactive: {
                type: 'button',
                body: { text: '¿Activamos los avisos?' },
                action: { buttons: [
                    { type: 'reply', reply: { id: 'sm_consentir_si', title: 'Sí, acepto' } },
                    { type: 'reply', reply: { id: 'sm_consentir_no', title: 'No, gracias' } },
                ] },
            },
        });
    });

    it(`nunca más de ${MAX_BOTONES} botones ni títulos de más de ${MAX_TITULO_BOTON} caracteres`, () => {
        const p: any = payloadDeBotones(TEL, 'cuerpo', [
            { id: 'a', title: 'Un título larguísimo que no cabe' },
            { id: 'b', title: 'Dos' }, { id: 'c', title: 'Tres' }, { id: 'd', title: 'Cuatro' },
        ]);
        const botones = p.interactive.action.buttons;
        expect(botones).toHaveLength(MAX_BOTONES);
        for (const b of botones) expect(Array.from(b.reply.title).length).toBeLessThanOrEqual(MAX_TITULO_BOTON);
        expect(botones.map((b: any) => b.reply.id)).toEqual(['a', 'b', 'c']);
    });

    it('«Hablar con la escuela» cabe justo (21 → no; 20 → sí)', () => {
        expect('Hablar con la escuela'.length).toBe(21);
        const p: any = payloadDeBotones(TEL, 'x', [{ id: 'h', title: 'Hablar con la escuela' }]);
        expect(p.interactive.action.buttons[0].reply.title.length).toBeLessThanOrEqual(20);
    });

    it('sin botones o cuerpo de más de 1024 → null (el que llama manda texto)', () => {
        expect(payloadDeBotones(TEL, 'x', [])).toBeNull();
        expect(payloadDeBotones(TEL, 'x'.repeat(1025), [{ id: 'a', title: 'A' }])).toBeNull();
    });
});

describe('sendInteractiveButtons', () => {
    beforeAll(() => { process.env.WHATSAPP_TOKEN_ENC_KEY = 'clave-de-prueba'; });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('POST a /{phone_number_id}/messages con el payload de botones', async () => {
        const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ messages: [{ id: 'wamid.btn' }] }) }));
        vi.stubGlobal('fetch', fetchMock);
        const integration = { phone_number_id: 'pn-1', access_token_encrypted: encryptToken('tok') } as any;

        const r = await sendInteractiveButtons(integration, TEL, 'cuerpo', [{ id: 'a', title: 'A' }]);

        expect(r).toEqual({ ok: true, waMessageId: 'wamid.btn' });
        const [url, init] = fetchMock.mock.calls[0] as any;
        expect(url).toMatch(/\/pn-1\/messages$/);
        expect(init.headers.Authorization).toBe('Bearer tok');
        expect(JSON.parse(init.body)).toMatchObject({ type: 'interactive', interactive: { type: 'button' } });
    });

    it('si no cabe como botones no llama a Meta', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        const integration = { phone_number_id: 'pn-1', access_token_encrypted: encryptToken('tok') } as any;
        const r = await sendInteractiveButtons(integration, TEL, 'x', []);
        expect(r.ok).toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe('webhook: la respuesta a un botón trae su id', () => {
    const webhook = (m: any) => ({ entry: [{ changes: [{ field: 'messages', value: {
        metadata: { phone_number_id: 'pn-1' }, contacts: [{ wa_id: TEL, profile: { name: 'A' } }],
        messages: [{ from: TEL, id: 'wamid.in', timestamp: '1759590000', ...m }],
    } }] }] });

    it('interactive/button_reply → textBody = título, botonId = id', () => {
        const [msg] = parseInboundMessages(webhook({
            type: 'interactive',
            interactive: { type: 'button_reply', button_reply: { id: 'sm_ver_pagos', title: 'Ver mis pagos' } },
        }));
        expect(msg.textBody).toBe('Ver mis pagos');
        expect(msg.botonId).toBe('sm_ver_pagos');
    });

    it('button de plantilla → botonId = payload', () => {
        const [msg] = parseInboundMessages(webhook({ type: 'button', button: { text: 'Sí', payload: 'sm_consentir_si' } }));
        expect(msg.textBody).toBe('Sí');
        expect(msg.botonId).toBe('sm_consentir_si');
    });

    it('texto normal → botonId null', () => {
        const [msg] = parseInboundMessages(webhook({ type: 'text', text: { body: 'hola' } }));
        expect(msg.botonId).toBeNull();
    });
});
