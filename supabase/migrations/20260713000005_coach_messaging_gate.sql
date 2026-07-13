-- ============================================================
-- SPORTMAPS — Gate real de "Coaches pueden enviar mensajes"
-- ------------------------------------------------------------
-- PROBLEMA:
--   school_settings.allow_coach_messaging ("Comunicación directa coach →
--   padres") se configuraba pero NADIE lo aplicaba: la policy de INSERT de
--   public.messages sólo exigía sender_id = auth.uid(), así que un coach
--   podía escribirle a cualquier padre sin importar el toggle.
--
-- QUÉ HACE:
--   Refuerza messages_insert_own con un guard fail-open: BLOQUEA el INSERT
--   sólo en el caso exacto en que el remitente es COACH activo de una escuela
--   (y NO admin/owner de ella), el destinatario es PADRE de un hijo de esa
--   MISMA escuela, y esa escuela tiene allow_coach_messaging = false.
--   En cualquier otro caso (admin↔padre, atleta↔coach, escuela↔padre, etc.)
--   el guard devuelve false y el mensaje pasa: no rompe la mensajería
--   existente ni el store chat / WhatsApp (tablas separadas).
--
-- NOTA: hoy no existe una UI de composición coach→padre; este gate deja la
--   regla lista y aplicada a nivel DB para cuando esa UI se construya.
-- Ver [[feedback_security_definer_grants]] (GRANT EXECUTE al caller).
-- Fecha: 2026-07-13
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_coach_parent_messaging_blocked(
    p_sender    uuid,
    p_recipient uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.school_members m
        JOIN public.school_settings ss ON ss.school_id = m.school_id
        WHERE m.profile_id = p_sender
          AND m.role       = 'coach'
          AND m.status     = 'active'
          AND ss.allow_coach_messaging IS FALSE
          -- Si el remitente además es admin/owner de esa escuela, NO se bloquea.
          AND NOT EXISTS (
              SELECT 1 FROM public.school_members ma
              WHERE ma.profile_id = p_sender
                AND ma.school_id  = m.school_id
                AND ma.role IN ('owner', 'admin')
                AND ma.status = 'active'
          )
          -- El destinatario es padre de un hijo de la MISMA escuela.
          AND EXISTS (
              SELECT 1 FROM public.children c
              WHERE c.parent_id = p_recipient
                AND c.school_id = m.school_id
          )
    );
$$;

COMMENT ON FUNCTION public.is_coach_parent_messaging_blocked(uuid, uuid) IS
    'TRUE sólo si un coach (no admin) intenta escribir a un padre de su escuela con allow_coach_messaging=false. Fail-open en cualquier otro caso.';

-- La policy invoca la función como el rol authenticated → necesita EXECUTE
-- aunque sea SECURITY DEFINER. Ver [[feedback_security_definer_grants]].
GRANT EXECUTE ON FUNCTION public.is_coach_parent_messaging_blocked(uuid, uuid) TO authenticated, service_role;

-- Reforzar la policy de INSERT de mensajes con el guard.
DROP POLICY IF EXISTS "messages_insert_own" ON public.messages;
CREATE POLICY "messages_insert_own" ON public.messages
    FOR INSERT
    WITH CHECK (
        sender_id = auth.uid()
        AND NOT public.is_coach_parent_messaging_blocked(auth.uid(), recipient_id)
    );

NOTIFY pgrst, 'reload schema';
