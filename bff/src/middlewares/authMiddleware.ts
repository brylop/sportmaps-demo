import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';

// ── Augmentar el tipo global de Express.Request ───────────────────────────────
// Esto hace que TypeScript reconozca los campos en TODOS los handlers
// sin necesidad de castear req en cada ruta.
declare global {
    namespace Express {
        interface Request {
            user: { id: string; email: string };
            schoolId: string;
            role: 'admin' | 'coach' | 'staff' | 'parent' | 'athlete';
        }
    }
}

// Mantener el tipo para los handlers que quieran ser explícitos
export type AuthenticatedRequest = Request;

export const requireAuth = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token de autorización requerido.' });
        }

        const token = authHeader.split(' ')[1];

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return res.status(401).json({ error: 'Token inválido o expirado.' });
        }

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

        req.user = { id: user.id, email: user.email! };
        req.schoolId = profile.school_id;
        req.role = profile.role;

        next();
    } catch (err) {
        next(err);
    }
};

export const requireRole = (...roles: Request['role'][]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!roles.includes(req.role)) {
            return res.status(403).json({
                error: `Acceso denegado. Roles permitidos: ${roles.join(', ')}.`,
            });
        }
        next();
    };
};
