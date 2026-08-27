-- =============================================================================
-- 20260825124513_notifications_support_category.sql
-- Autor: brylop   Fecha: 2026-08-25   Versión anterior: 20260825114534
-- Objetivo: MOD-21 S2 — notificar al super_admin cuando llega un ticket
-- nuevo de soporte in-app, reusando el Despachador Unificado de
-- Notificaciones (trigger → outbox → dispatcher, ya construido y validado).
-- notifications.category tiene un CHECK cerrado a 9 valores
-- (payment/installment/glosa/enrollment/access/qr/marketplace/equipment/
-- system) sin 'support'. Se amplía, no se reemplaza — aditivo, no rompe
-- ninguna fila existente.
-- =============================================================================

BEGIN;

ALTER TABLE public.notifications DROP CONSTRAINT notifications_category_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_category_check
  CHECK (category = ANY (ARRAY[
    'payment', 'installment', 'glosa', 'enrollment', 'access',
    'qr', 'marketplace', 'equipment', 'system', 'support'
  ]::text[]));

COMMIT;
