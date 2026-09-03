-- =============================================================================
-- 20260903131025_torneos_externos_fix_reclamo_por_cualquier_miembro.sql
-- Autor: brylop   Fecha: 2026-09-03   Versión anterior: 20260903130555
-- Objetivo: bug real encontrado probando `claim_tournament_invitation()` de
-- punta a punta (docs/specs/torneos-externos-registro-liviano-2026-09-03.md).
--
-- El chequeo de "reclamo repetido idempotente" verificaba que el caller fuera
-- un MIEMBRO ACTIVO cualquiera de la escuela que ya había reclamado la
-- invitación — sin exigir rol de dueño/admin. Reproducido en vivo: un padre
-- (demo.padre1@sportmaps.co, miembro de Escuela Demo SportMaps con rol
-- 'parent') pudo "reclamar" una invitación dirigida que había reclamado el
-- OWNER de esa misma escuela — el RPC lo dejó pasar en vez de rechazarlo,
-- porque solo miraba `status='active'` sin mirar `role`.
--
-- Fix: exigir el mismo conjunto de roles (owner/admin/school_admin) que ya
-- usa el resto de la función para decidir "esta cuenta administra una
-- escuela", en vez de "esta cuenta pertenece a la escuela que sea".
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

    -- FIX 2026-09-03: exige owner/admin/school_admin, no "cualquier miembro
    -- activo" — antes un padre/atleta/coach de la MISMA escuela que ya había
    -- reclamado la invitación podía "reclamarla" también.
    IF v_invite.invited_email IS NOT NULL AND v_invite.status NOT IN ('sent','opened') THEN
        IF v_invite.claimed_school_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.school_members
             WHERE school_id = v_invite.claimed_school_id
               AND profile_id = auth.uid()
               AND role IN ('owner','admin','school_admin')
               AND status = 'active'
        ) THEN
            RETURN jsonb_build_object('event_id', v_invite.event_id, 'school_id', v_invite.claimed_school_id);
        END IF;
        RAISE EXCEPTION 'Esta invitación ya fue usada por otra cuenta.';
    END IF;

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

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación
-- ─────────────────────────────────────────────────────────────────────────────
SELECT prosrc ILIKE '%role IN (''owner'',''admin'',''school_admin'')%'
   AND (SELECT count(*) FROM regexp_matches(prosrc, 'role IN', 'g')) >= 2 AS fix_aplicado
FROM pg_proc WHERE proname = 'claim_tournament_invitation';
