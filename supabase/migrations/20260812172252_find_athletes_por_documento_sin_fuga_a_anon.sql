-- ============================================================================
-- 20260812172252_find_athletes_por_documento_sin_fuga_a_anon.sql
-- Fecha: 2026-08-12
--
-- HALLAZGO: `find_athletes_by_document` es SECURITY DEFINER con EXECUTE para
-- `anon`, y devolvia la ficha COMPLETA de un menor a cualquiera que tuviera la
-- llave publica del frontend y un numero de documento:
--
--   POST /rest/v1/rpc/find_athletes_by_document  {"p_doc_number":"<documento>"}
--   -> HTTP 200
--      full_name, date_of_birth, school_id, school_name, team_id, team_name,
--      branch_name
--
-- Verificado sin autenticar, en lectura, con el documento de una menor de
-- Dynasty: devolvio nombre completo, fecha de nacimiento, escuela, equipo y
-- sede. Los documentos de menores en Colombia son ENUMERABLES, asi que esto
-- permitia cosechar datos personales de menores a escala.
--
-- POR QUE NO SE REVOCA A `anon`: la RPC la usa /join-team/:teamId, que es una
-- pagina PUBLICA — el acudiente mete el documento ANTES de crear la cuenta
-- (JoinTeamPage.tsx:95, el signUp viene despues). Revocar en seco rompe el
-- flujo de vinculacion por link de equipo.
--
-- LO QUE HACE ESTA MIGRACION: la funcion devuelve el detalle completo solo a
-- sesiones AUTENTICADAS. A `anon` le devuelve lo minimo para que reconozca a su
-- hijo y siga el flujo:
--
--   · full_name      -> ENMASCARADO: primer nombre + iniciales
--                       "SALOME LAMPREA VERGEL" -> "SALOME L. V."
--   · date_of_birth  -> NULL  (la pagina no lo renderiza: no cuesta nada)
--   · team_id        -> NULL
--   · branch_name    -> NULL
--   · child_id, school_id, school_name, team_name, already_linked -> se
--     mantienen: la pagina los necesita para que el acudiente elija cual de los
--     atletas encontrados es el suyo, y para el claim posterior.
--
-- OJO — sigue siendo un ORACULO de "existe / no existe" para `anon`. Eso es
-- inherente a que el flujo pida el documento antes del registro. Cerrarlo del
-- todo exige invertir /join-team (registrarse primero, buscar despues), que es
-- un cambio de UX del onboarding publico y va aparte.
--
-- Contexto en el roadmap: SEG-10 concluyo que «profiles, payments y children
-- devuelven 0» a `anon`. Es cierto para la TABLA via RLS y falso en el efecto,
-- porque esta funcion es SECURITY DEFINER y se la salta. SEG-3 tambien decia
-- que «el unico caso sin ningun chequeo se extrajo a SEG-8»: habia un segundo.
--
-- No cambia la firma ni el tipo de retorno, asi que el frontend no requiere
-- despliegue coordinado: la pagina sigue leyendo los mismos campos.
-- ============================================================================

BEGIN;

-- ── Helper: enmascara un nombre dejandolo reconocible ───────────────────────
-- "SALOME LAMPREA VERGEL" -> "SALOME L. V."
-- Un solo token -> se devuelve tal cual (no hay nada que enmascarar).
CREATE OR REPLACE FUNCTION public.mask_person_name(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT CASE
        WHEN p_name IS NULL OR btrim(p_name) = '' THEN p_name
        WHEN array_length(regexp_split_to_array(btrim(p_name), '\s+'), 1) <= 1
            THEN btrim(p_name)
        ELSE (regexp_split_to_array(btrim(p_name), '\s+'))[1] || ' ' || (
            -- WITH ORDINALITY + ORDER BY: `string_agg` sobre `unnest` NO garantiza
            -- el orden de las filas, y sin esto las iniciales pueden salir
            -- invertidas ("SALOME V. L." en vez de "SALOME L. V.").
            SELECT string_agg(upper(left(tok, 1)) || '.', ' ' ORDER BY ord)
              FROM unnest((regexp_split_to_array(btrim(p_name), '\s+'))[2:])
                   WITH ORDINALITY AS u(tok, ord)
             WHERE tok <> ''
        )
    END;
$$;

COMMENT ON FUNCTION public.mask_person_name(text) IS
    'Enmascara un nombre para respuestas publicas: primer nombre + iniciales ("SALOME LAMPREA VERGEL" -> "SALOME L. V."). Usada por find_athletes_by_document cuando el caller es anonimo.';

REVOKE ALL ON FUNCTION public.mask_person_name(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mask_person_name(text) TO anon, authenticated, service_role;


-- ── find_athletes_by_document: detalle solo para autenticados ───────────────
CREATE OR REPLACE FUNCTION public.find_athletes_by_document(
    p_doc_number text,
    p_school_id  uuid DEFAULT NULL
)
RETURNS TABLE (
    child_id      uuid,
    full_name     text,
    date_of_birth date,
    school_id     uuid,
    school_name   text,
    team_id       uuid,
    team_name     text,
    branch_name   text,
    already_linked boolean,
    is_mine       boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_doc  text := public.normalize_doc_number(p_doc_number);
    v_user uuid := auth.uid();
    v_auth boolean := (v_user IS NOT NULL);
BEGIN
    -- Documento completo o nada: evita barrer la tabla con 2 dígitos.
    IF v_doc IS NULL OR length(v_doc) < 5 THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT c.id,
           -- Nombre completo solo con sesión; anónimo ve iniciales.
           CASE WHEN v_auth THEN c.full_name
                ELSE public.mask_person_name(c.full_name) END,
           -- Dato personal de un menor: nunca al público.
           CASE WHEN v_auth THEN c.date_of_birth ELSE NULL::date END,
           c.school_id,
           s.name,
           CASE WHEN v_auth THEN c.team_id ELSE NULL::uuid END,
           t.name,
           CASE WHEN v_auth THEN b.name ELSE NULL::text END,
           (c.parent_id IS NOT NULL AND c.parent_id <> COALESCE(v_user, '00000000-0000-0000-0000-000000000000'::uuid)),
           (v_user IS NOT NULL AND c.parent_id = v_user)
      FROM public.children c
      LEFT JOIN public.schools         s ON s.id = c.school_id
      LEFT JOIN public.teams           t ON t.id = c.team_id
      LEFT JOIN public.school_branches b ON b.id = c.branch_id
     WHERE public.normalize_doc_number(c.doc_number) = v_doc
       AND COALESCE(c.is_active, true) = true
     ORDER BY (c.school_id = p_school_id) DESC NULLS LAST,
              (c.parent_id IS NULL) DESC,
              c.created_at ASC
     LIMIT 10;
END;
$$;

COMMENT ON FUNCTION public.find_athletes_by_document(text, uuid) IS
    'Busca atletas por documento en TODAS las escuelas (global). p_school_id solo prioriza el orden. Exige documento completo (>=5) y devuelve max. 10 filas. SIN SESION el nombre va enmascarado y fecha de nacimiento / team_id / sede van NULL: la usa /join-team antes del registro y no debe filtrar datos de menores (2026-08-12).';

-- Se mantiene `anon`: la pagina publica /join-team la necesita antes del signUp.
-- Con sesion devuelve el detalle; sin sesion, la version enmascarada.
GRANT EXECUTE ON FUNCTION public.find_athletes_by_document(text, uuid) TO anon, authenticated;

COMMIT;
