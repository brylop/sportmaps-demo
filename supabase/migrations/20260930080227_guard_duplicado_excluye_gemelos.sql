-- =============================================================================
-- 20260930080227_guard_duplicado_excluye_gemelos.sql
-- Autor: brylop   Fecha: 2026-09-30   Versión anterior: 20260929204838
-- Objetivo: que el guard de duplicados deje en paz a los GEMELOS.
--
-- 20260929204838 trata como la misma persona a dos atletas con la misma fecha
-- de nacimiento y documentos a un carácter de distancia. Al revisar Dynasty el
-- 2026-09-30 aparecieron dos pares de gemelas reales con exactamente esa forma
-- —misma fecha, mismo acudiente, tarjetas de identidad consecutivas, las dos
-- pagando—: «Mariana / Sofía Ariza Sánchez» (…366 / …365) y «Gabriela /
-- Juliana Simbaqueva Pedraza» (…363 / …364). Con la regla anterior la escuela
-- no podía inscribir a la segunda gemela ni editar el nombre de ninguna.
--
-- Ahora el documento casi igual solo cuenta si además coincide el PRIMER
-- nombre normalizado. Los gemelos tienen distinto primer nombre; los errores de
-- digitación de la misma persona («Isabella Mateus Leon» / «Isabella Mateus
-- Leoon», «Alicia» / «Alicia Ponce de León») lo comparten. El resto del guard
-- no cambia.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
-- =============================================================================

BEGIN;

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
                       OR (public.doc_casi_igual(c.doc_number, NEW.doc_number)
                           AND split_part(public.normalize_athlete_name(c.full_name), ' ', 1)
                             = split_part(v_nombre, ' ', 1))
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
                       OR (public.doc_casi_igual(ua.doc_number, NEW.doc_number)
                           AND split_part(public.normalize_athlete_name(ua.full_name), ' ', 1)
                             = split_part(v_nombre, ' ', 1))
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
  'Guard de atletas duplicados por escuela contra children y fichas activas sin vincular: documento exacto, o misma fecha de nacimiento + (nombre exacto | documento a 1 carácter con el mismo primer nombre | nombre prefijo). Válvula: app.permitir_atleta_duplicado=on. Exentos por pila: submit_qr_signup, accept_invitation_pro, migrate_unregistered_athlete_to_profile.';

COMMIT;
