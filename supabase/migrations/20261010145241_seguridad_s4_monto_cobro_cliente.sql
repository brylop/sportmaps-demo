-- =============================================================================
-- 20261010145241_seguridad_s4_monto_cobro_cliente.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-10   Versión anterior: 20261010144600
-- Objetivo: rama de seguridad S4 (docs/specs/cobros-multiples.md, junto a H5/S1).
--   El MONTO de un cobro que crea el propio acudiente/atleta desde el navegador
--   lo pone el SERVIDOR, no el cliente. anon pierde toda escritura en payments.
-- =============================================================================
--
-- ── El hueco (verificado contra la base viva el 2026-10-10, solo lectura) ─────
-- · Policies PERMISIVAS de INSERT sobre payments (se suman con OR; están todas):
--     "Payments: insert parent"  WITH CHECK (parent_id = auth.uid())
--     "Payments: insert athlete" WITH CHECK (user_id  = auth.uid())
--     "Payments: insert staff"   WITH CHECK (school_id = ANY (staff_school_ids()))
--   + RESTRICTIVE trial_block_insert (school_is_operational). Ninguna mira amount.
-- · GRANTs: anon y authenticated tienen INSERT/UPDATE/DELETE de tabla (83 columnas).
-- · La guardia viva fn_guard_payments_client (trg_zz_guard_payments_client), en
--   INSERT de no-staff solo exige escuela propia, status pending/awaiting_approval
--   y bloquea amount_paid/approved_*/late_fee/gross/fees/ids de pasarela/
--   cash_session/reconciliation/unblocked_*/discount_pct/list_amount. Deja pasar:
--   amount, offering_plan_id, child_id AJENO, user_id/parent_id ajenos (según la
--   policy usada), unregistered_athlete_id, qr_id, payment_category,
--   period_*, period_uniqueness_exempt.
-- · Consecuencia: un acudiente con la consola abierta inserta
--     {parent_id: él, child_id: su hijo, school_id, amount: 1,
--      payment_category: 'mensualidad', period_*: mes actual,
--      offering_plan_id: plan del hijo, status: 'awaiting_approval', receipt_url}
--   y transfiere $1:
--     - receipt-approval.service.ts compara el comprobante contra ESE amount
--       (expectedAmount = payments.amount) y, en las 3 escuelas con
--       auto_approve_enabled, llama auto_approve_payment → 'paid' con
--       amount_paid = 1; auto_approve además activa TODAS las inscripciones
--       'pending' del atleta (filtro de team solo si team_id no es NULL);
--     - fn_extend_enrollment_on_payment_paid (AFTER) extiende la vigencia
--       duration_days (o hasta fin de mes) porque es mensualidad con plan;
--     - el período queda "pagado" para next_unpaid_period / period_payment_status
--       (ciegos a la categoría) y uniq_payment_active_period_per_child impide que
--       open_month genere la mensualidad real de ese mes.
--   Sin auto-aprobación, el admin ve "monto = comprobante" y aprueba igual.
--   El mismo vector sirve para inscripción/seguro (emit_enrollment_fees da por
--   pagada la inscripción) y vía Wompi/MP (create-session cobra payments.amount).
--
-- ── Radio medido (audit_logs INSERT de payments, últimos 90 días) ────────────
-- 5.661 INSERT: 4.105 sin auth.uid() (service_role/cron/SQL), 1.556 con usuario,
-- 577 de no-staff de la escuela del cobro. De esos, 482 llevan qr_id (RPC
-- SECURITY DEFINER del QR: monto del servidor, NO los toca este trigger) y ~95
-- son INSERT directos del navegador (PaymentCheckoutModal: TRF-/SCH-WOMPI-/
-- SCH-MP-; ParentCheckoutPage sin payment_id): NULL 75, mensualidad 15,
-- torneo 1, otro 1, articulos 1. Todos con hijo PROPIO (children.parent_id) o
-- adulto (parent_id = él, sin child/user_id); 0 con unregistered_athlete_id,
-- 0 con user_id ajeno, 0 con qr_id, 0 con offering_plan_id.
-- Montos de mensualidad/inscripción de no-staff que NO coinciden con ninguna
-- tarifa del atleta: 4 filas — 3 son de register_for_internal_tournament (RPC,
-- categoría NULL = H1, datos QA) y 1 Wompi de agosto (12d0a3cd…) con
-- monthly_fee editado DESPUÉS del pago (fee_set_at 08-31): a revisar, no
-- concluyente. Nada se modifica aquí.
-- Tarifas: enrollments activas/pending 1.405; 387 sin ningún precio (no pueden
-- crear mensualidad desde el navegador ni hoy: CHECK amount > 0); 0 con
-- precio de equipo ≠ precio de plan cuando falta monthly_fee (el orden
-- equipo/plan no cambia ningún valor hoy).
-- anon: ninguna escritura de anon puede prosperar hoy (INSERT: la guardia exige
-- escuela propia → user_school_ids() vacío; UPDATE: todas las policies exigen
-- auth.uid(); DELETE: ninguna policy permisiva). Ningún camino legítimo
-- escribe payments como anon (los públicos van por RPC SECURITY DEFINER o por
-- el BFF con service_role) → el REVOKE no rompe nada.
--
-- ── El arreglo ────────────────────────────────────────────────────────────────
-- 1. public._payments_cobro_cliente_normalizar(payments) — SECURITY DEFINER
--    (lee enrollments/offering_plans/teams/children sin depender del RLS del
--    acudiente). Recibe la fila y la devuelve corregida, usando auth.uid():
--      Identidad (si no, 42501 PAYMENT_FIELD_LOCKED):
--        · child_id NULL o hijo propio (children.parent_id = auth.uid());
--        · parent_id y user_id NULL o = auth.uid();
--        · unregistered_athlete_id y qr_id NULL (solo los ponen RPC/BFF).
--      Monto según categoría efectiva (NULL = mensualidad, como la lista blanca
--      de 20261010130450):
--        · mensualidad: tarifa de la inscripción del atleta en esa escuela
--          COALESCE(NULLIF(e.monthly_fee,0), NULLIF(t.price_monthly,0),
--          NULLIF(op.price,0)) — el MISMO orden que get_athlete_enrollments
--          (lo que el acudiente ve). Elige la inscripción: activa > pending >
--          cancelada; luego la que coincide con offering_plan_id / team_id que
--          mandó el cliente; luego la que coincide con el monto pedido (dos
--          planes del mismo hijo); luego la más reciente. Sin inscripción:
--          children.monthly_fee → teams(children.team_id).price_monthly
--          (legado "equipo directo" de MyPaymentsPage). Sin tarifa → P0001
--          PAYMENT_AMOUNT_UNPRICED (la escuela genera el cobro).
--          offering_plan_id: si el cliente mandó uno, queda el de la inscripción
--          elegida; si no mandó, sigue NULL (no se cambia qué extiende vigencia).
--          period_uniqueness_exempt := false (una mensualidad ocupa su mes).
--        · inscripcion / seguro: offering_plans.registration_fee / insurance_fee
--          de la inscripción elegida si > 0 (lo mismo que cobra
--          emit_enrollment_fees). Si el plan no tiene ese valor, el monto queda
--          (no hay tarifa que saltarse) y offering_plan_id := NULL.
--          period_uniqueness_exempt := true (cobro único).
--        · resto (otro/abono, articulos, torneo, clase_extra, …): monto libre
--          (abono voluntario / catálogo), pero offering_plan_id := NULL y
--          period_uniqueness_exempt := true: nunca da vigencia ni ocupa el cupo
--          del mes de la mensualidad.
-- 2. public.fn_payments_monto_cobro_cliente() — trigger SECURITY INVOKER
--    (como la guardia): decide "cliente directo" con current_user IN
--    ('authenticated','anon'). Dentro de una RPC SECURITY DEFINER (QR, torneo,
--    clase de prueba, open_month…) current_user es el dueño → no se toca.
--    service_role (BFF, webhooks, crons) y SQL editor tampoco. El personal de
--    la escuela (user_staff_school_ids(), mismo criterio que la guardia) sale:
--    lo cubren S2/S3.
--    Trigger trg_zzy_monto_cobro_cliente BEFORE INSERT: los BEFORE disparan
--    en orden alfabético → corre DESPUÉS de trg_payments_fill_period y
--    trg_zz_guard_payments_client y ANTES de trg_zzz_payments_descuentos_automaticos
--    (F1) y trg_zzz_pronto_pago_servidor (S1), que así calculan sobre el monto
--    del servidor.
--    La normalizadora necesita EXECUTE para authenticated (el trigger corre
--    como el invocador; SECURITY DEFINER no exime del EXECUTE). Invocada como
--    RPC solo devuelve la tarifa de los hijos propios (lo mismo que ya ve en
--    Mis pagos); no escribe nada.
-- 3. REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON payments
--    FROM anon (de tabla: revoca también los privilegios de columna). SELECT
--    de anon no se toca aquí (las policies ya no le devuelven filas).
--
-- Lo que NO cambia: el acudiente paga un cobro existente (UPDATE a
-- awaiting_approval con comprobante: lo rige la guardia); el checkout que crea
-- la mensualidad de un mes adelantado (mismo monto que ya mostraba); torneos
-- (register_for_internal_tournament, RPC), QR, clase de prueba, tienda
-- (tablas propias), BFF. No se toca fn_guard_payments_client,
-- auto_approve_payment ni fn_extend_enrollment_on_payment_paid.
-- =============================================================================

