-- =============================================================================
-- 20261013124655_wa_bandeja_autocierre_por_pago.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-13   Versión anterior: 20261010202857
-- Objetivo: que la «Bandeja de comprobantes» del canal de WhatsApp se cierre
--   sola cuando el pago al que apunta una fila se aprueba o se rechaza, por el
--   camino que sea (Pagos, conciliación, Wompi, RPCs, SQL).
-- =============================================================================
-- Por qué (medido en Dynasty el 2026-10-13): 206 filas abiertas en la bandeja y
-- 0 cerradas por la escuela. Las únicas que se cerraban solas eran las
-- `ya_registrado`, y solo cuando alguien abría la pestaña (barrido en el BFF).
-- Una fila que pedía decidir («varios cobros», «monto distinto»…) seguía
-- abierta aunque la escuela ya hubiera aprobado ese comprobante en Pagos.
--
-- El BFF ya hace el mismo cierre al leer la bandeja (filasParaAutocierrePorDecision,
-- bff/src/services/whatsapp-bandeja.service.ts). Este trigger lo hace en el
-- momento de la decisión, para que el contador del correo diario y del Resumen
-- no dependa de que alguien abra la pantalla.
--
-- Enlace fila → pago (nunca «la familia tiene algún pago aprobado»):
--   · whatsapp_inbound_queue.result_ref_id = payments.id
--   · pregunta_ocr->>'sha'              = payments.receipt_image_sha256
--   · pregunta_ocr->'ocr'->>'reference' = payments.ocr_reference / receipt_reference_norm
-- y solo si la decisión es POSTERIOR a la llegada de la fila (5 min de margen).
--
-- Decisión:
--   · aprobado  → status pasa a 'paid'/'approved'/'completed'
--   · rechazado → receipt_rejected_at cambia (reject_payment_receipt devuelve el
--                 cobro a pending/overdue) o status pasa a 'rejected'
--
-- Formato del cierre: el mismo que escribe el BFF (prefijo `cerrado_escuela:`
-- en error_message, motivo original tras « | »), así la pantalla y las métricas
-- lo leen igual. NO toca payments ni bloquea su UPDATE: cualquier error del
-- trigger se traga con un WARNING.
--
-- NO APLICADA. Aplicar por CLI de Supabase o apply_migration (deja rastro).
-- Antes, correr el SELECT de verificación del final contra la base.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.wa_bandeja_cerrar_por_pago()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_decision text;
    v_cuando   timestamptz;
    v_motivo   text;
BEGIN
    IF NEW.status IN ('paid', 'approved', 'completed')
       AND OLD.status IS DISTINCT FROM NEW.status THEN
        v_decision := 'aprobado';
        v_cuando   := COALESCE(NEW.approved_at, now());
    ELSIF NEW.receipt_rejected_at IS NOT NULL
       AND NEW.receipt_rejected_at IS DISTINCT FROM OLD.receipt_rejected_at THEN
        v_decision := 'rechazado';
        v_cuando   := NEW.receipt_rejected_at;
    ELSIF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM NEW.status THEN
        v_decision := 'rechazado';
        v_cuando   := now();
    ELSE
        RETURN NEW;
    END IF;

    v_motivo := CASE v_decision
        WHEN 'aprobado'  THEN 'el pago se aprobó (' || NEW.status || ': ' || left(COALESCE(NEW.concept, ''), 80) || ')'
        ELSE 'el comprobante se rechazó en Pagos (' || left(COALESCE(NEW.concept, ''), 80) || ')'
    END;
    v_motivo := replace(v_motivo, '|', '/');

    BEGIN
        UPDATE public.whatsapp_inbound_queue q
           SET status        = 'ignored',
               locked_until  = NULL,
               error_message = left('cerrado_escuela: resuelto_auto — ' || v_motivo || ' | '
                                    || COALESCE(q.error_message, ''), 1000),
               updated_at    = now()
         WHERE q.school_id = NEW.school_id
           AND q.status IN ('failed', 'ignored', 'waiting_user')
           AND COALESCE(q.error_message, '') NOT LIKE 'cerrado_escuela:%'
           -- `ya_registrado` lo cierra su propio barrido (otra regla).
           AND COALESCE(q.error_message, '') NOT LIKE 'recuperado: ya_registrado%'
           AND COALESCE(q.error_message, '') NOT LIKE 'referencia ya usada%'
           AND q.created_at <= v_cuando + interval '5 minutes'
           AND (
                q.result_ref_id = NEW.id
             OR (NEW.receipt_image_sha256 IS NOT NULL AND q.pregunta_ocr->>'sha' = NEW.receipt_image_sha256)
             OR (NEW.ocr_reference IS NOT NULL AND q.pregunta_ocr->'ocr'->>'reference' = NEW.ocr_reference)
             OR (NEW.receipt_reference_norm IS NOT NULL AND q.pregunta_ocr->'ocr'->>'reference' = NEW.receipt_reference_norm)
           );
    EXCEPTION WHEN OTHERS THEN
        -- La bandeja nunca puede trabar la aprobación de un pago.
        RAISE WARNING 'wa_bandeja_cerrar_por_pago: % (pago %)', SQLERRM, NEW.id;
    END;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.wa_bandeja_cerrar_por_pago() IS
    'Trigger: cierra (resuelto_auto) las filas abiertas de la Bandeja de comprobantes de WhatsApp '
    'enlazadas a un pago cuando ese pago se aprueba o su comprobante se rechaza. No toca payments.';

-- Función de trigger: nadie la llama como RPC. Los default privileges del
-- esquema le darían EXECUTE a authenticated/anon (trampa 3 de CLAUDE.md).
REVOKE ALL ON FUNCTION public.wa_bandeja_cerrar_por_pago() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wa_bandeja_cerrar_por_pago() FROM anon;
REVOKE ALL ON FUNCTION public.wa_bandeja_cerrar_por_pago() FROM authenticated;

DROP TRIGGER IF EXISTS trg_wa_bandeja_cerrar_por_pago ON public.payments;
CREATE TRIGGER trg_wa_bandeja_cerrar_por_pago
    AFTER UPDATE OF status, receipt_rejected_at ON public.payments
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status
          OR OLD.receipt_rejected_at IS DISTINCT FROM NEW.receipt_rejected_at)
    EXECUTE FUNCTION public.wa_bandeja_cerrar_por_pago();

COMMIT;

-- Verificación (después de aplicar):
--   select tgname from pg_trigger where tgrelid = 'public.payments'::regclass
--      and tgname = 'trg_wa_bandeja_cerrar_por_pago';
--   select proconfig from pg_proc where proname = 'wa_bandeja_cerrar_por_pago';  -- search_path fijo (I4)
--   npm run seguridad:invariantes
