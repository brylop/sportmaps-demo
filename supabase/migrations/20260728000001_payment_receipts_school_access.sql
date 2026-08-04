-- =========================================================================
-- Storage: permitir a la ESCUELA (admin/owner) leer los comprobantes de
--          pago de SUS payments — autorizando por DB (payments.school_id),
--          no por path.
-- =========================================================================
-- ⚠️ APLICACIÓN: crear policies sobre storage.objects desde el SQL Editor de
--    Supabase FALLA con "must be owner of relation objects" (la tabla la posee
--    supabase_storage_admin). Aplicar esta policy por Dashboard → Storage →
--    Policies (UI), o vía CLI/owner. Este archivo queda como referencia
--    versionada del contenido de la policy. (Ya aplicada por UI en prod.)
-- =========================================================================
-- Problema: los comprobantes se suben bajo la carpeta del PADRE
--   (payment-receipts/{parent_uid}/archivo.pdf). Las policies existentes de
--   storage.objects para 'payment-receipts' autorizan lectura por:
--     - path-based ownership (auth.uid() == folder[1] del name), y
--     - la del padre por DB (payments.parent_id = auth.uid(), mig 20260422000004).
--   Ninguna cubre a la ESCUELA: cuando el admin/owner abre el comprobante para
--   revisarlo/aprobarlo, la carpeta[1] es el UUID del padre (no suyo) → RLS
--   niega el SELECT → createSignedUrl falla → "no se ve el comprobante".
--
-- Fix: agregar policies que autoricen por DB usando el helper is_school_admin
--   (SECURITY DEFINER → no recursa RLS) + is_super_admin. Complementarias (OR)
--   con las viejas; no se tocan ni se dropean las históricas.
-- =========================================================================

-- La escuela puede leer los recibos de los payments de su escuela
DROP POLICY IF EXISTS "School can view school payment receipts via DB" ON storage.objects;
CREATE POLICY "School can view school payment receipts via DB"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND EXISTS (
    SELECT 1
    FROM public.payments p
    WHERE p.receipt_url = storage.objects.name
      AND (public.is_school_admin(p.school_id) OR public.is_super_admin())
  )
);

COMMENT ON POLICY "School can view school payment receipts via DB" ON storage.objects IS
  'Admin/owner de la escuela puede leer el comprobante si el payment pertenece a su escuela. Complementa las policies path-based y la del padre (20260422000004).';

-- Idem para cuotas/installments, si la tabla existe (no tracked, vive por
-- policies históricas en la DB — mismo patrón que 20260422000004).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payment_installments'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "School can view school installment receipts via DB" ON storage.objects';
    EXECUTE $policy$
      CREATE POLICY "School can view school installment receipts via DB"
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
            AND (public.is_school_admin(p.school_id) OR public.is_super_admin())
        )
      )
    $policy$;
  END IF;
END $$;
