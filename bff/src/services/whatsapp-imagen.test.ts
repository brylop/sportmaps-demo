/**
 * Imagen en WhatsApp (whatsapp.service): `sendImage` y la foto como
 * encabezado de los botones. Es la ficha de un servicio en venta
 * (docs/specs/ventas-por-whatsapp.md §4.2). Sin red: `fetch` se reemplaza.
 *
 * Lo que se vigila: solo URLs https, pie ≤ 1024 (si no, null y quien llama
 * manda el texto), y que sin imagen el payload de botones no cambia.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';

vi.mock('../config/supabase', () => ({ supabase: {} }));

import { payloadDeImagen, sendImage, payloadDeBotones, sendInteractiveButtons, encryptToken, MAX_PIE_IMAGEN } from './whatsapp.service';

const TEL = '573001112233';
const FOTO = 'https://cdn.sportmaps.co/perf.jpg';

describe('payloadDeImagen', () => {
    it('type image con link y pie', () => {
        expect(payloadDeImagen(TEL, FOTO, '*Clase de perfeccionamiento*\nValor: *$25.000*')).toEqual({
            messaging_product: 'whatsapp', recipient_type: 'individual', to: TEL, type: 'image',
            image: { link: FOTO, caption: '*Clase de perfeccionamiento*\nValor: *$25.000*' },
        });
    });
    it('sin pie, solo el link', () => {
        expect((payloadDeImagen(TEL, FOTO) as any).image).toEqual({ link: FOTO });
    });
    it('null si la URL no es https o el pie no cabe', () => {
        expect(payloadDeImagen(TEL, 'http://cdn/x.jpg', 'a')).toBeNull();
        expect(payloadDeImagen(TEL, 'javascript:alert(1)', 'a')).toBeNull();
        expect(payloadDeImagen(TEL, FOTO, 'x'.repeat(MAX_PIE_IMAGEN + 1))).toBeNull();
    });
});

describe('payloadDeBotones con foto', () => {
    const botones = [{ id: 'sm_vt_si', title: 'Sí, procedemos' }, { id: 'sm_vt_no', title: 'No' }];
    it('encabezado image cuando hay URL https', () => {
        const p = payloadDeBotones(TEL, '¿Procedemos?', botones, { imagenUrl: FOTO }) as any;
        expect(p.interactive.header).toEqual({ type: 'image', image: { link: FOTO } });
        expect(p.interactive.action.buttons).toHaveLength(2);
    });
    it('sin imagen (o URL inválida) el payload es el de siempre', () => {
        expect((payloadDeBotones(TEL, 'x', botones) as any).interactive.header).toBeUndefined();
        expect((payloadDeBotones(TEL, 'x', botones, { imagenUrl: 'http://x' }) as any).interactive.header).toBeUndefined();
    });
});

describe('envío', () => {
    beforeAll(() => { process.env.WHATSAPP_TOKEN_ENC_KEY = 'clave-de-prueba'; });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('sendImage hace POST a /messages con el payload de imagen', async () => {
        const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ messages: [{ id: 'wamid.img' }] }) }));
        vi.stubGlobal('fetch', fetchMock);
        const integration = { phone_number_id: 'pn-1', access_token_encrypted: encryptToken('tok') } as any;
        const r = await sendImage(integration, TEL, FOTO, 'pie');
        expect(r).toEqual({ ok: true, waMessageId: 'wamid.img' });
        const body = JSON.parse((fetchMock.mock.calls[0] as any)[1].body);
        expect(body.type).toBe('image');
        expect(body.image).toEqual({ link: FOTO, caption: 'pie' });
    });

    it('sendImage que no cabe no llama a Meta (quien llama manda texto)', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        const integration = { phone_number_id: 'pn-1', access_token_encrypted: encryptToken('tok') } as any;
        expect(await sendImage(integration, TEL, 'http://inseguro/x.jpg', 'pie')).toEqual({ ok: false, error: 'no_cabe_como_imagen' });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('Meta rechaza la imagen → ok:false con su error', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'media url not reachable' } }) })));
        const integration = { phone_number_id: 'pn-1', access_token_encrypted: encryptToken('tok') } as any;
        expect(await sendImage(integration, TEL, FOTO, 'pie')).toEqual({ ok: false, error: 'media url not reachable' });
    });

    it('botones con foto: el encabezado viaja; con más de 3 opciones va lista sin foto', async () => {
        const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ messages: [{ id: 'w' }] }) }));
        vi.stubGlobal('fetch', fetchMock);
        const integration = { phone_number_id: 'pn-1', access_token_encrypted: encryptToken('tok') } as any;
        await sendInteractiveButtons(integration, TEL, 'cuerpo', [{ id: 'a', title: 'A' }], { imagenUrl: FOTO });
        expect(JSON.parse((fetchMock.mock.calls[0] as any)[1].body).interactive.header.type).toBe('image');
        await sendInteractiveButtons(integration, TEL, 'cuerpo',
            [1, 2, 3, 4].map((i) => ({ id: `o${i}`, title: `Opción ${i}` })), { imagenUrl: FOTO });
        const lista = JSON.parse((fetchMock.mock.calls[1] as any)[1].body);
        expect(lista.interactive.type).toBe('list');
        expect(lista.interactive.header).toBeUndefined();
    });
});
