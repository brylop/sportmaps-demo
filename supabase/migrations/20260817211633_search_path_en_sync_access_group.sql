-- ============================================================================
-- La última SECURITY DEFINER sin search_path (invariante I4)
--
-- Fecha: 2026-08-17
--
-- ── Qué cierra ──────────────────────────────────────────────────────────────
-- Con `20260817210308` aplicada, `invariantes_seguridad()` quedó así:
--
--     I1 (datos privados públicos)      0
--     I2 (familia escribe)              0
--     I3 (FOR ALL sin WITH CHECK)      60   ← auditoría aparte, ver SEG-18
--     I4 (definer sin search_path)      1   ← esto
--     I5 (TRUNCATE a usuario común)     0
--
-- El único I4 es `fn_sync_access_group_on_payment`.
--
-- ── Por qué importa ─────────────────────────────────────────────────────────
-- Una función `SECURITY DEFINER` corre con los permisos de su dueño. Sin
-- `search_path` fijo, resuelve los nombres sin calificar usando el search_path
-- de QUIEN LA LLAMA: si alguien puede crear un esquema propio y anteponerlo,
-- hace que la función use SUS tablas y SUS funciones — con permisos de dueño.
-- Es la convención del repo justamente por eso.
--
-- ── Por qué ALTER y no CREATE OR REPLACE ────────────────────────────────────
-- Esta función **no está en ninguna migración del repo**: es de las ~336 de
-- deriva sin versionar (`INF-1`). Reescribirla con CREATE OR REPLACE exigiría
-- conocer su cuerpo exacto, y si lo que hay vivo difiere de lo que yo suponga,
-- la estaría cambiando a ciegas — en un trigger de PAGOS.
--
-- `ALTER FUNCTION … SET search_path` toca solo la configuración y deja el cuerpo
-- intacto. Es la herramienta correcta cuando el objeto no está versionado.
--
-- La firma se resuelve contra `pg_proc` en tiempo de ejecución en vez de
-- escribirla a mano: la lección de `SEG-8`, donde las firmas copiadas del repo
-- no coincidían con las de la base y la migración abortó con `42883`.
-- ============================================================================

BEGIN;

DO $$
DECLARE
    v_fn      record;
    v_tocadas int := 0;
BEGIN
    FOR v_fn IN
        SELECT p.oid,
               p.proname,
               pg_get_function_identity_arguments(p.oid) AS args
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.prosecdef                                   -- SECURITY DEFINER
           AND (p.proconfig IS NULL OR NOT EXISTS (
                SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%'
           ))
    LOOP
        -- Se recorre TODO lo que viole I4 y no solo el nombre conocido: si
        -- apareciera otra función en la misma situación entre que se escribió
        -- esto y se aplica, queda cubierta igual.
        EXECUTE format(
            'ALTER FUNCTION public.%I(%s) SET search_path = pg_catalog, public, pg_temp',
            v_fn.proname, v_fn.args
        );
        v_tocadas := v_tocadas + 1;
        RAISE NOTICE 'search_path fijado en %(%)', v_fn.proname, v_fn.args;
    END LOOP;

    IF v_tocadas = 0 THEN
        RAISE NOTICE 'No habia ninguna SECURITY DEFINER sin search_path.';
    END IF;
END;
$$;

COMMIT;

-- ────────────────────────────────────────────────────────────────────────────
-- Verificación
-- ────────────────────────────────────────────────────────────────────────────

-- 1. I4 debe quedar en cero. Se listan las que sobrevivan, si las hay.
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       p.proconfig
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.prosecdef
   AND (p.proconfig IS NULL OR NOT EXISTS (
        SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%'
   ));

-- 2. La función en cuestión, con su configuración ya puesta.
SELECT p.proname, p.prosecdef AS es_definer, p.proconfig
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname = 'fn_sync_access_group_on_payment';

-- 3. El tablero completo de invariantes. Se espera solo I3.
SELECT invariante, gravedad, count(*) AS violaciones
  FROM public.invariantes_seguridad()
 GROUP BY invariante, gravedad
 ORDER BY invariante;
