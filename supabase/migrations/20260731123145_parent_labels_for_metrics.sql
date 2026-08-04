-- =============================================================================
-- 20260731123145_parent_labels_for_metrics.sql
-- Autor: brylop   Fecha: 2026-07-31   Versión anterior: 20260730195052
-- Objetivo: F0 del Informe Mensual del Atleta — dar a cada métrica un nombre
--           en idioma de familia, para que la vista del padre y el informe
--           dejen de mostrar el vocabulario del entrenador.
--
--           Hoy el padre lee «GMB Saque a los Lados» o «Sistema 4-2
--           Infiltrando»: nombres correctos para un técnico de voleibol y
--           opacos para una familia. Sin esto, mandar un informe mensual es
--           mandar ruido con logo — es prerrequisito de todo el módulo
--           (docs/specs/athlete-reports-module.md, D10 y fase F0).
--
-- Alcance:  dos columnas OPCIONALES. Nada se vuelve obligatorio y nada cambia
--           de comportamiento por sí solo: mientras estén NULL, la UI sigue
--           cayendo a display_name exactamente como hoy. Sin backfill, sin
--           default, sin reescritura de tabla.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

-- Nombre corto y cotidiano de la métrica, para mostrar a la familia.
-- NULL = usar display_name (el nombre técnico). El fallback vive en el
-- frontend, así que una métrica sin rótulo sigue funcionando igual que hoy.
ALTER TABLE public.sport_metric_definitions
    ADD COLUMN IF NOT EXISTS parent_label text;

-- Una o dos frases explicando qué mide y por qué le importa al atleta.
-- Es lo que convierte un número en información: «Coordinación ojo-mano: 8»
-- no dice nada; «qué tan bien conecta lo que ve con lo que hace la mano,
-- clave para recibir el balón donde quiere» sí.
ALTER TABLE public.sport_metric_definitions
    ADD COLUMN IF NOT EXISTS parent_hint text;

-- Rótulos vacíos son ruido: si alguien va a llenar la columna, que sea con
-- contenido. No se valida el largo máximo a propósito — el hint puede ser
-- una o dos frases según la métrica.
ALTER TABLE public.sport_metric_definitions
    DROP CONSTRAINT IF EXISTS sport_metric_definitions_parent_label_not_blank;
ALTER TABLE public.sport_metric_definitions
    ADD CONSTRAINT sport_metric_definitions_parent_label_not_blank
    CHECK (parent_label IS NULL OR length(btrim(parent_label)) > 0);

ALTER TABLE public.sport_metric_definitions
    DROP CONSTRAINT IF EXISTS sport_metric_definitions_parent_hint_not_blank;
ALTER TABLE public.sport_metric_definitions
    ADD CONSTRAINT sport_metric_definitions_parent_hint_not_blank
    CHECK (parent_hint IS NULL OR length(btrim(parent_hint)) > 0);

COMMENT ON COLUMN public.sport_metric_definitions.parent_label IS
    'Nombre de la métrica en idioma de familia, para la vista del padre y el informe mensual. NULL = usar display_name.';

COMMENT ON COLUMN public.sport_metric_definitions.parent_hint IS
    'Explicación breve de qué mide y por qué importa, para el padre. NULL = no mostrar explicación.';

COMMIT;

-- =============================================================================
-- Contenido: los rótulos NO van aquí a propósito.
--
-- Viven en scripts/voleibol_parent_labels.sql (51 métricas de voleibol) para
-- que el coach pueda corregir un rótulo sin necesidad de una migración nueva.
-- El esquema es estructura; los rótulos son contenido editable.
-- =============================================================================
