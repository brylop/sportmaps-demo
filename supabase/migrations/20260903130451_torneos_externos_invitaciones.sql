-- =============================================================================
-- 20260903130451_torneos_externos_invitaciones.sql
-- Autor: brylop   Fecha: 2026-09-03   Versión anterior: 20260903103757
-- Objetivo: Fase 1 de docs/specs/torneos-externos-registro-liviano-2026-09-03.md
-- — que una academia SIN cuenta en SportMaps pueda inscribirse a un torneo
-- externo sin pasar por el onboarding completo del SaaS ("Escenario 1" de
-- docs/tournaments-enrollment-flow.md), y que una academia que YA es cliente
-- (Escenario 2) use el mismo camino de inscripción sin fricción extra.
--
-- Hallazgo clave que simplifica todo: NO hace falta una RPC nueva que cree la
-- escuela desde cero. El trigger `handle_new_user()` (ya existente) YA crea
-- `schools` + `school_settings` + `school_members(owner)` + sede principal +
-- suscripción cuando alguien se registra con `role=school` +
-- `school_name` en los metadatos — es exactamente el registro liviano que
-- describe el Escenario 1. Este spec solo necesita:
--   1. Una tabla para trackear la invitación (para qué torneo, quién la abrió).
--   2. Que el host pueda generarla.
--   3. Que quien la abre (nueva cuenta recién creada, o cuenta ya existente
--      con escuela — Escenario 2) quede "enganchado" a esa invitación.
-- La inscripción real a la delegación sigue siendo el endpoint YA CONSTRUIDO
-- (POST .../enroll, con UPSERT sobre event_delegations) — no se toca.
--
-- Concurrencia (requisito explícito del usuario):
--   - `token` es UNIQUE generado server-side, sin colisión posible.
--   - Invitación DIRIGIDA (`invited_email` no nulo): un solo reclamo válido;
--     reclamos repetidos de LA MISMA cuenta son idempotentes (devuelven el
--     mismo resultado); de otra cuenta, error explícito.
--   - Invitación ABIERTA (`invited_email` nulo, para un link/QR público que
--     varias academias distintas van a usar): NO se bloquea el reuso —
--     cada escuela que la reclama queda registrada iguademás. El límite real
--     que NO se puede cerrar con una constraint (documentado en el spec): si
--     DOS personas de la MISMA academia externa reclaman casi al mismo tiempo,
--     cada una crea su propia escuela — mismo límite ya conocido de
--     project_duplicate_athlete_identities, no específico de este feature.
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

