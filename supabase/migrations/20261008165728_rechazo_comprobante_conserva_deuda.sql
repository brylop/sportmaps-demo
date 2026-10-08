-- ============================================================================
-- Rechazar un COMPROBANTE no borra la DEUDA + cola de revisión con alertas
-- ============================================================================
--
-- El bug (medido 2026-10-08, Dynasty):
--   «Rechazar» en Gestión de pagos hacía `update payments set status='rejected'`
--   sobre el PROPIO COBRO, sin `rejection_reason`. El cobro salía de la cartera
--   (pending/overdue), del motor de mora y del estado de cuenta: la deuda dejaba
--   de existir. Tres mensualidades de octubre ($540.000) quedaron así; dos las
--   «recreó» el generador nocturno con un cobro nuevo (perdiendo el rastro del
--   comprobante) y la tercera seguía sin cobro. La familia recibía «no pudo ser
--   validado. Contáctanos» sin saber qué corregir.
--
-- El modelo correcto: lo que se rechaza es el INTENTO (el comprobante), no la
-- FACTURA (el cobro). Mismo principio que record_payment_failure para la
-- pasarela. Tras el rechazo:
--   · el cobro vuelve a pending / overdue (o partial si ya tenía abonos),
--   · el comprobante queda archivado en `rejected_receipt_url` (sale de la cola),
--   · el motivo queda en `rejection_reason` (texto para la familia) y su código
--     en `receipt_rejection_code`,
--   · `receipt_rejected_at` es la marca que el job de WhatsApp usa para contarle
--     el desenlace a la familia (el estado ya no es 'rejected').
--
-- Además, para la cola de aprobación:
--   · `receipt_submitted_at`: cuándo entró el comprobante (lo estampa un trigger
--     al pasar a awaiting_approval). Ordena la cola y mide la espera.
--   · `school_receipt_review_alerts`: estado por escuela del aviso de
--     «comprobante nuevo» y del recordatorio de >2 h, con versión optimista para
--     que los 3 BFF (que comparten esta base) no avisen tres veces.
--
-- NO aplica nada sobre datos existentes salvo el backfill de
-- `receipt_submitted_at` de los comprobantes que hoy están por validar.
-- Los rechazos ya hechos se corrigen aparte, con el SQL propuesto en
-- docs/migraciones-para-aplicar-2026-10-08/.
-- ============================================================================

-- ── 1. Columnas ─────────────────────────────────────────────────────────────
ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS receipt_submitted_at   timestamptz,
    ADD COLUMN IF NOT EXISTS receipt_rejected_at    timestamptz,
    ADD COLUMN IF NOT EXISTS receipt_rejected_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS receipt_rejection_code text,
    ADD COLUMN IF NOT EXISTS rejected_receipt_url   text;

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_receipt_rejection_code_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_receipt_rejection_code_check CHECK (
    receipt_rejection_code IS NULL OR receipt_rejection_code IN (
        'NOT_A_RECEIPT', 'IS_TRANSACTION_LIST', 'DESTINO_NO_COINCIDE', 'MONTO_NO_COINCIDE',
        'ILEGIBLE', 'REFERENCIA_DUPLICADA', 'FECHA_FUERA_DE_RANGO', 'OTRO', 'AUTOMATICO'
    )
);

COMMENT ON COLUMN public.payments.receipt_submitted_at IS
    'Cuándo entró el comprobante que está por validar (trigger al pasar a awaiting_approval). NULL fuera de revisión.';
COMMENT ON COLUMN public.payments.receipt_rejected_at IS
    'Último rechazo del COMPROBANTE (el cobro sigue vivo). Solo lo escribe reject_payment_receipt().';
COMMENT ON COLUMN public.payments.rejected_receipt_url IS
    'Ruta del último comprobante rechazado, archivado fuera de receipt_url para que el cobro salga de la cola.';

-- Índice para la cola: comprobantes por validar ordenados por antigüedad.
CREATE INDEX IF NOT EXISTS idx_payments_awaiting_submitted
    ON public.payments (school_id, receipt_submitted_at)
    WHERE status = 'awaiting_approval';

