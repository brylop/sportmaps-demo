/**
 * autopay-correo.service — Copia por correo de los avisos del débito automático.
 *
 * Spec: docs/specs/debito-automatico.md §10.1 («In-app + push + correo»). F2 dejó
 * solo in-app + push; esto agrega el correo SIN tocar la regla D4: el aviso previo
 * cuenta como entregado cuando entra la notificación in-app, no cuando sale el
 * correo. El correo es una copia, nunca un requisito para debitar.
 *
 * APAGADO por defecto: solo sale si el BFF tiene AUTOPAY_EMAIL_NOTICES=true.
 *
 * Idempotencia: `enviarConReserva` (email_sends con id determinístico). Los tres
 * BFF comparten la base; si dos corren el mismo aviso, el segundo choca con el PK
 * y no manda nada. La clave lleva el tipo, la referencia (ciclo o cobro), el
 * destinatario y el día en Colombia; el aviso previo lleva además el total, así un
 * re-aviso por subida de la mensualidad sí sale.
 */

import { supabase } from '../config/supabase';
import { enviarConReserva, fechaColombia, type Respaldo } from './avisos-correo.service';
import type { Aviso } from './autopay.service';

export function correoAutopayActivo(env: NodeJS.ProcessEnv = process.env): boolean {
    return env.AUTOPAY_EMAIL_NOTICES === 'true';
}

const frontendUrl = (env: NodeJS.ProcessEnv = process.env) =>
    (env.FRONTEND_URL || 'https://app.sportmaps.co').replace(/\/$/, '');

/** Tipo del aviso ('autopay_notice', 'autopay_attempt_failed', …) o 'autopay'. */
export function tipoDeAviso(a: Aviso): string {
    const k = a.data?.kind;
    return typeof k === 'string' && /^autopay_[a-z_]+$/.test(k) ? k : 'autopay';
}

/** Clave determinística del envío (ver cabecera). */
export function claveCorreoAutopay(a: Aviso, ahora: Date | number = Date.now()): string {
    const ref = String(a.data?.cycle_id ?? a.data?.payment_id ?? 'sin-ref');
    const tipo = tipoDeAviso(a);
    const extra = tipo === 'autopay_notice' && a.data?.total != null ? `:${String(a.data.total)}` : '';
    return `autopay:${tipo}:${ref}:${a.userId}:${fechaColombia(ahora)}${extra}`;
}

const TEXTO_BOTON: Record<string, string> = {
    autopay_notice: 'Ver el débito en Mis Pagos',
    autopay_attempt_failed: 'Pagar ahora',
    autopay_exhausted: 'Pagar ahora',
    autopay_over_max_amount: 'Pagar ahora',
};

/** El correo, armado con el mismo texto del aviso in-app. */
export function respaldoDeAviso(a: Aviso, env: NodeJS.ProcessEnv = process.env): Respaldo {
    const link = a.link.startsWith('/') ? `${frontendUrl(env)}${a.link}` : a.link;
    return {
        subject: a.title,
        titulo: a.title,
        lineas: [a.message],
        enlace: { url: link, texto: TEXTO_BOTON[tipoDeAviso(a)] ?? 'Abrir SportMaps' },
    };
}

export interface CorreoAutopayDeps {
    correoDe: (userId: string) => Promise<string | null>;
    enviar: typeof enviarConReserva;
    now: () => Date;
}

const depsReales: CorreoAutopayDeps = {
    correoDe: async (userId) => {
        const { data } = await supabase.from('profiles').select('email').eq('id', userId).maybeSingle();
        const email = (data as any)?.email;
        return typeof email === 'string' && email.includes('@') ? email : null;
    },
    // Envoltura: los tests que mockean avisos-correo sin enviarConReserva no
    // rompen al importar la cadena de autopay (el acceso queda para el envío).
    enviar: (...args) => enviarConReserva(...args),
    now: () => new Date(),
};

/**
 * Manda la copia por correo de un aviso ya entregado in-app. Nunca lanza.
 * Devuelve qué pasó, para los tests y el log.
 */
export async function enviarCorreoDeAviso(
    a: Aviso,
    deps: CorreoAutopayDeps = depsReales,
    env: NodeJS.ProcessEnv = process.env,
): Promise<'apagado' | 'sin_correo' | 'enviado' | 'duplicado' | 'fallo'> {
    if (!correoAutopayActivo(env)) return 'apagado';
    try {
        const email = await deps.correoDe(a.userId);
        if (!email) return 'sin_correo';
        return await deps.enviar({
            clave: claveCorreoAutopay(a, deps.now()),
            tipo: tipoDeAviso(a),
            schoolId: a.schoolId,
            refId: typeof a.data?.payment_id === 'string' ? a.data.payment_id : null,
            destinos: [email],
            data: {},
            respaldo: respaldoDeAviso(a, env),
            // Sin plantilla en send-email: va el HTML del respaldo.
            plantilla: null,
        });
    } catch (e: any) {
        console.warn('[autopay-correo] no salió el correo', { userId: a.userId, tipo: tipoDeAviso(a), err: e?.message });
        return 'fallo';
    }
}
