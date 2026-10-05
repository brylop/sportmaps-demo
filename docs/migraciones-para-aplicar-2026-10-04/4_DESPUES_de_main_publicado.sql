-- =====================================================================
-- PASO 4 — NO CORRER AHORA. Solo cuando main esté publicado con el frontend nuevo (rompe el checkout viejo y los enlaces darían 404)
-- Generado 2026-10-04. Pegar COMPLETO en el SQL Editor de Supabase y Run.
-- Cada migración trae su propio BEGIN/COMMIT: si una falla, las anteriores
-- quedan aplicadas y registradas; corregir y seguir desde la que falló.
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- 20261002125957_guard_payments_escritura_cliente.sql
-- ─────────────────────────────────────────────────────────────────────
-- =============================================================================
-- 20261002125957_guard_payments_escritura_cliente.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-02   Versión anterior: 20261002125955
-- Objetivo: A1 de docs/auditoria-contabilidad-tienda-2026-10-02.md. Un padre o
--   atleta podía insertar un pago ya 'paid', con el monto que quisiera, o pasar
--   a 'paid' un cobro suyo: las policies de INSERT/UPDATE solo exigen
--   parent_id/user_id = auth.uid() y ningún trigger protegía status ni amount.
--   'paid' extiende la vigencia (trg_extend_enrollment_on_payment_paid), abre el
--   torniquete (trg_sync_access_group_on_payment) y suma en cash_ledger.
--   Además dos veces (30-sep, 01-oct) un padre revirtió un pago aprobado a
--   'awaiting_approval' (cobro 3490fed0…).
--
--   Este trigger congela, para quien NO es staff de la escuela y escribe directo
--   por PostgREST, todo lo que es dinero o estado. Deja pasar el envío de
--   comprobante (→ awaiting_approval) tal como lo hace hoy el frontend.
--   Spec: docs/specs/blindaje-dinero-pagos-tienda-nomina.md §1.2.
--
--   Por qué así:
--   · Solo actúa si current_user IN ('authenticated','anon'). Las 35 RPC que
--     escriben payments son SECURITY DEFINER de postgres y el BFF usa
--     service_role: ninguna pasa por el guard.
--   · La función es SECURITY INVOKER a propósito. Si fuera DEFINER, current_user
--     sería siempre postgres y no protegería nada.
--   · Staff = user_staff_school_ids() (incluye schools.owner_id). NO
--     staff_school_ids(), que deja por fuera a los owners.
--   · Se compara con IS DISTINCT FROM: reescribir el mismo valor no falla.
--   · Nombre trg_zz_…: los BEFORE corren en orden alfabético; este va último y
--     ve el NEW final (después de clear_payment_review_on_settle y fill_period).
--
--   ⚠️ Desplegar ANTES el frontend que deja de escribir 'paid' (ParentCheckoutPage
--   en Wompi). Si no, el padre que paga en línea ve un error aunque el webhook
--   sí registre el pago.
--   Residual conocido (F2): el monto del INSERT lo sigue mandando el cliente (A2),
--   y un coach cuenta como staff (user_staff_school_ids lo incluye).
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

CREATE OR REPLACE FUNCTION public.fn_guard_payments_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
DECLARE
    v_open_states text[] := ARRAY['pending','overdue','partial','rejected','failed','awaiting_approval'];
    v_col text;
