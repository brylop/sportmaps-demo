-- =============================================================================
-- 20261020122827_catalogo_torneos_vinculo_con_torneo.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-20   Versión anterior: 20261020120608
-- Objetivo: unir el «Catálogo de cobros de torneo» (school_tournament_items, cobro
--   simple) con el módulo de Torneos (events) SIN duplicar.
--   · school_tournament_items.event_id: ítem ↔ torneo interno real. Un torneo tiene
--     como máximo UN ítem (índice único parcial).
--   · Guard: el torneo debe ser de la MISMA escuela y de alcance interno.
--   · Un ítem VINCULADO deja de venderse como cobro suelto: sale del catálogo de
--     WhatsApp (wa_catalogo_servicios) y wa_crear_cobro_suelto lo rechaza. El cobro
--     de ese torneo nace de la inscripción (familia o escuela), una sola vez.
--     (El checkout del frontend lo filtra con event_id IS NULL.)
-- Los ítems existentes quedan con event_id NULL: nada cambia para ellos.
-- Las dos funciones de WhatsApp se parchean sobre su cuerpo VIVO (pg_get_functiondef),
-- cada ancla debe aparecer exactamente una vez o la migración aborta.
-- Revertir: ALTER TABLE ... DROP COLUMN event_id (los parches de WA quedan inertes).
-- =============================================================================

BEGIN;

ALTER TABLE public.school_tournament_items
    ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS school_tournament_items_event_uq
    ON public.school_tournament_items (event_id) WHERE event_id IS NOT NULL;

COMMENT ON COLUMN public.school_tournament_items.event_id IS
    'Torneo interno (events) al que está vinculado este cobro. Si no es NULL, el ítem no se vende como cobro suelto: se inscribe en el torneo.';

-- ── Guard: mismo colegio y torneo interno ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_school_tournament_items_event_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_ev record;
BEGIN
    IF NEW.event_id IS NULL THEN RETURN NEW; END IF;
    SELECT school_id, tournament_scope INTO v_ev FROM public.events WHERE id = NEW.event_id;
    IF v_ev.school_id IS NULL OR v_ev.school_id IS DISTINCT FROM NEW.school_id THEN
        RAISE EXCEPTION 'El torneo no es de esta escuela.' USING ERRCODE = '42501';
    END IF;
    IF v_ev.tournament_scope IS DISTINCT FROM 'internal' THEN
        RAISE EXCEPTION 'Solo se puede vincular un torneo interno.' USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_school_tournament_items_event_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_school_tournament_items_event_guard() FROM anon;
REVOKE ALL ON FUNCTION public.fn_school_tournament_items_event_guard() FROM authenticated;

DROP TRIGGER IF EXISTS trg_school_tournament_items_event_guard ON public.school_tournament_items;
CREATE TRIGGER trg_school_tournament_items_event_guard
    BEFORE INSERT OR UPDATE OF event_id, school_id ON public.school_tournament_items
    FOR EACH ROW EXECUTE FUNCTION public.fn_school_tournament_items_event_guard();

-- ── Parche de las dos funciones de WhatsApp ──────────────────────────────────
DO $patch$
DECLARE
    v_def text; v_new text; v_n int; r record;
    -- (nombre, ancla, reemplazo): el ancla se busca sin \r.
    a_cat   constant text := E'AND i.price > 0';
    n_cat   constant text := E'AND i.price > 0\n      AND i.event_id IS NULL';
    a_cobro constant text := E'  FOR UPDATE;\n  IF NOT FOUND THEN\n    RETURN jsonb_build_object(''ok'', false, ''codigo'', ''item_no_disponible'');\n  END IF;\n';
    n_cobro constant text := a_cobro || E'  -- Un ítem vinculado a un torneo se cobra con la inscripción, no como cobro suelto.\n  IF v_item.event_id IS NOT NULL THEN\n    RETURN jsonb_build_object(''ok'', false, ''codigo'', ''item_no_disponible'');\n  END IF;\n';
BEGIN
    FOR r IN
        SELECT p.oid, p.proname FROM pg_proc p
         WHERE p.pronamespace = 'public'::regnamespace
           AND p.proname IN ('wa_catalogo_servicios', 'wa_crear_cobro_suelto')
    LOOP
        v_def := replace(pg_get_functiondef(r.oid), E'\r', '');
        IF position('event_id IS NOT NULL' in v_def) > 0 OR position('i.event_id IS NULL' in v_def) > 0 THEN
            RAISE NOTICE '% ya está parchada: sin cambios', r.proname;
            CONTINUE;
        END IF;
        IF r.proname = 'wa_catalogo_servicios' THEN
            v_n := (length(v_def) - length(replace(v_def, a_cat, ''))) / length(a_cat);
            IF v_n <> 1 THEN RAISE EXCEPTION 'wa_catalogo_servicios: el ancla aparece % veces (esperaba 1). Re-leer el cuerpo vivo.', v_n; END IF;
            v_new := replace(v_def, a_cat, n_cat);
        ELSE
            v_n := (length(v_def) - length(replace(v_def, a_cobro, ''))) / length(a_cobro);
            IF v_n <> 1 THEN RAISE EXCEPTION 'wa_crear_cobro_suelto: el ancla aparece % veces (esperaba 1). Re-leer el cuerpo vivo.', v_n; END IF;
            v_new := replace(v_def, a_cobro, n_cobro);
        END IF;
        EXECUTE v_new;
    END LOOP;
END
$patch$;

-- CREATE OR REPLACE conserva los permisos vivos (solo postgres/service_role); se verifican.
DO $chk$
BEGIN
    IF has_function_privilege('authenticated', 'public.wa_catalogo_servicios(uuid, text, integer)', 'EXECUTE')
       OR has_function_privilege('anon', 'public.wa_catalogo_servicios(uuid, text, integer)', 'EXECUTE') THEN
        RAISE EXCEPTION 'wa_catalogo_servicios quedó ejecutable por authenticated/anon';
    END IF;
END
$chk$;

COMMIT;
