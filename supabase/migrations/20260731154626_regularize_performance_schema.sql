-- =============================================================================
-- 20260731154626_regularize_performance_schema.sql
-- Autor: brylop   Fecha: 2026-07-31   Versión anterior: 20260731152955
-- Objetivo: dar LÍNEA BASE en el repo a cinco tablas (y una función) que existen
--           en la base compartida y que ninguna migración crea. M0 del plan de
--           F1 del Informe Mensual (docs/plan-f1-informes-backend.md §0).
--
-- Tablas:   unregistered_athletes · sport_metric_definitions
--           sport_metric_thresholds · performance_entries · competition_results
-- Función:  is_parent_of_child(uuid)  (la usan las policies de dos de ellas)
--
-- Por qué:  la cadena de migraciones no reproducía la base desde cero. Sobre una
--   base limpia, 20260731123145 (F0 de informes) FALLABA: hace ALTER TABLE sobre
--   sport_metric_definitions y el `IF NOT EXISTS` de ahí es de la COLUMNA, no de
--   la tabla. Y F1 lee performance_entries para armar el snapshot del informe,
--   así que iba a heredar el problema. unregistered_athletes es el caso más
--   viejo: 14 migraciones escriben contra ella sin que ninguna la cree.
--
-- ⚠️  ESTA MIGRACIÓN ES UN NO-OP DELIBERADO CONTRA LA BASE ACTUAL.
--   Todo va guardado (`IF NOT EXISTS`, o `DO` que consulta el catálogo antes de
--   crear). No cambia una sola fila ni una sola policy de lo que ya existe: su
--   único trabajo es que una base limpia quede IGUAL a la de hoy. Si algo aquí
--   modificara el estado actual, sería un bug de esta migración.
--
-- Fuente:  volcado real de la base vía scripts/dump_unversioned_schema.sql
--   (columnas, constraints, índices, policies, grants y triggers), no de memoria
--   ni del generated types.ts — que está desactualizado: no lista
--   enrollments.monthly_fee, columna que open_month sí usa.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · Estados/enums: text + CHECK, no CREATE TYPE. (Se respeta: así están.)
--
-- DOS COSAS QUE ESTA MIGRACIÓN **REPLICA SIN ENDOSAR** — ver nota final:
--   1. `GRANT ALL … TO anon` en las 5 tablas.
--   2. Ausencia de FK en el eje polimórfico `subject_type` + `subject_id`.
-- =============================================================================

BEGIN;

-- ─── 0. Prerrequisitos ───────────────────────────────────────────────────────
-- unregistered_athletes.id usa uuid_generate_v4() (el resto usa gen_random_uuid).
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ─── 1. is_parent_of_child(uuid) ─────────────────────────────────────────────
-- La invocan las policies de performance_entries y competition_results, así que
-- tiene que existir ANTES de crearlas.
--
-- ⚠️  El cuerpo de aquí es una RECONSTRUCCIÓN, no un volcado: el script sacó el
--   DDL de las tablas, no el de las funciones. Por eso NO se usa
--   `CREATE OR REPLACE` — eso pisaría la función real de la base con mi versión.
--   Se crea SOLO si no existe, de modo que en la base compartida no se toca nada
--   y una base limpia queda funcional.
--
--   Pendiente de reconciliar con el cuerpo real (ver nota final). La firma sí es
--   la de la base: `is_parent_of_child(child_uuid uuid)`, según el reporte del
--   linter embebido en 20260503000007.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = 'is_parent_of_child'
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


-- ─── 2. unregistered_athletes ────────────────────────────────────────────────
-- El atleta que la escuela cargó pero que todavía no tiene cuenta. 221 filas
-- hoy. Es el tercer brazo del eje de sujetos (profile / child / unregistered).
CREATE TABLE IF NOT EXISTS public.unregistered_athletes (
    id                 uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id          uuid        NOT NULL REFERENCES public.schools(id)         ON DELETE CASCADE,
    doc_type           text,
    doc_number         text,
    full_name          text        NOT NULL,
    email              text,
    phone              text,
    date_of_birth      date,
    gender             text,
    branch_id          uuid        REFERENCES public.school_branches(id)          ON DELETE SET NULL,
    is_active          boolean     NOT NULL DEFAULT true,
    linked_profile_id  uuid        REFERENCES public.profiles(id)                 ON DELETE SET NULL,
    invitation_id      uuid        REFERENCES public.invitations(id)              ON DELETE SET NULL,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    poll_token         text        UNIQUE
);

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

