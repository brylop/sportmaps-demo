import cron from 'node-cron';
import { supabase } from '../config/supabase';

/**
 * Inicia los trabajos de mantenimiento programados para el BFF.
 */
export function initMaintenanceJobs() {
    // Configurar cron job para las 23:55 hora Colombia (UTC-5)
    // El formato cron es: minuto hora dia-mes mes dia-semana
    // Colombia está en UTC-5, por lo que las 23:55 COT son las 04:55 UTC (del día siguiente)
    // Usamos la zona horaria 'America/Bogota' si la librería lo soporta, o ajustamos a UTC.
    
    // Programación: 55 23 * * * (23:55 todos los días)
    cron.schedule('55 23 * * *', async () => {
        console.log('[CRON] Iniciando mantenimiento diario...');
        
        try {
            // 1. Finalizar sesiones de asistencia antiguas (zombis)
            const { data: finalizeData, error: finalizeError } = await supabase
                .rpc('auto_finalize_stale_sessions');
            
            if (finalizeError) {
                console.error('[CRON] Error al auto-finalizar sesiones:', finalizeError.message);
            } else {
                console.log(`[CRON] Sesiones finalizadas automáticamente: ${finalizeData?.[0]?.sessions_finalized ?? 0} en ${finalizeData?.[0]?.school_count ?? 0} escuelas.`);
            }

            // 2. Refrescar vista materializada de salud de sesiones
            const { error: refreshError } = await supabase
                .rpc('refresh_session_health');
            
            if (refreshError) {
                console.error('[CRON] Error al refrescar mv_session_health:', refreshError.message);
            } else {
                console.log('[CRON] Vista mv_session_health refrescada exitosamente.');
            }

            console.log('[CRON] Mantenimiento diario completado.');
        } catch (err) {
            console.error('[CRON] Error inesperado durante el mantenimiento:', err);
        }
    }, {
        scheduled: true,
        timezone: "America/Bogota"
    });

    console.log('[CRON] Trabajos de mantenimiento registrados para las 23:55 COT.');
}
