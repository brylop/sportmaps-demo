-- =========================================================================
-- Fix: 3 RLS policies con WITH CHECK (true) abren spam a endpoints publicos
-- =========================================================================
-- contact_messages / join_applications: endurecer con validacion de email
-- message_attachments: requerir que el usuario sea el sender del mensaje
-- =========================================================================


-- =========================================================================
-- 1. contact_messages: formulario de contacto publico
--    Antes: WITH CHECK (true) -> cualquiera spamea
--    Ahora: email valido, nombre/subject/message no vacios, longitudes razonables
-- =========================================================================
DROP POLICY IF EXISTS contact_messages_insert_public ON public.contact_messages;

CREATE POLICY contact_messages_insert_public
  ON public.contact_messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
        email   ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
    AND length(trim(name))    BETWEEN 2 AND 100
    AND length(trim(subject)) BETWEEN 3 AND 200
    AND length(trim(message)) BETWEEN 10 AND 2000
    AND status      = 'new'
    AND assigned_to IS NULL
  );


-- =========================================================================
-- 2. join_applications: aplicacion publica para unirse
-- =========================================================================
DROP POLICY IF EXISTS join_applications_insert_public ON public.join_applications;

CREATE POLICY join_applications_insert_public
  ON public.join_applications
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
        email   ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
    AND length(trim(full_name))  BETWEEN 2 AND 100
    AND length(trim(interests))  BETWEEN 3 AND 500
    AND length(trim(motivation)) BETWEEN 10 AND 1000
  );


-- =========================================================================
-- 3. message_attachments: solo el sender puede adjuntar a su propio mensaje
--    Antes: WITH CHECK (true) -> cualquiera adjunta a mensajes ajenos
--    Ahora: autenticado + dueno del message_id
-- =========================================================================
DROP POLICY IF EXISTS message_attachments_insert_public ON public.message_attachments;
DROP POLICY IF EXISTS message_attachments_insert_own    ON public.message_attachments;

CREATE POLICY message_attachments_insert_own
  ON public.message_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.messages m
       WHERE m.id = message_attachments.message_id
         AND m.sender_id = auth.uid()
    )
  );
