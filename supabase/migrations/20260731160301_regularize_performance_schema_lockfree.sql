-- =============================================================================
-- 20260731160301_regularize_performance_schema_lockfree.sql
-- Autor: brylop   Fecha: 2026-07-31   Versión anterior: 20260731154626
-- Objetivo: aplicar la línea base de 20260731154626 (M0) sobre una base VIVA sin
--           tomar locks cuando los objetos ya existen.
--
-- Por qué existe: M0 falló al aplicarse contra la base compartida con
--   `40P01 deadlock detected`. No fue un error de SQL — el parser aceptó todo el
--   archivo. Fue de concurrencia:
--
--     · `ALTER TABLE … ENABLE ROW LEVEL SECURITY` y `ALTER TABLE … ADD COLUMN
--       IF NOT EXISTS` toman **AccessExclusiveLock igual cuando no cambian nada**.
--       El `IF NOT EXISTS` evita el error, no el lock.
--     · Con esos locks tomados dentro de una transacción larga, y una base que
--       sirve tráfico real (una sola Supabase para dev/stg/prod), basta que otra
--       sesión esté leyendo una de las cinco tablas para cruzar el orden de
--       adquisición y deadlockear.
--
--   O sea: M0 era no-op LÓGICO pero no no-op en LOCKS. Esta migración cierra esa
--   diferencia — consulta el catálogo ANTES de cada sentencia que tomaría lock, y
--   si el objeto ya está, no la ejecuta. Contra la base actual no toma un solo
--   lock exclusivo: es puro leer catálogo.
--
--   M0 no se edita (es inmutable y ya está commiteada). Sobre una base LIMPIA M0
--   funciona bien — no hay tráfico con el que competir — y esta migración corre
--   después sin hacer nada. Sobre la base viva, esta es la que hay que aplicar:
--   es autosuficiente, así que crea lo que falte y no depende de que M0 haya
--   corrido.
--
-- Contenido idéntico a M0: 5 tablas (unregistered_athletes,
--   sport_metric_definitions, sport_metric_thresholds, performance_entries,
--   competition_results) + is_parent_of_child + índices + policies + grants.
--   Mismas dos notas que M0: replica `GRANT … TO anon` sin endosarlo, y el cuerpo
--   de is_parent_of_child sigue siendo una reconstrucción a reconciliar.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · Estados/enums: text + CHECK, no CREATE TYPE.
-- =============================================================================

BEGIN;

-- Si algún lock hiciera falta de verdad (base limpia, u objeto realmente
-- ausente) y no se consigue rápido, es mejor fallar con un error claro que
-- quedarse colgado bloqueando la app o volver a deadlockear.
SET LOCAL lock_timeout = '5s';

-- CREATE EXTENSION IF NOT EXISTS ya es no-op real cuando está instalada.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ─── 1. Tablas ───────────────────────────────────────────────────────────────
-- `CREATE TABLE IF NOT EXISTS` sí es no-op sin lock cuando la tabla existe, así
-- que estas cinco van directas. Lo que hay que guardar es lo de después.
CREATE TABLE IF NOT EXISTS public.unregistered_athletes (
    id                 uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id          uuid        NOT NULL REFERENCES public.schools(id)  ON DELETE CASCADE,
    doc_type           text,
    doc_number         text,
    full_name          text        NOT NULL,
    email              text,
    phone              text,
    date_of_birth      date,
    gender             text,
    branch_id          uuid        REFERENCES public.school_branches(id)   ON DELETE SET NULL,
    is_active          boolean     NOT NULL DEFAULT true,
    linked_profile_id  uuid        REFERENCES public.profiles(id)          ON DELETE SET NULL,
    invitation_id      uuid        REFERENCES public.invitations(id)       ON DELETE SET NULL,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    poll_token         text        UNIQUE
);

CREATE TABLE IF NOT EXISTS public.sport_metric_definitions (
    id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    sport_category_id  uuid        NOT NULL REFERENCES public.sports_categories(id) ON DELETE CASCADE,
    metric_key         text        NOT NULL,
    display_name       text        NOT NULL,
    data_type          text        NOT NULL
        CHECK (data_type = ANY (ARRAY['numeric','duration','count','rating'])),
    unit               text,
    category           text
        CHECK (category = ANY (ARRAY['physical','technical','tactical','attendance'])
               OR category IS NULL),
    is_active          boolean     NOT NULL DEFAULT true,
    created_at         timestamptz NOT NULL DEFAULT now(),
    subcategory        text,
    min_value          numeric,
    max_value          numeric,
    higher_is_better   boolean     NOT NULL DEFAULT true,
    parent_label       text,
    parent_hint        text,
    UNIQUE (sport_category_id, metric_key)
);

