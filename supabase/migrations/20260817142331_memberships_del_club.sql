-- ============================================================================
-- CAR-4 — Membresías del club, deliberadamente FUERA de facturación
--
-- Fecha: 2026-08-17
-- Plan: docs/plan-club-carmel-multideporte-2026-08-15.md §2.1
--
-- ── El caso ─────────────────────────────────────────────────────────────────
-- Club Carmel cobra sus membresías **en el club**, no por SportMaps. Lo que
-- necesita de nosotros no es cobrar: es **saber si el socio tiene la membresía
-- activa**, con el dato entrado a mano o por CSV hoy, y por API cuando nos den
-- acceso a su programa.
--
-- ── Por qué tabla propia y no un campo en `enrollments` ─────────────────────
-- Los crons de cobro recorren `enrollments`. Colgar la membresía ahí le genera
-- cartera que el club no quiere: exactamente lo contrario de lo que se pide.
-- Acá no hay montos, no hay FK a pagos, y **ningún cron mira esta tabla**
-- (verificado: ninguna función programada la referencia, porque nace hoy).
--
-- ── `valid_until` NO vence solo. Decisión firme ─────────────────────────────
-- Ningún cron ni trigger cambia `status` cuando pasa `valid_until`. La razón es
-- concreta: el dato viene de un sistema ajeno y puede llegar rezagado, así que
-- un vencimiento automático crea **suspendidos fantasma** — socios al día a los
-- que la app les niega el acceso porque el archivo del club llegó tarde.
--
-- Consecuencia de diseño: `status` es lo declarado y es la fuente de verdad;
-- `valid_until` es informativo. `school_memberships_listado()` devuelve las dos
-- cosas más `fecha_vencida`, para que la UI pueda avisar «activa pero con fecha
-- vencida — revisar el dato» sin decidir por su cuenta.
--
-- ── El sujeto: la misma convención que `payments` y `enrollments` ───────────
-- Tres columnas nullable con XOR, no un par (subject_type, subject_id):
--     user_id                  → atleta adulto con cuenta      → profiles
--     child_id                 → menor                         → children
--     unregistered_athlete_id  → sin cuenta, cargado por la escuela
-- Así hay integridad referencial de verdad, que un `subject_id` genérico no
-- puede dar. Es además lo que ya usan `payments` y `enrollments`.
--
-- Una sola membresía vigente por persona y escuela (índices únicos parciales).
-- El historial de renovaciones **no** se guarda: si hace falta, va en tabla
-- aparte. Mezclar «cuál es la vigente» con «cuáles hubo» es lo que vuelve
-- ambigua la pregunta que el club necesita responder.
--
-- ── Alcance de esta fase ────────────────────────────────────────────────────
-- Lee y escribe el **staff** de la escuela. El socio y el padre viendo su propia
-- membresía queda para la fase siguiente: exige resolver padre→hijo dentro de la
-- policy y `children` ya tiene su propio régimen de RLS.
-- ============================================================================

BEGIN;

-- ── 1. La tabla ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.memberships (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,

    -- Sujeto: exactamente uno de los tres (ver XOR más abajo).
    user_id                 uuid REFERENCES public.profiles(id)              ON DELETE CASCADE,
    child_id                uuid REFERENCES public.children(id)              ON DELETE CASCADE,
    unregistered_athlete_id uuid REFERENCES public.unregistered_athletes(id)  ON DELETE CASCADE,

    -- text + CHECK y no un enum: castear a un tipo propio ya costó caro con
    -- `payments.status` (ver gotchas). Un estado nuevo acá es un ALTER del CHECK,
    -- no un ALTER TYPE con todo lo que arrastra.
    status      text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'expired', 'suspended')),

    valid_from  date,
    valid_until date,

    -- De dónde salió el dato. Es lo primero que se pregunta cuando algo no cuadra.
    source      text NOT NULL DEFAULT 'manual'
                CHECK (source IN ('manual', 'import', 'api')),

    -- El id en el sistema del club. Hoy se llena a mano; cuando haya integración,
    -- este mismo campo sirve para sincronizar sin migrar nada.
    external_ref text,

    notes       text,
    updated_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT memberships_sujeto_xor CHECK (
        (user_id IS NOT NULL)::int
      + (child_id IS NOT NULL)::int
      + (unregistered_athlete_id IS NOT NULL)::int = 1
    ),
    CONSTRAINT memberships_vigencia_coherente CHECK (
        valid_from IS NULL OR valid_until IS NULL OR valid_until >= valid_from
    )
);

