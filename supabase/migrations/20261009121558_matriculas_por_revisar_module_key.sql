-- =============================================================================
-- 20261009121558_matriculas_por_revisar_module_key.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-09   Versión anterior: 20261009115335
-- Objetivo: nuevo module_key 'deportistas_matriculas_por_revisar' para el
-- ítem «Matrículas por revisar» (/school/enrollment-intake) del menú de la
-- escuela, y apagarlo en Carmel Club y GYM RM.
--
-- Por qué: el alta por foto de la hoja de matrícula es para las escuelas que
-- matriculan y cobran (Dynasty y las demás). Carmel no cobra por SportMaps y
-- GYM RM es un gimnasio; a las dos el ítem les aparecía vacío y confundía. En la
-- base no hay ningún dato que separe a Dynasty de GYM RM (las dos tienen
-- billing_enabled y school_type 'academy'), así que va por el mecanismo de
-- módulos por escuela (school_module_overrides, solo UX), que el Super Admin
-- prende o apaga desde el panel.
--
-- De paso se agrega 'comunicacion_whatsapp' al CHECK: está en el catálogo TS
-- (module-catalog.ts, ítem «WhatsApp») pero ninguna migración lo sumó al CHECK,
-- así que admin_set_school_module fallaba con 23514 al tocar ese módulo.
--
-- Frontend, mismo commit: module-catalog.ts (clave + label), navigation.ts
-- (moduleKey en los dos árboles, school y school_admin) y App.tsx (ruta detrás
-- de ModuleGate).
--
-- set_by = NULL a propósito: lo aplica esta migración, no un super admin desde
-- el panel (mismo criterio que 20260924102932).
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

-- ── 1. Ampliar el CHECK con las claves nuevas ────────────────────────────────
ALTER TABLE public.school_module_overrides
    DROP CONSTRAINT school_module_overrides_module_key_check;

ALTER TABLE public.school_module_overrides
    ADD CONSTRAINT school_module_overrides_module_key_check CHECK (module_key IN (
        'gestion_deportiva_equipos_planes','gestion_deportiva_calendario',
        'gestion_deportiva_entrenamiento_metricas','gestion_deportiva_entrenamiento_rutinas',
        'gestion_deportiva_informe_mensual',
        'gestion_deportiva_disponibilidad_coach',
        'deportistas_matriculas_por_revisar',
        'finanzas_pagos','finanzas_recepcion','finanzas_contabilidad',
        'finanzas_facturacion_electronica',
        'reportes_finanzas','reportes_reportes','reportes_panel',
        'documentos_carnets','documentos_constancias','documentos_qr_inscripcion',
        'documentos_recordatorios','documentos_plantillas_mensajes',
        'comunicacion_whatsapp',
        'sedes_sedes','sedes_instalaciones','sedes_control_acceso',
        'cuenta_perfil_publico'
    ));

-- ── 2. Apagarlo para Carmel Club y GYM RM ────────────────────────────────────
INSERT INTO public.school_module_overrides (school_id, module_key, enabled, set_by, updated_at)
VALUES
    ('374a6716-af42-4745-afe1-8d089153e01b', 'deportistas_matriculas_por_revisar', false, NULL, now()),  -- Carmel Club
    ('2137182d-a695-4695-8e5a-61151fc59196', 'deportistas_matriculas_por_revisar', false, NULL, now())   -- GYM RM
ON CONFLICT (school_id, module_key) DO UPDATE
    SET enabled = false, updated_at = now();

COMMIT;
