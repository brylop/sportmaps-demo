-- =============================================================================
-- 20260803110621_qr_signup_enrollment_completa.sql
-- Autor: brylop   Fecha: 2026-08-03   Versión anterior: 20260802224625
-- Objetivo: que el alta por QR deje la inscripción COMPLETA (con plan y cuota) y
--   que rellene las que quedaron vacías, sin tener que reimprimir ningún QR.
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
-- El INSERT de `enrollments` de submit_qr_signup omitía `offering_plan_id` y
-- `monthly_fee`, con las dos variables (v_plan_id, v_amount) ya resueltas unas líneas
-- arriba. La RPC incluso guarda v_amount en `children.monthly_fee` — lo tenía en la
-- mano y no lo escribía en la inscripción.
--
-- Cuando el QR no apunta a un equipo (`target_type <> 'team'` y sin p_team_id), la fila
-- quedaba sin equipo, sin plan y sin cuota. El generador del mes le inventaba un monto
-- (cae a children.monthly_fee) y el atleta contaba como activo sin cobro correcto.
--
-- Timing que lo confirma: la migración 20260730195052 se aplicó el 2026-07-30 19:50:52
-- y la primera inscripción vacía apareció 19:52:16 — 84 segundos después. Van 17, una
-- cada pocas horas, todas de DYNASTY VOLLEY CLUB.
--
-- QUÉ CAMBIA
--
--   1. El INSERT lleva plan y cuota.
--   2. La rama de reuso rellena huecos en vez de dejar la fila como estaba. Es la que
--      mitiga lo ya creado: los QR impresos siguen apuntando a esta RPC, así que la
--      próxima pasada completa la inscripción.
--   3. Backfill de una sola vez para las que nadie va a volver a escanear.
--
-- FUERA DE ALCANCE
--
-- Que asignar equipo o plan desde la app INSERTE una segunda inscripción en vez de
-- completar la existente (los 80 atletas con 2+ activas). Es otro camino, otro fix.
-- Ver docs/plan-mitigacion-dynasty-2026-08-03.md, bloque 4.2.

BEGIN;

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
        -- Antes este INSERT omitía offering_plan_id y monthly_fee, y las dos variables
        -- estaban acá mismo en alcance. Si el QR no fijaba equipo, la fila nacía sin
        -- equipo, sin plan y sin cuota: una inscripción activa que no dice nada. El
        -- generador del mes le inventaba un monto y el atleta contaba como activo sin
        -- cobro correcto. 17 filas así entre el 2026-07-30 y el 2026-08-02.
        --
        -- NULLIF(v_amount, 0) a propósito: si no se pudo resolver un precio, se deja
        -- NULL para que la vista caiga al price del plan. Un 0 explícito ganaría el
        -- COALESCE y dejaría la cuota en cero.
        INSERT INTO public.enrollments (user_id, child_id, school_id, team_id, offering_plan_id, monthly_fee, start_date, status)
        VALUES (NULL, v_child_id, v_school_id, v_team_id, v_plan_id, NULLIF(v_amount, 0), CURRENT_DATE,
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
    'Inscripción por QR. Orden de match del atleta: documento (dentro de la escuela) > nombre > crear. Adopta pre-cargados huérfanos, no roba atletas de otro acudiente y traduce las violaciones de único a texto legible. La inscripción se crea CON plan y cuota, y si ya existía se le rellenan los huecos (nunca se sobrescribe lo que puso la escuela).';

GRANT EXECUTE ON FUNCTION public.submit_qr_signup(text, uuid, uuid, text, date, text, text, text, text, numeric, uuid, uuid) TO authenticated;

-- ── Backfill: cuota de las inscripciones que quedaron vacías ────────────────
--
-- Solo toca filas activas sin equipo, sin plan y sin cuota, y solo si el menor tiene
-- una cuota registrada. `children.monthly_fee` es el mismo v_amount que esta RPC
-- calculó al momento del alta, así que no se está inventando un precio.
--
-- NO se asigna plan acá: emparejar por monto es una heurística y hay dos planes de
-- $90.000 en Dynasty, así que el monto no alcanza para elegir. El plan se asigna con
-- la escuela confirmando, según el bloque 3.1 del runbook. Para el cobro correcto
-- alcanza con monthly_fee, que es lo primero que lee el generador.
--
-- Reversible: volver a poner monthly_fee en NULL en esas mismas filas.

UPDATE public.enrollments e
   SET monthly_fee = c.monthly_fee,
       updated_at  = now()
  FROM public.children c
 WHERE c.id = e.child_id
   AND e.status = 'active'
   AND e.team_id IS NULL
   AND e.offering_plan_id IS NULL
   AND e.monthly_fee IS NULL
   AND COALESCE(c.monthly_fee, 0) > 0;

COMMIT;

-- ── Verificación después de aplicar ────────────────────────────────────────
--
-- 1) No deben quedar inscripciones activas sin cuota por esta causa:
--
--    SELECT count(*) FROM public.enrollments
--     WHERE status = 'active' AND team_id IS NULL
--       AND offering_plan_id IS NULL AND monthly_fee IS NULL;
--
-- 2) Alta nueva por QR: la inscripción resultante debe traer offering_plan_id y
--    monthly_fee cuando el QR apunta a un plan, y monthly_fee cuando apunta a equipo.
--
--    SELECT id, team_id, offering_plan_id, monthly_fee, created_at
--      FROM public.enrollments ORDER BY created_at DESC LIMIT 5;
--
-- 3) Segunda pasada por el mismo QR: no debe crear una fila nueva y debe haber
--    completado la que existía (comparar updated_at contra created_at).
