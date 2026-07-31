-- =============================================================================
-- 20260731183142_touch_function_baseline.sql
-- Autor: brylop   Fecha: 2026-07-31   Versión anterior: 20260731163725
-- Objetivo: dar línea base a `update_updated_at_column()`, que ninguna migración
--           crea y que M1 del Informe Mensual (20260731161043) usa en TRES
--           triggers.
--
-- Cómo salió: el barrido de `npm run migrations:drift` la listó como no
--   versionada. Antes yo había dado por hecho que existía porque un grep de
--   «FUNCTION public.update_updated_at_column» daba resultado — pero era la
--   REFERENCIA de un `CREATE TRIGGER … EXECUTE FUNCTION`, no un `CREATE
--   FUNCTION`. La función nunca se crea en el repo.
--
-- Efecto sin esto: sobre una base LIMPIA, M1 falla al crear
--   trg_athlete_reports_touch / trg_team_report_notes_touch /
--   trg_report_team_schedule_touch, porque la función no existe. Sobre la base
--   compartida no pasa nada: ahí sí está.
--
-- Alcance deliberadamente MÍNIMO. El barrido encontró ~336 objetos sin versionar
-- (56 tablas, ~137 funciones, ~143 columnas): módulos enteros construidos fuera
-- del repo. Eso NO se arregla acá — ver la nota final.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--
-- LECCIÓN DE LOCKS (del deadlock de 20260731154626): esta migración no toma
--   ningún lock sobre tablas. Solo consulta pg_proc y, si falta, crea una
--   función. No hay ALTER TABLE.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- Se crea SOLO si falta, igual que is_parent_of_child en M0: con
-- `CREATE OR REPLACE` estaría pisando la función real de la base con esta
-- reconstrucción, y no la volqué — la deduje del uso.
--
-- El cuerpo es el estándar de un trigger de touch y no admite mucha variación:
-- BEFORE UPDATE FOR EACH ROW, pone NEW.updated_at = now() y devuelve NEW. El
-- riesgo de que la real difiera es bajo, y la guarda lo vuelve irrelevante para
-- la base compartida.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname  = 'update_updated_at_column'
          AND p.pronargs = 0
    ) THEN
        EXECUTE $fn$
            CREATE FUNCTION public.update_updated_at_column()
            RETURNS trigger
            LANGUAGE plpgsql
            SET search_path = pg_catalog, public, pg_temp
            AS $body$
            BEGIN
                NEW.updated_at = now();
                RETURN NEW;
            END;
            $body$;
        $fn$;
    END IF;
END $$;

COMMIT;

-- =============================================================================
-- LO QUE ESTO **NO** ARREGLA — el tamaño real de la deriva
--
-- `npm run migrations:drift` (scripts/find_schema_drift.mjs) midió, contra 302
-- migraciones, unos **336 objetos que la base tiene y el repo no crea**:
--
--   · ~56 tablas — módulos ENTEROS construidos fuera del repo: biomecánica
--     (5 tablas), torneos y delegaciones (8), caja y contabilidad
--     (cash_sessions, cash_session_entries), entrenador personal (trainer_*,
--     coach_availability, coach_profiles), reservas (facility_availability,
--     reservation_payments), WhatsApp, referidos, demo_links,
--     identity_documents, payment_installments…
--   · ~137 funciones — incluidas piezas de uso diario: submit_enrollment,
--     upsert_attendance_record, close_cash_session, get_school_athletes,
--     mark_overdue_payments, fn_trigger_push_on_notification.
--   · ~143 columnas en tablas que el repo SÍ crea — entre ellas
--     `enrollments.monthly_fee`, `enrollments.unregistered_athlete_id`,
--     `teams.price_monthly`, `payments.user_id`,
--     `payments.unregistered_athlete_id`, `school_staff.coach_auth_id`.
--
-- Conviene decirlo en voz alta: **la cadena ya estaba rota para una base limpia,
-- y no por el módulo de informes.** `open_month` (20260724000002) lee
-- `teams.price_monthly` y `enrollments.monthly_fee`, ambas sin versionar.
-- Migraciones viejas fallarían igual.
--
-- Por qué NO se regulariza acá: escribir a mano 336 objetos es semanas de
-- transcripción propensa a error — ya se vio con is_parent_of_child, cuyo cuerpo
-- hubo que reconstruir. El camino sensato es un `pg_dump --schema-only` contra
-- la base (cadena de conexión en el panel de Supabase → Settings → Database) y
-- una ÚNICA migración de línea base GENERADA, no escrita.
--
-- Y antes de eso hay una decisión que no es técnica: el barrido listó **7 tablas
-- de respaldo ad-hoc** (`_backup_payments_fantasma_20260728` con 2166 filas,
-- `bkp_f0_payments_20260731` con 158, `_backup_school_addons_20260514`,
-- `_backup_school_subscriptions_20260514`, `_backup_schools_is_demo_20260514`,
-- `_backup_paola_checkout_20260729`, `bkp_f0_enrollments_20260731`). Esas NO se
-- versionan: o se borran o se excluyen del dump a propósito. Lo decide quien las
-- creó.
-- =============================================================================
