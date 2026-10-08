/**
 * Cómo puede pagar el acudiente.
 *
 * El bot sabía decir *cuánto* debe pero no *cómo* pagarlo: sus únicas dos
 * herramientas eran consultar el estado y escalar a un humano. Así que a un
 * «medios de pago» —la pregunta más obvia después de saber que debes algo—
 * respondía «voy a pasar tu caso con una persona del equipo». Medido en el chat
 * de prueba el 2026-09-14.
 *
 * Devuelve hasta tres caminos, y siempre al menos uno:
 *
 *  1. Transferencia a las cuentas de la escuela (si las tiene cargadas).
 *  2. Pagar en línea: el link de pago de la escuela (tipo 'payment_link' en
 *     payment_accounts, p.ej. Wompi de Dynasty) o, si no tiene, desde la app.
 *  3. Mandar el comprobante **por acá mismo** — que es el que la gente no
 *     descubre sola y el que menos fricción tiene: ya está en el chat.
 */

import { supabase } from '../config/supabase';
import { normalizeDestination } from './receipt-verdict';
import {
    AVISO_LINK_DE_PAGO, TEXTO_BOTON_LINK_DE_PAGO, cuentaAplicaA, linkDePago, parseCuentasDePago, type CategoriaCobro,
} from './payment-accounts';

const TIPO_LEGIBLE: Record<string, string> = {
    breb: 'Bre-B',
    nequi: 'Nequi',
    daviplata: 'Daviplata',
    transfer_key: 'Llave de transferencia',
};

const sinTildes = (t: string) => t.normalize('NFD').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Cómo se nombra la llave al acudiente: el tipo («Bre-B») más lo que la escuela
 * escribió en la etiqueta si dice algo más. Dynasty 2026-10-07: sus tres Bre-B
 * son de Bancolombia → etiqueta «Bre-B Bancolombia» → «Bre-B Bancolombia»;
 * etiqueta «Bancolombia» → «Bre-B Bancolombia»; etiqueta vacía o «Bre-B» →
 * «Bre-B». Antes la etiqueta se ignoraba en las llaves con tipo conocido. Pura.
 */
export function nombreDeCuenta(tipo: string, etiqueta: string | null | undefined): string {
    const base = TIPO_LEGIBLE[tipo];
    const label = String(etiqueta ?? '').replace(/\s+/g, ' ').trim();
    if (!base) return label || 'Cuenta';
    if (!label || sinTildes(label) === sinTildes(base)) return base;
    return sinTildes(label).includes(sinTildes(base)) ? label : `${base} ${label}`;
}

export interface MediosDePago {
    cuentas: { tipo: string; titular: string | null; numero: string }[];
    /**
     * El link de pago de la escuela, o null. NUNCA /my-payments: pide iniciar
     * sesión y una familia por WhatsApp no la tiene abierta (Dynasty 28-sep →
     * 08-oct: 3 de 4 respuestas de medios de pago mandaron ahí). Para pagar un
     * cobro concreto va su /p/:token (`mediosDePagoDeFamilia`).
     */
    enlace_para_pagar: string | null;
    /**
     * Link de pago genérico de la escuela (payment_accounts type 'payment_link'),
     * o null. Se separa de `enlace_para_pagar` para que la página pública y el
     * correo lo muestren como botón propio.
     */
    link_de_pago: string | null;
    /** Solo si hay link: qué hacer con él (va al modelo del bot tal cual). */
    instrucciones_del_enlace: string | null;
    puede_enviar_comprobante_por_whatsapp: boolean;
}

// El numero va COMPLETO, a proposito.
//
// El primer intento lo enmascaraba por costumbre, y eso rompe el unico uso que
// tiene: el acudiente necesita el numero entero para transferir. Ademas no es
// un dato a proteger — es la cuenta de la escuela, que ella publica para que
// le paguen. Enmascararla seria confundir "dato de pago" con "dato sensible".

/**
 * `categoria`: el cobro que se va a pagar, si se sabe. El bot NO lo sabe (le
 * preguntan «cómo pago» en general), así que no lo pasa y solo recibe las
 * llaves generales: una llave restringida (`only_for`, p.ej. el Nequi personal
 * de la dueña de Dynasty, solo para inscripciones) nunca se ofrece para pagar
 * la mensualidad. La página pública del cobro (/p/:token) sí lo sabe y lo pasa.
 */
