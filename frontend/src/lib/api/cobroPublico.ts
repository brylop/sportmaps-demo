/**
 * Cliente del enlace público de un cobro (/p/:token). Sin sesión: el token es
 * la credencial (bffClient en modo 'public', no adjunta JWT ni x-school-id).
 * Contrato: bff/src/routes/cobro-enlace-publico.routes.ts.
 */

import { bffClient } from '@/lib/api/bffClient';
import type { DatosFactura, ResumenFacturaPublica } from '@/lib/facturaElectronica';

export type EstadoCobro = 'pendiente' | 'vencido' | 'en_revision' | 'pagado' | 'abono' | 'anulado' | 'rechazado';

export interface VistaCobroPublico {
    escuela: { nombre: string; logoUrl: string | null };
    concepto: string;
    periodo: string | null;
    deportista: string | null;
    estado: EstadoCobro;
    monto: number;
    fechaVencimiento: string | null;
    fechaPago: string | null;
    enlaceVenceEn: string;
    enLinea: null | { proveedor: 'wompi'; recargoPct: number; recargo: number; total: number };
    transferencia: {
        cuentas: { tipo: string; titular: string | null; numero: string }[];
        whatsappComprobante: string | null;
        /** Imagen del QR de pago que cargó la escuela (p.ej. Bre-B). */
        qrEscuelaUrl?: string | null;
        /**
         * Link de pago genérico de la escuela (p.ej. Wompi de Dynasty). El
         * acudiente escribe el valor; la escuela concilia con el comprobante.
         * Opcional: un BFF anterior no lo manda.
         */
        linkDePago?: string | null;
    };
    /** Otros cobros por pagar del mismo pagador, cada uno con su enlace. */
    otrosPendientes?: {
        token: string;
        concepto: string;
        periodo: string | null;
        deportista: string | null;
        monto: number;
        fechaVencimiento: string | null;
        vencido: boolean;
    }[];
}

export interface CheckoutCobroPublico {
    provider: 'wompi';
    publicKey: string;
    reference: string;
    signature: string;
    amountInCents: number;
    total: number;
    reused: boolean;
}

const enc = encodeURIComponent;

export const obtenerCobroPublico = (token: string) =>
    bffClient.get<VistaCobroPublico>(`/api/v1/public/cobro/${enc(token)}`, undefined, 'public');

export const iniciarPagoCobroPublico = (token: string) =>
    bffClient.post<CheckoutCobroPublico>(`/api/v1/public/cobro/${enc(token)}/pagar`, {}, undefined, 'public');

/**
 * Abre el Widget de Wompi con la firma que calculó el BFF.
 *
 * No reusa openWompiCheckout (lib/api/wompi.ts) a propósito: ese camino arma
 * customerData con el correo del usuario logueado y, si falta la firma, la pide
 * a la Edge Function con el JWT de la sesión — aquí no hay sesión ni correo
 * (el enlace no expone datos del acudiente). Sin customerData el Widget los pide.
 */
export function abrirWidgetWompi(
    c: CheckoutCobroPublico,
    redirectUrl: string,
): Promise<{ status?: string } | null> | null {
    // Devuelve null SIN abrir si el script del Widget no cargó (index.html).
    // Si abre, la promesa resuelve solo cuando hay transacción: si la familia
    // cierra el Widget sin pagar, Wompi no llama al callback y la promesa queda
    // pendiente — por eso el llamador no bloquea la UI esperándola.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const WidgetCheckout = (window as any).WidgetCheckout;
    if (!WidgetCheckout) return null;
    let checkout: { open: (cb: (r: { transaction?: { status?: string } }) => void) => void };
    try {
        checkout = new WidgetCheckout({
            currency: 'COP',
            amountInCents: c.amountInCents,
            reference: c.reference,
            publicKey: c.publicKey,
            signature: { integrity: c.signature },
            redirectUrl,
        });
    } catch {
        return null;
    }
    return new Promise((resolve) => {
        checkout.open((r) => resolve(r?.transaction ?? null));
    });
}

// ─── Factura electrónica del pagador de este cobro ──────────────────────────
// Resumen SIEMPRE enmascarado; guardar va por el token (el cuerpo no puede
// elegir a quién se le guardan los datos).

export const obtenerFacturaPublica = (token: string) =>
    bffClient.get<ResumenFacturaPublica>(`/api/v1/public/cobro/${enc(token)}/factura`, undefined, 'public');

export const guardarFacturaPublica = (token: string, datos: DatosFactura) =>
    bffClient.put<{ ok: true }>(`/api/v1/public/cobro/${enc(token)}/factura`, datos, undefined, 'public');
