-- ============================================================
-- SPORTMAPS — Módulo de Dotación · Fase 1 (RPCs)
--
-- Toda mutación de stock (equipment_items.quantity_available / quantity_total)
-- ocurre EXCLUSIVAMENTE aquí, dentro de funciones SECURITY DEFINER con
-- SELECT ... FOR UPDATE. El frontend nunca hace UPDATE de stock.
--
-- Convenciones: SET search_path = pg_catalog, public, pg_temp + GRANT EXECUTE.
-- Notificaciones vía INSERT directo (la función es DEFINER y bypassea RLS).
-- Cero referencias a tablas del marketplace.
-- ============================================================

-- ─── Helper: autorización de coach activo ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public._equipment_is_active_coach(p_school_id uuid, p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.school_members sm
        WHERE sm.school_id = p_school_id
          AND sm.profile_id = p_profile_id
          AND sm.role = 'coach'
          AND sm.status = 'active'
    );
$$;

-- ─── Helper: folio correlativo "DOT-{SLUG}-{YYYY}-{NNNNN}" ─────────────────────
CREATE OR REPLACE FUNCTION public._next_equipment_folio(p_school_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_year  int := EXTRACT(year FROM CURRENT_DATE);
    v_count int;
    v_slug  text;
BEGIN
    SELECT COALESCE(slug, REPLACE(LOWER(name), ' ', '-')) INTO v_slug
    FROM public.schools WHERE id = p_school_id;

    SELECT COUNT(*) + 1 INTO v_count
    FROM public.equipment_assignments
    WHERE school_id = p_school_id
      AND acta_folio IS NOT NULL
      AND EXTRACT(year FROM created_at) = v_year;

    RETURN 'DOT-' || UPPER(SUBSTRING(COALESCE(v_slug, 'esc') FROM 1 FOR 8))
        || '-' || v_year::text
        || '-' || LPAD(v_count::text, 5, '0');
END;
$$;

-- ─── Helper: congelar snapshot + generar folio al activar ─────────────────────
CREATE OR REPLACE FUNCTION public._equipment_set_acta_fields(p_assignment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_a          record;
    v_snapshot   jsonb;
    v_folio      text;
BEGIN
    SELECT * INTO v_a FROM public.equipment_assignments WHERE id = p_assignment_id;

    v_snapshot := jsonb_build_object(
        'snapshot_at', now(),
        'school',  (SELECT jsonb_build_object('name', s.name, 'logo_url', s.logo_url, 'branding', s.branding_settings)
                    FROM public.schools s WHERE s.id = v_a.school_id),
        'branch',  (SELECT sb.name FROM public.school_branches sb WHERE sb.id = v_a.branch_id),
        'coach',   (SELECT jsonb_build_object('full_name', p.full_name, 'avatar_url', p.avatar_url)
                    FROM public.profiles p WHERE p.id = v_a.assigned_to),
        'item',    (SELECT jsonb_build_object('name', i.name, 'size', i.size, 'condition', i.condition)
                    FROM public.equipment_items i WHERE i.id = v_a.item_id),
        'quantity', v_a.quantity,
        'mode',     v_a.mode
    );

    v_folio := COALESCE(v_a.acta_folio, public._next_equipment_folio(v_a.school_id));

    UPDATE public.equipment_assignments
    SET content_snapshot = v_snapshot,
        acta_folio       = v_folio
    WHERE id = p_assignment_id;
END;
$$;

-- ─── Helper: notificar a los admin de una escuela ─────────────────────────────
CREATE OR REPLACE FUNCTION public._equipment_notify_admins(
    p_school_id uuid, p_title text, p_message text, p_link text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    SELECT sm.profile_id, p_title, p_message, 'info', p_link
    FROM public.school_members sm
    WHERE sm.school_id = p_school_id
      AND sm.role IN ('owner','admin')
      AND sm.status = 'active';
END;
$$;

-- ============================================================
-- CONFIG / ÍTEMS (admin)
-- ============================================================
CREATE OR REPLACE FUNCTION public.equipment_save_settings(
    p_school_id uuid,
    p_self_checkout_enabled boolean,
    p_require_photo_admin_mode boolean,
    p_default_return_days int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.equipment_settings (school_id, self_checkout_enabled, require_photo_admin_mode, default_return_days)
    VALUES (p_school_id, COALESCE(p_self_checkout_enabled,false), COALESCE(p_require_photo_admin_mode,false), p_default_return_days)
    ON CONFLICT (school_id) DO UPDATE
        SET self_checkout_enabled    = EXCLUDED.self_checkout_enabled,
            require_photo_admin_mode = EXCLUDED.require_photo_admin_mode,
            default_return_days      = EXCLUDED.default_return_days,
            updated_at               = now();
END;
$$;
GRANT EXECUTE ON FUNCTION public.equipment_save_settings(uuid, boolean, boolean, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.equipment_upsert_item(
    p_school_id uuid,
    p_name text,
    p_quantity_total int,
    p_id uuid DEFAULT NULL,
    p_branch_id uuid DEFAULT NULL,
    p_size text DEFAULT NULL,
    p_condition text DEFAULT 'nuevo',
    p_photo_url text DEFAULT NULL,
    p_self_checkout_override text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_id       uuid;
    v_reserved int;
BEGIN
    IF NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
    IF p_quantity_total < 0 THEN
        RAISE EXCEPTION 'quantity_total no puede ser negativo' USING ERRCODE = '22023';
    END IF;

    IF p_id IS NULL THEN
        -- Nuevo ítem: disponible = total
        INSERT INTO public.equipment_items (
            school_id, branch_id, name, size, quantity_total, quantity_available,
            condition, photo_url, self_checkout_override, created_by
        ) VALUES (
            p_school_id, p_branch_id, p_name, p_size, p_quantity_total, p_quantity_total,
            COALESCE(p_condition,'nuevo'), p_photo_url, p_self_checkout_override, auth.uid()
        )
        RETURNING id INTO v_id;
    ELSE
        -- Edición: recalcular disponible manteniendo lo ya reservado (out).
        SELECT (quantity_total - quantity_available) INTO v_reserved
        FROM public.equipment_items WHERE id = p_id AND school_id = p_school_id
        FOR UPDATE;
        IF v_reserved IS NULL THEN
            RAISE EXCEPTION 'Ítem no encontrado' USING ERRCODE = '02000';
        END IF;
        IF p_quantity_total < v_reserved THEN
            RAISE EXCEPTION 'quantity_total (%) menor que lo ya asignado (%)', p_quantity_total, v_reserved
                USING ERRCODE = '23514';
        END IF;

        UPDATE public.equipment_items
        SET name = p_name,
            branch_id = p_branch_id,
            size = p_size,
            quantity_total = p_quantity_total,
            quantity_available = p_quantity_total - v_reserved,
            condition = COALESCE(p_condition, condition),
            photo_url = COALESCE(p_photo_url, photo_url),
            self_checkout_override = p_self_checkout_override
        WHERE id = p_id AND school_id = p_school_id;
        v_id := p_id;
    END IF;

    RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.equipment_upsert_item(uuid, text, int, uuid, uuid, text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.equipment_soft_delete_item(p_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_school_id uuid;
BEGIN
    SELECT school_id INTO v_school_id FROM public.equipment_items WHERE id = p_item_id;
    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'Ítem no encontrado' USING ERRCODE = '02000';
    END IF;
    IF NOT (public.is_super_admin() OR public.is_school_admin(v_school_id)) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;

    UPDATE public.equipment_items SET is_active = false WHERE id = p_item_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.equipment_soft_delete_item(uuid) TO authenticated;

-- ============================================================
-- MODO A — Entrega por admin
-- ============================================================
CREATE OR REPLACE FUNCTION public.equipment_assign(
    p_item_id uuid,
    p_assigned_to uuid,
    p_quantity int,
    p_branch_id uuid DEFAULT NULL,
    p_return_due_at date DEFAULT NULL,
    p_note text DEFAULT NULL,
    p_photo_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_school_id uuid;
    v_avail     int;
    v_due       date;
    v_id        uuid;
BEGIN
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'quantity debe ser > 0' USING ERRCODE = '22023';
    END IF;

    -- Bloqueo del ítem (concurrencia)
    SELECT school_id, quantity_available INTO v_school_id, v_avail
    FROM public.equipment_items WHERE id = p_item_id AND is_active = true
    FOR UPDATE;
    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'Ítem no encontrado o inactivo' USING ERRCODE = '02000';
    END IF;
    IF NOT (public.is_super_admin() OR public.is_school_admin(v_school_id)) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
    IF NOT public._equipment_is_active_coach(v_school_id, p_assigned_to) THEN
        RAISE EXCEPTION 'El destinatario no es un entrenador activo de la escuela' USING ERRCODE = '42501';
    END IF;
    IF v_avail < p_quantity THEN
        RAISE EXCEPTION 'Stock insuficiente (disponible %, solicitado %)', v_avail, p_quantity USING ERRCODE = '23514';
    END IF;

    -- Reserva
    UPDATE public.equipment_items SET quantity_available = quantity_available - p_quantity WHERE id = p_item_id;

    v_due := p_return_due_at;
    IF v_due IS NULL THEN
        SELECT CASE WHEN default_return_days IS NOT NULL THEN CURRENT_DATE + default_return_days ELSE NULL END
        INTO v_due FROM public.equipment_settings WHERE school_id = v_school_id;
    END IF;

    INSERT INTO public.equipment_assignments (
        school_id, item_id, branch_id, assigned_to, assigned_by, mode, quantity,
        status, delivered_at, checkout_photo_url, checkout_note, return_due_at
    ) VALUES (
        v_school_id, p_item_id, p_branch_id, p_assigned_to, auth.uid(), 'admin_delivery', p_quantity,
        'pendiente_aceptacion', now(), p_photo_url, p_note, v_due
    )
    RETURNING id INTO v_id;

    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (p_assigned_to, 'Dotación asignada',
            'Tienes ' || p_quantity || ' unidad(es) por aceptar', 'info', '/coach/dotacion');

    RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.equipment_assign(uuid, uuid, int, uuid, date, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.equipment_accept(p_assignment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_a record;
BEGIN
    SELECT * INTO v_a FROM public.equipment_assignments WHERE id = p_assignment_id FOR UPDATE;
    IF v_a.id IS NULL THEN
        RAISE EXCEPTION 'Asignación no encontrada' USING ERRCODE = '02000';
    END IF;
    IF v_a.assigned_to <> auth.uid() THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
    IF v_a.status <> 'pendiente_aceptacion' THEN
        RAISE EXCEPTION 'La asignación no está pendiente de aceptación (estado %)', v_a.status USING ERRCODE = '22023';
    END IF;

    UPDATE public.equipment_assignments
    SET status = 'activa', accepted_at = now()
    WHERE id = p_assignment_id;

    PERFORM public._equipment_set_acta_fields(p_assignment_id);

    PERFORM public._equipment_notify_admins(v_a.school_id, 'Dotación aceptada',
        'El entrenador aceptó la asignación', '/school/dotacion');
END;
$$;
GRANT EXECUTE ON FUNCTION public.equipment_accept(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.equipment_report_difference(
    p_assignment_id uuid, p_reported_quantity int, p_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_a record;
BEGIN
    IF p_note IS NULL OR btrim(p_note) = '' THEN
        RAISE EXCEPTION 'La nota es obligatoria' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_a FROM public.equipment_assignments WHERE id = p_assignment_id FOR UPDATE;
    IF v_a.id IS NULL THEN
        RAISE EXCEPTION 'Asignación no encontrada' USING ERRCODE = '02000';
    END IF;
    IF v_a.assigned_to <> auth.uid() THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
    IF v_a.status <> 'pendiente_aceptacion' THEN
        RAISE EXCEPTION 'Solo se puede reportar diferencia antes de aceptar (estado %)', v_a.status USING ERRCODE = '22023';
    END IF;

    UPDATE public.equipment_assignments
    SET status = 'en_disputa', reported_quantity = p_reported_quantity, dispute_note = p_note
    WHERE id = p_assignment_id;

    PERFORM public._equipment_notify_admins(v_a.school_id, 'Diferencia reportada',
        'Un entrenador reportó una diferencia en la entrega', '/school/dotacion');
END;
$$;
GRANT EXECUTE ON FUNCTION public.equipment_report_difference(uuid, int, text) TO authenticated;

-- ============================================================
-- MODO B — Autoservicio
-- ============================================================
CREATE OR REPLACE FUNCTION public.equipment_self_checkout(
    p_item_id uuid,
    p_quantity int,
    p_photo_url text,
    p_branch_id uuid DEFAULT NULL,
    p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_school_id uuid;
    v_avail     int;
    v_override  text;
    v_global    boolean;
    v_allowed   boolean;
    v_id        uuid;
BEGIN
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'quantity debe ser > 0' USING ERRCODE = '22023';
    END IF;
    IF p_photo_url IS NULL OR btrim(p_photo_url) = '' THEN
        RAISE EXCEPTION 'La foto es obligatoria en autoservicio' USING ERRCODE = '22023';
    END IF;

    SELECT school_id, quantity_available, self_checkout_override
    INTO v_school_id, v_avail, v_override
    FROM public.equipment_items WHERE id = p_item_id AND is_active = true
    FOR UPDATE;
    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'Ítem no encontrado o inactivo' USING ERRCODE = '02000';
    END IF;
    IF NOT public._equipment_is_active_coach(v_school_id, auth.uid()) THEN
        RAISE EXCEPTION 'Solo entrenadores activos pueden usar autoservicio' USING ERRCODE = '42501';
    END IF;

    -- Efectivo: override del ítem manda; si no, la config global de la escuela.
    SELECT COALESCE(self_checkout_enabled, false) INTO v_global
    FROM public.equipment_settings WHERE school_id = v_school_id;
    v_allowed := CASE v_override
                    WHEN 'bloqueado' THEN false
                    WHEN 'permitido' THEN true
                    ELSE COALESCE(v_global, false)
                 END;
    IF NOT v_allowed THEN
        RAISE EXCEPTION 'Autoservicio no habilitado para este ítem' USING ERRCODE = '42501';
    END IF;

    IF v_avail < p_quantity THEN
        RAISE EXCEPTION 'Stock insuficiente (disponible %, solicitado %)', v_avail, p_quantity USING ERRCODE = '23514';
    END IF;

    UPDATE public.equipment_items SET quantity_available = quantity_available - p_quantity WHERE id = p_item_id;

    INSERT INTO public.equipment_assignments (
        school_id, item_id, branch_id, assigned_to, assigned_by, mode, quantity,
        status, delivered_at, checkout_photo_url, checkout_note
    ) VALUES (
        v_school_id, p_item_id, p_branch_id, auth.uid(), NULL, 'self_checkout', p_quantity,
        'pendiente_aprobacion_entrega', now(), p_photo_url, p_note
    )
    RETURNING id INTO v_id;

    PERFORM public._equipment_notify_admins(v_school_id, 'Toma de dotación por aprobar',
        'Un entrenador registró una toma en autoservicio', '/school/dotacion');

    RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.equipment_self_checkout(uuid, int, text, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.equipment_approve_delivery(p_assignment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_a record;
BEGIN
    SELECT * INTO v_a FROM public.equipment_assignments WHERE id = p_assignment_id FOR UPDATE;
    IF v_a.id IS NULL THEN
        RAISE EXCEPTION 'Asignación no encontrada' USING ERRCODE = '02000';
    END IF;
    IF NOT (public.is_super_admin() OR public.is_school_admin(v_a.school_id)) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
    IF v_a.status <> 'pendiente_aprobacion_entrega' THEN
        RAISE EXCEPTION 'La entrega no está pendiente de aprobación (estado %)', v_a.status USING ERRCODE = '22023';
    END IF;

    UPDATE public.equipment_assignments
    SET status = 'activa', accepted_at = now(),
        entrega_approved_by = auth.uid(), entrega_approved_at = now()
    WHERE id = p_assignment_id;

    PERFORM public._equipment_set_acta_fields(p_assignment_id);

    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (v_a.assigned_to, 'Toma aprobada', 'Tu toma de dotación fue aprobada', 'success', '/coach/dotacion');
END;
$$;
GRANT EXECUTE ON FUNCTION public.equipment_approve_delivery(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.equipment_reject_delivery(p_assignment_id uuid, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_a record;
BEGIN
    IF p_note IS NULL OR btrim(p_note) = '' THEN
        RAISE EXCEPTION 'La nota es obligatoria al rechazar' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_a FROM public.equipment_assignments WHERE id = p_assignment_id FOR UPDATE;
    IF v_a.id IS NULL THEN
        RAISE EXCEPTION 'Asignación no encontrada' USING ERRCODE = '02000';
    END IF;
    IF NOT (public.is_super_admin() OR public.is_school_admin(v_a.school_id)) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
    IF v_a.status NOT IN ('pendiente_aprobacion_entrega','pendiente_aceptacion') THEN
        RAISE EXCEPTION 'No se puede rechazar en estado %', v_a.status USING ERRCODE = '22023';
    END IF;

    -- Liberar stock reservado
    UPDATE public.equipment_items
    SET quantity_available = quantity_available + v_a.quantity
    WHERE id = v_a.item_id;

    UPDATE public.equipment_assignments
    SET status = 'rechazada', reject_note = p_note
    WHERE id = p_assignment_id;

    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (v_a.assigned_to, 'Toma rechazada', p_note, 'warning', '/coach/dotacion');
END;
$$;
GRANT EXECUTE ON FUNCTION public.equipment_reject_delivery(uuid, text) TO authenticated;

-- ============================================================
-- DEVOLUCIONES (ambos modos)
-- ============================================================
CREATE OR REPLACE FUNCTION public.equipment_request_return(
    p_assignment_id uuid,
    p_quantity int,
    p_condition text,
    p_photo_url text DEFAULT NULL,
    p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_a         record;
    v_remaining int;
    v_id        uuid;
BEGIN
    IF p_condition NOT IN ('bueno','dañado','perdido') THEN
        RAISE EXCEPTION 'Condición inválida' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_a FROM public.equipment_assignments WHERE id = p_assignment_id FOR UPDATE;
    IF v_a.id IS NULL THEN
        RAISE EXCEPTION 'Asignación no encontrada' USING ERRCODE = '02000';
    END IF;
    IF v_a.assigned_to <> auth.uid() THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
    IF v_a.status <> 'activa' THEN
        RAISE EXCEPTION 'Solo se puede devolver desde una asignación activa (estado %)', v_a.status USING ERRCODE = '22023';
    END IF;
    IF v_a.mode = 'self_checkout' AND (p_photo_url IS NULL OR btrim(p_photo_url) = '') THEN
        RAISE EXCEPTION 'La foto es obligatoria en devoluciones de autoservicio' USING ERRCODE = '22023';
    END IF;

    -- Remanente = entregado - (aprobadas + ya pendientes/en disputa)
    SELECT v_a.quantity - v_a.returned_quantity
         - COALESCE((SELECT SUM(quantity) FROM public.equipment_returns
                     WHERE assignment_id = p_assignment_id
                       AND status IN ('pendiente_aprobacion','en_disputa')), 0)
    INTO v_remaining;

    IF p_quantity <= 0 OR p_quantity > v_remaining THEN
        RAISE EXCEPTION 'Cantidad a devolver inválida (remanente disponible %)', v_remaining USING ERRCODE = '23514';
    END IF;

    INSERT INTO public.equipment_returns (
        assignment_id, school_id, quantity, condition, status, photo_url, note, requested_by
    ) VALUES (
        p_assignment_id, v_a.school_id, p_quantity, p_condition, 'pendiente_aprobacion', p_photo_url, p_note, auth.uid()
    )
    RETURNING id INTO v_id;

    PERFORM public._equipment_notify_admins(v_a.school_id, 'Devolución por aprobar',
        'Un entrenador registró una devolución', '/school/dotacion');

    RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.equipment_request_return(uuid, int, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.equipment_approve_return(
    p_return_id uuid,
    p_final_condition text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_r     record;
    v_a     record;
    v_cond  text;
BEGIN
    SELECT * INTO v_r FROM public.equipment_returns WHERE id = p_return_id FOR UPDATE;
    IF v_r.id IS NULL THEN
        RAISE EXCEPTION 'Devolución no encontrada' USING ERRCODE = '02000';
    END IF;
    IF NOT (public.is_super_admin() OR public.is_school_admin(v_r.school_id)) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
    IF v_r.status NOT IN ('pendiente_aprobacion','en_disputa') THEN
        RAISE EXCEPTION 'La devolución no está pendiente (estado %)', v_r.status USING ERRCODE = '22023';
    END IF;

    v_cond := COALESCE(p_final_condition, v_r.condition);
    IF v_cond NOT IN ('bueno','dañado','perdido') THEN
        RAISE EXCEPTION 'Condición final inválida' USING ERRCODE = '22023';
    END IF;

    -- Bloqueo del ítem para aplicar efecto de stock
    SELECT * INTO v_a FROM public.equipment_assignments WHERE id = v_r.assignment_id FOR UPDATE;
    PERFORM 1 FROM public.equipment_items WHERE id = v_a.item_id FOR UPDATE;

    IF v_cond = 'bueno' THEN
        -- Regresa a disponible
        UPDATE public.equipment_items
        SET quantity_available = quantity_available + v_r.quantity
        WHERE id = v_a.item_id;
    ELSIF v_cond = 'dañado' THEN
        -- No regresa; el ítem queda marcado deteriorado
        UPDATE public.equipment_items SET condition = 'deteriorado' WHERE id = v_a.item_id;
    ELSE  -- perdido: baja de inventario (quantity_total) + log
        UPDATE public.equipment_items
        SET quantity_total = quantity_total - v_r.quantity
        WHERE id = v_a.item_id;

        INSERT INTO public.equipment_assignment_logs (assignment_id, user_id, action, old_value, new_value)
        VALUES (v_a.id, auth.uid(), 'baja_por_perdida',
                jsonb_build_object('return_id', v_r.id, 'quantity', v_r.quantity),
                jsonb_build_object('condition', 'perdido'));
    END IF;

    UPDATE public.equipment_returns
    SET status = 'aprobada', condition = v_cond, approved_by = auth.uid(), approved_at = now()
    WHERE id = p_return_id;

    -- Actualizar agregado en la asignación y cerrar si corresponde
    UPDATE public.equipment_assignments
    SET returned_quantity = returned_quantity + v_r.quantity,
        status = CASE WHEN returned_quantity + v_r.quantity >= quantity THEN 'cerrada' ELSE status END
    WHERE id = v_a.id;

    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (v_a.assigned_to, 'Devolución aprobada',
            'Tu devolución fue aprobada (' || v_cond || ')', 'success', '/coach/dotacion');
END;
$$;
GRANT EXECUTE ON FUNCTION public.equipment_approve_return(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.equipment_dispute_return(p_return_id uuid, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_r record;
    v_coach uuid;
BEGIN
    IF p_note IS NULL OR btrim(p_note) = '' THEN
        RAISE EXCEPTION 'La nota es obligatoria al disputar' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_r FROM public.equipment_returns WHERE id = p_return_id FOR UPDATE;
    IF v_r.id IS NULL THEN
        RAISE EXCEPTION 'Devolución no encontrada' USING ERRCODE = '02000';
    END IF;
    IF NOT (public.is_super_admin() OR public.is_school_admin(v_r.school_id)) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
    IF v_r.status <> 'pendiente_aprobacion' THEN
        RAISE EXCEPTION 'Solo se puede disputar una devolución pendiente (estado %)', v_r.status USING ERRCODE = '22023';
    END IF;

    UPDATE public.equipment_returns SET status = 'en_disputa', dispute_note = p_note WHERE id = p_return_id;

    SELECT assigned_to INTO v_coach FROM public.equipment_assignments WHERE id = v_r.assignment_id;
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (v_coach, 'Devolución en disputa', p_note, 'warning', '/coach/dotacion');
END;
$$;
GRANT EXECUTE ON FUNCTION public.equipment_dispute_return(uuid, text) TO authenticated;

-- ============================================================
-- DISPUTA / EDICIÓN / CIERRE (admin, con log)
-- ============================================================
CREATE OR REPLACE FUNCTION public.equipment_resolve_dispute(
    p_assignment_id uuid,
    p_action text,             -- 'corregir' | 'cancelar'
    p_new_quantity int DEFAULT NULL,
    p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_a    record;
    v_delta int;
    v_avail int;
BEGIN
    SELECT * INTO v_a FROM public.equipment_assignments WHERE id = p_assignment_id FOR UPDATE;
    IF v_a.id IS NULL THEN
        RAISE EXCEPTION 'Asignación no encontrada' USING ERRCODE = '02000';
    END IF;
    IF NOT (public.is_super_admin() OR public.is_school_admin(v_a.school_id)) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
    IF v_a.status <> 'en_disputa' THEN
        RAISE EXCEPTION 'La asignación no está en disputa (estado %)', v_a.status USING ERRCODE = '22023';
    END IF;

    IF p_action = 'cancelar' THEN
        UPDATE public.equipment_items
        SET quantity_available = quantity_available + v_a.quantity
        WHERE id = v_a.item_id;

        UPDATE public.equipment_assignments SET status = 'cancelada' WHERE id = p_assignment_id;

        INSERT INTO public.equipment_assignment_logs (assignment_id, user_id, action, old_value, new_value)
        VALUES (p_assignment_id, auth.uid(), 'resolvio_disputa',
                jsonb_build_object('status','en_disputa'), jsonb_build_object('status','cancelada','note',p_note));

    ELSIF p_action = 'corregir' THEN
        IF p_new_quantity IS NULL OR p_new_quantity <= 0 THEN
            RAISE EXCEPTION 'p_new_quantity requerido y > 0 para corregir' USING ERRCODE = '22023';
        END IF;
        -- delta > 0 => libera stock; delta < 0 => requiere más stock
        v_delta := v_a.quantity - p_new_quantity;

        SELECT quantity_available INTO v_avail FROM public.equipment_items WHERE id = v_a.item_id FOR UPDATE;
        IF v_delta < 0 AND v_avail < (-v_delta) THEN
            RAISE EXCEPTION 'Stock insuficiente para aumentar la cantidad' USING ERRCODE = '23514';
        END IF;

        UPDATE public.equipment_items
        SET quantity_available = quantity_available + v_delta
        WHERE id = v_a.item_id;

        UPDATE public.equipment_assignments
        SET quantity = p_new_quantity, status = 'activa', accepted_at = COALESCE(accepted_at, now())
        WHERE id = p_assignment_id;

        PERFORM public._equipment_set_acta_fields(p_assignment_id);

        INSERT INTO public.equipment_assignment_logs (assignment_id, user_id, action, old_value, new_value)
        VALUES (p_assignment_id, auth.uid(), 'edito_cantidad',
                jsonb_build_object('quantity', v_a.quantity),
                jsonb_build_object('quantity', p_new_quantity, 'note', p_note));

        INSERT INTO public.notifications (user_id, title, message, type, link)
        VALUES (v_a.assigned_to, 'Disputa resuelta', 'La asignación fue corregida y activada', 'success', '/coach/dotacion');
    ELSE
        RAISE EXCEPTION 'Acción inválida: %', p_action USING ERRCODE = '22023';
    END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.equipment_resolve_dispute(uuid, text, int, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.equipment_close_with_shortage(p_assignment_id uuid, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_a        record;
    v_shortage int;
BEGIN
    SELECT * INTO v_a FROM public.equipment_assignments WHERE id = p_assignment_id FOR UPDATE;
    IF v_a.id IS NULL THEN
        RAISE EXCEPTION 'Asignación no encontrada' USING ERRCODE = '02000';
    END IF;
    IF NOT (public.is_super_admin() OR public.is_school_admin(v_a.school_id)) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
    IF v_a.status <> 'activa' THEN
        RAISE EXCEPTION 'Solo se puede cerrar con faltante una asignación activa (estado %)', v_a.status USING ERRCODE = '22023';
    END IF;

    v_shortage := v_a.quantity - v_a.returned_quantity;
    IF v_shortage <= 0 THEN
        RAISE EXCEPTION 'No hay remanente pendiente' USING ERRCODE = '22023';
    END IF;

    -- El remanente se da por perdido: baja de inventario
    UPDATE public.equipment_items
    SET quantity_total = quantity_total - v_shortage
    WHERE id = v_a.item_id;

    UPDATE public.equipment_assignments SET status = 'cerrada' WHERE id = p_assignment_id;

    INSERT INTO public.equipment_assignment_logs (assignment_id, user_id, action, old_value, new_value)
    VALUES (p_assignment_id, auth.uid(), 'cerro_con_faltante',
            jsonb_build_object('remanente', v_shortage),
            jsonb_build_object('note', p_note));
END;
$$;
GRANT EXECUTE ON FUNCTION public.equipment_close_with_shortage(uuid, text) TO authenticated;

-- Usado por el BFF tras generar y subir el PDF del acta
CREATE OR REPLACE FUNCTION public.equipment_set_acta_pdf_url(p_assignment_id uuid, p_pdf_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_school_id uuid;
BEGIN
    SELECT school_id INTO v_school_id FROM public.equipment_assignments WHERE id = p_assignment_id;
    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'Asignación no encontrada' USING ERRCODE = '02000';
    END IF;
    IF NOT (public.is_super_admin() OR public.is_school_admin(v_school_id)) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
    UPDATE public.equipment_assignments SET acta_pdf_url = p_pdf_url WHERE id = p_assignment_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.equipment_set_acta_pdf_url(uuid, text) TO authenticated;

-- ============================================================
-- LECTURA
-- ============================================================
CREATE OR REPLACE FUNCTION public.equipment_list_items(
    p_school_id uuid,
    p_branch_id uuid DEFAULT NULL,
    p_status    text DEFAULT NULL,   -- 'active' | 'inactive' | NULL(todos)
    p_search    text DEFAULT NULL,
    p_limit     int  DEFAULT 50,
    p_offset    int  DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_total bigint;
    v_rows  jsonb;
BEGIN
    IF NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)
            OR public._equipment_is_active_coach(p_school_id, auth.uid())) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;

    SELECT COUNT(*) INTO v_total
    FROM public.equipment_items i
    WHERE i.school_id = p_school_id
      AND (p_branch_id IS NULL OR i.branch_id = p_branch_id)
      AND (p_status IS NULL
           OR (p_status = 'active' AND i.is_active)
           OR (p_status = 'inactive' AND NOT i.is_active))
      AND (p_search IS NULL OR p_search = '' OR i.name ILIKE '%'||p_search||'%');

    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.name), '[]'::jsonb) INTO v_rows
    FROM (
        SELECT i.id, i.name, i.size, i.quantity_total, i.quantity_available, i.condition,
               i.photo_url, i.branch_id, sb.name AS branch_name, i.self_checkout_override, i.is_active
        FROM public.equipment_items i
        LEFT JOIN public.school_branches sb ON sb.id = i.branch_id
        WHERE i.school_id = p_school_id
          AND (p_branch_id IS NULL OR i.branch_id = p_branch_id)
          AND (p_status IS NULL
               OR (p_status = 'active' AND i.is_active)
               OR (p_status = 'inactive' AND NOT i.is_active))
          AND (p_search IS NULL OR p_search = '' OR i.name ILIKE '%'||p_search||'%')
        ORDER BY i.name
        LIMIT p_limit OFFSET p_offset
    ) t;

    RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;
GRANT EXECUTE ON FUNCTION public.equipment_list_items(uuid, uuid, text, text, int, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.equipment_pending_approvals(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_deliveries jsonb;
    v_returns    jsonb;
BEGIN
    IF NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at), '[]'::jsonb) INTO v_deliveries
    FROM (
        SELECT a.id, a.quantity, a.checkout_photo_url, a.checkout_note, a.created_at,
               a.branch_id, i.name AS item_name, p.full_name AS coach_name
        FROM public.equipment_assignments a
        JOIN public.equipment_items i ON i.id = a.item_id
        JOIN public.profiles p        ON p.id = a.assigned_to
        WHERE a.school_id = p_school_id AND a.status = 'pendiente_aprobacion_entrega'
    ) t;

    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.requested_at), '[]'::jsonb) INTO v_returns
    FROM (
        SELECT r.id, r.quantity, r.condition, r.photo_url, r.note, r.status, r.requested_at,
               a.id AS assignment_id, a.quantity AS assigned_quantity, a.checkout_photo_url,
               i.name AS item_name, p.full_name AS coach_name
        FROM public.equipment_returns r
        JOIN public.equipment_assignments a ON a.id = r.assignment_id
        JOIN public.equipment_items i       ON i.id = a.item_id
        JOIN public.profiles p              ON p.id = a.assigned_to
        WHERE r.school_id = p_school_id AND r.status IN ('pendiente_aprobacion','en_disputa')
    ) t;

    RETURN jsonb_build_object('deliveries', v_deliveries, 'returns', v_returns);
END;
$$;
GRANT EXECUTE ON FUNCTION public.equipment_pending_approvals(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.equipment_my_assignments()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_rows jsonb;
BEGIN
    SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb) INTO v_rows
    FROM (
        SELECT a.id, a.status, a.mode, a.quantity, a.returned_quantity, a.return_due_at,
               a.checkout_photo_url, a.acta_folio, a.acta_pdf_url, a.created_at,
               i.name AS item_name, i.size, sb.name AS branch_name, s.name AS school_name
        FROM public.equipment_assignments a
        JOIN public.equipment_items i     ON i.id = a.item_id
        LEFT JOIN public.school_branches sb ON sb.id = a.branch_id
        JOIN public.schools s             ON s.id = a.school_id
        WHERE a.assigned_to = auth.uid()
        ORDER BY a.created_at DESC
        LIMIT 200
    ) t;
    RETURN v_rows;
END;
$$;
GRANT EXECUTE ON FUNCTION public.equipment_my_assignments() TO authenticated;

CREATE OR REPLACE FUNCTION public.equipment_assignment_detail(p_assignment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_a       record;
    v_returns jsonb;
BEGIN
    SELECT * INTO v_a FROM public.equipment_assignments WHERE id = p_assignment_id;
    IF v_a.id IS NULL THEN
        RAISE EXCEPTION 'Asignación no encontrada' USING ERRCODE = '02000';
    END IF;
    IF NOT (public.is_super_admin() OR public.is_school_admin(v_a.school_id) OR v_a.assigned_to = auth.uid()) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.requested_at), '[]'::jsonb) INTO v_returns
    FROM public.equipment_returns r WHERE r.assignment_id = p_assignment_id;

    RETURN jsonb_build_object(
        'assignment', to_jsonb(v_a),
        'returns',    v_returns
    );
END;
$$;
GRANT EXECUTE ON FUNCTION public.equipment_assignment_detail(uuid) TO authenticated;
