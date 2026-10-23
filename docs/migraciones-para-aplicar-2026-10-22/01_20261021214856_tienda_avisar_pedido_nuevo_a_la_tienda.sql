-- La tienda no se enteraba de los pedidos: ningún trigger de `orders` escribía en `notifications`.
-- Se avisa (campana + push por el despachador, que ya reacciona a cada INSERT en notifications) en tres momentos:
--   1. Pedido nuevo con pago en efectivo al retirar (nace en pending_payment y se cobra en la sede).
--   2. Comprobante subido (pending_payment → awaiting_approval): hay que revisarlo.
--   3. Pedido pagado por otra vía (tarjeta / transferencia aprobada): hay que alistarlo.
-- Los pedidos de tarjeta o transferencia recién creados NO avisan: son carritos y la mayoría se abandona.
-- Un fallo al avisar nunca bloquea el pedido.

CREATE OR REPLACE FUNCTION public._notify_store_order(p_order_id uuid, p_event text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_o        public.orders%ROWTYPE;
    v_school   uuid;
    v_owner    uuid;
    v_buyer    text;
    v_title    text;
    v_message  text;
    v_data     jsonb;
    v_money    text;
BEGIN
    SELECT * INTO v_o FROM public.orders WHERE id = p_order_id;
    IF v_o.id IS NULL OR v_o.vendor_profile_id IS NULL THEN RETURN; END IF;

    SELECT school_id, user_id INTO v_school, v_owner
      FROM public.vendor_profiles WHERE id = v_o.vendor_profile_id;

    v_buyer := COALESCE(
        NULLIF(btrim(v_o.customer_name), ''),
        (SELECT full_name FROM public.profiles WHERE id = v_o.user_id),
        'Un cliente');
    v_money := '$' || replace(to_char(v_o.total_amount, 'FM999G999G999'), ',', '.');

    v_title := CASE p_event
        WHEN 'new_cash'         THEN 'Pedido nuevo: cobra al retirar'
        WHEN 'receipt_to_check' THEN 'Comprobante por revisar'
        WHEN 'paid'             THEN 'Pedido pagado: alístalo'
        ELSE NULL END;
    IF v_title IS NULL THEN RETURN; END IF;

    v_message := v_buyer || ' · ' || v_money || ' · ' || COALESCE(v_o.reference, '');
    v_data := jsonb_build_object(
        'order_id', v_o.id, 'reference', v_o.reference,
        'vendor_profile_id', v_o.vendor_profile_id, 'amount', v_o.total_amount, 'event', p_event);

    IF v_school IS NOT NULL THEN
        PERFORM public._notify_school_staff(v_school, 'marketplace', 'info', v_title, v_message, '/orders', v_data);
    ELSIF v_owner IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, link, category, data)
        VALUES (v_owner, v_title, v_message, 'info', '/orders', 'marketplace', v_data);
    END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_orders_notify_store()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_event text;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.payment_method = 'cash_pickup' AND NEW.status = 'pending_payment' THEN
            v_event := 'new_cash';
        END IF;
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
        IF NEW.status = 'awaiting_approval' THEN
            v_event := 'receipt_to_check';
        ELSIF NEW.status = 'paid' AND NEW.payment_method IS DISTINCT FROM 'cash_pickup' THEN
            v_event := 'paid';
        END IF;
    END IF;

    IF v_event IS NOT NULL THEN
        BEGIN
            PERFORM public._notify_store_order(NEW.id, v_event);
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'fn_orders_notify_store: no se pudo avisar del pedido % (%)', NEW.id, SQLERRM;
        END;
    END IF;
    RETURN NEW;
END;
$function$;

-- Solo las llama el trigger: ni anon ni authenticated.
REVOKE ALL ON FUNCTION public._notify_store_order(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_orders_notify_store() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_orders_notify_store ON public.orders;
CREATE TRIGGER trg_orders_notify_store
    AFTER INSERT OR UPDATE OF status ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.fn_orders_notify_store();
