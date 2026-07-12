-- ============================================================
-- SPORTMAPS — Módulo Contable · Fase 1 (comprobantes/adjuntos)
--
-- Permite adjuntar el soporte (factura/recibo PDF o imagen) a cada egreso,
-- para que el gasto quede auditable. Bucket privado + tabla puntero.
--
-- Path en Storage: {expense_id}/{filename}. Las policies de storage.objects
-- atan el acceso al dueño del gasto vía can_manage_finances(owner_type,owner_id),
-- así cualquier admin de la entidad (escuela/vendor/organizer) ve el soporte,
-- no solo quien lo subió.
-- ============================================================

-- 1. Tabla puntero -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expense_attachments (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id   uuid        NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
    storage_path text        NOT NULL,
    file_name    text        NOT NULL,
    mime_type    text,
    size_bytes   bigint,
    uploaded_by  uuid        NOT NULL REFERENCES auth.users(id),
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_attachments_expense ON public.expense_attachments (expense_id);

ALTER TABLE public.expense_attachments ENABLE ROW LEVEL SECURITY;

-- RLS: acceso si puedo gestionar las finanzas del dueño del gasto padre.
DROP POLICY IF EXISTS exp_att_all ON public.expense_attachments;
CREATE POLICY exp_att_all ON public.expense_attachments
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.expenses e
         WHERE e.id = expense_attachments.expense_id
           AND public.can_manage_finances(e.owner_type, e.owner_id)
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.expenses e
         WHERE e.id = expense_attachments.expense_id
           AND public.can_manage_finances(e.owner_type, e.owner_id)
    ));

GRANT SELECT, INSERT, DELETE ON public.expense_attachments TO authenticated;

-- 2. Bucket privado ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'accounting-receipts',
    'accounting-receipts',
    false,
    10485760,  -- 10 MB
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
   SET public             = EXCLUDED.public,
       file_size_limit    = EXCLUDED.file_size_limit,
       allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. Policies en storage.objects (path = {expense_id}/{filename}) --------------
-- El primer folder del path es el expense_id; se valida contra el dueño del gasto.
DROP POLICY IF EXISTS accounting_receipts_insert ON storage.objects;
CREATE POLICY accounting_receipts_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'accounting-receipts'
        AND EXISTS (
            SELECT 1 FROM public.expenses e
             WHERE e.id::text = (storage.foldername(name))[1]
               AND public.can_manage_finances(e.owner_type, e.owner_id)
        )
    );

DROP POLICY IF EXISTS accounting_receipts_read ON storage.objects;
CREATE POLICY accounting_receipts_read ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'accounting-receipts'
        AND EXISTS (
            SELECT 1 FROM public.expenses e
             WHERE e.id::text = (storage.foldername(name))[1]
               AND public.can_manage_finances(e.owner_type, e.owner_id)
        )
    );

DROP POLICY IF EXISTS accounting_receipts_delete ON storage.objects;
CREATE POLICY accounting_receipts_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'accounting-receipts'
        AND EXISTS (
            SELECT 1 FROM public.expenses e
             WHERE e.id::text = (storage.foldername(name))[1]
               AND public.can_manage_finances(e.owner_type, e.owner_id)
        )
    );

NOTIFY pgrst, 'reload config';