BEGIN;

-- ── 1. Normalizadora (SECURITY DEFINER) ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public._payments_cobro_cliente_normalizar(p public.payments)
RETURNS public.payments
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_uid        uuid := auth.uid();
    v_cat        text := COALESCE(p.payment_category, 'mensualidad');
    v_tarifa     numeric;
    v_plan       uuid;
    v_encontrado boolean := false;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'PAYMENT_FIELD_LOCKED: sesión'
            USING ERRCODE = '42501', HINT = 'Inicia sesión para registrar un pago.';
    END IF;

    -- ── Identidad: el cobro es del propio usuario o de un hijo suyo ─────────
    IF p.unregistered_athlete_id IS NOT NULL THEN
        RAISE EXCEPTION 'PAYMENT_FIELD_LOCKED: unregistered_athlete_id' USING ERRCODE = '42501';
    END IF;
    IF p.qr_id IS NOT NULL THEN
        RAISE EXCEPTION 'PAYMENT_FIELD_LOCKED: qr_id' USING ERRCODE = '42501';
    END IF;
    IF p.user_id IS NOT NULL AND p.user_id <> v_uid THEN
        RAISE EXCEPTION 'PAYMENT_FIELD_LOCKED: user_id' USING ERRCODE = '42501';
    END IF;
    IF p.parent_id IS NOT NULL AND p.parent_id <> v_uid THEN
        RAISE EXCEPTION 'PAYMENT_FIELD_LOCKED: parent_id' USING ERRCODE = '42501';
    END IF;
    IF p.child_id IS NOT NULL AND NOT EXISTS (
           SELECT 1 FROM public.children c
            WHERE c.id = p.child_id AND c.parent_id = v_uid) THEN
        RAISE EXCEPTION 'PAYMENT_FIELD_LOCKED: child_id'
            USING ERRCODE = '42501',
                  HINT = 'Solo puedes registrar pagos de tus propios deportistas.';
    END IF;

    -- ── Categorías sin tarifa de servidor: monto libre, sin efectos ─────────
    IF v_cat NOT IN ('mensualidad', 'inscripcion', 'seguro') THEN
        p.offering_plan_id := NULL;
        p.period_uniqueness_exempt := true;
        RETURN p;
    END IF;

    -- ── Tarifa de la inscripción del atleta en esa escuela ─────────────────
    SELECT c.tarifa, c.offering_plan_id
      INTO v_tarifa, v_plan
      FROM (
        SELECT e.offering_plan_id, e.team_id, e.scheduling_team_id, e.status, e.created_at,
               CASE v_cat
                 WHEN 'mensualidad' THEN COALESCE(NULLIF(e.monthly_fee, 0),
                                                  NULLIF(t.price_monthly, 0),
                                                  NULLIF(op.price, 0))
                 WHEN 'inscripcion' THEN NULLIF(op.registration_fee, 0)
                 WHEN 'seguro'      THEN NULLIF(op.insurance_fee, 0)
               END AS tarifa
          FROM public.enrollments e
          LEFT JOIN public.teams          t  ON t.id  = e.team_id
          LEFT JOIN public.offering_plans op ON op.id = e.offering_plan_id
         WHERE e.school_id = p.school_id
           AND e.status IN ('active', 'pending', 'cancelled')
           AND (
                 (p.child_id IS NOT NULL AND e.child_id = p.child_id)
              OR (p.child_id IS NULL
                  AND e.child_id IS NULL
                  AND e.unregistered_athlete_id IS NULL
                  AND e.user_id = v_uid)
               )
      ) c
     WHERE c.tarifa IS NOT NULL
     -- COALESCE(…, false): un booleano NULL ordenaría PRIMERO con DESC.
     ORDER BY (c.status = 'active') DESC,
              (c.status = 'pending') DESC,
              COALESCE(c.offering_plan_id = p.offering_plan_id, false) DESC,
              COALESCE(c.team_id = p.team_id OR c.scheduling_team_id = p.team_id, false) DESC,
              COALESCE(c.tarifa = p.amount, false) DESC,
              c.created_at DESC NULLS LAST
     LIMIT 1;
    v_encontrado := FOUND;

    -- Legado "equipo directo" (hijo sin inscripción): solo mensualidad.
    IF NOT v_encontrado AND v_cat = 'mensualidad' AND p.child_id IS NOT NULL THEN
        SELECT COALESCE(NULLIF(ch.monthly_fee, 0), NULLIF(t.price_monthly, 0))
          INTO v_tarifa
          FROM public.children ch
          LEFT JOIN public.teams t ON t.id = ch.team_id
         WHERE ch.id = p.child_id
           AND ch.school_id = p.school_id;
        v_plan := NULL;
        v_encontrado := v_tarifa IS NOT NULL;
    END IF;

    IF v_cat = 'mensualidad' THEN
        IF NOT v_encontrado OR COALESCE(v_tarifa, 0) <= 0 THEN
            RAISE EXCEPTION 'No encontramos el valor de la mensualidad de este deportista en la escuela. Pídele a la escuela que te genere el cobro.'
                USING ERRCODE = 'P0001', DETAIL = 'PAYMENT_AMOUNT_UNPRICED';
        END IF;
        p.amount := v_tarifa;
        IF p.offering_plan_id IS NOT NULL THEN
            p.offering_plan_id := v_plan;
        END IF;
        p.period_uniqueness_exempt := false;
        RETURN p;
    END IF;

    -- inscripcion / seguro
    IF v_encontrado AND COALESCE(v_tarifa, 0) > 0 THEN
        p.amount := v_tarifa;
        p.offering_plan_id := v_plan;
    ELSE
        p.offering_plan_id := NULL;
    END IF;
    p.period_uniqueness_exempt := true;
    RETURN p;
