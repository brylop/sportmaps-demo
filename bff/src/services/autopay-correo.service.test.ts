/**
 * Copia por correo de los avisos del débito automático (spec §10.1).
 * Fija: apagado por defecto, clave idempotente (re-aviso por subida sí sale, el
 * mismo aviso dos veces el mismo día no), enlace absoluto y que nunca lance.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../config/supabase', () => ({ supabase: {} }));

import {
    claveCorreoAutopay, correoAutopayActivo, enviarCorreoDeAviso, respaldoDeAviso, tipoDeAviso,
    type CorreoAutopayDeps,
} from './autopay-correo.service';
import type { Aviso } from './autopay.service';

const ON = { AUTOPAY_EMAIL_NOTICES: 'true', FRONTEND_URL: 'https://app.ejemplo.test/' } as NodeJS.ProcessEnv;
const NOW = new Date('2026-10-08T03:00:00Z'); // 7 de octubre, 10 p. m. en Colombia

const aviso = (data: Record<string, unknown>, link = '/my-payments#debito'): Aviso => ({
    userId: 'u-1', schoolId: 's-1', title: 'Débito automático programado',
    message: 'El jueves 8 de octubre debitaremos $157.500 de tu Nequi •••• 5678.', link, data,
});

function deps(over: Partial<CorreoAutopayDeps> = {}): CorreoAutopayDeps & { enviar: ReturnType<typeof vi.fn> } {
    return {
        correoDe: async () => 'familia@ejemplo.test',
        enviar: vi.fn(async () => 'enviado' as const),
        now: () => NOW,
        ...over,
    } as any;
}

describe('autopay-correo', () => {
    it('está apagado si AUTOPAY_EMAIL_NOTICES no es exactamente "true"', async () => {
        expect(correoAutopayActivo({} as NodeJS.ProcessEnv)).toBe(false);
        expect(correoAutopayActivo({ AUTOPAY_EMAIL_NOTICES: '1' } as NodeJS.ProcessEnv)).toBe(false);
        const d = deps();
        expect(await enviarCorreoDeAviso(aviso({ kind: 'autopay_notice' }), d, {} as NodeJS.ProcessEnv)).toBe('apagado');
        expect(d.enviar).not.toHaveBeenCalled();
    });

    it('la clave usa el día de Colombia y el total del aviso previo', () => {
        const a = aviso({ kind: 'autopay_notice', cycle_id: 'c-1', payment_id: 'p-1', total: 157500 });
        expect(claveCorreoAutopay(a, NOW)).toBe('autopay:autopay_notice:c-1:u-1:2026-10-07:157500');
        // Re-aviso por subida: otra clave → sí sale.
        const subida = aviso({ kind: 'autopay_notice', cycle_id: 'c-1', payment_id: 'p-1', total: 165000 });
        expect(claveCorreoAutopay(subida, NOW)).not.toBe(claveCorreoAutopay(a, NOW));
        // Otros avisos: sin total, por cobro.
        expect(claveCorreoAutopay(aviso({ kind: 'autopay_attempt_failed', payment_id: 'p-1' }), NOW))
            .toBe('autopay:autopay_attempt_failed:p-1:u-1:2026-10-07');
    });

    it('un kind raro no se cuela en el tipo del log', () => {
        expect(tipoDeAviso(aviso({ kind: "x'; drop" }))).toBe('autopay');
        expect(tipoDeAviso(aviso({}))).toBe('autopay');
    });

    it('el enlace relativo se vuelve absoluto con FRONTEND_URL', () => {
        const r = respaldoDeAviso(aviso({ kind: 'autopay_attempt_failed' }, '/my-payments?pay=p-1'), ON);
        expect(r.enlace).toEqual({ url: 'https://app.ejemplo.test/my-payments?pay=p-1', texto: 'Pagar ahora' });
        expect(r.subject).toBe('Débito automático programado');
        expect(r.lineas[0]).toContain('$157.500');
    });

    it('manda al correo del destinatario, sin plantilla y con el cobro como referencia', async () => {
        const d = deps();
        const r = await enviarCorreoDeAviso(aviso({ kind: 'autopay_notice', cycle_id: 'c-1', payment_id: 'p-1', total: 1 }), d, ON);
        expect(r).toBe('enviado');
        const arg = d.enviar.mock.calls[0][0];
        expect(arg.destinos).toEqual(['familia@ejemplo.test']);
        expect(arg.plantilla).toBeNull();
        expect(arg.refId).toBe('p-1');
        expect(arg.tipo).toBe('autopay_notice');
        expect(arg.schoolId).toBe('s-1');
    });

    it('sin correo no manda nada', async () => {
        const d = deps({ correoDe: async () => null });
        expect(await enviarCorreoDeAviso(aviso({ kind: 'autopay_notice' }), d, ON)).toBe('sin_correo');
        expect(d.enviar).not.toHaveBeenCalled();
    });

    it('nunca lanza', async () => {
        const d = deps({ correoDe: async () => { throw new Error('caída'); } });
        expect(await enviarCorreoDeAviso(aviso({ kind: 'autopay_notice' }), d, ON)).toBe('fallo');
    });

    it('el duplicado (otro BFF ya lo mandó) se respeta', async () => {
        const d = deps({ enviar: vi.fn(async () => 'duplicado' as const) as any });
        expect(await enviarCorreoDeAviso(aviso({ kind: 'autopay_notice' }), d, ON)).toBe('duplicado');
    });
});
