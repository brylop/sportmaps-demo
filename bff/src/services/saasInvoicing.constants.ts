// Espejo de nombres comerciales de ACADEMY_TIERS (frontend/src/config/saas-plans.ts).
// Solo para mostrar en el PDF/email — la fuente de verdad de precios vive en
// la RPC generate_school_subscription_invoice (supabase/migrations).
export const ACADEMY_PLAN_NAMES: Record<string, string> = {
    starter: 'Free Start',
    start: 'Escuela Start',
    crecimiento: 'Escuela Crecimiento',
    profesional: 'Escuela Pro',
    elite: 'Escuela Elite',
    enterprise: 'Custom',
};