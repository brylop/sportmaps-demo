-- =============================================================================
-- 20260825114534_support_tickets_s0.sql
-- Autor: brylop   Fecha: 2026-08-25   Versión anterior: 20260824182235
-- Objetivo: Soporte in-app S0 (MOD-21) — canal de soporte real sin una línea
-- de LLM todavía: el usuario escribe desde la app, le llega al super_admin,
-- el super_admin responde en el mismo hilo. El bot (S1) es una optimización
-- encima, no el producto — ver docs/specs/soporte-in-app-chat-y-bot.md y
-- docs/plan-soporte-s0-migracion.md (plan aprobado, con 2 decisiones):
--
--   1. Un mensaje nuevo sobre un ticket resuelto/cerrado NO lo reabre.
--      support_open_ticket() ya resuelve esto solo: el índice único parcial
--      solo mira tickets NOT IN ('resolved','closed'), así que si el único
--      hilo previo está cerrado, el INSERT no compite con nada y nace un
--      ticket nuevo. support_post_message() además bloquea explícitamente
--      que un USUARIO escriba sobre un ticket ya resuelto/cerrado (el agente
--      sí puede, para reabrir a propósito) — fuerza a pasar por
--      support_open_ticket() de nuevo, que es lo que da el ticket nuevo.
--   2. requester_id → profiles(id) ON DELETE CASCADE: las eliminaciones de
--      perfil aquí son manuales y deliberadas, y un ticket sin solicitante
--      no le sirve a nadie.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

-- ============================================================
-- 1. support_tickets
-- ============================================================
CREATE TABLE public.support_tickets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- QUIÉN atiende. En v1 solo se produce 'sportmaps'; 'school' queda como
  -- gancho para delegar al school_admin agregando policies, no migrando datos.
  audience      text NOT NULL DEFAULT 'sportmaps'
                CHECK (audience IN ('sportmaps', 'school')),
  school_id     uuid REFERENCES public.schools(id) ON DELETE SET NULL,

  -- Canal de ORIGEN, no partición del hilo (S4 lo unificará más adelante).
  channel       text NOT NULL DEFAULT 'in_app'
                CHECK (channel IN ('in_app', 'whatsapp', 'email')),
  whatsapp_conversation_id uuid REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL,

  subject       text,
  status        text NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','bot_handled','waiting_human','waiting_user','resolved','closed')),
  category      text CHECK (category IN ('acceso','cobros','inscripcion','datos','otro')),
  priority      text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),

  assignee_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  first_response_at timestamptz,
  resolved_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- audience='school' sin escuela es un ticket que nadie puede atender.
  CONSTRAINT support_tickets_school_required
    CHECK (audience <> 'school' OR school_id IS NOT NULL)
);

