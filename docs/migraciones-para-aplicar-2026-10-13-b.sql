-- =============================================================================
-- 2 migraciones nuevas del 2026-10-13 (bandeja de comprobantes), en orden, para
-- pegar UNA vez en el SQL Editor de Supabase. Requiere que ya esté aplicada
-- 20261013124655 (se aplicó el 2026-10-13 con el archivo anterior).
--
--   1. 20261013164839  tipos de contacto: personal / negocio / otro_club / plataforma
--                      + bandera «también es familia».
--   2. 20261013165308  saldo a favor (pagar de más), recargo del link, un comprobante
--                      para varios cobros, huellas para el autocierre y atleta adulto
--                      identificado por su teléfono.
--
-- Todo va en UNA transacción: si algo falla, no se aplica nada.
-- =============================================================================

BEGIN;


-- ▼▼▼ 20261013164839_whatsapp_tipos_de_contacto.sql ▼▼▼

-- =============================================================================
-- 20261013164839_whatsapp_tipos_de_contacto.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-13   Versión anterior: 20261013124655
-- Objetivo: que los números que no son familias (contactos personales de la
-- dueña, proveedores/negocios, otros clubes, el número de SportMaps) se marquen
-- UNA vez y dejen de llenar la bandeja «Comprobantes sin resolver».
--
-- Medido en Dynasty el 2026-10-13: de 87 filas «para revisar», 37 eran de un
-- proveedor mayorista (una ráfaga), 14 del círculo personal de la dueña y 5 de
-- negocios/otro club/SportMaps. Hasta hoy la única marca era `personal`.
--
-- Qué hace:
--   1. Amplía el CHECK de `whatsapp_conversations.contact_kind` con tres marcas
--      manuales nuevas: `negocio`, `otro_club`, `plataforma`. Las cuatro marcas
--      manuales (personal|negocio|otro_club|plataforma) significan lo mismo
--      para el bot: no es familia, no se le habla, no se guarda contenido y sus
--      adjuntos no se procesan. Sigue siendo text + CHECK (no ENUM).
--   2. Columna `tambien_familia boolean NOT NULL DEFAULT false`: la persona
--      marcada (p. ej. el esposo de la dueña) TAMBIÉN es acudiente. Con la
--      bandera sus comprobantes se aplican en silencio a los cobros de su
--      hijo; sus fotos personales no llegan a «revisar».
--
-- Sin funciones nuevas ni cambios de RLS. Verificado contra la base el
-- 2026-10-13: ninguna función de `public` lee `contact_kind` (lo filtra el BFF),
-- así que no hay RPC que actualizar.
--
-- Idempotente (DROP CONSTRAINT IF EXISTS / ADD COLUMN IF NOT EXISTS).
-- =============================================================================


-- 1. Marcas manuales nuevas ---------------------------------------------------
ALTER TABLE public.whatsapp_conversations
    DROP CONSTRAINT IF EXISTS whatsapp_conversations_contact_kind_check;

ALTER TABLE public.whatsapp_conversations
    ADD CONSTRAINT whatsapp_conversations_contact_kind_check
    CHECK (contact_kind IS NULL OR contact_kind IN (
        'familia',             -- acudiente con cuenta de un atleta activo
        'familia_sin_cuenta',  -- el número está en la ficha de un atleta activo, sin cuenta
        'ambiguo',             -- el número está en dos cuentas: lo resuelve un humano
        'staff',               -- administra la escuela (owner/admin)
        'desconocido',         -- nada de lo anterior (clasificación automática)
        -- Marcas MANUALES (las pone la escuela; mandan sobre la clasificación):
        'personal',            -- familia o amigos de quien dirige la escuela
        'negocio',             -- proveedor, mayorista, gastrobar, agencia…
        'otro_club',           -- otro club o escuela deportiva
        'plataforma'           -- el número de SportMaps u otra plataforma
    ));

COMMENT ON COLUMN public.whatsapp_conversations.contact_kind IS
    'Quién es el contacto. Automático (whatsapp-atencion.service): familia|familia_sin_cuenta|ambiguo|staff|desconocido. '
    'Marca manual de la escuela, manda sobre lo automático: personal|negocio|otro_club|plataforma '
    '(no es familia: el bot no le habla, no se guarda contenido, sus filas no cuentan en la bandeja). NULL = sin clasificar.';

-- 2. «También es familia» -----------------------------------------------------
ALTER TABLE public.whatsapp_conversations
    ADD COLUMN IF NOT EXISTS tambien_familia boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.whatsapp_conversations.tambien_familia IS
    'Con una marca manual (personal|negocio|otro_club|plataforma): la persona TAMBIÉN es acudiente. '
    'Sus comprobantes se aplican en silencio a los cobros de sus hijos; lo demás no llega a la bandeja. '
    'Sin marca manual no tiene efecto.';


-- ▲▲▲ fin 20261013164839_whatsapp_tipos_de_contacto.sql ▲▲▲

-- ▼▼▼ 20261013165308_wa_saldo_a_favor_y_huellas.sql ▼▼▼