CREATE TABLE IF NOT EXISTS public.event_invitations (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id           uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    token              uuid NOT NULL DEFAULT gen_random_uuid(),
    invited_email      text,
    invited_school_name text,
    status             text NOT NULL DEFAULT 'sent'
                       CHECK (status IN ('sent','opened','registered','enrolled','paid','approved')),
    created_by         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    claimed_school_id  uuid REFERENCES public.schools(id) ON DELETE SET NULL,
    expires_at         timestamptz,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS idx_event_invitations_event ON public.event_invitations(event_id);

ALTER TABLE public.event_invitations ENABLE ROW LEVEL SECURITY;

-- El host (creator_id o school admin del evento) administra sus invitaciones.
DROP POLICY IF EXISTS event_invitations_host_manage ON public.event_invitations;
CREATE POLICY event_invitations_host_manage ON public.event_invitations
    FOR ALL
    USING (public.can_manage_event(event_id, auth.uid()))
    WITH CHECK (public.can_manage_event(event_id, auth.uid()));

-- NO hay policy de lectura pública por token: en RLS no hay forma de
-- contrastar contra un valor de la query (CLAUDE.md, trampa #5) — un
-- `USING(true)` "por token" en realidad deja listar TODAS las invitaciones a
-- cualquiera sin sesión. La página pública usa la RPC de abajo en su lugar.
--
-- El host SÍ necesita leer/escribir esta tabla directo (ej. listar sus
-- invitaciones con su estado) — para eso está la policy de arriba
-- (`event_invitations_host_manage`), que exige `can_manage_event`. Sin este
-- GRANT explícito la policy nunca se evalúa (el grant se chequea antes que
-- la RLS) — los default privileges del esquema NO alcanzan para tablas
-- nuevas si no se otorgan a mano (CLAUDE.md, trampa #3). `anon` no recibe
-- nada: su único acceso es la RPC pública de abajo.
REVOKE ALL ON public.event_invitations FROM PUBLIC;
REVOKE ALL ON public.event_invitations FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.event_invitations TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: el host genera la invitación.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_tournament_invitation(
    p_event_id           uuid,
    p_email              text DEFAULT NULL,
    p_school_name        text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_id    uuid;
    v_token uuid;
BEGIN
    IF NOT public.can_manage_event(p_event_id, auth.uid()) THEN
        RAISE EXCEPTION 'No tenés permiso para administrar este torneo.' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.event_invitations (event_id, invited_email, invited_school_name, created_by)
    VALUES (p_event_id, NULLIF(TRIM(LOWER(COALESCE(p_email, ''))), ''), NULLIF(TRIM(COALESCE(p_school_name, '')), ''), auth.uid())
    RETURNING id, token INTO v_id, v_token;

    RETURN jsonb_build_object('id', v_id, 'token', v_token);
END;
$$;

REVOKE ALL ON FUNCTION public.create_tournament_invitation(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_tournament_invitation(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_tournament_invitation(uuid, text, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: quien abre el link (después de registrarse o ya logueado con escuela
-- propia) queda enganchado a la invitación. NO crea la escuela — eso ya lo
-- hizo el trigger handle_new_user() en el signup normal, o ya existía
-- (Escenario 2).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_tournament_invitation(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_invite   record;
    v_school_id uuid;
BEGIN
    SELECT * INTO v_invite FROM public.event_invitations WHERE token = p_token;
    IF v_invite.id IS NULL THEN
        RAISE EXCEPTION 'Invitación no encontrada.';
    END IF;
    IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now() THEN
        RAISE EXCEPTION 'Esta invitación venció.';
    END IF;

    -- Invitación DIRIGIDA ya usada por otra cuenta: solo se permite el
    -- reclamo repetido de la MISMA cuenta (retry idempotente).
    IF v_invite.invited_email IS NOT NULL AND v_invite.status NOT IN ('sent','opened') THEN
        IF v_invite.claimed_school_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.school_members
             WHERE school_id = v_invite.claimed_school_id AND profile_id = auth.uid() AND status = 'active'
        ) THEN
            RETURN jsonb_build_object('event_id', v_invite.event_id, 'school_id', v_invite.claimed_school_id);
        END IF;
        RAISE EXCEPTION 'Esta invitación ya fue usada por otra cuenta.';
    END IF;

    -- El caller necesita YA tener una escuela propia — la creó el signup
    -- normal (role=school) segundos antes, o ya la tenía (Escenario 2).
    SELECT school_id INTO v_school_id
      FROM public.school_members
     WHERE profile_id = auth.uid()
       AND role IN ('owner','admin','school_admin')
       AND status = 'active'
     ORDER BY created_at ASC
     LIMIT 1;

    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'Tu cuenta todavía no tiene una escuela asociada — completá el registro primero.';
    END IF;

    UPDATE public.event_invitations
       SET status = 'registered',
           claimed_school_id = COALESCE(claimed_school_id, v_school_id),
           updated_at = now()
     WHERE id = v_invite.id;

    RETURN jsonb_build_object('event_id', v_invite.event_id, 'school_id', v_school_id);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_tournament_invitation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_tournament_invitation(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_tournament_invitation(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC pública (SIN sesión): la página de aterrizaje resuelve el link por
-- token. Devuelve solo lo necesario para mostrar la invitación — nunca la fila
-- completa ni permite enumerar otras filas (patrón correcto para "acceso por
-- token", CLAUDE.md trampa #5 — RPC en vez de policy).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_tournament_invitation_public(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_invite record;
    v_event  record;
BEGIN
    SELECT id, event_id, invited_school_name, status, expires_at
      INTO v_invite
      FROM public.event_invitations
     WHERE token = p_token;

    IF v_invite.id IS NULL THEN
        RETURN jsonb_build_object('found', false);
    END IF;

    SELECT e.title, e.sport, e.city, e.event_date, s.name AS school_name
      INTO v_event
      FROM public.events e
      LEFT JOIN public.schools s ON s.id = e.school_id
     WHERE e.id = v_invite.event_id;

    RETURN jsonb_build_object(
        'found', true,
        'expired', (v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now()),
        'invited_school_name', v_invite.invited_school_name,
        'status', v_invite.status,
        'event_id', v_invite.event_id,
        'event_title', v_event.title,
        'event_sport', v_event.sport,
        'event_city', v_event.city,
        'event_date', v_event.event_date,
        'host_school_name', v_event.school_name
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_tournament_invitation_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tournament_invitation_public(uuid) TO anon, authenticated;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación
-- ─────────────────────────────────────────────────────────────────────────────
SELECT to_regclass('public.event_invitations') AS tabla_creada;
SELECT proname FROM pg_proc WHERE proname IN ('create_tournament_invitation','claim_tournament_invitation');