-- Un solo hilo ABIERTO por persona y destinatario (spec §4.1). Si el único
-- hilo previo quedó resuelto/cerrado, este índice deja de mirarlo y el
-- próximo support_open_ticket() crea uno nuevo sin conflicto.
CREATE UNIQUE INDEX support_tickets_one_open_thread
  ON public.support_tickets (
    requester_id, audience,
    COALESCE(school_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE status NOT IN ('resolved', 'closed');

-- La bandeja del super_admin: sin asignar primero, luego lo más viejo.
CREATE INDEX support_tickets_inbox
  ON public.support_tickets (audience, status, created_at)
  WHERE status NOT IN ('resolved', 'closed');

COMMENT ON TABLE public.support_tickets IS
  'Soporte in-app S0/MOD-21. Un hilo por (requester_id, audience, school_id) mientras esté abierto.';

-- ============================================================
-- 2. support_messages
-- ============================================================
CREATE TABLE public.support_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_type   text NOT NULL CHECK (author_type IN ('user','bot','agent')),
  author_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,  -- NULL si bot
  body          text NOT NULL CHECK (length(btrim(body)) > 0),
  attachments   jsonb NOT NULL DEFAULT '[]'::jsonb,
  internal_note boolean NOT NULL DEFAULT false,   -- el solicitante NO lo ve
  created_at    timestamptz NOT NULL DEFAULT now(),

  -- Un mensaje del usuario nunca puede ser nota interna, y un mensaje de
  -- usuario o agente siempre tiene autor. Sin esto, un bug de la UI filtra
  -- notas al padre.
  CONSTRAINT support_messages_user_never_internal
    CHECK (author_type <> 'user' OR internal_note = false),
  CONSTRAINT support_messages_author_required
    CHECK (author_type = 'bot' OR author_id IS NOT NULL)
);

CREATE INDEX support_messages_thread ON public.support_messages (ticket_id, created_at);

COMMENT ON TABLE public.support_messages IS
  'Mensajes de un hilo de support_tickets. Sin INSERT/UPDATE/DELETE por policy: todo entra por support_post_message().';

-- ============================================================
-- 3. Helpers de RLS
--
-- is_super_admin() existente NO sirve aquí: devuelve true para
-- role IN ('admin','super_admin') y hay cuentas 'admin' en la base
-- (spiritfontibon@…, demo.admin@…) que NO deben recibir tickets. Mismo
-- escape hatch que ya obligó a requireSuperAdminStrict en el BFF de F0.
-- No se toca is_super_admin(): hay policies vivas que dependen de ella.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_support_agent()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'   -- por ROL, nunca por UUID
  );
$$;

REVOKE ALL ON FUNCTION public.is_support_agent() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_support_agent() TO authenticated;