ALTER TABLE public.unregistered_athletes ENABLE ROW LEVEL SECURITY;

-- Es la única de las cinco con updated_at, y con trigger para mantenerlo.
DROP TRIGGER IF EXISTS update_unregistered_athletes_updated_at ON public.unregistered_athletes;
CREATE TRIGGER update_unregistered_athletes_updated_at
    BEFORE UPDATE ON public.unregistered_athletes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ─── 3. sport_metric_definitions ─────────────────────────────────────────────
-- Catálogo de métricas por deporte. 74 filas (51 son de voleibol). `parent_label`
-- y `parent_hint` las agregó 20260731123145 — aquí van en el CREATE para que una
-- base limpia las tenga desde el principio y esa migración ya no sea el primer
-- punto de contacto con la tabla.
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

-- Idempotencia con la base actual: si la tabla YA existía (caso de la base
-- compartida), el CREATE de arriba no corrió y estas dos columnas las puso
-- 20260731123145. Si la tabla es nueva, ya vienen y esto no hace nada.
ALTER TABLE public.sport_metric_definitions ADD COLUMN IF NOT EXISTS parent_label text;
ALTER TABLE public.sport_metric_definitions ADD COLUMN IF NOT EXISTS parent_hint  text;

DO $$
BEGIN
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

ALTER TABLE public.sport_metric_definitions ENABLE ROW LEVEL SECURITY;


-- ─── 4. sport_metric_thresholds ──────────────────────────────────────────────
-- Bandas del semáforo por métrica. 132 filas.
--
-- ⚠️  Gap conocido, NO se corrige aquí: no tiene eje de edad ni de categoría, así
--   que una banda de «salto vertical en cm» vale igual para un benjamín y para un
--   juvenil. Bloquea 5 métricas de voleibol medidas en cm y agrava que
--   teams.age_group esté NULL en los 11 equipos de Dynasty. Es decisión de
--   producto pendiente antes de F1 — regularizar no es el momento de cambiar
--   el modelo.
CREATE TABLE IF NOT EXISTS public.sport_metric_thresholds (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_id   uuid        NOT NULL REFERENCES public.sport_metric_definitions(id) ON DELETE CASCADE,
    band        text        NOT NULL CHECK (band = ANY (ARRAY['green','yellow','red'])),
    min_value   numeric,
    max_value   numeric,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (metric_id, band)
);

ALTER TABLE public.sport_metric_thresholds ENABLE ROW LEVEL SECURITY;


-- ─── 5. performance_entries ──────────────────────────────────────────────────
-- La medición: un valor de una métrica para un sujeto en un momento. 473 filas.
-- Es la tabla que F1 lee para armar el snapshot del informe.
--
-- ⚠️  `subject_id` NO tiene FK y `metric_key` tampoco: apuntan a tres tablas
--   distintas y al catálogo por texto. Se replica tal cual — ver nota final.
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

CREATE INDEX IF NOT EXISTS idx_performance_entries_school
    ON public.performance_entries (school_id);
