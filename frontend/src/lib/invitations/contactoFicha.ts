/**
 * Contacto e invitación de una ficha sin cuenta (unregistered_athletes).
 *
 * La ficha trae DOS contactos: el del atleta (`email`/`phone`) y el de su
 * acudiente (`guardian_*`). Informe docs/qa/monster-prelanzamiento-2026-10-05.md:
 *   H-03  la invitación masiva no mandaba el id de la ficha → hijo duplicado y
 *         doble cobro;
 *   H-04  la invitación individual mandaba role=athlete para TODA ficha, aunque
 *         fuera de una niña de 9 años → la mamá quedaba "atleta" y las hermanas
 *         fundidas en un solo cobro;
 *   H-06  los avisos de cobro iban al correo/teléfono del NIÑO.
 *
 * Regla única (la misma del BFF: bff/src/services/contacto-acudiente.ts):
 *   - MENOR (o sin fecha de nacimiento pero con acudiente cargado) → se le
 *     escribe y se invita al ACUDIENTE, con rol `parent` y el id de la ficha:
 *     al aceptar, la ficha se adopta como su hijo (mismas inscripción y cobros).
 *     Nunca se cae al contacto del niño.
 *   - ADULTO → él mismo, rol `athlete` + id de la ficha.
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
  nombre: string | null;
  email: string | null;
  phone: string | null;
  /** true si el contacto es el del acudiente. */
  deAcudiente: boolean;
}

/** Columnas de unregistered_athletes que necesita contactoDeFicha. */
export const COLUMNAS_CONTACTO_FICHA =
  'full_name, email, phone, date_of_birth, guardian_full_name, guardian_email, guardian_phone';

const limpio = (s: string | null | undefined): string | null => {
  const t = String(s ?? '').trim();
  return t ? t : null;
};

/** Fecha local YYYY-MM-DD (el negocio opera en Colombia). */
export const hoyLocal = (d: Date = new Date()): string =>
  d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

export function correoValido(s: string | null | undefined): string | null {
  const t = limpio(s)?.toLowerCase() ?? null;
  if (!t) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? t : null;
}

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

/** ¿Menor de edad a la fecha `hoy`? null si no hay fecha. */
export function esMenorDeEdad(fechaNacimiento: string | null | undefined, hoy: string = hoyLocal()): boolean | null {
  const f = limpio(fechaNacimiento)?.slice(0, 10);
  if (!f || !/^\d{4}-\d{2}-\d{2}$/.test(f)) return null;
  const [y, m, d] = hoy.split('-').map(Number);
  const mayoria = `${String(y - 18).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return f > mayoria;
}

/** ¿El contacto de esta ficha es el de su acudiente? */
export function fichaVaAlAcudiente(ficha: FichaContacto | null | undefined, hoy: string = hoyLocal()): boolean {
  if (!ficha) return false;
  const menor = esMenorDeEdad(ficha.date_of_birth, hoy);
  if (menor !== null) return menor;
  return !!(limpio(ficha.guardian_email) || limpio(ficha.guardian_phone) || limpio(ficha.guardian_full_name));
}

export function contactoDeFicha(ficha: FichaContacto | null | undefined, hoy: string = hoyLocal()): ContactoResuelto {
  if (!ficha) return { nombre: null, email: null, phone: null, deAcudiente: false };
  if (fichaVaAlAcudiente(ficha, hoy)) {
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

/** Fila del listado de atletas (school_athletes + campos de la ficha). */
export interface AtletaParaInvitar {
  id: string;
  athlete_type?: 'child' | 'adult' | 'unregistered' | string | null;
  full_name?: string | null;
  date_of_birth?: string | null;
  parent_id?: string | null;
  /** Para 'child': correo/teléfono del acudiente (cuenta o parent_*_temp). */
  parent_email?: string | null;
  parent_phone?: string | null;
  /** Para 'unregistered': contacto propio del atleta (unregistered_athletes.email/phone). */
  athlete_email?: string | null;
  athlete_phone?: string | null;
  guardian_full_name?: string | null;
  guardian_email?: string | null;
  guardian_phone?: string | null;
}

export interface InvitacionPlan {
  role: 'parent' | 'athlete';
  email: string | null;
  phone: string | null;
  /** child_name de la invitación: SIEMPRE el nombre del atleta (clave para adoptar la ficha). */
  childName: string | null;
  /** p_unregistered_athlete_id: vincula la ficha con la invitación. */
  unregisteredId: string | null;
}

/**
 * Qué invitación corresponde a un atleta del listado, o null si no se le debe
 * mandar ninguna (ya tiene cuenta, o no hay a quién escribirle).
 */
export function invitacionParaAtleta(a: AtletaParaInvitar, hoy: string = hoyLocal()): InvitacionPlan | null {
  const tipo = a.athlete_type ?? (a.parent_id ? 'child' : 'unregistered');

  if (tipo === 'adult') return null; // ya tiene cuenta propia

  if (tipo === 'child') {
    if (a.parent_id) return null; // su acudiente ya tiene cuenta
    const email = correoValido(a.parent_email);
    const phone = telefonoValido(a.parent_phone);
    if (!email && !phone) return null;
    return { role: 'parent', email, phone, childName: limpio(a.full_name), unregisteredId: null };
  }

  const ficha: FichaContacto = {
    full_name: a.full_name,
    email: a.athlete_email,
    phone: a.athlete_phone,
    date_of_birth: a.date_of_birth,
    guardian_full_name: a.guardian_full_name,
    guardian_email: a.guardian_email,
    guardian_phone: a.guardian_phone,
  };

  if (fichaVaAlAcudiente(ficha, hoy)) {
    const email = correoValido(ficha.guardian_email);
    const phone = telefonoValido(ficha.guardian_phone);
    if (!email && !phone) return null; // nunca se invita al niño como "acudiente"
    return { role: 'parent', email, phone, childName: limpio(a.full_name), unregisteredId: a.id };
  }

  const email = correoValido(ficha.email);
  const phone = telefonoValido(ficha.phone);
  if (!email && !phone) return null;
  return { role: 'athlete', email, phone, childName: limpio(a.full_name), unregisteredId: a.id };
}