-- Una membresía por persona y escuela. Parciales porque el sujeto es XOR:
-- un UNIQUE sobre las tres columnas no serviría (NULL no colisiona con NULL).
CREATE UNIQUE INDEX IF NOT EXISTS uq_memberships_escuela_usuario
    ON public.memberships (school_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_memberships_escuela_menor
    ON public.memberships (school_id, child_id) WHERE child_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_memberships_escuela_sin_cuenta
    ON public.memberships (school_id, unregistered_athlete_id) WHERE unregistered_athlete_id IS NOT NULL;

-- Idempotencia de la futura sincronización por API.
CREATE UNIQUE INDEX IF NOT EXISTS uq_memberships_escuela_referencia
    ON public.memberships (school_id, external_ref) WHERE external_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_memberships_escuela_estado
    ON public.memberships (school_id, status);

COMMENT ON TABLE public.memberships IS
    'Membresías del club, pagadas FUERA de SportMaps. Sin montos y sin FK a pagos: ningún cron '
    'la mira. `status` es lo declarado y es la fuente de verdad; `valid_until` es informativo y '
    'NO vence solo, para no crear suspendidos fantasma con datos rezagados (CAR-4).';

COMMENT ON COLUMN public.memberships.status IS
    'active | expired | suspended. Declarado por la escuela, no derivado de valid_until.';
COMMENT ON COLUMN public.memberships.external_ref IS
    'Id en el sistema del club. Único por escuela: es el gancho de idempotencia de la '
    'sincronización por API que viene después.';


-- ── 2. updated_at ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_memberships_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_memberships_touch ON public.memberships;
CREATE TRIGGER trg_memberships_touch
    BEFORE UPDATE ON public.memberships
    FOR EACH ROW EXECUTE FUNCTION public.tg_memberships_touch();


-- ── 3. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- `IN (SELECT unnest(...))` y NO `= ANY ((SELECT ...))`: los tres helpers de
-- alcance devuelven uuid[], y `ANY (` seguido de un SELECT se parsea como
-- subconsulta — compara uuid contra uuid[] y aborta con 42883. Es lo que tumbó
-- 20260817133556 (ver INF-9). Con unnest la subconsulta devuelve filas uuid y,
-- al no estar correlada, el planificador la resuelve una sola vez por consulta.
--
-- `user_staff_school_ids()` y no `user_school_ids()`: esta última incluye padres
-- y atletas (invariante I2), y acá hasta la LECTURA es del staff en esta fase.
DROP POLICY IF EXISTS memberships_staff_lectura ON public.memberships;
CREATE POLICY memberships_staff_lectura ON public.memberships
    FOR SELECT
    USING (
        school_id IN (SELECT unnest(public.user_staff_school_ids()))
        OR public.is_super_admin()
    );

-- Escritura separada por comando, con WITH CHECK explícito. Nada de `FOR ALL`
-- sin WITH CHECK: PostgreSQL validaría los INSERT con la expresión de USING
-- (invariante I3), que es cómo alguien terminó pudiendo insertarse como staff de
-- cualquier escuela.
DROP POLICY IF EXISTS memberships_staff_insert ON public.memberships;
CREATE POLICY memberships_staff_insert ON public.memberships
    FOR INSERT
    WITH CHECK (
        school_id IN (SELECT unnest(public.user_staff_school_ids()))
        OR public.is_super_admin()
    );

DROP POLICY IF EXISTS memberships_staff_update ON public.memberships;
CREATE POLICY memberships_staff_update ON public.memberships
    FOR UPDATE
    USING (
        school_id IN (SELECT unnest(public.user_staff_school_ids()))
        OR public.is_super_admin()
    )
    WITH CHECK (
        school_id IN (SELECT unnest(public.user_staff_school_ids()))
        OR public.is_super_admin()
    );

DROP POLICY IF EXISTS memberships_staff_delete ON public.memberships;
CREATE POLICY memberships_staff_delete ON public.memberships
    FOR DELETE
    USING (
        school_id IN (SELECT unnest(public.user_staff_school_ids()))
        OR public.is_super_admin()
    );

-- La tabla no se expone a `anon` por ninguna vía.
REVOKE ALL ON TABLE public.memberships FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.memberships TO authenticated;
GRANT ALL ON TABLE public.memberships TO service_role;


-- ── 4. Alta / actualización de una membresía ────────────────────────────────
CREATE OR REPLACE FUNCTION public.school_set_membership(
    p_school_id               uuid,
    p_status                  text    DEFAULT 'active',
    p_user_id                 uuid    DEFAULT NULL,
    p_child_id                uuid    DEFAULT NULL,
    p_unregistered_athlete_id uuid    DEFAULT NULL,
    p_valid_from              date    DEFAULT NULL,
    p_valid_until             date    DEFAULT NULL,
    p_source                  text    DEFAULT 'manual',
    p_external_ref            text    DEFAULT NULL,
    p_notes                   text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_sujetos int;
    v_id      uuid;
    v_creada  boolean;
BEGIN
    IF NOT (p_school_id = ANY (public.user_staff_school_ids()) OR public.is_super_admin()) THEN
        RAISE EXCEPTION 'solo el personal de la escuela puede administrar membresías'
            USING ERRCODE = '42501';
    END IF;

    v_sujetos := (p_user_id IS NOT NULL)::int
               + (p_child_id IS NOT NULL)::int
               + (p_unregistered_athlete_id IS NOT NULL)::int;
    IF v_sujetos <> 1 THEN
        RAISE EXCEPTION 'indicá exactamente UN sujeto: user_id, child_id o unregistered_athlete_id (llegaron %)', v_sujetos
            USING ERRCODE = '22023';
    END IF;

    -- El sujeto tiene que pertenecer a esta escuela. Sin esto, el staff de una
    -- escuela podría declararle membresía a un atleta de otra.
    IF p_child_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.children c
                        WHERE c.id = p_child_id AND c.school_id = p_school_id) THEN
        RAISE EXCEPTION 'ese menor no pertenece a esta escuela' USING ERRCODE = '42501';
    END IF;

    IF p_unregistered_athlete_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.unregistered_athletes u
                        WHERE u.id = p_unregistered_athlete_id AND u.school_id = p_school_id) THEN
        RAISE EXCEPTION 'ese atleta no pertenece a esta escuela' USING ERRCODE = '42501';
    END IF;

    -- `school_members` liga por `profile_id`, no por `user_id`.
    IF p_user_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.school_members sm
                        WHERE sm.profile_id = p_user_id
                          AND sm.school_id  = p_school_id
                          AND sm.status     = 'active') THEN
        RAISE EXCEPTION 'esa persona no es miembro activo de esta escuela' USING ERRCODE = '42501';
    END IF;

    -- UPDATE y si no tocó nada, INSERT. No se usa ON CONFLICT porque el sujeto es
    -- XOR y hay TRES índices únicos parciales distintos: un solo INSERT no puede
    -- declarar tres conflict targets, así que con ON CONFLICT los casos de menor
    -- y de atleta sin cuenta habrían reventado con unique_violation en vez de
    -- actualizar.
    UPDATE public.memberships
       SET status       = COALESCE(p_status, 'active'),
           valid_from   = p_valid_from,
           valid_until  = p_valid_until,
           source       = COALESCE(p_source, 'manual'),
           external_ref = COALESCE(p_external_ref, external_ref),
           notes        = p_notes,
           updated_by   = auth.uid()
     WHERE school_id = p_school_id
       AND (   (p_user_id                 IS NOT NULL AND user_id                 = p_user_id)
            OR (p_child_id                IS NOT NULL AND child_id                = p_child_id)
            OR (p_unregistered_athlete_id IS NOT NULL AND unregistered_athlete_id = p_unregistered_athlete_id))
    RETURNING id INTO v_id;

    IF v_id IS NOT NULL THEN
        RETURN jsonb_build_object('ok', true, 'id', v_id, 'creada', false);
    END IF;

    -- Dos llamadas simultáneas para el mismo sujeto pueden llegar acá las dos y
    -- una perder contra el índice único. Se reintenta el UPDATE en vez de
    -- devolver un error de base que nadie sabría interpretar.
    BEGIN
        INSERT INTO public.memberships (
            school_id, user_id, child_id, unregistered_athlete_id,
            status, valid_from, valid_until, source, external_ref, notes, updated_by
        ) VALUES (
            p_school_id, p_user_id, p_child_id, p_unregistered_athlete_id,
            COALESCE(p_status, 'active'), p_valid_from, p_valid_until,
            COALESCE(p_source, 'manual'), p_external_ref, p_notes, auth.uid()
        )
        RETURNING id INTO v_id;
        v_creada := true;
    EXCEPTION WHEN unique_violation THEN
        UPDATE public.memberships
           SET status       = COALESCE(p_status, 'active'),
               valid_from   = p_valid_from,
               valid_until  = p_valid_until,
               source       = COALESCE(p_source, 'manual'),
               external_ref = COALESCE(p_external_ref, external_ref),
               notes        = p_notes,
               updated_by   = auth.uid()
         WHERE school_id = p_school_id
           AND (   (p_user_id                 IS NOT NULL AND user_id                 = p_user_id)
                OR (p_child_id                IS NOT NULL AND child_id                = p_child_id)
                OR (p_unregistered_athlete_id IS NOT NULL AND unregistered_athlete_id = p_unregistered_athlete_id))
        RETURNING id INTO v_id;
        v_creada := false;
    END;

    RETURN jsonb_build_object('ok', true, 'id', v_id, 'creada', v_creada);
