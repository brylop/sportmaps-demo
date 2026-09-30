-- =============================================================================
-- 20260929204838_guard_duplicado_documento_casi_igual_y_nombre_prefijo.sql
-- Autor: brylop   Fecha: 2026-09-29   Versión anterior: 20260929183752
-- Objetivo: que trg_bloquear_atleta_duplicado atrape los duplicados que llegan
--   con el documento MAL DIGITADO o con el nombre INCOMPLETO.
--
-- Caso real (Besser, alta por QR 2026-09-25, detectado 2026-09-29): la escuela
-- tenía la ficha «Alicia Ponce de León», TI 1021514987, nacida 2014-04-16. El
-- acudiente se inscribió por el QR como «Alicia», TI 1021514187 —un dígito
-- distinto—, misma fecha. El guard de 20260925135553 compara documento exacto
-- o nombre exacto + fecha, así que no la reconoció: dos inscripciones y dos
-- mensualidades de $340.000. Juan Felipe Jiménez Quintero (el caso que originó
-- 20260925135553) también había llegado por el QR con el nombre cortado.
--
-- Medición antes de escribir esto (escuelas reales, hijos activos + fichas
-- activas sin vincular, misma escuela y misma fecha de nacimiento, mismo primer
-- nombre): 10 pares. 8 son la misma persona cargada dos veces en Dynasty
-- (documentos a un dígito, nombres idénticos o recortados) y 2 son personas
-- distintas (Carmel: «Jacobo Silva Lozano» / «Jacobo Merchan Fontecha»;
-- Dynasty: «María Paula Lizarazo Ariza» / «Maria Isabella Marin Cadena»).
-- Por eso NO se usa «misma fecha + mismo primer nombre», que bloquearía a esos
-- dos pares. Las reglas nuevas exigen misma fecha de nacimiento Y además una de:
--   · documento a un carácter de distancia (un dígito cambiado, sobrante o
--     faltante; ambos con 6+ caracteres), o
--   · un nombre normalizado es prefijo por palabras del otro («alicia» de
--     «alicia ponce de leon»; «sergio herrera» de «sergio herrera torres»).
-- Contra los 10 pares: atrapan a los duplicados que la regla vieja no veía y
-- dejan pasar a los 2 pares de personas distintas. Atrapan a Alicia y a Juan
-- Felipe.
--
-- Se aplica igual contra `children` y contra las fichas precargadas. Las
-- exenciones no cambian: válvula app.permitir_atleta_duplicado, bandera
-- sportmaps.alta_hijo_desde_rpc, escuelas de prueba/demo, y los caminos que
-- reclaman una ficha (submit_qr_signup, accept_invitation_pro,
-- migrate_unregistered_athlete_to_profile), detectados por PG_CONTEXT.
--
-- Efecto colateral conocido: los duplicados que YA existen en Dynasty quedan
-- bloqueados para editar nombre, documento o fecha hasta que se unifiquen,
-- igual que ya pasaba con los de nombre exacto. Es a propósito: obliga a
-- resolverlos en vez de seguir cobrándolos dos veces.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
-- =============================================================================

BEGIN;

