-- ============================================================
-- SPORTMAPS - SCRIPT DE RESETEO DE SISTEMA (HARD RESET) - V3 FINAL
-- Propósito: Eliminar todos los datos que no sean de DEMO.
-- Este script es defensivo contra triggers huérfanos y esquemas híbridos.
-- ============================================================

BEGIN;

-- 0. Limpieza de Triggers/Funciones Huérfanas (que bloquean el borrado)
DROP TRIGGER IF EXISTS trg_sync_program_participants ON public.children;
DROP TRIGGER IF EXISTS trg_sync_program_participants_on_enrollments ON public.enrollments;
DROP FUNCTION IF EXISTS sync_program_participant_count();

-- 1. Tablas de Comunicación y Notificaciones
DELETE FROM public.notifications WHERE user_id IN (SELECT id FROM public.profiles WHERE is_demo = false);
DELETE FROM public.message_attachments;
DELETE FROM public.messages;
DELETE FROM public.announcements;

-- 2. Tablas de Pagos y Comercio
DELETE FROM public.payment_reminders;
DELETE FROM public.payments WHERE school_id IN (SELECT id FROM public.schools WHERE is_demo = false);
DELETE FROM public.order_items;
DELETE FROM public.orders;
DELETE FROM public.carts;
DELETE FROM public.products;

-- 3. Tablas de Rendimiento, Asistencia y Registro
DELETE FROM public.attendance_records WHERE child_id IN (SELECT id FROM public.children WHERE is_demo = false);
DELETE FROM public.academic_progress WHERE child_id IN (SELECT id FROM public.children WHERE is_demo = false);
DELETE FROM public.session_attendance;
DELETE FROM public.training_sessions;
DELETE FROM public.training_plans;
DELETE FROM public.match_results;
DELETE FROM public.team_members;
DELETE FROM public.training_logs;
DELETE FROM public.event_registrations;
DELETE FROM public.event_telemetry;
DELETE FROM public.athlete_stats;

-- 4. Tablas de Inscripciones y Clases
DELETE FROM public.class_enrollments;
DELETE FROM public.enrollments WHERE child_id IN (SELECT id FROM public.children WHERE is_demo = false);
DELETE FROM public.classes WHERE school_id IN (SELECT id FROM public.schools WHERE is_demo = false);
DELETE FROM public.activities WHERE is_demo = false;
DELETE FROM public.calendar_events WHERE is_demo = false;
DELETE FROM public.reviews;

-- 5. Tablas de Estructura Académica (Utilizando 'teams' que reemplazó a 'programs')
DELETE FROM public.children WHERE is_demo = false;
DELETE FROM public.teams WHERE is_demo = false;
-- Omitimos 'programs' ya que la tabla no existe en el esquema actual

-- 6. Gestión de Escuelas
DELETE FROM public.invitations WHERE status != 'accepted' OR school_id IN (SELECT id FROM public.schools WHERE is_demo = false);
DELETE FROM public.facilities WHERE school_id IN (SELECT id FROM public.schools WHERE is_demo = false);
DELETE FROM public.school_staff WHERE school_id IN (SELECT id FROM public.schools WHERE is_demo = false);
DELETE FROM public.school_branches WHERE school_id IN (SELECT id FROM public.schools WHERE is_demo = false);
DELETE FROM public.school_settings WHERE school_id IN (SELECT id FROM public.schools WHERE is_demo = false);
DELETE FROM public.school_members WHERE school_id IN (SELECT id FROM public.schools WHERE is_demo = false) OR profile_id IN (SELECT id FROM public.profiles WHERE is_demo = false);
DELETE FROM public.schools WHERE is_demo = false;

-- 7. Usuarios y Perfiles
DELETE FROM public.user_search_preferences WHERE user_id IN (SELECT id FROM public.profiles WHERE is_demo = false);
DELETE FROM public.user_roles WHERE user_id IN (SELECT id FROM public.profiles WHERE is_demo = false);

-- 8. Borrado de Auth (vía profiles)
DO $$
DECLARE
    u_id uuid;
BEGIN
    FOR u_id IN (SELECT id FROM public.profiles WHERE is_demo = false) LOOP
        BEGIN
            EXECUTE format('DELETE FROM auth.users WHERE id = %L', u_id);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'No se pudo borrar el usuario % de auth.users: %', u_id, SQLERRM;
        END;
    END LOOP;
END $$;

DELETE FROM public.profiles WHERE is_demo = false;

COMMIT;
