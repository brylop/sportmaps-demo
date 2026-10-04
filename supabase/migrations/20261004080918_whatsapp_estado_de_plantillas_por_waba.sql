-- =============================================================================
-- 20261004080918_whatsapp_estado_de_plantillas_por_waba.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-04   Versión anterior: 20261004074523
-- Objetivo: saber, POR ESCUELA, qué plantillas de Meta están aprobadas en SU
--           WABA, para que la cobranza automática por WhatsApp pueda usarlas.
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
-- POR QUÉ UNA TABLA NUEVA Y NO payment_message_templates.meta_*
--
--   Una plantilla de Meta vive DENTRO de una WABA: `pago_vence_hoy_v4` aprobada
--   en la WABA de prueba (2239403120233193) no sirve para enviar desde el número
--   de Dynasty (WABA 1096337621148583); allá hubo que registrarla de nuevo el
--   2026-10-04 y arrancó en PENDING. El estado es, entonces, por (WABA, nombre,
--   idioma).
--
--   `payment_message_templates` no tiene esa forma:
--     · 17 de sus 18 filas son GLOBALES (school_id NULL) — medido 2026-10-04.
--       Una fila global no puede llevar el estado de N WABAs distintas.
--     · Sus `body` son texto libre con {{nombre_padre}}, editable por la escuela
--       desde MessageTemplatesPage. Lo que Meta aprobó es OTRO texto, con
--       variables posicionales {{1}}..{{6}} fijas. Atar uno al otro sugiere que
--       editar el body cambia lo que se envía, y no es así.
--     · Su taxonomía (5 template_type) es más gruesa que la escalera de cobranza
--       (8 escalones): `reminder_due` no distingue "vence mañana" de "vence hoy".
--   `meta_template_name`/`meta_template_status` (agregadas por el spec de opt-in)
--   siguen vacías en las 18 filas y ningún código las lee. No se borran
--   (migraciones inmutables y el frontend tipado las conoce); quedan sin uso.
--
--   El MAPEO concepto → nombre de Meta va en código
--   (bff/src/services/whatsapp-plantillas.service.ts): cada nombre trae su
--   propio orden de variables (_v3/_v4 movieron {{2}} a escuela y {{4}} a
--   periodo), así que un cambio de nombre exige cambiar código de todos modos.
--
-- QUIÉN LA ESCRIBE
--
--   Solo el BFF con service_role:
--     (a) el job de sync cada 30 min (GET /{waba}/message_templates), que es la
--         fuente de verdad;
--     (b) si el GET falla, los eventos `message_template_status_update` que el
--         webhook ya guarda en whatsapp_account_events.
--   Ningún cliente escribe aquí: un admin que pudiera marcar APPROVED a mano
--   haría que la cobranza mande una plantilla que Meta rechaza.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.whatsapp_template_status (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    integration_id   uuid NOT NULL,
    -- Desnormalizado para que la policy no haga join (mismo criterio que
    -- whatsapp_optins). La FK compuesta de abajo garantiza que coincida.
    school_id        uuid NOT NULL,
    -- La WABA de la que se leyó. Si la escuela reconecta con otra WABA, las
    -- filas viejas quedan con el waba_id anterior y el servicio las ignora.
    waba_id          text NOT NULL,

    name             text NOT NULL,
    language         text NOT NULL,          -- 'es_CO', tal como lo devuelve Meta
    category         text,                   -- UTILITY | MARKETING | AUTHENTICATION
    -- text + CHECK, no CREATE TYPE. Lista = estados documentados por Meta para
    -- message_templates. Lo que Meta invente después entra como UNKNOWN (el
    -- servicio lo normaliza) en vez de tumbar el sync entero por un CHECK.
    status           text NOT NULL CHECK (status IN (
                         'APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'DISABLED',
                         'IN_APPEAL', 'PENDING_DELETION', 'DELETED',
                         'LIMIT_EXCEEDED', 'ARCHIVED', 'UNKNOWN'
                     )),
    meta_id          text,                   -- id de la plantilla en Meta
    rejected_reason  text,
    -- Los componentes tal como están APROBADOS en Meta: con esto el envío puede
    -- comprobar que el número de variables coincide antes de mandar.
    components       jsonb,
    -- De dónde salió el último estado: el listado (verdad) o un evento del webhook.
    source           text NOT NULL DEFAULT 'sync' CHECK (source IN ('sync', 'webhook')),

    synced_at        timestamptz NOT NULL DEFAULT now(),
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_wa_template_status UNIQUE (integration_id, name, language),

    -- uq_wa_integration_id_school ya existe (spec de opt-in); se reusa.
    CONSTRAINT fk_wa_template_status_integration
        FOREIGN KEY (integration_id, school_id)
        REFERENCES public.school_whatsapp_integrations(id, school_id)
        ON DELETE CASCADE
);

COMMENT ON TABLE public.whatsapp_template_status IS
    'Estado de cada plantilla de Meta en la WABA de cada integración. Lo escribe solo el BFF (sync cada 30 min + eventos del webhook). La cobranza automática solo envía plantillas con status=APPROVED aquí.';

-- La pregunta caliente del envío: "¿esta plantilla está aprobada en esta integración?"
CREATE INDEX IF NOT EXISTS idx_wa_template_status_aprobadas
    ON public.whatsapp_template_status (integration_id, name)
    WHERE status = 'APPROVED';

CREATE INDEX IF NOT EXISTS idx_wa_template_status_school
    ON public.whatsapp_template_status (school_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.whatsapp_template_status ENABLE ROW LEVEL SECURITY;

-- Lectura: administración de la escuela (owner/admin/school_admin activos en
-- school_members, vía is_school_admin). No user_school_ids(): padres y atletas
-- no tienen nada que ver con el estado de las plantillas.
-- (SELECT auth.uid()) no aplica: is_school_admin recibe la fila como argumento.
DROP POLICY IF EXISTS "wa_template_status_admin_select" ON public.whatsapp_template_status;
CREATE POLICY "wa_template_status_admin_select" ON public.whatsapp_template_status
    FOR SELECT TO authenticated
    USING (public.is_school_admin(school_id));

-- Escritura: ninguna policy para authenticated/anon y sin grants de escritura.
-- Sin FOR ALL (invariante I3). service_role salta RLS.
REVOKE ALL ON TABLE public.whatsapp_template_status FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.whatsapp_template_status TO authenticated;
GRANT ALL ON TABLE public.whatsapp_template_status TO service_role;

COMMIT;

-- ─── Verificación después de aplicar (solo lectura) ─────────────────────────
-- select cmd, policyname, roles, qual, with_check from pg_policies
--  where tablename = 'whatsapp_template_status';          -- 1 policy, SELECT
-- set local role anon; select count(*) from public.whatsapp_template_status;  -- permission denied
-- npm run seguridad:invariantes
