/**
 * useSchoolInvoicingActive — ¿la escuela de este cobro emite factura
 * electrónica? (addon 'invoicing' vigente + facturador activo, lo decide el
 * BFF en GET /api/v1/invoicing/active/school/:schoolId).
 *
 * Lo usa el checkout del acudiente para pedir datos fiscales SOLO cuando sirven
 * para algo. Antes se exigían siempre, aunque la escuela no facturara: un
 * formulario de cédula y dirección delante de cada pago, sin propósito.
 *
 * Devuelve `active`:
 *   true      → la escuela factura: si al pagador le faltan datos, se piden.
 *   false     → no factura: no se piden.
 *   undefined → todavía no se sabe, no hay escuela, o la consulta falló. El
 *               checkout lo trata como `true` (comportamiento anterior): ante la
 *               duda, un formulario de más es mejor que una factura imposible.
 */

import { useQuery } from '@tanstack/react-query';
import { invoicingApi } from '@/lib/api/invoicing';

export function useSchoolInvoicingActive(schoolId: string | null | undefined): {
    active: boolean | undefined;
    loading: boolean;
} {
    const q = useQuery({
        queryKey: ['school-invoicing-active', schoolId],
        enabled: !!schoolId,
        staleTime: 5 * 60_000,
        retry: 1,
        queryFn: () => invoicingApi.isSchoolInvoicingActive(schoolId as string),
    });
    return {
        active: q.isSuccess ? q.data?.active === true : undefined,
        loading: !!schoolId && q.isLoading,
    };
}

/** ¿Hay que pedir datos fiscales en el checkout? Solo si faltan Y la escuela (quizá) factura. */
export function mustAskBillingData(hasCompleteData: boolean, invoicingActive: boolean | undefined): boolean {
    return !hasCompleteData && invoicingActive !== false;
}
