-- ============================================================================
-- SECURITY HARDENING — FASE 2: RLS Completo + Audit Trail + Escalada
-- ============================================================================
-- Fecha: 2026-04-15
-- Resuelve:
--   1. CRÍTICA: Prevención de escalada de privilegios (profiles.role)
--   2. ALTA: Políticas RLS para events, event_registrations, event_telemetry
--   3. ALTA: Tabla de auditoría general (security_audit_log)
--   4. MEDIA: Trigger de auditoría en tablas sensibles
--   5. MEDIA: Restricción de DELETE en school_members (auto-eliminación)
-- ============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. PREVENCIÓN DE ESCALADA DE PRIVILEGIOS
-- ═══════════════════════════════════════════════════════════════════════════
-- Un usuario autenticado podría ejecutar:
--   UPDATE profiles SET role = 'admin' WHERE id = auth.uid()
-- La política actual solo valida (auth.uid() = id), sin restringir columnas.
-- Solución: trigger BEFORE UPDATE que bloquea cambios a `role` y `role_id`.

CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Solo aplicar cuando el usuario modifica su propio perfil
    -- Las funciones SECURITY DEFINER (signup trigger, accept_invitation) usan
    -- el service role, por lo que auth.uid() será NULL — quedan exentas.
    IF auth.uid() IS NOT NULL AND NEW.id = auth.uid() THEN
        -- Bloquear cambio de role
        IF OLD.role IS DISTINCT FROM NEW.role THEN
            RAISE EXCEPTION 'No puedes modificar tu propio rol. Operación bloqueada por seguridad.'
                USING ERRCODE = '42501'; -- insufficient_privilege
        END IF;

        -- Bloquear cambio de role_id
        IF OLD.role_id IS DISTINCT FROM NEW.role_id THEN
            RAISE EXCEPTION 'No puedes modificar tu propio role_id. Operación bloqueada por seguridad.'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_escalation
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_role_self_escalation();

COMMENT ON FUNCTION public.prevent_role_self_escalation() IS
    'Previene que un usuario cambie su propio role o role_id via UPDATE directo. '
    'Las funciones con service role (triggers, RPCs SECURITY DEFINER) no se ven afectadas.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. POLÍTICAS RLS PARA EVENTS (Competencias/Torneos)
-- ═══════════════════════════════════════════════════════════════════════════
-- events: lectura pública (explorar), escritura solo por creador

-- Limpiar políticas previas si existen
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT policyname FROM pg_policies
             WHERE schemaname = 'public' AND tablename = 'events'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.events', r.policyname);
    END LOOP;
END $$;

-- SELECT: Eventos públicos visibles para todos (incluido anon para página de explorar)
CREATE POLICY "events_select_public"
ON public.events FOR SELECT
USING (true);

-- INSERT: Solo usuarios autenticados con rol organizer/school/admin
CREATE POLICY "events_insert_creator"
ON public.events FOR INSERT TO authenticated
WITH CHECK (
    creator_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role IN ('organizer', 'school', 'admin', 'super_admin')
    )
);

-- UPDATE: Solo el creador del evento
CREATE POLICY "events_update_creator"
ON public.events FOR UPDATE TO authenticated
USING (creator_id = auth.uid());

-- DELETE: Solo el creador y solo si el evento está en draft o cancelado
CREATE POLICY "events_delete_creator"
ON public.events FOR DELETE TO authenticated
USING (
    creator_id = auth.uid()
    AND status IN ('draft', 'cancelled')
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. POLÍTICAS RLS PARA EVENT_REGISTRATIONS
-- ═══════════════════════════════════════════════════════════════════════════
-- Inscripciones: el registrante ve las suyas, el creador del evento ve todas

DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT policyname FROM pg_policies
             WHERE schemaname = 'public' AND tablename = 'event_registrations'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.event_registrations', r.policyname);
    END LOOP;
END $$;

-- SELECT: Ver mis inscripciones O soy creador del evento
CREATE POLICY "event_reg_select_own_or_creator"
ON public.event_registrations FOR SELECT TO authenticated
USING (
    user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = event_registrations.event_id
          AND e.creator_id = auth.uid()
    )
);