-- La policy sobre support_messages NO puede hacer SELECT FROM support_messages
-- en su USING (self-recursion). Resuelve la pertenencia mirando support_tickets,
-- desde una SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.owns_support_ticket(p_ticket_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.support_tickets
    WHERE id = p_ticket_id AND requester_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.owns_support_ticket(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_support_ticket(uuid) TO authenticated;

-- ============================================================
-- 4. RLS
-- ============================================================
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- support_tickets: SELECT propio + SELECT/UPDATE de agente. Sin policy de
-- INSERT (nace por RPC, para que audience/assignee_id/requester_id nunca
-- los ponga el cliente) y sin UPDATE para el solicitante (cerrar el propio
-- ticket es un RPC acotado si hace falta, no un UPDATE libre).
CREATE POLICY tickets_select_own ON public.support_tickets
  FOR SELECT TO authenticated
  USING (requester_id = auth.uid());

CREATE POLICY tickets_select_agent ON public.support_tickets
  FOR SELECT TO authenticated
  USING (public.is_support_agent());

CREATE POLICY tickets_update_agent ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (public.is_support_agent())
  WITH CHECK (public.is_support_agent());

-- support_messages: SELECT propio (sin notas internas) + SELECT de agente
-- (todo). Sin INSERT/UPDATE/DELETE por policy: todo mensaje entra por
-- support_post_message().
CREATE POLICY messages_select_own ON public.support_messages
  FOR SELECT TO authenticated
  USING (public.owns_support_ticket(ticket_id) AND internal_note = false);

CREATE POLICY messages_select_agent ON public.support_messages
  FOR SELECT TO authenticated
  USING (public.is_support_agent());

-- ============================================================
-- 5. RPCs
-- ============================================================

-- support_open_ticket — devuelve el hilo abierto del solicitante o crea uno.
-- Idempotente: INSERT ... ON CONFLICT contra el índice parcial cierra la
-- carrera de doble-click (dos peticiones simultáneas devuelven el mismo id).
CREATE OR REPLACE FUNCTION public.support_open_ticket(
  p_subject  text DEFAULT NULL,
  p_category text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_requester_id uuid := auth.uid();
  v_school_id    uuid;
  v_ticket_id    uuid;
BEGIN
  IF v_requester_id IS NULL THEN
    RAISE EXCEPTION 'support_open_ticket requiere una sesión autenticada';
  END IF;

  IF p_category IS NOT NULL AND p_category NOT IN ('acceso','cobros','inscripcion','datos','otro') THEN
    RAISE EXCEPTION 'categoría inválida: %', p_category;
  END IF;

  -- Informativo únicamente (para que el agente sepa de qué club viene);
  -- NO cambia audience, que en v1 es siempre 'sportmaps'.
  SELECT sm.school_id INTO v_school_id
  FROM public.school_members sm
  WHERE sm.profile_id = v_requester_id AND sm.status = 'active'
  ORDER BY sm.joined_at DESC NULLS LAST
  LIMIT 1;

  INSERT INTO public.support_tickets (requester_id, audience, school_id, channel, subject, category)
  VALUES (v_requester_id, 'sportmaps', v_school_id, 'in_app', p_subject, p_category)
  ON CONFLICT (requester_id, audience, COALESCE(school_id, '00000000-0000-0000-0000-000000000000'::uuid))
    WHERE status NOT IN ('resolved', 'closed')
  DO UPDATE SET updated_at = now()
  RETURNING id INTO v_ticket_id;

  RETURN v_ticket_id;
END;
$$;

REVOKE ALL ON FUNCTION public.support_open_ticket(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_open_ticket(text, text) TO authenticated;

-- support_post_message — escribe un mensaje y mueve el estado del ticket.
-- author_type lo decide el servidor (nunca el cliente): 'agent' si
-- is_support_agent(), si no 'user'. p_internal se ignora si el autor no
-- es agente. Un mensaje de usuario sobre un ticket ya resuelto/cerrado se
-- rechaza a propósito (decisión #1 del header): el cliente debe llamar de
-- nuevo a support_open_ticket(), que abre un ticket nuevo sin ensuciar las
-- métricas de resolución del viejo.
CREATE OR REPLACE FUNCTION public.support_post_message(
  p_ticket_id uuid,
  p_body      text,
  p_internal  boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid         uuid := auth.uid();
  v_is_agent    boolean;
  v_author_type text;
  v_status      text;
  v_message_id  uuid;
  v_new_status  text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'support_post_message requiere una sesión autenticada';
  END IF;

  v_is_agent := public.is_support_agent();

  IF NOT v_is_agent AND NOT public.owns_support_ticket(p_ticket_id) THEN
    RAISE EXCEPTION 'No tienes acceso a este ticket de soporte';
  END IF;

  SELECT status INTO v_status FROM public.support_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Ticket de soporte inexistente';
  END IF;

  IF NOT v_is_agent AND v_status IN ('resolved', 'closed') THEN
    RAISE EXCEPTION 'Este ticket ya está % — abre uno nuevo con support_open_ticket()', v_status
      USING ERRCODE = 'check_violation';
  END IF;

  v_author_type := CASE WHEN v_is_agent THEN 'agent' ELSE 'user' END;

  INSERT INTO public.support_messages (ticket_id, author_type, author_id, body, internal_note)
  VALUES (p_ticket_id, v_author_type, v_uid, p_body, (v_is_agent AND p_internal))
  RETURNING id INTO v_message_id;

  -- Notas internas no mueven el estado ni sellan first_response_at: son
  -- para el equipo, el solicitante ni las ve (RLS).
  IF v_is_agent AND p_internal THEN
    RETURN v_message_id;
  END IF;

  v_new_status := CASE WHEN v_is_agent THEN 'waiting_user' ELSE 'waiting_human' END;

  UPDATE public.support_tickets
  SET
    status = v_new_status,
    updated_at = now(),
    first_response_at = CASE WHEN v_is_agent THEN COALESCE(first_response_at, now()) ELSE first_response_at END
  WHERE id = p_ticket_id;

  RETURN v_message_id;
END;
$$;

REVOKE ALL ON FUNCTION public.support_post_message(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_post_message(uuid, text, boolean) TO authenticated;

COMMIT;
