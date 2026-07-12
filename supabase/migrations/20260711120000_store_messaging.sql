-- ============================================================
-- SPORTMAPS — Mensajería de TIENDA (comprador ↔ vendedor)
--
-- Canal de conversación de tienda, TOTALMENTE SEPARADO de los mensajes
-- internos de la escuela (`public.messages`, escuela↔familia) y del canal
-- WhatsApp. Aquí solo van dudas de producto / seguimiento de pedido entre
-- el COMPRADOR y el VENDEDOR (vendor_profile: escuela, coach, tienda externa…).
--
-- No referencia `messages` ni `whatsapp_*`: dominio, tablas, RLS y UI aparte.
-- RLS enforce participantes → el frontend puede consumir directo por supabase.
-- ============================================================

-- Helper: ¿el usuario actual es el vendedor de este vendor_profile?
CREATE OR REPLACE FUNCTION public.is_store_vendor(p_vendor_profile_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.vendor_profiles vp
         WHERE vp.id = p_vendor_profile_id AND vp.user_id = auth.uid()
    );
$$;
GRANT EXECUTE ON FUNCTION public.is_store_vendor(uuid) TO authenticated;

-- ─── Conversaciones ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.store_conversations (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_profile_id uuid NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
    buyer_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    order_id          uuid REFERENCES public.orders(id)   ON DELETE SET NULL,
    product_id        uuid REFERENCES public.products(id) ON DELETE SET NULL,
    subject           text,
    last_message_at   timestamptz NOT NULL DEFAULT now(),
    buyer_unread      integer NOT NULL DEFAULT 0,
    vendor_unread     integer NOT NULL DEFAULT 0,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.store_conversations IS
    'Hilo de conversación de tienda comprador↔vendedor. SEPARADO de messages (escuela↔familia).';

-- Un hilo por (comprador, vendedor, pedido); y uno general sin pedido.
CREATE UNIQUE INDEX IF NOT EXISTS uq_store_conv_order
    ON public.store_conversations (buyer_id, vendor_profile_id, order_id) WHERE order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_store_conv_general
    ON public.store_conversations (buyer_id, vendor_profile_id) WHERE order_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_store_conv_vendor ON public.store_conversations (vendor_profile_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_conv_buyer  ON public.store_conversations (buyer_id, last_message_at DESC);

-- ─── Mensajes ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.store_messages (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES public.store_conversations(id) ON DELETE CASCADE,
    sender_id       uuid NOT NULL REFERENCES auth.users(id),
    body            text NOT NULL CHECK (length(btrim(body)) > 0),
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_store_messages_conv ON public.store_messages (conversation_id, created_at);

-- ─── RLS: solo participantes (comprador o vendedor del hilo) ──────────────────
ALTER TABLE public.store_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_messages      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS store_conv_read ON public.store_conversations;
CREATE POLICY store_conv_read ON public.store_conversations
    FOR SELECT TO authenticated
    USING (buyer_id = auth.uid() OR public.is_store_vendor(vendor_profile_id));

DROP POLICY IF EXISTS store_conv_insert ON public.store_conversations;
CREATE POLICY store_conv_insert ON public.store_conversations
    FOR INSERT TO authenticated
    WITH CHECK (buyer_id = auth.uid());   -- el comprador inicia el hilo

DROP POLICY IF EXISTS store_conv_update ON public.store_conversations;
CREATE POLICY store_conv_update ON public.store_conversations
    FOR UPDATE TO authenticated
    USING (buyer_id = auth.uid() OR public.is_store_vendor(vendor_profile_id))
    WITH CHECK (buyer_id = auth.uid() OR public.is_store_vendor(vendor_profile_id));

DROP POLICY IF EXISTS store_msg_read ON public.store_messages;
CREATE POLICY store_msg_read ON public.store_messages
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.store_conversations c
         WHERE c.id = store_messages.conversation_id
           AND (c.buyer_id = auth.uid() OR public.is_store_vendor(c.vendor_profile_id))
    ));

DROP POLICY IF EXISTS store_msg_insert ON public.store_messages;
CREATE POLICY store_msg_insert ON public.store_messages
    FOR INSERT TO authenticated
    WITH CHECK (
        sender_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.store_conversations c
             WHERE c.id = store_messages.conversation_id
               AND (c.buyer_id = auth.uid() OR public.is_store_vendor(c.vendor_profile_id))
        )
    );

GRANT SELECT, INSERT, UPDATE ON public.store_conversations TO authenticated;
GRANT SELECT, INSERT         ON public.store_messages      TO authenticated;

-- ─── Trigger: al enviar, bump last_message_at + no-leídos del receptor ────────
CREATE OR REPLACE FUNCTION public.bump_store_conversation()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_buyer uuid;
BEGIN
    SELECT buyer_id INTO v_buyer FROM public.store_conversations WHERE id = NEW.conversation_id;
    UPDATE public.store_conversations
       SET last_message_at = NEW.created_at,
           updated_at      = now(),
           buyer_unread    = buyer_unread  + CASE WHEN NEW.sender_id = v_buyer THEN 0 ELSE 1 END,
           vendor_unread   = vendor_unread + CASE WHEN NEW.sender_id = v_buyer THEN 1 ELSE 0 END
     WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_store_conversation ON public.store_messages;
CREATE TRIGGER trg_bump_store_conversation
    AFTER INSERT ON public.store_messages
    FOR EACH ROW EXECUTE FUNCTION public.bump_store_conversation();

NOTIFY pgrst, 'reload config';
