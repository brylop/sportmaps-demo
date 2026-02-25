import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';

// ── Tipos ────────────────────────────────────────────────────────────────────
export interface AuthenticatedRequest extends Request {
    user: {
        id: string;
        email: string;
    };
    schoolId: string;
    role: 'admin' | 'coach' | 'staff' | 'parent' | 'athlete';
}

// ── Middleware principal ──────────────────────────────────────────────────────
export const requireAuth = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token de autorización requerido.' });
        }

        const token = authHeader.split(' ')[1];

        // 1. Validar JWT con Supabase Auth
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return res.status(401).json({ error: 'Token inválido o expirado.' });
        }

        // 2. ⚠️  CRÍTICO: school_id viene de la DB, NO de user_metadata.
        //    user_metadata puede ser modificado por el usuario desde el cliente.
        //    La única fuente de verdad es la tabla de perfiles en el servidor.
        const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('school_id, role')
            .eq('user_id', user.id)
            .single();

        if (profileError || !profile) {
            return res.status(403).json({ error: 'Perfil de usuario no encontrado.' });
        }

        if (!profile.school_id) {
            return res.status(403).json({ error: 'Usuario no asociado a ninguna escuela.' });
        }

        // 3. Inyectar contexto verificado en el request
        req.user = { id: user.id, email: user.email! };
        req.schoolId = profile.school_id;
        req.role = profile.role;

        next();
    } catch (err) {
        next(err);
    }
};

// ── Guard de roles ────────────────────────────────────────────────────────────
export const requireRole = (...roles: AuthenticatedRequest['role'][]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!roles.includes(req.role)) {
            return res.status(403).json({
                error: `Acceso denegado. Roles permitidos: ${roles.join(', ')}.`,
            });
        }
        next();
    };
};