BEGIN
    -- RPC SECURITY DEFINER (postgres), BFF (service_role), SQL editor: no aplica.
    IF current_user NOT IN ('authenticated', 'anon') THEN
        RETURN NEW;
    END IF;

    -- Staff de la escuela del cobro: opera como hoy.
    IF NEW.school_id IS NOT NULL
       AND NEW.school_id = ANY (public.user_staff_school_ids())
       AND (TG_OP = 'INSERT' OR OLD.school_id IS NOT DISTINCT FROM NEW.school_id) THEN
        RETURN NEW;
    END IF;

    -- ── INSERT ───────────────────────────────────────────────────────────────
    IF TG_OP = 'INSERT' THEN
        -- Solo en una escuela de la que es miembro activo (padre/atleta) o donde
        -- tiene un hijo. La policy solo exige parent_id = auth.uid(), así que sin
        -- esto un padre de otra escuela podía crear cobros aquí. Radio medido:
        -- los 103 INSERT no-staff de los últimos 60 días cumplen.
        IF NEW.school_id IS NULL
           OR NOT (
                NEW.school_id = ANY (public.user_school_ids())
                OR EXISTS (SELECT 1 FROM public.children c
                            WHERE c.parent_id = auth.uid() AND c.school_id = NEW.school_id)
           ) THEN
            RAISE EXCEPTION 'PAYMENT_FIELD_LOCKED: school_id' USING ERRCODE = '42501',
                HINT = 'Solo puedes registrar pagos en una escuela de la que eres miembro.';
        END IF;
        IF NEW.status NOT IN ('pending', 'awaiting_approval') THEN
            RAISE EXCEPTION 'PAYMENT_FIELD_LOCKED: status'
                USING ERRCODE = '42501',
                      HINT = 'Solo la escuela o la pasarela marcan un pago como pagado.';
        END IF;

        v_col := CASE
            WHEN COALESCE(NEW.amount_paid, 0) <> 0      THEN 'amount_paid'
            WHEN NEW.approved_at IS NOT NULL            THEN 'approved_at'
            WHEN NEW.approved_by IS NOT NULL            THEN 'approved_by'
            WHEN COALESCE(NEW.late_fee_amount, 0) <> 0  THEN 'late_fee_amount'
            WHEN NEW.late_fee_applied_at IS NOT NULL    THEN 'late_fee_applied_at'
            WHEN NEW.gross_amount IS NOT NULL           THEN 'gross_amount'
            WHEN NEW.sportmaps_fee IS NOT NULL          THEN 'sportmaps_fee'
            WHEN NEW.epayco_fee IS NOT NULL             THEN 'epayco_fee'
            WHEN NEW.wompi_transaction_id IS NOT NULL   THEN 'wompi_transaction_id'
            WHEN NEW.provider_transaction_id IS NOT NULL THEN 'provider_transaction_id'
            WHEN NEW.cash_session_id IS NOT NULL        THEN 'cash_session_id'
            WHEN NEW.reconciliation_status IS NOT NULL  THEN 'reconciliation_status'
            WHEN NEW.unblocked_at IS NOT NULL           THEN 'unblocked_at'
            WHEN NEW.unblocked_by IS NOT NULL           THEN 'unblocked_by'
        END;
        IF v_col IS NOT NULL THEN
            RAISE EXCEPTION 'PAYMENT_FIELD_LOCKED: %', v_col USING ERRCODE = '42501';
        END IF;
        RETURN NEW;
    END IF;

    -- ── UPDATE ───────────────────────────────────────────────────────────────
    -- Un cobro cerrado no se reabre desde el navegador.
    -- Sin updated_at: trg_updated_at corre antes (orden alfabético) y lo cambia
    -- siempre, así que una reescritura idéntica igual se vería "distinta".
    IF OLD.status IN ('paid', 'glosado', 'cancelled')
       AND (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
        RAISE EXCEPTION 'PAYMENT_FIELD_LOCKED: status (cobro %)', OLD.status USING ERRCODE = '42501';
    END IF;

    -- La única transición permitida es enviar un comprobante.
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NOT (NEW.status = 'awaiting_approval' AND OLD.status = ANY (v_open_states)) THEN
        RAISE EXCEPTION 'PAYMENT_FIELD_LOCKED: status (% -> %)', OLD.status, NEW.status
            USING ERRCODE = '42501';
    END IF;

    v_col := CASE
        WHEN NEW.amount                   IS DISTINCT FROM OLD.amount                   THEN 'amount'
        WHEN NEW.amount_paid              IS DISTINCT FROM OLD.amount_paid              THEN 'amount_paid'
        WHEN NEW.school_id                IS DISTINCT FROM OLD.school_id                THEN 'school_id'
        WHEN NEW.branch_id                IS DISTINCT FROM OLD.branch_id                THEN 'branch_id'
        WHEN NEW.offering_plan_id         IS DISTINCT FROM OLD.offering_plan_id         THEN 'offering_plan_id'
        WHEN NEW.team_id                  IS DISTINCT FROM OLD.team_id                  THEN 'team_id'
        WHEN NEW.child_id                 IS DISTINCT FROM OLD.child_id                 THEN 'child_id'
        WHEN NEW.parent_id                IS DISTINCT FROM OLD.parent_id                THEN 'parent_id'
        WHEN NEW.user_id                  IS DISTINCT FROM OLD.user_id                  THEN 'user_id'
        WHEN NEW.unregistered_athlete_id  IS DISTINCT FROM OLD.unregistered_athlete_id  THEN 'unregistered_athlete_id'
        WHEN NEW.coach_id                 IS DISTINCT FROM OLD.coach_id                 THEN 'coach_id'
        WHEN NEW.late_fee_amount          IS DISTINCT FROM OLD.late_fee_amount          THEN 'late_fee_amount'
        WHEN NEW.late_fee_applied_at      IS DISTINCT FROM OLD.late_fee_applied_at      THEN 'late_fee_applied_at'
        WHEN NEW.approved_at              IS DISTINCT FROM OLD.approved_at              THEN 'approved_at'
        WHEN NEW.approved_by              IS DISTINCT FROM OLD.approved_by              THEN 'approved_by'
        WHEN NEW.rejection_reason         IS DISTINCT FROM OLD.rejection_reason         THEN 'rejection_reason'
        WHEN NEW.gross_amount             IS DISTINCT FROM OLD.gross_amount             THEN 'gross_amount'
        WHEN NEW.sportmaps_fee            IS DISTINCT FROM OLD.sportmaps_fee            THEN 'sportmaps_fee'
        WHEN NEW.epayco_fee               IS DISTINCT FROM OLD.epayco_fee               THEN 'epayco_fee'
        WHEN NEW.payment_category         IS DISTINCT FROM OLD.payment_category         THEN 'payment_category'
        WHEN NEW.period_uniqueness_exempt IS DISTINCT FROM OLD.period_uniqueness_exempt THEN 'period_uniqueness_exempt'
        WHEN NEW.sibling_discount_applied IS DISTINCT FROM OLD.sibling_discount_applied THEN 'sibling_discount_applied'
        WHEN NEW.due_date                 IS DISTINCT FROM OLD.due_date                 THEN 'due_date'
        WHEN NEW.concept                  IS DISTINCT FROM OLD.concept                  THEN 'concept'
        WHEN NEW.payment_type             IS DISTINCT FROM OLD.payment_type             THEN 'payment_type'
        WHEN NEW.provider_transaction_id  IS DISTINCT FROM OLD.provider_transaction_id  THEN 'provider_transaction_id'
        WHEN NEW.wompi_transaction_id     IS DISTINCT FROM OLD.wompi_transaction_id     THEN 'wompi_transaction_id'
        WHEN NEW.wompi_id                 IS DISTINCT FROM OLD.wompi_id                 THEN 'wompi_id'
        WHEN NEW.cash_session_id          IS DISTINCT FROM OLD.cash_session_id          THEN 'cash_session_id'
        WHEN NEW.reconciliation_status    IS DISTINCT FROM OLD.reconciliation_status    THEN 'reconciliation_status'
        WHEN NEW.requires_review          IS DISTINCT FROM OLD.requires_review          THEN 'requires_review'
        WHEN NEW.unblocked_at             IS DISTINCT FROM OLD.unblocked_at             THEN 'unblocked_at'
        WHEN NEW.unblocked_by             IS DISTINCT FROM OLD.unblocked_by             THEN 'unblocked_by'
        -- Período: el modal lo estampa al reusar un cobro que no lo tenía.
        WHEN OLD.period_year  IS NOT NULL AND NEW.period_year  IS DISTINCT FROM OLD.period_year  THEN 'period_year'
        WHEN OLD.period_month IS NOT NULL AND NEW.period_month IS DISTINCT FROM OLD.period_month THEN 'period_month'
        -- Fecha del comprobante y descuento por pronto pago: solo al enviar un
        -- comprobante, que la escuela revisa antes de aprobar.
        WHEN NEW.status <> 'awaiting_approval'
             AND NEW.payment_date IS DISTINCT FROM OLD.payment_date THEN 'payment_date'
        WHEN NEW.status <> 'awaiting_approval'
             AND NEW.early_payment_discount_applied IS DISTINCT FROM OLD.early_payment_discount_applied
             THEN 'early_payment_discount_applied'
    END;
    IF v_col IS NOT NULL THEN
        RAISE EXCEPTION 'PAYMENT_FIELD_LOCKED: %', v_col USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.fn_guard_payments_client() IS
  'Congela dinero y estado de payments para escrituras directas (PostgREST) de quien no es staff de la escuela. SECURITY INVOKER a propósito. Spec blindaje-dinero §1.2.';

-- Es función de trigger: nadie la invoca directo.
REVOKE ALL ON FUNCTION public.fn_guard_payments_client() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_zz_guard_payments_client ON public.payments;
CREATE TRIGGER trg_zz_guard_payments_client
    BEFORE INSERT OR UPDATE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.fn_guard_payments_client();

COMMIT;

-- Registro (el SQL Editor no deja rastro en schema_migrations)
insert into supabase_migrations.schema_migrations (version, name, created_by)
values ('20261002125957', '20261002125957_guard_payments_escritura_cliente', 'sql-editor 2026-10-04') on conflict (version) do nothing;


-- ─────────────────────────────────────────────────────────────────────
-- 20261004083707_cobro_enlace_publico.sql
-- ─────────────────────────────────────────────────────────────────────
-- =============================================================================
-- 20261004083707_cobro_enlace_publico.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-04   Versión anterior: 20261004080918
-- Objetivo: el enlace público de UN cobro — https://sportmaps.co/p/<token> —
-- que llevan como botón las plantillas de cobranza de WhatsApp
-- (bff/whatsapp-templates/*.json). Sin esta ruta la cobranza por WhatsApp no
-- sale nunca: el job manda null en el botón y cae a correo
-- (payment-lifecycle-emails.job.ts, motivo 'sin_enlace').
--
-- Por qué una tabla nueva y no `payment_links.token`:
--   · payment_links es una SESIÓN DE CHECKOUT: nace con la pasarela ya elegida
--     (provider_reference), vive 72 h y el índice único parcial
--     uq_payment_links_one_pending_per_payment permite UNA sola 'pending' por
--     cobro. Un enlace de WhatsApp vive 30 días y todavía no sabe si la familia
--     va a pagar en línea o por transferencia. Meterlo ahí bloquearía el
--     checkout real del cobro (23505) o lo expiraría a las 72 h.
--   · Al pagar en línea desde /p/<token> SÍ se crea un payment_link normal
--     (el mismo que crea POST /payments/create-session), así el webhook de
--     Wompi lo concilia sin cambios.
--
-- Seguridad (CLAUDE.md):
--   · RLS activa y SIN policies: nadie fuera de service_role lee la tabla. El
--     token es la credencial; una policy "by_token" sería USING(true)
--     (trampa 5). La resolución va por RPC SECURITY DEFINER que recibe el token.
--   · Las RPC son solo para service_role (las llama el BFF). REVOKE explícito a
--     anon y authenticated (trampa 3: REVOKE FROM PUBLIC no alcanza).
--   · Token: 18 bytes aleatorios de pgcrypto → 24 caracteres base64url
--     (144 bits). No contiene el payment_id ni nada derivable.
--   · Estados en text + CHECK, no CREATE TYPE.
--
-- NO APLICADA. Hasta que se aplique, el BFF degrada solo: tokenDelBoton()
-- devuelve null (sigue saliendo el correo) y /p/<token> responde "enlace no
-- válido".
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.payment_public_tokens (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id      uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
    school_id       uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    token           text NOT NULL UNIQUE
                    CHECK (token ~ '^[A-Za-z0-9_-]{24}$'),
    -- active   → el que se reusa en los envíos nuevos del mismo cobro.
    -- replaced → se emitió uno nuevo porque a este le quedaban < 7 días; SIGUE
    --            abriendo hasta su expires_at (la familia puede tener el
    --            WhatsApp viejo en el chat).
    -- revoked  → no abre más (anulación manual).
    status          text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'replaced', 'revoked')),
    expires_at      timestamptz NOT NULL,
    open_count      integer NOT NULL DEFAULT 0,
    last_opened_at  timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- Un solo token 'active' por cobro: es el que se reusa en cada envío.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_public_tokens_one_active
    ON public.payment_public_tokens (payment_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_payment_public_tokens_school
    ON public.payment_public_tokens (school_id);

COMMENT ON TABLE public.payment_public_tokens IS
    'Enlace público sin login de UN cobro (https://sportmaps.co/p/<token>). Solo service_role; '
    'se emite con cobro_enlace_publico_emitir() y se resuelve con cobro_enlace_publico_resolver().';

ALTER TABLE public.payment_public_tokens ENABLE ROW LEVEL SECURITY;
-- Sin policies a propósito. Y sin privilegios para los roles de PostgREST:
-- los default privileges del esquema se los otorgan a anon/authenticated.
REVOKE ALL ON TABLE public.payment_public_tokens FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.payment_public_tokens TO service_role;

-- ── Emitir (o reusar) el token de un cobro ──────────────────────────────────
-- Reusa el 'active' si le quedan más de 7 días; si no, lo pasa a 'replaced'
-- (sigue abriendo hasta vencer) y emite uno nuevo. Así cada escalón de la
-- cobranza (día -5 … +12) manda el MISMO enlace mientras sea útil.
CREATE OR REPLACE FUNCTION public.cobro_enlace_publico_emitir(
    p_payment_id uuid,
    p_dias integer DEFAULT 30
)
RETURNS TABLE (enlace_token text, vence_en timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_school  uuid;
    v_dias    integer := LEAST(GREATEST(COALESCE(p_dias, 30), 1), 90);
    v_actual  public.payment_public_tokens%ROWTYPE;
BEGIN
    -- Serializa por cobro sin tomar lock de fila sobre payments (tabla caliente:
    -- el webhook y open_month la escriben). Dos envíos simultáneos del mismo
    -- cobro no pueden crear dos 'active' (además lo impide el índice único).
    PERFORM pg_advisory_xact_lock(hashtextextended('cobro_enlace_publico:' || p_payment_id::text, 0));

    SELECT p.school_id INTO v_school FROM public.payments p WHERE p.id = p_payment_id;
    IF v_school IS NULL THEN
        RAISE EXCEPTION 'cobro_no_existe' USING ERRCODE = 'P0002';
    END IF;

    SELECT t.* INTO v_actual
      FROM public.payment_public_tokens t
     WHERE t.payment_id = p_payment_id AND t.status = 'active';

    IF FOUND AND v_actual.expires_at > now() + interval '7 days' THEN
        RETURN QUERY SELECT v_actual.token, v_actual.expires_at;
        RETURN;
    END IF;

    IF FOUND THEN
        UPDATE public.payment_public_tokens t
           SET status = 'replaced'
         WHERE t.id = v_actual.id;
    END IF;

    RETURN QUERY
    INSERT INTO public.payment_public_tokens AS t (payment_id, school_id, token, expires_at)
    VALUES (
        p_payment_id,
        v_school,
        translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'),
        now() + make_interval(days => v_dias)
    )
    RETURNING t.token, t.expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.cobro_enlace_publico_emitir(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cobro_enlace_publico_emitir(uuid, integer) TO service_role;

-- ── Resolver un token ───────────────────────────────────────────────────────
-- Sin fila = no existe (el BFF responde lo mismo que a un token mal formado,
-- para no dar un oráculo de existencia). 'vencido' y 'revocado' sí se
-- distinguen: el que los tiene ya tuvo el enlace legítimo.
CREATE OR REPLACE FUNCTION public.cobro_enlace_publico_resolver(p_token text)
RETURNS TABLE (payment_id uuid, school_id uuid, vence_en timestamptz, estado text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_row public.payment_public_tokens%ROWTYPE;
BEGIN
    IF p_token IS NULL OR p_token !~ '^[A-Za-z0-9_-]{24}$' THEN
        RETURN;
    END IF;

    SELECT t.* INTO v_row FROM public.payment_public_tokens t WHERE t.token = p_token;
    IF NOT FOUND THEN
        RETURN;
    END IF;

    IF v_row.status = 'revoked' THEN
        RETURN QUERY SELECT v_row.payment_id, v_row.school_id, v_row.expires_at, 'revocado'::text;
        RETURN;
    END IF;

    IF v_row.expires_at <= now() THEN
        RETURN QUERY SELECT v_row.payment_id, v_row.school_id, v_row.expires_at, 'vencido'::text;
        RETURN;
    END IF;

    -- Métrica mínima: ¿la familia abre el enlace? (la cobranza por WhatsApp
    -- se mide por esto antes que por pagos).
    UPDATE public.payment_public_tokens t
       SET open_count = t.open_count + 1, last_opened_at = now()
     WHERE t.id = v_row.id;

    RETURN QUERY SELECT v_row.payment_id, v_row.school_id, v_row.expires_at, 'vigente'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.cobro_enlace_publico_resolver(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cobro_enlace_publico_resolver(text) TO service_role;

COMMIT;

-- Registro (el SQL Editor no deja rastro en schema_migrations)
insert into supabase_migrations.schema_migrations (version, name, created_by)
values ('20261004083707', '20261004083707_cobro_enlace_publico', 'sql-editor 2026-10-04') on conflict (version) do nothing;
