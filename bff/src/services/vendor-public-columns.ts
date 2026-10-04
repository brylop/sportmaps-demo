/**
 * Columnas de vendor_profiles que se pueden mostrar a cualquiera (spec blindaje
 * §1.1 / T1; tienda v2 F0). Fuera: bank_data, nit, verification_doc_url,
 * commission_rate, payment_methods, metadata, phone, email, address,
 * capabilities.
 *
 * Un solo literal (sin .join ni +) para que supabase-js infiera el tipo de la
 * fila. Vigilado por vendor-public-columns.test.ts.
 */
export const VENDOR_PUBLIC_COLUMNS = 'id, user_id, vendor_type, display_name, slug, description, logo_url, cover_image_url, city, website_url, verification_status, is_active, avg_rating, reviews_count, response_rate, avg_response_hours, created_at, updated_at';

/** Columnas que nunca salen por una ruta pública. */
export const VENDOR_SENSITIVE_COLUMNS = [
    'bank_data',
    'commission_rate',
    'verification_doc_url',
    'nit',
    'phone',
    'email',
    'address',
    'payment_methods',
    'metadata',
    'capabilities',
] as const;