CREATE INDEX IF NOT EXISTS idx_performance_entries_subject
    ON public.performance_entries (subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_performance_entries_metric
    ON public.performance_entries (metric_key);

ALTER TABLE public.performance_entries ENABLE ROW LEVEL SECURITY;


-- ─── 6. competition_results ──────────────────────────────────────────────────
-- Resultado de competencia, individual o de equipo. 0 filas hoy.
-- Su eje admite un cuarto valor que performance_entries no tiene ('team') y
-- permite subject_type NULL, con un CHECK que exige sujeto O equipo.
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

CREATE INDEX IF NOT EXISTS idx_competition_results_school
    ON public.competition_results (school_id);
CREATE INDEX IF NOT EXISTS idx_competition_results_subject
    ON public.competition_results (subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_competition_results_team
    ON public.competition_results (team_id);

ALTER TABLE public.competition_results ENABLE ROW LEVEL SECURITY;


-- ─── 7. Policies ─────────────────────────────────────────────────────────────
-- Cada una se crea SOLO si falta, consultando pg_policies. Así la base actual
-- queda intacta: no hay DROP … CREATE que pudiera reemplazar una policy real por
-- una transcripción mía con una diferencia sutil.
DO $$
DECLARE
    v_sql text;
    v_defs text[][] := ARRAY[
        -- unregistered_athletes
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

        -- sport_metric_definitions / thresholds: catálogo, solo lectura
        ARRAY['sport_metric_definitions', 'sport_metric_definitions_select_all',
              'CREATE POLICY "sport_metric_definitions_select_all" ON public.sport_metric_definitions '
              'FOR SELECT TO authenticated USING (true)'],
        ARRAY['sport_metric_thresholds', 'sport_metric_thresholds_select_all',
              'CREATE POLICY "sport_metric_thresholds_select_all" ON public.sport_metric_thresholds '
              'FOR SELECT USING (true)'],

        -- performance_entries
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

        -- competition_results: mismas cuatro, mismo criterio
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
            v_sql := v_defs[i][3];
            EXECUTE v_sql;
        END IF;
    END LOOP;
END $$;


-- ─── 8. Grants ───────────────────────────────────────────────────────────────
-- Se replica lo observado. Ver la nota final: incluye `anon`, que NO se endosa.
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
    ON public.unregistered_athletes,
       public.sport_metric_definitions,
       public.sport_metric_thresholds,
       public.performance_entries,
       public.competition_results
    TO anon, authenticated, service_role;

COMMIT;

-- =============================================================================
-- NOTA 1 — `GRANT … TO anon` en las cinco tablas
--
-- El volcado muestra que anon tiene los 7 privilegios en las 5 tablas. Se
-- replica porque el trabajo de esta migración es que una base limpia quede IGUAL
-- a la de hoy, no mejor: si aquí endureciera los grants, «limpia == prod» dejaría
-- de ser cierto y perdería el sentido.
--
-- Qué protege hoy: RLS está activa en las cinco y las policies bloquean a anon en
-- SELECT/INSERT/UPDATE/DELETE — con auth.uid() NULL, `subject_id = auth.uid()` es
-- falso y `user_school_ids()` devuelve array vacío. `sport_metric_thresholds` es
-- la excepción: su policy es `USING (true)`, o sea catálogo público.
--
-- El privilegio que NO cubre RLS es TRUNCATE: Postgres no le aplica policies. No
-- es alcanzable por la API porque PostgREST no expone TRUNCATE, así que hoy no es
-- explotable — pero es un privilegio que nadie quiso dar.
--
-- Probablemente NO es específico de estas tablas: Supabase aplica default
-- privileges a lo que se crea en `public`, así que es de esperar que otras tablas
-- estén igual. No lo puedo confirmar desde el repo. → Vale una migración APARTE
-- que revoque TRUNCATE (y lo que sobre) a anon en todo el esquema, medida antes
-- contra qué lee de verdad el rol anónimo. Aparte, no aquí, y aprobada.
--
-- NOTA 2 — El eje polimórfico no lleva FK
--
-- Responde D-A del plan de F1: `performance_entries` resuelve `subject_type` +
-- `subject_id` con SOLO un CHECK sobre el tipo y NINGUNA FK sobre el id — sin
-- trigger de validación. `metric_key` tampoco tiene FK al catálogo: es texto.
--
-- Postgres no admite FK polimórficas, así que no es un descuido, es la única
-- salida sin trigger. **Consecuencia para F1: `athlete_reports` copia esta
-- convención** — CHECK en `subject_type`, sin FK en `subject_id` — y valida la
-- existencia del sujeto dentro de `generate_report_drafts`, que es su único
-- escritor. Consistencia con la tabla hermana antes que pureza.
--
-- NOTA 3 — El cuerpo de `is_parent_of_child` está RECONSTRUIDO
--
-- El script volcó tablas, no funciones. La función se crea solo si falta, así que
-- en la base compartida no se toca; pero una base limpia se queda con MI versión,
-- que puede no coincidir con la real. Es una `SECURITY DEFINER` que gobierna el
-- acceso del padre a los datos de su hijo: la diferencia importa.
--
-- Para reconciliar, correr en el editor de Supabase:
--   SELECT pg_get_functiondef(p.oid)
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.proname = 'is_parent_of_child';
-- Si difiere, el fix va en una migración NUEVA (esta ya es inmutable).
-- =============================================================================
