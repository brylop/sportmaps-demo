-- =============================================================================
-- 20261014113038_qr_signup_restaura_guarda_escuela_operativa.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-14   Versión anterior: 20261013193011
-- Objetivo: restaurar el guard SEG-19 (school_is_operational) en las DOS variantes
--   vivas de submit_qr_signup.
-- =============================================================================
-- Por qué: 20260818071427 convirtió submit_qr_signup (12 args) en un envoltorio con
--   el guard sobre submit_qr_signup__interno. Migraciones posteriores
--   (20260918130622, 20261013193011) reemplazaron el cuerpo completo de ambas
--   variantes SIN el guard, y la de 13 args (la que llama JoinSchoolPublicPage)
--   nunca lo tuvo. Medido 2026-10-14: ninguna de las dos contiene
--   school_is_operational → una escuela bloqueada o con la prueba vencida sigue
--   inscribiendo atletas y generando cobros por QR.
--
-- Qué cambia: SOLO se inserta el bloque IF ... school_is_operational(...) justo
--   después de "v_school_id := v_qr.school_id;" (QR ya resuelto, antes de cualquier
--   escritura). El resto del cuerpo es el vivo byte por byte (pg_get_functiondef,
--   sin \r). Mismo mensaje y ERRCODE 42501 que el envoltorio de SEG-19.
--   Las dos variantes tienen cuerpo propio (ninguna delega en la otra): guard en ambas.
--
-- Radio (2026-10-14): 12 QR activos; 1 quedaría bloqueado — Fit And Fight
--   (fit-and-fight-c487f384, 0 inscripciones). Los otros 11 no cambian.
--
-- submit_qr_signup__interno: se deja como está (vivo, sin uso, EXECUTE solo
--   postgres/service_role). No se borra aquí.
--
-- Guarda: aborta si el cuerpo vivo no es el que se leyó (md5 sin \r, 2026-10-14).
-- ACL: CREATE OR REPLACE conserva los permisos vivos (12 args: authenticated +
--   service_role; 13 args: PUBLIC + service_role). No se tocan; el DO final verifica.
-- Revertir: CREATE OR REPLACE con los cuerpos de md5 cde5ca2b… / 12968696…
--   (= los de 20261013193011 tal como quedaron vivos).
-- =============================================================================

BEGIN;