-- ── 2. Trigger: estampa la entrada y blinda las columnas del rechazo ─────────
CREATE OR REPLACE FUNCTION public.fn_payments_receipt_review_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_cliente boolean := current_user IN ('authenticated', 'anon');
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF v_cliente THEN
            NEW.receipt_rejected_at    := NULL;
            NEW.receipt_rejected_by    := NULL;
            NEW.receipt_rejection_code := NULL;
            NEW.rejected_receipt_url   := NULL;
        END IF;
        IF NEW.status = 'awaiting_approval' THEN
            NEW.receipt_submitted_at := now();
        ELSIF v_cliente THEN
            NEW.receipt_submitted_at := NULL;
        END IF;
        RETURN NEW;
    END IF;

    -- UPDATE desde el navegador: estas columnas solo las escribe el sistema.
    IF v_cliente THEN
        NEW.receipt_submitted_at   := OLD.receipt_submitted_at;
        NEW.receipt_rejected_at    := OLD.receipt_rejected_at;
        NEW.receipt_rejected_by    := OLD.receipt_rejected_by;
        NEW.receipt_rejection_code := OLD.receipt_rejection_code;
        NEW.rejected_receipt_url   := OLD.rejected_receipt_url;
    END IF;

    -- Entra un comprobante (desde cualquier camino: app, bot, importador).
    IF NEW.status = 'awaiting_approval' AND OLD.status IS DISTINCT FROM 'awaiting_approval' THEN
        NEW.receipt_submitted_at := now();
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_payments_receipt_review_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_payments_receipt_review_columns ON public.payments;
CREATE TRIGGER trg_payments_receipt_review_columns
    BEFORE INSERT OR UPDATE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.fn_payments_receipt_review_columns();

-- Backfill: los que HOY están por validar. La entrada sale del log de estados
-- (payment_audit_logs); si no hay (el cobro nació en awaiting_approval), el
-- veredicto o la creación.
UPDATE public.payments p
   SET receipt_submitted_at = COALESCE(
           (SELECT max(l.created_at)
              FROM public.payment_audit_logs l
             WHERE l.payment_id = p.id
               AND l.new_status = 'awaiting_approval'),
           p.receipt_verdict_at,
           p.created_at)
 WHERE p.status = 'awaiting_approval'
   AND p.receipt_submitted_at IS NULL;

