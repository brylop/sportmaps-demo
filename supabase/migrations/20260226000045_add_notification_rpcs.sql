-- 20260226_add_notification_rpcs.sql
-- Crea las funciones RPC para insertar notificaciones siguiendo las reglas RLS correspondientes.

CREATE OR REPLACE FUNCTION public.notify_user(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT,
  p_link TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (p_user_id, p_title, p_message, p_type, p_link);
END;
$$;

CREATE OR REPLACE FUNCTION public.send_notification(
  p_title TEXT,
  p_message TEXT,
  p_type TEXT,
  p_link TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (auth.uid(), p_title, p_message, p_type, p_link);
END;
$$;
