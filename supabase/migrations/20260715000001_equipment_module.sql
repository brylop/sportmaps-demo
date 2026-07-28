-- ============================================================
-- SPORTMAPS — Módulo de Dotación e Inventario · Fase 1 (modelo + RLS)
--
-- Custodia de indumentaria/implementos de la escuela hacia sus ENTRENADORES,
-- con acta de responsabilidad + evidencia fotográfica + control de devoluciones.
--
-- AISLAMIENTO TOTAL: este módulo NO referencia ni comparte datos con el
-- marketplace (products / product_variants / stock_holds / inventory_transactions).
-- Tablas propias con prefijo equipment_*.
--
-- Convenciones aplicadas (CLAUDE.md §DB):
--   - text + CHECK para estados/condiciones (no CREATE TYPE)
--   - FKs de negocio a public.profiles(id)
--   - sede = public.school_branches vía branch_id
--   - RLS con helpers is_school_admin() / is_super_admin() (no self-recursion)
--   - trigger updated_at = public.set_updated_at(); auditoría = audit_trigger_func()
--   - el STOCK solo se muta desde RPCs con FOR UPDATE (mig 20260715000002)
-- ============================================================

-- ─── 1. Config del módulo por escuela ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.equipment_settings (
    school_id                uuid        PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
    self_checkout_enabled    boolean     NOT NULL DEFAULT false,
    require_photo_admin_mode boolean     NOT NULL DEFAULT false,   -- foto en modo A (opcional por defecto)
    default_return_days      int,                                  -- null = sin fecha límite
    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now()
);

-- ─── 2. Ítems de dotación ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.equipment_items (
    id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id              uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    branch_id              uuid        REFERENCES public.school_branches(id) ON DELETE SET NULL,  -- null = compartido
    name                   text        NOT NULL,
    size                   text,
    quantity_total         int         NOT NULL CHECK (quantity_total >= 0),
    quantity_available     int         NOT NULL CHECK (quantity_available >= 0),  -- solo se muta por RPC
    condition              text        NOT NULL DEFAULT 'nuevo'
                                       CHECK (condition IN ('nuevo','usado','deteriorado')),
    photo_url              text,
    self_checkout_override text        CHECK (self_checkout_override IN ('permitido','bloqueado')),
    is_active              boolean     NOT NULL DEFAULT true,       -- soft delete
    created_by             uuid        REFERENCES public.profiles(id),
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT equipment_items_available_lte_total CHECK (quantity_available <= quantity_total)
);
CREATE INDEX IF NOT EXISTS idx_equipment_items_school        ON public.equipment_items (school_id, is_active);
CREATE INDEX IF NOT EXISTS idx_equipment_items_school_branch ON public.equipment_items (school_id, branch_id);

