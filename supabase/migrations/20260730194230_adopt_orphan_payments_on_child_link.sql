-- =============================================================================
-- 20260730194230_adopt_orphan_payments_on_child_link.sql
-- Autor: brylop   Fecha: 2026-07-31   Versión anterior: 20260730183000
-- Objetivo: al vincular un menor a su acudiente, adoptar sus cobros huérfanos
--           para que dejen de ser impagables (403 "No tienes permiso para pagar").
-- =============================================================================
--
-- SÍNTOMA
-- El acudiente se registra, ve la deuda de su hijo, toca "Pagar Ahora" y recibe
-- 403 "No tienes permiso para pagar este registro".
--
-- CAUSA
-- La escuela emite los cobros ANTES de que el acudiente exista, así que nacen con
-- payments.parent_id y user_id en NULL (ver 20260730000005). El guard anti-IDOR de
-- POST /payments/create-session compara al caller contra [parent_id, user_id]: con
-- ambos en NULL la lista de pagadores queda vacía y responde 403 a cualquiera,
-- incluido el propio acudiente. Vincular al menor NO arreglaba los cobros ya emitidos.
--
-- POR QUÉ UN TRIGGER Y NO UN PARCHE MÁS
-- Hay cuatro caminos que pueden setear children.parent_id, y hasta hoy solo UNO
-- adoptaba los cobros:
--   · claim_orphan_children        → arreglado en 20260730183000
--   · accept_invitation            → NO lo hacía
--   · accept_invitation_pro        → NO lo hacía  ← el caso que disparó esto
--   · UPDATE directo (BFF / admin) → NO lo hacía
-- Parchear función por función deja el hueco abierto para el quinto camino que
-- alguien agregue mañana. El invariante real es de la tabla, no de la función:
-- "un menor con acudiente no tiene cobros sin pagador". Eso se expresa con un
-- trigger, y así cubre los cuatro caminos y los que vengan.
--
-- ALCANCE MEDIDO (2026-07-30, diagnóstico global)
--   548 cobros con parent_id NULL · 24 con el menor ya vinculado (arreglables hoy)
--   524 con el menor todavía huérfano — 301 pending + 1 overdue esperando a que
--   su acudiente acepte la invitación. Cada uno de esos habría caído en el 403.
--
-- El backfill de 20260730000005 corrió una sola vez y no sirve para los que se
-- vinculen después; este trigger sí, porque actúa en el momento del enganche.
--
-- Idempotente: solo toca payments con parent_id Y user_id en NULL. Nunca pisa un
-- pagador ya asignado.
-- =============================================================================

BEGIN;

-- ── 1. La función del trigger ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.adopt_orphan_payments_on_child_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    -- Solo los cobros de ESTE menor que no tienen pagador. El filtro por
    -- user_id IS NULL evita tocar un cobro que ya apunta a un atleta adulto.
    UPDATE public.payments p
       SET parent_id  = NEW.parent_id,
           updated_at = now()
     WHERE p.child_id  = NEW.id
       AND p.parent_id IS NULL
       AND p.user_id   IS NULL;

    RETURN NULL;  -- AFTER trigger: el valor de retorno se ignora.
END;
$$;

COMMENT ON FUNCTION public.adopt_orphan_payments_on_child_link() IS
  'Trigger AFTER UPDATE en children: cuando parent_id pasa de NULL a no-NULL, '
  'asigna ese acudiente a los cobros del menor que quedaron sin pagador '
  '(parent_id y user_id NULL), para que sean pagables online. Cubre todos los '
  'caminos de vinculación (accept_invitation, accept_invitation_pro, '
  'claim_orphan_children, UPDATE directo).';

-- ── 2. El trigger ────────────────────────────────────────────────────────────
-- WHEN acota el disparo al único caso que importa: el enganche inicial. No corre
-- en los UPDATE ordinarios de children (nombre, equipo, foto…), ni cuando el
-- acudiente cambia de una persona a otra (ahí los cobros ya tienen pagador y el
-- UPDATE de arriba no los tocaría de todos modos).
DROP TRIGGER IF EXISTS trg_adopt_orphan_payments_on_child_link ON public.children;

CREATE TRIGGER trg_adopt_orphan_payments_on_child_link
    AFTER UPDATE OF parent_id ON public.children
    FOR EACH ROW
    WHEN (OLD.parent_id IS NULL AND NEW.parent_id IS NOT NULL)
    EXECUTE FUNCTION public.adopt_orphan_payments_on_child_link();

-- ── 3. Backfill de los que ya quedaron colgados ──────────────────────────────
-- Menores que YA tienen acudiente pero cuyos cobros nacieron huérfanos: se
-- vincularon por un camino que no adoptaba los cobros. Al 2026-07-30 son 24
-- (18 pending + 6 cancelled, $3.550.000).
UPDATE public.payments p
   SET parent_id  = c.parent_id,
       updated_at = now()
  FROM public.children c
 WHERE p.child_id  = c.id
   AND p.parent_id IS NULL
   AND p.user_id   IS NULL
   AND c.parent_id IS NOT NULL;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ── 4. Verificación ──────────────────────────────────────────────────────────
-- `arreglables_restantes` debe quedar en 0. Lo que siga en `sin_pagador` son
-- menores que todavía no tienen acudiente vinculado (children.parent_id NULL):
-- no hay a quién asignarles el cobro, y el trigger los resolverá solo en cuanto
-- el acudiente acepte su invitación o entre al dashboard.
SELECT s.name                                                        AS escuela,
       count(*)                                                      AS cobros_de_menores,
       count(*) FILTER (WHERE p.parent_id IS NULL)                   AS sin_pagador,
       count(*) FILTER (WHERE p.parent_id IS NULL
                          AND c.parent_id IS NOT NULL)               AS arreglables_restantes,
       count(*) FILTER (WHERE p.parent_id IS NULL
                          AND p.status IN ('pending', 'overdue'))    AS impagables_hoy,
       sum(p.amount) FILTER (WHERE p.parent_id IS NULL
                          AND p.status IN ('pending', 'overdue'))    AS monto_atascado
  FROM public.payments p
  JOIN public.children c ON c.id = p.child_id
  JOIN public.schools  s ON s.id = p.school_id
 GROUP BY s.name
 ORDER BY 5 DESC, 2 DESC;