export async function mediosDePago(
    schoolId: string,
    opts: { categoria?: CategoriaCobro | null } = {},
): Promise<MediosDePago> {
    const cuentas: MediosDePago['cuentas'] = [];
    let link: string | null = null;

    // `account_holder` NO existe (la columna es `bank_account_holder`). Con ella
    // en el select la consulta fallaba entera, `cfg` llegaba null y el bot nunca
    // dio una sola cuenta: en el chat de prueba del 2026-09-16 Escuela Pruebas
    // tenia dos cuentas cargadas y respondio solo «en linea» y «por este chat».
    // El error se registra para que un nombre de columna no vuelva a callarlo.
    const { data: cfg, error } = await supabase
        .from('school_settings')
        .select('nequi_number, bank_account_number, breb_key, payment_accounts, bank_name, bank_account_holder, bank_titular_name')
        .eq('school_id', schoolId)
        .maybeSingle();
    if (error) console.error('[whatsapp-medios-de-pago] no se pudo leer school_settings', { schoolId, error: error.message });

    const c = cfg as any;
    if (c) c.account_holder = c.bank_account_holder || c.bank_titular_name || null;
    if (c) {
        // `payment_accounts` es la fuente nueva; las columnas sueltas son el
        // store viejo. Conviven, asi que se leen las dos y se deduplica por
        // numero — si no, la escuela que migro veria su cuenta dos veces.
        const vistos = new Set<string>();
        const agregar = (tipo: string, numero: unknown, titular?: unknown) => {
            const n = String(numero ?? '').trim();
            const clave = normalizeDestination(n);
            if (!n || !clave || vistos.has(clave)) return;
            vistos.add(clave);
            cuentas.push({ tipo, titular: (titular as string) ?? c.account_holder ?? null, numero: n });
        };

        // parseCuentasDePago ya deja afuera los links de pago: una URL no es una
        // cuenta para transferir. El link se lee aparte.
        link = linkDePago(c.payment_accounts, opts.categoria ?? null);
        const lista = parseCuentasDePago(c.payment_accounts);
        // Las restringidas que no aplican se marcan como vistas ANTES de leer las
        // columnas sueltas: si alguna espejara esa llave, no se cuela por ahí.
        for (const a of lista) {
            if (!cuentaAplicaA(a, opts.categoria ?? null)) {
                const clave = normalizeDestination(a.value);
                if (clave) vistos.add(clave);
            }
        }
        for (const a of lista) {
            // `active: false` solo oculta la cuenta, no la borra.
            if (!a.active || !cuentaAplicaA(a, opts.categoria ?? null)) continue;
            // La clave del valor es `value` (mig 20260809095613). Antes se leía
            // `number`/`numero`, que no existen: ninguna llave de la lista llegaba
            // al bot y solo salían las columnas sueltas.
            agregar(nombreDeCuenta(a.type, a.label), a.value);
        }
        agregar('Nequi', c.nequi_number);
        agregar(c.bank_name ? String(c.bank_name) : 'Cuenta bancaria', c.bank_account_number);
        agregar('Bre-B', c.breb_key);
    }

    // Con link de pago, ese es el enlace para pagar en línea. Sin link, null:
    // nunca una ruta de la app que pide iniciar sesión.
    return {
        cuentas,
        enlace_para_pagar: link,
        link_de_pago: link,
        instrucciones_del_enlace: link ? `${TEXTO_BOTON_LINK_DE_PAGO}. ${AVISO_LINK_DE_PAGO}.` : null,
        puede_enviar_comprobante_por_whatsapp: true,
    };
}

/** Un cobro pendiente con su enlace público para pagarlo (/p/:token o Wompi con monto). */
export interface CobroParaPagar {
    concepto: string | null;
    monto: number | null;
    vence: string | null;
    enlace_pago: string | null;
    enlace_instrucciones?: string | null;
}

/**
 * Los medios de pago + los cobros pendientes de la familia con el enlace de
 * cada uno (`conEnlacesDePago`: el link de Wompi con el monto si la escuela lo
 * tiene, si no /p/:token, que no pide sesión). Para la familia identificada;
 * sin `parentId` son solo los medios. Nunca lanza por los cobros.
 */
export async function mediosDePagoDeFamilia(
    schoolId: string,
    parentId: string | null | undefined,
    aviso?: { integrationId: string; waPhone: string },
): Promise<MediosDePago & { cobros_pendientes: CobroParaPagar[] }> {
    const medios = await mediosDePago(schoolId);
    if (!parentId) return { ...medios, cobros_pendientes: [] };
    try {
        const { data, error } = await supabase.rpc('wa_get_payment_status', { p_parent_id: parentId, p_school_id: schoolId });
        if (error || !Array.isArray(data)) return { ...medios, cobros_pendientes: [] };
        // Import diferido: cobro-enlace-publico (que usan los enlaces) importa este módulo.
        const { conEnlacesDePago } = await import('./whatsapp-enlaces-de-pago.service');
        const conEnlace = await conEnlacesDePago(data as any[], parentId, schoolId, aviso);
        const cobros_pendientes = conEnlace
            .filter((p: any) => p?.debe_pagarse === true && p?.enlace_pago)
            .map((p: any) => ({
                concepto: p.concept ?? null,
                monto: p.amount == null ? null : Number(p.amount),
                vence: p.due_date ?? null,
                enlace_pago: p.enlace_pago,
                ...(p.enlace_instrucciones ? { enlace_instrucciones: p.enlace_instrucciones } : {}),
            }));
        return { ...medios, cobros_pendientes };
    } catch {
        return { ...medios, cobros_pendientes: [] };
    }
}
