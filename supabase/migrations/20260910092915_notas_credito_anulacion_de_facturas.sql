-- =============================================================================
-- 20260910092915_notas_credito_anulacion_de_facturas.sql
-- Autor: brylop   Fecha: 2026-09-10   Versión anterior: 20260910082720
-- Objetivo: dejar RASTRO de la anulación de una factura electrónica.
--
-- El CHECK de electronic_invoices.status YA acepta 'void' desde la migración
-- original (20260708000001), pero no había NINGUNA columna donde anotar quién
-- anuló, cuándo, por qué, ni con qué nota crédito. Sin eso, una factura anulada
-- queda indistinguible de una factura que nunca salió: el número sigue
-- consumido ante la DIAN, la nota crédito existe en otra fila, y nada las une.
--
-- La fila anulada NUNCA se borra: un documento con CUFE existe ante la DIAN
-- para siempre y esa fila es la única prueba de nuestro lado de que existió.
-- Por eso esto agrega columnas y no toca ni una fila.
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

-- Cuándo se anuló. Deliberadamente separado de updated_at, que lo mueve
-- cualquier barrido de reconciliación.
ALTER TABLE public.electronic_invoices
    ADD COLUMN IF NOT EXISTS voided_at timestamptz;

-- Por qué. Lo escribe el operador al anular y viaja además al `observation` de
-- la nota crédito, que es la copia que sobrevive del lado del PAC.
ALTER TABLE public.electronic_invoices
    ADD COLUMN IF NOT EXISTS void_reason text;

-- Quién. FK a profiles y no a auth.users, por la convención del repo. ON DELETE
-- SET NULL: si el perfil desaparece la anulación sigue siendo un hecho fiscal y
-- no puede irse con él.
ALTER TABLE public.electronic_invoices
    ADD COLUMN IF NOT EXISTS voided_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Con qué nota crédito. Apunta a la OTRA fila de esta misma tabla, la que tiene
-- document_type='credit_note'. Es el único enlace explícito entre las dos: sin
-- él sólo quedaba deducirlo por payment_id compartido, que se rompe en cuanto
-- un pago tiene más de un intento de facturación (que es justamente lo que
-- habilita la anulación).
--
-- NULL con status='void' es un estado LEGÍTIMO y esperado, no un dato faltante:
-- es el descarte local de una factura que nunca llegó a la DIAN (rechazo
-- terminal del PAC, sin número ni CUFE). Ahí no hay ni debe haber nota crédito
-- —emitirla quemaría un número de la resolución para anular algo que no
-- existe—, así que la columna NO puede ser NOT NULL ni tener un CHECK que la
-- exija cuando el estado es 'void'.
ALTER TABLE public.electronic_invoices
    ADD COLUMN IF NOT EXISTS voided_by_invoice_id uuid
        REFERENCES public.electronic_invoices(id) ON DELETE SET NULL;

-- Camino inverso (¿esta nota crédito a qué factura anuló?): se resuelve por
-- este índice en vez de duplicar la columna en la otra dirección, que sería un
-- segundo lugar donde el dato puede quedar desincronizado.
CREATE INDEX IF NOT EXISTS ix_einvoices_voided_by
    ON public.electronic_invoices (voided_by_invoice_id)
    WHERE voided_by_invoice_id IS NOT NULL;

COMMENT ON COLUMN public.electronic_invoices.voided_at IS
    'Momento de la anulación. status=''void'' sin voided_at = anulada por un camino anterior a esta migración.';
COMMENT ON COLUMN public.electronic_invoices.voided_by_invoice_id IS
    'Fila (document_type=''credit_note'') que anuló esta factura. NULL con status=''void'' = descarte local: la factura nunca llegó a la DIAN y no hay nota crédito que emitir.';

COMMIT;
