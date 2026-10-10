/**
 * Gate REAL del modal «Cobros y pagos» (spec cobros-multiples §9.1, §15.2).
 *
 * `requireRole` no basta: `PRIVILEGED_ROLES` (owner/admin/super_admin) pasan
 * siempre, y `req.role` es un rol único del usuario, no «su rol en ESTA
 * escuela». El BFF entra con service_role (RLS no filtra nada), así que este
 * chequeo es el que decide quién crea deuda, registra plata o descuenta.
 *
 * Admin financiero de la escuela = lo mismo que `user_admin_school_ids()` en la
 * base y lo que re-valida la RPC con `p_actor`:
 *   · fila activa en `platform_admins` (super_admin de plataforma), o
 *   · `schools.owner_id = usuario`, o
 *   · `school_members` activo con rol owner / admin / school_admin.
 * Variante lectura (historial, informe de descuentos): además `accountant`.
 * Nunca coach, reporter, parent ni athlete. Nunca `profiles.role` (lo escribe
 * el propio usuario: ver invoicing.authz.test.ts).
 */
import type { NextFunction, Request, Response } from 'express';
import { supabase } from '../config/supabase';

export const ROLES_ADMIN_FINANZAS = ['owner', 'admin', 'school_admin'] as const;
export const ROLES_LECTURA_FINANZAS = [...ROLES_ADMIN_FINANZAS, 'accountant'] as const;

/**
 * Nivel de acceso del usuario a las finanzas de la escuela.
 *  - 'dueno'      → owner de la escuela (owner_id o miembro con rol owner) o plataforma.
 *                   Es el único que factura horas adicionales (H4 / Q6).
 *  - 'admin'      → admin / school_admin.
 *  - 'lector'     → accountant (solo lectura).
 *  - null         → nada.
 */
export type NivelFinanzas = 'dueno' | 'admin' | 'lector' | null;

export async function nivelFinanzasEnEscuela(userId: string, schoolId: string): Promise<NivelFinanzas> {
    if (!userId || !schoolId) return null;

    const { data: plataforma, error: errPlat } = await supabase
        .from('platform_admins')
        .select('profile_id')
        .eq('profile_id', userId)
        .eq('is_active', true)
        .limit(1);
    if (errPlat) throw new Error(`platform_admins: ${errPlat.message}`);
    if ((plataforma ?? []).length > 0) return 'dueno';

    const { data: escuela, error: errEsc } = await supabase
        .from('schools').select('owner_id').eq('id', schoolId).maybeSingle();
    if (errEsc) throw new Error(`schools: ${errEsc.message}`);
    if (escuela?.owner_id && escuela.owner_id === userId) return 'dueno';

    // limit y no maybeSingle: school_members no garantiza una fila por (escuela, perfil).
    const { data: miembros, error: errMem } = await supabase
        .from('school_members')
        .select('role')
        .eq('school_id', schoolId)
        .eq('profile_id', userId)
        .eq('status', 'active')
        .in('role', ROLES_LECTURA_FINANZAS as unknown as string[])
        .limit(5);
    if (errMem) throw new Error(`school_members: ${errMem.message}`);
    const roles = new Set((miembros ?? []).map((m: { role: string }) => m.role));
    if (roles.has('owner')) return 'dueno';
    if (roles.has('admin') || roles.has('school_admin')) return 'admin';
    if (roles.has('accountant')) return 'lector';
    return null;
}

declare global {
    namespace Express {
        interface Request {
            /** Lo deja assertSchoolFinance*: nivel del usuario en req.schoolId. */
            nivelFinanzas?: Exclude<NivelFinanzas, null>;
        }
    }
}

function gate(lectura: boolean) {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ error: 'No autenticado.' });
            const schoolId = req.schoolId;
            if (!schoolId) {
                return res.status(400).json({ error: 'Falta la escuela (encabezado x-school-id).', code: 'SIN_ESCUELA' });
            }
            const nivel = await nivelFinanzasEnEscuela(userId, schoolId);
            const permitido = nivel === 'dueno' || nivel === 'admin' || (lectura && nivel === 'lector');
            if (!permitido) {
                return res.status(403).json({
                    error: lectura
                        ? 'Solo la administración o el contador de la escuela pueden ver esta información.'
                        : 'Solo la administración de la escuela (dueño o administrador) puede generar cobros, registrar pagos o aplicar descuentos.',
                    code: 'SIN_PERMISO',
                });
            }
            req.nivelFinanzas = nivel;
            next();
        } catch (err) {
            req.log?.error?.({ err }, 'assertSchoolFinanceAdmin: no se pudo verificar el permiso');
            return res.status(500).json({ error: 'No se pudo verificar tu permiso. Intenta de nuevo.' });
        }
    };
}

/** owner / admin / school_admin de req.schoolId (o plataforma). Para todo lo que escribe. */
export const assertSchoolFinanceAdmin = gate(false);
/** Lo anterior + accountant. Solo para GET. */
export const assertSchoolFinanceReader = gate(true);
