-- =============================================================================
-- 20261013180924_dreamers_id_torniquete_en_registro.sql
-- Objetivo: en el registro de deportistas de Dreamers (y Academia Superior Bogotá,
-- para probar) el campo «Dorsal» se reemplaza por el ID del torniquete (ZKTeco
-- `zk_pin`). Así el deportista queda asociado al lector DESDE el alta, sin pasar
-- después por «asignar usuario» en Control de acceso.
--
-- Solo agrega un interruptor por escuela. El resto vive en el BFF
-- (services/zkPinAssignment.ts) y usa zk_user_mappings tal como está (unique
-- (school_id, zk_pin) + chk_zk_mapping_subject_exclusivity), sin cambios de esquema
-- ni de policies.
--
-- Radio: el flag nace en false → ninguna otra escuela cambia.
-- =============================================================================

BEGIN;

ALTER TABLE public.school_settings
    ADD COLUMN IF NOT EXISTS registration_zk_pin_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.school_settings.registration_zk_pin_enabled IS
    'true = el registro/edición del deportista pide el ID del torniquete (zk_pin) en vez '
    'del dorsal y lo asocia en zk_user_mappings. Dreamers y Academia Superior (2026-10-13).';

UPDATE public.school_settings ss
   SET registration_zk_pin_enabled = true
  FROM public.schools s
 WHERE s.id = ss.school_id
   AND (s.name ILIKE 'Dreamers%' OR s.name ILIKE 'ACADEMIA SUPERIOR%');

COMMIT;
