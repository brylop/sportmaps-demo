// ============================================================================
// Contextos de rol: una persona, varios roles (spec
// docs/specs/cambio-de-rol-atleta-acudiente.md, fase F1).
//
// Un "contexto" es el rol con el que la persona está usando la app ahora
// (acudiente, atleta, administración, entrenador). NO se guarda en la base: se
// DEDUCE de los datos que ya existen:
//   · acudiente  → tiene hijos (children.parent_id) con una inscripción activa
//   · atleta     → tiene una inscripción activa propia (enrollments.user_id)
//   · staff      → school_members con rol de staff (owner/admin/coach/…)
//
// Seguridad: el contexto elige QUÉ SE MUESTRA, nunca suma permisos. La RLS y el
// BFF siguen leyendo el rol real de la base; ningún contexto se convierte en
// admin/super_admin de plataforma (school_members.role='admin' es admin DE
// ESCUELA y se presenta como 'school_admin', jamás como 'admin').
//
// Solo aplica a quien tiene 2+ contextos. Para todos los demás no cambia nada.
// ============================================================================
import { supabase } from '@/integrations/supabase/client';

export type ContextViewRole = 'parent' | 'athlete' | 'school' | 'school_admin' | 'coach' | 'reporter' | 'accountant';

export interface RoleContext {
  /** `${viewRole}:${schoolId}` */
  key: string;
  /** Rol con el que se presenta la app (el valor que verán las pantallas en profile.role). */
  viewRole: ContextViewRole;
  /** Rol de school_members equivalente, para el contexto de escuela. */
  memberRole: 'parent' | 'athlete' | 'owner' | 'school_admin' | 'admin' | 'coach' | 'reporter' | 'accountant';
  schoolId: string | null;
  schoolName: string;
  /** Texto para el selector: "Como acudiente", "Como atleta", … */
  label: string;
}

// Perfiles a los que F1 NO toca: los de plataforma y los de negocio (F2).
const PERFILES_FUERA_DE_F1 = new Set(['admin', 'super_admin', 'personal_trainer', 'organizer', 'wellness_professional', 'store_owner']);

const STAFF_MAP: Record<string, { viewRole: ContextViewRole; label: string }> = {
  owner: { viewRole: 'school', label: 'Administración' },
  admin: { viewRole: 'school_admin', label: 'Administración' },
  school_admin: { viewRole: 'school_admin', label: 'Administración' },
  coach: { viewRole: 'coach', label: 'Entrenador' },
  reporter: { viewRole: 'reporter', label: 'Reportes' },
  accountant: { viewRole: 'accountant', label: 'Contabilidad' },
};

const STORAGE_PREFIX = 'sportmaps_active_context_';
export const activeContextStorageKey = (userId: string) => `${STORAGE_PREFIX}${userId}`;

export function readStoredContextKey(userId: string): string | null {
  try { return localStorage.getItem(activeContextStorageKey(userId)); } catch { return null; }
}
/** Devuelve false si el navegador no deja guardar (modo privado, cuota, bloqueo). */
export function storeContextKey(userId: string, key: string): boolean {
  try {
    localStorage.setItem(activeContextStorageKey(userId), key);
    return localStorage.getItem(activeContextStorageKey(userId)) === key;
  } catch { return false; }
}
/** Borra la elección guardada de UN usuario (p. ej. porque ya no es válida). */
export function clearStoredContextKey(userId: string) {
  try { localStorage.removeItem(activeContextStorageKey(userId)); } catch { /* no-op */ }
}

/**
 * Destino interno seguro para volver después de elegir rol. Rechaza todo lo que
 * el navegador pueda resolver a OTRO origen: `//evil.com`, `/\evil.com`,
 * `/\t/evil.com` (el parser de URL quita tabs y saltos), `https://…`, y el
 * propio selector (evita volver a /elegir-rol en bucle).
 */
export function safeInternalPath(raw: string | null | undefined, fallback = '/dashboard'): string {
  if (!raw || raw[0] !== '/' || raw[1] === '/' || raw[1] === '\\') return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return fallback;
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const url = new URL(raw, base);
    if (url.origin !== base) return fallback;
    if (url.pathname === '/elegir-rol' || url.pathname.startsWith('/elegir-rol/')) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
/** Al cerrar sesión: el siguiente inicio vuelve a mostrar el selector. */
export function clearStoredContexts() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(STORAGE_PREFIX)).forEach((k) => localStorage.removeItem(k));
  } catch { /* no-op */ }
}

/**
 * Contextos de la persona, deducidos de sus datos. Devuelve [] si no aplica
 * (perfil fuera de F1) o si falla algo — en ese caso la app sigue como siempre.
 */
export async function fetchRoleContexts(userId: string, profileRole: string | undefined): Promise<RoleContext[]> {
  if (!profileRole || PERFILES_FUERA_DE_F1.has(profileRole)) return [];
  try {
    const [members, ownEnrollments, kids] = await Promise.all([
      supabase.from('school_members')
        .select('school_id, role, schools(name)')
        .eq('profile_id', userId).eq('status', 'active'),
      supabase.from('enrollments')
        .select('school_id, schools(name)')
        .eq('user_id', userId).eq('status', 'active'),
      supabase.from('children')
        .select('id, school_id, schools(name), enrollments!enrollments_child_id_fkey(status, school_id)')
        .eq('parent_id', userId),
    ]);
    if (members.error || ownEnrollments.error || kids.error) return [];

    const out = new Map<string, RoleContext>();
    const add = (c: Omit<RoleContext, 'key'>) => {
      const key = `${c.viewRole}:${c.schoolId ?? '-'}`;
      if (!out.has(key)) out.set(key, { ...c, key });
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nombre = (row: any) => row?.schools?.name ?? 'Escuela';

    for (const m of members.data ?? []) {
      const staff = STAFF_MAP[m.role as string];
      if (staff) add({ viewRole: staff.viewRole, memberRole: m.role as RoleContext['memberRole'], schoolId: m.school_id, schoolName: nombre(m), label: staff.label });
    }
    for (const e of ownEnrollments.data ?? []) {
      add({ viewRole: 'athlete', memberRole: 'athlete', schoolId: e.school_id, schoolName: nombre(e), label: 'Como atleta' });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const k of (kids.data ?? []) as any[]) {
      const activa = (k.enrollments ?? []).find((e: { status: string }) => e.status === 'active');
      if (!activa) continue;
      const schoolId = activa.school_id ?? k.school_id;
      add({ viewRole: 'parent', memberRole: 'parent', schoolId, schoolName: nombre(k), label: 'Como acudiente' });
    }

    const lista = [...out.values()];
    // Multirol = dos o más ROLES distintos. Ser acudiente en dos escuelas no es
    // multirol (eso lo resuelve el cambio de escuela, no este selector).
    const rolesDistintos = new Set(lista.map((c) => c.viewRole));
    return rolesDistintos.size >= 2 ? lista : [];
  } catch {
    return [];
  }
}
