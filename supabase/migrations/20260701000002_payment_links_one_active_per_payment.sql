-- ============================================================
-- SPORTMAPS — Fix H-05 (auditoria de duplicacion de pagos)
--
-- Problema: POST /create-session hace check-then-insert de payment_links
-- SIN unico sobre payment_id. Dos requests concurrentes (doble clic, dos
-- pestañas) hacen ambos el SELECT, ninguno halla link vigente, y ambos
-- INSERT -> 2 links 'pending' con referencias distintas -> el usuario
-- puede pagar dos veces la misma deuda (2 splits distintos).
--
-- Fix: un unico parcial que garantice UNA sola link 'pending' por
-- payment_id. OJO: no existe proceso que marque 'expired' los pending
-- vencidos por tiempo, asi que primero se limpian para no bloquear el
-- checkout legitimo posterior a la expiracion (72h). El BFF ademas
-- expira los pending vencidos antes de insertar y captura el 23505
-- reusando el link vigente.
-- ============================================================

-- 1. Expirar links 'pending' ya vencidos por tiempo: no representan un
--    checkout activo y no deben bloquear uno nuevo.
UPDATE public.payment_links
   SET status = 'expired', updated_at = now()
 WHERE status = 'pending'
   AND expires_at < now();

-- 2. Colisiones historicas: si un payment_id tiene >1 link 'pending' aun
--    vigente (producto de la carrera), conservar el mas reciente y expirar
--    el resto, para que el indice unico pueda crearse sin fallar.
WITH ranked AS (
    SELECT id,
           row_number() OVER (
               PARTITION BY payment_id
               ORDER BY created_at DESC, id DESC
           ) AS rn
      FROM public.payment_links
     WHERE status = 'pending'
)
UPDATE public.payment_links pl
   SET status = 'expired', updated_at = now()
  FROM ranked r
 WHERE pl.id = r.id
   AND r.rn > 1;

-- 3. Unico parcial: una sola link 'pending' por deuda. El insert concurrente
--    perdedor recibe 23505 y el BFF reusa el link ganador.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_links_one_pending_per_payment
    ON public.payment_links (payment_id)
    WHERE status = 'pending';

COMMENT ON INDEX public.uq_payment_links_one_pending_per_payment IS
    'Fix H-05: garantiza un solo payment_link pending por payment_id (anti doble checkout de la misma deuda).';
