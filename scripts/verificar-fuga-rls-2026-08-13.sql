-- ============================================================================
-- DIAGNÓSTICO — SEG-10: qué policy está filtrando datos a `anon`
--
-- Para completar 20260813133108, que solo cierra `payment_links`. Las otras dos
-- tablas no se pueden cerrar a ciegas: sus policies DECLARADAS en el repo están
-- bien acotadas, así que la que filtra es una que el repo no versiona (INF-1) y
-- no se sabe cómo se llama.
--
-- Todo es SELECT. No modifica nada. Correlo y pegá el resultado.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- BLOQUE 1 — Las policies REALES de las tres tablas
--
-- Lo que hay que buscar: filas con `qual` = `true` (o NULL en un `FOR SELECT`,
-- que es equivalente a permitir todo). Esas son las que filtran.
--
-- Ojo a la columna `roles`: si dice `{public}` aplica a TODOS los roles,
-- incluido `anon`. Si dice `{authenticated}`, `anon` no la usa.
-- ────────────────────────────────────────────────────────────────────────────
SELECT tablename,
       policyname,
       permissive,
       roles,
       cmd,
       qual                    AS condicion_using,
       with_check              AS condicion_with_check
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('payment_links', 'school_staff', 'facility_reservations')
 ORDER BY tablename, cmd, policyname;


-- ────────────────────────────────────────────────────────────────────────────
-- BLOQUE 2 — Todas las policies permisivas de SELECT que no filtran nada
--
-- Barre el esquema completo, no solo esas tres: puede haber más tablas
-- filtrando que nadie midió. `schools` va a aparecer y es INTENCIONAL — es el
-- directorio público.
-- ────────────────────────────────────────────────────────────────────────────
SELECT tablename,
       policyname,
       roles,
       COALESCE(qual, '(sin condición)') AS condicion
  FROM pg_policies
 WHERE schemaname = 'public'
   AND permissive = 'PERMISSIVE'
   AND cmd IN ('SELECT', 'ALL')
   AND (qual IS NULL OR btrim(qual) = 'true')
 ORDER BY tablename, policyname;


-- ────────────────────────────────────────────────────────────────────────────
-- BLOQUE 3 — Cuántas filas ve `anon` de verdad, tabla por tabla
--
-- `SET ROLE anon` es la única forma de comprobarlo desde el editor: hace que
-- `auth.uid()` sea NULL y que RLS se evalúe como para un visitante sin sesión.
--
-- ESPERADO hoy: payment_links 93 (o 0 si ya se aplicó la migración),
-- school_staff 68, facility_reservations 60, schools 364 (intencional),
-- y 0 en profiles / payments / children.
-- ────────────────────────────────────────────────────────────────────────────
SET ROLE anon;
SELECT 'payment_links'         AS tabla, count(*) AS ve_un_anonimo FROM public.payment_links
UNION ALL SELECT 'school_staff',          count(*) FROM public.school_staff
UNION ALL SELECT 'facility_reservations', count(*) FROM public.facility_reservations
UNION ALL SELECT 'schools',               count(*) FROM public.schools
UNION ALL SELECT 'profiles',              count(*) FROM public.profiles
UNION ALL SELECT 'payments',              count(*) FROM public.payments
UNION ALL SELECT 'children',              count(*) FROM public.children
 ORDER BY 2 DESC;
RESET ROLE;


-- ────────────────────────────────────────────────────────────────────────────
-- BLOQUE 4 — ¿Qué columnas necesita de verdad la web pública de school_staff?
--
-- Antes de decidir entre cerrar la tabla o exponer una vista, conviene ver qué
-- hay dentro. `getDemoSchoolProfile()` (schools.ts:220) hace `select('*')`, así
-- que hoy se lleva TODO: nombre, correo y teléfono del staff.
--
-- Con esto se decide qué columnas van a la vista pública — probablemente solo
-- nombre y rol, nunca correo ni teléfono.
-- ────────────────────────────────────────────────────────────────────────────
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'school_staff'
 ORDER BY ordinal_position;


-- ============================================================================
-- QUÉ HACER CON EL RESULTADO
--
-- · Del BLOQUE 1 y 2 salen los NOMBRES reales de las policies que filtran. Con
--   eso se puede escribir el DROP de `school_staff` y `facility_reservations`.
--
-- · Si una policy aparece en la base y NO está en ninguna migración, es deriva:
--   va a INF-1, y la migración que la borre tiene que decirlo, porque un clon
--   nuevo no la va a tener y el DROP no encontrará nada.
--
-- · Del BLOQUE 4 sale la decisión sobre `school_staff`: cerrarla del todo (y
--   romper el modo invitado si se activa) o exponer una vista con solo nombre y
--   rol. SEG-10 propone la vista.
-- ============================================================================
