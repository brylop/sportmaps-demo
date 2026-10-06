// schoolAdmins — destinatarios "dirección de la escuela" para avisos in-app/email.
//
// Extraído de saasInvoicing.service.ts (antes era una función privada de ahí)
// para que otros avisos al owner/admin (p. ej. elegibilidad de ascenso, F-F de
// docs/specs/dreamers-reglas-completas-plan.md) usen EXACTAMENTE la misma lista
// sin copiar la query. Mismo comportamiento que tenía: miembros activos con
// rol owner/admin, con su email y teléfono.

import { supabase } from '../config/supabase';

export interface SchoolAdminContact {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
}

/** Admins activos de la escuela (owner/admin) con email/teléfono, para email+push+wa.me. */
export async function loadSchoolAdmins(schoolId: string): Promise<SchoolAdminContact[]> {
    const { data: members } = await supabase
        .from('school_members')
        .select('profile_id')
        .eq('school_id', schoolId)
        .eq('status', 'active')
        .in('role', ['owner', 'admin']);

    const profileIds = [...new Set((members || []).map((m: any) => m.profile_id).filter(Boolean))];
    if (profileIds.length === 0) return [];

    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone')
        .in('id', profileIds);

    return (profiles || []) as SchoolAdminContact[];
}