-- =============================================================================
-- 20261013165308_wa_saldo_a_favor_y_huellas.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-13   Versión anterior: 20261013124655
-- Objetivo: bandeja de comprobantes de WhatsApp (informe Dynasty 2026-10-13,
--   §5 y §6). Decisión de la escuela: «si pagan de más, se toma el pago igual».
--
--   1. SALDO A FAVOR (append-only en payment_adjustments):
--      · kind 'saldo_a_favor' (origin 'saldo_a_favor', applies_to 'pago'): el
--        excedente que ENTRÓ con un pago. Va en el pago de origen y no toca su
--        `amount` (como el pronto pago). Uno por pago (índice único parcial).
--      · consumo = kind 'descuento' con origin 'saldo_a_favor' (applies_to
--        'monto') en el SIGUIENTE cobro pendiente del mismo dueño: baja `amount`
--        y sube `discount_amount` en el mismo UPDATE.
--      · Saldo disponible = Σ generados − Σ consumidos (sin revertir), por dueño.
--      · Dueño: el atleta del cobro (child_id → unregistered_athlete_id →
--        user_id/parent_id del adulto). Ver _saldo_a_favor_dueno.
--   2. RPC registrar_saldo_a_favor (service_role): registra el excedente de un
--      pago YA pagado (caso «aprobado con amount_paid = cobro y la diferencia se
--      perdió») y lo consume.
--   3. Trigger al aprobar (awaiting_approval → paid): si el comprobante leído
--      (ocr_amount) es MAYOR que lo esperado:
--        a. = gross del enlace de pago del cobro, o = cobro × (1 + fee_pct del
--           enlace) → es el recargo del link: gross_amount = ocr_amount, sin saldo.
--        b. = lo esperado + los cobros cubiertos por el MISMO comprobante
--           (mismo receipt_url, ver 5) → sin saldo.
--        c. si no → saldo a favor por la diferencia (amount_paid = recibido).
--      Nunca bloquea la aprobación (errores → WARNING).
--   4. Trigger al crear un cobro pendiente: si el dueño tiene saldo, se consume.
--   5. RPC wa_cubrir_cobros_con_comprobante (service_role): UN comprobante que
--      suma exacto varios cobros. El principal ya quedó estampado por el BFF
--      (referencia + sha: uq_payments_school_ocr_reference impide repetirlos);
--      los demás pasan a awaiting_approval con el MISMO archivo y una nota, en
--      una sola transacción.
--   6. wa_bandeja_cerrar_por_pago (trigger de 20261013124655): enlaza también
--      por `pregunta_ocr->'referencias'` (referencias alternativas del
--      comprobante: «Recibo» y «Aprob.» distintos). Solo igualdad exacta.
--   7. wa_identify_by_phone: un atleta ADULTO con su número en el perfil
--      (school_members role 'athlete' activo, inscripción propia o ficha sin
--      registrar ya vinculada) quedaba 'desconocido': la RPC solo buscaba
--      perfiles con hijos. Los acudientes siguen mandando: el adulto solo se
--      busca si ningún acudiente tiene ese número.
--
-- Invariante payments_amount_invariante (list_amount IS NULL OR
--   amount = list_amount − discount_amount + late_fee_amount): el consumo
--   escribe list_amount (= amount + discount − late si venía NULL),
--   discount_amount += x y amount −= x en el MISMO UPDATE; x ≤ list − discount
--   (nunca se descuenta el recargo). Si x cubre todo (amount = 0) el cobro queda
--   'paid' con discount_amount > 0: lo admite payments_amount_positive.
--   Nunca se sube `amount` del pago de origen: el excedente vive en
--   amount_paid − amount y en el ajuste 'saldo_a_favor'.
--
-- NO se usa payment_category = 'excedente' (es el banco de horas).
-- NO APLICADA. Aplicar por CLI de Supabase o apply_migration (deja rastro),
-- DESPUÉS de 20261013124655 (este archivo reemplaza su función de trigger).
-- Verificación al final.
-- =============================================================================


-- ── 1. CHECKs de payment_adjustments (superconjunto: ninguna fila viva cae) ──
ALTER TABLE public.payment_adjustments DROP CONSTRAINT IF EXISTS padj_kind_check;
ALTER TABLE public.payment_adjustments ADD CONSTRAINT padj_kind_check
    CHECK (kind IN ('descuento', 'condonacion_recargo', 'exoneracion', 'reversion', 'saldo_a_favor'));

ALTER TABLE public.payment_adjustments DROP CONSTRAINT IF EXISTS padj_origin_check;
ALTER TABLE public.payment_adjustments ADD CONSTRAINT padj_origin_check
    CHECK (origin IN ('militar', 'hermanos', 'alta_solo_este_mes', 'pronto_pago', 'modal', 'saldo_a_favor'));

-- 'pago' (no toca amount): pronto pago y el saldo generado.
ALTER TABLE public.payment_adjustments DROP CONSTRAINT IF EXISTS padj_applies_to_pago_solo_pronto_pago;
ALTER TABLE public.payment_adjustments ADD CONSTRAINT padj_applies_to_pago_solo_pronto_pago
    CHECK (applies_to = 'monto' OR origin IN ('pronto_pago', 'saldo_a_favor'));

-- El saldo generado va siempre en el pago de origen, sin tocar amount.
ALTER TABLE public.payment_adjustments DROP CONSTRAINT IF EXISTS padj_saldo_a_favor_forma;
ALTER TABLE public.payment_adjustments ADD CONSTRAINT padj_saldo_a_favor_forma
    CHECK (kind <> 'saldo_a_favor' OR (origin = 'saldo_a_favor' AND applies_to = 'pago'));

