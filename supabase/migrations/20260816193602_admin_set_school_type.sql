-- ============================================================================
-- CAR-1b — El super admin puede cambiar el tipo de escuela
--
-- Fecha: 2026-08-16
--
-- ── Por qué hace falta ──────────────────────────────────────────────────────
-- `school_type` decide qué módulos ve una escuela: `has_academy`,
-- `has_reservations` y `has_wallet` se derivan de él (v_school_entitlements).
-- Club Carmel necesita `hybrid` para tener Academia y Reservas a la vez.
--
-- Hoy **no hay forma de cambiarlo desde el producto**: solo se escribe en el
-- onboarding (`SchoolSetupPage`), donde lo elige el propio cliente. Es al revés
-- de lo que conviene — un cliente no conoce la taxonomía interna, y elegir mal
-- le apaga módulos enteros sin que nadie se entere. Cambiarlo hoy exige SQL a
-- mano, que es justo lo que el panel de super admin existe para evitar.
--
-- ── El valor que no existe ──────────────────────────────────────────────────
-- ⚠️ El selector del onboarding ofrece «Academia» y guarda **`academia`**, que
-- NO está en la lista que reconoce la vista (`academy`, `hybrid`, `club`,
-- `escuela`, `gimnasio`, `personal_trainer`). Una escuela que elija esa opción
-- nace con has_academy=false Y has_reservations=false: sin ningún módulo.
--
-- Hoy no hay ninguna fila con `academia` —nadie lo ha pulsado— así que el fix
-- de fondo va en el frontend (emitir `academy`), y esta RPC permite corregir
-- cualquiera que se cuele. Se valida contra la lista canónica para que el panel
-- no pueda volver a introducir un valor que la vista no entiende.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_set_school_type(
    p_school_id   uuid,
    p_school_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_actor   uuid := auth.uid();
    v_antes   text;
BEGIN
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'solo super_admin puede cambiar el tipo de escuela' USING ERRCODE = '42501';
    END IF;

    -- Lista canónica: exactamente los valores que v_school_entitlements sabe
    -- mapear a módulos. Cualquier otro deja a la escuela sin nada.
    IF p_school_type NOT IN ('academy', 'hybrid', 'venue', 'club', 'escuela',
                             'gimnasio', 'personal_trainer') THEN
        RAISE EXCEPTION 'school_type inválido: %. Válidos: academy, hybrid, venue, club, escuela, gimnasio, personal_trainer',
            p_school_type USING ERRCODE = '23514';
    END IF;

    SELECT school_type INTO v_antes FROM public.schools WHERE id = p_school_id;
    IF v_antes IS NULL AND NOT EXISTS (SELECT 1 FROM public.schools WHERE id = p_school_id) THEN
        RAISE EXCEPTION 'la escuela % no existe', p_school_id USING ERRCODE = '23503';
    END IF;

    UPDATE public.schools
       SET school_type = p_school_type,
           updated_at  = now()
     WHERE id = p_school_id;

    -- Se devuelve el efecto REAL sobre los módulos, no lo que se pidió: cambiar
    -- el tipo prende y apaga módulos completos, y el panel tiene que mostrar la
    -- consecuencia y no solo confirmar el cambio.
    RETURN (
        SELECT jsonb_build_object(
            'ok', true,
            'school_id', p_school_id,
            'antes', v_antes,
            'ahora', p_school_type,
            'has_academy', e.has_academy,
            'has_reservations', e.has_reservations,
            'has_wallet', e.has_wallet,
            'set_by', v_actor)
          FROM public.v_school_entitlements e
         WHERE e.school_id = p_school_id
    );
END;
$$;

-- Los DOS caminos, como manda SEG-16b: sin el REVOKE a PUBLIC queda abierta a
-- anónimos aunque nadie se la conceda.
REVOKE ALL ON FUNCTION public.admin_set_school_type(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_school_type(uuid, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.admin_set_school_type(uuid, text) IS
    'Cambia schools.school_type con guard de super_admin y validación contra la lista '
    'canónica que v_school_entitlements sabe mapear. Devuelve el efecto real sobre '
    'has_academy / has_reservations / has_wallet, no solo la confirmación.';

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ────────────────────────────────────────────────────────────────────────────
-- Verificación: ¿hay escuelas con un tipo que la vista no sabe mapear?
-- Cualquier fila acá es una escuela sin módulos.
-- ────────────────────────────────────────────────────────────────────────────
SELECT s.school_type,
       count(*)                                       AS escuelas,
       bool_or(e.has_academy)                         AS alguna_con_academia,
       bool_or(e.has_reservations)                    AS alguna_con_reservas,
       CASE WHEN s.school_type IN ('academy','hybrid','venue','club','escuela',
                                   'gimnasio','personal_trainer')
            THEN 'canónico'
            WHEN public.is_informational_entity(s.school_type) THEN 'entidad del mapa'
            ELSE '⚠️ DESCONOCIDO — sin módulos' END   AS estado
  FROM public.schools s
  JOIN public.v_school_entitlements e ON e.school_id = s.id
 GROUP BY s.school_type
 ORDER BY estado, count(*) DESC;