-- ── Comparadores puros ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.doc_casi_igual(p_a text, p_b text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
    WITH n AS (
        SELECT public.normalize_doc_number(p_a) AS x,
               public.normalize_doc_number(p_b) AS y
    )
    SELECT CASE
        WHEN x IS NULL OR y IS NULL OR length(x) < 6 OR length(y) < 6 THEN false
        WHEN x = y THEN true
        WHEN length(x) = length(y) THEN
            (SELECT count(*) FROM generate_series(1, length(x)) i
              WHERE substr(x, i, 1) <> substr(y, i, 1)) = 1
        WHEN abs(length(x) - length(y)) = 1 THEN
            EXISTS (
                SELECT 1 FROM generate_series(1, greatest(length(x), length(y))) i
                 WHERE CASE WHEN length(x) > length(y)
                            THEN overlay(x PLACING '' FROM i FOR 1) = y
                            ELSE overlay(y PLACING '' FROM i FOR 1) = x
                       END
            )
        ELSE false
    END
    FROM n;
$$;

COMMENT ON FUNCTION public.doc_casi_igual(text, text) IS
  'true si dos documentos normalizados (6+ caracteres) son iguales o difieren en un solo carácter: cambiado, sobrante o faltante.';

CREATE OR REPLACE FUNCTION public.nombre_es_prefijo(p_a text, p_b text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
    WITH n AS (
        SELECT public.normalize_athlete_name(p_a) AS x,
               public.normalize_athlete_name(p_b) AS y
    )
    SELECT x IS NOT NULL AND y IS NOT NULL AND x <> y
       AND (y LIKE x || ' %' OR x LIKE y || ' %')
    FROM n;
$$;

COMMENT ON FUNCTION public.nombre_es_prefijo(text, text) IS
  'true si un nombre normalizado es prefijo por palabras completas del otro («alicia» de «alicia ponce de leon»).';

-- Solo los usa el trigger (SECURITY DEFINER). No son RPCs.
REVOKE ALL ON FUNCTION public.doc_casi_igual(text, text)    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.nombre_es_prefijo(text, text) FROM PUBLIC, anon, authenticated;

-- ── Guard ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bloquear_atleta_duplicado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_account_type text;
    v_existente    record;
    v_ficha        record;
    v_doc          text;
    v_nombre       text;
    v_ctx          text;
BEGIN
    IF coalesce(current_setting('app.permitir_atleta_duplicado', true), 'off') = 'on' THEN
        RETURN NEW;
    END IF;

    IF NEW.school_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT account_type INTO v_account_type FROM public.schools WHERE id = NEW.school_id;
    IF coalesce(v_account_type, 'real') <> 'real' THEN
        RETURN NEW;
    END IF;

    v_doc    := public.normalize_doc_number(NEW.doc_number);
    v_nombre := public.normalize_athlete_name(NEW.full_name);

    -- ── (1) Contra los otros hijos de la escuela ────────────────────────────
    SELECT c.id, c.full_name, c.doc_number, c.date_of_birth
      INTO v_existente
      FROM public.children c
     WHERE c.school_id = NEW.school_id
       AND c.id IS DISTINCT FROM NEW.id
       AND c.is_active = true
       AND (
             (v_doc IS NOT NULL AND public.normalize_doc_number(c.doc_number) = v_doc)
             OR (NEW.date_of_birth IS NOT NULL
                 AND c.date_of_birth = NEW.date_of_birth
                 AND (
                       (v_nombre IS NOT NULL AND public.normalize_athlete_name(c.full_name) = v_nombre)
                       OR public.doc_casi_igual(c.doc_number, NEW.doc_number)
                       OR public.nombre_es_prefijo(c.full_name, NEW.full_name)
                     ))
           )
     ORDER BY (public.normalize_doc_number(c.doc_number) = v_doc) DESC NULLS LAST,
              c.created_at ASC
     LIMIT 1;

    IF v_existente.id IS NOT NULL THEN
        RAISE EXCEPTION
            'Ya existe % en esta escuela (documento %, nacido %). Si es la misma persona, edita esa ficha en vez de crear otra.',
            v_existente.full_name,
            coalesce(v_existente.doc_number, 'sin documento'),
            coalesce(v_existente.date_of_birth::text, 'sin fecha')
            USING ERRCODE = 'unique_violation',
                  DETAIL  = 'atleta_existente_id=' || v_existente.id,
                  HINT    = 'SET LOCAL app.permitir_atleta_duplicado = ''on'' para forzar el alta cuando de verdad son dos personas.';
    END IF;

    -- ── (2) Contra las fichas precargadas de la escuela ─────────────────────
    SELECT ua.id, ua.full_name, ua.doc_number, ua.date_of_birth
      INTO v_ficha
      FROM public.unregistered_athletes ua
     WHERE ua.school_id = NEW.school_id
       AND ua.is_active = true
       AND ua.linked_profile_id IS NULL
       AND (
             (v_doc IS NOT NULL AND public.normalize_doc_number(ua.doc_number) = v_doc)
             OR (NEW.date_of_birth IS NOT NULL
                 AND ua.date_of_birth = NEW.date_of_birth
                 AND (
                       (v_nombre IS NOT NULL AND public.normalize_athlete_name(ua.full_name) = v_nombre)
                       OR public.doc_casi_igual(ua.doc_number, NEW.doc_number)
                       OR public.nombre_es_prefijo(ua.full_name, NEW.full_name)
                     ))
           )
     ORDER BY (public.normalize_doc_number(ua.doc_number) = v_doc) DESC NULLS LAST,
              ua.created_at ASC
     LIMIT 1;

    IF v_ficha.id IS NOT NULL THEN
        IF coalesce(current_setting('sportmaps.alta_hijo_desde_rpc', true), 'off') = 'on' THEN
            RETURN NEW;
        END IF;
        GET DIAGNOSTICS v_ctx = PG_CONTEXT;
        IF v_ctx LIKE '%submit_qr_signup%'
           OR v_ctx LIKE '%accept_invitation_pro%'
           OR v_ctx LIKE '%migrate_unregistered_athlete_to_profile%' THEN
            RETURN NEW;
        END IF;

        RAISE EXCEPTION
            'Ya existe una ficha de % en esta escuela (documento %, nacido %), pendiente de vincular. Si es la misma persona, vincúlala con la invitación de la escuela o el QR de inscripción en vez de crear otra.',
            v_ficha.full_name,
            coalesce(v_ficha.doc_number, 'sin documento'),
            coalesce(v_ficha.date_of_birth::text, 'sin fecha')
            USING ERRCODE = 'unique_violation',
                  DETAIL  = 'ficha_existente_id=' || v_ficha.id,
                  HINT    = 'SET LOCAL app.permitir_atleta_duplicado = ''on'' para forzar el alta cuando de verdad son dos personas.';
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.bloquear_atleta_duplicado() IS
  'Guard de atletas duplicados por escuela contra children y fichas activas sin vincular: documento exacto, o misma fecha de nacimiento + (nombre exacto | documento a 1 carácter | nombre prefijo). Válvula: app.permitir_atleta_duplicado=on. Exentos por pila: submit_qr_signup, accept_invitation_pro, migrate_unregistered_athlete_to_profile.';

COMMIT;
