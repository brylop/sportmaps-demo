-- ============================================================================
-- Estados de entrega y consumo facturable de WhatsApp
--
-- Meta manda al MISMO webhook que ya tenemos suscrito un evento `statuses` por
-- cada mensaje saliente, con su estado (sent/delivered/read/failed) y un bloque
-- `pricing` que dice si fue FACTURABLE y en qué categoría. Hasta hoy lo
-- descartábamos — en el código había un TODO de WA4 y nada más.
--
-- Importa por dos razones.
--
-- La comercial: SportMaps toma la línea de crédito con Meta y vende paquetes de
-- mensajes por encima de lo incluido en el plan. Sin este dato no hay medidor, y
-- sin medidor no se puede ni facturar el excedente ni saber cuánto se le va a
-- pagar a Meta antes de que llegue la factura.
--
-- La técnica: Meta cobra por mensaje ENTREGADO, no enviado. Contar envíos daría
-- un número distinto al de la factura.
--
-- No se estima la categoría por nuestra cuenta: la dice Meta, que es quien
-- cobra. Se guarda además el bloque `pricing` crudo, porque su forma ya cambió
-- una vez (de cobro por conversación a cobro por mensaje) y volverá a cambiar.
-- ============================================================================

ALTER TABLE public.whatsapp_messages
    -- Cuándo llegó el último cambio de estado. `status` ya existía y nunca se
    -- llenaba con lo que reporta Meta.
    ADD COLUMN IF NOT EXISTS status_at        timestamptz,
    -- Lo que Meta cobra. NULL = todavía no llegó el status, o no aplica
    -- (mensajes entrantes).
    ADD COLUMN IF NOT EXISTS billable         boolean,
    -- 'service' | 'utility' | 'marketing' | 'authentication'. Texto libre a
    -- propósito: Meta agrega categorías sin avisar, y un CHECK aquí rompería la
    -- ingesta de estados por algo que no es un error nuestro.
    ADD COLUMN IF NOT EXISTS pricing_category text,
    -- El bloque `pricing` completo, tal como llegó.
    ADD COLUMN IF NOT EXISTS pricing_raw      jsonb;

COMMENT ON COLUMN public.whatsapp_messages.billable IS
    'Si Meta cobró este mensaje. Lo dice el evento `statuses`, no se estima. '
    'Las respuestas dentro de la ventana de servicio de 24 h suelen venir en false.';
COMMENT ON COLUMN public.whatsapp_messages.pricing_category IS
    'Categoría de cobro que reporta Meta: service, utility, marketing, authentication.';
COMMENT ON COLUMN public.whatsapp_messages.pricing_raw IS
    'Bloque `pricing` crudo del webhook. Se conserva porque su forma ya cambió una '
    'vez (conversaciones → mensajes) y los campos extraídos podrían quedar cortos.';

-- Índice del medidor: cuenta lo facturable por integración y mes. Parcial, para
-- que no pese lo que no se cobra — que sera la mayoria del trafico.
CREATE INDEX IF NOT EXISTS idx_wa_messages_facturables
    ON public.whatsapp_messages (integration_id, created_at)
    WHERE billable IS TRUE;

-- Índice para resolver el mensaje por su id de Meta cuando llega el status.
-- Sin esto, cada evento de entrega haría un seq scan sobre toda la tabla.
CREATE INDEX IF NOT EXISTS idx_wa_messages_wa_id
    ON public.whatsapp_messages (wa_message_id);

-- ── El medidor ──────────────────────────────────────────────────────────────
-- Consumo facturable del mes en curso por integración, con el desglose por
-- categoría. Es lo que alimenta la pantalla y el aviso de "te estás pasando".
CREATE OR REPLACE FUNCTION public.wa_consumo_del_mes(
    p_integration_id uuid,
    p_desde          timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    -- Autorización DENTRO de la función, no delegada al BFF.
    --
    -- Es `SECURITY DEFINER` y recibe el `integration_id` como parámetro: sin este
    -- filtro, cualquier usuario autenticado podría pedir el consumo de CUALQUIER
    -- escuela pasando otro id. Que el BFF "ya valide" no alcanza — la RPC queda
    -- expuesta por PostgREST igual.
    WITH permiso AS (
        SELECT public.is_school_admin(i.school_id) AS ok
        FROM public.school_whatsapp_integrations i
        WHERE i.id = p_integration_id
    ),
    ventana AS (
        SELECT COALESCE(
            p_desde,
            date_trunc('month', (now() AT TIME ZONE 'America/Bogota'))
                AT TIME ZONE 'America/Bogota'
        ) AS desde
    ),
    base AS (
        SELECT m.pricing_category, m.billable
        FROM public.whatsapp_messages m, ventana v, permiso p
        WHERE p.ok IS TRUE
          AND m.integration_id = p_integration_id
          AND m.direction = 'outbound'
          AND m.created_at >= v.desde
    )
    SELECT jsonb_build_object(
        'desde',        (SELECT desde FROM ventana),
        'facturables',  COUNT(*) FILTER (WHERE billable IS TRUE),
        'gratis',       COUNT(*) FILTER (WHERE billable IS FALSE),
        'sin_estado',   COUNT(*) FILTER (WHERE billable IS NULL),
        'por_categoria', COALESCE(
            (SELECT jsonb_object_agg(COALESCE(pricing_category, 'sin_categoria'), n)
             FROM (SELECT pricing_category, COUNT(*) n
                     FROM base WHERE billable IS TRUE
                    GROUP BY pricing_category) x),
            '{}'::jsonb)
    )
    FROM base;
$$;

COMMENT ON FUNCTION public.wa_consumo_del_mes(uuid, timestamptz) IS
    'Mensajes facturables del mes por integración, con desglose por categoría. '
    '`sin_estado` son salientes cuyo status todavía no llegó: si crece, el webhook '
    'de statuses dejó de procesarse.';

REVOKE ALL ON FUNCTION public.wa_consumo_del_mes(uuid, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wa_consumo_del_mes(uuid, timestamptz) FROM anon;
-- `authenticated` la llama desde la pantalla de la escuela, y el gate de que sea
-- SU integración está adentro (is_school_admin), no delegado al BFF.
GRANT EXECUTE ON FUNCTION public.wa_consumo_del_mes(uuid, timestamptz) TO authenticated;
-- El BFF entra con service_role, que no tiene JWT: `is_school_admin()` devolvería
-- false y no vería nada. Para los jobs internos se consulta la tabla directo, que
-- es lo que service_role ya puede hacer.
GRANT EXECUTE ON FUNCTION public.wa_consumo_del_mes(uuid, timestamptz) TO service_role;
