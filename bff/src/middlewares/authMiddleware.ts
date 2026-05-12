import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';

// ── Augmentar el tipo global de Express.Request ───────────────────────────────
declare global {
    namespace Express {
        interface Request {
            user: { 
                id: string; 
                email: string;
                user_metadata?: {
                    full_name?: string;
                    [key: string]: any;
                };
            };
            schoolId: string;
            branchId: string | null;
            role: 'owner' | 'admin' | 'super_admin' | 'auditor' | 'reporter'
            | 'school_admin' | 'school' | 'coach' | 'parent' | 'athlete' | 'staff' | 'organizer'
            | 'store_owner' | 'external_vendor' | 'wellness_professional' | 'personal_trainer';
            log: import('pino').Logger;
            id: string;
        }
    }
}

export type AuthenticatedRequest = Request;

// Roles que siempre pasan requireRole sin necesidad de estar listados
const PRIVILEGED_ROLES = ['owner', 'super_admin', 'admin'] as const;

// ── Permisos (mirror del frontend permissions.ts) ────────────────────────────
type Permission =
    | 'dashboard:view'
    | 'calendar:view' | 'calendar:create' | 'calendar:edit' | 'calendar:delete'
    | 'teams:view' | 'teams:create' | 'teams:edit' | 'teams:delete'
    | 'students:view' | 'students:create' | 'students:edit' | 'students:delete'
    | 'stats:view' | 'stats:edit'
    | 'reports:view' | 'reports:create'
    | 'finances:view' | 'finances:manage'
    | 'messages:view' | 'messages:send'
    | 'settings:view' | 'settings:edit'
    | 'events:view' | 'events:create' | 'events:edit' | 'events:delete'
    | 'admin:users' | 'admin:system' | 'admin:all'
    // Marketplace permissions
    | 'marketplace:browse' | 'marketplace:manage'
    | 'products:view' | 'products:create' | 'products:edit' | 'products:delete'
    | 'services:view' | 'services:create' | 'services:edit' | 'services:delete'
    | 'orders:view' | 'orders:manage'
    | 'appointments:view' | 'appointments:create' | 'appointments:manage'
    | 'inventory:view' | 'inventory:manage'
    | 'health_records:view' | 'health_records:create' | 'health_records:edit';

const rolePermissions: Record<string, Permission[]> = {
    athlete: [
        'dashboard:view', 'calendar:view', 'teams:view', 'stats:view',
        'messages:view', 'messages:send', 'settings:view', 'settings:edit', 'events:view',
        'marketplace:browse', 'orders:view', 'appointments:view'
    ],
    parent: [
        'dashboard:view', 'calendar:view', 'students:view', 'stats:view',
        'reports:view', 'messages:view', 'messages:send', 'settings:view', 'settings:edit', 'events:view',
        'marketplace:browse', 'orders:view', 'appointments:view', 'appointments:create'
    ],
    coach: [
        'dashboard:view', 'calendar:view', 'calendar:create', 'calendar:edit', 'calendar:delete',
        'teams:view', 'teams:create', 'teams:edit', 'students:view', 'students:edit',
        'stats:view', 'stats:edit', 'reports:view', 'reports:create',
        'messages:view', 'messages:send', 'settings:view', 'settings:edit', 'events:view'
    ],
    school: [
        'dashboard:view', 'calendar:view', 'calendar:create', 'calendar:edit', 'calendar:delete',
        'teams:view', 'teams:create', 'teams:edit', 'teams:delete',
        'students:view', 'students:create', 'students:edit', 'students:delete',
        'stats:view', 'stats:edit', 'reports:view', 'reports:create',
        'finances:view', 'finances:manage', 'messages:view', 'messages:send',
        'settings:view', 'settings:edit', 'events:view',
        'marketplace:manage', 'products:view', 'products:create', 'products:edit'
    ],
    wellness_professional: [
        'dashboard:view', 'calendar:view', 'calendar:create', 'students:view', 'students:edit',
        'reports:view', 'reports:create', 'messages:view', 'messages:send',
        'settings:view', 'settings:edit',
        'marketplace:manage', 'services:view', 'services:create', 'services:edit', 'services:delete',
        'appointments:view', 'appointments:create', 'appointments:manage',
        'health_records:view', 'health_records:create', 'health_records:edit'
    ],
    store_owner: [
        'dashboard:view', 'calendar:view', 'stats:view', 'reports:view', 'reports:create',
        'finances:view', 'finances:manage', 'messages:view', 'messages:send',
        'settings:view', 'settings:edit',
        'marketplace:manage', 'products:view', 'products:create', 'products:edit', 'products:delete',
        'orders:view', 'orders:manage', 'inventory:view', 'inventory:manage'
    ],
    organizer: [
        'dashboard:view', 'calendar:view', 'calendar:create', 'calendar:edit', 'calendar:delete',
        'events:view', 'events:create', 'events:edit', 'events:delete',
        'stats:view', 'reports:view', 'reports:create', 'finances:view', 'finances:manage',
        'messages:view', 'messages:send', 'settings:view', 'settings:edit'
    ],
    reporter: [
        'dashboard:view', 'calendar:view', 'teams:view', 'students:view',
        'stats:view', 'reports:view', 'reports:create', 'messages:view',
        'settings:view', 'settings:edit'
    ],
    admin: [
        'dashboard:view', 'calendar:view', 'calendar:create', 'calendar:edit', 'calendar:delete',
        'teams:view', 'teams:create', 'teams:edit', 'teams:delete',
        'students:view', 'students:create', 'students:edit', 'students:delete',
        'stats:view', 'stats:edit', 'reports:view', 'reports:create',
        'finances:view', 'finances:manage', 'messages:view', 'messages:send',
        'settings:view', 'settings:edit', 'events:view', 'events:create', 'events:edit', 'events:delete',
        'admin:users', 'admin:system', 'admin:all',
        'marketplace:browse', 'marketplace:manage',
        'products:view', 'products:create', 'products:edit', 'products:delete',
        'services:view', 'services:create', 'services:edit', 'services:delete',
        'orders:view', 'orders:manage', 'appointments:view', 'appointments:create', 'appointments:manage',
        'inventory:view', 'inventory:manage',
        'health_records:view', 'health_records:create', 'health_records:edit'
    ],
};

