-- =============================================================================
-- 20260905135210_access_block_mechanism_per_school.sql
-- Autor: judegor99   Fecha: 2026-09-05   Versión anterior: 20260905124655
-- Objetivo: el bloqueo físico por mora (set_group / "Grupo 2") asume que el
-- torniquete soporta Zonas Horarias y Grupos — confirmado en campo hoy que el
-- MB360/ID de Dreamers (plataforma ZMM220_TFT, este SKU puntual) NO tiene esa
-- función ni en su menú local ni de forma efectiva vía el bridge (pyzk escribe
-- el group_id sin error, pero el firmware no parece consultarlo para decidir
-- acceso). GYM RM (F22ID) sí lo tiene probado en campo — no se toca.
--
-- Fix: nueva columna `access_block_mechanism` en school_settings, 'group'
-- (default, comportamiento de siempre) o 'disable' (deshabilita el PIN
-- completo vía el bit 0 de USERINFO.Privilege — DATA UPDATE USERINFO
-- PIN=<pin> Enable=0/1 en términos ADMS — universal en cualquier ZKTeco,
-- reversible sin reinscribir la huella, a diferencia de borrar el usuario).
-- Dreamers pasa a 'disable' en esta misma migración.
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

ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS access_block_mechanism text NOT NULL DEFAULT 'group'
    CHECK (access_block_mechanism IN ('group', 'disable'));

COMMENT ON COLUMN public.school_settings.access_block_mechanism IS
  'Cómo bloquea físicamente el bloqueo por mora (manual y automático): '
  '"group" mueve el PIN a Grupo 2 en el torniquete (DATA UPDATE USERINFO Grp=2) '
  '-- requiere que el equipo soporte Zonas Horarias/Grupos, probado en campo '
  'en GYM RM (F22ID). "disable" apaga el bit 0 de Privilege (Enable=0/1) -- '
  'universal en cualquier ZKTeco, usado por Dreamers (MB360/ID sin soporte de '
  'Grupos, confirmado 2026-09-05).';

UPDATE public.school_settings
   SET access_block_mechanism = 'disable'
 WHERE school_id = '57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe';

COMMIT;

NOTIFY pgrst, 'reload schema';