-- ── 3. RPC: rechazar el comprobante, conservar el cobro ─────────────────────
CREATE OR REPLACE FUNCTION public.reject_payment_receipt(
    p_payment_id  uuid,
    p_reason_code text,
    p_reason_text text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_uid     uuid := auth.uid();
    v_sistema boolean := (auth.role() = 'service_role');
    v_code    text := upper(btrim(coalesce(p_reason_code, '')));
    v_detalle text := nullif(btrim(coalesce(p_reason_text, '')), '');
    v_previo  text;
    v_p       public.payments%ROWTYPE;
    v_label   text;
    v_motivo  text;
    v_estado  text;
    v_dest    uuid;
    v_monto   text;
BEGIN
    IF v_code NOT IN ('NOT_A_RECEIPT', 'IS_TRANSACTION_LIST', 'DESTINO_NO_COINCIDE', 'MONTO_NO_COINCIDE',
                      'ILEGIBLE', 'REFERENCIA_DUPLICADA', 'FECHA_FUERA_DE_RANGO', 'OTRO', 'AUTOMATICO') THEN
        RAISE EXCEPTION 'REJECT_REASON_INVALID' USING ERRCODE = '22023',
            HINT = 'Elige un motivo de rechazo.';
    END IF;
    IF v_code IN ('OTRO', 'AUTOMATICO') AND v_detalle IS NULL THEN
        RAISE EXCEPTION 'REJECT_REASON_REQUIRED' USING ERRCODE = '22023',
            HINT = 'Escribe el motivo del rechazo.';
    END IF;
    IF v_code = 'AUTOMATICO' AND NOT v_sistema THEN
        RAISE EXCEPTION 'REJECT_REASON_INVALID' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_p FROM public.payments WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PAYMENT_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    -- Rechazar un pago es una decisión de administración (dueño/admin), igual
    -- que aprobarlo. El BFF entra como service_role (rechazo automático).
    IF NOT v_sistema THEN
        IF v_uid IS NULL THEN
            RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
        END IF;
        IF NOT (v_p.school_id = ANY (public.user_admin_school_ids()) OR public.is_super_admin()) THEN
            RAISE EXCEPTION 'PAYMENT_FORBIDDEN' USING ERRCODE = '42501';
        END IF;
    END IF;

    -- Solo se rechaza un comprobante EN REVISIÓN. Un cobro pagado no se
    -- «rechaza» (si tiene factura, nota crédito).
    IF NOT (v_p.status = 'awaiting_approval'
            OR (v_p.status IN ('pending', 'overdue') AND v_p.receipt_url IS NOT NULL)) THEN
        RAISE EXCEPTION 'PAYMENT_NOT_IN_REVIEW' USING ERRCODE = '55000',
            HINT = 'Este cobro ya no tiene un comprobante en revisión.';
    END IF;

    v_label := CASE v_code
        WHEN 'NOT_A_RECEIPT'        THEN 'El archivo no es el comprobante de la transferencia (parece el código QR o los datos para pagar).'
        WHEN 'IS_TRANSACTION_LIST'  THEN 'Es una lista de movimientos, no el comprobante de un pago.'
        WHEN 'DESTINO_NO_COINCIDE'  THEN 'La cuenta de destino no es de la escuela.'
        WHEN 'MONTO_NO_COINCIDE'    THEN 'El valor del comprobante no coincide con el cobro.'
        WHEN 'ILEGIBLE'             THEN 'No se alcanza a leer el comprobante.'
        WHEN 'REFERENCIA_DUPLICADA' THEN 'Ese comprobante ya se había usado para otro pago.'
        WHEN 'FECHA_FUERA_DE_RANGO' THEN 'La fecha del comprobante no corresponde a este pago.'
        ELSE NULL
    END;
    v_motivo := left(CASE
        WHEN v_label IS NULL    THEN v_detalle
        WHEN v_detalle IS NULL  THEN v_label
        ELSE v_label || ' ' || v_detalle
    END, 500);

    -- La deuda sigue. Con abonos previos → partial. Si no, el estado que tenía
    -- ANTES de entrar el comprobante (pending u overdue, del log de estados).
    -- Sin rastro → pending, y apply_late_fees lo vuelve a marcar overdue con
    -- sus propias reglas de gracia (mismo criterio que resolve_glosa).
    SELECT l.old_status INTO v_previo
      FROM public.payment_audit_logs l
     WHERE l.payment_id = v_p.id
       AND l.new_status = 'awaiting_approval'
     ORDER BY l.created_at DESC
     LIMIT 1;
    v_estado := CASE
        WHEN coalesce(v_p.amount_paid, 0) > 0          THEN 'partial'
        WHEN v_p.status IN ('pending', 'overdue')      THEN v_p.status
        WHEN v_previo IN ('pending', 'overdue')        THEN v_previo
        ELSE 'pending'
    END;

    UPDATE public.payments
       SET status                      = v_estado,
           rejection_reason            = v_motivo,
           receipt_rejection_code      = v_code,
           receipt_rejected_at         = now(),
           receipt_rejected_by         = v_uid,
           rejected_receipt_url        = coalesce(v_p.receipt_url, v_p.rejected_receipt_url),
           receipt_url                 = NULL,
           receipt_submitted_at        = NULL,
           -- payment_date es el día en que la escuela APRUEBA; el que estampó
           -- el comprobante no es una fecha de pago. En un abono se conserva.
           payment_date                = CASE WHEN v_estado = 'partial' THEN v_p.payment_date ELSE NULL END,
           -- Liberan el hash y la referencia: el índice único de hash excluía
           -- los 'rejected' para no castigar un reintento legítimo; con el cobro
           -- vivo hay que soltarlos a mano. El comprobante queda en
           -- rejected_receipt_url y la fila completa en el audit log.
           receipt_image_sha256        = NULL,
           receipt_image_sha256_source = NULL,
           ocr_reference               = NULL
     WHERE id = v_p.id;

    -- Aviso in-app (y push, por el outbox) a quien paga, con el motivo.
    v_dest := coalesce(v_p.parent_id, v_p.user_id);
    IF v_dest IS NOT NULL THEN
        v_monto := '$' || replace(to_char(round(v_p.amount), 'FM999,999,999,990'), ',', '.');
        INSERT INTO public.notifications (user_id, school_id, title, message, type, link, category)
        VALUES (
            v_dest, v_p.school_id,
            'Comprobante no aprobado',
            left(format('Tu comprobante de %s por %s no fue aprobado: %s El cobro sigue pendiente; sube el comprobante correcto desde Mis pagos o por WhatsApp.',
                   v_monto, coalesce(v_p.concept, 'el cobro'), v_motivo), 1000),
            'error', '/my-payments', 'payment'
        );
    END IF;

    RETURN jsonb_build_object(
        'payment_id',       v_p.id,
        'status',           v_estado,
        'rejection_reason', v_motivo,
        'rejection_code',   v_code
    );
END;
$$;

REVOKE ALL ON FUNCTION public.reject_payment_receipt(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reject_payment_receipt(uuid, text, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.reject_payment_receipt(uuid, text, text) IS
    'Rechaza el COMPROBANTE de un cobro en revisión con motivo obligatorio. El cobro vuelve a pending/overdue/partial (la deuda sigue). Dueño/admin de la escuela o service_role.';

-- ── 4. Estado de las alertas de la cola (solo el BFF) ──────────────────────
CREATE TABLE IF NOT EXISTS public.school_receipt_review_alerts (
    school_id         uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
    -- Hasta qué receipt_submitted_at ya se avisó como «nuevo».
    new_cursor        timestamptz NOT NULL DEFAULT now(),
    last_new_alert_at timestamptz,
    last_reminder_at  timestamptz,
    -- Versión optimista: cada aviso hace UPDATE … WHERE version = leída.
    version           integer NOT NULL DEFAULT 0,
    updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.school_receipt_review_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.school_receipt_review_alerts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.school_receipt_review_alerts TO service_role;

COMMENT ON TABLE public.school_receipt_review_alerts IS
    'Estado por escuela de los avisos de comprobantes por validar (nuevo / recordatorio >2 h). Lo escribe solo el BFF (job receipt-review-alerts).';
