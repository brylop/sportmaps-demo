-- =============================================================================
-- 20261024225703_notifications_trial_block_permite_school_null.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-25   Versión anterior: 20261024211855
-- Objetivo: que el usuario pueda marcar como leídas (y eliminar) sus
--   notificaciones personales, las que no traen school_id.
-- =============================================================================
-- Causa (medida en la base viva el 2026-10-24):
--   `trial_block_update` / `trial_block_delete` sobre public.notifications son
--   RESTRICTIVE con USING (school_is_operational(school_id)). Con school_id NULL
--   la función devuelve NULL (no hay fila en schools) → la fila queda fuera del
--   UPDATE/DELETE sin error: PostgREST responde 204 y 0 filas. «Marcar todas
--   como leídas», «Marcar como leída», la campana y «Eliminar» no hacían nada.
--   4.893 de 7.882 notificaciones tienen school_id NULL (cobros, torneos,
--   recordatorios de entreno, pagos confirmados…); 4.428 están sin leer.
--   Simulado como mherrera@demo: SELECT ve la fila, UPDATE devuelve 0.
--
-- Fix: mismo patrón que products (20261003202431 §5): sin escuela no hay
--   prueba que bloquear. Las policies PERMISSIVE (`notifications_*_own`,
--   user_id = auth.uid()) siguen siendo las que dan el acceso; esto solo deja
--   de restar las filas sin escuela. Ningún permiso nuevo: notifications no
--   tiene policy permisiva de INSERT, así que el cliente sigue sin poder crear.
--   Con escuela, el bloqueo de prueba queda exactamente igual.
-- =============================================================================

BEGIN;

ALTER POLICY trial_block_update ON public.notifications
    USING (school_id IS NULL OR public.school_is_operational(school_id))
    WITH CHECK (school_id IS NULL OR public.school_is_operational(school_id));

ALTER POLICY trial_block_delete ON public.notifications
    USING (school_id IS NULL OR public.school_is_operational(school_id));

ALTER POLICY trial_block_insert ON public.notifications
    WITH CHECK (school_id IS NULL OR public.school_is_operational(school_id));

COMMIT;

-- Verificación (como el acudiente, dentro de una transacción con ROLLBACK):
--   select set_config('request.jwt.claims', json_build_object('sub','<uuid>','role','authenticated')::text, true);
--   set local role authenticated;
--   update public.notifications set read = true where user_id = '<uuid>' and not read returning id;  -- > 0 filas
