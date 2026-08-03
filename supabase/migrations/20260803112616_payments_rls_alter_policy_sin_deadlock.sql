-- =============================================================================
-- 20260803112616_payments_rls_alter_policy_sin_deadlock.sql
-- Autor: brylop   Fecha: 2026-08-03   Versión anterior: 20260803111843
-- Objetivo: aplicar lo que quiso hacer 20260803111843 — que la cartera del club y
--   la creación de cobros exijan membresía de STAFF — sin deadlockear.
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
-- POR QUÉ EXISTE ESTA MIGRACIÓN
--
-- `20260803111843` murió con `40P01 deadlock detected` y **no aplicó nada** (la
-- transacción hizo rollback completo). El objetivo sigue siendo el mismo; lo que estaba
-- mal era el método.
--
--   Process A (la migración) esperaba AccessExclusiveLock sobre `payments`.
--   Process B (tráfico real) esperaba AccessShareLock sobre una relación que A ya tenía.
--
-- Esa relación la había tomado el `SELECT 1 FROM pg_policies` que la migración hacía
-- **dentro de la misma transacción** para ser idempotente. Sin ese chequeo, la
-- transacción no sostiene nada que el otro proceso quiera y no hay ciclo que cerrar.
--
-- Lección: la receta de "preguntar al catálogo antes de cada sentencia que tomaría lock"
-- (de 20260731160301) aplica a `ADD COLUMN` y `ENABLE ROW LEVEL SECURITY`, donde el
-- chequeo EVITA el lock. Para DDL de policies el lock es inevitable, así que el chequeo
-- solo AGREGA locks al ciclo. Ahí conviene la transacción más corta y desnuda posible.
--
-- Y el `SET LOCAL lock_timeout = '5s'` no podía ayudar: el detector de deadlocks corre a
-- `deadlock_timeout` (1s por defecto), así que dispara antes. Para que gane el timeout y
-- se pueda reintentar limpio, tiene que quedar POR DEBAJO de 1s.
--
-- QUÉ CAMBIA RESPECTO AL INTENTO ANTERIOR
--
--   · `ALTER POLICY` en vez de `DROP` + `CREATE`: una sentencia por policy en lugar de
--     dos, sin bloque DO y sin lecturas de catálogo.
--   · `lock_timeout` en 800ms: si la tabla está ocupada falla con
--     `55P03 lock_not_available` —error claro y reintentable— en vez de deadlockear.
--
-- ALTER POLICY exige que la policy exista. Las dos existen (verificado contra
-- `pg_policies` el 2026-08-03). Si alguna faltara, la migración falla explícito en vez de
-- crear una policy con nombre nuevo y dejar la vieja abierta.
--
-- SI VUELVE A FALLAR CON 55P03 no hay nada que arreglar: la tabla estaba ocupada,
-- reintentar. Ayuda correrla en un momento de bajo tráfico — es la tabla de cobros de un
-- club en producción.

BEGIN;

SET LOCAL lock_timeout = '800ms';

-- Cualquier miembro con `school_members` activo —incluidos acudientes y atletas— leía
-- la cartera completa: 226 cobros del club demo con montos, conceptos y quién debe de
-- todas las familias. Verificado con logins reales el 2026-08-03.
ALTER POLICY "Payments: select staff" ON public.payments
    USING (school_id = ANY (public.staff_school_ids()));

-- Peor que la fuga de lectura: habilitaba a un acudiente a CREAR cobros a nombre de
-- cualquier atleta del club.
ALTER POLICY "Payments: insert staff" ON public.payments
    WITH CHECK (school_id = ANY (public.staff_school_ids()));

COMMIT;

-- ── Verificación después de aplicar ────────────────────────────────────────
--
-- 1) Las dos quedaron apuntando al helper de staff:
--
--    SELECT policyname, cmd, qual, with_check FROM pg_policies
--     WHERE tablename = 'payments' AND policyname LIKE '%staff%'
--
-- 2) La prueba que vale, con logins reales:
--
--    node scripts/demo-club-campestre/check-isolation.mjs
--
--    Esperado en `cobros`: gerencia y coordinadores siguen en 226; el acudiente pasa de
--    226 a solo los de sus hijos; los dos atletas de 226 a solo los propios; la externa
--    sigue en 0. Los coaches SIGUEN en 226 a propósito (ver 20260803111843).
--
-- Vuelta atrás: las mismas dos sentencias con `user_school_ids()`.
