-- =============================================================================
-- 20260918123632_buscar_menor_incluye_contacto_temp_del_acudiente.sql
-- Autor: brylop   Fecha: 2026-09-18   Versión anterior: 20260918114430
-- Objetivo: que la búsqueda por documento (JoinSchoolPublicPage, paso "busca si
--   tu hijo/a ya está cargado") devuelva también el nombre/correo/teléfono que
--   la escuela ya capturó del acudiente (`children.parent_*_temp`), para
--   precargar el formulario de registro en vez de hacerlo escribir de nuevo
--   datos que Besser (u otra escuela) ya tiene.
-- =============================================================================
--
-- DECISIÓN DE PRODUCTO (pedida explícitamente, 2026-09-18): el criterio de
-- acceso es el mismo que ya rige el nombre del menor en esta misma función
-- desde SEG-14 — conocer el documento del menor alcanza para ver el dato. Se
-- extiende ese mismo criterio a nombre/correo/teléfono del acudiente que la
-- escuela ya tenía capturado. El valor real SÍ llega al navegador (no es un
-- hash ni un hint parcial): la pantalla lo enmascara visualmente, pero quien
-- inspeccione la respuesta de la red lo ve completo. Es una superficie de PII
-- mayor que la que había antes (nombre parcial de un menor) — aceptada a
-- propósito para poder precargar el formulario, no una omisión.
--
-- POR QUÉ NO SE DEVUELVE SI YA ESTÁ VINCULADA (`already_linked = true`)
--
-- Si la ficha ya tiene acudiente, ese contacto es de OTRA persona (la que ya
-- la reclamó), no de quien está buscando ahora. Devolverlo ahí sería
-- exactamente la fuga que SEG-14 cerró, sin ningún beneficio de producto
-- (esa ficha no se puede adoptar de todas formas). Se nulean los tres campos
-- cuando `already_linked`.
-- =============================================================================

BEGIN;

-- Cambia el RETURNS TABLE (agrega columnas): CREATE OR REPLACE no alcanza,
-- Postgres exige DROP primero cuando el tipo de fila de salida cambia.
DROP FUNCTION IF EXISTS public.buscar_menor_por_documento_publico(text, uuid);

CREATE FUNCTION public.buscar_menor_por_documento_publico(
    p_doc_number text,
    p_school_id  uuid
)
RETURNS TABLE (
    child_id            uuid,
    nombre              text,     -- enmascarado
    school_id           uuid,
    school_name         text,
    team_name           text,
    branch_name         text,
    already_linked      boolean,
    parent_name_temp    text,
    parent_email_temp   text,
    parent_phone_temp   text
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
           (c.parent_id IS NOT NULL),
           -- Contacto del acudiente que la escuela ya capturó al pre-cargar la
           -- ficha. NULL si ya tiene acudiente: ese dato es de otra persona.
           CASE WHEN c.parent_id IS NULL THEN c.parent_name_temp  END,
           CASE WHEN c.parent_id IS NULL THEN c.parent_email_temp END,
           CASE WHEN c.parent_id IS NULL THEN c.parent_phone_temp END
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
    'acudiente (JoinTeamPage / JoinSchoolPublicPage), que corre SIN sesion. Sin fecha de nacimiento, con el '
    'nombre del menor enmascarado y exigiendo p_school_id (SEG-14). Desde 20260918123632 tambien devuelve '
    'parent_name_temp/parent_email_temp/parent_phone_temp de la ficha (valor real, no enmascarado en la '
    'respuesta — la pantalla lo enmascara visualmente) para precargar el formulario de registro, SOLO '
    'cuando la ficha todavia no tiene acudiente (already_linked=false); si ya lo tiene, esos tres campos '
    'salen NULL porque ese contacto es de otra persona.';

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ── Verificación después de aplicar ────────────────────────────────────────
--
-- 1) Ficha libre con contacto cargado: deben verse los tres campos.
--    SELECT parent_name_temp, parent_email_temp, parent_phone_temp
--      FROM public.buscar_menor_por_documento_publico(
--            (SELECT doc_number FROM public.children
--              WHERE parent_id IS NULL AND parent_email_temp IS NOT NULL LIMIT 1),
--            (SELECT school_id FROM public.children
--              WHERE parent_id IS NULL AND parent_email_temp IS NOT NULL LIMIT 1));
--
-- 2) Ficha YA vinculada: los tres campos deben salir NULL aunque la fila los tenga.
--    SELECT already_linked, parent_name_temp, parent_email_temp, parent_phone_temp
--      FROM public.buscar_menor_por_documento_publico(
--            (SELECT doc_number FROM public.children
--              WHERE parent_id IS NOT NULL AND parent_email_temp IS NOT NULL LIMIT 1),
--            (SELECT school_id FROM public.children
--              WHERE parent_id IS NOT NULL AND parent_email_temp IS NOT NULL LIMIT 1));
--    -- esperado: already_linked = true, los tres campos NULL.
