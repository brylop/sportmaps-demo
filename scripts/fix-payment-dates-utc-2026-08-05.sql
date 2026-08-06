-- Corrección de `payments.payment_date` escritos con el día UTC.
-- APLICADO en la base compartida el 2026-08-05: 58 filas corregidas, verificación en 0.
--
-- CAUSA
-- `RegisterCashPaymentModal` (registro manual de pago, efectivo o transferencia)
-- guardaba `paymentDate.toISOString().split('T')[0]`. `toISOString()` pasa la
-- fecha LOCAL a UTC, así que registrar un pago pasadas las 7 p.m. hora Colombia
-- guardaba el día SIGUIENTE: el calendario mostraba "4 de agosto" (se pinta con
-- `format`, local) y en la base quedaba `2026-08-05`. Arreglado en el código con
-- `pickedDay()`; este script arregla las filas que ya estaban escritas.
--
-- Efecto visible que lo destapó: en Finanzas > Transacciones esos pagos se
-- sentaban en el tope del listado como si fueran los más recientes, y la columna
-- Fecha los mostraba un día antes por un segundo bug (parseo UTC al renderizar).
--
-- FILTRO
-- La firma `payment_date == día UTC de approved_at` Y `!= día Colombia` es
-- exclusiva de este bug: una fecha elegida a mano (un pago de hace tres días) no
-- coincide con el día UTC de la aprobación, así que no entra. Los pagos con
-- fecha futura del seed de "Club Campestre Demo" tampoco: no tienen approved_at.
--
-- Reparto de las 58: 26 MMA BLAIR TEAM, 15 Escuela Demo SportMaps,
-- 12 DYNASTY VOLLEY CLUB, 5 sueltas (Fit And Fight 2, Academia Superior Bogotá,
-- Felipe Rincón, Leonardo Castro, Cristiano Ronaldo). Todas se corrieron
-- exactamente un día hacia atrás; todas aprobadas entre 7 p.m. y medianoche.
--
-- SEGURIDAD DE TRIGGERS
-- `trg_payment_fee_to_expense_upd` es AFTER UPDATE **OF status**, así que tocar
-- solo `payment_date` no lo dispara (y aun si lo hiciera tiene
-- ON CONFLICT (source_payment_id) DO NOTHING). La base tiene triggers NO
-- versionados: si el conteo del paso 1 no coincide con lo esperado, parar.

-- ── 1) PREVIO: revisar qué se va a tocar ──────────────────────────────────────
SELECT s.name                                              AS escuela,
       p.payment_date                                      AS antes,
       (p.approved_at AT TIME ZONE 'America/Bogota')::date  AS despues,
       p.approved_at,
       p.payment_method,
       p.concept
  FROM public.payments p
  JOIN public.schools  s ON s.id = p.school_id
 WHERE p.approved_at  IS NOT NULL
   AND p.payment_date IS NOT NULL
   AND p.payment_date  = (p.approved_at AT TIME ZONE 'UTC')::date
   AND p.payment_date <> (p.approved_at AT TIME ZONE 'America/Bogota')::date
 ORDER BY p.approved_at DESC;

-- ── 2) CORREGIR ───────────────────────────────────────────────────────────────
UPDATE public.payments p
   SET payment_date = (p.approved_at AT TIME ZONE 'America/Bogota')::date
 WHERE p.approved_at  IS NOT NULL
   AND p.payment_date IS NOT NULL
   AND p.payment_date  = (p.approved_at AT TIME ZONE 'UTC')::date
   AND p.payment_date <> (p.approved_at AT TIME ZONE 'America/Bogota')::date;

-- ── 3) VERIFICAR: debe dar 0 ──────────────────────────────────────────────────
SELECT count(*) AS quedan_mal
  FROM public.payments p
 WHERE p.approved_at  IS NOT NULL
   AND p.payment_date IS NOT NULL
   AND p.payment_date  = (p.approved_at AT TIME ZONE 'UTC')::date
   AND p.payment_date <> (p.approved_at AT TIME ZONE 'America/Bogota')::date;