ALTER TABLE public.payment_adjustments DROP CONSTRAINT IF EXISTS padj_reason_code_check;
ALTER TABLE public.payment_adjustments ADD CONSTRAINT padj_reason_code_check
    CHECK (reason_code IN ('pronto_pago', 'varios_meses', 'hermanos', 'beca', 'convenio',
                           'cortesia', 'ajuste_de_precio', 'error_de_cobro',
                           'condonacion_mora', 'descuento_alta', 'otro', 'saldo_a_favor'));

-- Un excedente por pago (idempotencia del trigger y de la RPC).
CREATE UNIQUE INDEX IF NOT EXISTS uq_padj_saldo_a_favor_por_pago
    ON public.payment_adjustments (payment_id)
    WHERE kind = 'saldo_a_favor';

-- Camino rápido del trigger de creación: ¿la escuela tiene algún saldo?
CREATE INDEX IF NOT EXISTS ix_padj_saldo_a_favor_escuela
    ON public.payment_adjustments (school_id)
    WHERE origin = 'saldo_a_favor';

-- ── 2. Dueño del saldo ───────────────────────────────────────────────────────
-- El atleta del cobro. Un adulto aparece con user_id o con parent_id = él
-- mismo (checkout del adulto, débito automático): por eso COALESCE.
CREATE OR REPLACE FUNCTION public._saldo_a_favor_dueno(
    p_child_id uuid, p_unreg_id uuid, p_user_id uuid, p_parent_id uuid)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path = pg_catalog, public, pg_temp
AS $function$
    SELECT CASE
        WHEN p_child_id IS NOT NULL THEN 'c:' || p_child_id::text
        WHEN p_unreg_id IS NOT NULL THEN 'u:' || p_unreg_id::text
        WHEN COALESCE(p_user_id, p_parent_id) IS NOT NULL THEN 'p:' || COALESCE(p_user_id, p_parent_id)::text
    END;
$function$;

