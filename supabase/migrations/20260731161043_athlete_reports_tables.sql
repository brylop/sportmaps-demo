-- =============================================================================
-- 20260731161043_athlete_reports_tables.sql
-- Autor: brylop   Fecha: 2026-07-31   Versión anterior: 20260731160301
-- Objetivo: M1 del Informe Mensual del Atleta — las tablas, los invariantes de
--           estado, la auditoría y los grants. SIN policies ni RPCs (van en M2
--           y M3/M4).
--
-- Spec: docs/specs/athlete-reports-module.md §8. Plan: docs/plan-f1-informes-backend.md
--
-- Tablas: athlete_reports · team_report_notes · report_team_schedule
--         athlete_report_snapshots (la cuarta — ver DECISIÓN D-F abajo)
-- Además: 5 columnas de configuración en school_settings.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE. (Se cumple.)
--   · FKs de negocio a public.profiles(id), no a auth.users.
--
-- LECCIÓN APLICADA de 20260731154626 (que deadlockeó): una migración sobre esta
--   base compartida solo es segura si no toma locks innecesarios. Las 4 tablas
--   son nuevas, así que crearlas no compite con nadie; el único punto caliente es
--   el ALTER sobre school_settings, que va GUARDADO y en UNA sola sentencia para
--   tomar el lock una vez. Los FK hacia schools/teams/profiles/school_staff toman
--   ShareRowExclusiveLock breve en esas tablas (bloquea escrituras, no lecturas):
--   mejor aplicar en un momento tranquilo. `lock_timeout` hace que falle claro.
-- =============================================================================
-- DECISIONES QUE TOMÉ SIN RESPUESTA EXPLÍCITA (fáciles de revertir, marcadas):
--
--   D-C · Atleta sin equipo ni calendario. Regla literal de D17 → nunca publica,
--         en silencio. Aquí: `team_id` es NULL (no hay equipo gobernante) y la
--         fecha sale de `school_settings.reports_default_send_day` (nueva, default
--         28). Así siempre hay respuesta y el atleta aparece en el tablero de
--         cobertura en vez de desaparecer. En Dynasty son 6 atletas activos.
--
--   D-F · Dónde va el snapshot viejo. §8.4 dice que regenerar «archiva el
--         anterior» y el modelo de §8 no tiene dónde. Cuarta tabla
--         `athlete_report_snapshots`, en vez de un jsonb que crece dentro de la
--         misma fila. Es DESVIACIÓN de la spec (dice 3 tablas) y va marcada.
--
--   D-D+ · `team_report_notes.author_id` queda NULLABLE, contra la spec que lo
--         pone NOT NULL. Razón: con NOT NULL el FK tendría que ser RESTRICT, y eso
--         añade otro bloqueador escondido al borrado de usuarios, que ya es
--         doloroso en este repo (refs ocultas en school_staff.coach_auth_id y
--         storage.objects.owner). Con ON DELETE SET NULL la nota sobrevive al
--         entrenador que se va, y el nombre del autor igual queda congelado en el
--         snapshot (§8.4 ya lo incluye).
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