CREATE TABLE IF NOT EXISTS public.sport_metric_thresholds (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_id   uuid        NOT NULL REFERENCES public.sport_metric_definitions(id) ON DELETE CASCADE,
    band        text        NOT NULL CHECK (band = ANY (ARRAY['green','yellow','red'])),
    min_value   numeric,
    max_value   numeric,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (metric_id, band)
);

CREATE TABLE IF NOT EXISTS public.performance_entries (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id     uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    subject_type  text        NOT NULL
        CHECK (subject_type = ANY (ARRAY['profile','child','unregistered'])),
    subject_id    uuid        NOT NULL,
    metric_key    text        NOT NULL,
    value         numeric     NOT NULL,
    context_type  text        NOT NULL DEFAULT 'manual'
        CHECK (context_type = ANY (ARRAY['manual','competition','evaluation','session'])),
    context_id    uuid,
    recorded_by   uuid        NOT NULL,
    recorded_at   timestamptz NOT NULL DEFAULT now(),
    notes         text,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.competition_results (
    id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id          uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    sport_category_id  uuid        REFERENCES public.sports_categories(id),
    subject_type       text
        CHECK (subject_type = ANY (ARRAY['profile','child','unregistered','team'])
               OR subject_type IS NULL),
    subject_id         uuid,
    team_id            uuid        REFERENCES public.teams(id),
    competition_name   text,
    competition_date   date        NOT NULL,
    result_type        text        NOT NULL
        CHECK (result_type = ANY (ARRAY['score','time','placement','rounds','rating_change'])),
    result_data        jsonb       NOT NULL DEFAULT '{}'::jsonb,
    opponent           text,
    notes              text,
    recorded_by        uuid        NOT NULL,
    created_at         timestamptz NOT NULL DEFAULT now(),
    CHECK (subject_id IS NOT NULL OR team_id IS NOT NULL)
);


-- ─── 2. is_parent_of_child(uuid) ─────────────────────────────────────────────
-- Igual que en M0: se crea SOLO si falta, para no pisar la función real de la
-- base con esta reconstrucción. Ver nota 3 al final.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'is_parent_of_child'
    ) THEN
        EXECUTE $fn$
            CREATE FUNCTION public.is_parent_of_child(child_uuid uuid)
            RETURNS boolean
            LANGUAGE sql
            STABLE
            SECURITY DEFINER
            SET search_path = pg_catalog, public, pg_temp
            AS $body$
                SELECT EXISTS (
                    SELECT 1 FROM public.children c
                    WHERE c.id = child_uuid
                      AND c.parent_id = auth.uid()
                );
            $body$;
        $fn$;
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.is_parent_of_child(uuid) TO authenticated';
    END IF;
END $$;


-- ─── 3. Columnas de F0 — guardadas ───────────────────────────────────────────
-- ⚠️ Este es uno de los dos culpables del deadlock de M0: `ADD COLUMN IF NOT
-- EXISTS` toma AccessExclusiveLock aunque la columna ya esté. Se pregunta al
-- catálogo primero.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'sport_metric_definitions'
          AND column_name  = 'parent_label'
    ) THEN
        ALTER TABLE public.sport_metric_definitions ADD COLUMN parent_label text;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'sport_metric_definitions'
          AND column_name  = 'parent_hint'
    ) THEN
        ALTER TABLE public.sport_metric_definitions ADD COLUMN parent_hint text;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'sport_metric_definitions_parent_label_not_blank'
          AND conrelid = 'public.sport_metric_definitions'::regclass
    ) THEN
        ALTER TABLE public.sport_metric_definitions
            ADD CONSTRAINT sport_metric_definitions_parent_label_not_blank
            CHECK (parent_label IS NULL OR length(btrim(parent_label)) > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'sport_metric_definitions_parent_hint_not_blank'
          AND conrelid = 'public.sport_metric_definitions'::regclass
    ) THEN
        ALTER TABLE public.sport_metric_definitions
            ADD CONSTRAINT sport_metric_definitions_parent_hint_not_blank
            CHECK (parent_hint IS NULL OR length(btrim(parent_hint)) > 0);
    END IF;
END $$;


-- ─── 4. RLS — guardada ───────────────────────────────────────────────────────
-- ⚠️ El otro culpable del deadlock: `ENABLE ROW LEVEL SECURITY` toma
-- AccessExclusiveLock incluso si la RLS ya estaba activa. `pg_class.relrowsecurity`
-- responde eso sin tocar la tabla.
DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'unregistered_athletes',
        'sport_metric_definitions',
        'sport_metric_thresholds',
        'performance_entries',
        'competition_results'
    ] LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname = t
              AND c.relrowsecurity
        ) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        END IF;
    END LOOP;
END $$;