REVOKE ALL ON FUNCTION public._saldo_a_favor_dueno(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._saldo_a_favor_dueno(uuid, uuid, uuid, uuid) TO service_role;

-- ── 3. Saldo disponible ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._saldo_a_favor_disponible(p_school_id uuid, p_dueno text)
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
    SELECT COALESCE(sum(CASE WHEN a.kind = 'saldo_a_favor' THEN a.amount ELSE -a.amount END), 0)
      FROM public.payment_adjustments a
      JOIN public.payments p ON p.id = a.payment_id
     WHERE a.school_id = p_school_id
       AND a.origin = 'saldo_a_favor'
       AND a.kind IN ('saldo_a_favor', 'descuento')
       AND NOT EXISTS (SELECT 1 FROM public.payment_adjustments r WHERE r.reverts_id = a.id)
       AND public._saldo_a_favor_dueno(p.child_id, p.unregistered_athlete_id, p.user_id, p.parent_id) = p_dueno;
$function$;

REVOKE ALL ON FUNCTION public._saldo_a_favor_disponible(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._saldo_a_favor_disponible(uuid, text) TO service_role;

-- ── 4. Consumir: descuento en los cobros pendientes, del más antiguo ────────
-- Serializa con FOR UPDATE sobre los pagos de ORIGEN del saldo (regla de
-- contadores de CLAUDE.md): dos consumos simultáneos del mismo dueño no
-- gastan el mismo peso. Devuelve lo consumido.
CREATE OR REPLACE FUNCTION public._saldo_a_favor_consumir(p_school_id uuid, p_dueno text, p_actor uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_saldo   numeric;
    v_total   numeric := 0;
    r         public.payments;
    v_list    numeric;
    v_disc    numeric;
    v_late    numeric;
    v_x       numeric;
    v_new     numeric;
    v_seq     integer;
    v_today   date := (now() AT TIME ZONE 'America/Bogota')::date;
BEGIN
    IF p_school_id IS NULL OR p_dueno IS NULL THEN
        RETURN 0;
    END IF;

    PERFORM 1
       FROM public.payments p
      WHERE p.id IN (SELECT a.payment_id FROM public.payment_adjustments a
                      WHERE a.school_id = p_school_id AND a.kind = 'saldo_a_favor')
        AND public._saldo_a_favor_dueno(p.child_id, p.unregistered_athlete_id, p.user_id, p.parent_id) = p_dueno
      ORDER BY p.id
        FOR UPDATE;

    v_saldo := public._saldo_a_favor_disponible(p_school_id, p_dueno);
    IF v_saldo <= 0 THEN
        RETURN 0;
    END IF;

    FOR r IN
        SELECT p.*
          FROM public.payments p
         WHERE p.school_id = p_school_id
           AND p.status IN ('pending', 'overdue')
           AND COALESCE(p.amount_paid, 0) = 0
           AND COALESCE(p.early_payment_discount_applied, 0) = 0
           AND public._saldo_a_favor_dueno(p.child_id, p.unregistered_athlete_id, p.user_id, p.parent_id) = p_dueno
           -- Pasarela en vuelo: el enlace firmó un monto (misma regla que _apply_payment_adjustment).
           AND NOT EXISTS (SELECT 1 FROM public.payment_links l
                            WHERE l.payment_id = p.id AND l.status = 'pending' AND l.expires_at > now())
           AND NOT EXISTS (SELECT 1 FROM public.payment_installments i
                            WHERE i.payment_id = p.id AND i.status = 'pending_review')
         ORDER BY p.due_date NULLS LAST, p.created_at, p.id
           FOR UPDATE
    LOOP
        EXIT WHEN v_saldo <= 0;
        v_late := COALESCE(r.late_fee_amount, 0);
        v_disc := COALESCE(r.discount_amount, 0);
        v_list := COALESCE(r.list_amount, r.amount + v_disc - v_late);
        -- Nunca el recargo por mora: solo lo que queda del valor de lista.
        v_x := LEAST(v_saldo, v_list - v_disc);
        CONTINUE WHEN v_x IS NULL OR v_x <= 0;
        v_new := r.amount - v_x;
        CONTINUE WHEN v_new < 0;

        IF v_new = 0 THEN
            -- Cubierto entero por el saldo: pagado en $0 con el descuento
            -- (payments_amount_positive lo admite con discount_amount > 0).
            UPDATE public.payments
               SET amount          = 0,
                   list_amount     = v_list,
                   discount_amount = v_disc + v_x,
                   status          = 'paid',
                   amount_paid     = 0,
                   payment_method  = 'other',
                   payment_channel = 'saldo_a_favor',
                   payment_date    = v_today,
                   approved_by     = p_actor,
                   approved_at     = now(),
                   updated_at      = now()
             WHERE id = r.id;
        ELSE
            UPDATE public.payments
               SET amount          = v_new,
                   list_amount     = v_list,
                   discount_amount = v_disc + v_x,
                   updated_at      = now()
             WHERE id = r.id;
        END IF;

        SELECT COALESCE(max(a.sequence), 0) + 1 INTO v_seq
          FROM public.payment_adjustments a WHERE a.payment_id = r.id;

        INSERT INTO public.payment_adjustments (
            school_id, payment_id, charge_batch_id, kind, origin, applies_to, sequence,
            basis, pct, amount, scope, context, reason_code, reason_text,
            amount_before, amount_after, amount_paid_at, created_by)
        VALUES (
            r.school_id, r.id, NULL, 'descuento', 'saldo_a_favor', 'monto', v_seq,
            'valor', NULL, v_x, 'linea', 'sobre_pendiente', 'saldo_a_favor',
            'Saldo a favor de un pago anterior',
            r.amount, v_new, 0, p_actor);

        v_saldo := v_saldo - v_x;
        v_total := v_total + v_x;
    END LOOP;

    RETURN v_total;
END;
$function$;

REVOKE ALL ON FUNCTION public._saldo_a_favor_consumir(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._saldo_a_favor_consumir(uuid, text, uuid) TO service_role;

-- ── 5. Registrar el excedente de un pago ya pagado (y consumirlo) ───────────
-- p_monto_recibido: lo que entró con el comprobante. Lo esperado es
-- amount − pronto pago; los cobros cubiertos por el mismo comprobante (mismo
-- receipt_url, vivos) también se restan. Idempotente: un excedente por pago.
CREATE OR REPLACE FUNCTION public._saldo_a_favor_registrar(
    p_payment_id uuid, p_monto_recibido numeric, p_actor uuid, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    r           public.payments;
    v_esperado  numeric;
    v_cubiertos numeric := 0;
    v_exc       numeric;
    v_seq       integer;
    v_paid      numeric;
    v_consumido numeric;
    v_motivo    text := NULLIF(btrim(COALESCE(p_motivo, '')), '');
BEGIN
    SELECT * INTO r FROM public.payments WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'DATOS_INVALIDOS: cobro % no existe', p_payment_id USING ERRCODE = 'P0001';
    END IF;
    IF r.status <> 'paid' THEN
        RAISE EXCEPTION 'COBRO_NO_PAGADO: el cobro está %; el saldo a favor sale de un pago aprobado', r.status
            USING ERRCODE = 'P0001';
    END IF;
    IF p_monto_recibido IS NULL OR p_monto_recibido <= 0 THEN
        RAISE EXCEPTION 'DATOS_INVALIDOS: monto recibido' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.payment_adjustments a
                WHERE a.payment_id = r.id AND a.kind = 'saldo_a_favor') THEN
        RETURN jsonb_build_object('excedente', 0, 'consumido', 0, 'motivo', 'ya_registrado');
    END IF;

    v_esperado := r.amount - COALESCE(r.early_payment_discount_applied, 0);
    IF r.receipt_url IS NOT NULL THEN
        SELECT COALESCE(sum(o.amount), 0) INTO v_cubiertos
          FROM public.payments o
         WHERE o.school_id = r.school_id
           AND o.id <> r.id
           AND o.receipt_url = r.receipt_url
           AND o.status NOT IN ('rejected', 'cancelled', 'failed');
    END IF;

    v_exc := round(p_monto_recibido - v_esperado - v_cubiertos);
    IF v_exc <= 0 THEN
        RETURN jsonb_build_object('excedente', 0, 'consumido', 0, 'motivo', 'sin_excedente');
    END IF;

    v_paid := v_esperado + v_exc;
    UPDATE public.payments
       SET amount_paid = v_paid,
           updated_at  = now()
     WHERE id = r.id;

    SELECT COALESCE(max(a.sequence), 0) + 1 INTO v_seq
      FROM public.payment_adjustments a WHERE a.payment_id = r.id;

    INSERT INTO public.payment_adjustments (
        school_id, payment_id, charge_batch_id, kind, origin, applies_to, sequence,
        basis, pct, amount, scope, context, reason_code, reason_text,
        amount_before, amount_after, amount_paid_at, created_by)
    VALUES (
        r.school_id, r.id, NULL, 'saldo_a_favor', 'saldo_a_favor', 'pago', v_seq,
        'valor', NULL, v_exc, 'linea', 'al_pagar', 'saldo_a_favor',
        left(COALESCE(v_motivo, 'Pagó de más: saldo a favor'), 300),
        r.amount, r.amount, v_paid, p_actor);

    v_consumido := public._saldo_a_favor_consumir(
        r.school_id,
        public._saldo_a_favor_dueno(r.child_id, r.unregistered_athlete_id, r.user_id, r.parent_id),
        p_actor);

    RETURN jsonb_build_object('excedente', v_exc, 'consumido', v_consumido, 'motivo', 'registrado');
END;
$function$;

REVOKE ALL ON FUNCTION public._saldo_a_favor_registrar(uuid, numeric, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._saldo_a_favor_registrar(uuid, numeric, uuid, text) TO service_role;

-- RPC del BFF (service_role). Para corregir pagos ya aprobados cuyo excedente
-- se perdió (amount_paid = cobro con un comprobante mayor).
CREATE OR REPLACE FUNCTION public.registrar_saldo_a_favor(
    p_payment_id uuid, p_monto_recibido numeric, p_actor uuid DEFAULT NULL, p_motivo text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
    RETURN public._saldo_a_favor_registrar(p_payment_id, p_monto_recibido, p_actor, p_motivo);
END;
$function$;

REVOKE ALL ON FUNCTION public.registrar_saldo_a_favor(uuid, numeric, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_saldo_a_favor(uuid, numeric, uuid, text) TO service_role;

COMMENT ON FUNCTION public.registrar_saldo_a_favor(uuid, numeric, uuid, text) IS
    'Registra como saldo a favor lo que un pago aprobado recibió de más (amount_paid = recibido) y lo '
    'consume como descuento en los cobros pendientes del mismo atleta. Idempotente. Solo service_role.';

-- ── 6. Trigger al aprobar un comprobante ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_payments_saldo_a_favor_al_aprobar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_ocr       numeric := NEW.ocr_amount;
    v_esperado  numeric := NEW.amount - COALESCE(NEW.early_payment_discount_applied, 0);
    v_cubiertos numeric := 0;
BEGIN
    IF v_ocr IS NULL OR NEW.receipt_url IS NULL OR v_ocr <= v_esperado THEN
        RETURN NULL;
    END IF;

    BEGIN
        -- a. Recargo del enlace de pago: es de la escuela, no saldo a favor.
        IF v_ocr = NEW.gross_amount
           OR EXISTS (SELECT 1 FROM public.payment_links l
                       WHERE l.payment_id = NEW.id
                         AND (l.gross_amount = v_ocr
                              OR round(NEW.amount * (1 + COALESCE(l.fee_pct, 0) / 100)) = v_ocr
                              OR round(l.base_amount * (1 + COALESCE(l.fee_pct, 0) / 100)) = v_ocr)) THEN
            IF NEW.gross_amount IS NULL THEN
                UPDATE public.payments SET gross_amount = v_ocr, updated_at = now() WHERE id = NEW.id;
            END IF;
            RETURN NULL;
        END IF;

        -- b. El mismo comprobante cubre otros cobros (wa_cubrir_cobros_con_comprobante).
        SELECT COALESCE(sum(o.amount), 0) INTO v_cubiertos
          FROM public.payments o
         WHERE o.school_id = NEW.school_id
           AND o.id <> NEW.id
           AND o.receipt_url = NEW.receipt_url
           AND o.status NOT IN ('rejected', 'cancelled', 'failed');
        IF v_ocr <= v_esperado + v_cubiertos THEN
            RETURN NULL;
        END IF;

        -- Lectura dudosa (más de 4 veces lo esperado): no se acredita plata por
        -- un OCR que pudo leer mal un cero. Queda para registrar a mano.
        IF v_ocr > 4 * (v_esperado + v_cubiertos) THEN
            RAISE WARNING 'saldo_a_favor: ocr_amount % muy por encima de lo esperado % (pago %): no se acredita',
                v_ocr, v_esperado + v_cubiertos, NEW.id;
            RETURN NULL;
        END IF;

        -- c. Plata de más: saldo a favor.
        PERFORM public._saldo_a_favor_registrar(NEW.id, v_ocr, NEW.approved_by,
            'Pagó de más con el comprobante: saldo a favor');
    EXCEPTION WHEN OTHERS THEN
        -- El saldo a favor nunca traba la aprobación de un pago.
        RAISE WARNING 'fn_payments_saldo_a_favor_al_aprobar: % (pago %)', SQLERRM, NEW.id;
    END;
    RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_payments_saldo_a_favor_al_aprobar() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_payments_saldo_a_favor_al_aprobar() TO service_role;

DROP TRIGGER IF EXISTS trg_payments_saldo_a_favor_al_aprobar ON public.payments;
CREATE TRIGGER trg_payments_saldo_a_favor_al_aprobar
    AFTER UPDATE OF status ON public.payments
    FOR EACH ROW
    WHEN (OLD.status = 'awaiting_approval' AND NEW.status = 'paid')
    EXECUTE FUNCTION public.fn_payments_saldo_a_favor_al_aprobar();

-- ── 7. Trigger al crear un cobro: consume el saldo del dueño ────────────────
-- Las filas de un lote las maneja create_charge_batch (inserta sus propios
-- ajustes con sequence 1..n después del INSERT): no se tocan.
CREATE OR REPLACE FUNCTION public.fn_payments_saldo_a_favor_al_crear()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
    -- Camino rápido: la escuela no tiene ningún saldo (índice parcial, casi vacío).
    IF NOT EXISTS (SELECT 1 FROM public.payment_adjustments a
                    WHERE a.school_id = NEW.school_id AND a.origin = 'saldo_a_favor') THEN
        RETURN NULL;
    END IF;
    BEGIN
        PERFORM public._saldo_a_favor_consumir(
            NEW.school_id,
            public._saldo_a_favor_dueno(NEW.child_id, NEW.unregistered_athlete_id, NEW.user_id, NEW.parent_id),
            NULL);
    EXCEPTION WHEN OTHERS THEN
        -- Crear el cobro nunca falla por el saldo a favor.
        RAISE WARNING 'fn_payments_saldo_a_favor_al_crear: % (cobro %)', SQLERRM, NEW.id;
    END;
    RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_payments_saldo_a_favor_al_crear() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_payments_saldo_a_favor_al_crear() TO service_role;

-- «zzzz»: después de trg_payments_descuentos_automaticos (los AFTER corren en
-- orden alfabético), que numera sus ajustes desde 1.
DROP TRIGGER IF EXISTS trg_zzzz_payments_saldo_a_favor_al_crear ON public.payments;
CREATE TRIGGER trg_zzzz_payments_saldo_a_favor_al_crear
    AFTER INSERT ON public.payments
    FOR EACH ROW
    WHEN (NEW.status IN ('pending', 'overdue') AND NEW.charge_batch_id IS NULL)
    EXECUTE FUNCTION public.fn_payments_saldo_a_favor_al_crear();

-- ── 8. Un comprobante que cubre varios cobros ───────────────────────────────
-- El BFF ya estampó el principal (referencia, sha, OCR, veredicto) y elige los
-- demás entre los pendientes de la familia (suma exacta). Todo o nada.
CREATE OR REPLACE FUNCTION public.wa_cubrir_cobros_con_comprobante(
    p_school_id uuid, p_principal_id uuid, p_cobros uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    pr      public.payments;
    v_n     integer := 0;
    v_ids   uuid[];
    v_nota  text;
BEGIN
    SELECT * INTO pr FROM public.payments WHERE id = p_principal_id FOR UPDATE;
    IF NOT FOUND OR pr.school_id IS DISTINCT FROM p_school_id THEN
        RAISE EXCEPTION 'DATOS_INVALIDOS: cobro principal % no es de la escuela', p_principal_id USING ERRCODE = 'P0001';
    END IF;
    IF pr.status <> 'awaiting_approval' OR pr.receipt_url IS NULL THEN
        RAISE EXCEPTION 'COBRO_CAMBIO: el principal no tiene el comprobante en revisión (%)', pr.status USING ERRCODE = 'P0001';
    END IF;

    SELECT array_agg(DISTINCT x) INTO v_ids FROM unnest(COALESCE(p_cobros, '{}'::uuid[])) x WHERE x <> p_principal_id;
    IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
        RETURN 0;
    END IF;
    IF array_length(v_ids, 1) > 8 THEN
        RAISE EXCEPTION 'DATOS_INVALIDOS: demasiados cobros' USING ERRCODE = 'P0001';
    END IF;

    PERFORM 1 FROM public.payments WHERE id = ANY (v_ids) ORDER BY id FOR UPDATE;
    IF (SELECT count(*) FROM public.payments
         WHERE id = ANY (v_ids) AND school_id = p_school_id AND status IN ('pending', 'overdue'))
       <> array_length(v_ids, 1) THEN
        RAISE EXCEPTION 'COBRO_CAMBIO: algún cobro ya no está pendiente o no es de la escuela' USING ERRCODE = 'P0001';
    END IF;

    v_nota := 'Cubierto por el comprobante del cobro ' || p_principal_id::text || ' (un pago para varios cobros)';
    UPDATE public.payments
       SET status                 = 'awaiting_approval',
           receipt_url            = pr.receipt_url,
           receipt_storage_bucket = pr.receipt_storage_bucket,
           notes                  = left(CASE WHEN notes IS NULL OR btrim(notes) = '' THEN v_nota
                                              ELSE notes || ' · ' || v_nota END, 2000),
           updated_at             = now()
     WHERE id = ANY (v_ids);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RETURN v_n;
END;
$function$;

REVOKE ALL ON FUNCTION public.wa_cubrir_cobros_con_comprobante(uuid, uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_cubrir_cobros_con_comprobante(uuid, uuid, uuid[]) TO service_role;

-- ── 9. Vista de la familia: etiqueta del saldo a favor ──────────────────────
-- Mismas columnas y orden que 20261010144554 (CREATE OR REPLACE VIEW lo exige).
CREATE OR REPLACE VIEW public.v_payment_adjustments_familia
WITH (security_barrier = true) AS
SELECT
    a.id,
    a.payment_id,
    a.kind,
    a.origin,
    a.applies_to,
    a.sequence,
    a.basis,
    a.pct,
    a.amount,
    a.reason_code,
    CASE a.reason_code
        WHEN 'pronto_pago'      THEN 'Pronto pago'
        WHEN 'varios_meses'     THEN 'Pago de varios meses'
        WHEN 'hermanos'         THEN 'Hermanos'
        WHEN 'beca'             THEN 'Beca'
        WHEN 'convenio'         THEN CASE WHEN a.origin = 'militar' THEN 'Fuerza Militar' ELSE 'Convenio' END
        WHEN 'cortesia'         THEN 'Cortesía'
        WHEN 'ajuste_de_precio' THEN 'Ajuste de precio'
        WHEN 'error_de_cobro'   THEN 'Ajuste'
        WHEN 'condonacion_mora' THEN 'Mora condonada'
        WHEN 'descuento_alta'   THEN 'Descuento de ingreso'
        WHEN 'saldo_a_favor'    THEN 'Saldo a favor'
        ELSE 'Descuento'
    END AS reason_label,
    EXISTS (SELECT 1 FROM public.payment_adjustments r WHERE r.reverts_id = a.id) AS reverted,
    a.created_at
FROM public.payment_adjustments a
JOIN public.payments p ON p.id = a.payment_id
WHERE a.kind <> 'reversion'
  AND (
        p.parent_id = auth.uid()
     OR p.user_id   = auth.uid()
     OR p.child_id IN (SELECT c.id FROM public.children c WHERE c.parent_id = auth.uid())
  );

REVOKE ALL ON public.v_payment_adjustments_familia FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_payment_adjustments_familia TO authenticated;
GRANT SELECT ON public.v_payment_adjustments_familia TO service_role;

-- ── 10. Bandeja: enlazar también por las referencias alternativas ───────────
-- Igual a 20261013124655 + `pregunta_ocr->'referencias'` (array de texto que
-- guardan el worker y la recuperación: la referencia leída y las alternativas
-- del comprobante, cruda y normalizada). Solo igualdad exacta.
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
           AND COALESCE(q.error_message, '') NOT LIKE 'recuperado: ya_registrado%'
           AND COALESCE(q.error_message, '') NOT LIKE 'referencia ya usada%'
           AND q.created_at <= v_cuando + interval '5 minutes'
           AND (
                q.result_ref_id = NEW.id
             OR (NEW.receipt_image_sha256 IS NOT NULL AND q.pregunta_ocr->>'sha' = NEW.receipt_image_sha256)
             OR (NEW.ocr_reference IS NOT NULL AND q.pregunta_ocr->'ocr'->>'reference' = NEW.ocr_reference)
             OR (NEW.receipt_reference_norm IS NOT NULL AND q.pregunta_ocr->'ocr'->>'reference' = NEW.receipt_reference_norm)
             OR (NEW.ocr_reference IS NOT NULL
                 AND jsonb_typeof(q.pregunta_ocr->'referencias') = 'array'
                 AND q.pregunta_ocr->'referencias' ? NEW.ocr_reference)
             OR (NEW.receipt_reference_norm IS NOT NULL
                 AND jsonb_typeof(q.pregunta_ocr->'referencias') = 'array'
                 AND q.pregunta_ocr->'referencias' ? NEW.receipt_reference_norm)
           );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'wa_bandeja_cerrar_por_pago: % (pago %)', SQLERRM, NEW.id;
    END;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.wa_bandeja_cerrar_por_pago() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wa_bandeja_cerrar_por_pago() FROM anon;
REVOKE ALL ON FUNCTION public.wa_bandeja_cerrar_por_pago() FROM authenticated;

-- ── 11. wa_identify_by_phone: también el atleta adulto ──────────────────────
-- Igual a 20261008164914 salvo el bloque «Atleta adulto»: si NINGÚN acudiente
-- (perfil con hijos activos en la escuela) tiene el número, se busca el perfil
-- del atleta adulto activo de la escuela. Paga sus propios cobros, así que
-- queda identificado con su propio id (parent_id = él mismo, que es como el
-- checkout y el débito automático del adulto llenan payments.parent_id).
CREATE OR REPLACE FUNCTION public.wa_identify_by_phone(p_integration_id uuid, p_contact_wa_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_school_id  uuid;
    v_tel        text;
    v_ids        uuid[];
    v_parent_id  uuid;
    v_es_familia boolean;
BEGIN
    SELECT school_id INTO v_school_id
    FROM public.school_whatsapp_integrations
    WHERE id = p_integration_id;

    IF v_school_id IS NULL THEN
        RETURN jsonb_build_object('estado', 'desconocido', 'motivo', 'integracion_inexistente');
    END IF;

    v_tel := public.wa_celular_remitente_co(p_contact_wa_id);

    IF v_tel IS NULL THEN
        RETURN jsonb_build_object('estado', 'desconocido', 'motivo', 'no_es_celular');
    END IF;

    SELECT array_agg(DISTINCT p.id) INTO v_ids
    FROM public.profiles p
    WHERE right(regexp_replace(coalesce(p.phone,''), '[^0-9]', '', 'g'), 10) = v_tel
      AND EXISTS (
            SELECT 1 FROM public.children c
            WHERE c.parent_id = p.id AND c.school_id = v_school_id AND c.is_active
      );

    -- Atleta adulto (bug 5 del informe 2026-10-13): solo si ningún acudiente
    -- tiene el número, para no volver 'ambiguo' el número de una familia que
    -- comparte celular con su hijo mayor de edad.
    IF coalesce(array_length(v_ids, 1), 0) = 0 THEN
        SELECT array_agg(DISTINCT p.id) INTO v_ids
        FROM public.profiles p
        WHERE right(regexp_replace(coalesce(p.phone,''), '[^0-9]', '', 'g'), 10) = v_tel
          AND (
                EXISTS (SELECT 1 FROM public.school_members sm
                         WHERE sm.profile_id = p.id AND sm.school_id = v_school_id
                           AND sm.role = 'athlete' AND sm.status = 'active')
             OR EXISTS (SELECT 1 FROM public.enrollments e
                         WHERE e.user_id = p.id AND e.child_id IS NULL AND e.school_id = v_school_id
                           AND e.status IN ('active', 'pending'))
             OR EXISTS (SELECT 1 FROM public.unregistered_athletes ua
                         WHERE ua.linked_profile_id = p.id AND ua.school_id = v_school_id AND ua.is_active)
          );
    END IF;

    -- Número del equipo en el perfil de otra persona.
    IF coalesce(array_length(v_ids, 1), 0) = 1 AND EXISTS (
        SELECT 1
        FROM public.school_members sm
        JOIN public.profiles s ON s.id = sm.profile_id
        WHERE sm.school_id = v_school_id
          AND sm.status = 'active'
          AND sm.role NOT IN ('parent', 'athlete')
          AND sm.profile_id <> v_ids[1]
          AND right(regexp_replace(coalesce(s.phone,''), '[^0-9]', '', 'g'), 10) = v_tel
    ) THEN
        UPDATE public.whatsapp_conversations wc
           SET parent_id = NULL, identified = false, updated_at = now()
         WHERE wc.integration_id = p_integration_id
           AND wc.contact_wa_id = p_contact_wa_id
           AND wc.identified
           AND NOT EXISTS (
                SELECT 1
                FROM public.whatsapp_identifications i
                JOIN public.profiles pv ON pv.id = wc.parent_id
                WHERE i.integration_id = p_integration_id
                  AND i.contact_wa_id = p_contact_wa_id
                  AND i.verified_at IS NOT NULL
                  AND i.email IS NOT NULL
                  AND lower(pv.email) = lower(i.email)
           );
        RETURN jsonb_build_object('estado', 'ambiguo', 'motivo', 'numero_de_personal');
    END IF;

    IF coalesce(array_length(v_ids, 1), 0) > 1 THEN
        UPDATE public.whatsapp_conversations wc
           SET parent_id = NULL, identified = false, updated_at = now()
         WHERE wc.integration_id = p_integration_id
           AND wc.contact_wa_id = p_contact_wa_id
           AND wc.identified
           AND NOT EXISTS (
                SELECT 1
                FROM public.whatsapp_identifications i
                JOIN public.profiles pv ON pv.id = wc.parent_id
                WHERE i.integration_id = p_integration_id
                  AND i.contact_wa_id = p_contact_wa_id
                  AND i.verified_at IS NOT NULL
                  AND i.email IS NOT NULL
                  AND lower(pv.email) = lower(i.email)
           );
        RETURN jsonb_build_object('estado', 'ambiguo', 'motivo', 'varias_cuentas_mismo_numero');
    END IF;

    IF coalesce(array_length(v_ids, 1), 0) = 1 THEN
        v_parent_id := v_ids[1];

        UPDATE public.whatsapp_conversations
           SET parent_id = v_parent_id, identified = true, updated_at = now()
         WHERE integration_id = p_integration_id AND contact_wa_id = p_contact_wa_id;

        INSERT INTO public.whatsapp_identifications (
            integration_id, contact_wa_id, parent_id, email,
            otp_hash, otp_expires_at, attempts, verified_at, updated_at
        ) VALUES (
            p_integration_id, p_contact_wa_id, v_parent_id, NULL,
            NULL, NULL, 0, now(), now()
        )
        ON CONFLICT (integration_id, contact_wa_id) DO UPDATE SET
            parent_id = EXCLUDED.parent_id, verified_at = now(), updated_at = now();

        RETURN jsonb_build_object('estado', 'identificado', 'parent_id', v_parent_id);
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.children c
        WHERE c.school_id = v_school_id
          AND c.is_active
          AND right(regexp_replace(coalesce(c.parent_phone_temp,''), '[^0-9]', '', 'g'), 10) = v_tel
    ) INTO v_es_familia;

    IF NOT v_es_familia THEN
        v_es_familia := public.wa_es_familia_sin_registrar(v_school_id, p_contact_wa_id);
    END IF;

    IF v_es_familia THEN
        RETURN jsonb_build_object('estado', 'debe_registrarse');
    END IF;

    RETURN jsonb_build_object('estado', 'desconocido', 'motivo', 'sin_coincidencia');
END;
$$;

-- Misma firma: CREATE OR REPLACE conserva los GRANT vivos (como 20261008164914).


-- Verificación (después de aplicar):
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conname in ('padj_kind_check','padj_origin_check','padj_reason_code_check',
--                      'padj_applies_to_pago_solo_pronto_pago','padj_saldo_a_favor_forma');
--   select tgname from pg_trigger where tgrelid = 'public.payments'::regclass
--    and tgname in ('trg_payments_saldo_a_favor_al_aprobar','trg_zzzz_payments_saldo_a_favor_al_crear');
--   select proname, proconfig, proacl from pg_proc
--    where proname in ('registrar_saldo_a_favor','wa_cubrir_cobros_con_comprobante','_saldo_a_favor_consumir',
--                      '_saldo_a_favor_registrar','_saldo_a_favor_disponible','wa_identify_by_phone');
--   npm run seguridad:invariantes

-- ▲▲▲ fin 20261013165308_wa_saldo_a_favor_y_huellas.sql ▲▲▲

-- Rastro en el registro de migraciones
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
  ('20261013164839', 'whatsapp_tipos_de_contacto'),
  ('20261013165308', 'wa_saldo_a_favor_y_huellas')
ON CONFLICT (version) DO NOTHING;

COMMIT;
