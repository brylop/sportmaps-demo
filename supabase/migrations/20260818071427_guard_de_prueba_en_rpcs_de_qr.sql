-- ============================================================================
-- SEG-19 (Fase B de SEG-15) — El bloqueo de prueba también en los RPC del QR
--
-- Fecha: 2026-08-18
--
-- ── Lo que la Fase A no alcanza ─────────────────────────────────────────────
-- Las policies RESTRICTIVE de `20260813170813` cubren las escrituras del
-- navegador, pero NO los RPC `SECURITY DEFINER`: esos corren como su dueño y
-- saltan RLS por definición. Y las dos de acá se llaman **directo desde el
-- frontend a Supabase**, no por el BFF, así que tampoco las cubre el 402 del
-- middleware.
--
-- Resultado hoy: una escuela con la prueba vencida sigue inscribiendo atletas y
-- generando cartera por el QR.
--
-- ── Exposición medida el 2026-08-18 ─────────────────────────────────────────
-- 9 QR de inscripción y **los 9 activos**; **uno pertenece a una escuela
-- bloqueada** (Fit And Fight, 0 inscripciones hasta ahora). Con ese link, y una
-- cuenta cualquiera, se inscribe y se genera el cobro.
--
-- ⚠️ La medición del día anterior dijo «los 9 inactivos» y era FALSA: se
-- consultó `is_active`, columna que no existe en esta tabla —se llama `active`—,
-- la consulta falló y el script leyó el error como cero. Queda anotado porque es
-- el mismo patrón que hizo declarar cerrado a `SEG-14`: **una consulta que falla
-- no es un cero.**
--
-- ── Por qué envolver y no reescribir ────────────────────────────────────────
-- Ponerle el guard con `CREATE OR REPLACE` obliga a reproducir el cuerpo
-- entero, y `submit_qr_signup` tiene ~250 líneas con la lógica de deduplicación
-- de identidades que costó varias migraciones afinar (el documento manda sobre
-- el nombre, adopción de fichas huérfanas, idempotencia de inscripción y de
-- cobro). Retipear eso para agregar cuatro líneas es la forma más fácil de
-- romper algo que hoy funciona.
--
-- Así que se **renombra** la original y se crea un envoltorio con el mismo
-- nombre y la misma firma. El cuerpo original queda byte por byte igual; el
-- envoltorio es corto y se lee de una. Los llamadores no cambian: siguen
-- invocando el mismo nombre.
--
-- Al interno se le quita el acceso a `authenticated` y `anon`, o el envoltorio
-- sería opcional.
-- ============================================================================

BEGIN;

-- ── 1. generate_qr_monthly_charge(text, uuid) ───────────────────────────────
ALTER FUNCTION public.generate_qr_monthly_charge(text, uuid)
    RENAME TO generate_qr_monthly_charge__interno;

