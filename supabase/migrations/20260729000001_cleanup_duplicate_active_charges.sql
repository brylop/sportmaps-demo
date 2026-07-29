-- ============================================================
-- SPORTMAPS — Limpieza de cobros ACTIVOS duplicados (arrastre histórico)
-- ------------------------------------------------------------
-- Cierra el arrastre de duplicados detectado antes de la Fase A (cobro único
-- equipo+plan) y del fix de avance de meses. Es DINERO: solo cancela casos
-- inequívocos y nunca toca pagados / con comprobante / en validación.
--
-- Dos limpiezas conservadoras:
--   A) Duplicados EXACTOS: mismo atleta + mismo concepto + mismo monto + mismo
--      estado (pending/overdue) sin comprobante → conserva el más antiguo,
--      cancela los demás (re-corridas del generador).
--   B) Meses FUTUROS por el bug de avance: cobro con período > mes actual,
--      sin comprobante, cuando el atleta ya tiene otro cobro impago del mes
--      actual o pasado → cancela el futuro (conserva el vigente).
--
-- 'cancelled' es reversible (no borra). Migración nueva (timestamp posterior).
-- Fecha: 2026-07-29
-- ============================================================

BEGIN;

-- ── A) Duplicados exactos (concepto + monto + estado) ───────────────────────
WITH dups AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY child_id, concept, amount, status
           ORDER BY created_at
         ) AS rn
    FROM public.payments
   WHERE child_id IS NOT NULL
     AND status IN ('pending', 'overdue')
     AND COALESCE(receipt_url, '') = ''
     AND payment_date IS NULL
)
UPDATE public.payments p
   SET status = 'cancelled', updated_at = now()
  FROM dups
 WHERE p.id = dups.id
   AND dups.rn > 1;

-- ── B) Meses futuros apilados por el avance de next_unpaid_period ───────────
UPDATE public.payments p
   SET status = 'cancelled', updated_at = now()
 WHERE p.child_id IS NOT NULL
   AND p.status IN ('pending', 'overdue')
   AND COALESCE(p.receipt_url, '') = ''
   AND p.payment_date IS NULL
   AND p.period_year  IS NOT NULL
   AND p.period_month IS NOT NULL
   AND make_date(p.period_year::int, p.period_month::int, 1)
       > date_trunc('month', CURRENT_DATE)::date
   AND EXISTS (
        SELECT 1 FROM public.payments q
         WHERE q.child_id = p.child_id
           AND q.school_id = p.school_id
           AND q.id <> p.id
           AND q.status IN ('pending', 'overdue', 'awaiting_approval', 'paid', 'partial')
           AND make_date(
                 COALESCE(q.period_year,  EXTRACT(YEAR  FROM q.due_date))::int,
                 COALESCE(q.period_month, EXTRACT(MONTH FROM q.due_date))::int, 1)
               <= date_trunc('month', CURRENT_DATE)::date
   );

COMMIT;
