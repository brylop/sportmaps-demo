-- =============================================================================
-- 20260904131649_facturacion_electronica_modulo_independiente.sql
-- Autor: brylop   Fecha: 2026-09-04   Versión anterior: 20260904131122
-- Objetivo: agrega el module_key 'finanzas_facturacion_electronica' al CHECK
--   de school_module_overrides. Facturación electrónica pasa a tener su propia
--   página/ruta (/facturacion-electronica), independiente de Contabilidad —
--   la escuela puede activar el addon `invoicing` sola (sin `accounting`) y
--   facturar mensualidades/inscripciones/torneos/tienda igual, porque el motor
--   de emisión ya lee `payments`/`marketplace_transactions`/`orders` sin
--   filtrar por módulo. Si además tiene `accounting`, la pestaña dentro de
--   Contabilidad sigue funcionando igual (mismo dato, misma config, sin
--   duplicar nada) — ver docs/specs/capacidades-de-la-escuela-2026-08-18.md §14.3.
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

ALTER TABLE public.school_module_overrides
    DROP CONSTRAINT school_module_overrides_module_key_check;

ALTER TABLE public.school_module_overrides
    ADD CONSTRAINT school_module_overrides_module_key_check CHECK (module_key IN (
        'gestion_deportiva_equipos_planes','gestion_deportiva_calendario',
        'gestion_deportiva_entrenamiento_metricas','gestion_deportiva_entrenamiento_rutinas',
        'gestion_deportiva_informe_mensual',
        'finanzas_pagos','finanzas_recepcion','finanzas_contabilidad',
        'finanzas_facturacion_electronica',
        'reportes_finanzas','reportes_reportes','reportes_panel',
        'documentos_carnets','documentos_constancias','documentos_qr_inscripcion',
        'documentos_recordatorios','documentos_plantillas_mensajes',
        'sedes_sedes','sedes_instalaciones','sedes_control_acceso',
        'cuenta_perfil_publico'
    ));

COMMIT;
