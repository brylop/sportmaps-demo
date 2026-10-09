-- Pegar COMPLETO en el SQL Editor de Supabase y ejecutar. Paso 12 de 14 (orden obligatorio).

-- =============================================================================
-- 20261008164445_llm_usage_registro_de_consumo.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-08   Versión anterior: 20261008163938
-- Objetivo: registrar cuántos tokens gasta cada llamada a un modelo (bot de
-- WhatsApp, lectura de comprobantes, transcripción de audios y SportBot) para
-- que el informe semanal de calidad del bot pueda decir cuánto cuesta, por
-- escuela, por proveedor/modelo y por conversación. Hasta hoy el uso solo
-- quedaba en un console.info de llm.service (y el OCR no lo guardaba).
-- =============================================================================
-- Diseño:
--   · Telemetría interna de SportMaps: SIN acceso para anon ni authenticated
--     (RLS prendida y sin policies; además REVOKE explícito). Solo el BFF con
--     service_role escribe y lee.
--   · Sin FKs: el insert es best-effort y nunca debe fallar porque la escuela o
--     la conversación se borró. school_id/conversation_id son referencias
--     blandas.
--   · No guarda texto de nadie: solo conteos, proveedor, modelo y a qué escuela
--     y conversación corresponde.
--   · feature como text + CHECK (no CREATE TYPE).
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.llm_usage (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id          uuid,
    conversation_id    uuid,
    feature            text NOT NULL CHECK (feature IN ('bot', 'ocr', 'transcripcion', 'sportbot')),
    provider           text NOT NULL,
    model              text NOT NULL,
    input_tokens       integer NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
    output_tokens      integer NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
    cache_read_tokens  integer NOT NULL DEFAULT 0 CHECK (cache_read_tokens >= 0),
    cache_write_tokens integer NOT NULL DEFAULT 0 CHECK (cache_write_tokens >= 0),
    -- Transcripción: los proveedores cobran por duración del audio, no por token.
    audio_segundos     numeric(10, 1),
    created_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.llm_usage IS
    'Consumo de modelos (tokens / segundos de audio) por llamada. Telemetría interna: solo service_role. Lo escribe bff/src/services/llm-usage.service.ts.';

CREATE INDEX IF NOT EXISTS llm_usage_created_at_idx ON public.llm_usage (created_at);
CREATE INDEX IF NOT EXISTS llm_usage_school_created_idx ON public.llm_usage (school_id, created_at);

ALTER TABLE public.llm_usage ENABLE ROW LEVEL SECURITY;
-- Sin policies a propósito: anon y authenticated no ven ni escriben nada.
REVOKE ALL ON TABLE public.llm_usage FROM PUBLIC;
REVOKE ALL ON TABLE public.llm_usage FROM anon;
REVOKE ALL ON TABLE public.llm_usage FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.llm_usage TO service_role;

COMMIT;

-- Registro (el SQL Editor no deja rastro en schema_migrations)
insert into supabase_migrations.schema_migrations (version, name, created_by)
values ('20261008164445', '20261008164445_llm_usage_registro_de_consumo', 'sql-editor 2026-10-08') on conflict (version) do nothing;
