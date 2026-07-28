-- ============================================================
-- SPORTMAPS — Comprobantes v2, Fase 2: persistencia de veredicto (MODO SOMBRA)
-- Spec: docs/specs/receipt-extraction-v2-glosas.md (§2, §3 modo sombra, §5.4)
-- ------------------------------------------------------------
-- El LLM SOLO extrae; las reglas (bff/src/services/receipt-verdict.ts) deciden
-- un veredicto verde|amarillo|rojo. Esta migración agrega las columnas para
-- PERSISTIR ese veredicto + los campos nuevos del schema v2 + hash/reference_norm
-- de dedup, sin cambiar ninguna decisión ni estado (modo sombra: se guarda y se
-- muestra, el admin sigue aprobando manual).
--
-- Solo columnas + índices + comentarios. Sin funciones (sin search_path), sin
-- cambios de RLS (las columnas heredan la RLS de payments/school_settings). NO
-- agrega estados a payments.status (eso es Fase 3+).
-- Fecha: 2026-07-17
-- ============================================================

-- ── payments: campos extraídos nuevos (schema v2) ──────────────────────────
ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS ocr_destination      text,
    ADD COLUMN IF NOT EXISTS ocr_destination_name text,
    ADD COLUMN IF NOT EXISTS ocr_origin_name      text,
    ADD COLUMN IF NOT EXISTS ocr_time             text;

COMMENT ON COLUMN public.payments.ocr_destination      IS 'Cuenta/celular/llave DESTINO extraída del comprobante (a quién le llegó la plata).';
COMMENT ON COLUMN public.payments.ocr_destination_name IS 'Nombre del titular destino (etiqueta "Para"). Señal informativa.';
COMMENT ON COLUMN public.payments.ocr_origin_name      IS 'Nombre de quien envía, extraído del comprobante.';
COMMENT ON COLUMN public.payments.ocr_time             IS 'Hora HH:MM extraída del comprobante.';

-- ── payments: veredicto persistido (modo sombra) ───────────────────────────
ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS receipt_verdict            text
        CHECK (receipt_verdict IN ('verde', 'amarillo', 'rojo')),
    ADD COLUMN IF NOT EXISTS receipt_verdict_reasons    jsonb,
    ADD COLUMN IF NOT EXISTS receipt_reference_norm     text,
    ADD COLUMN IF NOT EXISTS receipt_image_sha256       text,
    ADD COLUMN IF NOT EXISTS receipt_image_sha256_source text
        CHECK (receipt_image_sha256_source IN ('client_original', 'server_base64')),
    ADD COLUMN IF NOT EXISTS receipt_verdict_at         timestamptz;

COMMENT ON COLUMN public.payments.receipt_verdict         IS 'Veredicto determinístico del comprobante (verde|amarillo|rojo). Computado por reglas, NO por el LLM. Modo sombra: informativo.';
COMMENT ON COLUMN public.payments.receipt_verdict_reasons IS 'Array jsonb de razones {check, code, level, message, detail} que produjeron el veredicto.';
COMMENT ON COLUMN public.payments.receipt_reference_norm  IS 'Referencia normalizada (mayúsculas, sin espacios/guiones) para dedup. En Fase 5 respalda un índice único.';
COMMENT ON COLUMN public.payments.receipt_image_sha256    IS 'SHA-256 de la imagen del comprobante para dedup de re-subida.';
COMMENT ON COLUMN public.payments.receipt_image_sha256_source IS 'Origen del hash: client_original (File antes de PDF→PNG) | server_base64 (fallback BFF). Para calibrar dedup en sombra.';
COMMENT ON COLUMN public.payments.receipt_verdict_at      IS 'Timestamp en que se computó el veredicto.';

-- ── Índices de dedup ───────────────────────────────────────────────────────
-- Hash de imagen: ÚNICO parcial. El filtro de status es CRÍTICO (spec §5.4):
-- un pago rechazado/cancelado/fallido NO debe bloquear que el papá vuelva a subir
-- el MISMO comprobante legítimo en un pago nuevo (p.ej. rechazo por concepto/mes
-- equivocado, no por la imagen). Al pasar a esos estados la fila sale del índice
-- y libera el hash.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_school_receipt_hash
    ON public.payments (school_id, receipt_image_sha256)
    WHERE receipt_image_sha256 IS NOT NULL
      AND status NOT IN ('rejected', 'cancelled', 'failed');

COMMENT ON INDEX public.uq_payments_school_receipt_hash IS
    'Evita re-subir la misma imagen de comprobante. Parcial por status: los pagos rechazados/cancelados/fallidos no bloquean un reintento legítimo.';

-- Reference normalizada: NO-única en Fase 2 (solo lookup rápido para el check de
-- dedup del BFF). La versión ÚNICA (school_id, ocr_bank, reference_norm) se
-- promueve en Fase 5 tras calibrar en sombra. El índice único crudo existente
-- uq_payments_school_ocr_reference sigue siendo el guard vivo de referencias.
CREATE INDEX IF NOT EXISTS idx_payments_school_reference_norm
    ON public.payments (school_id, receipt_reference_norm)
    WHERE receipt_reference_norm IS NOT NULL;

-- Listar comprobantes por veredicto en el panel (badge de sombra).
CREATE INDEX IF NOT EXISTS idx_payments_receipt_verdict
    ON public.payments (school_id, receipt_verdict)
    WHERE receipt_verdict IS NOT NULL;

-- ── school_settings: config de la ventana + toggles de auto-aprobación ─────
-- auto_approve_enabled arranca en false = modo sombra por defecto (spec §3).
ALTER TABLE public.school_settings
    ADD COLUMN IF NOT EXISTS receipt_date_window_days int     NOT NULL DEFAULT 5
        CHECK (receipt_date_window_days >= 0),
    ADD COLUMN IF NOT EXISTS auto_approve_enabled     boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS auto_approve_max_amount  numeric NOT NULL DEFAULT 0
        CHECK (auto_approve_max_amount >= 0);

COMMENT ON COLUMN public.school_settings.receipt_date_window_days IS 'Días hacia atrás permitidos para la fecha del comprobante (check 6). Default 5.';
COMMENT ON COLUMN public.school_settings.auto_approve_enabled     IS 'Si false (default) = MODO SOMBRA: se guarda el veredicto pero NO se auto-aprueba nada. Se activa en Fase 5.';
COMMENT ON COLUMN public.school_settings.auto_approve_max_amount  IS 'Tope de monto para auto-aprobar un comprobante VERDE. 0 = sin auto-aprobación aunque el toggle esté ON.';

NOTIFY pgrst, 'reload schema';