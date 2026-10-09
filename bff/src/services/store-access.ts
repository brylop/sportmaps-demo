/**
 * ¿Quién gestiona una tienda? (tienda v2 F0, M-F0-1)
 *
 * La regla vive en la base: can_manage_store_as(p_vendor_profile_id, p_user_id)
 * → dueño del vendor_profile, owner/admin (no coach) de vendor_profiles.school_id,
 * o admin de plataforma. El BFF usa service role, así que auth.uid() es NULL
 * adentro de la RPC: por eso se pasa el usuario explícito.
 *
 * Si la RPC falla (p.ej. migración sin aplicar) se cae a la regla vieja
 * (vendor_profiles.user_id = usuario). Nunca es más amplia que antes.
 */

import { supabase } from '../config/supabase';

export interface ManagedVendorProfile {
    id: string;
    user_id: string | null;
    school_id: string | null;
    is_active: boolean | null;
    capabilities: Record<string, unknown> | null;
}

/**
 * true si `userId` puede gestionar la tienda `vendorProfileId`.
 * `legacyOwnerId` = vendor_profiles.user_id, para la caída a la regla vieja.
 */
export async function canManageStoreAs(
    vendorProfileId: string,
    userId: string,
    legacyOwnerId?: string | null,
): Promise<boolean> {
    const { data, error } = await supabase.rpc('can_manage_store_as', {
        p_vendor_profile_id: vendorProfileId,
        p_user_id: userId,
    });
    if (error) {
        console.warn('[store-access] can_manage_store_as falló; regla legacy', error.message);
        return !!legacyOwnerId && legacyOwnerId === userId;
    }
    return data === true;
}

/** Escuelas donde el usuario es administración (mismo criterio que user_admin_school_ids()). */
async function adminSchoolIds(userId: string): Promise<string[]> {
    const ids = new Set<string>();
    const { data: members } = await supabase
        .from('school_members')
        .select('school_id')
        .eq('profile_id', userId)
        .eq('status', 'active')
        .in('role', ['owner', 'admin', 'school_admin', 'super_admin']);
    for (const m of (members ?? []) as Array<{ school_id: string | null }>) {
        if (m.school_id) ids.add(m.school_id);
    }
    const { data: owned } = await supabase.from('schools').select('id').eq('owner_id', userId);
    for (const s of (owned ?? []) as Array<{ id: string }>) ids.add(s.id);
    return [...ids];
}

const VP_COLUMNS = 'id, user_id, school_id, is_active, capabilities';

/**
 * Tiendas que el usuario puede gestionar: la propia y las de las escuelas que
 * administra, confirmadas una por una con can_manage_store_as.
 */
export async function resolveManagedVendorProfiles(userId: string): Promise<ManagedVendorProfile[]> {
    const candidates = new Map<string, ManagedVendorProfile>();

    const { data: own } = await supabase
        .from('vendor_profiles')
        .select(VP_COLUMNS)
        .eq('user_id', userId);
    for (const vp of (own ?? []) as unknown as ManagedVendorProfile[]) candidates.set(vp.id, vp);

    const schools = await adminSchoolIds(userId);
    if (schools.length > 0) {
        // vendor_profiles.school_id llega con M-F0-1; si la columna no existe, se ignora.
        const { data: bySchool, error } = await supabase
            .from('vendor_profiles')
            .select(VP_COLUMNS)
            .in('school_id', schools);
        if (!error) {
            for (const vp of (bySchool ?? []) as unknown as ManagedVendorProfile[]) candidates.set(vp.id, vp);
        }
    }

    const out: ManagedVendorProfile[] = [];
    for (const vp of candidates.values()) {
        if (await canManageStoreAs(vp.id, userId, vp.user_id)) out.push(vp);
    }
    return out;
}

/** El perfil puede vender productos (activo + capability). */
export function profileCanSellProducts(vp: Pick<ManagedVendorProfile, 'is_active' | 'capabilities'>): boolean {
    const cap = vp.capabilities?.['can_sell_products'];
    return vp.is_active === true && (cap === true || cap === 'true');
}

export interface SchoolStoreSummary {
    id: string;
    user_id: string | null;
    school_id: string;
    vendor_type: string | null;
    display_name: string | null;
    slug: string | null;
    is_active: boolean | null;
    verification_status: string | null;
    capabilities: Record<string, unknown> | null;
}

/**
 * La tienda (vendor_profile) de una escuela: vendor_profiles.school_id. Bug N0:
 * buscarla por user_id deja afuera al school_admin que no es dueño. Quién puede
 * gestionarla lo decide canManageStoreAs.
 */
export async function findSchoolStore(schoolId: string): Promise<SchoolStoreSummary | null> {
    const { data, error } = await supabase
        .from('vendor_profiles')
        .select('id, user_id, school_id, vendor_type, display_name, slug, is_active, verification_status, capabilities')
        .eq('school_id', schoolId)
        .maybeSingle();
    if (error || !data) return null;
    return data as unknown as SchoolStoreSummary;
}

/**
 * Perfil "principal" que gestiona el usuario: el propio (user_id) y, si no
 * tiene, el de una escuela que administra. Para rutas que asumían un perfil
 * por usuario (envíos).
 */
export async function resolvePrimaryVendorProfileId(userId: string): Promise<string | null> {
    const { data: own } = await supabase.from('vendor_profiles').select('id').eq('user_id', userId).maybeSingle();
    if ((own as { id?: string } | null)?.id) return (own as { id: string }).id;
    const managed = await resolveManagedVendorProfiles(userId);
    return managed.find(vp => !!vp.school_id)?.id ?? managed[0]?.id ?? null;
}
