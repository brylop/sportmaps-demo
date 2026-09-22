-- =============================================================================
-- 20260918140634_buscar_menor_incluye_unregistered_athletes.sql
-- Autor: brylop   Fecha: 2026-09-18   Versión anterior: 20260918130753
-- Objetivo: la búsqueda por documento del paso nuevo de auto-registro
--   (JoinSchoolPublicPage) solo miraba `children` — nunca `unregistered_athletes`,
--   que es donde Besser (y cualquier escuela con carga masiva) tiene la ficha
--   real de sus atletas ANTES de que un acudiente la reclame. Resultado medido
--   contra Besser: 69 atletas cargados en unregistered_athletes, 19 ya
--   vinculados, 50 sin vincular — y la búsqueda nueva le decía "no encontramos
--   nada" a esos 50 aunque el papá escribiera el documento correcto.
--
-- POR QUÉ ES MÁS QUE UNA MOLESTIA: de esos 50, 45 YA TIENEN UN PAGO REAL
-- asociado (`payments.unregistered_athlete_id`), 50 tienen inscripción y 33
-- asistencia. Si el acudiente caía al flujo "registrar como nuevo" de
-- `submit_qr_signup`, se le creaba una ficha (`children`) NUEVA y SIN NINGUNA
-- relación con esos pagos/inscripciones/asistencias reales — quedaban
-- huérfanos bajo el `unregistered_athlete_id` viejo, con riesgo real de cobro
-- doble (una inscripción nueva sin el pago ya hecho, mientras el pago viejo
-- queda invisible).
-- =============================================================================
--
-- QUÉ CAMBIA
--
-- 1. `buscar_menor_por_documento_publico` ahora hace UNION con
--    `unregistered_athletes` (solo filas sueltas: `linked_profile_id IS NULL`
--    Y `is_active`). Se agrega la columna `source` ('children' |
--    'unregistered_athlete') para que el front sepa a cuál de las dos RPCs de
--    adopción tiene que llamar. El equipo/plan de una ficha de
--    `unregistered_athletes` no vive en esa tabla — vive en el `enrollments`
--    que ya la referencia (`unregistered_athlete_id`) — así que se resuelve
--    con un LEFT JOIN a esa inscripción existente.
--
-- 2. `submit_qr_signup` suma un parámetro nuevo, `p_unregistered_athlete_id`.
--    Cuando viene, NO repite la lógica de adopción de `children` — crea la
--    ficha `children` a partir de los datos de `unregistered_athletes` y
--    llama a `migrate_unregistered_athlete_to_profile` (la MISMA función que
--    ya usa `accept_invitation_pro` para el flujo de invitación viejo, con
--    todos sus fixes de FK y de propagación de parent_id ya resueltos —
--    no se reescribe esa lógica, se reutiliza). Esa migración reata
--    enrollments/attendance_records/session_bookings/payments/zk_user_mappings
--    del `unregistered_athlete_id` viejo al `child_id` nuevo. El bloque de
--    "cobro idempotente" de `submit_qr_signup` se SALTA por completo en esta
--    rama: el pago pendiente, si existe, ya quedó reatado por la migración —
--    crear uno nuevo encima sería el cobro doble que esto viene a evitar.
--
-- `migrate_unregistered_athlete_to_profile` está otorgada solo a
-- `service_role` (no a `anon`/`authenticated`) — llamarla desde dentro de
-- `submit_qr_signup` (SECURITY DEFINER, dueño el rol de migraciones) funciona
-- igual que ya funciona para `claim_orphan_children` un poco más abajo en la
-- misma función: la verificación de privilegios de la llamada anidada corre
-- contra el DUEÑO de `submit_qr_signup`, no contra quien la invocó desde el
-- navegador.
-- =============================================================================

BEGIN;

-- ── 1. buscar_menor_por_documento_publico: UNION con unregistered_athletes ──
DROP FUNCTION IF EXISTS public.buscar_menor_por_documento_publico(text, uuid);

