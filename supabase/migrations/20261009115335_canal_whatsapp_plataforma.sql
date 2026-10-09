-- =============================================================================
-- 20261009115335_canal_whatsapp_plataforma.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-09   Versión anterior: 20261008183746
-- Objetivo: canal de WhatsApp de PLATAFORMA (número comercial de SportMaps):
--   avisos a dueñas/admins de escuela con opt-in por número y escuela, y el
--   chat de pruebas «modo escuela» para el desarrollador.
--   Spec: docs/specs/canal-whatsapp-plataforma.md (§5 = este plan).
-- =============================================================================
-- Solo crea objetos NUEVOS. No toca tablas, policies ni funciones existentes.
-- Las seis tablas son service-only: RLS activado, ninguna policy, REVOKE a
-- anon/authenticated. El canal NO es una fila de school_whatsapp_integrations
-- (school_id NOT NULL + ~40 consultas que asumen escuela): vive aparte.
-- Estados con text + CHECK. FKs de negocio a profiles(id) / schools(id).
-- =============================================================================

BEGIN;

-- ─── updated_at ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.platform_wa_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.platform_wa_touch_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_wa_touch_updated_at() FROM anon, authenticated;

-- ─── 1. El canal (singleton) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_wa_canal (
    id                      text PRIMARY KEY DEFAULT 'sportmaps' CHECK (id = 'sportmaps'),
    phone_number_id         text NOT NULL UNIQUE,
    waba_id                 text NOT NULL,
    display_phone_number    text,
    access_token_encrypted  text,
    status                  text NOT NULL DEFAULT 'inactivo'
                            CHECK (status IN ('inactivo', 'activo', 'suspendido')),
    conectado_at            timestamptz,
    token_rotated_at        timestamptz,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.platform_wa_canal IS
    'Número de WhatsApp de PLATAFORMA (comercial de SportMaps). Una sola fila. Token cifrado AES-256-GCM (WHATSAPP_TOKEN_ENC_KEY). Service-only.';

-- ─── 2. Ajuste por escuela (piloto) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_wa_escuelas (
    school_id        uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
    habilitado       boolean NOT NULL DEFAULT false,
    actualizado_por  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.platform_wa_escuelas IS
    'Escuelas habilitadas para recibir avisos por el canal de plataforma. Sin fila = apagado.';

-- ─── 3. Suscripciones (opt-in por número + escuela) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_wa_suscripciones (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id               uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    profile_id              uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    contact_wa_id           text NOT NULL CHECK (contact_wa_id ~ '^573[0-9]{9}$'),
    estado                  text NOT NULL DEFAULT 'pendiente'
                            CHECK (estado IN ('pendiente', 'activa', 'revocada')),
    origen                  text NOT NULL CHECK (origen IN ('app', 'whatsapp')),
    codigo                  text CHECK (codigo IS NULL OR codigo ~ '^[A-Z0-9]{6}$'),
    codigo_expira_at        timestamptz,
    -- wa_message_id del mensaje «ACTIVAR» que escribió el propio número.
    consentimiento_ref      text,
    activada_at             timestamptz,
    revocada_at             timestamptz,
    motivo_revocacion       text,
    avisar_comprobantes     boolean NOT NULL DEFAULT true,
    avisar_escalaciones     boolean NOT NULL DEFAULT true,
    avisar_retiros          boolean NOT NULL DEFAULT true,
    avisar_cortesias        boolean NOT NULL DEFAULT true,
    avisar_resumen_diario   boolean NOT NULL DEFAULT true,
    avisar_informe_cartera  boolean NOT NULL DEFAULT true,
    silencio_desde          smallint NOT NULL DEFAULT 22 CHECK (silencio_desde BETWEEN 0 AND 23),
    silencio_hasta          smallint NOT NULL DEFAULT 7  CHECK (silencio_hasta BETWEEN 0 AND 23),
    urgentes_en_silencio    boolean NOT NULL DEFAULT false,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT platform_wa_suscripciones_escuela_numero_uq UNIQUE (school_id, contact_wa_id),
    CONSTRAINT platform_wa_suscripciones_activa_con_prueba
        CHECK (estado <> 'activa' OR (consentimiento_ref IS NOT NULL AND activada_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS platform_wa_suscripciones_numero_idx
    ON public.platform_wa_suscripciones (contact_wa_id);
CREATE INDEX IF NOT EXISTS platform_wa_suscripciones_activas_idx
    ON public.platform_wa_suscripciones (school_id) WHERE estado = 'activa';
CREATE UNIQUE INDEX IF NOT EXISTS platform_wa_suscripciones_codigo_uq
    ON public.platform_wa_suscripciones (codigo) WHERE estado = 'pendiente' AND codigo IS NOT NULL;
COMMENT ON TABLE public.platform_wa_suscripciones IS
    'Opt-in de dueñas/admins a los avisos por el canal de plataforma. Activa solo con el «ACTIVAR» escrito desde ese número (consentimiento_ref).';

-- ─── 4. Envíos (reserva idempotente entre los 3 BFF + bitácora) ─────────────
CREATE TABLE IF NOT EXISTS public.platform_wa_envios (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    suscripcion_id  uuid NOT NULL REFERENCES public.platform_wa_suscripciones(id) ON DELETE CASCADE,
    school_id       uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    tipo            text NOT NULL CHECK (tipo IN (
                        'comprobantes', 'escalacion', 'retiro', 'cortesia',
                        'resumen_diario', 'informe_cartera')),
    clave           text NOT NULL CHECK (length(clave) BETWEEN 1 AND 300),
    estado          text NOT NULL DEFAULT 'reservado'
                    CHECK (estado IN ('reservado', 'enviado', 'fallido')),
    via             text CHECK (via IN ('texto', 'plantilla')),
    plantilla       text,
    wa_message_id   text,
    detalle         text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT platform_wa_envios_reserva_uq UNIQUE (suscripcion_id, clave)
);
CREATE INDEX IF NOT EXISTS platform_wa_envios_escuela_idx
    ON public.platform_wa_envios (school_id, created_at DESC);

-- ─── 5. Mensajes del número de plataforma ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_wa_mensajes (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    wa_message_id   text NOT NULL UNIQUE,
    direccion       text NOT NULL CHECK (direccion IN ('entrante', 'saliente')),
    contact_wa_id   text NOT NULL,
    clase           text NOT NULL CHECK (clase IN ('suscriptor', 'tester', 'desconocido')),
    tipo            text NOT NULL,
    -- De un desconocido no se guarda el texto (spec D12).
    texto           text,
    paso            text,
    status          text,
    status_at       timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT platform_wa_mensajes_desconocido_sin_texto
        CHECK (clase <> 'desconocido' OR texto IS NULL)
);
CREATE INDEX IF NOT EXISTS platform_wa_mensajes_contacto_idx
    ON public.platform_wa_mensajes (contact_wa_id, created_at DESC);

-- ─── 6. Sesiones del modo pruebas ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_wa_sesiones_prueba (
    contact_wa_id  text PRIMARY KEY CHECK (contact_wa_id ~ '^[0-9]{10,15}$'),
    school_id      uuid REFERENCES public.schools(id) ON DELETE CASCADE,
    rol            text NOT NULL DEFAULT 'prospecto' CHECK (rol IN ('papa', 'prospecto')),
    child_id       uuid REFERENCES public.children(id) ON DELETE SET NULL,
    parent_id      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    -- Memoria virtual de la conversación simulada (mensajes, flujos, bloqueos).
    estado         jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ─── Triggers updated_at ────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS platform_wa_canal_touch ON public.platform_wa_canal;
CREATE TRIGGER platform_wa_canal_touch BEFORE UPDATE ON public.platform_wa_canal
    FOR EACH ROW EXECUTE FUNCTION public.platform_wa_touch_updated_at();
DROP TRIGGER IF EXISTS platform_wa_escuelas_touch ON public.platform_wa_escuelas;
CREATE TRIGGER platform_wa_escuelas_touch BEFORE UPDATE ON public.platform_wa_escuelas
    FOR EACH ROW EXECUTE FUNCTION public.platform_wa_touch_updated_at();
DROP TRIGGER IF EXISTS platform_wa_suscripciones_touch ON public.platform_wa_suscripciones;
CREATE TRIGGER platform_wa_suscripciones_touch BEFORE UPDATE ON public.platform_wa_suscripciones
    FOR EACH ROW EXECUTE FUNCTION public.platform_wa_touch_updated_at();
DROP TRIGGER IF EXISTS platform_wa_envios_touch ON public.platform_wa_envios;
CREATE TRIGGER platform_wa_envios_touch BEFORE UPDATE ON public.platform_wa_envios
    FOR EACH ROW EXECUTE FUNCTION public.platform_wa_touch_updated_at();
DROP TRIGGER IF EXISTS platform_wa_sesiones_prueba_touch ON public.platform_wa_sesiones_prueba;
CREATE TRIGGER platform_wa_sesiones_prueba_touch BEFORE UPDATE ON public.platform_wa_sesiones_prueba
    FOR EACH ROW EXECUTE FUNCTION public.platform_wa_touch_updated_at();

-- ─── RLS + permisos: service-only ───────────────────────────────────────────
ALTER TABLE public.platform_wa_canal            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_wa_escuelas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_wa_suscripciones    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_wa_envios           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_wa_mensajes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_wa_sesiones_prueba  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.platform_wa_canal            FROM anon, authenticated;
REVOKE ALL ON public.platform_wa_escuelas         FROM anon, authenticated;
REVOKE ALL ON public.platform_wa_suscripciones    FROM anon, authenticated;
REVOKE ALL ON public.platform_wa_envios           FROM anon, authenticated;
REVOKE ALL ON public.platform_wa_mensajes         FROM anon, authenticated;
REVOKE ALL ON public.platform_wa_sesiones_prueba  FROM anon, authenticated;

GRANT ALL ON public.platform_wa_canal            TO service_role;
GRANT ALL ON public.platform_wa_escuelas         TO service_role;
GRANT ALL ON public.platform_wa_suscripciones    TO service_role;
GRANT ALL ON public.platform_wa_envios           TO service_role;
GRANT ALL ON public.platform_wa_mensajes         TO service_role;
GRANT ALL ON public.platform_wa_sesiones_prueba  TO service_role;

COMMIT;
