-- =============================================================================
-- 20260814125518_separar_pwa_branding_de_app_nativa.sql
-- Autor: brylop   Fecha: 2026-08-14   Versión anterior: 20260814122832
-- Objetivo: dejar UNA sola regla, sin ambigüedad, para cada una de las dos
--           cosas que se venden por separado.
--
--   `pwa_branding` → se le MUESTRA su marca. Manifest, íconos de instalación,
--                    login, colores dentro de la app. Web, Android e iOS.
--   `whitelabel`   → ADEMÁS tiene app NATIVA propia en las tiendas y puede
--                    ocultar la atribución "powered by SportMaps".
--
-- ── Qué estaba incoherente ──────────────────────────────────────────────────
-- Convivían dos reglas distintas para la misma idea:
--   · school_shows_own_brand = pwa_branding OR whitelabel  → 29 escuelas
--   · v_school_entitlements.has_pwa_branding = pwa_branding → 2 escuelas
-- Con eso, una escuela con whitelabel tenía el login pintado con su marca pero
-- la app se instalaba con el ícono de SportMaps. Mezcla silenciosa y difícil de
-- diagnosticar despues.
--
-- ── La regla, de acá en adelante ────────────────────────────────────────────
-- La herencia "whitelabel incluye la marca del PWA" es cierta comercialmente,
-- pero se aplica al OTORGAR, no al LEER: contratar whitelabel inserta TAMBIÉN
-- la fila pwa_branding (lo hace el toggle de super admin). Así todo el sistema
-- —DB, BFF y frontend— lee UN solo flag por pregunta, y quién tiene qué se
-- responde con un SELECT a school_addons en vez de recordar reglas escondidas
-- en una vista o en un OR.
--
-- Ya se intentó la herencia en lectura una vez (20260814104612) y activó la
-- marca en 29 escuelas de golpe; se revirtió en 20260814105131. Esta migración
-- termina de sacarla del último lugar donde quedaba.
--
-- ── Impacto medido antes de aplicar ─────────────────────────────────────────
-- 28 escuelas tienen `whitelabel`, y NINGUNA es account_type='real' (todas de
-- prueba). Además hay 0 dominios propios verificados, así que la marca previa
-- al login no está en uso por nadie. Impacto real: cero.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. "¿Se le muestra su marca?" → SOLO el addon pwa_branding
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.school_shows_own_brand(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT EXISTS(
        SELECT 1
          FROM public.school_addons a
         WHERE a.school_id = p_school_id
           AND a.addon_key = 'pwa_branding'
           AND a.enabled
    );
$$;

COMMENT ON FUNCTION public.school_shows_own_brand(uuid) IS
    '¿Se le MUESTRA su marca? (manifest, iconos, login, colores). Lee SOLO el '
    'addon pwa_branding: contratar whitelabel debe insertar tambien esa fila. '
    'NO confundir con school_has_branding_feature, que responde si puede '
    'EDITARLA (eso sigue siendo por tier).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. "¿Tiene app nativa propia?" → SOLO el addon whitelabel
--
-- Es el producto mayor: app publicada en App Store y Play Store con la marca
-- de la escuela. Habilita ademas ocultar el "powered by SportMaps".
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.school_has_native_app(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT EXISTS(
        SELECT 1
          FROM public.school_addons a
         WHERE a.school_id = p_school_id
           AND a.addon_key = 'whitelabel'
           AND a.enabled
    );
$$;

COMMENT ON FUNCTION public.school_has_native_app(uuid) IS
    '¿Tiene app NATIVA propia en las tiendas? (addon whitelabel). Es el unico '
    'que habilita ocultar la atribucion "powered by SportMaps".';

REVOKE ALL ON FUNCTION public.school_shows_own_brand(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.school_has_native_app(uuid) FROM PUBLIC;
-- anon necesita la primera: el login se pinta antes de que exista sesion.
GRANT EXECUTE ON FUNCTION public.school_shows_own_brand(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.school_has_native_app(uuid) TO authenticated, service_role;

COMMIT;