-- ─── 5. Índices ──────────────────────────────────────────────────────────────
-- `CREATE INDEX IF NOT EXISTS` no toma lock exclusivo si el índice ya existe.
CREATE INDEX IF NOT EXISTS idx_unregistered_athletes_school_id
    ON public.unregistered_athletes (school_id);
CREATE INDEX IF NOT EXISTS idx_unregistered_athletes_doc_number
    ON public.unregistered_athletes (school_id, doc_number);
CREATE INDEX IF NOT EXISTS idx_unregistered_athletes_email
    ON public.unregistered_athletes (email);
CREATE INDEX IF NOT EXISTS idx_unregistered_athletes_linked
    ON public.unregistered_athletes (linked_profile_id) WHERE linked_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_unregistered_athletes_poll_token
    ON public.unregistered_athletes (poll_token) WHERE poll_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_performance_entries_school
    ON public.performance_entries (school_id);
CREATE INDEX IF NOT EXISTS idx_performance_entries_subject
    ON public.performance_entries (subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_performance_entries_metric
    ON public.performance_entries (metric_key);

CREATE INDEX IF NOT EXISTS idx_competition_results_school
    ON public.competition_results (school_id);
CREATE INDEX IF NOT EXISTS idx_competition_results_subject
    ON public.competition_results (subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_competition_results_team
    ON public.competition_results (team_id);


-- ─── 6. Trigger de updated_at — guardado ─────────────────────────────────────
-- ⚠️ `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` toman AccessExclusiveLock sobre
-- unregistered_athletes. Como el trigger de la base es idéntico al que se querría
-- crear, si ya está no se toca.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'unregistered_athletes'
          AND t.tgname  = 'update_unregistered_athletes_updated_at'
          AND NOT t.tgisinternal
    ) THEN
        CREATE TRIGGER update_unregistered_athletes_updated_at
            BEFORE UPDATE ON public.unregistered_athletes
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;


-- ─── 7. Policies — guardadas una por una ─────────────────────────────────────
-- Igual que M0: se crea solo la que falte, nunca DROP … CREATE, para no
-- reemplazar una policy real por esta transcripción si difiere en algo sutil.
DO $$
DECLARE
    v_defs text[][] := ARRAY[
        ARRAY['unregistered_athletes', 'public can register as guest via poll',
              'CREATE POLICY "public can register as guest via poll" ON public.unregistered_athletes '
              'FOR INSERT WITH CHECK (school_id IS NOT NULL AND full_name IS NOT NULL AND poll_token IS NOT NULL)'],
        ARRAY['unregistered_athletes', 'school_owner_manage_unregistered_athletes',
              'CREATE POLICY "school_owner_manage_unregistered_athletes" ON public.unregistered_athletes '
              'FOR ALL USING ('
              '  school_id IN (SELECT s.id FROM public.schools s WHERE s.owner_id = auth.uid())'
              '  OR school_id IN (SELECT sm.school_id FROM public.school_members sm '
              '                   WHERE sm.profile_id = auth.uid() AND sm.status = ''active'' '
              '                     AND sm.role = ANY (ARRAY[''admin'',''coach'',''staff''])))'],

        ARRAY['sport_metric_definitions', 'sport_metric_definitions_select_all',
              'CREATE POLICY "sport_metric_definitions_select_all" ON public.sport_metric_definitions '
              'FOR SELECT TO authenticated USING (true)'],
        ARRAY['sport_metric_thresholds', 'sport_metric_thresholds_select_all',
              'CREATE POLICY "sport_metric_thresholds_select_all" ON public.sport_metric_thresholds '
              'FOR SELECT USING (true)'],

        ARRAY['performance_entries', 'performance_entries_select_own',
              'CREATE POLICY "performance_entries_select_own" ON public.performance_entries '
              'FOR SELECT USING ('
              '  (subject_type = ''profile'' AND subject_id = auth.uid())'
              '  OR (subject_type = ''child'' AND public.is_parent_of_child(subject_id))'
              '  OR school_id = ANY (public.user_school_ids()))'],
        ARRAY['performance_entries', 'performance_entries_insert_school_or_self',
              'CREATE POLICY "performance_entries_insert_school_or_self" ON public.performance_entries '
              'FOR INSERT WITH CHECK ('
              '  school_id = ANY (public.user_school_ids())'
              '  OR (subject_type = ''profile'' AND subject_id = auth.uid()))'],
        ARRAY['performance_entries', 'performance_entries_update_school_or_recorder',
              'CREATE POLICY "performance_entries_update_school_or_recorder" ON public.performance_entries '
              'FOR UPDATE USING (school_id = ANY (public.user_school_ids()) OR recorded_by = auth.uid()) '
              'WITH CHECK (school_id = ANY (public.user_school_ids()) OR recorded_by = auth.uid())'],
        ARRAY['performance_entries', 'performance_entries_delete_school_only',
              'CREATE POLICY "performance_entries_delete_school_only" ON public.performance_entries '
              'FOR DELETE USING (school_id = ANY (public.user_school_ids()))'],

        ARRAY['competition_results', 'competition_results_select_own',
              'CREATE POLICY "competition_results_select_own" ON public.competition_results '
              'FOR SELECT USING ('
              '  (subject_type = ''profile'' AND subject_id = auth.uid())'
              '  OR (subject_type = ''child'' AND public.is_parent_of_child(subject_id))'
              '  OR school_id = ANY (public.user_school_ids()))'],
        ARRAY['competition_results', 'competition_results_insert_school_or_self',
              'CREATE POLICY "competition_results_insert_school_or_self" ON public.competition_results '
              'FOR INSERT WITH CHECK ('
              '  school_id = ANY (public.user_school_ids())'
              '  OR (subject_type = ''profile'' AND subject_id = auth.uid()))'],
        ARRAY['competition_results', 'competition_results_update_school_or_recorder',
              'CREATE POLICY "competition_results_update_school_or_recorder" ON public.competition_results '
              'FOR UPDATE USING (school_id = ANY (public.user_school_ids()) OR recorded_by = auth.uid()) '
              'WITH CHECK (school_id = ANY (public.user_school_ids()) OR recorded_by = auth.uid())'],
        ARRAY['competition_results', 'competition_results_delete_school_only',
              'CREATE POLICY "competition_results_delete_school_only" ON public.competition_results '
              'FOR DELETE USING (school_id = ANY (public.user_school_ids()))']
    ];
    i int;
BEGIN
    FOR i IN 1 .. array_length(v_defs, 1) LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename  = v_defs[i][1]
              AND policyname = v_defs[i][2]
        ) THEN
            EXECUTE v_defs[i][3];
        END IF;
    END LOOP;
