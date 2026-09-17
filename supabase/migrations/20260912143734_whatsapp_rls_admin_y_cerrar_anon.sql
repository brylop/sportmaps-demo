-- ============================================================================
-- WhatsApp: que vea el ADMINISTRADOR, no solo el dueño — y cerrar `anon`
--
-- Dos deudas de WA1 que salieron al ir a construir la pantalla de la escuela.
--
-- 1. Todas las policies filtraban por `schools.owner_id = auth.uid()`. O sea que
--    solo el DUEÑO veía: un administrador que no fuera el dueño abría la
--    pantalla y la encontraba vacía — chats, borradores, configuración, todo.
--    La excepción era `whatsapp_inbound_queue`, que ya usa `is_school_admin()`;
--    el spec de la cola la señaló como el modelo a seguir. Esto lo aplica al
--    resto.
--
--    Radio medido antes de tocar: 368 escuelas, 69 administradores activos, y
--    solo 2 escuelas con un admin que no es el dueño — 5 personas que hoy no ven
--    nada y pasarán a ver lo de SU escuela. Nadie pierde acceso.
--
-- 2. Seis de las ocho tablas de WhatsApp tenían GRANT a `anon`. Hoy no filtran
--    —ninguna policy alcanza a `anon`, así que RLS deniega— pero es la trampa 3
--    del CLAUDE.md: los default privileges del esquema se los dan a cada tabla
--    nueva, `REVOKE ... FROM PUBLIC` no los quita, y basta una policy permisiva
--    futura para que se abra. Es lo mismo que se cerró en la cola.
--
--    `whatsapp_identifications` es la que más urge: guarda correos y hashes de
--    OTP.
-- ============================================================================

-- ── 1. Cerrar `anon` en las seis que faltaban ───────────────────────────────
REVOKE ALL ON public.whatsapp_blocked_numbers  FROM anon;
REVOKE ALL ON public.whatsapp_conversations    FROM anon;
REVOKE ALL ON public.whatsapp_identifications  FROM anon;
REVOKE ALL ON public.whatsapp_message_drafts   FROM anon;
REVOKE ALL ON public.whatsapp_messages         FROM anon;
REVOKE ALL ON public.whatsapp_settings         FROM anon;

REVOKE ALL ON public.whatsapp_blocked_numbers  FROM PUBLIC;
REVOKE ALL ON public.whatsapp_conversations    FROM PUBLIC;
REVOKE ALL ON public.whatsapp_identifications  FROM PUBLIC;
REVOKE ALL ON public.whatsapp_message_drafts   FROM PUBLIC;
REVOKE ALL ON public.whatsapp_messages         FROM PUBLIC;
REVOKE ALL ON public.whatsapp_settings         FROM PUBLIC;

-- ── 2. Que vea el administrador ─────────────────────────────────────────────
-- `whatsapp_identifications` y `whatsapp_blocked_numbers` NO se tocan: sus
-- policies son `USING (false)` a propósito. La primera guarda hashes de OTP y
-- correos; la segunda es el kill-switch. Ninguna de las dos se lee desde la app.

DROP POLICY IF EXISTS "wa_conv_owner_select" ON public.whatsapp_conversations;
CREATE POLICY "wa_conv_admin_select" ON public.whatsapp_conversations
    FOR SELECT TO authenticated
    USING (public.is_school_admin(school_id));

-- Mensajes y borradores no tienen `school_id`: se resuelven por la conversación.
-- La subconsulta evalúa `is_school_admin` una vez por CONVERSACIÓN, no por
-- mensaje, que es la diferencia entre una pantalla que abre y una que da timeout.
DROP POLICY IF EXISTS "wa_msg_owner_select" ON public.whatsapp_messages;
CREATE POLICY "wa_msg_admin_select" ON public.whatsapp_messages
    FOR SELECT TO authenticated
    USING (conversation_id IN (
        SELECT c.id FROM public.whatsapp_conversations c
        WHERE public.is_school_admin(c.school_id)
    ));

DROP POLICY IF EXISTS "wa_drafts_owner_select" ON public.whatsapp_message_drafts;
CREATE POLICY "wa_drafts_admin_select" ON public.whatsapp_message_drafts
    FOR SELECT TO authenticated
    USING (conversation_id IN (
        SELECT c.id FROM public.whatsapp_conversations c
        WHERE public.is_school_admin(c.school_id)
    ));

DROP POLICY IF EXISTS "wa_settings_owner_select" ON public.whatsapp_settings;
CREATE POLICY "wa_settings_admin_select" ON public.whatsapp_settings
    FOR SELECT TO authenticated
    USING (integration_id IN (
        SELECT i.id FROM public.school_whatsapp_integrations i
        WHERE public.is_school_admin(i.school_id)
    ));

DROP POLICY IF EXISTS "wa_optin_owner_select" ON public.whatsapp_optins;
CREATE POLICY "wa_optin_admin_select" ON public.whatsapp_optins
    FOR SELECT TO authenticated
    USING (public.is_school_admin(school_id));

-- ── 3. La policy de la cola, a `authenticated` ──────────────────────────────
-- Estaba `TO public`, que incluye a `anon`. Hoy no se explota porque `anon` no
-- tiene GRANT sobre esa tabla, pero apuntar una policy a `public` es la clase de
-- detalle que deja de ser inofensivo en cuanto alguien agrega un GRANT.
DROP POLICY IF EXISTS "wa_queue_admin_select" ON public.whatsapp_inbound_queue;
CREATE POLICY "wa_queue_admin_select" ON public.whatsapp_inbound_queue
    FOR SELECT TO authenticated
    USING (public.is_school_admin(school_id));

-- Las policies de INSERT `WITH CHECK (false)` se conservan tal cual: niegan la
-- escritura directa de forma EXPLÍCITA, no por ausencia de policy (invariante I3).
