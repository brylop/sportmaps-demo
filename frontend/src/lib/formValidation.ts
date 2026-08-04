import { z, ZodError, ZodType } from 'zod';

/** Convierte un ZodError en un mapa campo→primer mensaje, para errores inline. */
export function zodFieldErrors(err: ZodError): Record<string, string> {
    const out: Record<string, string> = {};
    for (const issue of err.issues) {
        const key = String(issue.path[0] ?? '_');
        if (key && !out[key]) out[key] = issue.message;
    }
    return out;
}

/**
 * Valida `values` contra `schema`. Devuelve { data } si pasa, o { errors } con
 * el mapa por campo si falla. Uso: const r = validate(schema, values); if (r.errors) { setErrors(r.errors); return; }
 */
export function validate<T>(schema: ZodType<T>, values: unknown):
    { data: T; errors?: undefined } | { data?: undefined; errors: Record<string, string> } {
    const parsed = schema.safeParse(values);
    if (parsed.success) return { data: parsed.data };
    return { errors: zodFieldErrors(parsed.error) };
}

// ─── Validadores reutilizables (Colombia) ───────────────────────────────────
export const zRequiredText = (label = 'Este campo', max = 200) =>
    z.string().trim().min(1, `${label} es obligatorio`).max(max, `Máximo ${max} caracteres`);

export const zOptionalText = (max = 200) =>
    z.string().trim().max(max, `Máximo ${max} caracteres`).optional().or(z.literal(''));

/** Documento/NIT: solo dígitos (con o sin DV separado). */
export const zDocument = (label = 'El documento') =>
    z.string().trim().min(4, `${label} es muy corto`).regex(/^\d[\d.\-]*\d$/, `${label} debe ser numérico`);

/** Teléfono colombiano: dígitos, espacios, +, - y paréntesis. */
export const zPhoneOptional = () =>
    z.string().trim().regex(/^[\d+\-()\s]{7,20}$/, 'Teléfono inválido').optional().or(z.literal(''));

export const zEmailOptional = () =>
    z.string().trim().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email inválido').optional().or(z.literal(''));

/** Monto en COP: número entero positivo (desde un input string). */
export const zAmountPositive = (label = 'El monto') =>
    z.coerce.number({ message: `${label} debe ser un número` }).positive(`${label} debe ser mayor a 0`).finite();

export const zAmountNonNeg = (label = 'El valor') =>
    z.coerce.number({ message: `${label} debe ser un número` }).min(0, `${label} no puede ser negativo`).finite();

export const zYear = () =>
    z.coerce.number().int('Año inválido').min(2000, 'Año inválido').max(2100, 'Año inválido');

/** Porcentaje en decimal (0–1). */
export const zPct = (label = 'El porcentaje') =>
    z.coerce.number({ message: `${label} inválido` }).min(0, `${label} no puede ser negativo`).max(1, `${label} debe estar entre 0 y 1`);