END;
$$;

REVOKE ALL ON FUNCTION public.school_set_membership(uuid, text, uuid, uuid, uuid, date, date, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_set_membership(uuid, text, uuid, uuid, uuid, date, date, text, text, text) TO authenticated, service_role;


-- ── 5. El listado que consume la UI ─────────────────────────────────────────
-- Devuelve la membresía con el nombre y el documento del sujeto, para no obligar
-- al frontend a tres joins distintos según de qué tipo sea.
CREATE OR REPLACE FUNCTION public.school_memberships_listado(p_school_id uuid)
RETURNS TABLE (
    id             uuid,
    sujeto_tipo    text,     -- 'usuario' | 'menor' | 'sin_cuenta'
    sujeto_id      uuid,
    nombre         text,
    documento      text,
    status         text,
    valid_from     date,
    valid_until    date,
    fecha_vencida  boolean,  -- valid_until ya pasó (informativo: no cambia status)
    source         text,
    external_ref   text,
    notes          text,
    updated_at     timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT m.id,
           CASE WHEN m.user_id  IS NOT NULL THEN 'usuario'
                WHEN m.child_id IS NOT NULL THEN 'menor'
                ELSE 'sin_cuenta' END,
           COALESCE(m.user_id, m.child_id, m.unregistered_athlete_id),
           COALESCE(p.full_name, c.full_name, u.full_name),
           COALESCE(p.document_number, c.doc_number, u.doc_number),
           m.status,
           m.valid_from,
           m.valid_until,
           (m.valid_until IS NOT NULL AND m.valid_until < CURRENT_DATE),
           m.source,
           m.external_ref,
           m.notes,
           m.updated_at
      FROM public.memberships m
      LEFT JOIN public.profiles              p ON p.id = m.user_id
      LEFT JOIN public.children              c ON c.id = m.child_id
      LEFT JOIN public.unregistered_athletes u ON u.id = m.unregistered_athlete_id
     WHERE m.school_id = p_school_id
       AND (p_school_id = ANY (public.user_staff_school_ids()) OR public.is_super_admin())
     ORDER BY COALESCE(p.full_name, c.full_name, u.full_name);
$$;

REVOKE ALL ON FUNCTION public.school_memberships_listado(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_memberships_listado(uuid) TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ────────────────────────────────────────────────────────────────────────────
-- Verificación
-- ────────────────────────────────────────────────────────────────────────────

-- 1. La tabla, con RLS y sin filas.
SELECT c.relname, c.relrowsecurity AS rls_activo,
       (SELECT count(*) FROM public.memberships) AS filas
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relname = 'memberships';

-- 2. Las cuatro policies. Las de escritura deben traer with_check (invariante I3),
--    y NINGUNA debe alcanzar al rol anon.
SELECT policyname, cmd, roles, with_check IS NOT NULL AS tiene_with_check
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'memberships'
 ORDER BY cmd, policyname;

-- 3. Los índices únicos parciales del sujeto y de external_ref.
SELECT indexname, indexdef
  FROM pg_indexes
 WHERE schemaname = 'public' AND tablename = 'memberships'
 ORDER BY indexname;

-- 4. Que anon NO tenga ningún privilegio sobre la tabla.
SELECT grantee, privilege_type
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public' AND table_name = 'memberships'
 ORDER BY grantee, privilege_type;
