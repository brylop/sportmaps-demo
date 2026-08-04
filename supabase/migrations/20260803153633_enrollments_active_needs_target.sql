-- =============================================================================
-- 20260803153633_enrollments_active_needs_target.sql
-- Autor: brylop   Fecha: 2026-08-03   Versión anterior: 20260803153549
-- Objetivo: que la base impida lo que hasta hoy solo evitaba el código — una
--   inscripción activa que no apunta a ningún equipo ni a ningún plan.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================
--
-- Implementa **M2** de docs/plan-f0-generacion-de-mes-y-cobros-duplicados.md §3.5.
--
-- POR QUÉ HACE FALTA UNA INVARIANTE EN LA BASE
--
-- La huérfana —activa, sin equipo y sin plan— era invisible por partida doble:
-- `school_athletes` la ignora (sus LATERAL exigen team_id u offering_plan_id, así que
-- el listado se ve impecable) mientras `open_month` **sí** la factura, porque su
-- cascada cae hasta `children.monthly_fee` cuando no hay plan ni equipo. Cobros que
-- nadie podía ver en pantalla.
--
-- Los productores ya están cerrados en código (la RPC del QR, el editor de atletas y
-- POST /enrollments). Esto es el backstop: que ninguna vía futura pueda volver a
-- crearla, ni siquiera un UPDATE manual desde el editor SQL.
--
-- NOT VALID ES DELIBERADO
--
-- Al 2026-08-03 quedan **13 inscripciones activas sin equipo ni plan** en Dynasty: las
-- que creó el QR y a las que el backfill les puso la cuota pero todavía no el plan
-- (bloque 3.1 del runbook, pendiente de que la escuela confirme dos casos de $90.000).
--
-- Con `NOT VALID` el constraint **valida las filas nuevas desde ya** y no mira las
-- existentes, así que no bloquea el despliegue. Sin él, el `ALTER` fallaría y no se
-- podría aplicar hasta cerrar esas 13.
--
-- Cuando estén asignadas, hay que correr aparte:
--
--     ALTER TABLE public.enrollments VALIDATE CONSTRAINT enrollments_active_needs_target;
--
-- `VALIDATE` toma un lock más suave (SHARE UPDATE EXCLUSIVE) y no bloquea lecturas ni
-- escrituras normales, pero recorre la tabla entera: correrlo en horario tranquilo.

BEGIN;

-- Por debajo de deadlock_timeout (1s) para que, si la tabla está ocupada, falle con
-- 55P03 —claro y reintentable— en vez de deadlockear. Lección del 40P01 de hoy con
-- las policies de payments: ADD CONSTRAINT también pide AccessExclusiveLock, aunque
-- sea NOT VALID y no lea una sola fila.
SET LOCAL lock_timeout = '800ms';

ALTER TABLE public.enrollments
    ADD CONSTRAINT enrollments_active_needs_target
    CHECK (status <> 'active' OR team_id IS NOT NULL OR offering_plan_id IS NOT NULL)
    NOT VALID;

COMMENT ON CONSTRAINT enrollments_active_needs_target ON public.enrollments IS
    'Una inscripción activa tiene que apuntar a algo: equipo, plan o ambos. La cuarta combinación (activa sin nada) es la huérfana que school_athletes esconde y open_month factura. NOT VALID hasta que se asignen las 13 pendientes; después, VALIDATE CONSTRAINT.';

COMMIT;

-- ── Verificación después de aplicar ────────────────────────────────────────
--
-- 1) El constraint existe y está sin validar (convalidated = false es lo esperado):
--
--    SELECT conname, convalidated FROM pg_constraint
--     WHERE conname = 'enrollments_active_needs_target'
--
-- 2) Cuántas filas faltan para poder validarlo (hoy: 13):
--
--    SELECT count(*) FROM public.enrollments
--     WHERE status = 'active' AND team_id IS NULL AND offering_plan_id IS NULL
--
-- 3) Que de verdad frena una nueva. Esto DEBE fallar con 23514:
--
--    INSERT INTO public.enrollments (school_id, child_id, status, start_date)
--    VALUES ('2d509571-3238-4c04-ac3f-6dfe20539226', NULL, 'active', CURRENT_DATE)
--
-- Vuelta atrás: ALTER TABLE public.enrollments DROP CONSTRAINT enrollments_active_needs_target;
