/**
 * El alta de una escuela por Embedded Signup (F1 del spec).
 *
 * Convierte el `code` que devuelve el diálogo de Meta en una integración viva:
 * canjea el token del negocio, resuelve a qué WABA y a qué número pertenece,
 * suscribe la app a los webhooks de esa cuenta y lo guarda todo cifrado.
 *
 * El orden importa y no es casual: **primero se verifica todo contra Meta y al
 * final se escribe**. Si se escribiera primero, un fallo a mitad dejaría una
 * escuela "conectada" que no puede enviar ni recibir — y eso no se nota hasta
 * que una familia escribe y nadie responde.
 *
 * Ver `docs/specs/whatsapp-alta-de-escuelas-y-buzon.md`.
 */

import { supabase } from '../config/supabase';
import { encryptToken, decryptToken } from './whatsapp.service';

const GRAPH = `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION || 'v21.0'}`;
const APP_ID = process.env.META_APP_ID || '';
const APP_SECRET = process.env.WHATSAPP_APP_SECRET || '';

export interface DatosDeSesion {
    /** `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING` cuando fue Coexistence. */
    event?: string;
    waba_id?: string;
    phone_number_id?: string;
    business_id?: string;
}

export type ResultadoAlta =
    | { ok: true; integrationId: string; displayPhoneNumber: string | null; coexistence: boolean }
    | { ok: false; error: string; detalle?: string };

/** Canjea el código de un solo uso por el token del negocio. */
async function canjearCodigo(code: string): Promise<{ token: string } | { error: string }> {
    const url = `${GRAPH}/oauth/access_token`
        + `?client_id=${encodeURIComponent(APP_ID)}`
        + `&client_secret=${encodeURIComponent(APP_SECRET)}`
        + `&code=${encodeURIComponent(code)}`;
    const r = await fetch(url);
    const j: any = await r.json();
    if (!r.ok || !j?.access_token) {
        // El código vence en minutos y es de un solo uso: el error mas comun
        // aca es que la escuela dejo el dialogo abierto un rato.
        return { error: j?.error?.message || 'No se pudo canjear el código' };
    }
    return { token: j.access_token as string };
}

/**
 * Resuelve el WABA y el número.
 *
 * La información de sesión del diálogo los trae, pero llega por `postMessage`
 * desde el navegador: es un dato que el cliente puede inventar. Se contrasta
 * SIEMPRE contra Graph con el token recién canjeado — lo que el token alcanza
 * de verdad es lo único que vale.
 */
async function resolverActivos(
    token: string,
    sesion: DatosDeSesion | null,
): Promise<{ wabaId: string; phoneNumberId: string; display: string | null } | { error: string }> {
    const wabaId = sesion?.waba_id;
    if (!wabaId) return { error: 'La sesión no trajo el identificador de la cuenta de WhatsApp' };

    const r = await fetch(
        `${GRAPH}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name`,
        { headers: { Authorization: `Bearer ${token}` } },
    );
    const j: any = await r.json();
    if (!r.ok) {
        return { error: j?.error?.message || 'El token no alcanza esa cuenta de WhatsApp' };
    }

    const numeros = (j.data ?? []) as any[];
    if (!numeros.length) return { error: 'Esa cuenta de WhatsApp no tiene números' };

    // Si la sesión dijo cuál, se respeta — pero solo si de verdad está en la
    // cuenta. Si no, el primero.
    const elegido = numeros.find((n) => n.id === sesion?.phone_number_id) ?? numeros[0];
    return { wabaId, phoneNumberId: elegido.id, display: elegido.display_phone_number ?? null };
}

/** Suscribe la app a los webhooks de ese WABA. Sin esto no llega un solo mensaje. */
async function suscribirWebhooks(token: string, wabaId: string): Promise<boolean> {
    const r = await fetch(`${GRAPH}/${wabaId}/subscribed_apps`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
    });
    return r.ok;
}

