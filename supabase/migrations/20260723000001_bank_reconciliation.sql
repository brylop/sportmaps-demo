-- ============================================================
-- SPORTMAPS — Comprobantes v2, Fase 6: conciliación contra extracto bancario
-- Spec: docs/specs/receipt-extraction-v2-glosas.md §4, §6
-- ------------------------------------------------------------
-- Modelo: aceptación optimista con conciliación posterior.
--   validado_ocr (status='paid' + reconciliation_status='pendiente')
--        │  admin sube extracto (CSV/Excel) → reconcile_statement()
--        ├── match monto+fecha(±1d)+referencia → reconciliation_status='confirmado'
--        └── sin match (dentro del rango del extracto) → glosa NO_APARECE_EN_BANCO
--                                                       → pago vuelve a 'glosado'
--
-- Decisiones (cerradas con el usuario 2026-07-23):
--  · Referencia vacía → MATCH DÉBIL por monto+fecha: si hay UNA sola línea
--    candidata ese rango → confirma; si hay varias ambiguas → se deja manual
--    (NO se glosa por ambigüedad).
--  · Solo se glosan pagos cuya fecha cae DENTRO del rango [date_from, date_to]
--    del extracto → un extracto de mayo no glosa pagos de junio.
--  · Cruce disponible on-demand (subir extracto) y anclable al Cierre de Mes.
--
-- Convenciones repo: text+CHECK (no enum), search_path en toda función,
-- GRANT EXECUTE explícito, RLS sin self-recursion (helpers SECURITY DEFINER),
-- mutación de estado solo dentro de RPC SECURITY DEFINER con FOR UPDATE.
-- Fecha: 2026-07-23
-- ============================================================

BEGIN;