-- ─── 3. Asignaciones ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.equipment_assignments (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id           uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    item_id             uuid        NOT NULL REFERENCES public.equipment_items(id) ON DELETE RESTRICT,
    branch_id           uuid        REFERENCES public.school_branches(id) ON DELETE SET NULL,  -- sede de la operación
    assigned_to         uuid        NOT NULL REFERENCES public.profiles(id),   -- entrenador
    assigned_by         uuid        REFERENCES public.profiles(id),            -- admin (null en autoservicio)
    mode                text        NOT NULL CHECK (mode IN ('admin_delivery','self_checkout')),
    quantity            int         NOT NULL CHECK (quantity > 0),
    status              text        NOT NULL DEFAULT 'pendiente_aceptacion'
                                    CHECK (status IN (
                                      'pendiente_aceptacion','pendiente_aprobacion_entrega','activa',
                                      'en_disputa','rechazada','cancelada','cerrada')),
    -- Entrega
    delivered_at        timestamptz,
    accepted_at         timestamptz,
    checkout_photo_url  text,                        -- obligatoria en modo B
    checkout_note       text,
    entrega_approved_by uuid        REFERENCES public.profiles(id),
    entrega_approved_at timestamptz,
    reject_note         text,
    dispute_note        text,
    reported_quantity   int,                         -- cantidad real declarada en "reportar diferencia"
    -- Devolución (agregados; el detalle vive en equipment_returns)
    return_due_at       date,
    returned_quantity   int         NOT NULL DEFAULT 0,   -- Σ devoluciones APROBADAS
    -- Acta
    content_snapshot    jsonb,                       -- datos congelados al pasar a ACTIVA
    acta_folio          text        UNIQUE,          -- "DOT-{SLUG}-{YYYY}-{NNNNN}"
    acta_pdf_url        text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT equipment_assignments_returned_lte_qty CHECK (returned_quantity <= quantity)
);
CREATE INDEX IF NOT EXISTS idx_equip_assign_school_status ON public.equipment_assignments (school_id, status);
CREATE INDEX IF NOT EXISTS idx_equip_assign_coach_status  ON public.equipment_assignments (assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_equip_assign_school_branch ON public.equipment_assignments (school_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_equip_assign_item          ON public.equipment_assignments (item_id);

-- ─── 4. Devoluciones (tabla hija — soporta devoluciones parciales) ────────────
CREATE TABLE IF NOT EXISTS public.equipment_returns (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id uuid        NOT NULL REFERENCES public.equipment_assignments(id) ON DELETE CASCADE,
    school_id     uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,  -- denormalizado p/ RLS
    quantity      int         NOT NULL CHECK (quantity > 0),
    condition     text        NOT NULL CHECK (condition IN ('bueno','dañado','perdido')),
    status        text        NOT NULL DEFAULT 'pendiente_aprobacion'
                              CHECK (status IN ('pendiente_aprobacion','aprobada','en_disputa','rechazada')),
    photo_url     text,                       -- obligatoria si la asignación es self_checkout
    note          text,
    requested_by  uuid        REFERENCES public.profiles(id),
    requested_at  timestamptz NOT NULL DEFAULT now(),
    approved_by   uuid        REFERENCES public.profiles(id),
    approved_at   timestamptz,
    dispute_note  text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_equip_returns_assignment ON public.equipment_returns (assignment_id);
CREATE INDEX IF NOT EXISTS idx_equip_returns_school_st  ON public.equipment_returns (school_id, status);

-- ─── 5. Log de negocio (acciones semánticas del admin) ────────────────────────
-- El audit genérico (audit_trigger_func) cubre "toda edición"; esta tabla
-- registra la INTENCIÓN de negocio que el genérico no etiqueta.
CREATE TABLE IF NOT EXISTS public.equipment_assignment_logs (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id uuid        NOT NULL REFERENCES public.equipment_assignments(id) ON DELETE CASCADE,
    user_id       uuid        REFERENCES public.profiles(id),
    action        text        NOT NULL,   -- edito_cantidad|resolvio_disputa|reasigno|cerro_con_faltante|baja_por_perdida
    old_value     jsonb,
    new_value     jsonb,
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_equip_logs_assignment ON public.equipment_assignment_logs (assignment_id);

-- ─── 6. Triggers updated_at (helper estándar del proyecto) ────────────────────
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'set_updated_at') THEN
        EXECUTE 'DROP TRIGGER IF EXISTS trg_equipment_settings_updated_at ON public.equipment_settings';
        EXECUTE 'CREATE TRIGGER trg_equipment_settings_updated_at BEFORE UPDATE ON public.equipment_settings
                 FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
        EXECUTE 'DROP TRIGGER IF EXISTS trg_equipment_items_updated_at ON public.equipment_items';
        EXECUTE 'CREATE TRIGGER trg_equipment_items_updated_at BEFORE UPDATE ON public.equipment_items
                 FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
        EXECUTE 'DROP TRIGGER IF EXISTS trg_equipment_assignments_updated_at ON public.equipment_assignments';
        EXECUTE 'CREATE TRIGGER trg_equipment_assignments_updated_at BEFORE UPDATE ON public.equipment_assignments
                 FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
        EXECUTE 'DROP TRIGGER IF EXISTS trg_equipment_returns_updated_at ON public.equipment_returns';
        EXECUTE 'CREATE TRIGGER trg_equipment_returns_updated_at BEFORE UPDATE ON public.equipment_returns
                 FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
    END IF;
END $$;

-- ─── 7. Triggers de auditoría (helper genérico del proyecto) ──────────────────
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'audit_trigger_func') THEN
        EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_equipment_items ON public.equipment_items';
        EXECUTE 'CREATE TRIGGER trg_audit_equipment_items AFTER INSERT OR UPDATE OR DELETE ON public.equipment_items
                 FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func()';
        EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_equipment_assignments ON public.equipment_assignments';
        EXECUTE 'CREATE TRIGGER trg_audit_equipment_assignments AFTER INSERT OR UPDATE OR DELETE ON public.equipment_assignments
                 FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func()';
        EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_equipment_returns ON public.equipment_returns';
        EXECUTE 'CREATE TRIGGER trg_audit_equipment_returns AFTER INSERT OR UPDATE OR DELETE ON public.equipment_returns
                 FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func()';
    END IF;
END $$;

-- ============================================================
-- 8. RLS
--   Admin de la escuela: acceso total (FOR ALL).
--   Coach: SELECT de ítems de su escuela y de SUS asignaciones/devoluciones.
--   Las acciones de escritura del coach van SIEMPRE por RPC (mig ...002),
--   que corre SECURITY DEFINER y bypassea estas policies.
-- ============================================================
ALTER TABLE public.equipment_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_assignments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_returns         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_assignment_logs ENABLE ROW LEVEL SECURITY;

-- equipment_settings ----------------------------------------------------------
DROP POLICY IF EXISTS equipment_settings_admin ON public.equipment_settings;
CREATE POLICY equipment_settings_admin ON public.equipment_settings
    FOR ALL TO authenticated
    USING (public.is_super_admin() OR public.is_school_admin(school_id))
    WITH CHECK (public.is_super_admin() OR public.is_school_admin(school_id));

-- equipment_items -------------------------------------------------------------
DROP POLICY IF EXISTS equipment_items_admin ON public.equipment_items;
CREATE POLICY equipment_items_admin ON public.equipment_items
    FOR ALL TO authenticated
    USING (public.is_super_admin() OR public.is_school_admin(school_id))
    WITH CHECK (public.is_super_admin() OR public.is_school_admin(school_id));

DROP POLICY IF EXISTS equipment_items_coach_read ON public.equipment_items;
CREATE POLICY equipment_items_coach_read ON public.equipment_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.school_members sm
            WHERE sm.school_id = equipment_items.school_id
              AND sm.profile_id = auth.uid()
              AND sm.role = 'coach'
              AND sm.status = 'active'
        )
    );

