-- =============================================================================
-- 20260804202714_doc_number_unico_por_escuela.sql
-- Autor: brylop   Fecha: 2026-08-05   Versión anterior: 20260804161413
-- Objetivo: red de seguridad contra atletas duplicados — un mismo documento no
--   puede repetirse dentro de una escuela, por ninguna vía.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path (acá no se crean funciones).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
-- =============================================================================
--
-- QUÉ CIERRA Y QUÉ NO
--
-- El agujero grande lo cierra el chequeo de servidor en students-create-one.route
-- (documento exacto + nombre normalizado, contra `children` y
-- `unregistered_athletes`). Este índice es la RED por si aparece otra vía que se
-- olvide de consultar — que es exactamente lo que pasó con la rama
-- `unregistered_adult`, que insertaba sin verificar nada.
--
-- Y hay que ser honesto sobre su alcance: HOY ES CASI INERTE. En el padrón de
-- Dynasty la columna `doc_number` viene vacía en la enorme mayoría de las ~400
-- filas, y en Postgres los NULL no colisionan entre sí. Los cuatro duplicados
-- medidos el 2026-08-04 (Josue Cortes Saenz, Gabriela Buitrago, Julieta Mayorga,
-- Dai/DAIMARIS) tenían documentos DISTINTOS o ninguno, así que este índice no
-- habría frenado ni uno. Sirve hacia adelante, cuando el padrón tenga documentos.
--
-- POR QUÉ PARCIAL Y NO UNIQUE PELADO
--
-- `WHERE doc_number IS NOT NULL AND doc_number <> ''` por dos razones: los NULL ya
-- no colisionan (así que la primera condición es documentación), pero el STRING
-- VACÍO sí colisiona consigo mismo — y un formulario que envía '' en vez de null
-- dejaría de poder crear un segundo atleta sin documento. Con el índice parcial,
-- '' y NULL quedan los dos fuera.
--
-- CREATE INDEX sin CONCURRENTLY: son tablas chicas (~400 filas por escuela) y el
-- lock es de milisegundos. CONCURRENTLY no puede ir dentro de una transacción.
--
-- SI FALLA AL APLICAR
--
-- Un 23505 acá significa que ya existen dos atletas con el mismo documento en una
-- escuela — o sea un duplicado real, sin ambigüedad. En ese caso NO forzar: correr
-- la query de diagnóstico del pie, resolver esos pares a mano, y reintentar.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_children_doc_per_school
    ON public.children (school_id, doc_number)
    WHERE doc_number IS NOT NULL AND doc_number <> '';

COMMENT ON INDEX public.uniq_children_doc_per_school IS
  'Un documento no se repite entre menores de la misma escuela. Parcial: NULL y string vacío quedan fuera, para no bloquear a los atletas sin documento cargado (hoy la mayoría del padrón). Red de seguridad — el chequeo real vive en students-create-one.route, que además cruza por nombre normalizado.';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_unreg_athletes_doc_per_school
    ON public.unregistered_athletes (school_id, doc_number)
    WHERE doc_number IS NOT NULL AND doc_number <> '';

COMMENT ON INDEX public.uniq_unreg_athletes_doc_per_school IS
  'Idem para atletas sin cuenta. Esta era la rama que insertaba sin ningún chequeo previo (creó DAIMARIS VASQUEZ PEREZ tres minutos antes de que la misma persona apareciera como atleta adulta con su propia cuenta).';

COMMIT;

-- ── Verificación después de aplicar ────────────────────────────────────────
--
-- 1) Los dos índices existen y son parciales:
--
--    SELECT indexname, indexdef FROM pg_indexes
--     WHERE schemaname = 'public'
--       AND indexname IN ('uniq_children_doc_per_school','uniq_unreg_athletes_doc_per_school')
--
-- 2) Cuánto cubre realmente hoy — cuántos atletas tienen documento cargado:
--
--    SELECT 'children' AS tabla,
--           count(*) AS total,
--           count(*) FILTER (WHERE NULLIF(trim(doc_number), '') IS NOT NULL) AS con_documento
--      FROM public.children
--     WHERE school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
--    UNION ALL
--    SELECT 'unregistered_athletes', count(*),
--           count(*) FILTER (WHERE NULLIF(trim(doc_number), '') IS NOT NULL)
--      FROM public.unregistered_athletes
--     WHERE school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
--
--    Si `con_documento` es cerca de 0, el índice está puesto pero dormido. Es lo
--    esperado, y la razón por la que el chequeo de servidor por nombre es el que
--    de verdad protege.
--
-- 3) Diagnóstico si el CREATE INDEX falla con 23505 — los pares en conflicto:
--
--    SELECT school_id, doc_number, count(*), string_agg(full_name, ' | ') AS nombres
--      FROM public.children
--     WHERE NULLIF(trim(doc_number), '') IS NOT NULL
--     GROUP BY 1, 2 HAVING count(*) > 1
--
--    (misma query sobre unregistered_athletes)
--
-- Vuelta atrás: migración nueva con DROP INDEX para los dos.
