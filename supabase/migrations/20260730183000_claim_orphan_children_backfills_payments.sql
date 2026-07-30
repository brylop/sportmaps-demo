-- ============================================================
-- SPORTMAPS — claim_orphan_children también adopta los cobros ya emitidos
-- ------------------------------------------------------------
-- Fecha: 2026-07-30
--
-- CONTEXTO
-- Un menor pre-cargado por la escuela queda con children.parent_id NULL hasta que su
-- acudiente crea cuenta: al entrar al dashboard, claim_orphan_children() lo vincula
-- comparando children.parent_email_temp con el email del usuario.
--
-- EL HUECO
-- Los cobros que la escuela ya le emitió a ese menor nacieron sin pagador
-- (parent_id/user_id NULL — ver 20260730000005 y enrollmentBilling.createPendingPayment).
-- Vincular al menor NO los arreglaba, así que el acudiente se registraba, veía la deuda
-- y al tocar "Pagar Ahora" recibía 403 "No tienes permiso para pagar este registro".
--
-- El backfill de 20260730000005 corrió una sola vez; no sirve para los que se vinculen
-- después. En DYNASTY eso son 382 familias que todavía no han creado cuenta: cada una
-- caería en el mismo error al registrarse.
--
-- SOLUCIÓN
-- Al adoptar al menor, adoptar también sus cobros huérfanos. Así el arreglo ocurre solo,
-- en el momento correcto, sin depender de que alguien vuelva a correr un backfill.
--
-- Se conserva la firma y el valor de retorno (cantidad de menores vinculados) para no
-- romper al único caller: DashboardPage.tsx.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.claim_orphan_children(p_school_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_email   text;
    v_ids     uuid[];
    v_count   int := 0;
BEGIN
    IF v_user_id IS NULL THEN RETURN 0; END IF;
    SELECT LOWER(TRIM(email)) INTO v_email FROM auth.users WHERE id = v_user_id;
    IF v_email IS NULL OR v_email = '' THEN RETURN 0; END IF;

    -- 1. Vincular los menores cuyo correo pre-cargado coincide (lower+trim en ambos).
    WITH adoptados AS (
        UPDATE public.children c
           SET parent_id  = v_user_id,
               updated_at = now()
         WHERE c.parent_id IS NULL
           AND LOWER(TRIM(c.parent_email_temp)) = v_email
           AND (p_school_id IS NULL OR c.school_id = p_school_id)
        RETURNING c.id
    )
    SELECT array_agg(id) INTO v_ids FROM adoptados;

    v_count := COALESCE(array_length(v_ids, 1), 0);
    IF v_count = 0 THEN RETURN 0; END IF;

    -- 2. Adoptar sus cobros huérfanos. Solo los que NO tienen pagador: nunca se
    --    sobreescribe un parent_id/user_id ya asignado.
    UPDATE public.payments p
       SET parent_id  = v_user_id,
           updated_at = now()
     WHERE p.child_id  = ANY(v_ids)
       AND p.parent_id IS NULL
       AND p.user_id   IS NULL;

    RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.claim_orphan_children(uuid) IS
  'Vincula al usuario actual los menores pre-cargados que coinciden por '
  'children.parent_email_temp, y adopta además sus cobros huérfanos (payments sin '
  'parent_id/user_id) para que sean pagables online. Devuelve la cantidad de menores '
  'vinculados. Llamada desde DashboardPage al entrar.';

GRANT EXECUTE ON FUNCTION public.claim_orphan_children(uuid) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
