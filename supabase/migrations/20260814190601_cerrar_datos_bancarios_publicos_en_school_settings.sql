-- =============================================================================
-- 20260814190601_cerrar_datos_bancarios_publicos_en_school_settings.sql
-- Autor: brylop   Fecha: 2026-08-14   Versión anterior: 20260814190138
-- Objetivo: dejar de publicar en internet los datos bancarios de las escuelas.
--
-- ── El hallazgo (el más grave del barrido) ──────────────────────────────────
-- La policy `Settings: select public` era:
--
--     FOR SELECT  TO public  USING (public_profile_enabled = true)
--
-- Filtra por escuela, pero devuelve la FILA ENTERA. Y school_settings tiene
-- bank_account_number, bank_titular_id (la cédula del titular), nequi_number,
-- daviplata_number, transfer_key, breb_key y payment_accounts.
--
-- Medido ejecutando como `anon`: **305 filas visibles**, las 305 con
-- payment_accounts —que es la fuente única de las llaves de cobro— y 2 con
-- número de cuenta y cédula del titular.
--
-- Como la llave anónima viaja en el bundle del frontend, esto era público de
-- verdad: cualquiera podía listar a dónde cobra cada escuela.
--
-- ── Por qué RLS no alcanzaba ────────────────────────────────────────────────
-- Igual que con school_staff: el problema no es QUÉ FILAS se ven —el perfil
-- público de la escuela sí necesita leer sus toggles de visibilidad— sino QUÉ
-- COLUMNAS. RLS filtra filas. Se resuelve con una vista.
--
-- ── Qué necesita de verdad la web pública ───────────────────────────────────
-- Verificado en los dos únicos lectores sin sesión:
--   · ExploreMapInteractive → school_id, public_profile_enabled
--   · mapPublicProfile      → show_programs, show_plans, show_facilities
-- Nada más. La vista expone exactamente eso.
--
-- El acceso de los MIEMBROS a la fila completa se conserva
-- (`School settings: select members`): un padre necesita ver a qué cuenta
-- transferir. Lo que no corresponde es que lo vea quien no tiene sesión.
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

CREATE OR REPLACE VIEW public.v_school_settings_publico AS
    SELECT
        ss.school_id,
        ss.public_profile_enabled,
        ss.show_programs,
        ss.show_plans,
        ss.show_facilities
    FROM public.school_settings ss
    WHERE ss.public_profile_enabled = true;

COMMENT ON VIEW public.v_school_settings_publico IS
    'Toggles de visibilidad del perfil publico de la escuela. Existe para que la '
    'web sin sesion NO tenga que tocar school_settings, que contiene numero de '
    'cuenta, cedula del titular, llaves de transferencia y payment_accounts. '
    'Sin security_invoker a proposito: el recorte aca es por COLUMNAS.';

GRANT SELECT ON public.v_school_settings_publico TO anon, authenticated;

DROP POLICY IF EXISTS "Settings: select public" ON public.school_settings;

COMMIT;
