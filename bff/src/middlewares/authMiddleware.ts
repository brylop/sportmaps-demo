import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';

// ── Augmentar el tipo global de Express.Request ───────────────────────────────
declare global {
    namespace Express {
        interface Request {
            user: { id: string; email: string };
            schoolId: string;
            branchId: string | null;
            role: 'owner' | 'admin' | 'super_admin' | 'auditor' | 'reporter'
            | 'school_admin' | 'school' | 'coach' | 'parent' | 'athlete' | 'staff';
        }
    }
}

export type AuthenticatedRequest = Request;

// Roles que siempre pasan requireRole sin necesidad de estar listados
const PRIVILEGED_ROLES = ['owner', 'super_admin', 'admin'] as const;

// ─────────────────────────────────────────────────────────────────────────────
export const requireBasicAuth = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token de autorización requerido.' });
        }
        
        const token = authHeader.split(' ')[1];
        // Solo necesitamos pasar el token al request para que los controladores hagan pass-through a BD
        (req as any).userToken = token;
        
        next();
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
export const requireAuth = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        // 1. Validar Bearer token
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token de autorización requerido.' });
        }

        const token = authHeader.split(' ')[1];
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({ error: 'Token inválido o expirado.' });
        }

        // 2. Leer el schoolId del header (enviado por bffClient)
        //    NOTA: tabla school_members solo tiene `profile_id` (no `user_id`)
        const targetSchoolId = req.headers['x-school-id'] as string | undefined;

        let q = supabase
            .from('school_members')
            .select('school_id, role, branch_id')
            .eq('profile_id', user.id)
            .eq('status', 'active');

        // Si el frontend envió x-school-id, filtrar por esa escuela exacta.
        // De lo contrario, tomar el primer registro activo del usuario.
        if (targetSchoolId) {
            q = q.eq('school_id', targetSchoolId);
        }

        const { data: members, error: memberErr } = await q
            .order('joined_at', { ascending: false })
            .limit(1);

        if (memberErr) {
            req.log?.error({ err: memberErr }, 'Error consultando school_members');
            return res.status(500).json({ error: 'Error interno verificando permisos.' });
        }

        if (!members || members.length === 0) {
            return res.status(403).json({
                error: 'No tienes permisos para acceder a esta escuela.',
                detail: `profile_id=${user.id} no encontrado en school_members con status=active`
                    + (targetSchoolId ? ` y school_id=${targetSchoolId}` : ''),
            });
        }

        const member = members[0] as any;

        req.user = { id: user.id, email: user.email! };
        req.schoolId = member.school_id;
        req.branchId = member.branch_id ?? null;
        req.role = member.role;

        next();
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
export const requireRole = (...roles: Request['role'][]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        // Los roles privilegiados siempre pasan aunque no estén en la lista
        if ((PRIVILEGED_ROLES as readonly string[]).includes(req.role)) {
            return next();
        }

        if (!roles.includes(req.role)) {
            return res.status(403).json({
                error: `Acceso denegado. Roles permitidos: ${roles.join(', ')}.`,
                receivedRole: req.role,
            });
        }

        next();
    };
};
