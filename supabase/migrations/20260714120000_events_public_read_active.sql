-- ============================================================
-- SPORTMAPS — Fix RLS: lectura pública de eventos ACTIVOS y públicos
-- ------------------------------------------------------------
-- BUG: la policy events_public_read exigía status IN ('published','ongoing'),
-- valores que NO existen en el CHECK de events.status (draft/active/closed/
-- cancelled/completed). Resultado: un visitante ANÓNIMO no veía NINGÚN evento
-- por su link público → "Evento no encontrado".
--
-- FIX: un anónimo puede leer un evento solo si está ACTIVO, con visibilidad
-- pública y con inscripciones abiertas. Los borradores, internos (school_only)
-- y privados (invited_only) NO son visibles para anónimos.
-- (Los usuarios autenticados siguen leyendo vía events_select_authenticated.)
-- Fecha: 2026-07-14
-- ============================================================

DROP POLICY IF EXISTS events_public_read ON public.events;
CREATE POLICY events_public_read ON public.events
    FOR SELECT
    USING (
        status = 'active'
        AND visibility = 'public'
        AND registrations_open = true
    );

NOTIFY pgrst, 'reload schema';
