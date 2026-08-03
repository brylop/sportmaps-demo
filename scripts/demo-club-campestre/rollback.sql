-- ============================================================
-- ROLLBACK del tenant demo "Club Campestre Demo"
--
-- NO SE EJECUTA SOLO. Revisar, y correr a mano en el SQL Editor de Supabase.
-- Borra en orden de FK, todo filtrado por el school_id del club demo.
--
-- school_id: 25a123f0-6d57-48a4-9800-7b1531d61cd2
--
-- Recordatorios del repo:
--   · El SQL Editor no acepta CREATE TEMP TABLE ni RAISE NOTICE → el reporte va
--     en el SELECT final.
--   · Para borrar los usuarios de auth hay que borrar `profiles` ANTES, y limpiar
--     las referencias escondidas (school_staff.coach_auth_id, storage.objects.owner).
--     Eso está al final, comentado y aparte, porque toca auth.users.
-- ============================================================

-- ── 0. PREFLIGHT: qué se va a borrar (correr esto primero, solo lee) ────────
-- SELECT 'payments' t, count(*) FROM public.payments WHERE school_id = '25a123f0-6d57-48a4-9800-7b1531d61cd2'
-- UNION ALL SELECT 'children',    count(*) FROM public.children             WHERE school_id = '25a123f0-6d57-48a4-9800-7b1531d61cd2'
-- UNION ALL SELECT 'enrollments', count(*) FROM public.enrollments          WHERE school_id = '25a123f0-6d57-48a4-9800-7b1531d61cd2'
-- UNION ALL SELECT 'teams',       count(*) FROM public.teams                WHERE school_id = '25a123f0-6d57-48a4-9800-7b1531d61cd2'
-- UNION ALL SELECT 'unreg',       count(*) FROM public.unregistered_athletes WHERE school_id = '25a123f0-6d57-48a4-9800-7b1531d61cd2';

BEGIN;

-- Identificadores del club (una sola fuente para todo el script).
CREATE OR REPLACE VIEW public._demo_campestre_scope AS
    SELECT '25a123f0-6d57-48a4-9800-7b1531d61cd2'::uuid AS school_id;

-- ── 1. Bitácoras y dependientes de dispositivos ─────────────────────────────
DELETE FROM public.device_commands
 WHERE device_id IN (SELECT id FROM public.turnstile_devices WHERE school_id = (SELECT school_id FROM public._demo_campestre_scope));
DELETE FROM public.access_events      WHERE school_id = (SELECT school_id FROM public._demo_campestre_scope);
DELETE FROM public.zk_user_mappings   WHERE school_id = (SELECT school_id FROM public._demo_campestre_scope);
DELETE FROM public.turnstile_devices  WHERE school_id = (SELECT school_id FROM public._demo_campestre_scope);

-- ── 2. Asistencia ───────────────────────────────────────────────────────────
DELETE FROM public.attendance_records  WHERE school_id = (SELECT school_id FROM public._demo_campestre_scope);
DELETE FROM public.attendance_sessions WHERE school_id = (SELECT school_id FROM public._demo_campestre_scope);

-- ── 3. Torneo ───────────────────────────────────────────────────────────────
DELETE FROM public.event_registrations
 WHERE event_id IN (SELECT id FROM public.events WHERE school_id = (SELECT school_id FROM public._demo_campestre_scope));
DELETE FROM public.events WHERE school_id = (SELECT school_id FROM public._demo_campestre_scope);

-- ── 4. Cartera ──────────────────────────────────────────────────────────────
-- Ojo: incluye los cobros "secundarios" que van solo con parent_id (Tomás/tenis,
-- cuotas sociales de acudientes). Todos llevan school_id, así que entran acá.
DELETE FROM public.payment_installments
 WHERE payment_id IN (SELECT id FROM public.payments WHERE school_id = (SELECT school_id FROM public._demo_campestre_scope));
DELETE FROM public.expenses
 WHERE source_payment_id IN (SELECT id FROM public.payments WHERE school_id = (SELECT school_id FROM public._demo_campestre_scope));
DELETE FROM public.payments WHERE school_id = (SELECT school_id FROM public._demo_campestre_scope);