export async function conectarEscuela(
    schoolId: string,
    code: string,
    sesion: DatosDeSesion | null,
    conectadoPor: string,
): Promise<ResultadoAlta> {
    if (!APP_ID || !APP_SECRET) {
        return { ok: false, error: 'configuracion_incompleta',
                 detalle: 'Faltan META_APP_ID o WHATSAPP_APP_SECRET en el servidor.' };
    }

    // 1. ¿La escuela está libre? Se comprueba ANTES de gastar el código, que es
    //    de un solo uso: fallar despues obligaria a la escuela a repetir todo
    //    el dialogo de Meta.
    const { data: yaTiene } = await supabase
        .from('school_whatsapp_integrations')
        .select('id, display_phone_number')
        .eq('school_id', schoolId)
        .maybeSingle();
    if (yaTiene) {
        return { ok: false, error: 'ya_conectada',
                 detalle: `Esta escuela ya tiene ${(yaTiene as any).display_phone_number ?? 'un número'} conectado.` };
    }

    // 2. Canjear.
    const canje = await canjearCodigo(code);
    if ('error' in canje) return { ok: false, error: 'canje_fallido', detalle: canje.error };

    // 3. Resolver contra Graph, no contra lo que dijo el navegador.
    const activos = await resolverActivos(canje.token, sesion);
    if ('error' in activos) return { ok: false, error: 'activos_no_resueltos', detalle: activos.error };

    // 4. Un número no puede atender a dos escuelas: el webhook rutea por
    //    phone_number_id y no sabria a cual entregar.
    const { data: ocupado } = await supabase
        .from('school_whatsapp_integrations')
        .select('school_id')
        .eq('phone_number_id', activos.phoneNumberId)
        .maybeSingle();
    if (ocupado) {
        return { ok: false, error: 'numero_ocupado',
                 detalle: 'Ese número ya está conectado a otra escuela en SportMaps.' };
    }

    // 5. Webhooks. Si esto falla la integracion no sirve de nada, asi que se
    //    corta antes de escribir en vez de dejar un canal mudo.
    if (!(await suscribirWebhooks(canje.token, activos.wabaId))) {
        return { ok: false, error: 'webhooks_fallidos',
                 detalle: 'No se pudo suscribir la app a los webhooks de esa cuenta.' };
    }

    // 6. Cifrar, con round-trip: si el descifrado no devuelve lo mismo, el
    //    token quedaria guardado e inservible.
    const cifrado = encryptToken(canje.token);
    if (decryptToken(cifrado) !== canje.token) {
        return { ok: false, error: 'cifrado_fallido' };
    }

    // 7. Recién ahora se escribe.
    const ahora = new Date().toISOString();
    const { data: creada, error: e1 } = await supabase
        .from('school_whatsapp_integrations')
        .insert({
            school_id: schoolId,
            phone_number_id: activos.phoneNumberId,
            waba_id: activos.wabaId,
            business_id: sesion?.business_id ?? null,
            display_phone_number: activos.display,
            access_token_encrypted: cifrado,
            status: 'active',
            connected_by: conectadoPor,
            connected_at: ahora,
            token_rotated_at: ahora,
        })
        .select('id')
        .single();
    if (e1 || !creada) {
        return { ok: false, error: 'no_se_pudo_guardar', detalle: e1?.message };
    }

    // `mode` tiene DEFAULT 'assisted' en la tabla. El modo asistido deja el
    // borrador esperando aprobacion: con el buzon ya construido eso funciona,
    // pero una escuela que estrena el canal no sabe que tiene que entrar a
    // aprobar, y sus familias se quedarian sin respuesta el primer dia. Arranca
    // en `auto` y que la escuela decida cambiarlo.
    const { error: e2 } = await supabase.from('whatsapp_settings').insert({
        integration_id: creada.id,
        mode: 'auto',
        ai_enabled: true,
    });
    if (e2) {
        return { ok: false, error: 'sin_ajustes', detalle: e2.message };
    }

    return {
        ok: true,
        integrationId: creada.id,
        displayPhoneNumber: activos.display,
        coexistence: sesion?.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING',
    };
}