CREATE FUNCTION public.buscar_menor_por_documento_publico(
    p_doc_number text,
    p_school_id  uuid
)
RETURNS TABLE (
    child_id            uuid,
    nombre              text,
    school_id           uuid,
    school_name         text,
    team_name           text,
    branch_name         text,
    already_linked      boolean,
    parent_name_temp    text,
    parent_email_temp   text,
    parent_phone_temp   text,
    source              text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT c.id,
           (
             split_part(btrim(c.full_name), ' ', 1)
             || COALESCE(
                  (SELECT string_agg(' ' || left(w, 1) || '.', '')
                     FROM unnest(string_to_array(btrim(c.full_name), ' ')) WITH ORDINALITY AS t(w, i)
                    WHERE i > 1 AND w <> ''),
                  '')
           ),
           c.school_id,
           s.name,
           t.name,
           b.name,
           (c.parent_id IS NOT NULL),
           CASE WHEN c.parent_id IS NULL THEN c.parent_name_temp  END,
           CASE WHEN c.parent_id IS NULL THEN c.parent_email_temp END,
           CASE WHEN c.parent_id IS NULL THEN c.parent_phone_temp END,
           'children'::text
      FROM public.children c
      LEFT JOIN public.schools         s ON s.id = c.school_id
      LEFT JOIN public.teams           t ON t.id = c.team_id
      LEFT JOIN public.school_branches b ON b.id = c.branch_id
     WHERE regexp_replace(COALESCE(c.doc_number, ''), '[^0-9]', '', 'g')
         = regexp_replace(COALESCE(p_doc_number, ''), '[^0-9]', '', 'g')
       AND regexp_replace(COALESCE(p_doc_number, ''), '[^0-9]', '', 'g') <> ''
       AND p_school_id IS NOT NULL
       AND COALESCE(c.is_active, true)

    UNION ALL

    SELECT ua.id,
           (
             split_part(btrim(ua.full_name), ' ', 1)
             || COALESCE(
                  (SELECT string_agg(' ' || left(w, 1) || '.', '')
                     FROM unnest(string_to_array(btrim(ua.full_name), ' ')) WITH ORDINALITY AS t(w, i)
                    WHERE i > 1 AND w <> ''),
                  '')
           ),
           ua.school_id,
           s.name,
           t.name,
           b.name,
           (ua.linked_profile_id IS NOT NULL),
           CASE WHEN ua.linked_profile_id IS NULL THEN ua.guardian_full_name END,
           CASE WHEN ua.linked_profile_id IS NULL THEN ua.guardian_email    END,
           CASE WHEN ua.linked_profile_id IS NULL THEN ua.guardian_phone   END,
           'unregistered_athlete'::text
      FROM public.unregistered_athletes ua
      LEFT JOIN public.schools s ON s.id = ua.school_id
      LEFT JOIN public.enrollments e ON e.unregistered_athlete_id = ua.id AND e.status IN ('active', 'pending')
      LEFT JOIN public.teams t ON t.id = e.team_id
      LEFT JOIN public.school_branches b ON b.id = ua.branch_id
     WHERE regexp_replace(COALESCE(ua.doc_number, ''), '[^0-9]', '', 'g')
         = regexp_replace(COALESCE(p_doc_number, ''), '[^0-9]', '', 'g')
       AND regexp_replace(COALESCE(p_doc_number, ''), '[^0-9]', '', 'g') <> ''
       AND p_school_id IS NOT NULL
       AND COALESCE(ua.is_active, true);
$$;

REVOKE ALL ON FUNCTION public.buscar_menor_por_documento_publico(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buscar_menor_por_documento_publico(text, uuid) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.buscar_menor_por_documento_publico(text, uuid) IS
    'Version publica y recortada de find_athletes_by_document, para JoinTeamPage / JoinSchoolPublicPage, sin sesion. '
    'Nombre del menor enmascarado, sin fecha de nacimiento (SEG-14). Desde 20260918123632 devuelve tambien '
    'parent_name_temp/parent_email_temp/parent_phone_temp cuando la ficha de children no tiene acudiente. '
    'Desde 20260918140634 hace UNION con unregistered_athletes (ficha pre-cargada por import masivo, antes de '
    'que el acudiente la reclame) — columna source (children | unregistered_athlete) dice cual RPC de adopcion usar.';

-- ── 2. submit_qr_signup: nueva rama p_unregistered_athlete_id ───────────────
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
    p_plan_id uuid DEFAULT NULL::uuid,
    p_unregistered_athlete_id uuid DEFAULT NULL::uuid)
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
    v_ua record;
    v_migrated jsonb;
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

    v_py       := EXTRACT(year  FROM v_today)::smallint;
    v_pm       := EXTRACT(month FROM v_today)::smallint;
    v_due_date := public.qr_first_charge_due_date(v_school_id, v_today);

    UPDATE public.profiles SET role='parent', phone=COALESCE(phone,p_phone)
     WHERE id = v_user_id AND role NOT IN ('admin','school','school_admin','super_admin','organizer','coach','wellness_professional','store_owner');

    -- ══ RAMA NUEVA: adoptar desde unregistered_athletes ════════════════════
    -- Reutiliza migrate_unregistered_athlete_to_profile (misma que usa
    -- accept_invitation_pro) para no perder pagos/inscripciones/asistencia
    -- que ya cuelgan del unregistered_athlete_id viejo. NO pasa por el resto
    -- de la función: retorna directo, porque el cobro (si hay) ya quedó
    -- reatado por la migración — crear uno encima sería cobro doble.
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
    -- ══ FIN RAMA NUEVA ══════════════════════════════════════════════════════

    -- Adopta hijos pre-cargados de este correo (parent_id NULL) para no duplicar.
    PERFORM public.claim_orphan_children(v_school_id);

    IF p_plan_id IS NOT NULL THEN
        SELECT op.price INTO v_plan_price
        FROM public.offering_plans op
        WHERE op.id = p_plan_id AND op.school_id = v_school_id AND op.is_active = true;
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
         ORDER BY created_at ASC
         LIMIT 1;

        IF v_payment_id IS NULL THEN
            SELECT true INTO v_period_settled
              FROM public.payments
             WHERE child_id = v_child_id AND school_id = v_school_id
               AND period_year = v_py AND period_month = v_pm
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
                period_year, period_month)
            VALUES (
                v_school_id, v_branch_id, v_user_id, v_child_id, v_team_id, v_plan_id,
                v_concept, v_amount, v_due_date, 'pending', 'one_time', v_qr.id,
                v_py, v_pm)
            RETURNING id INTO v_payment_id;
        ELSIF v_payment_id IS NOT NULL THEN
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

