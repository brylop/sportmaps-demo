-- ============================================================
-- MIGRACIÓN: RPC notify_user
-- Proyecto: SportMaps (luebjarufsiadojhvxgi)
-- Fecha: 2026-02-25
-- Motivo: PaymentModal y PaymentsAutomationPage necesitan
-- notificar a otros usuarios (school owner, parent) desde
-- el cliente de forma segura sin abrir INSERT directo en RLS.
--
-- CASOS DE USO:
--   1. PaymentModal.tsx L206 → notifica al owner de la escuela
--   2. PaymentsAutomationPage.tsx L335 → notifica al padre
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_user(
  p_user_id uuid,
  p_title   text,
  p_message text,
  p_type    text  DEFAULT 'info',
  p_link    text  DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Requiere usuario autenticado
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  -- Solo permite notificar a otro usuario si el emisor
  -- es admin de alguna escuela en común, o si el receptor
  -- es el propio usuario (delegando a send_notification sería
  -- más limpio, pero aquí lo unificamos)
  --
  -- Validación: el emisor debe ser admin de una escuela
  -- o el receptor debe ser el propio usuario
  IF p_user_id != auth.uid() THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.school_members
      WHERE profile_id = auth.uid()
      AND role IN ('owner', 'admin', 'admin')
      AND status = 'active'
    ) AND NOT EXISTS (
      -- El receptor es parent de un hijo en una escuela
      -- donde el emisor es admin
      SELECT 1 FROM public.children c
      JOIN public.school_members sm ON sm.school_id = c.school_id
      WHERE c.parent_id = p_user_id
      AND sm.profile_id = auth.uid()
      AND sm.role IN ('owner', 'admin', 'admin')
      AND sm.status = 'active'
    ) AND NOT EXISTS (
      -- El receptor es owner de una escuela donde el emisor
      -- es miembro (caso: padre notifica al owner al pagar)
      SELECT 1 FROM public.schools
      WHERE owner_id = p_user_id
      AND id IN (
        SELECT school_id FROM public.school_members
        WHERE profile_id = auth.uid()
        AND status = 'active'
      )
    ) THEN
      RAISE EXCEPTION 'Sin permisos para notificar a este usuario';
    END IF;
  END IF;

  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    type,
    link
  ) VALUES (
    p_user_id,
    p_title,
    p_message,
    p_type,
    p_link
  );
END;
$$;

-- Permisos
GRANT EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text, text)
  TO authenticated;

REVOKE EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text, text)
  FROM anon;
