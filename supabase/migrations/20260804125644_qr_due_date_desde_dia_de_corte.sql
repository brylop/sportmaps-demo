-- =============================================================================
-- 20260804125644_qr_due_date_desde_dia_de_corte.sql
-- Autor: brylop   Fecha: 2026-08-04   Versión anterior: 20260803153633
-- Objetivo: que los cobros del QR nazcan con un vencimiento real (día de corte de
--   la escuela) en vez de vencer el mismo día en que se crean, y que los motores
--   de mora no marquen vencido lo que no lo está.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================
--
-- HALLAZGO
--
-- El panel de Cuentas por Cobrar mostraba 5 cobros de DYNASTY VOLLEY CLUB como
-- vencidos con 1 a 3 días de mora, sobre inscripciones que arrancaron en agosto.
-- No era la mora: era el vencimiento.
--
-- Las dos vías del QR insertaban `due_date = CURRENT_DATE`, es decir el cobro
-- vencía el mismo día en que se creaba. Medido sobre la escuela completa:
--
--     vía                              cobros   plazo promedio   vencen el día 10
--     submit_qr_signup                    15       0.13 días            0
--     generate_qr_monthly_charge           5       0.20 días            0
--     open_month (vía canónica)          311      10.57 días          311
--
-- `open_month` lee `school_settings.payment_cutoff_day` (20260803114540:107-114);
-- las del QR nunca lo miraron. Misma escuela, mismo mes, mismo corte (día 10):
-- los 310 cobros de agosto de open_month vencen el 2026-08-10 y ninguno está
-- vencido; los del QR vencen entre el 29 de julio y el 3 de agosto.
--
-- Y `CURRENT_DATE` es UTC, no fecha de negocio: una inscripción creada el
-- 2026-08-02 a las 19:xx hora Colombia nació venciendo el 2026-08-03. Es el
-- mismo bug de fecha que cerró el commit 035dff3, que no llegó a estas RPCs.
--
-- Aparte, `generate_qr_monthly_charge` sacaba el PERÍODO de next_unpaid_period
-- (septiembre, si agosto ya está saldado) pero el VENCIMIENTO de CURRENT_DATE:
-- un cobro de septiembre vencido el 2 de agosto.
--
-- REGLA DE NEGOCIO (definida con el cliente, 2026-08-04)
--
-- El cobro del QR ES la mensualidad del mes en que el atleta se registra. La
-- matrícula la cobra la escuela por fuera de la plataforma. Un registro nuevo
-- paga UNA vez el valor del plan y queda al día — sin prorrateo y sin recargo,
-- se inscriba el día 2 o el 28. Eso ya coincide con billing_cycle_type =
-- 'fixed_calendar' ("siempre cobra el mes completo"), así que los MONTOS no se
-- tocan acá: lo único mal era la fecha.
--
-- QUÉ CAMBIA
--
--   1. Helpers `school_due_date` y `qr_first_charge_due_date`: una sola fórmula
--      del vencimiento, la misma que ya usa open_month.
--   2. `submit_qr_signup`: vencimiento desde el corte, período estampado
--      explícitamente, concepto de mensualidad (ya no "Primer pago"), y
--      offering_plan_id en el cobro.
--   3. `generate_qr_monthly_charge`: el vencimiento sale del mes DEL PERÍODO,
--      no del mes en curso.
--   4. `fn_expire_overdue_payments`: respetaba nada. Ahora respeta los días de
--      gracia, usa fecha Colombia y no marca vencido un período futuro.
--   5. `apply_late_fees`: mismo cinturón de período futuro.
--   6. Se desagenda el job `expire-overdue-payments` (duplicaba a
--      `apply-late-fees-daily`, que ya hacía lo mismo bien).
--
-- FUERA DE ALCANCE
--
-- Corregir los 5 cobros que ya nacieron mal (se hace con un script aparte, sobre
-- datos reales de la escuela) y el hecho de que `fn_extend_enrollment_on_payment_paid`
-- exige `enrollments.status = 'active'`: con require_first_payment la inscripción
-- nace 'pending', así que pasarle offering_plan_id al cobro es necesario pero
-- puede no ser suficiente para que se extienda `expires_at`. Ver el punto 2.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Helpers de vencimiento
-- ─────────────────────────────────────────────────────────────────────────────
-- Réplica exacta de la regla de open_month (20260803114540:107-114). Existe para
-- que no haya una cuarta fórmula del vencimiento en el sistema: hoy había tres
-- (open_month con corte, QR con CURRENT_DATE, generate_monthly_charges con corte
-- y rolling_30) y de ahí salió este bug.
--
-- No se expone a `authenticated` a propósito: es SECURITY DEFINER y leería
-- school_settings (RLS staff-only) para cualquier escuela. Las RPCs que la usan
-- ya son SECURITY DEFINER, así que la invocan como owner.
CREATE OR REPLACE FUNCTION public.school_due_date(
    p_school_id uuid,
    p_year      int,
    p_month     int
)
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT make_date(
        p_year,
        p_month,
        LEAST(
            -- Corte de la escuela, acotado a [1 .. último día del mes]: un corte
            -- 31 en febrero daría make_date inválido.
            GREATEST(
                COALESCE(
                    (SELECT ss.payment_cutoff_day
                       FROM public.school_settings ss
                      WHERE ss.school_id = p_school_id),
                    10),
                1),
            EXTRACT(day FROM (make_date(p_year, p_month, 1) + interval '1 month - 1 day'))::int
        )
    );
