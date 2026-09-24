-- =============================================================================
-- 20260924102932_coach_plans_module_key_carmel.sql
-- Autor: brylop   Fecha: 2026-09-24   Versión anterior: 20260924100845
-- Objetivo: nuevo module_key 'gestion_deportiva_disponibilidad_coach' para el
-- ítem "Mis Planes" del menú del COACH (/coach-plans: su disponibilidad
-- reservable y citas — coach_availability, session_bookings), y apagarlo para
-- Carmel Club.
--
-- Por qué no se quita el ítem del menú a secas: medido contra la base viva
-- (2026-09-24) coach_availability tiene 734 filas en 13 escuelas (156 en los
-- últimos 90 días) y session_bookings 45 en 90 días. Carmel tiene 0 — no
-- ofrece sesiones reservables — y sus entrenadores confunden "Mis Planes" con
-- la planificación de sesiones (/training-plans). Por eso va por el mecanismo
-- existente de módulos por escuela (school_module_overrides, UX-only), que
-- hasta hoy no tenía clave para este ítem: el menú del coach nunca había
-- llevado moduleKey.
--
-- Lado frontend, mismo commit: module-catalog.ts (clave + label),
-- navigation.ts (moduleKey en el ítem del coach), ModuleGate.tsx (prop `roles`
-- para gatear al coach, que por diseño no está en GATED_ROLES) y App.tsx
-- (ruta /coach-plans detrás del gate). El CHECK de la tabla enumera las
-- claves del catálogo TS: se amplían ambos lados juntos (ver el encabezado de
-- module-catalog.ts y la migración 20260904131649, mismo patrón).
--
-- set_by = NULL a propósito: lo aplica esta migración, no un super admin desde
-- el panel; no se inventa un actor. Si el Super Admin lo vuelve a tocar desde
-- la UI, admin_set_school_module lo pisa con su auth.uid() y deja audit_log.
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

-- ── 1. Ampliar el CHECK con la clave nueva ───────────────────────────────────
ALTER TABLE public.school_module_overrides
    DROP CONSTRAINT school_module_overrides_module_key_check;

ALTER TABLE public.school_module_overrides
    ADD CONSTRAINT school_module_overrides_module_key_check CHECK (module_key IN (
        'gestion_deportiva_equipos_planes','gestion_deportiva_calendario',
        'gestion_deportiva_entrenamiento_metricas','gestion_deportiva_entrenamiento_rutinas',
        'gestion_deportiva_informe_mensual',
        'gestion_deportiva_disponibilidad_coach',
        'finanzas_pagos','finanzas_recepcion','finanzas_contabilidad',
        'finanzas_facturacion_electronica',
        'reportes_finanzas','reportes_reportes','reportes_panel',
        'documentos_carnets','documentos_constancias','documentos_qr_inscripcion',
        'documentos_recordatorios','documentos_plantillas_mensajes',
        'sedes_sedes','sedes_instalaciones','sedes_control_acceso',
        'cuenta_perfil_publico'
    ));

-- ── 2. Apagarlo para Carmel Club ─────────────────────────────────────────────
INSERT INTO public.school_module_overrides (school_id, module_key, enabled, set_by, updated_at)
VALUES ('374a6716-af42-4745-afe1-8d089153e01b', 'gestion_deportiva_disponibilidad_coach', false, NULL, now())
ON CONFLICT (school_id, module_key) DO UPDATE
    SET enabled = false, updated_at = now();

COMMIT;
