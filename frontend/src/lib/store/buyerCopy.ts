/**
 * Textos del comprador de la tienda que dependen de QUIÉN compra.
 *
 * El primer cliente (GYM RM) vende a SOCIOS ADULTOS del gimnasio, no a padres:
 * nada de "tu hijo" por defecto. Solo cuando la cuenta es de acudiente
 * (`profiles.role = 'parent'`) se menciona al hijo. Tuteo neutro, sin voseo.
 */

export type BuyerKind = 'guardian' | 'member';

export function buyerKind(role: string | null | undefined): BuyerKind {
    return role === 'parent' ? 'guardian' : 'member';
}

export const BUYER_COPY: Record<BuyerKind, {
    notesPlaceholder: string;
    pickupShare: string;
}> = {
    guardian: {
        notesPlaceholder: 'Ej.: es para mi hijo de la categoría sub 11',
        pickupShare: 'Si lo retira otra persona (por ejemplo, tu hijo), compártele el código.',
    },
    member: {
        notesPlaceholder: 'Ej.: paso a recogerlo el sábado en la mañana',
        pickupShare: 'Si lo retira otra persona, compártele el código.',
    },
};

export function buyerCopy(role: string | null | undefined) {
    return BUYER_COPY[buyerKind(role)];
}

/** Estados en los que el comprador puede ver o generar su código de retiro. */
export const PICKUP_CODE_STATUSES = ['paid', 'preparing', 'ready_for_pickup'] as const;

/** ¿Puede generar un código nuevo? (misma regla que regenerate_my_pickup_code). */
export function buyerCanRegeneratePickupCode(o: { status: string | null; fulfillment_mode?: string | null }): boolean {
    return o.fulfillment_mode === 'pickup' && (PICKUP_CODE_STATUSES as readonly string[]).includes(String(o.status));
}
