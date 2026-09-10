-- =============================================================================
-- 20260909215903_normalize_athlete_name_a_prueba_de_nfd.sql
-- Autor: brylop   Fecha: 2026-09-09   Versión anterior: 20260909083144
-- Objetivo: que normalize_athlete_name() deje de fallar con nombres escritos en
--           forma DESCOMPUESTA (NFD), que es lo que mandan iOS y macOS.
-- =============================================================================
-- La misma letra se puede escribir de dos formas que en pantalla son idénticas:
--
--   'ñ' precompuesta  = U+00F1                    (Windows, Android)
--   'ñ' descompuesta  = 'n' + U+0303 combinante   (iOS, macOS)
--
-- `translate()` trabaja carácter por carácter y solo conoce la precompuesta, así
-- que a la descompuesta la deja intacta:
--
--   normalize_athlete_name('Muñoz')  precompuesta -> 'munoz'   ✔
--   normalize_athlete_name('Muñoz')  descompuesta -> 'muñoz'   ✘  (sobrevive la ñ)
--
-- Las dos son «Muñoz» para cualquier persona y NO calzan entre sí. Es el mismo
-- bug que costó el duplicado de «Jacobo Sánchez Velásquez» el 2026-09-09, pero
-- una capa más abajo: ahí fallaba LOWER(TRIM()) por no quitar tildes; acá falla
-- el quitatildes por no entender la codificación.
--
-- Y hay una asimetría peor: el frontend (`normalizeText` en
-- frontend/src/lib/normalizeText.ts) descompone con NFD y borra las marcas
-- combinantes, así que maneja bien las DOS formas. O sea que hoy el frontend y
-- la base **discrepan**: el diálogo puede avisar «ya existe» mientras el guard
-- de la base deja pasar el INSERT, o al revés. Un guard que depende de cómo
-- teclearon el nombre no es un guard.
--
-- El arreglo: pasar el texto a forma canónica compuesta ANTES de traducir.
-- `normalize(text, NFC)` existe desde PG13 (acá corre PG17) y es IMMUTABLE, así
-- que la función conserva su volatilidad — importante, porque IMMUTABLE es lo
-- que permitiría indexarla más adelante.
--
-- ── Radio de impacto, medido antes de aplicar ───────────────────────────────
-- · 0 índices, 0 constraints y 0 defaults dependen de esta función, así que no
--   hay nada que reindexar ni ninguna restricción que revalidar.
-- · La llaman 4 funciones (accept_invitation_pro, el guard de alta duplicada,
--   el QR de inscripción y la migración de fichas): heredan el arreglo solas.
-- · 0 filas en `children`, `unregistered_athletes`, `invitations.child_name` y
--   `profiles.full_name` (3.377 en total) contienen marcas combinantes hoy, y
--   se verificó que para TODA entrada precompuesta el resultado es idéntico al
--   actual. O sea: esta migración no puede cambiar ninguna comparación de los
--   datos que ya existen. Es blindaje hacia adelante, no una corrección de
--   datos — y urge ahora porque el build de iOS acaba de salir y es justo el
--   teclado que produce la forma descompuesta.
--
-- ── Lo que NO cambia acá, a propósito ───────────────────────────────────────
-- La 'ñ' se sigue colapsando a 'n', así que «PEÑA» y «PENA» —apellidos reales
-- distintos— siguen normalizando igual. Hoy eso produce 1 solo par en toda la
-- plataforma. Para BUSCAR y sugerir coincidencias colapsar está bien; para
-- BLOQUEAR es discutible, porque un falso positivo frena a una familia
-- legítima. Cambiarlo es una decisión de producto y merece su propia migración:
-- mezclarla acá volvería esta migración imposible de revertir sin pensar.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.normalize_athlete_name(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT NULLIF(
        btrim(regexp_replace(
            lower(translate(normalize(p_name, NFC),
                'ÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇáàäâãéèëêíìïîóòöôõúùüûñç',
                'AAAAAEEEEIIIIOOOOOUUUUNCaaaaaeeeeiiiiooooouuuunc')),
            '\s+', ' ', 'g')),
        '');
$$;

-- Permisos idénticos a los que ya tenía: la llaman RPCs que corren como
-- authenticated y como service_role, y el QR público la alcanza vía anon.
GRANT EXECUTE ON FUNCTION public.normalize_athlete_name(text) TO anon;
GRANT EXECUTE ON FUNCTION public.normalize_athlete_name(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_athlete_name(text) TO service_role;

COMMIT;
