-- =========================================================================
-- Storage: permitir al parent_id actual de un payment leer su receipt
-- =========================================================================
-- Problema: la RLS de storage.objects para 'payment-receipts' solo permitia
-- lectura por "path-based ownership" (auth.uid() == folder[1] del nombre)
-- o por ser staff de la escuela. Cuando un payment se reasigna a otro
-- parent_id (p.ej. merge de cuentas duplicadas), el nuevo parent no puede
-- leer su propio recibo porque el path contiene el UUID del parent anterior.
--
-- Fix: agregar 2 policies que autorizan por DB (payments.parent_id) en vez
-- de por path. Dejamos las policies viejas intactas — son complementarias
-- (OR), no conflictivas.
-- =========================================================================


-- Parent puede leer receipts de sus propios payments
DROP POLICY IF EXISTS "Parents can view own payment receipts via DB" ON storage.objects;
CREATE POLICY "Parents can view own payment receipts via DB"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND EXISTS (
    SELECT 1
    FROM public.payments p
    WHERE p.receipt_url = storage.objects.name
      AND p.parent_id   = auth.uid()
  )
);


-- Parent puede leer receipts de cuotas/installments de sus propios payments
-- (solo si existe la tabla payment_installments; no esta tracked en migrations
--  pero existe en la DB via policies historicas)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payment_installments'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Parents can view own installment receipts via DB" ON storage.objects';
    EXECUTE $policy$
      CREATE POLICY "Parents can view own installment receipts via DB"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'payment-receipts'
        AND EXISTS (
          SELECT 1
          FROM public.payment_installments pi
          JOIN public.payments            p  ON p.id = pi.payment_id
          WHERE pi.receipt_url = storage.objects.name
            AND p.parent_id    = auth.uid()
        )
      )
    $policy$;
  END IF;
END $$;


COMMENT ON POLICY "Parents can view own payment receipts via DB" ON storage.objects IS
  'Parent autenticado puede leer el recibo si es el parent_id actual del payment. Complementa la policy path-based para soportar reasignacion de ownership.';

COMMENT ON POLICY "Parents can view own installment receipts via DB" ON storage.objects IS
  'Parent autenticado puede leer el recibo de la cuota si es el parent_id actual del payment padre.';