DO $guard$
DECLARE v_md5 text;
BEGIN
  SELECT md5(replace(prosrc, E'\r', '')) INTO v_md5 FROM pg_proc
   WHERE oid = 'public.submit_qr_signup(text,uuid,uuid,text,date,text,text,text,text,numeric,uuid,uuid)'::regprocedure;
  IF v_md5 IS DISTINCT FROM 'cde5ca2bceceef50cfa6340db086f287' THEN
    RAISE EXCEPTION 'submit_qr_signup (12 args) cambió en la base: md5 % (esperado cde5ca2bceceef50cfa6340db086f287). Re-leer el cuerpo vivo.', v_md5;
  END IF;

  SELECT md5(replace(prosrc, E'\r', '')) INTO v_md5 FROM pg_proc
   WHERE oid = 'public.submit_qr_signup(text,uuid,uuid,text,date,text,text,text,text,numeric,uuid,uuid,uuid)'::regprocedure;
  IF v_md5 IS DISTINCT FROM '129686969ebc04f29578f0eb3c6615c6' THEN
    RAISE EXCEPTION 'submit_qr_signup (13 args) cambió en la base: md5 % (esperado 129686969ebc04f29578f0eb3c6615c6). Re-leer el cuerpo vivo.', v_md5;
  END IF;

  IF to_regprocedure('public.school_is_operational(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Falta public.school_is_operational(uuid)';
  END IF;
END
$guard$;

-- -----------------------------------------------------------------------------
-- 1) Variante de 12 args (EXECUTE: authenticated, service_role)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_qr_signup(p_slug text, p_team_id uuid DEFAULT NULL::uuid, p_branch_id uuid DEFAULT NULL::uuid, p_child_full_name text DEFAULT NULL::text, p_child_dob date DEFAULT NULL::date, p_child_doc_type text DEFAULT NULL::text, p_child_doc_number text DEFAULT NULL::text, p_child_gender text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_monthly_fee numeric DEFAULT NULL::numeric, p_existing_child_id uuid DEFAULT NULL::uuid, p_plan_id uuid DEFAULT NULL::uuid)
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
    v_today date := (now() AT TIME ZONE 'America/Bogota')::date;
    v_due_date date;
    v_py smallint; v_pm smallint;
    v_period_settled boolean := false;
    v_name_key text;
    -- 20261013193011: cobros únicos del alta (inscripción / seguro).
    v_enrollment_is_new boolean := false;
    v_fee_ids uuid[] := ARRAY[]::uuid[];
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
    SELECT * INTO v_qr FROM public.school_join_qr_codes WHERE slug = p_slug AND active = true;
    IF v_qr.id IS NULL THEN RAISE EXCEPTION 'QR not found or inactive' USING ERRCODE='02000'; END IF;
    IF v_qr.expires_at IS NOT NULL AND v_qr.expires_at < now() THEN RAISE EXCEPTION 'QR expired' USING ERRCODE='22023'; END IF;

    v_school_id := v_qr.school_id;
    -- 20261014113038 · SEG-19 restaurado: escuela bloqueada / prueba vencida no inscribe.
    -- Va antes de cualquier escritura. Fail-closed: si no se puede evaluar, no pasa.
    IF NOT COALESCE(public.school_is_operational(v_school_id), false) THEN
        RAISE EXCEPTION 'Esta escuela tiene el periodo de prueba vencido: no puede recibir inscripciones nuevas.'
            USING ERRCODE = '42501';
    END IF;
    v_branch_id := COALESCE(p_branch_id, v_qr.branch_id);
    v_team_id   := CASE WHEN v_qr.target_type = 'team' THEN v_qr.target_id ELSE p_team_id END;
    v_plan_id   := CASE WHEN v_qr.target_type = 'plan' THEN v_qr.target_id ELSE p_plan_id END;
    v_doc       := public.normalize_doc_number(p_child_doc_number);
    v_name_key  := public.normalize_athlete_name(p_child_full_name);
    SELECT name INTO v_school_name FROM public.schools WHERE id = v_school_id;

    v_py       := EXTRACT(year  FROM v_today)::smallint;
    v_pm       := EXTRACT(month FROM v_today)::smallint;
    v_due_date := public.qr_first_charge_due_date(v_school_id, v_today);

    PERFORM public.claim_orphan_children(v_school_id);

    IF v_plan_id IS NOT NULL THEN
        SELECT op.price INTO v_plan_price
        FROM public.offering_plans op
        WHERE op.id = v_plan_id AND op.school_id = v_school_id AND op.is_active = true;
        IF v_plan_price IS NULL THEN RAISE EXCEPTION 'Plan no válido para esta escuela' USING ERRCODE='22023'; END IF;
    END IF;

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

                UPDATE public.children
                   SET parent_id         = v_user_id,
                       parent_email_temp = COALESCE(
                           (SELECT LOWER(email) FROM auth.users WHERE id = v_user_id),
                           parent_email_temp),
                       school_id  = COALESCE(school_id, v_school_id),
                       branch_id  = COALESCE(branch_id, v_branch_id),
                       team_id    = COALESCE(team_id, v_team_id),
                       date_of_birth = COALESCE(date_of_birth, p_child_dob),
                       gender        = COALESCE(gender, p_child_gender),
                       doc_type      = COALESCE(doc_type, p_child_doc_type),
                       updated_at    = now()
                 WHERE id = v_child_id;
            END IF;
        END IF;

        IF v_child_id IS NULL AND v_name_key IS NOT NULL THEN
            SELECT c.id, c.parent_id
              INTO v_match
              FROM public.children c
             WHERE c.school_id = v_school_id
               AND public.normalize_athlete_name(c.full_name) = v_name_key
               AND (c.parent_id IS NULL OR c.parent_id = v_user_id)
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
                       date_of_birth = COALESCE(date_of_birth, p_child_dob),
                       gender        = COALESCE(gender, p_child_gender),
                       doc_type      = COALESCE(doc_type, p_child_doc_type),
                       doc_number    = COALESCE(doc_number, p_child_doc_number),
                       updated_at    = now()
                 WHERE id = v_child_id;
            END IF;
        END IF;

        IF v_child_id IS NULL THEN
            BEGIN
                INSERT INTO public.children (parent_id, school_id, branch_id, team_id, full_name, date_of_birth, doc_type, doc_number, gender, monthly_fee, is_active)
                VALUES (v_user_id, v_school_id, v_branch_id, v_team_id, p_child_full_name, p_child_dob, p_child_doc_type, p_child_doc_number, p_child_gender, v_amount, true)
                RETURNING id INTO v_child_id;
            EXCEPTION WHEN unique_violation THEN
                RAISE EXCEPTION
                    'Ese atleta ya está registrado en % con el documento %. Entra a "Pagar mensualidad" o pídele a la escuela que lo vincule a tu cuenta.',
                    COALESCE(v_school_name, 'la escuela'), COALESCE(p_child_doc_number, 's/d')
                    USING ERRCODE = '23505';
            END;
        END IF;
    END IF;

    -- NUEVO — fallback al team_id que ya tiene la ficha en children cuando
    -- nadie mandó equipo, para no violar enrollments_active_needs_target.
    IF v_team_id IS NULL AND v_child_id IS NOT NULL THEN
        SELECT team_id INTO v_team_id FROM public.children WHERE id = v_child_id;
    END IF;

    SELECT id INTO v_enrollment_id
      FROM public.enrollments
     WHERE child_id = v_child_id AND school_id = v_school_id
       AND COALESCE(team_id::text, '') = COALESCE(v_team_id::text, '')
       AND status IN ('active', 'pending')
     ORDER BY created_at DESC
     LIMIT 1;

    IF v_enrollment_id IS NULL THEN
        SELECT id INTO v_enrollment_id
          FROM public.enrollments
         WHERE child_id = v_child_id AND school_id = v_school_id AND status = 'active'
         ORDER BY created_at DESC
         LIMIT 1;
    END IF;

    IF v_enrollment_id IS NULL THEN
        INSERT INTO public.enrollments (user_id, child_id, school_id, team_id, offering_plan_id, monthly_fee, start_date, status)
        VALUES (NULL, v_child_id, v_school_id, v_team_id, v_plan_id, NULLIF(v_amount, 0), v_today,
                CASE WHEN v_qr.require_first_payment THEN 'pending' ELSE 'active' END)
        RETURNING id INTO v_enrollment_id;
        v_enrollment_is_new := true;   -- solo esta rama marca alta nueva
    ELSE
        UPDATE public.enrollments
           SET team_id          = COALESCE(team_id, v_team_id),
               offering_plan_id = COALESCE(offering_plan_id, v_plan_id),
               monthly_fee      = COALESCE(monthly_fee, NULLIF(v_amount, 0)),
               updated_at       = now()
         WHERE id = v_enrollment_id;
    END IF;

    IF v_qr.require_first_payment AND v_amount > 0 THEN
        SELECT id INTO v_payment_id
          FROM public.payments
         WHERE child_id = v_child_id AND school_id = v_school_id
           AND status IN ('pending', 'overdue')
           AND COALESCE(receipt_url, '') = ''
           -- 20261013193011: una inscripción/seguro/artículo pendiente no es la mensualidad.
           AND COALESCE(payment_category, 'mensualidad') = 'mensualidad'
         ORDER BY created_at ASC
         LIMIT 1;

        IF v_payment_id IS NULL THEN
            SELECT true INTO v_period_settled
              FROM public.payments
             WHERE child_id = v_child_id AND school_id = v_school_id
               AND period_year = v_py AND period_month = v_pm
               AND COALESCE(payment_category, 'mensualidad') = 'mensualidad'
               AND status IN ('awaiting_approval', 'paid', 'partial', 'glosado')
             LIMIT 1;
        END IF;

        IF v_payment_id IS NULL AND NOT COALESCE(v_period_settled, false) THEN
            v_concept := 'Mensualidad ' || public.format_period_label(v_py, v_pm)
                         || ' - ' || COALESCE((SELECT full_name FROM public.children WHERE id = v_child_id), 'atleta')
                         || ' (' || v_school_name || ')';

            INSERT INTO public.payments (
                school_id, branch_id, parent_id, child_id, team_id, offering_plan_id,
                concept, amount, due_date, status, payment_type, qr_id,
                period_year, period_month, payment_category)
            VALUES (
                v_school_id, v_branch_id, v_user_id, v_child_id, v_team_id, v_plan_id,
                v_concept, v_amount, v_due_date, 'pending', 'one_time', v_qr.id,
                v_py, v_pm, 'mensualidad')
            RETURNING id INTO v_payment_id;
        ELSIF v_payment_id IS NOT NULL THEN
            UPDATE public.payments SET parent_id = v_user_id
             WHERE id = v_payment_id AND parent_id IS NULL;
        END IF;
    END IF;

    -- 20261013193011: inscripción y seguro del plan, SOLO con alta nueva (re-escanear
    -- no duplica: emit_enrollment_fees no deduplica la inscripción) y solo si el niño
    -- no tuvo antes otra inscripción viva ni un cobro de inscripción no anulado en la
    -- escuela. Después de la mensualidad, para que su búsqueda no tome estas filas,
    -- y con el MISMO vencimiento que ella (el trigger del primer cobro puede moverlo).
    IF v_enrollment_is_new AND v_plan_id IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM public.enrollments e
            WHERE e.child_id = v_child_id AND e.school_id = v_school_id
              AND e.id <> v_enrollment_id AND e.status <> 'cancelled')
       AND NOT EXISTS (
           SELECT 1 FROM public.payments p
            WHERE p.child_id = v_child_id AND p.school_id = v_school_id
              AND p.payment_category = 'inscripcion' AND p.status <> 'cancelled')
    THEN
        v_fee_ids := COALESCE(public.emit_enrollment_fees(
            v_school_id, v_plan_id, v_child_id, NULL, NULL, v_user_id, v_branch_id,
            COALESCE((SELECT due_date FROM public.payments WHERE id = v_payment_id), v_due_date),
            (SELECT full_name FROM public.children WHERE id = v_child_id),
            false, false), ARRAY[]::uuid[]);
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
        'period', jsonb_build_object('year', v_py, 'month', v_pm),
        'enrollment_is_new', v_enrollment_is_new,
        'fee_payment_ids', to_jsonb(v_fee_ids),
        'requires_fee_payment', cardinality(v_fee_ids) > 0);
