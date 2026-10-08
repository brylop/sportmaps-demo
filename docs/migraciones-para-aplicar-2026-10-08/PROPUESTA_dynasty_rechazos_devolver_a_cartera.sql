-- ============================================================================
-- PROPUESTA (NO CORRIDA) — devolver a la cartera los cobros que el botón
-- «Rechazar» sacó de ella (Dynasty Volley Club).
-- ============================================================================
--
-- REQUIERE aplicar ANTES la migración 20261008165728_rechazo_comprobante_conserva_deuda.sql
-- (crea receipt_rejected_at, receipt_rejection_code, rejected_receipt_url).
--
-- Qué pasó: «Rechazar» ponía status='rejected' sobre el propio cobro, sin motivo.
-- Medido el 2026-10-08 (SELECT sobre la base):
--
--   cobro     concepto                     monto     rechazado   estado antes  ¿cobro de reemplazo?
--   fe08ee23  Mensualidad 10/2026          180.000   2026-10-08  pending       NO  → la deuda no existe
--   cc3baefe  Mensualidad 10/2026          180.000   2026-10-06  pending       SÍ  (21d2cdaf, pending, creado 10-07 01:30)
--   bb3e532f  Mensualidad 10/2026          180.000   2026-10-06  pending       SÍ  (9b497ec5, pending, creado 10-07 01:30)
--   acb637ea  Mensualidad 09/2026          150.000   2026-09-04  pending       NO  → septiembre no figura desde el 04-sep
--
-- Los dos de octubre con reemplazo los «recreó» el generador nocturno del 07-oct
-- (el índice de unicidad por periodo no cuenta los 'rejected'). Esa deuda SÍ
-- está en la cartera, en el cobro nuevo; no se tocan (revivirlos duplicaría la
-- deuda). fe08ee23 lo habría recreado el generador de esta noche, pero solo
-- para mensualidades: cualquier otro concepto rechazado se perdía para siempre.
--
-- Este script es idempotente y defensivo: solo revive un cobro si sigue en
-- 'rejected' y si NO hay otro cobro activo del mismo deportista, periodo y
-- categoría. Si el generador ya lo recreó, no hace nada.
--
-- Correr en una transacción, revisar la vista previa y el «después», y recién
-- entonces COMMIT.
-- ============================================================================

BEGIN;

-- ── 0. Vista previa ─────────────────────────────────────────────────────────
SELECT p.id, p.status, p.amount, p.concept, p.due_date, p.updated_at AS rechazado_en,
       (SELECT string_agg(p2.id::text || ':' || p2.status, ', ')
          FROM public.payments p2
         WHERE p2.school_id = p.school_id
           AND p2.id <> p.id
           AND p2.period_year  IS NOT DISTINCT FROM p.period_year
           AND p2.period_month IS NOT DISTINCT FROM p.period_month
           AND coalesce(p2.payment_category, '') = coalesce(p.payment_category, '')
           AND coalesce(p2.child_id, p2.user_id, p2.unregistered_athlete_id)
             = coalesce(p.child_id, p.user_id, p.unregistered_athlete_id)
           AND p2.status IN ('pending','awaiting_approval','paid','partial','overdue','glosado')) AS cobro_activo_del_periodo
  FROM public.payments p
 WHERE p.id IN ('fe08ee23-3a42-4e1b-abdf-cfa2e1b00dbd',
                'cc3baefe-cbe7-4ea3-85fb-02fdc84393e4',
                'bb3e532f-5b15-40c3-8c8a-961a2def521c',
                'acb637ea-d2ad-443b-883e-2addbc5c8f81');

-- ── 1. Octubre sin reemplazo (fe08ee23, $180.000) → pending ────────────────
-- Septiembre (acb637ea, $150.000) → overdue: venció el 10-sep. Es el caso del
-- QR subido en vez del comprobante (spec whatsapp-cola-de-comprobantes §5): la
-- familia nunca pagó septiembre. CONFIRMAR CON LA ESCUELA antes de incluirlo;
-- si no se quiere revivir, quitar su id de la lista.
UPDATE public.payments p
   SET status                      = CASE WHEN p.due_date < (now() AT TIME ZONE 'America/Bogota')::date
                                          THEN 'overdue' ELSE 'pending' END,
       rejection_reason            = 'La escuela no aprobó el comprobante enviado. El cobro sigue pendiente: envía el comprobante de la transferencia.',
       receipt_rejection_code      = 'OTRO',
       receipt_rejected_at         = p.updated_at,      -- fecha real del rechazo
       rejected_receipt_url        = p.receipt_url,
       receipt_url                 = NULL,
       receipt_submitted_at        = NULL,
       payment_date                = NULL,
       receipt_image_sha256        = NULL,
       receipt_image_sha256_source = NULL,
       ocr_reference               = NULL
 WHERE p.id IN ('fe08ee23-3a42-4e1b-abdf-cfa2e1b00dbd',
                'acb637ea-d2ad-443b-883e-2addbc5c8f81')
   AND p.status = 'rejected'
   AND NOT EXISTS (
        SELECT 1 FROM public.payments p2
         WHERE p2.school_id = p.school_id
           AND p2.id <> p.id
           AND p2.period_year  IS NOT DISTINCT FROM p.period_year
           AND p2.period_month IS NOT DISTINCT FROM p.period_month
           AND coalesce(p2.payment_category, '') = coalesce(p.payment_category, '')
           AND coalesce(p2.child_id, p2.user_id, p2.unregistered_athlete_id)
             = coalesce(p.child_id, p.user_id, p.unregistered_athlete_id)
           AND p2.status IN ('pending','awaiting_approval','paid','partial','overdue','glosado'))
RETURNING p.id, p.status, p.amount, p.concept;

-- ── 2. Después ──────────────────────────────────────────────────────────────
SELECT id, status, amount, concept, rejection_reason, receipt_rejected_at, rejected_receipt_url IS NOT NULL AS comprobante_archivado
  FROM public.payments
 WHERE id IN ('fe08ee23-3a42-4e1b-abdf-cfa2e1b00dbd', 'acb637ea-d2ad-443b-883e-2addbc5c8f81');

-- Si todo cuadra:
-- COMMIT;
ROLLBACK;

-- ── Notas ───────────────────────────────────────────────────────────────────
-- · cc3baefe y bb3e532f quedan en 'rejected' como registro del comprobante
--   rechazado; la deuda vive en 21d2cdaf y 9b497ec5. No se cancelan los nuevos:
--   pueden tener avisos de cobro y enlaces /p/ ya enviados a la familia.
-- · Al pasar fe08ee23 a pending, el job de WhatsApp NO reenvía el aviso de
--   rechazo: su fila de la cola ya quedó con outcome_notified_at.
-- · acb637ea pasa a overdue: apply_late_fees puede cobrarle el recargo de mora si
--   la escuela lo tiene configurado (late_fee_applied_at está en NULL).
-- · Las filas 'rejected' de «Escuela Demo SportMaps» y «SOLO MILLOS LOKA» son de
--   prueba (13-ago) y no se tocan.