-- ─── 1. athlete_reports — el registro (uno por atleta y periodo) ─────────────
--
-- Eje del sujeto: `subject_type` + `subject_id`, igual que performance_entries.
-- CHECK sobre el tipo y SIN FK sobre el id — Postgres no admite FK polimórficas
-- (D-A, confirmado con el volcado real). La existencia del sujeto la valida
-- `generate_report_drafts`, único escritor. **No introducir columnas separadas por
-- tipo de sujeto:** el índice único parcial de `payments` solo cubría menores
-- (`WHERE child_id IS NOT NULL`) y dejó a los adultos sin red de DB.
CREATE TABLE IF NOT EXISTS public.athlete_reports (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id               uuid        NOT NULL REFERENCES public.schools(id)         ON DELETE CASCADE,
    branch_id               uuid        REFERENCES public.school_branches(id)          ON DELETE SET NULL,

    -- Equipo GOBERNANTE (D17), no «el» equipo del atleta. NULL = sin equipo:
    -- gobierna el día por defecto de la escuela (D-C).
    team_id                 uuid        REFERENCES public.teams(id)                    ON DELETE SET NULL,

    subject_type            text        NOT NULL
        CHECK (subject_type IN ('profile','child','unregistered')),
    subject_id              uuid        NOT NULL,

    period_year             smallint    NOT NULL CHECK (period_year BETWEEN 2020 AND 2100),
    period_month            smallint    NOT NULL CHECK (period_month BETWEEN 1 AND 12),

    status                  text        NOT NULL DEFAULT 'borrador'
        CHECK (status IN ('borrador','listo','publicado','retenido','omitido')),
    scheduled_for           date        NOT NULL,

    -- Congelado al publicar (§8.4). Es la ÚNICA fuente de la vista del padre y
    -- del PDF: si la pantalla leyera performance_entries, el PDF diferiría de lo
    -- que el padre vio.
    snapshot                jsonb,
    snapshot_version        smallint    NOT NULL DEFAULT 1 CHECK (snapshot_version >= 1),

    coach_note              text,
    -- ⚠️ staff id, NO auth.uid(): la identidad del coach en este repo es
    -- school_staff.id vía coach_auth_id (ver useCoachStaffId.ts).
    coach_note_by           uuid        REFERENCES public.school_staff(id)             ON DELETE SET NULL,

    published_at            timestamptz,
    published_by            uuid        REFERENCES public.profiles(id)                 ON DELETE SET NULL,
    published_without_note  boolean     NOT NULL DEFAULT false,
    hold_reason             text,

    -- Se resuelve al publicar. NULL = sin destinatario (D16): no cuenta como
    -- pendiente de envío, y F6 lo adopta cuando la familia se vincula.
    recipient_id            uuid        REFERENCES public.profiles(id)                 ON DELETE SET NULL,
    sent_at                 timestamptz,   -- publicado ≠ enviado
    viewed_at               timestamptz,   -- primera apertura; gobierna la cascada de §7.1
    view_count              integer     NOT NULL DEFAULT 0 CHECK (view_count >= 0),

    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),

    -- Un informe por atleta y periodo. Cubre los TRES tipos de sujeto sin índice
    -- parcial. Incluye school_id a propósito: un atleta en dos escuelas recibe un
    -- informe por escuela.
    CONSTRAINT athlete_reports_unique_subject_period
        UNIQUE (school_id, subject_type, subject_id, period_year, period_month),

    -- Invariantes de la máquina de estados, en la DB y no solo en las RPCs.
    -- Publicado exige snapshot congelado: sin esto un 'publicado' con snapshot
    -- NULL dejaría al padre y al PDF sin fuente, que es justo lo que §8.4 protege.
    CONSTRAINT athlete_reports_published_needs_snapshot
        CHECK (status <> 'publicado' OR snapshot IS NOT NULL),
    CONSTRAINT athlete_reports_published_needs_timestamp
        CHECK (status <> 'publicado' OR published_at IS NOT NULL),
    -- Retener exige motivo (§10: «motivo obligatorio»).
    CONSTRAINT athlete_reports_held_needs_reason
        CHECK (status <> 'retenido' OR (hold_reason IS NOT NULL AND length(btrim(hold_reason)) > 0))

    -- NO se añade un CHECK «viewed_at exige sent_at»: sería falso. El informe
    -- publicado SIN destinatario (D16) no se envía nunca, y el padre igual lo ve
    -- al entrar cuando la familia se vincula —la RLS resuelve por
    -- children.parent_id—. Ese CHECK haría fallar `mark_report_viewed` justo en
    -- el caso de F6, que es el 78% de Dynasty.
);

CREATE INDEX IF NOT EXISTS idx_athlete_reports_period
    ON public.athlete_reports (school_id, period_year, period_month, status);

-- El emisor busca lo que toca publicar hoy: parcial para no cargar el histórico.
CREATE INDEX IF NOT EXISTS idx_athlete_reports_pending
    ON public.athlete_reports (school_id, scheduled_for)
    WHERE status IN ('borrador','listo');

CREATE INDEX IF NOT EXISTS idx_athlete_reports_recipient
    ON public.athlete_reports (recipient_id)
    WHERE recipient_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_athlete_reports_team
    ON public.athlete_reports (team_id);

CREATE INDEX IF NOT EXISTS idx_athlete_reports_subject
    ON public.athlete_reports (subject_type, subject_id);


