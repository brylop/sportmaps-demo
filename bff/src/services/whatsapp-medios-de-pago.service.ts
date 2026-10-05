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
 *  2. Pagar en línea desde la app.
 *  3. Mandar el comprobante **por acá mismo** — que es el que la gente no
 *     descubre sola y el que menos fricción tiene: ya está en el chat.
 */

import { supabase } from '../config/supabase';
import { normalizeDestination } from './receipt-verdict';
import { cuentaAplicaA, parseCuentasDePago, type CategoriaCobro } from './payment-accounts';

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://app.sportmaps.co';

const TIPO_LEGIBLE: Record<string, string> = {
    breb: 'Bre-B',
    nequi: 'Nequi',
    daviplata: 'Daviplata',
    transfer_key: 'Llave de transferencia',
};

export interface MediosDePago {
    cuentas: { tipo: string; titular: string | null; numero: string }[];
    enlace_para_pagar: string;
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
            agregar(TIPO_LEGIBLE[a.type] ?? (a.label || 'Cuenta'), a.value);
        }
        agregar('Nequi', c.nequi_number);
        agregar(c.bank_name ? String(c.bank_name) : 'Cuenta bancaria', c.bank_account_number);
        agregar('Bre-B', c.breb_key);
    }

    return {
        cuentas,
        enlace_para_pagar: `${FRONTEND_URL}/my-payments`,
        puede_enviar_comprobante_por_whatsapp: true,
    };
}