// Aliases para roles de BD que mapean a la misma matriz de permisos
rolePermissions['school_admin'] = rolePermissions.school;
rolePermissions['super_admin'] = rolePermissions.admin;
rolePermissions['owner'] = rolePermissions.admin;
rolePermissions['staff'] = rolePermissions.coach;
rolePermissions['personal_trainer'] = rolePermissions.coach;
// external_vendor reemplaza a store_owner como rol explícito de vendedor puro
rolePermissions['external_vendor'] = rolePermissions.store_owner;

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

        req.user = { 
            id: user.id, 
            email: user.email!, 
            user_metadata: user.user_metadata 
        };
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

// ─────────────────────────────────────────────────────────────────────────────
// requireVendorProfile — Autoriza por capability de vendor_profile,
// NO por role. Reemplaza a requireRole para rutas de venta.
//
// Uso:
//   router.use(requireMarketplaceAuth);
//   router.use(requireVendorProfile('can_sell_products'));
//
// Reglas:
//  - admin/super_admin/owner: pasan automáticamente.
//  - Resto: requieren vendor_profile.is_active = true Y la capability solicitada = true.
//  - El user_id se toma de req.user.id (debe haber pasado por un auth middleware).
//  - La verificación usa la función SQL has_vendor_capability(uuid, text)
//    creada en la migración 20260511000002.
// ─────────────────────────────────────────────────────────────────────────────
type VendorCapability = 'can_sell_products' | 'can_sell_services';

