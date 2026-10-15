-- =============================================================================
-- 20261015124611_acuerdo_monster_volley.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-15   Versión anterior: 20261015124518
-- Objetivo: cargar el acuerdo comercial de Monster's Volley Club
--   (school_id eb3ebc77-4ea4-4992-96c8-3c8ec574578c) sobre las tablas de la
--   migración 20261015124518. Idempotente.
--
-- Acuerdo: octubre 2026 sin costo (implementación acompañada). 5-nov-2026:
--   $289.000 mensualidad + $130.000 certificado digital (una vez al año). Dic y
--   ene: $289.000 cada día 5. Desde el 5-feb-2027: $348.000 cada día 5. Sin costo:
--   rediseño de la página web e integración de WhatsApp.
--
-- SUPUESTOS NO CONFIRMADOS POR EL USUARIO:
--   · plan_code NO se cambia (sigue 'starter'; el precio sale del schedule).
--   · El certificado se renueva cada 12 meses al mismo valor.
--   · Los montos NO incluyen IVA; no hay líneas de impuesto.
--   · billing_emails queda como está (NULL).
-- Períodos del día 1 al día 1; la factura sale el 1 y vence el 5 (due_offset_days = 4).
-- No se usa admin_set_saas_billing_enabled: generaría de inmediato una factura de
--   octubre por $0. Se activa directo; la primera factura la genera el ciclo diario
--   el 1-nov-2026 (06:20 COT), período 1-nov a 1-dic, vence el 5-nov.
-- =============================================================================

BEGIN;

INSERT INTO public.school_billing_schedule (school_id, effective_from, monthly_price_cents, note) VALUES
  ('eb3ebc77-4ea4-4992-96c8-3c8ec574578c', '2026-10-01', 0,        'Implementación acompañada'),
  ('eb3ebc77-4ea4-4992-96c8-3c8ec574578c', '2026-11-01', 28900000, 'Mensualidad (primer pago 5-nov-2026)'),
  ('eb3ebc77-4ea4-4992-96c8-3c8ec574578c', '2027-02-01', 34800000, 'Mensualidad desde el 5-feb-2027')
ON CONFLICT (school_id, effective_from) DO NOTHING;

INSERT INTO public.school_one_time_charges (school_id, code, label, amount_cents, next_bill_on, renews_every_months)
SELECT 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c', 'certificado_digital', 'Certificado digital (anual)',
       13000000, DATE '2026-11-05', 12
 WHERE NOT EXISTS (
   SELECT 1 FROM public.school_one_time_charges
    WHERE school_id = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c' AND code = 'certificado_digital'
 );

UPDATE public.school_subscriptions
   SET due_offset_days         = 4,
       billing_cycle           = 'monthly',
       current_period_start    = TIMESTAMPTZ '2026-10-01 00:00-05',
       current_period_end      = TIMESTAMPTZ '2026-11-01 00:00-05',
       saas_billing_enabled    = true,
       saas_billing_enabled_at = COALESCE(saas_billing_enabled_at, now()),
       metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('acuerdo_comercial', jsonb_build_object(
         'texto', 'Octubre 2026 sin costo (implementación acompañada). Primer pago el 5-nov-2026: $289.000 de mensualidad + $130.000 de certificado digital (pago completo, una vez al año). Diciembre y enero: $289.000 cada día 5. Desde el 5-feb-2027: $348.000 cada día 5. Sin costo para el club: rediseño de la página web e integración de WhatsApp.',
         'fecha', '2026-10-15',
         'sin_costo', jsonb_build_array('rediseno_web', 'whatsapp')
       )),
       updated_at = now()
 WHERE school_id = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c';

COMMIT;
