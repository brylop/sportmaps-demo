-- ==============================================================================
-- OPTIMIZATION SCRIPT: PERFORMANCE TUNING & CLEANUP
-- Fecha: 2026-02-17
-- Autor: Antigravity AI Agent
-- Descripción: Aplica mejoras de rendimiento sugeridas:
--              1. Elimina índices redundantes.
--              2. Crea índices compuestos para dashboards.
--              3. Habilita pg_trgm y crea índices GIN para búsquedas.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. LIMPIEZA: Eliminar índices redundantes (Duplicados)
-- ------------------------------------------------------------------------------
-- Estos índices duplican la funcionalidad de los índices de clave foránea estándar
DROP INDEX IF EXISTS idx_event_registrations_event; 
DROP INDEX IF EXISTS idx_events_creator;
DROP INDEX IF EXISTS idx_events_date;
DROP INDEX IF EXISTS idx_health_records_athlete;
DROP INDEX IF EXISTS idx_health_records_professional;
DROP INDEX IF EXISTS idx_wellness_appointments_professional;
DROP INDEX IF EXISTS idx_wellness_evaluations_athlete;
DROP INDEX IF EXISTS idx_wellness_evaluations_professional;

-- ------------------------------------------------------------------------------
-- 2. VELOCIDAD: Índices Compuestos (Para Dashboards y Filtros Comunes)
-- ------------------------------------------------------------------------------

-- Financiero: Filtrar pagos por escuela + estado + fecha
CREATE INDEX IF NOT EXISTS idx_payments_school_status_date 
ON public.payments (school_id, status, due_date);

-- Asistencia: Historial de alumno en escuela por fecha
-- Nota: Usamos 'date' (nombre real columna) en lugar de 'attendance_date'
CREATE INDEX IF NOT EXISTS idx_attendance_records_composite 
ON public.attendance_records (school_id, student_id, date);

-- Calendario: Clases por escuela/día/hora
CREATE INDEX IF NOT EXISTS idx_classes_school_schedule 
ON public.classes (school_id, day_of_week, start_time);

-- Miembros: Login y verificación de estado (Ya incluido en fixes anteriores, pero reforzamos)
CREATE INDEX IF NOT EXISTS idx_school_members_composite 
ON public.school_members (school_id, profile_id, status);

-- ------------------------------------------------------------------------------
-- 3. BÚSQUEDA AVANZADA: Índices GIN y Trigramas
-- ------------------------------------------------------------------------------

-- Habilitar extensión para búsqueda de texto difuso (fuzzy search)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Búsqueda rápida de Escuelas por nombre (ej. "Academia" encuentra "Academia del Norte")
CREATE INDEX IF NOT EXISTS idx_schools_name_trgm 
ON public.schools USING GIN (name gin_trgm_ops);

-- Filtrado dentro de JSONB (ej. Horarios de programas)
CREATE INDEX IF NOT EXISTS idx_programs_schedule_gin 
ON public.programs USING GIN (schedule);

-- Analytics dentro de JSONB
CREATE INDEX IF NOT EXISTS idx_analytics_events_data_gin 
ON public.analytics_events USING GIN (event_data);

COMMIT;
