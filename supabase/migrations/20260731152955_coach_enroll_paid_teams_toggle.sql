-- =============================================================================
-- 20260731152955_coach_enroll_paid_teams_toggle.sql
-- Autor: brylop   Fecha: 2026-07-31   Versión anterior: 20260731123145
-- Objetivo: que la ESCUELA decida si un entrenador puede crear inscripciones
--           que generan cobro, en vez de que lo decida el código.
--
-- Contexto: inscribir a un atleta en un equipo NO es una operación neutra.
--   `open_month` resuelve el monto así (20260724000002, líneas 96-102):
--
--     COALESCE( NULLIF(enrollments.monthly_fee, 0),
--               NULLIF(offering_plans.price,    0),
--               NULLIF(teams.price_monthly,     0),   -- el equipo es fuente de precio
--               NULLIF(children.monthly_fee,    0), 0 )
--
--   …y toma CUALQUIER inscripción activa con monto > 0, sin exigir plan. Así
--   que meter a un atleta en un equipo con `price_monthly > 0` le hace nacer
--   una mensualidad en la apertura del mes. No es inmediato como al asignar un
--   plan: es diferido, y por eso pasaba inadvertido.
--
--   El fix previo de este hilo (bff/src/routes/enrollments.ts) le quitó al
--   entrenador `offering_plan_id`, que cobra al instante y además anula los
--   pendientes del plan viejo. Pero dejó abierta la vía del equipo, que también
--   cobra. Cerrarla a la fuerza rompería al entrenador que legítimamente arma
--   su roster; dejarla abierta sin control esconde plata.
--
-- Decisión: lo resuelve la escuela por configuración, no el código.
--
-- Default `true` = comportamiento de HOY. Nadie se rompe al aplicar esto, y la
--   escuela que quiera cerrarlo lo cierra. Con `false` por defecto los
--   entrenadores de Dynasty habrían dejado de poder inscribir de un día para
--   otro y en silencio.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Sigue el patrón de nombre de los toggles que ya viven en esta tabla
--     (`coach_can_send_reminders`, `coach_can_request_reminders`).
-- =============================================================================

BEGIN;

ALTER TABLE public.school_settings
    ADD COLUMN IF NOT EXISTS coach_can_enroll_paid_teams boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.school_settings.coach_can_enroll_paid_teams IS
    'Si false, un entrenador no puede crear inscripciones que generen cobro '
    '(equipo con price_monthly > 0, o atleta con monthly_fee propia). El '
    'entrenador nunca puede asignar planes: eso se bloquea en el BFF sin '
    'importar este flag, porque asignar plan cobra al instante y anula los '
    'cobros pendientes del plan anterior. Default true = comportamiento '
    'previo a 2026-07-31.';

COMMIT;

-- =============================================================================
-- Dónde se aplica el gate: en el BFF (`POST /api/v1/enrollments`), NO en RLS.
--
-- Ese endpoint corre con service role y por diseño salta la RLS, así que una
-- policy no lo tocaría. La RLS de `enrollments` ya niega la escritura directa
-- al entrenador (`is_school_admin` = owner/admin/super_admin), de modo que cada
-- vía queda cubierta por el mecanismo que le corresponde.
-- =============================================================================
