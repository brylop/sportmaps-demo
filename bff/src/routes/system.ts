import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth, requireRole } from '../middlewares/authMiddleware';

const router = Router();

/**
 * Endpoint manual para disparar la limpieza de sesiones.
 * Solo accesible por administradores globales.
 */
router.post('/cleanup', requireAuth, requireRole('admin', 'super_admin'), async (req: Request, res: Response) => {
    req.log?.info('Ejecutando limpieza manual de sesiones...');
    
    try {
        const { data: finalizeData, error: finalizeError } = await supabase
            .rpc('auto_finalize_stale_sessions');
        
        if (finalizeError) throw finalizeError;

        const { error: refreshError } = await supabase
            .rpc('refresh_session_health');
        
        if (refreshError) throw refreshError;

        return res.json({
            ok: true,
            summary: finalizeData?.[0] || { sessions_finalized: 0, school_count: 0 },
            message: 'Limpieza y refresco de vista completados exitosamente.'
        });
    } catch (err: any) {
        req.log?.error({ err }, 'Error en cleanup manual');
        return res.status(500).json({ error: err.message });
    }
});

export default router;