$$;

COMMENT ON FUNCTION public.school_due_date(uuid, int, int) IS
    'Vencimiento canónico de un cobro del período (p_year, p_month) para una escuela: día de corte acotado al último día del mes. Misma regla que open_month. Helper interno — no se concede a authenticated.';

REVOKE ALL ON FUNCTION public.school_due_date(uuid, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.school_due_date(uuid, int, int) TO service_role;


-- Vencimiento del PRIMER cobro de una inscripción por QR.
--
--     vence = LEAST( fin de mes,
--                    GREATEST( corte del mes de registro, hoy + días de gracia ) )
--
-- Con corte 10 y gracia 5, para un registro en agosto:
--     se registra el 2  → 10-ago  (el corte no ha pasado: igual que sus compañeros)
--     se registra el 8  → 13-ago  (el corte está encima: se le dan los 5 de gracia)
--     se registra el 15 → 20-ago  (el corte ya pasó: 5 días desde el registro)
--     se registra el 28 → 31-ago  (recortado al fin de mes, ver abajo)
--
-- El LEAST del fin de mes no es cosmético. `fn_payments_fill_period` deriva el
-- período del due_date, y aunque acá el período se estampa explícito, un
-- vencimiento en septiembre para una mensualidad de agosto haría que el índice
-- único uniq_payment_active_period_per_child no proteja el mes correcto y
-- open_month volviera a generar agosto. El vencimiento no cruza de mes.
--
-- Nota: con payment_grace_days = 0 y el corte ya pasado, el cobro vence hoy. Es
-- lo que significa "cero días de gracia"; se respeta la configuración.
CREATE OR REPLACE FUNCTION public.qr_first_charge_due_date(
    p_school_id uuid,
    p_today     date
)
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT LEAST(
        (date_trunc('month', p_today) + interval '1 month - 1 day')::date,
        GREATEST(
            public.school_due_date(
                p_school_id,
                EXTRACT(year  FROM p_today)::int,
                EXTRACT(month FROM p_today)::int),
            p_today + COALESCE(
                (SELECT ss.payment_grace_days
                   FROM public.school_settings ss
                  WHERE ss.school_id = p_school_id),
                0)
        )
    );
$$;

COMMENT ON FUNCTION public.qr_first_charge_due_date(uuid, date) IS
    'Vencimiento del primer cobro de una inscripción por QR: el más tardío entre el corte del mes y hoy+gracia, recortado al último día del mes de registro (para que el período no se corra al mes siguiente). Helper interno.';

REVOKE ALL ON FUNCTION public.qr_first_charge_due_date(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qr_first_charge_due_date(uuid, date) TO service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. submit_qr_signup
-- ─────────────────────────────────────────────────────────────────────────────
-- Base: 20260803110621 (inscripción completa con plan y cuota). Se conserva
-- íntegro el match de atleta por documento > nombre > crear, la adopción de
-- huérfanos y la idempotencia de inscripción y cobro. Cambia solo el cobro.
CREATE OR REPLACE FUNCTION public.submit_qr_signup(
    p_slug text, p_team_id uuid DEFAULT NULL, p_branch_id uuid DEFAULT NULL,
    p_child_full_name text DEFAULT NULL, p_child_dob date DEFAULT NULL,
    p_child_doc_type text DEFAULT NULL, p_child_doc_number text DEFAULT NULL,
    p_child_gender text DEFAULT NULL, p_phone text DEFAULT NULL,
    p_monthly_fee numeric DEFAULT NULL, p_existing_child_id uuid DEFAULT NULL,
    p_plan_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_user_id uuid := auth.uid(); v_qr record;
    v_school_id uuid; v_branch_id uuid; v_team_id uuid; v_plan_id uuid; v_child_id uuid;
    v_enrollment_id uuid; v_payment_id uuid; v_amount numeric; v_plan_price numeric;
    v_concept text; v_school_name text;
    v_doc text; v_match record;
    -- Fecha de negocio, no UTC. CURRENT_DATE hacía que una inscripción de las
    -- 19:xx hora Colombia naciera venciendo "mañana".
    v_today date := (now() AT TIME ZONE 'America/Bogota')::date;
    v_due_date date;
    v_py smallint; v_pm smallint;
    v_period_settled boolean := false;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
    SELECT * INTO v_qr FROM public.school_join_qr_codes WHERE slug = p_slug AND active = true;
    IF v_qr.id IS NULL THEN RAISE EXCEPTION 'QR not found or inactive' USING ERRCODE='02000'; END IF;
    IF v_qr.expires_at IS NOT NULL AND v_qr.expires_at < now() THEN RAISE EXCEPTION 'QR expired' USING ERRCODE='22023'; END IF;

    v_school_id := v_qr.school_id;
    v_branch_id := COALESCE(p_branch_id, v_qr.branch_id);
    v_team_id   := CASE WHEN v_qr.target_type = 'team' THEN v_qr.target_id ELSE p_team_id END;
    v_plan_id   := CASE WHEN v_qr.target_type = 'plan' THEN v_qr.target_id ELSE p_plan_id END;
    v_doc       := public.normalize_doc_number(p_child_doc_number);
    SELECT name INTO v_school_name FROM public.schools WHERE id = v_school_id;

    -- El cobro del QR es la mensualidad del mes de registro: el período es el mes
    -- en curso (no next_unpaid_period — un atleta nuevo no tiene historial) y el
    -- vencimiento sale del día de corte de la escuela.
    v_py       := EXTRACT(year  FROM v_today)::smallint;
    v_pm       := EXTRACT(month FROM v_today)::smallint;
    v_due_date := public.qr_first_charge_due_date(v_school_id, v_today);

    -- Adopta hijos pre-cargados de este correo (parent_id NULL) para no duplicar.
    PERFORM public.claim_orphan_children(v_school_id);

    -- Precio del plan (offering_plan validado contra la escuela) ------------
    IF v_plan_id IS NOT NULL THEN
        SELECT op.price INTO v_plan_price
        FROM public.offering_plans op
        WHERE op.id = v_plan_id AND op.school_id = v_school_id AND op.is_active = true;
        IF v_plan_price IS NULL THEN RAISE EXCEPTION 'Plan no válido para esta escuela' USING ERRCODE='22023'; END IF;
    END IF;

    -- Precio SERVER-SIDE: promo > plan > equipo > fallback cliente ----------
    v_amount := COALESCE(
        NULLIF(v_qr.fixed_amount, 0),
        NULLIF(v_plan_price, 0),
        (SELECT NULLIF(price_monthly, 0) FROM public.teams WHERE id = v_team_id AND school_id = v_school_id),
        NULLIF(p_monthly_fee, 0),
        0
    );

    UPDATE public.profiles SET role='parent', phone=COALESCE(phone,p_phone)
     WHERE id = v_user_id AND role NOT IN ('admin','school','school_admin','super_admin','organizer','coach','wellness_professional','store_owner');

    IF p_existing_child_id IS NOT NULL THEN
        SELECT id INTO v_child_id FROM public.children WHERE id = p_existing_child_id AND parent_id = v_user_id;
        IF v_child_id IS NULL THEN RAISE EXCEPTION 'Hijo no válido para este usuario' USING ERRCODE='42501'; END IF;
        UPDATE public.children
           SET school_id = COALESCE(school_id, v_school_id),
               branch_id = COALESCE(branch_id, v_branch_id),
               team_id   = COALESCE(team_id, v_team_id)
         WHERE id = v_child_id;
    ELSE
        -- ── (a) EL DOCUMENTO MANDA: match dentro de esta escuela ────────────
        -- Gana sobre el nombre porque el nombre lo teclea el acudiente y casi
        -- nunca coincide con el de la carga masiva ("Santiago Muñoz" vs
        -- "SANTIAGO MUÑOZ ALVAREZ"), y sobre el correo porque el correo
        -- pre-cargado puede venir con typo.
        IF v_doc IS NOT NULL THEN
            SELECT c.id, c.parent_id, c.full_name
              INTO v_match
              FROM public.children c
             WHERE c.school_id = v_school_id
               AND public.normalize_doc_number(c.doc_number) = v_doc
             ORDER BY (c.parent_id = v_user_id) DESC NULLS LAST,
                      (c.parent_id IS NULL) DESC,
                      c.created_at ASC
             LIMIT 1;

            IF v_match.id IS NOT NULL THEN
                IF v_match.parent_id IS NOT NULL AND v_match.parent_id <> v_user_id THEN
                    RAISE EXCEPTION
                        'El documento % ya está registrado en % a nombre de otro acudiente. Si es tu hijo/a, pídele a la escuela que lo vincule a tu cuenta.',
                        p_child_doc_number, COALESCE(v_school_name, 'esta escuela')
                        USING ERRCODE = '42501';
                END IF;

                v_child_id := v_match.id;

                -- Adopta el huérfano y corrige el correo temporal de una vez.
                UPDATE public.children
                   SET parent_id         = v_user_id,
                       parent_email_temp = COALESCE(
                           (SELECT LOWER(email) FROM auth.users WHERE id = v_user_id),
                           parent_email_temp),
                       school_id  = COALESCE(school_id, v_school_id),
                       branch_id  = COALESCE(branch_id, v_branch_id),
                       team_id    = COALESCE(team_id, v_team_id),
                       -- Solo se rellenan huecos: el dato de la escuela es el
                       -- autoritativo, no se sobrescribe con lo que teclearon.
                       date_of_birth = COALESCE(date_of_birth, p_child_dob),
                       gender        = COALESCE(gender, p_child_gender),
                       doc_type      = COALESCE(doc_type, p_child_doc_type),
                       updated_at    = now()
                 WHERE id = v_child_id;
            END IF;
        END IF;

        -- ── (b) Anti-duplicado por nombre (comportamiento previo) ───────────
        IF v_child_id IS NULL THEN
            SELECT id INTO v_child_id FROM public.children
             WHERE school_id = v_school_id AND parent_id = v_user_id
               AND LOWER(full_name) = LOWER(TRIM(COALESCE(p_child_full_name, '')))
               AND COALESCE(TRIM(p_child_full_name), '') <> ''
             ORDER BY created_at ASC LIMIT 1;

            IF v_child_id IS NOT NULL THEN
                UPDATE public.children
                   SET school_id = COALESCE(school_id, v_school_id),
                       branch_id = COALESCE(branch_id, v_branch_id),
                       team_id   = COALESCE(team_id, v_team_id)
                 WHERE id = v_child_id;
            END IF;
        END IF;

        -- ── (c) Crear de cero ──────────────────────────────────────────────
        IF v_child_id IS NULL THEN
            BEGIN
                INSERT INTO public.children (parent_id, school_id, branch_id, team_id, full_name, date_of_birth, doc_type, doc_number, gender, monthly_fee, is_active)
                VALUES (v_user_id, v_school_id, v_branch_id, v_team_id, p_child_full_name, p_child_dob, p_child_doc_type, p_child_doc_number, p_child_gender, v_amount, true)
                RETURNING id INTO v_child_id;
            EXCEPTION WHEN unique_violation THEN
                -- Red final: cualquier índice único de documento (p.ej. el
                -- parcial uq_children_doc_dynasty, creado a mano en la BD)
                -- deja de mostrarle al acudiente el error crudo de Postgres.
                RAISE EXCEPTION
                    'Ese atleta ya está registrado en % con el documento %. Entra a "Pagar mensualidad" o pídele a la escuela que lo vincule a tu cuenta.',
                    COALESCE(v_school_name, 'la escuela'), COALESCE(p_child_doc_number, 's/d')
                    USING ERRCODE = '23505';
            END;
        END IF;
    END IF;

    -- Enrollment IDEMPOTENTE: si ya hay uno activo/pendiente para el mismo
    -- equipo (o sin equipo), reutilizarlo en vez de crear un duplicado.
    SELECT id INTO v_enrollment_id
      FROM public.enrollments
     WHERE child_id = v_child_id AND school_id = v_school_id
       AND COALESCE(team_id::text, '') = COALESCE(v_team_id::text, '')
       AND status IN ('active', 'pending')
     ORDER BY created_at DESC
     LIMIT 1;

    -- Si ya hay CUALQUIER inscripción activa en la escuela (p.ej. la del atleta
    -- pre-cargado, que puede tener otro equipo), no se abre una segunda: ese fue
    -- el bug de doble inscripción de la migración 20260730000000.
    IF v_enrollment_id IS NULL THEN
        SELECT id INTO v_enrollment_id
          FROM public.enrollments
         WHERE child_id = v_child_id AND school_id = v_school_id AND status = 'active'
         ORDER BY created_at DESC
         LIMIT 1;
    END IF;

    IF v_enrollment_id IS NULL THEN
        -- NULLIF(v_amount, 0) a propósito: si no se pudo resolver un precio, se deja
        -- NULL para que la vista caiga al price del plan. Un 0 explícito ganaría el
        -- COALESCE y dejaría la cuota en cero.
        INSERT INTO public.enrollments (user_id, child_id, school_id, team_id, offering_plan_id, monthly_fee, start_date, status)
        VALUES (NULL, v_child_id, v_school_id, v_team_id, v_plan_id, NULLIF(v_amount, 0), v_today,
                CASE WHEN v_qr.require_first_payment THEN 'pending' ELSE 'active' END)
        RETURNING id INTO v_enrollment_id;
    ELSE
        -- Reusar no puede significar dejarla incompleta. Los QR ya están impresos y
        -- siguen apuntando acá, así que esta rama es la que mitiga las filas que esta
        -- misma RPC creó vacías: al volver a pasar por el QR se completan.
        --
        -- Solo se rellenan HUECOS. Nunca se sobrescribe un dato ya puesto: si la
        -- escuela cambió el equipo o el plan desde la app, ese dato manda sobre el QR.
        UPDATE public.enrollments
           SET team_id          = COALESCE(team_id, v_team_id),
               offering_plan_id = COALESCE(offering_plan_id, v_plan_id),
               monthly_fee      = COALESCE(monthly_fee, NULLIF(v_amount, 0)),
               updated_at       = now()
         WHERE id = v_enrollment_id;
    END IF;

    -- Cobro IDEMPOTENTE: si el hijo ya tiene un cobro impago (pending/overdue)
    -- sin comprobante en esta escuela, reutilizarlo — no apilar cobros nuevos.
    IF v_qr.require_first_payment AND v_amount > 0 THEN
        SELECT id INTO v_payment_id
          FROM public.payments
         WHERE child_id = v_child_id AND school_id = v_school_id
           AND status IN ('pending', 'overdue')
           AND COALESCE(receipt_url, '') = ''
         ORDER BY created_at ASC
         LIMIT 1;

        -- Si no hay impago que reutilizar, puede haber uno de ESTE mes ya saldado
        -- (pagado, con comprobante en revisión, abonado o glosado). Insertar en ese
        -- caso reventaba contra uniq_payment_active_period_per_child con un 23505
        -- crudo: la familia que ya pagó agosto y vuelve a escanear el QR tumbaba su
        -- propia inscripción. No se le cobra el mes dos veces.
        IF v_payment_id IS NULL THEN
            SELECT true INTO v_period_settled
              FROM public.payments
             WHERE child_id = v_child_id AND school_id = v_school_id
               AND period_year = v_py AND period_month = v_pm
               AND status IN ('awaiting_approval', 'paid', 'partial', 'glosado')
             LIMIT 1;
        END IF;

        IF v_payment_id IS NULL AND NOT COALESCE(v_period_settled, false) THEN
            -- El concepto era "Primer pago - X (ESCUELA)", que le decía a la escuela
            -- que era una matrícula cuando es la mensualidad del mes. Además
            -- isMonthlyConcept() del frontend decide con /mensual/i sobre este texto,
            -- así que "Primer pago" quedaba fuera de toda la lógica de períodos.
            v_concept := 'Mensualidad ' || public.format_period_label(v_py, v_pm)
                         || ' - ' || COALESCE((SELECT full_name FROM public.children WHERE id = v_child_id), 'atleta')
                         || ' (' || v_school_name || ')';

            -- offering_plan_id: sin él, fn_extend_enrollment_on_payment_paid no
            -- dispara al pagar y `enrollments.expires_at` nunca se extiende, así que
            -- fn_expire_overdue_enrollments (cron 08:00) evalúa para cancelación a un
            -- atleta que pagó. OJO: ese trigger además exige enrollments.status =
            -- 'active', y con require_first_payment la inscripción nace 'pending'.
            INSERT INTO public.payments (
                school_id, branch_id, parent_id, child_id, team_id, offering_plan_id,
                concept, amount, due_date, status, payment_type, qr_id,
                period_year, period_month)
            VALUES (
                v_school_id, v_branch_id, v_user_id, v_child_id, v_team_id, v_plan_id,
                v_concept, v_amount, v_due_date, 'pending', 'one_time', v_qr.id,
                v_py, v_pm)
            RETURNING id INTO v_payment_id;
        ELSIF v_payment_id IS NOT NULL THEN
            -- El cobro pre-existente puede venir sin pagador (carga masiva):
            -- sin parent_id el checkout responde 403 "No tienes permiso para pagar".
            UPDATE public.payments SET parent_id = v_user_id
             WHERE id = v_payment_id AND parent_id IS NULL;
        END IF;
    END IF;

    UPDATE public.school_join_qr_codes SET signup_count = signup_count + 1 WHERE id = v_qr.id;

    INSERT INTO public.notifications (user_id, title, message, type, link)
    SELECT sm.profile_id, 'Nueva inscripción por QR',
           COALESCE((SELECT full_name FROM public.children WHERE id = v_child_id), 'Atleta') || ' se inscribió via "' || v_qr.name || '"',
           'success', '/payments-automation'
    FROM public.school_members sm
    WHERE sm.school_id = v_school_id AND sm.role IN ('owner','admin') AND sm.status='active';

    RETURN jsonb_build_object('ok',true,'qr_id',v_qr.id,'school_id',v_school_id,'child_id',v_child_id,
        'enrollment_id',v_enrollment_id,'payment_id',v_payment_id,
        'requires_payment', v_qr.require_first_payment AND v_payment_id IS NOT NULL, 'amount', v_amount,
        'period_settled', COALESCE(v_period_settled, false),
        'due_date', v_due_date,
        'period', jsonb_build_object('year', v_py, 'month', v_pm));
END;
$$;

COMMENT ON FUNCTION public.submit_qr_signup(text, uuid, uuid, text, date, text, text, text, text, numeric, uuid, uuid) IS
    'Inscripción por QR. Orden de match del atleta: documento (dentro de la escuela) > nombre > crear. Adopta pre-cargados huérfanos, no roba atletas de otro acudiente y traduce las violaciones de único a texto legible. La inscripción se crea CON plan y cuota, y si ya existía se le rellenan los huecos. El cobro es la MENSUALIDAD del mes de registro: período estampado explícito y vencimiento desde el día de corte de la escuela (nunca el mismo día del alta). Si el mes ya está saldado no se cobra de nuevo.';

GRANT EXECUTE ON FUNCTION public.submit_qr_signup(text, uuid, uuid, text, date, text, text, text, text, numeric, uuid, uuid) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. generate_qr_monthly_charge
-- ─────────────────────────────────────────────────────────────────────────────
-- Base: 20260728000002. Único cambio: el vencimiento sale del mes DEL PERÍODO.
-- Antes el período venía de next_unpaid_period (septiembre si agosto ya estaba
-- saldado) y el vencimiento de CURRENT_DATE: un cobro de septiembre vencido el 2
-- de agosto, que el panel pintaba en rojo.
CREATE OR REPLACE FUNCTION public.generate_qr_monthly_charge(p_slug text, p_child_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_qr record; v_school_id uuid; v_school_name text;
    v_child record; v_amount numeric; v_payment_id uuid;
    v_existing uuid; v_existing_amount numeric;
    v_enroll_fee numeric;
    v_next jsonb; v_py smallint; v_pm smallint;
    v_due_date date;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
    SELECT * INTO v_qr FROM public.school_join_qr_codes WHERE slug = p_slug AND active = true;
    IF v_qr.id IS NULL THEN RAISE EXCEPTION 'QR not found or inactive' USING ERRCODE='02000'; END IF;
    v_school_id := v_qr.school_id;
    SELECT name INTO v_school_name FROM public.schools WHERE id = v_school_id;

    SELECT * INTO v_child FROM public.children
    WHERE id = p_child_id AND parent_id = v_user_id AND school_id = v_school_id;
    IF v_child.id IS NULL THEN RAISE EXCEPTION 'Hijo no válido para esta escuela' USING ERRCODE='42501'; END IF;

    -- DEDUP FUERTE: reutiliza CUALQUIER cobro impago (pending/overdue) sin
    -- comprobante del hijo en esta escuela — el más antiguo por período. Antes
    -- se deduplicaba solo por "mes en curso", así que al avanzar de mes se
    -- apilaban cobros de meses distintos.
    SELECT id, amount INTO v_existing, v_existing_amount
    FROM public.payments
    WHERE child_id = p_child_id AND school_id = v_school_id
      AND status IN ('pending', 'overdue')
      AND COALESCE(receipt_url, '') = ''
    ORDER BY COALESCE(period_year,  EXTRACT(YEAR  FROM due_date)::smallint),
             COALESCE(period_month, EXTRACT(MONTH FROM due_date)::smallint),
             created_at ASC
    LIMIT 1;
    IF v_existing IS NOT NULL THEN
        RETURN jsonb_build_object('ok', true, 'payment_id', v_existing, 'amount', v_existing_amount, 'reused', true);
    END IF;

    -- Cuota individual del enrollment activo (equipo o plan): manda sobre todo.
    SELECT COALESCE(
        NULLIF(e.monthly_fee, 0),
        NULLIF((SELECT price_monthly FROM public.teams WHERE id = e.team_id), 0),
        NULLIF((SELECT price FROM public.offering_plans WHERE id = e.offering_plan_id), 0))
    INTO v_enroll_fee
    FROM public.enrollments e
    WHERE e.child_id = p_child_id AND e.school_id = v_school_id AND e.status = 'active'
    ORDER BY (e.monthly_fee IS NOT NULL) DESC, e.updated_at DESC NULLS LAST
    LIMIT 1;

    v_amount := COALESCE(
        v_enroll_fee,
        NULLIF(v_qr.fixed_amount, 0),
        NULLIF(v_child.monthly_fee, 0),
        (SELECT NULLIF(price_monthly, 0) FROM public.teams WHERE id = v_child.team_id AND school_id = v_school_id),
        0);
    IF v_amount <= 0 THEN RAISE EXCEPTION 'No hay cuota configurada para este atleta' USING ERRCODE='22023'; END IF;

    -- Período objetivo con la lógica corregida (no avanza si hay impago).
    v_next := public.next_unpaid_period(p_child_id);
    v_py := (v_next->>'year')::smallint;
    v_pm := (v_next->>'month')::smallint;

    -- El vencimiento pertenece al mes del PERÍODO, no al de hoy. Un cobro de
    -- septiembre vence el 10 de septiembre.
    v_due_date := public.school_due_date(v_school_id, v_py::int, v_pm::int);

    INSERT INTO public.payments (
        school_id, branch_id, parent_id, child_id, team_id, concept, amount,
        due_date, status, payment_type, qr_id, period_year, period_month)
    VALUES (
        v_school_id, v_child.branch_id, v_user_id, p_child_id, v_child.team_id,
        'Mensualidad ' || public.format_period_label(v_py, v_pm) || ' - ' || v_child.full_name || ' (' || v_school_name || ')',
        v_amount, v_due_date, 'pending', 'one_time', v_qr.id, v_py, v_pm)
    RETURNING id INTO v_payment_id;

    RETURN jsonb_build_object('ok', true, 'payment_id', v_payment_id, 'amount', v_amount, 'reused', false,
        'period', v_next, 'due_date', v_due_date);
END;
$$;

COMMENT ON FUNCTION public.generate_qr_monthly_charge(text, uuid) IS
    'Cobro de mensualidad desde el QR de pago. Reutiliza cualquier cobro impago sin comprobante; si no hay, crea el del período que devuelve next_unpaid_period con vencimiento en el día de corte DE ESE MES (no el día en que se genera).';

GRANT EXECUTE ON FUNCTION public.generate_qr_monthly_charge(text, uuid) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. fn_expire_overdue_payments — el que marcaba la mora sin mirar nada
-- ─────────────────────────────────────────────────────────────────────────────
-- Cuerpo anterior (existía solo en la base, sin migración que lo creara):
--
--     UPDATE public.payments SET status = 'overdue', updated_at = now()
--      WHERE status = 'pending' AND due_date IS NOT NULL
--        AND due_date < CURRENT_DATE;
--
-- Sin SECURITY DEFINER, sin search_path, sin días de gracia, con CURRENT_DATE en
-- UTC y global a todas las escuelas. Marcaba a un cobro con 1 día de atraso pese
-- a los 5 días de gracia configurados, y una hora después de que apply_late_fees
-- (07:00) hubiera decidido correctamente que NO estaba vencido.
--
-- Se conserva la firma (RETURNS void) para no romper a quien la llame.
CREATE OR REPLACE FUNCTION public.fn_expire_overdue_payments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_today date := (now() AT TIME ZONE 'America/Bogota')::date;
BEGIN
    UPDATE public.payments p
       SET status     = 'overdue',
           updated_at = now()
     WHERE p.status = 'pending'
       AND p.due_date IS NOT NULL
       -- Días de gracia de la escuela. Subconsulta y no JOIN: una escuela sin
       -- fila en school_settings no debe quedar fuera del barrido.
       AND (p.due_date + COALESCE(
               (SELECT ss.payment_grace_days
                  FROM public.school_settings ss
                 WHERE ss.school_id = p.school_id),
               0)) < v_today
       -- Un cobro cuyo período todavía no empieza no está vencido, aunque su
       -- due_date sea viejo. Es el caso del cobro de septiembre generado el 2 de
       -- agosto que el panel pintaba con "2 días vencido".
       AND (p.period_year IS NULL
            OR p.period_month IS NULL
            OR make_date(p.period_year::int, p.period_month::int, 1)
               <= date_trunc('month', v_today)::date);
END;
$$;

COMMENT ON FUNCTION public.fn_expire_overdue_payments() IS
    'Marca pending -> overdue respetando payment_grace_days y la fecha de negocio Colombia, y sin tocar cobros de períodos futuros. Redundante con apply_late_fees (que además aplica recargo): su job de cron se desagenda en esta misma migración. Se mantiene por si algo la invoca.';

REVOKE ALL ON FUNCTION public.fn_expire_overdue_payments() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_expire_overdue_payments() TO service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. apply_late_fees — mismo cinturón de período futuro
-- ─────────────────────────────────────────────────────────────────────────────
-- Base: 20260706130000 (que a su vez arregló el cast a pay_status del enum:
-- payments.status es TEXT en esta base, así que 'overdue' va como literal pelado).
-- Único cambio: no marcar mora ni aplicar recargo sobre un período que aún no
-- empieza. Este es el motor que queda vivo, así que el cinturón tiene que estar acá.
CREATE OR REPLACE FUNCTION public.apply_late_fees()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_today        date := (now() AT TIME ZONE 'America/Bogota')::date;
    v_overdue      integer := 0;
    v_fees_applied integer := 0;
    v_total_fees   numeric := 0;
BEGIN
    WITH candidates AS (
        SELECT
            p.id,
            p.status,
            p.amount,
            p.late_fee_applied_at,
            -- Recargo a aplicar (0 si la escuela no tiene mora o ya se aplicó)
            CASE
                WHEN ss.late_fee_enabled IS TRUE
                     AND p.late_fee_applied_at IS NULL
                THEN round(
                        COALESCE(ss.late_fee_percentage, 0)::numeric / 100
                        * GREATEST(p.amount - COALESCE(p.amount_paid, 0), 0)
                     )
                ELSE 0
            END AS fee
        FROM public.payments p
        JOIN public.school_settings ss ON ss.school_id = p.school_id
        WHERE p.status IN ('pending', 'partial')
          -- Ya pasó el período de gracia posterior al vencimiento
          AND (p.due_date + COALESCE(ss.payment_grace_days, 0)) < v_today
          -- Un cobro de un mes que todavía no empieza no está en mora, sin
          -- importar qué diga su due_date (cobros del QR generados por
          -- adelantado, ver migración 20260804125644).
          AND (p.period_year IS NULL
               OR p.period_month IS NULL
               OR make_date(p.period_year::int, p.period_month::int, 1)
                  <= date_trunc('month', v_today)::date)
          -- Sólo filas que realmente cambian: marcar 'pending'->'overdue',
          -- o aplicar recargo pendiente cuando la mora está habilitada.
          AND (
                p.status = 'pending'
                OR (ss.late_fee_enabled IS TRUE AND p.late_fee_applied_at IS NULL)
              )
    ), updated AS (
        UPDATE public.payments p
        SET
            late_fee_amount     = p.late_fee_amount + c.fee,
            amount              = p.amount + c.fee,
            late_fee_applied_at = CASE WHEN c.fee > 0 THEN now()
                                       ELSE p.late_fee_applied_at END,
            -- 'partial' conserva su estado (aún es un abono con saldo);
            -- 'pending' pasa a 'overdue'. Literal sin cast: unifica con
            -- p.status sea TEXT o enum pay_status.
            status              = CASE WHEN p.status = 'pending' THEN 'overdue'
                                       ELSE p.status END,
            updated_at          = now()
        FROM candidates c
        WHERE p.id = c.id
        RETURNING (c.status = 'pending') AS became_overdue, c.fee
    )
    SELECT
        COUNT(*) FILTER (WHERE became_overdue),
        COUNT(*) FILTER (WHERE fee > 0),
        COALESCE(SUM(fee), 0)
    INTO v_overdue, v_fees_applied, v_total_fees
    FROM updated;

    RETURN jsonb_build_object(
        'run_date',       v_today,
        'overdue_marked', v_overdue,
        'fees_applied',   v_fees_applied,
        'total_fees',     v_total_fees
    );
END;
$$;

COMMENT ON FUNCTION public.apply_late_fees() IS
    'Motor único de mora: marca pending -> overdue pasados due_date + payment_grace_days (fecha Colombia) y aplica el recargo una sola vez si late_fee_enabled. No toca períodos futuros. Cron: apply-late-fees-daily, 07:00.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Desagendar el job duplicado
-- ─────────────────────────────────────────────────────────────────────────────
-- Había DOS motores de mora agendados: apply-late-fees-daily (07:00, respeta la
-- gracia) y expire-overdue-payments (08:00, no la respetaba). El segundo pisaba
-- la decisión del primero una hora más tarde. Queda uno.
--
-- Se desagenda por jobid y no por nombre: cron.unschedule(text) no existe en
-- versiones viejas de pg_cron, y con un EXCEPTION alrededor la migración habría
-- pasado en verde dejando el job vivo. cron.unschedule(bigint) sí está siempre.
--
-- Idempotente: si el job ya no está, no hace nada. El EXCEPTION cubre el caso de
-- que pg_cron no esté instalado en el ambiente donde se aplique esto.
--
-- VERIFICAR DESPUÉS DE APLICAR:  SELECT jobid, jobname FROM cron.job;
-- No debe quedar 'expire-overdue-payments'.
DO $$
DECLARE
    v_jobid bigint;
BEGIN
    SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'expire-overdue-payments';
    IF v_jobid IS NOT NULL THEN
        PERFORM cron.unschedule(v_jobid);
    END IF;
EXCEPTION WHEN undefined_table OR undefined_function OR insufficient_privilege THEN
    NULL;
END $$;

COMMIT;
