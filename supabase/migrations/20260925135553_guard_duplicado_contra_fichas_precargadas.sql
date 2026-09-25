-- =============================================================================
-- 20260925135553_guard_duplicado_contra_fichas_precargadas.sql
-- Autor: brylop   Fecha: 2026-09-25   Versión anterior: 20260925135425
-- Objetivo: que el guard de atletas duplicados (trg_bloquear_atleta_duplicado,
--   sobre children) también mire las FICHAS PRECARGADAS de la escuela
--   (unregistered_athletes activas y sin vincular), no solo a los otros hijos.
--
-- Caso real (Besser, alta 2026-09-22, detectado 2026-09-25): la escuela cargó a
-- «Juan Felipe Jiménez Quintero» (TI 1028440641) como ficha con invitación al
-- acudiente; el atleta se inscribió después por el QR con su propio correo y el
-- QR creó un `children` nuevo con EL MISMO documento. Dos inscripciones activas
-- y dos mensualidades de $380.000 para la misma persona. Ningún guard lo frenó:
--   · bloquear_atleta_duplicado compara documento y nombre+fecha, pero solo
--     contra `children`.
--   · fn_guard_alta_manual_hijo_duplicado compara por NOMBRE contra la
--     invitación pendiente, y «Juan Felipe» ≠ «Juan Felipe Jiménez Quintero».
--
-- Ahora, si el hijo nuevo coincide por documento (o por nombre normalizado +
-- fecha de nacimiento) con una ficha activa y sin vincular de la MISMA escuela,
-- el alta se rechaza con el mismo código (unique_violation) y un mensaje que
-- dice qué hacer: vincular esa ficha (invitación / reclamo por QR) en vez de
-- crear otra persona.
--
-- Exentos, porque crean el hijo A PARTIR de la ficha para reclamarla y en ese
-- instante la ficha sigue activa: submit_qr_signup (rama «reclamar ficha»),
-- accept_invitation_pro y migrate_unregistered_athlete_to_profile. Se detectan
-- por la pila de llamadas (PG_CONTEXT), y además se respetan la bandera
-- `sportmaps.alta_hijo_desde_rpc` que ya usa accept_invitation_pro y la válvula
-- `app.permitir_atleta_duplicado` del staff. Las escuelas de prueba/demo siguen
-- exentas por account_type, como antes. La comprobación contra `children` no
-- cambia. El trigger no se recrea: sigue siendo BEFORE INSERT OR UPDATE OF
-- full_name, doc_number, date_of_birth, school_id.
--
-- Probado antes de aplicar (transacción revertida, 2026-09-25): bloquea el alta
-- con el documento de una ficha activa de Besser, deja pasar el mismo insert
-- desde una función cuyo nombre contiene submit_qr_signup, sigue bloqueando el
-- documento de un hijo existente, y deja pasar un documento nuevo.
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
    -- La válvula. Se mira primero para que la confirmación del staff no pague
    -- el costo de las consultas de abajo.
    IF coalesce(current_setting('app.permitir_atleta_duplicado', true), 'off') = 'on' THEN
        RETURN NEW;
    END IF;

    IF NEW.school_id IS NULL THEN
        RETURN NEW;   -- ficha sin escuela: no hay padrón contra el cual comparar
    END IF;

    -- Las cuentas de prueba y demo se dejan en paz: su data está sembrada a
    -- propósito con homónimos y bloquearlas rompería los seeds.
    SELECT account_type INTO v_account_type FROM public.schools WHERE id = NEW.school_id;
    IF coalesce(v_account_type, 'real') <> 'real' THEN
        RETURN NEW;
    END IF;

    v_doc    := public.normalize_doc_number(NEW.doc_number);
    v_nombre := public.normalize_athlete_name(NEW.full_name);

    -- ── (1) Contra los otros hijos de la escuela — sin cambios ──────────────
    SELECT c.id, c.full_name, c.doc_number, c.date_of_birth
      INTO v_existente
      FROM public.children c
     WHERE c.school_id = NEW.school_id
       AND c.id IS DISTINCT FROM NEW.id
       AND c.is_active = true
       AND (
             (v_doc IS NOT NULL AND public.normalize_doc_number(c.doc_number) = v_doc)
             OR (v_nombre IS NOT NULL
                 AND NEW.date_of_birth IS NOT NULL
                 AND public.normalize_athlete_name(c.full_name) = v_nombre
                 AND c.date_of_birth = NEW.date_of_birth)
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

    -- ── (2) Contra las fichas precargadas de la escuela — NUEVO ────────────
    -- Solo fichas vivas y todavía sin dueño: una ficha ya vinculada
    -- (linked_profile_id) o inactiva ya se convirtió en un hijo, y ese hijo lo
    -- cubre la comprobación (1).
    SELECT ua.id, ua.full_name, ua.doc_number, ua.date_of_birth
      INTO v_ficha
      FROM public.unregistered_athletes ua
     WHERE ua.school_id = NEW.school_id
       AND ua.is_active = true
       AND ua.linked_profile_id IS NULL
       AND (
             (v_doc IS NOT NULL AND public.normalize_doc_number(ua.doc_number) = v_doc)
             OR (v_nombre IS NOT NULL
                 AND NEW.date_of_birth IS NOT NULL
                 AND public.normalize_athlete_name(ua.full_name) = v_nombre
                 AND ua.date_of_birth = NEW.date_of_birth)
           )
     ORDER BY (public.normalize_doc_number(ua.doc_number) = v_doc) DESC NULLS LAST,
              ua.created_at ASC
     LIMIT 1;

    IF v_ficha.id IS NOT NULL THEN
        -- Los caminos que RECLAMAN la ficha insertan el hijo copiando sus datos
        -- (documento incluido) mientras la ficha sigue activa, y la vinculan en
        -- el paso siguiente. Para ellos esta coincidencia es lo esperado.
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
  'Guard de atletas duplicados por escuela: documento o nombre+fecha, contra children y contra unregistered_athletes activas sin vincular. Válvula: app.permitir_atleta_duplicado=on. Exentos por pila: submit_qr_signup, accept_invitation_pro, migrate_unregistered_athlete_to_profile.';

COMMIT;