END;
$function$;

-- -----------------------------------------------------------------------------
-- 2) Variante de 13 args (la que llama JoinSchoolPublicPage; EXECUTE: PUBLIC)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_qr_signup(p_slug text, p_team_id uuid DEFAULT NULL::uuid, p_branch_id uuid DEFAULT NULL::uuid, p_child_full_name text DEFAULT NULL::text, p_child_dob date DEFAULT NULL::date, p_child_doc_type text DEFAULT NULL::text, p_child_doc_number text DEFAULT NULL::text, p_child_gender text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_monthly_fee numeric DEFAULT NULL::numeric, p_existing_child_id uuid DEFAULT NULL::uuid, p_plan_id uuid DEFAULT NULL::uuid, p_unregistered_athlete_id uuid DEFAULT NULL::uuid)
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
    v_today date := (now() AT TIME ZONE 'America/Bogota')::date;
    v_due_date date;
    v_py smallint; v_pm smallint;
    v_period_settled boolean := false;
    v_name_key text;
    -- 20261013193011: cobros únicos del alta (inscripción / seguro).
    v_enrollment_is_new boolean := false;
    v_fee_ids uuid[] := ARRAY[]::uuid[];
    v_ua record;
    v_migrated jsonb;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
    SELECT * INTO v_qr FROM public.school_join_qr_codes WHERE slug = p_slug AND active = true;
    IF v_qr.id IS NULL THEN RAISE EXCEPTION 'QR not found or inactive' USING ERRCODE='02000'; END IF;
    IF v_qr.expires_at IS NOT NULL AND v_qr.expires_at < now() THEN RAISE EXCEPTION 'QR expired' USING ERRCODE='22023'; END IF;

    v_school_id := v_qr.school_id;
    -- 20261014113038 · SEG-19 restaurado: escuela bloqueada / prueba vencida no inscribe.
    -- Va antes de cualquier escritura. Fail-closed: si no se puede evaluar, no pasa.
    IF NOT COALESCE(public.school_is_operational(v_school_id), false) THEN
        RAISE EXCEPTION 'Esta escuela tiene el periodo de prueba vencido: no puede recibir inscripciones nuevas.'
            USING ERRCODE = '42501';
    END IF;
    v_branch_id := COALESCE(p_branch_id, v_qr.branch_id);
    v_team_id   := CASE WHEN v_qr.target_type = 'team' THEN v_qr.target_id ELSE p_team_id END;
    v_plan_id   := CASE WHEN v_qr.target_type = 'plan' THEN v_qr.target_id ELSE p_plan_id END;
    v_doc       := public.normalize_doc_number(p_child_doc_number);
    v_name_key  := public.normalize_athlete_name(p_child_full_name);
    SELECT name INTO v_school_name FROM public.schools WHERE id = v_school_id;

    v_py       := EXTRACT(year  FROM v_today)::smallint;
    v_pm       := EXTRACT(month FROM v_today)::smallint;
    v_due_date := public.qr_first_charge_due_date(v_school_id, v_today);

    UPDATE public.profiles SET role='parent', phone=COALESCE(phone,p_phone)
     WHERE id = v_user_id AND role NOT IN ('admin','school','school_admin','super_admin','organizer','coach','wellness_professional','store_owner');

    IF p_unregistered_athlete_id IS NOT NULL THEN
        SELECT * INTO v_ua FROM public.unregistered_athletes
         WHERE id = p_unregistered_athlete_id
           AND COALESCE(is_active, true)
           AND linked_profile_id IS NULL;
        IF v_ua.id IS NULL THEN
            RAISE EXCEPTION 'Esa ficha ya no está disponible — puede que alguien más la haya reclamado. Actualiza la página e intenta de nuevo.'
                USING ERRCODE = '42501';
        END IF;

        INSERT INTO public.children (parent_id, school_id, branch_id, full_name, date_of_birth, doc_type, doc_number, gender, is_active)
        VALUES (v_user_id, v_ua.school_id, v_ua.branch_id, v_ua.full_name, v_ua.date_of_birth, v_ua.doc_type, v_ua.doc_number, v_ua.gender, true)
        RETURNING id INTO v_child_id;

        v_migrated := public.migrate_unregistered_athlete_to_profile(p_unregistered_athlete_id, NULL, v_child_id);

        SELECT id INTO v_enrollment_id FROM public.enrollments
         WHERE child_id = v_child_id ORDER BY created_at DESC LIMIT 1;

        SELECT id INTO v_payment_id FROM public.payments
         WHERE child_id = v_child_id AND status IN ('pending', 'overdue')
         ORDER BY created_at ASC LIMIT 1;

        UPDATE public.school_join_qr_codes SET signup_count = signup_count + 1 WHERE id = v_qr.id;

        INSERT INTO public.notifications (user_id, title, message, type, link)
        SELECT sm.profile_id, 'Nueva inscripción por QR',
               v_ua.full_name || ' (ficha pre-cargada) se inscribió via "' || v_qr.name || '"',
               'success', '/payments-automation'
        FROM public.school_members sm
        WHERE sm.school_id = v_school_id AND sm.role IN ('owner','admin') AND sm.status='active';

        RETURN jsonb_build_object('ok', true, 'qr_id', v_qr.id, 'school_id', v_school_id, 'child_id', v_child_id,
            'enrollment_id', v_enrollment_id, 'payment_id', v_payment_id,
            'requires_payment', v_payment_id IS NOT NULL,
            'migrated', v_migrated,
            'period', jsonb_build_object('year', v_py, 'month', v_pm));
    END IF;

    PERFORM public.claim_orphan_children(v_school_id);

    -- 20261013193011: valida el plan EFECTIVO (el del QR de plan o el elegido),
    -- como la variante de 12 args. Antes un QR de plan sin fixed_amount caía al
    -- p_monthly_fee que manda el cliente.
    IF v_plan_id IS NOT NULL THEN
        SELECT op.price INTO v_plan_price
        FROM public.offering_plans op
        WHERE op.id = v_plan_id AND op.school_id = v_school_id AND op.is_active = true;
        IF v_plan_price IS NULL THEN RAISE EXCEPTION 'Plan no válido para esta escuela' USING ERRCODE='22023'; END IF;
    END IF;

    v_amount := COALESCE(
        NULLIF(v_qr.fixed_amount, 0),
        NULLIF(v_plan_price, 0),
        (SELECT NULLIF(price_monthly, 0) FROM public.teams WHERE id = v_team_id AND school_id = v_school_id),
        NULLIF(p_monthly_fee, 0),
        0
    );

    IF p_existing_child_id IS NOT NULL THEN
        SELECT id INTO v_child_id FROM public.children WHERE id = p_existing_child_id AND parent_id = v_user_id;
        IF v_child_id IS NULL THEN RAISE EXCEPTION 'Hijo no válido para este usuario' USING ERRCODE='42501'; END IF;
        UPDATE public.children
           SET school_id = COALESCE(school_id, v_school_id),
               branch_id = COALESCE(branch_id, v_branch_id),
               team_id   = COALESCE(team_id, v_team_id)
         WHERE id = v_child_id;
    ELSE
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

                UPDATE public.children
                   SET parent_id         = v_user_id,
                       parent_email_temp = COALESCE(
                           (SELECT LOWER(email) FROM auth.users WHERE id = v_user_id),
                           parent_email_temp),
                       school_id  = COALESCE(school_id, v_school_id),
                       branch_id  = COALESCE(branch_id, v_branch_id),
                       team_id    = COALESCE(team_id, v_team_id),
                       date_of_birth = COALESCE(date_of_birth, p_child_dob),
                       gender        = COALESCE(gender, p_child_gender),
                       doc_type      = COALESCE(doc_type, p_child_doc_type),
                       updated_at    = now()
                 WHERE id = v_child_id;
            END IF;
        END IF;

        IF v_child_id IS NULL AND v_name_key IS NOT NULL THEN
            SELECT c.id, c.parent_id
              INTO v_match
              FROM public.children c
             WHERE c.school_id = v_school_id
               AND public.normalize_athlete_name(c.full_name) = v_name_key
               AND (c.parent_id IS NULL OR c.parent_id = v_user_id)
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
                       date_of_birth = COALESCE(date_of_birth, p_child_dob),
                       gender        = COALESCE(gender, p_child_gender),
                       doc_type      = COALESCE(doc_type, p_child_doc_type),
                       doc_number    = COALESCE(doc_number, p_child_doc_number),
                       updated_at    = now()
                 WHERE id = v_child_id;
            END IF;
        END IF;

        IF v_child_id IS NULL THEN
            BEGIN
                INSERT INTO public.children (parent_id, school_id, branch_id, team_id, full_name, date_of_birth, doc_type, doc_number, gender, monthly_fee, is_active)
                VALUES (v_user_id, v_school_id, v_branch_id, v_team_id, p_child_full_name, p_child_dob, p_child_doc_type, p_child_doc_number, p_child_gender, v_amount, true)
                RETURNING id INTO v_child_id;
            EXCEPTION WHEN unique_violation THEN
                RAISE EXCEPTION
                    'Ese atleta ya está registrado en % con el documento %. Entra a "Pagar mensualidad" o pídele a la escuela que lo vincule a tu cuenta.',
                    COALESCE(v_school_name, 'la escuela'), COALESCE(p_child_doc_number, 's/d')
                    USING ERRCODE = '23505';
            END;
        END IF;
    END IF;

    IF v_team_id IS NULL AND v_child_id IS NOT NULL THEN
        SELECT team_id INTO v_team_id FROM public.children WHERE id = v_child_id;
    END IF;

    SELECT id INTO v_enrollment_id
      FROM public.enrollments
     WHERE child_id = v_child_id AND school_id = v_school_id
       AND COALESCE(team_id::text, '') = COALESCE(v_team_id::text, '')
       AND status IN ('active', 'pending')
     ORDER BY created_at DESC
     LIMIT 1;

    IF v_enrollment_id IS NULL THEN
        SELECT id INTO v_enrollment_id
          FROM public.enrollments
         WHERE child_id = v_child_id AND school_id = v_school_id AND status = 'active'
         ORDER BY created_at DESC
         LIMIT 1;
    END IF;

    IF v_enrollment_id IS NULL THEN
        INSERT INTO public.enrollments (user_id, child_id, school_id, team_id, offering_plan_id, monthly_fee, start_date, status)
        VALUES (NULL, v_child_id, v_school_id, v_team_id, v_plan_id, NULLIF(v_amount, 0), v_today,
                CASE WHEN v_qr.require_first_payment THEN 'pending' ELSE 'active' END)
        RETURNING id INTO v_enrollment_id;
        v_enrollment_is_new := true;   -- solo esta rama marca alta nueva
    ELSE
        UPDATE public.enrollments
           SET team_id          = COALESCE(team_id, v_team_id),
               offering_plan_id = COALESCE(offering_plan_id, v_plan_id),
               monthly_fee      = COALESCE(monthly_fee, NULLIF(v_amount, 0)),
               updated_at       = now()
         WHERE id = v_enrollment_id;
    END IF;

    IF v_qr.require_first_payment AND v_amount > 0 THEN
        SELECT id INTO v_payment_id
          FROM public.payments
         WHERE child_id = v_child_id AND school_id = v_school_id
           AND status IN ('pending', 'overdue')
           AND COALESCE(receipt_url, '') = ''
           -- 20261013193011: una inscripción/seguro/artículo pendiente no es la mensualidad.
           AND COALESCE(payment_category, 'mensualidad') = 'mensualidad'
         ORDER BY created_at ASC
         LIMIT 1;

        IF v_payment_id IS NULL THEN
            SELECT true INTO v_period_settled
              FROM public.payments
             WHERE child_id = v_child_id AND school_id = v_school_id
               AND period_year = v_py AND period_month = v_pm
               AND COALESCE(payment_category, 'mensualidad') = 'mensualidad'
               AND status IN ('awaiting_approval', 'paid', 'partial', 'glosado')
             LIMIT 1;
        END IF;

        IF v_payment_id IS NULL AND NOT COALESCE(v_period_settled, false) THEN
            v_concept := 'Mensualidad ' || public.format_period_label(v_py, v_pm)
                         || ' - ' || COALESCE((SELECT full_name FROM public.children WHERE id = v_child_id), 'atleta')
                         || ' (' || v_school_name || ')';

            INSERT INTO public.payments (
                school_id, branch_id, parent_id, child_id, team_id, offering_plan_id,
                concept, amount, due_date, status, payment_type, qr_id,
                period_year, period_month, payment_category)
            VALUES (
                v_school_id, v_branch_id, v_user_id, v_child_id, v_team_id, v_plan_id,
                v_concept, v_amount, v_due_date, 'pending', 'one_time', v_qr.id,
                v_py, v_pm, 'mensualidad')
            RETURNING id INTO v_payment_id;
        ELSIF v_payment_id IS NOT NULL THEN
            UPDATE public.payments SET parent_id = v_user_id
             WHERE id = v_payment_id AND parent_id IS NULL;
        END IF;
    END IF;

    -- 20261013193011: inscripción y seguro del plan, SOLO con alta nueva (re-escanear
    -- no duplica: emit_enrollment_fees no deduplica la inscripción) y solo si el niño
    -- no tuvo antes otra inscripción viva ni un cobro de inscripción no anulado en la
    -- escuela. Después de la mensualidad, para que su búsqueda no tome estas filas,
    -- y con el MISMO vencimiento que ella (el trigger del primer cobro puede moverlo).
    IF v_enrollment_is_new AND v_plan_id IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM public.enrollments e
            WHERE e.child_id = v_child_id AND e.school_id = v_school_id
              AND e.id <> v_enrollment_id AND e.status <> 'cancelled')
       AND NOT EXISTS (
           SELECT 1 FROM public.payments p
            WHERE p.child_id = v_child_id AND p.school_id = v_school_id
              AND p.payment_category = 'inscripcion' AND p.status <> 'cancelled')
    THEN
        v_fee_ids := COALESCE(public.emit_enrollment_fees(
            v_school_id, v_plan_id, v_child_id, NULL, NULL, v_user_id, v_branch_id,
            COALESCE((SELECT due_date FROM public.payments WHERE id = v_payment_id), v_due_date),
            (SELECT full_name FROM public.children WHERE id = v_child_id),
            false, false), ARRAY[]::uuid[]);
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
        'period', jsonb_build_object('year', v_py, 'month', v_pm),
        'enrollment_is_new', v_enrollment_is_new,
        'fee_payment_ids', to_jsonb(v_fee_ids),
        'requires_fee_payment', cardinality(v_fee_ids) > 0);
