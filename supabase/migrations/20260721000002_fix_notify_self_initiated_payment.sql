-- ============================================================
-- SPORTMAPS — Fix: no notificar "Nuevo cobro pendiente" en pagos
--                 iniciados por el propio acudiente (checkout online).
-- ------------------------------------------------------------
-- El trigger `trg_notify_on_payment_created` (AFTER INSERT ON payments
-- WHEN status='pending') dispara `fn_notify_on_payment_created()`, que
-- notifica al acudiente "La escuela ha generado un cobro de $X…".
--
-- Bug: cuando el acudiente da "Pagar online", su propio checkout inserta
-- una fila `pending` para entregarla a la pasarela (Wompi/MP). Esa fila
-- SÍ cumple status='pending' → el trigger le notifica como si la escuela
-- le hubiera generado un cobro nuevo, en CADA clic en Pagar.
--
-- Discriminador (verificado en el repo):
--   · Escuela / cron `auto_generate_monthly_charges` / QR `qr_pay_monthly`
--     crean el cobro pending SIN `provider_reference`  → notif legítima.
--   · El checkout del acudiente (PaymentCheckoutModal) inserta el pending
--     CON `provider_reference` = 'SCH-WOMPI-…' / 'SCH-MP-…'  → NO notificar.
--
-- Fix: `RETURN NEW` temprano cuando NEW.provider_reference IS NOT NULL.
-- Se preserva el cuerpo original tal cual; solo se agrega el guard y se
-- normaliza el search_path a la convención del repo.
-- Fecha: 2026-07-21
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_notify_on_payment_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_user_id   uuid;
  v_name      text;
  v_school    text;
  v_amount    text;
BEGIN
  -- Guard: pagos iniciados por el propio pagador (checkout online) llegan
  -- con provider_reference seteado. Eso NO es "la escuela generó un cobro";
  -- es el acudiente pagando. No notificar (si no, cada clic en Pagar avisa).
  IF NEW.provider_reference IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Resolver el user_id del destinatario según tipo de atleta
  IF NEW.user_id IS NOT NULL THEN
    -- Atleta adulto con cuenta
    v_user_id := NEW.user_id;
    SELECT full_name INTO v_name FROM profiles WHERE id = NEW.user_id;

  ELSIF NEW.child_id IS NOT NULL THEN
    -- Menor → notificar al padre/acudiente si está vinculado
    SELECT parent_id INTO v_user_id FROM children WHERE id = NEW.child_id;
    SELECT full_name INTO v_name FROM children WHERE id = NEW.child_id;

  ELSE
    -- Adulto sin cuenta — no tiene user_id para notificar
    RETURN NEW;
  END IF;

  -- Si no hay destinatario, no hacer nada
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Datos del pago
  SELECT name INTO v_school FROM schools WHERE id = NEW.school_id;
  v_amount := '$' || TO_CHAR(NEW.amount, 'FM999,999,999');

  -- Insertar notificación directamente (sin RPC para evitar restricción de permisos)
  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    v_user_id,
    '💳 Nuevo cobro pendiente',
    v_school || ' ha generado un cobro de ' || v_amount || ' para ' || COALESCE(v_name, 'tu cuenta') || '. Vence el ' || TO_CHAR(NEW.due_date, 'DD/MM/YYYY') || '.',
    'warning',
    '/my-payments'
  );

  RETURN NEW;
END;
$function$;
