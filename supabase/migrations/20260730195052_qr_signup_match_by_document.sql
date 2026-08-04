-- =============================================================================
-- 20260730195052_qr_signup_match_by_document.sql
-- Autor: brylop   Fecha: 2026-07-31   Versión anterior: 20260730195021
-- Objetivo: que el DOCUMENTO del atleta mande sobre el correo y sobre el nombre
--           al vincular/inscribir, y que la búsqueda sea GLOBAL (todos los
--           equipos y todas las escuelas), no por equipo.
--
-- Caso real (Dynasty, 2026-07-30): SANTIAGO MUÑOZ ALVAREZ estaba pre-cargado con
-- doc 1028874411 y parent_email_temp = 'santiagoVpaulaalvarez@gmail.com' (typo:
-- V por Y). La mamá entró con 'santiagoYpaulaalvarez@gmail.com':
--   · claim_orphan_children() compara correos → no adoptó al hijo;
--   · submit_qr_signup() reutiliza por nombre exacto y ella escribió
--     "Santiago Muñoz" (en BD "SANTIAGO MUÑOZ ALVAREZ") → tampoco lo reutilizó;
--   · siguió al INSERT y lo frenó el índice único de documento, mostrándole en
--     pantalla el error crudo "duplicate key value violates unique constraint
--     uq_children_doc_dynasty" y dejándola sin salida.
-- Y por el otro camino (/join-team/:teamId), validate_child_for_team_join busca
-- el documento SOLO dentro de ese equipo: con el link del equipo equivocado el
-- acudiente recibe "no encontrado" aunque su hijo sí exista en la escuela.
--
-- Este fix:
--   1. normalize_doc_number()        → compara documentos sin puntos/espacios.
--   2. find_athletes_by_document()   → búsqueda GLOBAL por documento (todos los
--                                      equipos y escuelas). Puede devolver varias
--                                      filas: 51 documentos de la BD están en dos
--                                      escuelas distintas (mismo chico, dos clubes),
--                                      así que el acudiente elige.
--   3. claim_children_by_document()  → vincula al acudiente con los atletas que
--                                      elija (adopta huérfanos, deja intactos los
--                                      que ya tienen otro acudiente) y le asegura
--                                      su school_members de cada escuela.
--   4. submit_qr_signup()            → antes de INSERT busca por documento DENTRO
--                                      de la escuela del QR: si es huérfano lo
--                                      adopta, si ya es suyo lo reutiliza, y si es
--                                      de otro acudiente falla con texto legible.
--                                      Nunca mueve un atleta de escuela.
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. normalize_doc_number: "1.028.874-411 " → "1028874411"
--    Alfanumérico para tolerar pasaportes. IMMUTABLE para poder indexar luego.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.normalize_doc_number(p_doc text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT NULLIF(UPPER(regexp_replace(COALESCE(p_doc, ''), '[^A-Za-z0-9]', '', 'g')), '');
$$;

COMMENT ON FUNCTION public.normalize_doc_number(text) IS
    'Normaliza un documento para comparar: quita puntos/espacios/guiones y pasa a mayúsculas. NULL si queda vacío.';

GRANT EXECUTE ON FUNCTION public.normalize_doc_number(text) TO anon, authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. find_athletes_by_document: búsqueda GLOBAL por documento
--    p_school_id opcional: si viene, ordena primero los de esa escuela (no los
--    filtra, para que el link del equipo equivocado igual encuentre al atleta).
--
--    Exposición: es callable por anon igual que la validate_child_for_team_join
--    que ya existía (misma clase de dato: nombre del atleta a partir del
--    documento). Se endurece con documento completo (>= 5 caracteres), sin
--    coincidencias parciales, tope de 10 filas y sin datos de contacto.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.find_athletes_by_document(
    p_doc_number text,
    p_school_id  uuid DEFAULT NULL
)
RETURNS TABLE (
    child_id      uuid,
    full_name     text,
    date_of_birth date,
    school_id     uuid,
    school_name   text,
    team_id       uuid,
    team_name     text,
    branch_name   text,
    already_linked boolean,
    is_mine       boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_doc  text := public.normalize_doc_number(p_doc_number);
    v_user uuid := auth.uid();
BEGIN
    -- Documento completo o nada: evita barrer la tabla con 2 dígitos.
    IF v_doc IS NULL OR length(v_doc) < 5 THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT c.id,
           c.full_name,
           c.date_of_birth,
           c.school_id,
           s.name,
           c.team_id,
           t.name,
           b.name,
           (c.parent_id IS NOT NULL AND c.parent_id <> COALESCE(v_user, '00000000-0000-0000-0000-000000000000'::uuid)),
           (v_user IS NOT NULL AND c.parent_id = v_user)
      FROM public.children c
      LEFT JOIN public.schools         s ON s.id = c.school_id
      LEFT JOIN public.teams           t ON t.id = c.team_id
      LEFT JOIN public.school_branches b ON b.id = c.branch_id
     WHERE public.normalize_doc_number(c.doc_number) = v_doc
       AND COALESCE(c.is_active, true) = true
     ORDER BY (c.school_id = p_school_id) DESC NULLS LAST,
              (c.parent_id IS NULL) DESC,
              c.created_at ASC
     LIMIT 10;
END;
$$;

COMMENT ON FUNCTION public.find_athletes_by_document(text, uuid) IS
    'Busca atletas por documento en TODOS los equipos y escuelas (global). p_school_id solo prioriza el orden. Exige documento completo (>=5) y devuelve máx. 10 filas.';

GRANT EXECUTE ON FUNCTION public.find_athletes_by_document(text, uuid) TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. claim_children_by_document: el acudiente se vincula con SUS atletas
--    p_child_ids: los que eligió en la UI. NULL = todos los huérfanos que
--    coincidan con el documento (caso de un solo match).
--    Nunca le quita un atleta a otro acudiente: lo reporta en taken_by_other.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_children_by_document(
    p_doc_number text,
    p_child_ids  uuid[] DEFAULT NULL,
    p_full_name  text   DEFAULT NULL,
    p_phone      text   DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_user  uuid := auth.uid();
    v_doc   text := public.normalize_doc_number(p_doc_number);
    v_row   record;
    v_claimed      jsonb := '[]'::jsonb;
    v_already_mine jsonb := '[]'::jsonb;
    v_taken        jsonb := '[]'::jsonb;
    v_seen  int := 0;
BEGIN
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'Debes iniciar sesión para vincular a un atleta' USING ERRCODE = '42501';
    END IF;
    IF v_doc IS NULL OR length(v_doc) < 5 THEN
        RAISE EXCEPTION 'Ingresa el número de documento completo del atleta' USING ERRCODE = '22023';
    END IF;

    -- Perfil del acudiente: nunca degradar un rol privilegiado (ver
    -- feedback/roles: mapear a 'parent' solo si hoy no es staff).
    UPDATE public.profiles
       SET role      = 'parent',
           full_name = COALESCE(NULLIF(TRIM(p_full_name), ''), full_name),
           phone     = COALESCE(phone, NULLIF(TRIM(p_phone), ''))
     WHERE id = v_user
       AND role NOT IN ('admin', 'school', 'school_admin', 'super_admin',
                        'organizer', 'coach', 'wellness_professional', 'store_owner');

    FOR v_row IN
        SELECT c.id, c.full_name, c.school_id, c.parent_id, c.branch_id
          FROM public.children c
         WHERE public.normalize_doc_number(c.doc_number) = v_doc
           AND COALESCE(c.is_active, true) = true
           AND (p_child_ids IS NULL OR c.id = ANY (p_child_ids))
         ORDER BY c.created_at ASC
         LIMIT 10
    LOOP
        v_seen := v_seen + 1;

        IF v_row.parent_id = v_user THEN
            v_already_mine := v_already_mine || jsonb_build_object('child_id', v_row.id, 'full_name', v_row.full_name);
            CONTINUE;
        END IF;

        IF v_row.parent_id IS NOT NULL THEN
            -- De otro acudiente: no se toca. La escuela resuelve esos casos.
            v_taken := v_taken || jsonb_build_object('child_id', v_row.id, 'full_name', v_row.full_name);
            CONTINUE;
        END IF;

        -- Huérfano pre-cargado → adoptar. Se corrige también el correo temporal
        -- para que el claim por correo funcione de aquí en adelante (era el typo
        -- que originó todo el caso).
        UPDATE public.children
           SET parent_id         = v_user,
               parent_email_temp = COALESCE(
                   (SELECT LOWER(email) FROM auth.users WHERE id = v_user),
                   parent_email_temp),
               updated_at        = now()
         WHERE id = v_row.id;

        v_claimed := v_claimed || jsonb_build_object('child_id', v_row.id, 'full_name', v_row.full_name, 'school_id', v_row.school_id);
    END LOOP;

    -- Membresía de acudiente en cada escuela involucrada (idempotente, sin
    -- depender del nombre de un constraint).
    FOR v_row IN
        SELECT DISTINCT c.school_id, c.branch_id
          FROM public.children c
         WHERE c.parent_id = v_user
           AND public.normalize_doc_number(c.doc_number) = v_doc
           AND c.school_id IS NOT NULL
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.school_members sm
             WHERE sm.school_id = v_row.school_id
               AND sm.profile_id = v_user
               AND sm.role = 'parent'
        ) THEN
            INSERT INTO public.school_members (school_id, profile_id, role, status, branch_id)
            SELECT v_row.school_id, v_user, 'parent', 'active', v_row.branch_id
             WHERE EXISTS (SELECT 1 FROM public.schools WHERE id = v_row.school_id);
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'ok',             true,
        'matches',        v_seen,
        'claimed',        v_claimed,
        'already_mine',   v_already_mine,
        'taken_by_other', v_taken
    );
END;
$$;

COMMENT ON FUNCTION public.claim_children_by_document(text, uuid[], text, text) IS
    'Vincula al acudiente autenticado con los atletas que coincidan por documento (global, todas las escuelas). Adopta huérfanos, respeta los que ya tienen otro acudiente y asegura school_members role=parent.';

GRANT EXECUTE ON FUNCTION public.claim_children_by_document(text, uuid[], text, text) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. submit_qr_signup: el documento manda antes de crear
--    Base: 20260729000002 (idempotente por correo y por nombre). Se añade el
--    match por DOCUMENTO dentro de la escuela del QR y errores legibles.
--    Ojo: aquí NO se busca global — adoptar un atleta de otra escuela para
--    inscribirlo en esta corrompería el dato. Global es solo para vincular.
-- ─────────────────────────────────────────────────────────────────────────────
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
    v_due_date date := CURRENT_DATE; v_concept text; v_school_name text;
    v_doc text; v_match record;
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
        INSERT INTO public.enrollments (user_id, child_id, school_id, team_id, start_date, status)
        VALUES (NULL, v_child_id, v_school_id, v_team_id, CURRENT_DATE,
                CASE WHEN v_qr.require_first_payment THEN 'pending' ELSE 'active' END)
        RETURNING id INTO v_enrollment_id;
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

        IF v_payment_id IS NULL THEN
            v_concept := 'Primer pago - ' || COALESCE((SELECT full_name FROM public.children WHERE id = v_child_id), 'inscripción') || ' (' || v_school_name || ')';
            INSERT INTO public.payments (school_id, branch_id, parent_id, child_id, team_id, concept, amount, due_date, status, payment_type, qr_id)
            VALUES (v_school_id, v_branch_id, v_user_id, v_child_id, v_team_id, v_concept, v_amount, v_due_date, 'pending', 'one_time', v_qr.id)
            RETURNING id INTO v_payment_id;
        ELSE
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
        'requires_payment', v_qr.require_first_payment AND v_payment_id IS NOT NULL, 'amount', v_amount);
END;
$$;

COMMENT ON FUNCTION public.submit_qr_signup(text, uuid, uuid, text, date, text, text, text, text, numeric, uuid, uuid) IS
    'Inscripción por QR. Orden de match del atleta: documento (dentro de la escuela) > nombre > crear. Adopta pre-cargados huérfanos, no roba atletas de otro acudiente y traduce las violaciones de único a texto legible.';

GRANT EXECUTE ON FUNCTION public.submit_qr_signup(text, uuid, uuid, text, date, text, text, text, text, numeric, uuid, uuid) TO authenticated;

COMMIT;
