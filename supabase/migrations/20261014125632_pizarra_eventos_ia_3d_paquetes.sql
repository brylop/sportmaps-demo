-- =============================================================================
-- 20261014125632_pizarra_eventos_ia_3d_paquetes.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-14   Versión anterior: 20261014121142
-- Objetivo: la métrica de uso de la pizarra (T0, tactical_board_events) mide
--   también lo nuevo de docs/specs/pizarra-multideporte-3d-ia.md, para ver con
--   datos si el 3D (D5) y la IA (D6) se usan:
--     · ai_analyze       tocar «Analizar jugada» (M3)
--     · ai_view_counter  ver un contraataque / variante de la IA en la cancha
--     · ai_save_variant  «Guardar como nueva jugada» desde una sugerencia IA
--     · view_3d          abrir el visor 3D (M4), desde la pizarra o desde la IA
--     · pack_activate    activar un paquete de la biblioteca (M2)
--     · pack_import      importar un paquete desde archivo (M2)
--     · pack_export      exportar un paquete a archivo (M2)
--
--   Definiciones VIVAS leídas el 2026-10-14 (npx supabase db query --linked):
--     · tactical_board_events_event_check = CHECK (event = ANY (ARRAY['open',
--       'save','play','export_png','export_pdf','export_video','share',
--       'library_save','library_insert','frame_add'])) — igual al repo
--       (20261008183746).
--     · log_tactical_board_event(uuid,text,uuid,text,text): SECURITY DEFINER,
--       search_path fijo, proacl {postgres,service_role,authenticated} y valida
--       el evento contra la MISMA lista dentro de la función → se reemplaza con
--       el mismo cuerpo y la lista ampliada (sin otro cambio de comportamiento:
--       staff de la escuela, equipo de la misma escuela, antirrebote 10 s).
--
--   Sin tablas ni policies nuevas: RLS de tactical_board_events intacta (solo
--   lectura admin/super admin; INSERT únicamente por la RPC).
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

-- -----------------------------------------------------------------------------
-- 1. CHECK de eventos ampliado (los 10 de T0 + 7 nuevos)
-- -----------------------------------------------------------------------------
ALTER TABLE public.tactical_board_events
  DROP CONSTRAINT IF EXISTS tactical_board_events_event_check;

ALTER TABLE public.tactical_board_events
  ADD CONSTRAINT tactical_board_events_event_check CHECK (event IN (
    'open', 'save', 'play', 'export_png', 'export_pdf', 'export_video',
    'share', 'library_save', 'library_insert', 'frame_add',
    'ai_analyze', 'ai_view_counter', 'ai_save_variant', 'view_3d',
    'pack_activate', 'pack_import', 'pack_export'
  ));

-- -----------------------------------------------------------------------------
-- 2. RPC de registro: misma firma y mismo cuerpo, lista de eventos ampliada
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_tactical_board_event(
  p_school_id   uuid,
  p_event       text,
  p_team_id     uuid DEFAULT NULL,
  p_source_type text DEFAULT NULL,
  p_sport       text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_team uuid := p_team_id;
BEGIN
  IF v_uid IS NULL OR p_school_id IS NULL OR p_event IS NULL THEN
    RETURN false;
  END IF;

  IF p_event NOT IN ('open', 'save', 'play', 'export_png', 'export_pdf', 'export_video',
                     'share', 'library_save', 'library_insert', 'frame_add',
                     'ai_analyze', 'ai_view_counter', 'ai_save_variant', 'view_3d',
                     'pack_activate', 'pack_import', 'pack_export') THEN
    RETURN false;
  END IF;

  -- Solo quien TRABAJA en la escuela (sin padres ni atletas).
  IF NOT (p_school_id = ANY (public.user_staff_school_ids())) THEN
    RETURN false;
  END IF;

  -- Un equipo de otra escuela no se registra (se guarda el evento sin equipo).
  IF v_team IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.teams t WHERE t.id = v_team AND t.school_id = p_school_id
  ) THEN
    v_team := NULL;
  END IF;

  -- Antirrebote: mismo usuario + evento + equipo dentro de 10 s.
  IF EXISTS (
    SELECT 1
      FROM public.tactical_board_events e
     WHERE e.user_id = v_uid
       AND e.event = p_event
       AND e.team_id IS NOT DISTINCT FROM v_team
       AND e.created_at > now() - interval '10 seconds'
  ) THEN
    RETURN false;
  END IF;

  INSERT INTO public.tactical_board_events (school_id, user_id, team_id, event, source_type, sport)
  VALUES (
    p_school_id,
    v_uid,
    v_team,
    p_event,
    left(nullif(btrim(p_source_type), ''), 40),
    left(nullif(btrim(p_sport), ''), 40)
  );

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.log_tactical_board_event(uuid, text, uuid, text, text) IS
  'T0 pizarra: registra un evento de uso (incluye IA, 3D y paquetes desde 20261014125632). Exige staff de la escuela; antirrebote 10 s por usuario+evento+equipo.';

-- CREATE OR REPLACE conserva el ACL, pero se reafirma explícito (los default
-- privileges del esquema dan EXECUTE a anon/authenticated en funciones nuevas).
REVOKE ALL ON FUNCTION public.log_tactical_board_event(uuid, text, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_tactical_board_event(uuid, text, uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.log_tactical_board_event(uuid, text, uuid, text, text) TO authenticated;

COMMIT;

-- -----------------------------------------------------------------------------
-- Verificación post-aplicación (manual):
--   select pg_get_constraintdef(oid) from pg_constraint
--    where conrelid = 'public.tactical_board_events'::regclass and conname = 'tactical_board_events_event_check';
--   select proacl, proconfig from pg_proc where proname = 'log_tactical_board_event';
--     -- esperado: {postgres=X,service_role=X,authenticated=X}, search_path fijo, SIN anon
--   npm run seguridad:invariantes
-- -----------------------------------------------------------------------------
