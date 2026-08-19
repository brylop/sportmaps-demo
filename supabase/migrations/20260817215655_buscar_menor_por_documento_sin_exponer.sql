-- ============================================================================
-- SEG-14 — Buscar al menor por documento sin regalar su ficha
--
-- Fecha: 2026-08-17
--
-- ── El agujero, confirmado contra la base ───────────────────────────────────
-- `find_athletes_by_document` responde **HTTP 200 a un llamador anónimo**, con
-- la llave pública que viaja en el bundle del frontend. Probado con un documento
-- real de un menor: devuelve una fila con
--
--     full_name, date_of_birth, school_id, school_name, team_id, team_name,
--     branch_name, already_linked, is_mine
--
-- O sea: con un número de documento y sin ninguna sesión se obtiene el nombre
-- completo, la fecha de nacimiento y dónde entrena un menor. El roadmap lo daba
-- por cerrado desde el 08-16; era falso.
--
-- ── Por qué no alcanza con revocarla ────────────────────────────────────────
-- La usa `JoinTeamPage` (`/join-team/:teamId`), la página **pública** de
-- auto-registro del acudiente: el padre escribe el documento del hijo ANTES de
-- tener cuenta. Revocarla a `anon` rompe el alta.
--
-- ── Por qué una función nueva y no un CREATE OR REPLACE ─────────────────────
-- La original **no está en ninguna migración del repo**: es de la deriva sin
-- versionar (`INF-1`). Reescribirla exigiría conocer su cuerpo exacto y estaría
-- cambiando a ciegas la puerta de entrada de los acudientes.
--
-- Se agrega una función NUEVA con lo mínimo, se le da a `anon` solo esa, y a la
-- original se le quita el acceso anónimo. La original queda intacta.
--
-- ── Qué se recorta, y por qué cada cosa ─────────────────────────────────────
-- 1. **`date_of_birth` desaparece.** Se devolvía y la pantalla NO lo muestra:
--    costo cero, y es el dato más sensible de un menor.
-- 2. **`p_school_id` pasa a ser OBLIGATORIO.** Hoy es opcional y la búsqueda es
--    GLOBAL —todas las escuelas—, así que cualquiera con un documento consulta
--    todo el país. Exigirlo obliga a tener un link de equipo válido. La página
--    ya lo manda.
-- 3. **El nombre va enmascarado**: «Carlos Sánchez Díaz» → «Carlos S. D.». El
--    padre reconoce a su hijo —él escribió el documento y sabe el nombre—, y un
--    extraño se lleva mucho menos. El nombre completo aparece después del alta,
--    cuando ya hay sesión y vínculo.
-- 4. Se van también `team_id` e `is_mine`, que la página no usa. `is_mine` no
--    tiene sentido sin sesión.
--
-- Se conservan `school_name`, `team_name` y `branch_name` porque son lo que
-- permite al acudiente distinguir al mismo chico inscrito en dos clubes, que es
-- justamente para lo que existe la lista.
-- ============================================================================

BEGIN;

-- ── 1. La versión pública, con lo mínimo ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.buscar_menor_por_documento_publico(
    p_doc_number text,
    p_school_id  uuid
)
RETURNS TABLE (
    child_id       uuid,
    nombre         text,     -- enmascarado
    school_id      uuid,
    school_name    text,
    team_name      text,
    branch_name    text,
    already_linked boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT c.id,
           -- Primer nombre completo + inicial de cada palabra siguiente.
           -- «Carlos Sánchez Díaz» → «Carlos S. D.»
           (
             split_part(btrim(c.full_name), ' ', 1)
             || COALESCE(
                  (SELECT string_agg(' ' || left(w, 1) || '.', '')
                     FROM unnest(string_to_array(btrim(c.full_name), ' ')) WITH ORDINALITY AS t(w, i)
                    WHERE i > 1 AND w <> ''),
                  '')
           ),
           c.school_id,
           s.name,
           t.name,
           b.name,
           (c.parent_id IS NOT NULL)
      FROM public.children c
      LEFT JOIN public.schools         s ON s.id = c.school_id
      LEFT JOIN public.teams           t ON t.id = c.team_id
      LEFT JOIN public.school_branches b ON b.id = c.branch_id
     -- Se compara solo por digitos: el acudiente escribe con puntos o guiones.
     WHERE regexp_replace(COALESCE(c.doc_number, ''), '[^0-9]', '', 'g')
         = regexp_replace(COALESCE(p_doc_number, ''), '[^0-9]', '', 'g')
       AND regexp_replace(COALESCE(p_doc_number, ''), '[^0-9]', '', 'g') <> ''
       -- Obligatorio: sin el contexto del link, esto seria un buscador global.
       AND p_school_id IS NOT NULL
       AND COALESCE(c.is_active, true);
$$;

REVOKE ALL ON FUNCTION public.buscar_menor_por_documento_publico(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buscar_menor_por_documento_publico(text, uuid) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.buscar_menor_por_documento_publico(text, uuid) IS
    'Version publica y recortada de find_athletes_by_document, para la pagina de auto-registro del '
    'acudiente (JoinTeamPage), que corre SIN sesion. Sin fecha de nacimiento, con el nombre '
    'enmascarado y exigiendo p_school_id — la original respondia a anon con la ficha completa de '
    'cualquier menor a partir de su documento (SEG-14).';


-- ── 2. Cerrarle la puerta anónima a la original ─────────────────────────────
-- No se toca su cuerpo: solo quien puede ejecutarla. Se recorren todas sus
-- sobrecargas resolviendo contra pg_proc, porque las firmas escritas a mano ya
-- hicieron abortar una migración antes (SEG-8, error 42883).
DO $$
DECLARE
    v_fn record;
BEGIN
    FOR v_fn IN
        SELECT p.oid, pg_get_function_identity_arguments(p.oid) AS args
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.proname = 'find_athletes_by_document'
    LOOP
        EXECUTE format(
            'REVOKE EXECUTE ON FUNCTION public.find_athletes_by_document(%s) FROM anon, PUBLIC',
            v_fn.args
        );
        RAISE NOTICE 'find_athletes_by_document(%) cerrada a anon', v_fn.args;
    END LOOP;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ────────────────────────────────────────────────────────────────────────────
-- Verificación
-- ────────────────────────────────────────────────────────────────────────────

-- 1. Quién puede ejecutar cada una. `anon` debe aparecer SOLO en la nueva.
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid)              AS args,
       has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_puede,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_puede
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('find_athletes_by_document', 'buscar_menor_por_documento_publico')
 ORDER BY p.proname;

-- 2. El enmascarado, sobre un menor real. Debe verse «Nombre X. Y.» y NO el
--    apellido completo. Se muestra una sola fila a propósito.
SELECT nombre, school_name, team_name, already_linked
  FROM public.buscar_menor_por_documento_publico(
        (SELECT doc_number FROM public.children WHERE doc_number IS NOT NULL LIMIT 1),
        (SELECT school_id  FROM public.children WHERE doc_number IS NOT NULL LIMIT 1)
       )
 LIMIT 1;

-- 3. Sin escuela no devuelve nada, aunque el documento exista.
SELECT count(*) AS filas_sin_escuela
  FROM public.buscar_menor_por_documento_publico(
        (SELECT doc_number FROM public.children WHERE doc_number IS NOT NULL LIMIT 1),
        NULL
       );
