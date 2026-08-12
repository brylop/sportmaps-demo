-- ============================================================================
-- VERIFICACIÓN — fuga de datos de menores por find_athletes_by_document
-- Para la migración 20260812172252_find_athletes_por_documento_sin_fuga_a_anon
--
-- Correr los bloques 1 y 2 ANTES de aplicar la migración (dejan constancia de la
-- fuga), y los bloques 3 a 5 DESPUÉS.
--
-- El método de `anon` es el mismo que usa el barrido de seguridad del roadmap:
--     SET ROLE anon;  ...  RESET ROLE;
-- Con `SET ROLE anon` la función ve `auth.uid()` en NULL, que es exactamente la
-- condición de un visitante sin sesión.
--
-- NO hay documentos hardcodeados: se eligen de la base al correr, para no dejar
-- datos de menores versionados en el repo.
--
-- Todo es SELECT. No modifica nada.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- BLOQUE 1 (ANTES) — elegir un documento de prueba
-- Guardá el valor que devuelve para usarlo en los bloques siguientes.
-- ────────────────────────────────────────────────────────────────────────────
SELECT c.doc_number AS documento_de_prueba,
       c.full_name  AS a_quien_pertenece
  FROM public.children c
 WHERE c.doc_number IS NOT NULL
   AND length(public.normalize_doc_number(c.doc_number)) >= 8
   AND COALESCE(c.is_active, true)
 ORDER BY c.created_at DESC
 LIMIT 1;


-- ────────────────────────────────────────────────────────────────────────────
-- BLOQUE 2 (ANTES) — la fuga, vista como un anónimo
-- Reemplazá <DOC> por el valor del bloque 1.
--
-- ESPERADO ANTES de la migración: devuelve full_name completo, date_of_birth,
-- team_id y branch_name. Eso es la fuga.
-- ────────────────────────────────────────────────────────────────────────────
SET ROLE anon;
SELECT full_name, date_of_birth, school_name, team_name, branch_name
  FROM public.find_athletes_by_document('<DOC>', NULL);
RESET ROLE;


-- ═══════════════════════════════════════════════════════════════════════════
--                    ↓↓↓  APLICAR LA MIGRACIÓN ACÁ  ↓↓↓
--   supabase/migrations/20260812172252_find_athletes_por_documento_sin_fuga_a_anon.sql
-- ═══════════════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────────────────
-- BLOQUE 3 (DESPUÉS) — el enmascarado, caso por caso
--
-- ESPERADO:
--   'SALOME LAMPREA VERGEL'  → 'SALOME L. V.'
--   'Juan Pablo Lopez Montoya' → 'Juan P. L. M.'
--   'Madonna'                → 'Madonna'      (un solo token: no hay qué enmascarar)
--   '  doble   espacio  '    → 'doble E.'     (tolera espacios de más)
--   NULL                     → NULL
--   ''                       → ''
--
-- OJO en el 2º caso: las iniciales deben salir EN ORDEN (P. L. M.). Si salen
-- desordenadas, el `ORDER BY ord` del helper no quedó aplicado.
-- ────────────────────────────────────────────────────────────────────────────
SELECT entrada, public.mask_person_name(entrada) AS enmascarado
  FROM (VALUES
      ('SALOME LAMPREA VERGEL'),
      ('Juan Pablo Lopez Montoya'),
      ('Madonna'),
      ('  doble   espacio  '),
      (NULL),
      ('')
  ) AS t(entrada);


-- ────────────────────────────────────────────────────────────────────────────
-- BLOQUE 4 (DESPUÉS) — un anónimo ya NO ve datos del menor
-- Reemplazá <DOC> por el mismo valor del bloque 1.
--
-- ESPERADO: full_name enmascarado, date_of_birth NULL, team_id NULL,
-- branch_name NULL. Y school_name / team_name / already_linked siguen viniendo,
-- que es lo que /join-team necesita para que el acudiente elija.
-- ────────────────────────────────────────────────────────────────────────────
SET ROLE anon;
SELECT child_id IS NOT NULL           AS trae_child_id,
       full_name                      AS nombre_enmascarado,
       date_of_birth                  AS debe_ser_null,
       team_id                        AS debe_ser_null_tambien,
       branch_name                    AS debe_ser_null_3,
       school_name, team_name, already_linked
  FROM public.find_athletes_by_document('<DOC>', NULL);
RESET ROLE;


-- ────────────────────────────────────────────────────────────────────────────
-- BLOQUE 5 (DESPUÉS) — con sesión sigue viniendo el detalle completo
--
-- El SQL editor corre como `postgres`/`service_role`, donde `auth.uid()` es
-- NULL, así que ACÁ TAMBIÉN saldría enmascarado: eso NO es un fallo del fix.
-- Para probar la rama autenticada de verdad hay que llamar la RPC con el JWT de
-- un usuario, desde el navegador o con curl:
--
--   curl -s -X POST '<SUPABASE_URL>/rest/v1/rpc/find_athletes_by_document' \
--     -H "apikey: <ANON_KEY>" \
--     -H "Authorization: Bearer <ACCESS_TOKEN_DE_UN_USUARIO>" \
--     -H 'Content-Type: application/json' \
--     -d '{"p_doc_number":"<DOC>"}'
--
-- ESPERADO con JWT: full_name completo y date_of_birth con la fecha real.
--
-- Lo que sí se puede comprobar acá es que los permisos quedaron como deben:
-- ────────────────────────────────────────────────────────────────────────────
SELECT p.proname                                   AS funcion,
       pg_get_userbyid(p.proowner)                 AS dueno,
       p.prosecdef                                 AS es_security_definer,
       array_to_string(p.proacl, E'\n')            AS permisos
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('find_athletes_by_document', 'mask_person_name')
 ORDER BY p.proname;


-- ────────────────────────────────────────────────────────────────────────────
-- BLOQUE 6 (DESPUÉS) — lo que este fix NO cierra
--
-- Sigue siendo un ORÁCULO: un anónimo puede saber si un documento existe en la
-- plataforma, aunque no vea de quién es. Esta consulta lo demuestra: devuelve
-- cuántas filas encontró, sin exponer datos.
--
-- Es inherente a que /join-team pida el documento ANTES del registro. Cerrarlo
-- exige invertir ese flujo (registrarse primero, buscar después) y va aparte.
-- ────────────────────────────────────────────────────────────────────────────
SET ROLE anon;
SELECT count(*) AS filas_que_ve_un_anonimo
  FROM public.find_athletes_by_document('<DOC>', NULL);
RESET ROLE;