export const requireVendorProfile = (capability: VendorCapability) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        // Privilegios siempre pasan
        if ((PRIVILEGED_ROLES as readonly string[]).includes(req.role)) {
            return next();
        }

        if (!req.user?.id) {
            return res.status(401).json({ error: 'No autenticado.' });
        }

        try {
            const { data, error } = await supabase.rpc('has_vendor_capability', {
                p_user_id:    req.user.id,
                p_capability: capability,
            });

            if (error) {
                req.log?.error({ err: error, capability }, 'Error verificando capability de vendor');
                return res.status(500).json({ error: 'Error interno verificando permisos de vendedor.' });
            }

            if (data !== true) {
                return res.status(403).json({
                    error: 'Tu cuenta no tiene activada esta capacidad de venta.',
                    capability,
                    hint: 'Activa Mi Tienda desde tu dashboard para empezar a vender.',
                });
            }

            next();
        } catch (err) {
            next(err);
        }
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// requirePermission — Valida contra la matriz de permisos (mirror del frontend)
// Uso: requirePermission('students:create', 'students:edit')
// El usuario debe tener AL MENOS UNO de los permisos listados.
// ─────────────────────────────────────────────────────────────────────────────
export const requirePermission = (...permissions: Permission[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const userPerms = rolePermissions[req.role];

        // Rol desconocido → denegar
        if (!userPerms) {
            return res.status(403).json({
                error: 'Rol no reconocido. Acceso denegado.',
                receivedRole: req.role,
            });
        }

        const hasAny = permissions.some(p => userPerms.includes(p));
        if (!hasAny) {
            return res.status(403).json({
                error: `Permiso insuficiente. Se requiere: ${permissions.join(' | ')}.`,
                receivedRole: req.role,
            });
        }

        next();
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// requireOwnership — Previene IDOR (Insecure Direct Object Reference)
// Verifica que el recurso solicitado pertenece a la escuela del usuario.
//
// Uso: requireOwnership('children', 'id')
//   → Antes de ejecutar el handler, consulta `children` donde `id = req.params.id`
//     y verifica que `school_id = req.schoolId`.
//
// Para tablas sin school_id directo, usar el parámetro ownerField:
//   requireOwnership('event_organizers', 'id', 'profile_id')
//   → Verifica que `profile_id = req.user.id`
// ─────────────────────────────────────────────────────────────────────────────
export const requireOwnership = (
    table: string,
    paramName: string = 'id',
    ownerField: 'school_id' | 'profile_id' | 'user_id' | 'parent_id' | 'creator_id' = 'school_id',
) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const resourceId = req.params[paramName];
            if (!resourceId) {
                return res.status(400).json({ error: `Parámetro "${paramName}" requerido.` });
            }

            // Determinar el valor esperado según el campo de propiedad
            let expectedValue: string;
            if (ownerField === 'school_id') {
                expectedValue = req.schoolId;
            } else if (ownerField === 'profile_id' || ownerField === 'user_id' || ownerField === 'creator_id') {
                expectedValue = req.user.id;
            } else if (ownerField === 'parent_id') {
                expectedValue = req.user.id;
            } else {
                expectedValue = req.user.id;
            }

            const { data, error } = await supabase
                .from(table)
                .select('id')
                .eq('id', resourceId)
                .eq(ownerField, expectedValue)
                .maybeSingle();

            if (error) {
                req.log?.error({ err: error, table, resourceId }, 'Error verificando propiedad del recurso');
                return res.status(500).json({ error: 'Error verificando propiedad del recurso.' });
            }

            if (!data) {
                return res.status(404).json({
                    error: 'Recurso no encontrado o no tienes acceso.',
                });
            }

            next();
        } catch (err) {
            next(err);
        }
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// auditLog — Registra acciones sensibles en security_audit_log
// Uso dentro de un handler:
//   await auditLog(req, 'payment_create', 'payments', paymentId, null, { amount });
// ─────────────────────────────────────────────────────────────────────────────
export const auditLog = async (
    req: Request,
    action: string,
    targetTable: string,
    targetId: string,
    oldValue?: Record<string, unknown> | null,
    newValue?: Record<string, unknown> | null,
) => {
    try {
        await supabase.from('security_audit_log').insert({
            user_id: req.user?.id || null,
            action,
            target_table: targetTable,
            target_id: targetId,
            old_value: oldValue || null,
            new_value: newValue || null,
            ip_address: req.ip || req.headers['x-forwarded-for'] || null,
            user_agent: req.headers['user-agent'] || null,
            metadata: {
                school_id: req.schoolId || null,
                role: req.role || null,
                request_id: req.id || null,
            },
        });
    } catch (err) {
        // Audit failure must never break the request
        req.log?.warn({ err, action, targetTable, targetId }, 'Audit log write failed');
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// requireMarketplaceAuth — Auth ligero para vendedores independientes
// Valida Bearer token y lee role de profiles, SIN requerir school_members.
// Usar para rutas de vendor que no dependen de contexto de escuela.
// ─────────────────────────────────────────────────────────────────────────────
export const requireMarketplaceAuth = async (
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
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({ error: 'Token inválido o expirado.' });
        }

        // Leer role directamente de profiles (no de school_members)
        const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();

        if (profileErr) {
            req.log?.error({ err: profileErr }, 'Error consultando profile para marketplace auth');
            return res.status(500).json({ error: 'Error interno verificando permisos.' });
        }

        req.user = { 
            id: user.id, 
            email: user.email!, 
            user_metadata: user.user_metadata 
        };
        req.role = (profile?.role as Request['role']) || 'athlete';
        // schoolId y branchId no aplican para vendor routes
        req.schoolId = '';
        req.branchId = null;

        next();
    } catch (err) {
        next(err);
    }
};

// requireTrainerAuth — Middleware exclusivo para entrenadores personales.
// No depende de school_members — resuelve el schoolId directo desde schools.
// ─────────────────────────────────────────────────────────────────────────────
export const requireTrainerAuth = async (
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
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({ error: 'Token inválido o expirado.' });
        }

        // Resolver el workspace del entrenador personal
        const { data: school, error: schoolErr } = await supabase
            .from('schools')
            .select('id, school_type, onboarding_status')
            .eq('owner_id', user.id)
            .eq('school_type', 'personal_trainer')
            .maybeSingle();

        if (schoolErr) {
            req.log?.error({ err: schoolErr }, 'Error consultando trainer school');
            return res.status(500).json({ error: 'Error interno verificando permisos.' });
        }

        // Si no tiene workspace aún, verificar si al menos tiene rol personal_trainer
        // para permitir que el onboarding/provisioning pueda correr
        if (!school) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .maybeSingle();

            if (profile?.role !== 'personal_trainer') {
                return res.status(403).json({
                    error: 'Acceso denegado. Se requiere rol de entrenador personal.',
                });
            }

            req.user     = { 
                id: user.id, 
                email: user.email!, 
                user_metadata: user.user_metadata 
            };
            req.schoolId = '';
            req.branchId = null;
            req.role     = 'owner' as Request['role'];
            return next();
        }

        req.user     = { 
            id: user.id, 
            email: user.email!, 
            user_metadata: user.user_metadata 
        };
        req.schoolId = school.id;
        req.branchId = null;
        req.role     = 'owner' as Request['role'];

        next();
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// optionalAuth — Auth opcional para rutas publicas del marketplace
// Si hay token valido, setea req.user. Si no, req.user = null y continua.
// Permite browsing anonimo con personalizacion para usuarios logueados.
// ─────────────────────────────────────────────────────────────────────────────
export const optionalAuth = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            (req as any).user = null;
            return next();
        }

        const token = authHeader.split(' ')[1];
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            // El caller envio un Authorization header pero el token es invalido.
            // Antes esto pasaba silencioso y el atacante podia probar tokens sin
            // dejar rastro. Logueamos para que aparezca en metricas de seguridad
            // y se pueda correlacionar con ataques.
            req.log?.warn(
                {
                    err: authError?.message ?? null,
                    ua: req.headers['user-agent'],
                    ip: req.ip,
                },
                'optionalAuth: JWT presente pero invalido — continuando como anon',
            );
            (req as any).user = null;
            return next();
        }

        req.user = {
            id: user.id,
            email: user.email!,
            user_metadata: user.user_metadata,
        };

        next();
    } catch (err) {
        // Igual que el caso de JWT invalido pero por error inesperado del SDK.
        req.log?.warn(
            { err: (err as any)?.message ?? err, ua: req.headers['user-agent'], ip: req.ip },
            'optionalAuth: error inesperado validando JWT — continuando como anon',
        );
        (req as any).user = null;
        next();
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// requireAthleteAuth — Middleware para atletas y padres (self-service).
// No requiere school_members si solo accede a su propia información de perfil.
// ─────────────────────────────────────────────────────────────────────────────
export const requireAthleteAuth = async (
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
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({ error: 'Token inválido o expirado.' });
        }

        // Leer perfil para confirmar rol
        const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('id, role')
            .eq('id', user.id)
            .maybeSingle();

        if (profileErr) {
            req.log?.error({ err: profileErr }, 'Error consultando profile para athlete auth');
            return res.status(500).json({ error: 'Error interno verificando permisos.' });
        }

        const role = profile?.role as string;
        if (!['athlete', 'parent', 'owner', 'personal_trainer'].includes(role)) {
            return res.status(403).json({
                error: 'Acceso denegado. Se requiere rol de atleta o padre.',
            });
        }

        req.user     = { 
            id: user.id, 
            email: user.email!, 
            user_metadata: user.user_metadata 
        };
        req.role     = role as Request['role'];
        req.schoolId = ''; // No aplica contexto de escuela obligatoria
        req.branchId = null;

        next();
    } catch (err) {
        next(err);
    }
};
