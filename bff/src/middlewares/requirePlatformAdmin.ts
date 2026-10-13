import type { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';

/**
 * requirePlatformAdmin — gate de plataforma para rutas que leen o escriben datos
 * de TODAS las escuelas.
 *
 * Pregunta a `platform_admins` (is_active), la misma fuente que
 * is_super_admin()/is_platform_admin() en la base. NO mira `req.role`:
 *
 *  - Detrás de requireAuth, `req.role` es el rol de MEMBRESÍA (school_members).
 *    Ahí 'owner' y 'admin' son dueño/admin DE UNA ESCUELA, y requireRole los deja
 *    pasar SIEMPRE (PRIVILEGED_ROLES). Por eso requireRole('super_admin','admin')
 *    abría estas rutas a los ~70 dueños/admins de escuela.
 *  - Detrás de requireMarketplaceAuth, `req.role` sale de `profiles.role`, que
 *    se fija en el signup desde raw_user_meta_data (autoasignable).
 *
 * Va DESPUÉS de un middleware que pueble `req.user` (requireAuth,
 * requireMarketplaceAuth…). Falla cerrado: sin usuario, error de base o sin fila
 * activa → 401/403.
 */
export async function requirePlatformAdmin(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'No autenticado.' });
        }
        if (!(await esAdminDePlataforma(userId))) {
            return res.status(403).json({ error: 'Requiere administrador de plataforma.' });
        }
        next();
    } catch (err) {
        next(err);
    }
}

/** true solo si el usuario tiene fila ACTIVA en platform_admins. Error de base → false. */
export async function esAdminDePlataforma(userId: string): Promise<boolean> {
    const { data, error } = await supabase
        .from('platform_admins')
        .select('profile_id')
        .eq('profile_id', userId)
        .eq('is_active', true)
        .limit(1);
    if (error) return false;
    return (data ?? []).length > 0;
}
