-- ============================================================================
-- wa_queue_claim — el worker toma trabajo de la cola de comprobantes
--
-- Plan: docs/specs/whatsapp-cola-de-comprobantes-plan.md §4.2
--
-- Va en una RPC y no en el BFF porque `FOR UPDATE SKIP LOCKED` no se puede
-- expresar por PostgREST, y sin él dos instancias del BFF (dev y stg comparten
-- base) toman la MISMA fila y procesan el comprobante dos veces.
--
-- Hace tres cosas en una sola llamada:
--   1. Saca de la rueda lo que agotó reintentos, con motivo.
--   2. Rescata lo que quedó en 'processing' con el lease vencido.
--   3. Devuelve las filas ya marcadas, que es el claim atómico.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.wa_queue_claim(
    p_limit         integer DEFAULT 10,
    p_lease_minutes integer DEFAULT 5,
    p_max_retries   integer DEFAULT 5
)
RETURNS SETOF public.whatsapp_inbound_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    -- 1) Lo que agotó reintentos sale de la rueda CON MOTIVO, en vez de girar
    --    para siempre consumiendo OCR contra un proveedor que cobra. Queda en
    --    'failed' para que lo recoja el inbox de la escuela.
    UPDATE public.whatsapp_inbound_queue
       SET status        = 'failed',
           error_message = COALESCE(error_message, 'agotó los reintentos'),
           processed_at  = now(),
           updated_at    = now()
     WHERE status IN ('pending', 'processing')
       AND retries >= p_max_retries;

    -- 2) y 3) Claim atómico. NO es SELECT y después UPDATE: entre las dos
    --    sentencias otra instancia se lleva la fila.
    --
    --    La segunda rama del WHERE es el rescate: si el proceso muere entre el
    --    claim y el final, la fila quedaba en 'processing' PARA SIEMPRE — sin
    --    que nadie la mire y sin aparecer en ningún listado de pendientes. El
    --    lease vencido la devuelve a la rueda.
    RETURN QUERY
    UPDATE public.whatsapp_inbound_queue q
       SET status       = 'processing',
           locked_until = now() + make_interval(mins => p_lease_minutes),
           -- Solo el rescate incrementa acá. En el fallo transitorio lo
           -- incrementa el worker al devolver la fila a 'pending'; son caminos
           -- excluyentes (o el worker reportó, o se murió), así que no se
           -- cuenta dos veces.
           retries      = CASE WHEN q.status = 'processing' THEN q.retries + 1 ELSE q.retries END,
           updated_at   = now()
     WHERE q.id IN (
         SELECT id
           FROM public.whatsapp_inbound_queue
          WHERE retries < p_max_retries
            AND (
                  (status = 'pending'
                   AND (next_retry_at IS NULL OR next_retry_at <= now()))
               OR (status = 'processing'
                   AND locked_until IS NOT NULL AND locked_until < now())
            )
          ORDER BY created_at
          LIMIT p_limit
          FOR UPDATE SKIP LOCKED
     )
    RETURNING q.*;
END;
$$;

COMMENT ON FUNCTION public.wa_queue_claim(integer, integer, integer) IS
    'Claim atómico de la cola de WhatsApp con lease y SKIP LOCKED. Solo service_role. '
    'Ver docs/specs/whatsapp-cola-de-comprobantes-plan.md §4.2';

-- Permisos: solo el worker. `SECURITY DEFINER` NO exime al caller de tener
-- EXECUTE, y los default privileges del esquema se lo dan a PUBLIC en cada
-- función nueva — por eso hay que revocar de cada rol explícitamente y no
-- confiar en REVOKE FROM PUBLIC solo.
REVOKE ALL ON FUNCTION public.wa_queue_claim(integer, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wa_queue_claim(integer, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.wa_queue_claim(integer, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.wa_queue_claim(integer, integer, integer) TO service_role;