-- ── 1. Cabecera del extracto (una fila por carga) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.bank_statements (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    uploaded_by     uuid REFERENCES public.profiles(id),
    bank            text,                       -- 'nequi' | 'bancolombia' | 'generic' | ...
    filename        text,
    -- Rango cubierto por el extracto (lo calcula el BFF de las líneas). Acota
    -- qué pagos son conciliables: fuera del rango NO se glosan.
    date_from       date,
    date_to         date,
    -- Ancla opcional al Cierre de Mes (cuando el cruce corre en el cierre).
    period_year     int,
    period_month    int,
    row_count       int  NOT NULL DEFAULT 0,
    matched_count   int  NOT NULL DEFAULT 0,
    weak_count      int  NOT NULL DEFAULT 0,
    unmatched_count int  NOT NULL DEFAULT 0,
    glosas_opened   int  NOT NULL DEFAULT 0,
    status          text NOT NULL DEFAULT 'uploaded'
                    CHECK (status IN ('uploaded', 'reconciled')),
    reconciled_at   timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_statements_school
    ON public.bank_statements (school_id, created_at DESC);

-- ── 2. Líneas del extracto (una por movimiento) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.bank_statement_lines (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    statement_id       uuid NOT NULL REFERENCES public.bank_statements(id) ON DELETE CASCADE,
    school_id          uuid NOT NULL,          -- denormalizado para RLS + índice de cruce
    occurred_date      date,
    amount             numeric NOT NULL,
    reference_norm     text,                   -- referencia normalizada (misma norma que el OCR)
    description        text,
    counterparty       text,
    matched_payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
    match_status       text NOT NULL DEFAULT 'unmatched'
                       CHECK (match_status IN ('matched', 'matched_weak', 'unmatched', 'ignored')),
    created_at         timestamptz NOT NULL DEFAULT now()
);

-- Índice del cruce (monto + fecha + referencia por escuela).
CREATE INDEX IF NOT EXISTS idx_bsl_match
    ON public.bank_statement_lines (school_id, amount, occurred_date);
CREATE INDEX IF NOT EXISTS idx_bsl_ref
    ON public.bank_statement_lines (school_id, reference_norm)
    WHERE reference_norm IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bsl_statement
    ON public.bank_statement_lines (statement_id);

-- ── 3. RLS: el admin de la escuela LEE lo suyo; escritura solo service_role ─
-- No hay policy de INSERT/UPDATE/DELETE → ningún cliente escribe; el BFF entra
-- con service_role (bypassa RLS) o vía la RPC SECURITY DEFINER de abajo.
ALTER TABLE public.bank_statements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statement_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bank_statements_select_admin ON public.bank_statements;
CREATE POLICY bank_statements_select_admin ON public.bank_statements
    FOR SELECT TO authenticated
    USING (public.is_school_admin(school_id));   -- helper SECURITY DEFINER, sin self-recursion

DROP POLICY IF EXISTS bank_statement_lines_select_admin ON public.bank_statement_lines;
CREATE POLICY bank_statement_lines_select_admin ON public.bank_statement_lines
    FOR SELECT TO authenticated
    USING (public.is_school_admin(school_id));

-- ── 4. RPC de conciliación (solo el BFF, service_role) ─────────────────────
-- Idempotente: si el extracto ya está 'reconciled', no re-procesa.
-- Autoriza por p_actor (contexto service_role: auth.uid() es null, así que NO
-- se puede usar is_school_admin aquí; se usa _glosa_actor_is_admin del actor).
-- p_actor NULL = ejecución de sistema (cierre de mes).
CREATE OR REPLACE FUNCTION public.reconcile_statement(
    p_actor        uuid,
    p_statement_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_school_id  uuid;
    v_status     text;
    v_from       date;
    v_to         date;
    v_matched    int := 0;
    v_weak       int := 0;
    v_glosas     int := 0;
    v_pending    int := 0;
    p_rec        record;
    v_line_id    uuid;
    v_cand_cnt   int;
    v_pay_date   date;
    v_pay_amount numeric;
BEGIN
    SELECT school_id, status, date_from, date_to
    INTO v_school_id, v_status, v_from, v_to
    FROM public.bank_statements WHERE id = p_statement_id;

    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'Extracto no encontrado' USING ERRCODE = '02000';
    END IF;
    IF p_actor IS NOT NULL AND NOT public._glosa_actor_is_admin(p_actor, v_school_id) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
    IF v_status = 'reconciled' THEN
        RETURN jsonb_build_object('already_reconciled', true);
    END IF;

    -- Si el BFF no seteó el rango, lo derivamos de las líneas.
    IF v_from IS NULL OR v_to IS NULL THEN
        SELECT min(occurred_date), max(occurred_date) INTO v_from, v_to
        FROM public.bank_statement_lines WHERE statement_id = p_statement_id;
    END IF;

    -- Recorremos los pagos pendientes de conciliación de la escuela cuya fecha
    -- cae DENTRO del rango del extracto. Fuera del rango → se dejan intactos.
    FOR p_rec IN
        SELECT p.id, p.parent_id,
               COALESCE(p.amount_paid, p.amount)                 AS pay_amount,
               COALESCE(p.payment_date, p.ocr_date::date)        AS pay_date,
               p.receipt_reference_norm                          AS ref_norm
        FROM public.payments p
        WHERE p.school_id = v_school_id
          AND p.status = 'paid'
          AND p.reconciliation_status = 'pendiente'
          AND COALESCE(p.payment_date, p.ocr_date::date) BETWEEN v_from AND v_to
        FOR UPDATE
    LOOP
        v_pending  := v_pending + 1;
        v_pay_date := p_rec.pay_date;
        v_pay_amount := p_rec.pay_amount;
        v_line_id  := NULL;

        -- (a) MATCH FUERTE: monto + fecha(±1d) + referencia igual (ambas presentes).
        IF p_rec.ref_norm IS NOT NULL THEN
            SELECT l.id INTO v_line_id
            FROM public.bank_statement_lines l
            WHERE l.statement_id = p_statement_id
              AND l.match_status = 'unmatched'
              AND l.amount = v_pay_amount
              AND l.reference_norm = p_rec.ref_norm
              AND (l.occurred_date IS NULL OR abs(l.occurred_date - v_pay_date) <= 1)
            ORDER BY l.occurred_date NULLS LAST
            LIMIT 1
            FOR UPDATE SKIP LOCKED;

            IF v_line_id IS NOT NULL THEN
                UPDATE public.bank_statement_lines
                SET match_status = 'matched', matched_payment_id = p_rec.id
                WHERE id = v_line_id;
                UPDATE public.payments
                SET reconciliation_status = 'confirmado', updated_at = now()
                WHERE id = p_rec.id;
                v_matched := v_matched + 1;
                CONTINUE;
            END IF;
        END IF;

        -- (b) MATCH DÉBIL: monto + fecha(±1d), sin referencia. Solo si hay UNA
        --     línea candidata (no ambigua). Varias → se deja manual, no se glosa.
        SELECT count(*) INTO v_cand_cnt
        FROM public.bank_statement_lines l
        WHERE l.statement_id = p_statement_id
          AND l.match_status = 'unmatched'
          AND l.amount = v_pay_amount
          AND (l.occurred_date IS NULL OR abs(l.occurred_date - v_pay_date) <= 1);

        IF v_cand_cnt = 1 THEN
            SELECT l.id INTO v_line_id
            FROM public.bank_statement_lines l
            WHERE l.statement_id = p_statement_id
              AND l.match_status = 'unmatched'
              AND l.amount = v_pay_amount
              AND (l.occurred_date IS NULL OR abs(l.occurred_date - v_pay_date) <= 1)
            LIMIT 1
            FOR UPDATE SKIP LOCKED;

            IF v_line_id IS NOT NULL THEN
                UPDATE public.bank_statement_lines
                SET match_status = 'matched_weak', matched_payment_id = p_rec.id
                WHERE id = v_line_id;
                UPDATE public.payments
                SET reconciliation_status = 'confirmado', updated_at = now()
                WHERE id = p_rec.id;
                v_weak := v_weak + 1;
                CONTINUE;
            END IF;
        ELSIF v_cand_cnt > 1 THEN
            -- Ambiguo: dejar para revisión manual, no glosar ni confirmar.
            CONTINUE;
        END IF;

        -- (c) SIN MATCH dentro del rango → glosa NO_APARECE_EN_BANCO (sistema).
        --     create_glosa pone el pago en 'glosado' y notifica al acudiente.
        --     Puede chocar índice de glosa abierta única (23505) → lo ignoramos.
        BEGIN
            PERFORM public.create_glosa(
                NULL, p_rec.id, 'NO_APARECE_EN_BANCO',
                jsonb_build_object('statement_id', p_statement_id,
                                   'expected_amount', v_pay_amount,
                                   'expected_date', v_pay_date),
                NULL
            );
            -- create_glosa dejó el pago en 'glosado'; marcamos también el
            -- estado de conciliación como 'no_aparece' (informativo, semántica F5).
            UPDATE public.payments
            SET reconciliation_status = 'no_aparece', updated_at = now()
            WHERE id = p_rec.id;
            v_glosas := v_glosas + 1;
        EXCEPTION WHEN unique_violation THEN
            NULL;  -- ya tenía una glosa abierta; no duplicar
        END;
    END LOOP;

    UPDATE public.bank_statements
    SET status = 'reconciled',
        date_from = v_from,
        date_to = v_to,
        matched_count = v_matched,
        weak_count = v_weak,
        unmatched_count = v_pending - v_matched - v_weak,
        glosas_opened = v_glosas,
        reconciled_at = now()
    WHERE id = p_statement_id;

    RETURN jsonb_build_object(
        'pending_in_range', v_pending,
        'matched', v_matched,
        'matched_weak', v_weak,
        'glosas_opened', v_glosas
    );
END;
$$;
REVOKE ALL ON FUNCTION public.reconcile_statement(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_statement(uuid, uuid) TO service_role;

-- ── 5. Dashboard: motivos de glosa por escuela y periodo ───────────────────
-- SECURITY DEFINER + autoriza por auth.uid() (lo llama el frontend autenticado
-- vía RLS-safe RPC, o el BFF). Devuelve conteos por motivo y estado.
CREATE OR REPLACE FUNCTION public.glosa_dashboard(
    p_school_id uuid,
    p_from      date DEFAULT NULL,
    p_to        date DEFAULT NULL
)
RETURNS TABLE (reason text, status text, cnt bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT g.reason, g.status, count(*)::bigint
    FROM public.payment_glosas g
    WHERE g.school_id = p_school_id
      AND public.is_school_admin(p_school_id)   -- gate: solo admin de esa escuela
      AND (p_from IS NULL OR g.created_at::date >= p_from)
      AND (p_to   IS NULL OR g.created_at::date <= p_to)
    GROUP BY g.reason, g.status;
$$;
REVOKE ALL ON FUNCTION public.glosa_dashboard(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.glosa_dashboard(uuid, date, date) TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
