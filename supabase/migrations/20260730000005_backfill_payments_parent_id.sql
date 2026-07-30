-- ============================================================
-- SPORTMAPS — Fix de datos: cobros de menores sin pagador (impagables online)
-- ------------------------------------------------------------
-- Fecha: 2026-07-30
--
-- SÍNTOMA
-- El acudiente entra a "Pagos", toca "Pagar Ahora" y recibe:
--   "Error en el pago — No tienes permiso para pagar este registro."
--
-- CAUSA
-- `enrollmentBilling.createPendingPayment` (BFF) creaba el cobro seteando SOLO la
-- columna del atleta: row[athleteCol] = athleteId. Para un menor eso llena `child_id`
-- y deja `parent_id` y `user_id` en NULL. El guard anti-IDOR de
-- POST /payments/create-session compara al caller contra [parent_id, user_id]; con
-- ambos en NULL la lista de pagadores queda vacía y responde 403 a CUALQUIERA,
-- incluido el propio acudiente.
--
-- Asimetría que lo mantuvo oculto: para un atleta ADULTO, athleteCol ES 'user_id', así
-- que el pagador quedaba seteado de paso y el pago funcionaba. Solo rompe con menores.
--
-- ALCANCE MEDIDO (escuela DYNASTY VOLLEY CLUB, 2026-07-30)
--   499 cobros de menores · 477 sin pagador · 345 pendientes impagables · $52.880.000
--   Ningún atleta adulto: en la práctica, ninguna familia podía pagar online.
--
-- ESTA MIGRACIÓN corrige los datos ya creados. La causa raíz se corrige en el BFF
-- (createPendingPayment resuelve children.parent_id; y el guard de create-session
-- acepta por tutela como defensa en profundidad).
--
-- Idempotente: solo toca filas con parent_id IS NULL.
-- ============================================================

BEGIN;

-- ── 1. El pagador de un menor es su acudiente en `children` ────────────────────
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

-- ── 2. Reporte: qué quedó y qué NO se pudo arreglar ────────────────────────────
--
-- Lo que siga en 'sin_pagador' son menores SIN acudiente vinculado en `children`
-- (children.parent_id IS NULL): no hay a quién asignarles el cobro. Esos requieren
-- vincular primero el acudiente al menor — no se puede resolver por SQL a ciegas.

SELECT s.name                                                     AS escuela,
       count(*)                                                   AS cobros_de_menores,
       count(*) FILTER (WHERE p.parent_id IS NOT NULL)             AS con_pagador,
       count(*) FILTER (WHERE p.parent_id IS NULL)                 AS sin_pagador_aun,
       count(*) FILTER (WHERE p.parent_id IS NULL
                          AND p.status = 'pending')                AS pendientes_impagables,
       sum(p.amount) FILTER (WHERE p.parent_id IS NULL
                          AND p.status = 'pending')                AS monto_atascado
  FROM public.payments p
  JOIN public.schools s  ON s.id = p.school_id
 WHERE p.child_id IS NOT NULL
 GROUP BY s.name
 HAVING count(*) > 0
 ORDER BY 5 DESC, 2 DESC;