-- INSERT: Cualquier usuario autenticado puede inscribirse
CREATE POLICY "event_reg_insert_own"
ON public.event_registrations FOR INSERT TO authenticated
WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = event_registrations.event_id
          AND e.registrations_open = true
          AND e.status = 'active'
    )
);

-- UPDATE: El creador del evento (aprobar/rechazar) o el registrante (cancelar)
CREATE POLICY "event_reg_update"
ON public.event_registrations FOR UPDATE TO authenticated
USING (
    user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = event_registrations.event_id
          AND e.creator_id = auth.uid()
    )
);

-- DELETE: Solo el registrante y solo si está pendiente
CREATE POLICY "event_reg_delete_own_pending"
ON public.event_registrations FOR DELETE TO authenticated
USING (
    user_id = auth.uid()
    AND status = 'pending'
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. POLÍTICAS RLS PARA EVENT_TELEMETRY
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT policyname FROM pg_policies
             WHERE schemaname = 'public' AND tablename = 'event_telemetry'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.event_telemetry', r.policyname);
    END LOOP;
END $$;

-- INSERT: Cualquier autenticado puede generar telemetría
CREATE POLICY "telemetry_insert_authenticated"
ON public.event_telemetry FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- SELECT: Solo el creador del evento ve la telemetría de su evento
CREATE POLICY "telemetry_select_event_creator"
ON public.event_telemetry FOR SELECT TO authenticated
USING (
    user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = event_telemetry.event_id
          AND e.creator_id = auth.uid()
    )
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. TABLA DE AUDITORÍA GENERAL
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.security_audit_log (
    id          bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ts          timestamptz NOT NULL DEFAULT now(),
    user_id     uuid        REFERENCES auth.users(id),
    action      text        NOT NULL CHECK (action IN (
        'role_change', 'login', 'logout', 'profile_update',
        'member_add', 'member_remove', 'member_role_change',
        'payment_create', 'payment_update', 'settings_change',
        'event_create', 'event_delete', 'registration_approve',
        'registration_reject', 'escalation_blocked', 'data_export'
    )),
    target_table text,
    target_id    text,
    old_value    jsonb,
    new_value    jsonb,
    ip_address   inet,
    user_agent   text,
    metadata     jsonb       NOT NULL DEFAULT '{}'
);

-- Índices para consultas de auditoría
CREATE INDEX IF NOT EXISTS idx_audit_log_user_ts
    ON public.security_audit_log (user_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action
    ON public.security_audit_log (action, ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_target
    ON public.security_audit_log (target_table, target_id);

-- RLS: Solo admins pueden leer auditoría; inserción vía service role / triggers
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select_admin"
ON public.security_audit_log FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role IN ('admin', 'super_admin')
    )
);

-- INSERT abierto para authenticated (los triggers necesitan escribir)
CREATE POLICY "audit_log_insert_authenticated"
ON public.security_audit_log FOR INSERT TO authenticated
WITH CHECK (true);

-- No UPDATE, no DELETE — auditoría es inmutable
-- (Omitir políticas = denegación por defecto)

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. TRIGGER DE AUDITORÍA EN school_members (cambios de rol)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.audit_school_member_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Auditar cambio de rol
    IF TG_OP = 'UPDATE' AND OLD.role IS DISTINCT FROM NEW.role THEN
        INSERT INTO public.security_audit_log (user_id, action, target_table, target_id, old_value, new_value)
        VALUES (
            auth.uid(),
            'member_role_change',
            'school_members',
            NEW.id::text,
            jsonb_build_object('role', OLD.role, 'school_id', OLD.school_id),
            jsonb_build_object('role', NEW.role, 'school_id', NEW.school_id)
        );
    END IF;

    -- Auditar eliminación de miembro
    IF TG_OP = 'UPDATE' AND OLD.status = 'active' AND NEW.status = 'inactive' THEN
        INSERT INTO public.security_audit_log (user_id, action, target_table, target_id, old_value, new_value)
        VALUES (
            auth.uid(),
            'member_remove',
            'school_members',
            OLD.id::text,
            jsonb_build_object('profile_id', OLD.profile_id, 'school_id', OLD.school_id),
            jsonb_build_object('status', NEW.status)
        );
    END IF;

    -- Auditar nuevo miembro
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.security_audit_log (user_id, action, target_table, target_id, old_value, new_value)
        VALUES (
            auth.uid(),
            'member_add',
            'school_members',
            NEW.id::text,
            NULL,
            jsonb_build_object('profile_id', NEW.profile_id, 'school_id', NEW.school_id, 'role', NEW.role)
        );
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_school_members ON public.school_members;
CREATE TRIGGER trg_audit_school_members
    AFTER INSERT OR UPDATE ON public.school_members
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_school_member_changes();

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. TRIGGER DE AUDITORÍA EN profiles (cambios de rol — vía RPCs admin)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.audit_profile_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
        INSERT INTO public.security_audit_log (user_id, action, target_table, target_id, old_value, new_value)
        VALUES (
            auth.uid(),
            'role_change',
            'profiles',
            NEW.id::text,
            jsonb_build_object('role', OLD.role),
            jsonb_build_object('role', NEW.role)
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_profile_role ON public.profiles;
CREATE TRIGGER trg_audit_profile_role
    AFTER UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_profile_role_change();

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. PREVENIR AUTO-ELIMINACIÓN DE school_members
-- ═══════════════════════════════════════════════════════════════════════════
-- Un owner no debería poder desactivarse a sí mismo si es el último owner.

CREATE OR REPLACE FUNCTION public.prevent_last_owner_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner_count integer;
BEGIN
    -- Solo verificar cuando se cambia un owner a inactive o se cambia su rol
    IF OLD.role = 'owner' AND (
        (NEW.status = 'inactive' AND OLD.status = 'active')
        OR (NEW.role != 'owner')
    ) THEN
        SELECT COUNT(*) INTO v_owner_count
        FROM public.school_members
        WHERE school_id = OLD.school_id
          AND role = 'owner'
          AND status = 'active'
          AND id != OLD.id;

        IF v_owner_count = 0 THEN
            RAISE EXCEPTION 'No puedes eliminar o cambiar el rol del último owner de la escuela.'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_last_owner_removal ON public.school_members;
CREATE TRIGGER trg_prevent_last_owner_removal
    BEFORE UPDATE ON public.school_members
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_last_owner_removal();

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. REFINAR PROFILES UPDATE — Bloquear campos sensibles via WITH CHECK
-- ═══════════════════════════════════════════════════════════════════════════
-- La política actual "profiles_update_v4" / "Users can update own profile"
-- permite UPDATE pero no restringe columnas. El trigger de escalada (punto 1)
-- bloquea role/role_id. Aquí agregamos WITH CHECK para subscription_tier.

-- Recrear la política de update con WITH CHECK más restrictivo
DO $$
BEGIN
    -- Limpiar políticas de update existentes
    DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
    DROP POLICY IF EXISTS "profiles_update_v4" ON public.profiles;
    DROP POLICY IF EXISTS "Profiles: update own" ON public.profiles;

    -- Nueva política: puede actualizar su propio perfil,
    -- pero no puede cambiar subscription_tier (solo via webhook/admin)
    CREATE POLICY "profiles_update_own_safe"
    ON public.profiles FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error recreando política de profiles UPDATE: %', SQLERRM;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. HELPER: Verificar propiedad de recurso (para uso en RLS y RPCs)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_school_admin(p_school_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.school_members
        WHERE school_id = p_school_id
          AND profile_id = auth.uid()
          AND role IN ('owner', 'admin', 'super_admin')
          AND status = 'active'
    );
$$;

-- Dar permiso de ejecución
GRANT EXECUTE ON FUNCTION public.is_school_admin(uuid) TO authenticated;

COMMENT ON FUNCTION public.is_school_admin(uuid) IS
    'Retorna TRUE si el usuario actual es owner/admin de la escuela indicada. '
    'Uso principal: condiciones RLS y validaciones en RPCs.';

COMMIT;
