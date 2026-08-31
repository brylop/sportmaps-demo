-- =============================================================================
-- 20260831095348_cerrar_brechas_seg22_seg1_seg2.sql
-- Autor: brylop   Fecha: 2026-08-31   Versión anterior: 20260829123314
-- Objetivo: cerrar el lote de hallazgos de seguridad que NO dependen de
-- ninguna decisión de producto (auditoría en vivo del 2026-08-29, ROADMAP.md
-- §SEG-22, SEG-1, SEG-2). Cuatro piezas independientes en la misma migración
-- porque las cuatro son mecánicas y de bajo riesgo verificado:
--
--   1. SEG-22 — `bridge_heartbeats` (mig. 20260826220634) quedó sin RLS y
--      pública: anon/authenticated tienen SELECT/INSERT/UPDATE/DELETE directos
--      por privilegio de esquema. Solo la escriben bff/src/routes/bridge.routes.ts
--      y bridge-heartbeat-check.job.ts, los dos con service_role. Fix: ENABLE
--      ROW LEVEL SECURITY sin políticas — mismo patrón que las otras 15 tablas
--      "RLS sin policy" del roadmap (deny-all correcto, service_role bypassa
--      RLS igual que siempre).
--
--   2. SEG-1a — 7 funciones nuevas (categorías deportivas, rutinas de personal
--      trainer — ninguna existía en el barrido de agosto) con search_path
--      mutable. Ninguna es SECURITY DEFINER (verificado: prosecdef=false en
--      las 7), así que el riesgo real es bajo, pero se corrige igual por
--      convención del repo. ALTER FUNCTION, no CREATE OR REPLACE: no se toca
--      el cuerpo de ninguna.
--
--   3. SEG-1b — pg_trgm/unaccent/pg_net instaladas en `public`. Verificado
--      antes de mover:
--        · unaccent(): CERO usos en supabase/migrations ni en bff/src.
--        · pg_trgm: un solo uso, `idx_schools_name_trgm` (mig.
--          20260218000002), un índice GIN ya creado — el operator class queda
--          resuelto por OID en el catálogo del índice, no se re-resuelve por
--          search_path después de creado.
--      Fix: mover esas dos a `extensions`, el schema que Supabase ya usa para
--      uuid-ossp/pgcrypto/pg_stat_statements — no una convención nueva.
--      ⚠️ pg_net QUEDA EN public, sin tocar: `ALTER EXTENSION pg_net SET SCHEMA`
--      falla con `0A000: extension "pg_net" does not support SET SCHEMA`
--      (comprobado al intentar aplicar esta misma migración — la extensión no
--      es relocatable). Aunque sus funciones YA viven en el schema `net`, no
--      en `public` — mover la extensión no las tocaría a ellas, pero la
--      extensión en sí no se deja mover sin DROP + CREATE, y eso arrastra el
--      estado interno de la cola async (`net.http_request_queue` y las
--      respuestas pendientes) que hoy sirve al outbox de notificaciones y al
--      autopay. `extension_in_public` para `pg_net` queda como hallazgo
--      aceptado, no un fix pendiente — anotarlo así en el roadmap.
--
--   4. SEG-2 — `v_school_staff_publico` y `v_school_settings_publico` son
--      `security_definer_view` A PROPÓSITO (las creó la auditoría del 14-ago
--      para resolver la fuga de `school_settings`/`school_staff` a `anon`:
--      RLS filtra filas, no columnas). El linter no distingue vista curada de
--      bypass accidental — se documentan con COMMENT, no se tocan. La tercera
--      vista que marca el linter, `school_athletes`, NO se toca acá: sigue
--      pendiente de resolver de verdad (queda como estaba).
--
-- QUÉ NO CIERRA ESTA MIGRACIÓN: la protección de contraseñas filtradas
-- (`auth_leaked_password_protection`) es un toggle del dashboard de Supabase
-- Auth (Authentication → Policies → Password Security) — no hay tabla, RPC ni
-- extensión que tocar por SQL. Queda pendiente de que alguien con acceso al
-- dashboard lo prenda.
-- =============================================================================

BEGIN;

-- ── 1. SEG-22 — bridge_heartbeats sin RLS ───────────────────────────────────
ALTER TABLE public.bridge_heartbeats ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.bridge_heartbeats IS
    'RLS habilitada sin policies (SEG-22, 2026-08-31): deny-all para anon/authenticated '
    'a propósito. Solo la escriben bridge.routes.ts y bridge-heartbeat-check.job.ts, '
    'los dos con service_role, que bypassa RLS.';

-- ── 2. SEG-1a — search_path en las 7 funciones nuevas ───────────────────────
ALTER FUNCTION public.trg_offerings_resolve_school_category()
    SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.trg_teams_resolve_school_category()
    SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.fn_resolve_school_category(uuid, text)
    SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.fn_check_facility_reservation_overlap()
    SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.fn_pt_session_auto_complete()
    SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.fn_pt_routine_reminder()
    SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.fn_pt_routine_reminder_2h()
    SET search_path = pg_catalog, public, pg_temp;

-- ── 3. SEG-1b — mover extensiones fuera de public ───────────────────────────
-- pg_net NO se mueve: no soporta SET SCHEMA (ver nota arriba). Queda en public.
ALTER EXTENSION pg_trgm SET SCHEMA extensions;
ALTER EXTENSION unaccent SET SCHEMA extensions;

-- ── 4. SEG-2 — documentar las 2 vistas security_definer intencionales ───────
COMMENT ON VIEW public.v_school_staff_publico IS
    'SECURITY DEFINER a propósito (SEG-2, aceptado 2026-08-31): creada el 2026-08-14 '
    'para exponer solo columnas publicables de school_staff a la web pública sin '
    'filtrar el resto de la tabla (RLS filtra filas, no columnas). El linter la marca '
    'como security_definer_view; NO revocar ni recrear sin verificar primero qué '
    'páginas públicas dependen de ella.';

COMMENT ON VIEW public.v_school_settings_publico IS
    'SECURITY DEFINER a propósito (SEG-2, aceptado 2026-08-31): creada el 2026-08-14 '
    'para exponer solo columnas publicables de school_settings (no bank_account_number, '
    'transfer_key, etc.) sin filtrar el resto de la tabla (RLS filtra filas, no '
    'columnas). El linter la marca como security_definer_view; NO revocar ni recrear '
    'sin verificar primero qué páginas públicas dependen de ella.';

COMMIT;


-- ── Verificación (correr después) ───────────────────────────────────────────
-- 1. bridge_heartbeats deniega a anon:
--    set local role anon; select count(*) from public.bridge_heartbeats; reset role;
--    -- debe fallar por RLS (0 filas visibles, no error de permiso de tabla)
--
-- 2. Las 7 funciones ya no aparecen en function_search_path_mutable:
--    select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--      where n.nspname='public' and p.proname in (
--        'trg_offerings_resolve_school_category','trg_teams_resolve_school_category',
--        'fn_resolve_school_category','fn_check_facility_reservation_overlap',
--        'fn_pt_session_auto_complete','fn_pt_routine_reminder','fn_pt_routine_reminder_2h')
--      and (p.proconfig is null or not exists(
--            select 1 from unnest(p.proconfig) c where c like 'search_path=%'));
--    -- debe devolver 0 filas
--
-- 3. net.http_post sigue funcionando (smoke real, no solo catálogo): disparar
--    cualquier flujo que dependa del outbox de notificaciones y confirmar que
--    notification_deliveries avanza de estado.
--
-- 4. Re-correr `get_advisors(security)` — extension_in_public y las 7 de
--    function_search_path_mutable deben salir en 0.