END;
$function$;

-- Verificación: el cuerpo nuevo es exactamente el vivo + el guard, y la ACL no cambió.
DO $post$
DECLARE v_md5 text; v_acl text;
BEGIN
  SELECT md5(replace(prosrc, E'\r', '')), proacl::text INTO v_md5, v_acl FROM pg_proc
   WHERE oid = 'public.submit_qr_signup(text,uuid,uuid,text,date,text,text,text,text,numeric,uuid,uuid)'::regprocedure;
  IF v_md5 IS DISTINCT FROM '4eae0c15606e8cdba1ae102b379f5bf5' THEN
    RAISE EXCEPTION 'submit_qr_signup (12 args): cuerpo resultante inesperado (md5 %)', v_md5;
  END IF;
  IF v_acl NOT LIKE '%authenticated=X/%' OR v_acl LIKE '{=X/%' OR v_acl LIKE '%,=X/%' THEN
    RAISE EXCEPTION 'ACL inesperada en submit_qr_signup (12 args): %', v_acl;
  END IF;

  SELECT md5(replace(prosrc, E'\r', '')), proacl::text INTO v_md5, v_acl FROM pg_proc
   WHERE oid = 'public.submit_qr_signup(text,uuid,uuid,text,date,text,text,text,text,numeric,uuid,uuid,uuid)'::regprocedure;
  IF v_md5 IS DISTINCT FROM 'cced5836c5af7f5e48e1648700ef9dfa' THEN
    RAISE EXCEPTION 'submit_qr_signup (13 args): cuerpo resultante inesperado (md5 %)', v_md5;
  END IF;
  IF v_acl NOT LIKE '{=X/%' AND v_acl NOT LIKE '%,=X/%' THEN
    RAISE EXCEPTION 'ACL inesperada en submit_qr_signup (13 args): %', v_acl;
  END IF;
END
$post$;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- -----------------------------------------------------------------------------
-- Verificación manual (solo lectura): qué hará el guard con cada QR activo.
-- -----------------------------------------------------------------------------
-- SELECT s.name, q.slug, public.school_is_operational(q.school_id) AS operativa
--   FROM public.school_join_qr_codes q JOIN public.schools s ON s.id = q.school_id
--  WHERE q.active = true ORDER BY 3, 1;