-- ─── 2. team_report_notes — la nota de equipo ────────────────────────────────
-- La pieza donde el módulo se gana o se pierde: un coach con 4 equipos no
-- escribe 60 notas individuales, sí escribe 4 párrafos. Acepta escritura DIRECTA
-- del coach (no hay máquina de estados que proteger); la policy por fila alcanza.
CREATE TABLE IF NOT EXISTS public.team_report_notes (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id     uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    team_id       uuid        NOT NULL REFERENCES public.teams(id)   ON DELETE CASCADE,
    period_year   smallint    NOT NULL CHECK (period_year BETWEEN 2020 AND 2100),
    period_month  smallint    NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    body          text        NOT NULL CHECK (length(btrim(body)) >= 20),
    -- NULLABLE a propósito — ver D-D+ en la cabecera.
    author_id     uuid        REFERENCES public.school_staff(id)     ON DELETE SET NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT team_report_notes_unique_team_period UNIQUE (team_id, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_team_report_notes_school_period
    ON public.team_report_notes (school_id, period_year, period_month);


-- ─── 3. report_team_schedule — el calendario ─────────────────────────────────
-- Un día por equipo dentro de la última semana: reparte la carga del coach y
-- evita el pico de correo que los filtros leen como campaña masiva.
CREATE TABLE IF NOT EXISTS public.report_team_schedule (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id   uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    team_id     uuid        NOT NULL REFERENCES public.teams(id)   ON DELETE CASCADE,
    send_day    smallint    NOT NULL CHECK (send_day BETWEEN 1 AND 31),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT report_team_schedule_unique_team UNIQUE (school_id, team_id)
);


-- ─── 4. athlete_report_snapshots — el histórico congelado (D-F) ──────────────
-- Un informe que el padre ya leyó no puede cambiar en silencio si mañana se
-- corrige una medición. Regenerar es explícito, versionado y auditado: sube
-- `snapshot_version` en athlete_reports y la versión anterior se archiva ACÁ.
-- Append-only: nadie actualiza ni borra filas de esta tabla.
CREATE TABLE IF NOT EXISTS public.athlete_report_snapshots (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id    uuid        NOT NULL REFERENCES public.athlete_reports(id) ON DELETE CASCADE,
    version      smallint    NOT NULL CHECK (version >= 1),
    snapshot     jsonb       NOT NULL,
    reason       text        NOT NULL CHECK (length(btrim(reason)) > 0),
    archived_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
    archived_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT athlete_report_snapshots_unique_version UNIQUE (report_id, version)
);

CREATE INDEX IF NOT EXISTS idx_athlete_report_snapshots_report
    ON public.athlete_report_snapshots (report_id, version DESC);


-- ─── 5. Configuración en school_settings ─────────────────────────────────────
-- En la TABLA school_settings, no en el JSONB legacy schools.payment_settings.
--
-- Punto caliente de locks: school_settings se lee en cada request. Va guardado
-- (si las columnas ya están, no se ejecuta el ALTER y no se toma lock) y las 5
-- columnas entran en UNA sola sentencia para tomar el lock una vez, no cinco.
-- Con default constante el ADD COLUMN no reescribe la tabla (PG11+).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'school_settings'
          AND column_name  = 'reports_enabled'
    ) THEN
        ALTER TABLE public.school_settings
            -- Default FALSE: el módulo no está construido todavía. Encenderlo es
            -- una decisión de la escuela, no un efecto de aplicar la migración.
            ADD COLUMN reports_enabled           boolean  NOT NULL DEFAULT false,
            -- Quién libera el informe. Coach = autor, escuela = publica: son dos
            -- responsabilidades distintas y un solo botón es el error.
            ADD COLUMN reports_release_by        text     NOT NULL DEFAULT 'school'
                CHECK (reports_release_by IN ('school','coach')),
            -- Días antes del send_day más temprano de la escuela para crear los
            -- borradores (§11). OJO: es otra fecha que el «más tardío» de D17,
            -- que decide qué equipo GOBIERNA a un atleta multi-equipo.
            ADD COLUMN reports_draft_lead_days   smallint NOT NULL DEFAULT 5
                CHECK (reports_draft_lead_days BETWEEN 0 AND 28),
            -- Días sin abrir antes del único recordatorio. Nunca tres avisos por
            -- el mismo informe.
            ADD COLUMN reports_reminder_days     smallint NOT NULL DEFAULT 3
                CHECK (reports_reminder_days BETWEEN 1 AND 30),
            -- D-C: día del atleta SIN equipo gobernante. Sin esto su informe no
            -- tendría fecha y no publicaría nunca, en silencio.
            ADD COLUMN reports_default_send_day  smallint NOT NULL DEFAULT 28
                CHECK (reports_default_send_day BETWEEN 1 AND 31);
    END IF;
END $$;


-- ─── 6. Triggers: updated_at y auditoría ─────────────────────────────────────
-- audit_trigger_func() lee school_id de la fila; las tres tablas auditadas lo
-- tienen. athlete_report_snapshots no se audita: ES el rastro de auditoría, y ya
-- guarda archived_by/archived_at/reason.
DROP TRIGGER IF EXISTS trg_athlete_reports_touch ON public.athlete_reports;
CREATE TRIGGER trg_athlete_reports_touch
    BEFORE UPDATE ON public.athlete_reports
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_team_report_notes_touch ON public.team_report_notes;
CREATE TRIGGER trg_team_report_notes_touch
    BEFORE UPDATE ON public.team_report_notes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_report_team_schedule_touch ON public.report_team_schedule;
CREATE TRIGGER trg_report_team_schedule_touch
    BEFORE UPDATE ON public.report_team_schedule
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_audit_athlete_reports ON public.athlete_reports;
CREATE TRIGGER trg_audit_athlete_reports
    AFTER INSERT OR UPDATE OR DELETE ON public.athlete_reports
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS trg_audit_team_report_notes ON public.team_report_notes;
CREATE TRIGGER trg_audit_team_report_notes
    AFTER INSERT OR UPDATE OR DELETE ON public.team_report_notes
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS trg_audit_report_team_schedule ON public.report_team_schedule;
CREATE TRIGGER trg_audit_report_team_schedule
    AFTER INSERT OR UPDATE OR DELETE ON public.report_team_schedule
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();


-- ─── 7. RLS activada; las policies van en M2 ─────────────────────────────────
-- Tablas nuevas: activar RLS acá no compite con nadie porque ninguna sesión las
-- conoce todavía. Quedan CERRADAS hasta M2 — sin policies, RLS niega todo, que es
-- el estado seguro para dejarlas entre una migración y la siguiente.
ALTER TABLE public.athlete_reports           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_report_notes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_team_schedule      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_report_snapshots  ENABLE ROW LEVEL SECURITY;


-- ─── 8. Grants ───────────────────────────────────────────────────────────────
-- ⚠️ IMPRESCINDIBLE, no cosmético: Supabase aplica default privileges a lo que se
-- crea en `public`, así que estas tablas nacerían con TODOS los privilegios para
-- anon y authenticated — exactamente la deriva encontrada en las 5 tablas de
-- rendimiento (`GRANT ALL … TO anon`, TRUNCATE incluido). Se revoca primero y se
-- concede lo mínimo.
REVOKE ALL ON public.athlete_reports          FROM anon, authenticated;
REVOKE ALL ON public.team_report_notes        FROM anon, authenticated;
REVOKE ALL ON public.report_team_schedule     FROM anon, authenticated;
REVOKE ALL ON public.athlete_report_snapshots FROM anon, authenticated;

-- §9.1 — NADIE hace UPDATE directo sobre athlete_reports. Las policies de
-- Postgres son por FILA, no por columna: «el coach actualiza solo coach_note» no
-- se puede expresar con una policy, porque una policy de UPDATE le deja tocar
-- status, snapshot y todo lo demás. Solo SELECT; toda escritura pasa por las RPCs
-- de M3/M4, que son las que conocen las reglas de estado.
GRANT SELECT ON public.athlete_reports TO authenticated;

-- Texto plano sin máquina de estados: el coach escribe directo y la RLS de M2
-- restringe a sus equipos. Sin DELETE — una nota no se borra, se reescribe.
GRANT SELECT, INSERT, UPDATE ON public.team_report_notes TO authenticated;

-- El calendario lo maneja el admin; la RLS de M2 restringe a is_school_admin.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_team_schedule TO authenticated;

-- Append-only y solo desde RPC: lectura para que el admin vea el histórico.
GRANT SELECT ON public.athlete_report_snapshots TO authenticated;

COMMIT;

-- =============================================================================
-- Qué NO hace esta migración, a propósito:
--   · Policies de RLS  → M2 (+ helper coach_can_see_report(), D19).
--   · Las 11 RPCs      → M3 (escritura) y M4 (lectura/cobertura/adopción).
--   · Tests de concurrencia sobre publish → con M3, que es donde vive el
--     SELECT … FOR UPDATE.
--
-- Entre M1 y M2 las cuatro tablas quedan con RLS activa y CERO policies, o sea
-- inaccesibles para authenticated. Es deliberado: el estado intermedio seguro es
-- «nadie ve nada», no «todos ven todo».
-- =============================================================================