END;
$function$;

COMMENT ON FUNCTION public._payments_cobro_cliente_normalizar(public.payments) IS
  'S4: normaliza un INSERT de payments hecho por un acudiente/atleta (no staff) desde el navegador: identidad propia, monto de mensualidad/inscripción/seguro desde la tarifa de la inscripción, cobros únicos sin vigencia ni cupo de mes. No escribe.';

REVOKE ALL ON FUNCTION public._payments_cobro_cliente_normalizar(public.payments) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._payments_cobro_cliente_normalizar(public.payments) FROM anon, authenticated;
-- El trigger corre como el invocador (authenticated): necesita EXECUTE.
GRANT EXECUTE ON FUNCTION public._payments_cobro_cliente_normalizar(public.payments) TO authenticated;
GRANT EXECUTE ON FUNCTION public._payments_cobro_cliente_normalizar(public.payments) TO service_role;

-- ── 2. Trigger (SECURITY INVOKER: current_user dice si es cliente directo) ───
CREATE OR REPLACE FUNCTION public.fn_payments_monto_cobro_cliente()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
    -- Solo INSERT directo de PostgREST con JWT de usuario. Dentro de una RPC
    -- SECURITY DEFINER current_user es el dueño de la RPC; service_role, crons
    -- y SQL editor tampoco son cliente.
    IF current_user NOT IN ('authenticated', 'anon') THEN
        RETURN NEW;
    END IF;

    -- Personal de la escuela del cobro: mismo criterio que la guardia (S2/S3).
    IF NEW.school_id IS NOT NULL
       AND NEW.school_id = ANY (public.user_staff_school_ids()) THEN
        RETURN NEW;
    END IF;

    NEW := public._payments_cobro_cliente_normalizar(NEW);
    RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.fn_payments_monto_cobro_cliente() IS
  'S4: BEFORE INSERT en payments. Para acudiente/atleta (no staff) desde el navegador, el monto y los vínculos los pone el servidor (_payments_cobro_cliente_normalizar).';

REVOKE ALL ON FUNCTION public.fn_payments_monto_cobro_cliente() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_payments_monto_cobro_cliente() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_zzy_monto_cobro_cliente ON public.payments;
CREATE TRIGGER trg_zzy_monto_cobro_cliente
    BEFORE INSERT ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.fn_payments_monto_cobro_cliente();

-- ── 3. anon no escribe payments ──────────────────────────────────────────────
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.payments FROM anon;

COMMIT;