CREATE OR REPLACE FUNCTION public.generate_qr_monthly_charge(
    p_slug     text,
    p_child_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $envoltorio$
DECLARE
    v_school_id uuid;
BEGIN
    -- SECURITY DEFINER a propósito: si esto leyera `school_join_qr_codes` con
    -- los permisos del llamador y la RLS le tapara la fila, el guard no
    -- encontraría escuela y dejaría pasar todo.
    SELECT school_id INTO v_school_id
      FROM public.school_join_qr_codes
     WHERE slug = p_slug AND active = true;

    IF v_school_id IS NOT NULL AND NOT public.school_is_operational(v_school_id) THEN
        RAISE EXCEPTION 'Esta escuela tiene el periodo de prueba vencido: no puede generar cobros nuevos.'
            USING ERRCODE = '42501';
    END IF;

    -- Si el QR no existe o está inactivo, NO se decide acá: se delega, para que
    -- el mensaje de error siga siendo el de la función original.
    RETURN public.generate_qr_monthly_charge__interno(p_slug, p_child_id);
END;
$envoltorio$;

REVOKE ALL ON FUNCTION public.generate_qr_monthly_charge__interno(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_qr_monthly_charge__interno(text, uuid) TO service_role;

REVOKE ALL  ON FUNCTION public.generate_qr_monthly_charge(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_qr_monthly_charge(text, uuid) TO authenticated, service_role;


-- ── 2. submit_qr_signup(…12 argumentos) ─────────────────────────────────────
ALTER FUNCTION public.submit_qr_signup(text, uuid, uuid, text, date, text, text, text, text, numeric, uuid, uuid)
    RENAME TO submit_qr_signup__interno;

-- Los DEFAULT se repiten tal cual: hay llamadores que pasan menos argumentos.
CREATE OR REPLACE FUNCTION public.submit_qr_signup(
    p_slug              text,
    p_team_id           uuid    DEFAULT NULL::uuid,
    p_branch_id         uuid    DEFAULT NULL::uuid,
    p_child_full_name   text    DEFAULT NULL::text,
    p_child_dob         date    DEFAULT NULL::date,
    p_child_doc_type    text    DEFAULT NULL::text,
    p_child_doc_number  text    DEFAULT NULL::text,
    p_child_gender      text    DEFAULT NULL::text,
    p_phone             text    DEFAULT NULL::text,
    p_monthly_fee       numeric DEFAULT NULL::numeric,
    p_existing_child_id uuid    DEFAULT NULL::uuid,
    p_plan_id           uuid    DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $envoltorio$
DECLARE
    v_school_id uuid;
BEGIN
    SELECT school_id INTO v_school_id
      FROM public.school_join_qr_codes
     WHERE slug = p_slug AND active = true;

    IF v_school_id IS NOT NULL AND NOT public.school_is_operational(v_school_id) THEN
        RAISE EXCEPTION 'Esta escuela tiene el periodo de prueba vencido: no puede recibir inscripciones nuevas.'
            USING ERRCODE = '42501';
    END IF;

    RETURN public.submit_qr_signup__interno(
        p_slug, p_team_id, p_branch_id, p_child_full_name, p_child_dob,
        p_child_doc_type, p_child_doc_number, p_child_gender, p_phone,
        p_monthly_fee, p_existing_child_id, p_plan_id);
END;
$envoltorio$;

REVOKE ALL ON FUNCTION public.submit_qr_signup__interno(text, uuid, uuid, text, date, text, text, text, text, numeric, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_qr_signup__interno(text, uuid, uuid, text, date, text, text, text, text, numeric, uuid, uuid) TO service_role;

REVOKE ALL  ON FUNCTION public.submit_qr_signup(text, uuid, uuid, text, date, text, text, text, text, numeric, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_qr_signup(text, uuid, uuid, text, date, text, text, text, text, numeric, uuid, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.submit_qr_signup(text, uuid, uuid, text, date, text, text, text, text, numeric, uuid, uuid) IS
    'Envoltorio con el guard de fin de prueba (SEG-19). El cuerpo real esta en '
    'submit_qr_signup__interno, sin tocar: tiene la logica de deduplicacion de identidades que '
    'costo varias migraciones afinar y no se retipea para agregar cuatro lineas.';

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ────────────────────────────────────────────────────────────────────────────
-- Verificación
-- ────────────────────────────────────────────────────────────────────────────

-- 1. Las cuatro funciones (dos envoltorios + dos internas), y que SOLO los
--    envoltorios sean ejecutables por `authenticated`.
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid)                 AS firma,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_puede,
       has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_puede
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND (p.proname LIKE 'submit_qr_signup%' OR p.proname LIKE 'generate_qr_monthly_charge%')
 ORDER BY p.proname;

-- 2. El cuerpo de la interna quedó intacto: debe seguir teniendo la lógica de
--    deduplicación que nadie quiere haber tocado.
SELECT p.proname,
       (p.prosrc LIKE '%normalize_athlete_name%') AS conserva_dedup_por_nombre,
       (p.prosrc LIKE '%claim_orphan_children%')  AS conserva_adopcion,
       length(p.prosrc)                           AS largo_cuerpo
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'submit_qr_signup__interno';

-- 3. Qué hará el guard con cada QR activo. Se evalúa en seco, sin llamar la RPC.
SELECT s.name                                    AS escuela,
       q.slug,
       public.school_is_operational(q.school_id)  AS operativa,
       CASE WHEN public.school_is_operational(q.school_id) THEN 'permite'
            ELSE 'BLOQUEA (correcto)' END         AS que_hara_el_guard
  FROM public.school_join_qr_codes q
  JOIN public.schools s ON s.id = q.school_id
 WHERE q.active = true
 ORDER BY public.school_is_operational(q.school_id), s.name;
