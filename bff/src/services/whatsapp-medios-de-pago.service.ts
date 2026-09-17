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

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://app.sportmaps.co';

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

export async function mediosDePago(schoolId: string): Promise<MediosDePago> {
    const cuentas: MediosDePago['cuentas'] = [];

    const { data: cfg } = await supabase
        .from('school_settings')
        .select('nequi_number, bank_account_number, breb_key, payment_accounts, bank_name, account_holder')
        .eq('school_id', schoolId)
        .maybeSingle();

    const c = cfg as any;
    if (c) {
        // `payment_accounts` es la fuente nueva; las columnas sueltas son el
        // store viejo. Conviven, asi que se leen las dos y se deduplica por
        // numero — si no, la escuela que migro veria su cuenta dos veces.
        const vistos = new Set<string>();
        const agregar = (tipo: string, numero: unknown, titular?: unknown) => {
            const n = String(numero ?? '').trim();
            if (!n || vistos.has(n)) return;
            vistos.add(n);
            cuentas.push({ tipo, titular: (titular as string) ?? c.account_holder ?? null, numero: n });
        };

        for (const a of (Array.isArray(c.payment_accounts) ? c.payment_accounts : [])) {
            // `active: false` solo oculta la cuenta, no la borra.
            if (a?.active === false) continue;
            agregar(String(a?.type ?? a?.tipo ?? 'Cuenta'), a?.number ?? a?.numero, a?.holder ?? a?.titular);
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