COMMENT ON FUNCTION public.submit_qr_signup(text,uuid,uuid,text,date,text,text,text,text,numeric,uuid,uuid,uuid) IS
  'Auto-registro por QR. Si viene p_unregistered_athlete_id, adopta esa ficha pre-cargada (import masivo, aún sin '
  'acudiente) reutilizando migrate_unregistered_athlete_to_profile — reata enrollments/attendance/payments viejos '
  'al child_id nuevo, sin crear cobro encima del que ya exista. Si no viene, sigue el flujo de siempre: busca en '
  'children por documento (a) y por nombre+fecha (b), o crea de cero (c); si nadie mandó equipo, usa el que ya '
  'tenía la ficha en children (20260918130622).';

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ── Verificación después de aplicar ────────────────────────────────────────
--
-- 1) Ficha libre de unregistered_athletes con pago/enrollment real:
--    select ua.id, ua.full_name, ua.doc_number,
--           (select count(*) from payments p where p.unregistered_athlete_id = ua.id) as pagos,
--           (select count(*) from enrollments e where e.unregistered_athlete_id = ua.id) as enrollments
--      from unregistered_athletes ua
--     where ua.school_id = '<school_id>' and ua.linked_profile_id is null
--     limit 1;
--
--    select * from buscar_menor_por_documento_publico('<doc de esa fila>', '<school_id>');
--    -- esperado: una fila con source='unregistered_athlete', already_linked=false,
--    -- guardian_* poblado.
--
-- 2) submit_qr_signup(p_slug:='<slug>', p_unregistered_athlete_id:='<id de esa fila>')
--    -- esperado: children nuevo, enrollment con el MISMO team_id/plan que tenía antes,
--    -- payment_id = el pago viejo (mismo id, no uno nuevo), unregistered_athletes.linked_profile_id
--    -- = el profile del acudiente, is_active=false.
--
-- 3) Confirmar que NO se duplicó el pago:
--    select count(*) from payments where child_id = '<child_id nuevo>';
--    -- esperado: el mismo número de pagos que tenía el unregistered_athlete_id antes, no +1.