DELETE FROM public.payment_tokens
 WHERE user_id IN (SELECT id FROM public.profiles WHERE email LIKE '%@demo.sportmaps.co');

-- Fila sonda del seed (cancelada y ya desvinculada del club).
DELETE FROM public.payments WHERE id = '00000000-0000-4000-8000-0000000feed1';

-- ── 5. Inscripciones, deportistas y oferta ──────────────────────────────────
DELETE FROM public.team_members
 WHERE team_id IN (SELECT id FROM public.teams WHERE school_id = (SELECT school_id FROM public._demo_campestre_scope));
DELETE FROM public.team_coaches         WHERE school_id = (SELECT school_id FROM public._demo_campestre_scope);
DELETE FROM public.offering_coaches     WHERE school_id = (SELECT school_id FROM public._demo_campestre_scope);
DELETE FROM public.enrollments          WHERE school_id = (SELECT school_id FROM public._demo_campestre_scope);
DELETE FROM public.children             WHERE school_id = (SELECT school_id FROM public._demo_campestre_scope);
DELETE FROM public.unregistered_athletes WHERE school_id = (SELECT school_id FROM public._demo_campestre_scope);
DELETE FROM public.teams                WHERE school_id = (SELECT school_id FROM public._demo_campestre_scope);
DELETE FROM public.offering_plans       WHERE school_id = (SELECT school_id FROM public._demo_campestre_scope);
DELETE FROM public.offerings            WHERE school_id = (SELECT school_id FROM public._demo_campestre_scope);

-- ── 6. Estructura del club ──────────────────────────────────────────────────
DELETE FROM public.notifications        WHERE school_id = (SELECT school_id FROM public._demo_campestre_scope);
DELETE FROM public.facilities           WHERE school_id = (SELECT school_id FROM public._demo_campestre_scope);
DELETE FROM public.school_staff         WHERE school_id = (SELECT school_id FROM public._demo_campestre_scope);
DELETE FROM public.school_members       WHERE school_id = (SELECT school_id FROM public._demo_campestre_scope);
DELETE FROM public.school_addons        WHERE school_id = (SELECT school_id FROM public._demo_campestre_scope);
DELETE FROM public.school_subscriptions WHERE school_id = (SELECT school_id FROM public._demo_campestre_scope);
DELETE FROM public.school_settings      WHERE school_id = (SELECT school_id FROM public._demo_campestre_scope);
DELETE FROM public.school_branches      WHERE school_id = (SELECT school_id FROM public._demo_campestre_scope);
DELETE FROM public.schools              WHERE id        = (SELECT school_id FROM public._demo_campestre_scope);

DROP VIEW public._demo_campestre_scope;

-- Reporte final (el SQL Editor no imprime NOTICE).
SELECT 'club borrado' AS resultado,
       (SELECT count(*) FROM public.schools  WHERE id = '25a123f0-6d57-48a4-9800-7b1531d61cd2') AS escuelas_restantes,
       (SELECT count(*) FROM public.payments WHERE school_id = '25a123f0-6d57-48a4-9800-7b1531d61cd2') AS cobros_restantes,
       (SELECT count(*) FROM public.profiles WHERE email LIKE '%@demo.sportmaps.co') AS perfiles_demo_pendientes;

COMMIT;

-- ============================================================
-- 7. USUARIOS DE AUTH — aparte y a conciencia
--
-- Solo si además se quieren eliminar las 17 cuentas. Borra los perfiles PRIMERO
-- y limpia las referencias escondidas; después se borran los usuarios desde el
-- panel de Authentication o con la Admin API.
-- ============================================================
-- UPDATE public.school_staff SET coach_auth_id = NULL
--  WHERE coach_auth_id IN (SELECT id FROM public.profiles WHERE email LIKE '%@demo.sportmaps.co');
-- UPDATE storage.objects SET owner = NULL
--  WHERE owner IN (SELECT id FROM public.profiles WHERE email LIKE '%@demo.sportmaps.co');
-- DELETE FROM public.user_roles WHERE user_id IN (SELECT id FROM public.profiles WHERE email LIKE '%@demo.sportmaps.co');
-- DELETE FROM public.profiles   WHERE email LIKE '%@demo.sportmaps.co';
-- DELETE FROM auth.users        WHERE email LIKE '%@demo.sportmaps.co';
