-- =============================================================================
-- 20260812183012_qr_signup_adopta_ficha_precargada.sql
-- Autor: brylop   Fecha: 2026-08-12   Versión anterior: 20260812174317
-- Objetivo: que el auto-registro por QR deje de crear una SEGUNDA ficha cuando
--   la escuela ya tenía al atleta pre-cargado y el acudiente no teclea el
--   documento (o lo teclea con un typo).
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
-- `submit_qr_signup` tiene tres capas para no duplicar, y en el caso más común
-- las dos primeras son inalcanzables:
--
--   (a) match por documento   → envuelto en `IF v_doc IS NOT NULL`. Si el
--                               acudiente no teclea el documento, no corre.
--   (b) match por nombre      → filtra `AND parent_id = v_user_id`, o sea SOLO
--                               encuentra hijos que YA son de esa cuenta. La
--                               ficha pre-cargada por la escuela tiene
--                               `parent_id` NULL: nunca la ve.
--   (c) INSERT de cero        → cae siempre acá.
--
-- Resultado: papá escanea el QR, no teclea documento → ficha nueva, garantizado.
-- Es determinístico, no una carrera.
--
-- Evidencia en DYNASTY VOLLEY CLUB (2026-08-12), 4 duplicados en 3 días:
--
--   Darwin Hernández        10-ago 19:52  doc NULL  → (a) saltada
--   Jefferson Rojas         11-ago 20:52  doc 1030595277 vs 1030595288 pre-cargado
--   Laura Sofía Castillo    12-ago 17:13  doc NULL  → (a) saltada
--   Alexander Castillo      12-ago 17:14  doc NULL  → (a) saltada
--
-- En los cuatro: cuenta creada, ficha 4-6 s después, inscripción en el mismo
-- segundo. Es el auto-registro, no el alta manual de la escuela.
--
-- QUÉ CAMBIA
--
-- La capa (b) deja de exigir `parent_id = v_user_id` y pasa a buscar en TODA la
-- escuela por nombre normalizado (sin tildes, sin dobles espacios, sin
-- may/min), con dos candados:
--
--   · Solo adopta fichas LIBRES (`parent_id IS NULL`). Si la ficha ya tiene otro
--     acudiente, NO adopta y NO revienta: sigue de largo y crea la suya. Ese
--     caso es un homónimo real (tres "VICTORIA GOMEZ" distintas en la misma
--     escuela) o una disputa de acudiente, y ninguno se resuelve solo.
--   · Si el acudiente tecleó fecha de nacimiento y la ficha pre-cargada también
--     la tiene, tienen que COINCIDIR. Es la señal más fuerte que hay (coincide
--     en 11 de 13 duplicados medidos) y es lo que evita fusionar hermanos con
--     el mismo nombre. Si alguna de las dos no tiene fecha, manda el nombre.
--
-- POR QUÉ NO SE FUSIONA POR PARECIDO
--
-- Nada de distancia de edición ni de similitud acá. Gabriela y Juliana
-- Simbaqueva comparten fecha de nacimiento y tienen documentos consecutivos:
-- son gemelas. Un casi-duplicado se le pregunta al acudiente, no se decide en
-- una RPC. Eso vive en F3.2 del plan, no acá.
--
-- LO QUE ESTA MIGRACIÓN NO CIERRA
--
-- `parents.ts:83` (AddChildDialog) sigue haciendo INSERT crudo desde el cliente,
-- sin ningún chequeo. Es la puerta #5 del plan F3 y necesita cambio de
-- frontend. Esta migración cierra la puerta por la que entraron los 4 de esta
-- semana; la #5 queda abierta.
-- =============================================================================

BEGIN;

-- ── normalize_athlete_name: la llave de nombre, una sola definición ─────────
-- Misma normalización que usa el detector de duplicados
-- (scripts/audit-duplicate-athletes.mjs) y el bloque 3 del script de auditoría:
-- minúsculas, sin tildes, sin dobles espacios, sin bordes.
--
-- `translate` y no `unaccent`: la extensión unaccent no está instalada y
-- pedirla acá acopla esta migración a un CREATE EXTENSION que necesita
-- privilegios distintos. La lista cubre el español; si aparece otro idioma se
-- amplía en una migración nueva.
--
-- IMMUTABLE a propósito: así puede sostener un índice funcional cuando F3.3
-- extienda la unicidad por escuela. STABLE no sirve para eso.
CREATE OR REPLACE FUNCTION public.normalize_athlete_name(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT NULLIF(
        btrim(regexp_replace(
            lower(translate(p_name,
                'ÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇáàäâãéèëêíìïîóòöôõúùüûñç',
                'AAAAAEEEEIIIIOOOOOUUUUNCaaaaaeeeeiiiiooooouuuunc')),
            '\s+', ' ', 'g')),
        '');
$$;

COMMENT ON FUNCTION public.normalize_athlete_name(text) IS
  'Llave de comparación de nombres de atleta: minúsculas, sin tildes, espacios colapsados, vacío → NULL. Igualdad EXACTA sobre esta llave; no hace parecido ni distancia de edición — un casi-duplicado lo confirma un humano.';

GRANT EXECUTE ON FUNCTION public.normalize_athlete_name(text) TO anon, authenticated, service_role;

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
  'Auto-registro por QR. Antes de crear ficha busca la pre-cargada de la escuela por documento (a) y por nombre normalizado + fecha de nacimiento (b). Solo adopta fichas LIBRES (parent_id NULL): si el nombre coincide con la ficha de otro acudiente, no adopta y crea la suya — un homónimo no se resuelve adivinando. Un casi-duplicado (documento con typo, nombre parecido) NO se fusiona acá: eso se le pregunta al acudiente (F3.2).';

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ── Verificación después de aplicar ────────────────────────────────────────
--
-- 1) La capa (b) ya no filtra por acudiente. Si esto devuelve una fila, la
--    migración NO quedó aplicada:
--
--    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--     WHERE n.nspname='public' AND p.proname='submit_qr_signup'
--       AND pg_get_functiondef(p.oid) LIKE '%school_id = v_school_id AND parent_id = v_user_id%';
--
-- 2) La helper de nombre existe y normaliza igual que el detector:
--
--    SELECT public.normalize_athlete_name('  Anaisabel   MONDRAGÓN Mejía ');
--    -- esperado: 'anaisabel mondragon mejia'
--
-- 3) Prueba funcional (en una escuela de pruebas, NO en Dynasty):
--    · pre-cargar una ficha con parent_id NULL, nombre "PRUEBA UNO", sin documento
--    · registrarse por QR tecleando "prueba uno" y SIN documento
--    · esperado: `child_id` devuelto == el id de la ficha pre-cargada, y
--      `SELECT count(*) FROM children WHERE school_id=… AND full_name ILIKE 'prueba uno'`
--      sigue en 1.
--
-- 4) Homónimos: repetir (3) pero con la ficha pre-cargada ya asignada a OTRO
--    acudiente. Esperado: se crea una ficha nueva y NO se roba la ajena.