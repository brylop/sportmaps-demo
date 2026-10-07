/**
 * El Widget de Wompi abre SOLO con la llave pública y la firma que entrega el BFF.
 *
 * Dynasty (comercio real 1298966) cayó al comercio sandbox 11981889 con "La firma es
 * inválida" desde el 27-ago-2026: la llave salía de VITE_WOMPI_PUBLIC_KEY (pub_test_)
 * o de un BFF de otro ambiente, y la firma de la Edge Function wompi-sign (secret de
 * producción). Estas pruebas fijan que no queda ningún respaldo de ese tipo.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    openWompiCheckout,
    checkTransactionStatus,
    credencialesDelWidget,
    mensajeCheckoutNoDisponible,
    WompiCheckoutNoDisponibleError,
} from '@/lib/api/wompi';

const BASE = { reference: 'SCH-X-1', amountInCents: 15750000, customerEmail: 'a@b.co', customerName: 'Acudiente' };

let widgetConfigs: Record<string, unknown>[] = [];
const fetchSpy = vi.fn();

beforeEach(() => {
    widgetConfigs = [];
    (window as any).WidgetCheckout = class {
        constructor(cfg: Record<string, unknown>) { widgetConfigs.push(cfg); }
        open(cb: (r: { transaction: unknown }) => void) {
            cb({ transaction: { id: 'tx', status: 'APPROVED', reference: BASE.reference } });
        }
    };
    fetchSpy.mockReset();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubEnv('VITE_WOMPI_PUBLIC_KEY', 'pub_test_llave_de_build');
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    delete (window as any).WidgetCheckout;
});

describe('openWompiCheckout: llave y firma solo del BFF', () => {
    it('usa exactamente la llave y la firma del BFF', async () => {
        const tx = await openWompiCheckout({ ...BASE, publicKey: 'pub_prod_dynasty', signature: 'firma-del-bff' });
        expect(tx?.status).toBe('APPROVED');
        expect(widgetConfigs).toHaveLength(1);
        expect(widgetConfigs[0].publicKey).toBe('pub_prod_dynasty');
        expect(widgetConfigs[0].signature).toEqual({ integrity: 'firma-del-bff' });
        expect(widgetConfigs[0].amountInCents).toBe(15750000);
        // Nunca pide la firma a la Edge Function.
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('sin llave del BFF NO cae a VITE_WOMPI_PUBLIC_KEY: no abre y lanza', async () => {
        await expect(openWompiCheckout({ ...BASE, publicKey: null, signature: 'firma' }))
            .rejects.toBeInstanceOf(WompiCheckoutNoDisponibleError);
        expect(widgetConfigs).toHaveLength(0);
    });

    it('sin firma del BFF NO llama a la Edge Function wompi-sign: no abre y lanza', async () => {
        await expect(openWompiCheckout({ ...BASE, publicKey: 'pub_prod_dynasty', signature: undefined }))
            .rejects.toMatchObject({ code: 'sin_firma_del_bff' });
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(widgetConfigs).toHaveLength(0);
    });

    it('credencialesDelWidget rechaza vacíos', () => {
        expect(() => credencialesDelWidget({ publicKey: '  ', signature: 'x' })).toThrow(WompiCheckoutNoDisponibleError);
        expect(() => credencialesDelWidget({ publicKey: 'pub_prod_x', signature: '' })).toThrow(WompiCheckoutNoDisponibleError);
    });
});

describe('mensajeCheckoutNoDisponible', () => {
    it('pasa el mensaje del cierre (frontend o 503 wompi_* del BFF) y nada más', () => {
        expect(mensajeCheckoutNoDisponible(new WompiCheckoutNoDisponibleError('sin_firma_del_bff', 'm1'))).toBe('m1');
        const bff = Object.assign(new Error('Entra por app.sportmaps.co'), { status: 503, body: { code: 'wompi_llave_prueba_escuela_real' } });
        expect(mensajeCheckoutNoDisponible(bff)).toBe('Entra por app.sportmaps.co');
        expect(mensajeCheckoutNoDisponible(new Error('otra cosa'))).toBeNull();
    });
});

describe('checkTransactionStatus: el ambiente sale del redirect de Wompi, no de la llave de build', () => {
    const ok = { ok: true, json: async () => ({ data: { id: 't', status: 'APPROVED', reference: 'r', amount_in_cents: 1, currency: 'COP', created_at: 'x' } }) };

    it('env=test → sandbox', async () => {
        fetchSpy.mockResolvedValue(ok);
        await checkTransactionStatus('1-2-3', 'test');
        expect(fetchSpy.mock.calls[0][0]).toContain('https://sandbox.wompi.co/');
    });

    it('sin env → producción primero (aunque la llave de build sea pub_test_)', async () => {
        fetchSpy.mockResolvedValue(ok);
        await checkTransactionStatus('1298966-1-1');
        expect(fetchSpy.mock.calls[0][0]).toContain('https://production.wompi.co/');
    });
});

describe('ningún archivo del frontend lee VITE_WOMPI_PUBLIC_KEY ni llama a wompi-sign', () => {
    const SRC = join(__dirname, '..');
    const archivos: string[] = [];
    const recorrer = (dir: string) => {
        for (const n of readdirSync(dir)) {
            const p = join(dir, n);
            if (statSync(p).isDirectory()) { if (n !== 'test') recorrer(p); continue; }
            if (/\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n)) archivos.push(p);
        }
    };
    recorrer(SRC);

    it.each(['env.VITE_WOMPI_PUBLIC_KEY', 'functions/v1/wompi-sign'])('%s no aparece en el código', (patron) => {
        const con = archivos.filter((f) => readFileSync(f, 'utf8').includes(patron));
        expect(con).toEqual([]);
    }, 30_000); // lee ~todo src/: con la suite completa en paralelo pasa de 5 s
});
