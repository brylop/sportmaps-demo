import { todayInZone } from '../utils/businessDate';

/**
 * ¿A quién se le avisa un cobro de una ficha sin cuenta (unregistered_athletes)?
 *
 * La ficha trae DOS contactos: el del atleta (`email`/`phone`) y el de su
 * acudiente (`guardian_*`). Los avisos de cobro, el estado de cuenta, la
 * cobranza manual y los recordatorios leían siempre `email`/`phone`, o sea los
 * del NIÑO: en Monster´s Volley Club 62 de 87 menores tienen otro correo que su
 * acudiente y 76 de 87 otro teléfono (H-06 de
 * docs/qa/monster-prelanzamiento-2026-10-05.md). El cobro de $145.000 le llegaba
 * a un menor de 12 años.
 *
 * Regla:
 *   - MENOR (fecha de nacimiento < 18 años) → SIEMPRE el acudiente. Si el dato
 *     del acudiente falta o es inválido ("no aplica", "3"), el canal queda en
 *     null: nunca se cae al contacto del niño.
 *   - Sin fecha de nacimiento pero con acudiente cargado → se trata como menor
 *     (es lo prudente: el acudiente es un adulto de la familia).
 *   - ADULTO → su propio contacto; si no tiene, el del acudiente que la escuela
 *     cargó (suele ser quien paga en los primeros años de mayores).
 *
 * Misma regla en el frontend: frontend/src/lib/invitations/contactoFicha.ts.
 */

export interface FichaContacto {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    date_of_birth?: string | null;
    guardian_full_name?: string | null;
    guardian_email?: string | null;
    guardian_phone?: string | null;
}

export interface ContactoResuelto {
    /** Nombre de la persona a la que se le escribe (acudiente o el propio adulto). */
    nombre: string | null;
    email: string | null;
    phone: string | null;
    /** true si el contacto es el del acudiente. */
    deAcudiente: boolean;
}

/** Columnas de unregistered_athletes que necesita contactoDeFicha (para los SELECT). */
export const COLUMNAS_CONTACTO_FICHA =
    'full_name, email, phone, date_of_birth, guardian_full_name, guardian_email, guardian_phone';

const limpio = (s: string | null | undefined): string | null => {
    const t = String(s ?? '').trim();
    return t ? t : null;
};

/** Correo con forma de correo, en minúsculas. "no aplica", "No" → null. */
export function correoValido(s: string | null | undefined): string | null {
    const t = limpio(s)?.toLowerCase() ?? null;
    if (!t) return null;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? t : null;
}

/**
 * Primer teléfono plausible (7 a 13 dígitos). "311 8525755 y 3114766424" →
 * "311 8525755"; "3" → null; "+57 315 461 0261" → tal cual.
 */
export function telefonoValido(s: string | null | undefined): string | null {
    const t = limpio(s);
    if (!t) return null;
    const tramos = t.match(/\+?\d[\d\s().-]*\d/g) ?? [];
    for (const tramo of tramos) {
        const digitos = tramo.replace(/\D/g, '');
        if (digitos.length >= 7 && digitos.length <= 13) return tramo.trim();
    }
    return null;
}

/** ¿Menor de edad a la fecha `hoy` (YYYY-MM-DD, zona del negocio)? null si no hay fecha. */
export function esMenorDeEdad(fechaNacimiento: string | null | undefined, hoy: string = todayInZone()): boolean | null {
    const f = limpio(fechaNacimiento)?.slice(0, 10);
    if (!f || !/^\d{4}-\d{2}-\d{2}$/.test(f)) return null;
    const [y, m, d] = hoy.split('-').map(Number);
    const mayoria = `${String(y - 18).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    // Nacido DESPUÉS de hoy-18 años → todavía no cumple 18.
    return f > mayoria;
}

export function contactoDeFicha(ficha: FichaContacto | null | undefined, hoy: string = todayInZone()): ContactoResuelto {
    if (!ficha) return { nombre: null, email: null, phone: null, deAcudiente: false };
    const tieneAcudiente = !!(limpio(ficha.guardian_email) || limpio(ficha.guardian_phone) || limpio(ficha.guardian_full_name));
    const menor = esMenorDeEdad(ficha.date_of_birth, hoy);
    const vaAlAcudiente = menor === true || (menor === null && tieneAcudiente);

    if (vaAlAcudiente) {
        return {
            nombre: limpio(ficha.guardian_full_name)
                ?? (limpio(ficha.full_name) ? `Acudiente de ${limpio(ficha.full_name)}` : null),
            email: correoValido(ficha.guardian_email),
            phone: telefonoValido(ficha.guardian_phone),
            deAcudiente: true,
        };
    }

    const email = correoValido(ficha.email);
    const phone = telefonoValido(ficha.phone);
    if (email || phone) return { nombre: limpio(ficha.full_name), email, phone, deAcudiente: false };
    const gEmail = correoValido(ficha.guardian_email);
    const gPhone = telefonoValido(ficha.guardian_phone);
    if (gEmail || gPhone) {
        return { nombre: limpio(ficha.guardian_full_name) ?? limpio(ficha.full_name), email: gEmail, phone: gPhone, deAcudiente: true };
    }
    return { nombre: limpio(ficha.full_name), email: null, phone: null, deAcudiente: false };
}

/** Columnas de children que necesita contactoDeHijoSinCuenta. */
export const COLUMNAS_CONTACTO_HIJO = 'full_name, parent_name_temp, parent_email_temp, parent_phone_temp';

/**
 * Menor en `children` cuyo acudiente aún no tiene cuenta (parent_id NULL): el
 * contacto que la escuela cargó vive en parent_*_temp.
 */
export function contactoDeHijoSinCuenta(hijo: {
    full_name?: string | null;
    parent_name_temp?: string | null;
    parent_email_temp?: string | null;
    parent_phone_temp?: string | null;
} | null | undefined): ContactoResuelto {
    if (!hijo) return { nombre: null, email: null, phone: null, deAcudiente: false };
    return {
        nombre: limpio(hijo.parent_name_temp) ?? (limpio(hijo.full_name) ? `Acudiente de ${limpio(hijo.full_name)}` : null),
        email: correoValido(hijo.parent_email_temp),
        phone: telefonoValido(hijo.parent_phone_temp),
        deAcudiente: true,
    };
}