-- equipment_assignments -------------------------------------------------------
DROP POLICY IF EXISTS equipment_assignments_admin ON public.equipment_assignments;
CREATE POLICY equipment_assignments_admin ON public.equipment_assignments
    FOR ALL TO authenticated
    USING (public.is_super_admin() OR public.is_school_admin(school_id))
    WITH CHECK (public.is_super_admin() OR public.is_school_admin(school_id));

DROP POLICY IF EXISTS equipment_assignments_coach_read ON public.equipment_assignments;
CREATE POLICY equipment_assignments_coach_read ON public.equipment_assignments
    FOR SELECT TO authenticated
    USING (assigned_to = auth.uid());

-- equipment_returns -----------------------------------------------------------
DROP POLICY IF EXISTS equipment_returns_admin ON public.equipment_returns;
CREATE POLICY equipment_returns_admin ON public.equipment_returns
    FOR ALL TO authenticated
    USING (public.is_super_admin() OR public.is_school_admin(school_id))
    WITH CHECK (public.is_super_admin() OR public.is_school_admin(school_id));

DROP POLICY IF EXISTS equipment_returns_coach_read ON public.equipment_returns;
CREATE POLICY equipment_returns_coach_read ON public.equipment_returns
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.equipment_assignments ea
            WHERE ea.id = equipment_returns.assignment_id
              AND ea.assigned_to = auth.uid()
        )
    );

-- equipment_assignment_logs ---------------------------------------------------
-- Solo lectura para admin; la escritura es exclusivamente vía RPC SECURITY DEFINER.
DROP POLICY IF EXISTS equipment_logs_admin_read ON public.equipment_assignment_logs;
CREATE POLICY equipment_logs_admin_read ON public.equipment_assignment_logs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.equipment_assignments ea
            WHERE ea.id = equipment_assignment_logs.assignment_id
              AND (public.is_super_admin() OR public.is_school_admin(ea.school_id))
        )
    );

-- ─── 9. Comentarios ───────────────────────────────────────────────────────────
COMMENT ON TABLE public.equipment_items IS 'Dotación deportiva de la escuela (custodia interna). NO es inventario de tienda/marketplace.';
COMMENT ON TABLE public.equipment_assignments IS 'Entregas de dotación a entrenadores con acta de responsabilidad. quantity_available del ítem se muta solo vía RPC con FOR UPDATE.';
COMMENT ON TABLE public.equipment_returns IS 'Devoluciones (parciales permitidas). condition perdido decrementa quantity_total del ítem.';
COMMENT ON COLUMN public.equipment_items.quantity_available IS 'Mantenido EXCLUSIVAMENTE por RPCs con SELECT ... FOR UPDATE. Nunca UPDATE directo desde el cliente.';
