// Checkout API Service
//
// Seguridad (2026-10-05, mig 20261005131057): este cliente llamaba a la RPC
// `process_enrollment_checkout` desde el navegador. La RPC creaba la inscripción
// y un pago con status 'completed' por el monto que mandara el cliente, para
// cualquier escuela y a nombre de cualquier acudiente: quien tuviera sesión se
// inscribía "pagado" por $1. El pago previo era simulado (PaymentModal).
//
// Medido en la base: 0 pagos en toda la historia por este camino, así que nadie
// dependía de él. La RPC quedó solo para service_role y este cliente ya no la
// llama. La inscripción con cobro real va por el flujo de la escuela (QR /
// enlace de inscripción → cobro pendiente que la escuela aprueba, o pasarela
// con webhook), nunca marcando "pagado" desde el navegador.

export interface CheckoutPayload {
    student_id: string; // The ID of the person being enrolled (child or user)
    class_id: string | null;                // legacy team/program id
    offering_plan_id?: string | null;       // v2.1: plan id de offering_plans
    school_id: string;
    parent_id: string;
    amount: number;
    payment_method: string;
    is_child_enrollment?: boolean; // New flag to distinguish
}

export interface CheckoutResult {
    success: boolean;
    order_id?: string;
    enrollment_id?: string;
    error?: string;
}

export const ENROLLMENT_CHECKOUT_UNAVAILABLE =
    'La inscripción en línea se hace desde el enlace o QR de inscripción de la escuela.';

class CheckoutAPI {
    async processEnrollment(_payload: CheckoutPayload): Promise<CheckoutResult> {
        return { success: false, error: ENROLLMENT_CHECKOUT_UNAVAILABLE };
    }
}

export const checkoutAPI = new CheckoutAPI();
