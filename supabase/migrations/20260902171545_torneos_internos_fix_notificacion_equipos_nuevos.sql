-- =============================================================================
-- 20260902171545_torneos_internos_fix_notificacion_equipos_nuevos.sql
-- Autor: brylop   Fecha: 2026-09-02   Versión anterior: 20260902170826
-- Objetivo: `assign_registrants_to_teams()` no distinguía miembros NUEVOS de
-- los ya asignados en una llamada anterior — el BFF renotificaba a TODO el
-- roster del equipo cada vez que el coach agregaba a una sola persona más.
-- Ahora la RPC devuelve `notified_profile_ids` (solo los recién agregados en
-- ESTA llamada) y el BFF notifica exactamente esa lista.
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

CREATE OR REPLACE FUNCTION public.assign_registrants_to_teams(
    p_event_id    uuid,
    p_category_id uuid,
    p_assignments jsonb  -- [{"team_name": "Equipo Rojo", "registration_ids": ["..."]}]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_school_id       uuid;
    v_delegation_id   uuid;
    v_team            jsonb;
    v_team_id         uuid;
    v_reg_id          uuid;
    v_reg             record;
    v_owner_id        uuid;
    v_created_teams   integer := 0;
    v_assigned        integer := 0;
    v_notify_ids      uuid[] := '{}';
BEGIN
    IF NOT public.can_manage_event(p_event_id, auth.uid()) THEN
        RAISE EXCEPTION 'No tenés permiso para administrar este torneo.'
            USING ERRCODE = '42501';
    END IF;

    SELECT school_id INTO v_school_id FROM public.events WHERE id = p_event_id;
    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'Este torneo no pertenece a ninguna escuela.';
    END IF;

    -- Delegación anfitriona (idempotente): la escuela "participando de su
    -- propio torneo" solo como ancla técnica para event_teams.delegation_id.
    SELECT id INTO v_delegation_id
      FROM public.event_delegations
     WHERE event_id = p_event_id AND school_id = v_school_id;

    IF v_delegation_id IS NULL THEN
        INSERT INTO public.event_delegations (event_id, school_id, status)
        VALUES (p_event_id, v_school_id, 'confirmed')
        RETURNING id INTO v_delegation_id;
    END IF;

    FOR v_team IN SELECT * FROM jsonb_array_elements(p_assignments)
    LOOP
        SELECT id INTO v_team_id
          FROM public.event_teams
         WHERE delegation_id = v_delegation_id AND event_id = p_event_id
           AND category_id = p_category_id
           AND team_name = (v_team->>'team_name');

        IF v_team_id IS NULL THEN
            INSERT INTO public.event_teams (delegation_id, event_id, category_id, team_name, status)
            VALUES (v_delegation_id, p_event_id, p_category_id, v_team->>'team_name', 'confirmed')
            RETURNING id INTO v_team_id;
            v_created_teams := v_created_teams + 1;
        END IF;

        FOR v_reg_id IN SELECT jsonb_array_elements_text(v_team->'registration_ids')::uuid
        LOOP
            SELECT * INTO v_reg
              FROM public.event_registrations
             WHERE id = v_reg_id AND event_id = p_event_id AND category_id = p_category_id;

            IF v_reg.id IS NULL THEN
                CONTINUE; -- fila de otra categoría/torneo, se ignora en vez de tumbar todo el lote
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM public.event_team_members
                 WHERE team_id = v_team_id
                   AND ((child_id IS NOT NULL AND child_id = v_reg.child_id)
                     OR (child_id IS NULL AND profile_id = v_reg.user_id))
            ) THEN
                INSERT INTO public.event_team_members (
                    team_id, delegation_id, full_name, profile_id, child_id
                ) VALUES (
                    v_team_id, v_delegation_id, v_reg.participant_name,
                    CASE WHEN v_reg.child_id IS NULL THEN v_reg.user_id ELSE NULL END,
                    v_reg.child_id
                );
                v_assigned := v_assigned + 1;

                -- Quién recibe la notificación: el propio atleta adulto, o el
                -- padre del hijo (children.parent_id) — NUEVO en esta llamada
                -- solamente, no todo el roster existente del equipo.
                IF v_reg.child_id IS NULL THEN
                    v_owner_id := v_reg.user_id;
                ELSE
                    SELECT parent_id INTO v_owner_id FROM public.children WHERE id = v_reg.child_id;
                END IF;
                IF v_owner_id IS NOT NULL THEN
                    v_notify_ids := array_append(v_notify_ids, v_owner_id);
                END IF;
            END IF;

            UPDATE public.event_registrations
               SET team_id = v_team_id, status = 'approved'
             WHERE id = v_reg.id;
        END LOOP;
    END LOOP;

    RETURN jsonb_build_object(
        'teams_created', v_created_teams,
        'members_assigned', v_assigned,
        'notified_profile_ids', to_jsonb(v_notify_ids)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.assign_registrants_to_teams(uuid, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_registrants_to_teams(uuid, uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.assign_registrants_to_teams(uuid, uuid, jsonb) TO authenticated;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación
-- ─────────────────────────────────────────────────────────────────────────────
SELECT prosrc ILIKE '%notified_profile_ids%' AS tiene_lista_de_notificacion FROM pg_proc WHERE proname = 'assign_registrants_to_teams';