END $$;


-- ─── 8. Grants — guardados ───────────────────────────────────────────────────
-- GRANT también toma lock sobre la relación, así que se pregunta antes. Se usa
-- TRUNCATE de `anon` como testigo: es el privilegio más inusual de los siete, y
-- el volcado mostró que las cinco tablas lo tienen. Si está, el resto está.
-- Los roles anon/authenticated/service_role son de Supabase: en un Postgres
-- pelado no existen y `has_table_privilege('anon', …)` reventaría. Si falta
-- alguno, se salta el bloque completo en vez de tumbar la migración.
DO $$
DECLARE
    t text;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
       OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
       OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        RETURN;
    END IF;

    FOREACH t IN ARRAY ARRAY[
        'unregistered_athletes',
        'sport_metric_definitions',
        'sport_metric_thresholds',
        'performance_entries',
        'competition_results'
    ] LOOP
        IF NOT has_table_privilege('anon', format('public.%I', t), 'TRUNCATE') THEN
            EXECUTE format(
                'GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER '
                'ON public.%I TO anon, authenticated, service_role', t);
        END IF;
    END LOOP;
END $$;

COMMIT;

-- =============================================================================
-- NOTA 1 — Por qué el deadlock, en una línea
--
-- `IF NOT EXISTS` evita el ERROR, no el LOCK. `ALTER TABLE … ENABLE ROW LEVEL
-- SECURITY` y `ALTER TABLE … ADD COLUMN IF NOT EXISTS` piden AccessExclusiveLock
-- aunque no cambien nada, y en una base con tráfico eso choca con cualquier
-- lectura en curso. La lección aplica a toda migración futura sobre esta base
-- compartida: **una migración «no-op» solo es segura si tampoco toma locks.**
--
-- NOTA 2 — `GRANT … TO anon`: se replica, no se endosa
--
-- Igual que en M0. RLS protege las cinco en DML (con auth.uid() NULL las policies
-- dan falso y user_school_ids() vuelve vacío). TRUNCATE ignora RLS, pero PostgREST
-- no lo expone, así que hoy no es alcanzable por la API. Probablemente vienen de
-- los default privileges que Supabase aplica a `public` — o sea, no específico de
-- estas tablas. Endurecerlo va en migración aparte, medida y aprobada.
--
-- NOTA 3 — `is_parent_of_child`: cuerpo RECONSTRUIDO
--
-- El volcado sacó DDL de tablas, no de funciones. Se crea solo si falta, así que
-- la base compartida no se toca; una base limpia se queda con esta versión. Es
-- SECURITY DEFINER y gobierna el acceso del padre a los datos de su hijo.
-- Para reconciliar:
--   SELECT pg_get_functiondef(p.oid)
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.proname = 'is_parent_of_child';
-- Si difiere, el fix va en una migración NUEVA.
-- =============================================================================
