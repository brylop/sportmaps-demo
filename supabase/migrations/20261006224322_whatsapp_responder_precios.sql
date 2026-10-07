-- =============================================================================
-- 20261006224322_whatsapp_responder_precios.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-07   Versión anterior: 20261006120601
-- Objetivo: cuarto ajuste del asistente por escuela (spec
-- docs/specs/whatsapp-ajustes-por-escuela.md). Con wa_responder_precios, a un
-- número desconocido que pregunta «¿cuánto cuesta?» el bot le dice los VALORES
-- de los planes activos (offering_plans) —y la semana de cortesía si la escuela
-- la tiene— sin mandarlo a pagar. Pedido de Besser: «si pregunta cuánto
-- cuesta, indicamos el valor, no que deba pagar».
-- Hoy, sin el ajuste, «¿cuánto cuesta?» de un desconocido no se contesta y
-- «¿cuánto vale la mensualidad?» recibe el enlace de inscripción pagado; eso
-- no cambia para nadie: default false.
-- Sin RLS ni funciones nuevas.
-- =============================================================================

BEGIN;

ALTER TABLE public.school_settings
    ADD COLUMN IF NOT EXISTS wa_responder_precios boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.school_settings.wa_responder_precios IS
    'Asistente WhatsApp: al desconocido que pregunta el precio le dice los valores de los planes activos, sin enlace de pago.';

COMMIT;
