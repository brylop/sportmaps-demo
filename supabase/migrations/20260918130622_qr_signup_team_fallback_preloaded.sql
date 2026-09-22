-- =============================================================================
-- 20260918130622_qr_signup_team_fallback_preloaded.sql
-- Autor: brylop   Fecha: 2026-09-18   Versión anterior: 20260918121305
-- Objetivo: que `submit_qr_signup` no reviente contra
--   `enrollments_active_needs_target` cuando la pantalla de auto-registro
--   encuentra una ficha pre-cargada por documento y NO manda equipo ni plan
--   (a propósito: no hay por qué pedirle al acudiente que elija de nuevo lo
--   que la escuela ya asignó).
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
-- EL BUG, MEDIDO
--
-- La pantalla de auto-registro (JoinSchoolPublicPage) ahora busca primero si
-- el menor ya está cargado por la escuela (por documento) y, si lo encuentra,
-- manda `p_team_id`/`p_plan_id` en NULL a propósito: no hay que pisar lo que
-- la escuela ya asignó, y `submit_qr_signup` ya sabe adoptar la ficha y
-- rellenar SOLO huecos (`COALESCE`) en la tabla `children`.
--
-- Pero esa adopción actualiza `children.team_id`, NO crea ni toca ningún
-- `enrollments`. Si la ficha pre-cargada no tiene todavía una fila en
-- `enrollments` (import parcial, o un alta manual que solo tocó `children`),
-- la rama "crear de cero" inserta una inscripción con `team_id` y
-- `offering_plan_id` en NULL y `status='active'` (cuando el QR no exige
-- primer pago) — y esa combinación viola `enrollments_active_needs_target`
-- (20260803153633): una inscripción activa tiene que apuntar a algo.
--
-- Reproducido en Escuela Pruebas (2026-09-18): ficha pre-cargada con
-- `children.team_id` asignado pero sin fila en `enrollments` → 400 al
-- completar el registro, mensaje crudo de Postgres.
--
-- Los 69 atletas reales de Besser SÍ tienen `enrollments` ya creado (se
-- verificó contra la base), así que este bug no los toca hoy — pero es un
-- hueco real que la búsqueda por documento vuelve mucho más fácil de pisar,
-- y una escuela que cargue atletas solo en `children` (sin generar
-- `enrollments`) lo dispara determinísticamente.
--
-- QUÉ CAMBIA
--
-- Justo antes de decidir si hay que crear una inscripción nueva, si
-- `v_team_id` sigue en NULL se usa el `team_id` que ya tiene la ficha en
-- `children` (el mismo que la adopción por documento/nombre acaba de
-- rellenar o ya tenía). Solo es un fallback: si el QR mandó un equipo
-- explícito, ese sigue mandando sobre el de la ficha.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.submit_qr_signup(
    p_slug text,
    p_team_id uuid DEFAULT NULL::uuid,
    p_branch_id uuid DEFAULT NULL::uuid,
    p_child_full_name text DEFAULT NULL::text,
    p_child_dob date DEFAULT NULL::date,
    p_child_doc_type text DEFAULT NULL::text,
    p_child_doc_number text DEFAULT NULL::text,
    p_child_gender text DEFAULT NULL::text,
    p_phone text DEFAULT NULL::text,
    p_monthly_fee numeric DEFAULT NULL::numeric,
    p_existing_child_id uuid DEFAULT NULL::uuid,
    p_plan_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
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
    -- NUEVO: nombre normalizado del atleta que se está registrando.
    v_name_key text;
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
    v_name_key  := public.normalize_athlete_name(p_child_full_name);
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

        -- ── (b) NOMBRE: la ficha pre-cargada de la escuela también cuenta ───
        -- ANTES: `AND parent_id = v_user_id`, o sea solo miraba hijos que YA
        -- eran de esta cuenta. La ficha que la escuela pre-cargó tiene
        -- parent_id NULL, así que esta capa NUNCA la encontraba y todo caía en
        -- (c). Ese era el bug: sin documento, duplicado garantizado.
        --
        -- AHORA: busca en toda la escuela por nombre normalizado, pero solo
        -- adopta lo que está LIBRE (parent_id NULL) o ya es de esta cuenta.
        -- Si el nombre coincide con la ficha de OTRO acudiente, no toca nada y
        -- sigue a (c): es un homónimo, y ahí adivinar es peor que duplicar.
        IF v_child_id IS NULL AND v_name_key IS NOT NULL THEN
            SELECT c.id, c.parent_id
              INTO v_match
              FROM public.children c
             WHERE c.school_id = v_school_id
               AND public.normalize_athlete_name(c.full_name) = v_name_key
               AND (c.parent_id IS NULL OR c.parent_id = v_user_id)
               -- Si ambas fechas existen, tienen que ser la misma. Es lo que
               -- separa a dos hermanos homónimos de la misma persona cargada
               -- dos veces. Si a alguna le falta la fecha, manda el nombre.
               AND (c.date_of_birth IS NULL OR p_child_dob IS NULL
                    OR c.date_of_birth = p_child_dob)
             ORDER BY (c.parent_id = v_user_id) DESC NULLS LAST,
                      (c.date_of_birth IS NOT NULL AND c.date_of_birth = p_child_dob) DESC,
                      c.created_at ASC
             LIMIT 1;

            IF v_match.id IS NOT NULL THEN
                v_child_id := v_match.id;

                UPDATE public.children
                   SET parent_id         = v_user_id,
                       parent_email_temp = COALESCE(
                           (SELECT LOWER(email) FROM auth.users WHERE id = v_user_id),
                           parent_email_temp),
                       school_id     = COALESCE(school_id, v_school_id),
                       branch_id     = COALESCE(branch_id, v_branch_id),
                       team_id       = COALESCE(team_id, v_team_id),
                       -- Igual que en (a): solo se rellenan huecos. El dato de
                       -- la escuela es el autoritativo.
                       date_of_birth = COALESCE(date_of_birth, p_child_dob),
                       gender        = COALESCE(gender, p_child_gender),
                       doc_type      = COALESCE(doc_type, p_child_doc_type),
                       doc_number    = COALESCE(doc_number, p_child_doc_number),
                       updated_at    = now()
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

    -- NUEVO — Si nadie mandó equipo (el QR es abierto y la pantalla de
    -- búsqueda por documento manda NULL a propósito para no pisar lo que la
    -- escuela ya asignó), usar el que la ficha ya tiene en `children`. Sin
    -- este fallback, una ficha pre-cargada sin `enrollments` todavía revienta
    -- más abajo contra `enrollments_active_needs_target` al crear la
    -- inscripción de cero con team_id NULL.
    IF v_team_id IS NULL AND v_child_id IS NOT NULL THEN
        SELECT team_id INTO v_team_id FROM public.children WHERE id = v_child_id;
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
$function$;

COMMENT ON FUNCTION public.submit_qr_signup(text,uuid,uuid,text,date,text,text,text,text,numeric,uuid,uuid) IS
  'Auto-registro por QR. Antes de crear ficha busca la pre-cargada de la escuela por documento (a) y por nombre normalizado + fecha de nacimiento (b). Solo adopta fichas LIBRES (parent_id NULL): si el nombre coincide con la ficha de otro acudiente, no adopta y crea la suya — un homónimo no se resuelve adivinando. Un casi-duplicado (documento con typo, nombre parecido) NO se fusiona acá: eso se le pregunta al acudiente (F3.2). Si nadie mandó equipo (QR abierto + búsqueda por documento sin pisar lo asignado), usa el team_id que la ficha ya tenía en children antes de crear una inscripción nueva — evita violar enrollments_active_needs_target (20260918130622).';

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ── Verificación después de aplicar ────────────────────────────────────────
--
-- 1) Repetir el caso que reventó: ficha con team_id en `children` pero SIN
--    fila en `enrollments`, registrarse sin mandar equipo ni plan.
--    Esperado: inscripción creada con el team_id de la ficha, sin error.
--
--    -- (ficha de prueba, no Dynasty/Besser)
--    insert into public.children (school_id, team_id, full_name, doc_type, doc_number, is_active)
--    values ('<school_id>', '<team_id>', '[PRUEBA] fallback', 'TI', '<doc unico>', true)
--    returning id;
--
--    select submit_qr_signup(p_slug := '<slug>', p_child_doc_number := '<doc unico>');
--
--    select team_id, offering_plan_id, status from public.enrollments
--     where child_id = (select id from public.children where doc_number = '<doc unico>');
--    -- esperado: team_id = el de la ficha, status sin reventar el constraint.
--
-- 2) Que el comportamiento de siempre (QR con equipo fijo, o el acudiente
--    elige equipo/plan) sigue igual: v_team_id ya viene no-NULL en esos casos,
--    así que el fallback nuevo no se activa.
