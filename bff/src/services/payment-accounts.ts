/**
 * Llaves de pago de una escuela vistas desde el BFF: lectura de
 * `school_settings.payment_accounts` y la regla de "cuenta restringida a un
 * concepto".
 *
 * Por qué existe (Dynasty, 2026-10-05): la dueña cobra las INSCRIPCIONES en su
 * Nequi personal (320 429 8969) y las mensualidades en las cuentas del club.
 * Sin registrar ese Nequi, el verificador marcaba DESTINO_NO_COINCIDE y el bot
 * respondía "destino ajeno" a una inscripción legítima (caso real 2026-10-03).
 * Registrarlo sin más lo convertía en cuenta válida para TODO, y el bot lo
 * ofrecía para pagar la mensualidad. Por eso cada llave puede llevar
 * `only_for`: la lista de categorías de cobro para las que vale. Sin
 * `only_for` (o vacía) la llave vale para todo, que es lo de siempre.
 *
 * La categoría de un cobro sale de `payments.payment_category` y, si no está o
 * es 'otro', del texto del concepto: `payment_type` NO sirve para separar
 * matrícula de mensualidad (ver memoria project_payment_type_not_reliable).
 */

export const CATEGORIAS_COBRO = ['mensualidad', 'inscripcion', 'articulos', 'torneo', 'otro'] as const;
export type CategoriaCobro = (typeof CATEGORIAS_COBRO)[number];

export interface CuentaDePago {
    id: string | null;
    type: string;
    label: string;
    value: string;
    /** false = la escuela la oculta al acudiente; sigue siendo de la escuela. */
    active: boolean;
    /** null = vale para cualquier cobro. Si trae categorías, solo para esas. */
    onlyFor: CategoriaCobro[] | null;
}

const esCategoria = (v: unknown): v is CategoriaCobro =>
    typeof v === 'string' && (CATEGORIAS_COBRO as readonly string[]).includes(v);

/** jsonb sin esquema garantizado → lista limpia. Descarta filas sin valor. */
export function parseCuentasDePago(raw: unknown): CuentaDePago[] {
    if (!Array.isArray(raw)) return [];
    const out: CuentaDePago[] = [];
    for (const item of raw) {
        if (!item || typeof item !== 'object') continue;
        const row = item as Record<string, unknown>;
        // `value` es la clave real (mig 20260809095613); `number`/`numero` se
        // aceptan por si algún dato viejo o cargado a mano los usó.
        const valorCrudo = row.value ?? row.number ?? row.numero;
        const value = typeof valorCrudo === 'string' ? valorCrudo.trim() : '';
        if (!value) continue;
        const onlyForRaw = Array.isArray(row.only_for) ? row.only_for.filter(esCategoria) : [];
        out.push({
            id: typeof row.id === 'string' ? row.id : null,
            type: String(row.type ?? ''),
            label: typeof row.label === 'string' ? row.label : '',
            value,
            active: row.active !== false,
            onlyFor: onlyForRaw.length > 0 ? onlyForRaw : null,
        });
    }
    return out;
}

/**
 * Categoría de un cobro. `payment_category` manda cuando es específica; si
 * falta o es 'otro', se mira el concepto. null = no se pudo saber.
 */
export function categoriaDeCobro(
    paymentCategory: string | null | undefined,
    concept: string | null | undefined,
): CategoriaCobro | null {
    if (esCategoria(paymentCategory) && paymentCategory !== 'otro') return paymentCategory;
    const c = (concept ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (c) {
        if (/matricul|inscrip/.test(c)) return 'inscripcion';
        if (/mensualidad|mensual/.test(c)) return 'mensualidad';
        if (/torneo/.test(c)) return 'torneo';
        if (/uniforme|articulo|kit\b|dotacion/.test(c)) return 'articulos';
    }
    return paymentCategory === 'otro' ? 'otro' : null;
}

/** ¿Esta llave sirve para un cobro de esta categoría? Sin categoría conocida, solo las generales. */
export function cuentaAplicaA(cuenta: Pick<CuentaDePago, 'onlyFor'>, categoria: CategoriaCobro | null): boolean {
    if (!cuenta.onlyFor || cuenta.onlyFor.length === 0) return true;
    return categoria !== null && cuenta.onlyFor.includes(categoria);
}

const NOMBRE_CATEGORIA: Record<CategoriaCobro, string> = {
    mensualidad: 'mensualidades',
    inscripcion: 'inscripciones',
    articulos: 'artículos',
    torneo: 'torneos',
    otro: 'otros cobros',
};

/** "inscripciones", "inscripciones y torneos" — para mensajes. */
export function describirCategorias(cats: readonly string[]): string {
    const nombres = cats.map((c) => (esCategoria(c) ? NOMBRE_CATEGORIA[c] : c));
    if (nombres.length <= 1) return nombres[0] ?? '';
    return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}
