-- ============================================================================
-- DYNASTY — re-rotular cada pago al mes que de verdad cubre
-- Fecha: 2026-08-12
-- Detectado con: node scripts/audit-periodo-vs-fecha-pago.mjs --school Dynasty
--
-- CONFIRMADO POR LA ESCUELA: los pagos que entraron son de AGOSTO. Los que
-- quedaron rotulados a julio o a septiembre están mal etiquetados. La única
-- excepción real es Violeta del Campo, que sí pagó dos meses adelantados.
--
-- Los 13 pagos rotulados a julio los aprobó la misma cuenta de la escuela
-- (dynastyallstar333@gmail.com), pero eso NO significa que la escuela eligiera
-- el mes. Verificado por el formato del concepto, que delata el origen:
--
--     Mensualidad MM/AAAA - nombre   332 filas   generación de mes (sistema)
--     Plan PLAN X                    264 filas   asignación de plan (sistema)
--     Mensualidad (pelado)            11 filas   creado A MANO
--
--   · 10 de los 13 dicen 'Plan PLAN X': los creó `emitPlanCharge` y el periodo
--     salió de `billingDue` leyendo la fecha de inscripción VIEJA. La escuela
--     solo aprobó el pago contra un cobro que ya existía con julio puesto.
--     María Paula —el error confirmado— es una de estas 10, firma idéntica.
--   · 1 (Juana Torres) salió del lote del 30-jul, donde de 289 cobros generados
--     288 quedaron en 08/2026 y el suyo fue el ÚNICO 07/2026.
--   · 1 (Laura Sofía Fajardo) sí es de la escuela: concepto pelado, efectivo,
--     creada y aprobada en el mismo minuto, periodo 07 explícito. SE QUEDA.
--
-- Y el contraste que cierra el caso: de los 28 pagos por PASARELA, cero están
-- desalineados. Cuando la fecha la pone el proveedor, el mes sale bien.
--
-- ⚠️ EL ORDEN IMPORTA: uniq_payment_active_period_per_child prohíbe dos cobros
-- ACTIVOS del mismo (atleta, año, mes). Donde ya hay un agosto impago, primero
-- se cancela y después se re-rotula, o el UPDATE falla con un 23505 críptico.
--
-- Idempotente: cada UPDATE exige el periodo de origen esperado, así que
-- re-ejecutarlo no hace nada. Nunca borra: cancelar es reversible.
-- ============================================================================

-- ── §0 PREFLIGHT — foto antes de tocar nada (no modifica) ───────────────────
SELECT 'PREFLIGHT' AS bloque, p.id, p.status, p.amount, p.payment_date,
       p.period_year, p.period_month, COALESCE(c.full_name, pr.full_name) AS atleta
  FROM public.payments p
  LEFT JOIN public.children c  ON c.id = p.child_id
  LEFT JOIN public.profiles pr ON pr.id = p.user_id
 WHERE p.id IN (
   'f62f9783-926f-48c7-977b-48113a04467a',  -- MARIA JOSE MORENO SALAS
   'fe08e37f-85e6-4b3b-8b5a-4b9e736736b0',  -- MARIANA MORENO ZULUAGA
   'c4d1fe56-1daa-4f09-9da1-0c0902c04bd1',  -- SALOME PAMPLONA MARIN
   'e9fe4884-3da0-4c96-b792-9609f4d920ac',  -- SARA SOFIA DAZA QUINTERO
   '79094b7c-c44c-4a7c-ad76-50dea0f63265',  -- VALERIA ALEXANDRA SANABRIA VEL
   'b0f300d2-99f9-40f1-9715-fb3c18da9d8f',  -- HADE SOFIA PRADA ACERO
   'eee02bb6-41a1-497e-98b6-2172a40e3491',  -- MARIA CAMILA BECERRA REY
   '59b2a46b-c04c-4d01-8fa6-f9de17ffbca8',  -- ISABELLA CALERO GONZALEZ
   '414c3214-4ef6-4b49-b412-3a31a12f1b5b',  -- GABRIELA HERNANDEZ RONDON
   '9087a4cd-ff7e-46f8-880d-6ebe048f00b9',  -- SARAH MICHELLE ROMERO C
   '40c98490-4664-4850-94d7-1ef0dea47065',  -- LAURA SOFIA FAJARDO RINCON
   'fa3faf4b-7781-4664-942c-8600da8f9721',  -- María Natalia Lemus Díaz
   'c0c78f0c-d5d2-4bc5-b079-f9e433f345a4',  -- MARIA PAULA ESCOBAR BENITEZ
   '70188a75-0fb0-4e31-901a-961fda4aed27',  -- JUAN SEBASTIAN ROMERO AGUDELO
   '9ef59758-d69e-4024-bb34-3f255867d029',  -- JUAN JOSE PEÑA
   '623c7046-a340-47f9-bd27-7ec857d78ef7',  -- JUANA TORRES LEON
   'f65beca9-4b8c-45b6-a763-c1403839c761',  -- Anderson Alexander González Ru
   '20e8ed8e-cb9b-4b9f-8ac8-3cfba2c97d28',  -- camila andrea pineda pinzon
   '2c5bfa39-f901-41fa-be0b-5172b27b7758'  -- Miguel Ángel Runza Ramírez
 )
 ORDER BY atleta;


-- ════════════════════════════════════════════════════════════════════════════
-- §A · RE-ROTULAR A AGOSTO — sin choque (10 pagos)
-- ------------------------------------------------------------
-- Pagaron en agosto y el cobro quedó rotulado a otro mes. Su cobro de agosto
-- anterior está cancelado o no existe, así que el re-rótulo entra sin conflicto.
-- Al corregirlos, agosto queda facturado y julio deja de aparecer como deuda.
-- ════════════════════════════════════════════════════════════════════════════
-- MARIA JOSE MORENO SALAS — pagó 2026-08-10 (cash) $180.000, hoy rotulado 2026-7
UPDATE public.payments SET period_year = 2026, period_month = 8, updated_at = now()
 WHERE id = 'f62f9783-926f-48c7-977b-48113a04467a' AND period_year = 2026 AND period_month = 7;
-- MARIANA MORENO ZULUAGA — pagó 2026-08-12 (transfer) $150.000, hoy rotulado 2026-7
UPDATE public.payments SET period_year = 2026, period_month = 8, updated_at = now()
 WHERE id = 'fe08e37f-85e6-4b3b-8b5a-4b9e736736b0' AND period_year = 2026 AND period_month = 7;
-- SALOME PAMPLONA MARIN — pagó 2026-08-04 (cash) $150.000, hoy rotulado 2026-9
UPDATE public.payments SET period_year = 2026, period_month = 8, updated_at = now()
 WHERE id = 'c4d1fe56-1daa-4f09-9da1-0c0902c04bd1' AND period_year = 2026 AND period_month = 9;
-- SARA SOFIA DAZA QUINTERO — pagó 2026-08-12 (transfer) $210.000, hoy rotulado 2026-7
UPDATE public.payments SET period_year = 2026, period_month = 8, updated_at = now()
 WHERE id = 'e9fe4884-3da0-4c96-b792-9609f4d920ac' AND period_year = 2026 AND period_month = 7;
-- VALERIA ALEXANDRA SANABRIA VELASQUEZ — pagó 2026-08-08 (transfer) $90.000, hoy rotulado 2026-7
UPDATE public.payments SET period_year = 2026, period_month = 8, updated_at = now()
 WHERE id = '79094b7c-c44c-4a7c-ad76-50dea0f63265' AND period_year = 2026 AND period_month = 7;
-- HADE SOFIA PRADA ACERO — pagó 2026-08-05 (cash) $180.000, hoy rotulado 2026-7
UPDATE public.payments SET period_year = 2026, period_month = 8, updated_at = now()
 WHERE id = 'b0f300d2-99f9-40f1-9715-fb3c18da9d8f' AND period_year = 2026 AND period_month = 7;
-- MARIA CAMILA BECERRA REY — pagó 2026-08-09 (transfer) $90.000, hoy rotulado 2026-7
UPDATE public.payments SET period_year = 2026, period_month = 8, updated_at = now()
 WHERE id = 'eee02bb6-41a1-497e-98b6-2172a40e3491' AND period_year = 2026 AND period_month = 7;
-- ISABELLA CALERO GONZALEZ — pagó 2026-08-10 (cash) $210.000, hoy rotulado 2026-7
UPDATE public.payments SET period_year = 2026, period_month = 8, updated_at = now()
 WHERE id = '59b2a46b-c04c-4d01-8fa6-f9de17ffbca8' AND period_year = 2026 AND period_month = 7;
-- GABRIELA HERNANDEZ RONDON — pagó 2026-08-10 (transfer) $180.000, hoy rotulado 2026-7
UPDATE public.payments SET period_year = 2026, period_month = 8, updated_at = now()
 WHERE id = '414c3214-4ef6-4b49-b412-3a31a12f1b5b' AND period_year = 2026 AND period_month = 7;
-- SARAH MICHELLE ROMERO C — pagó 2026-08-10 (transfer) $180.000, hoy rotulado 2026-7
UPDATE public.payments SET period_year = 2026, period_month = 8, updated_at = now()
 WHERE id = '9087a4cd-ff7e-46f8-880d-6ebe048f00b9' AND period_year = 2026 AND period_month = 7;

-- ════════════════════════════════════════════════════════════════════════════
-- §B · CANCELAR EL AGOSTO IMPAGO Y LUEGO RE-ROTULAR (6 casos)
-- ------------------------------------------------------------
-- Estos ya pagaron agosto (con el rótulo equivocado) y ADEMÁS tienen un cobro
-- de agosto impago: ese es el duplicado que la familia ve como deuda y el que
-- disparaba el recordatorio. Se cancela el impago y el pago real cubre agosto.
-- ════════════════════════════════════════════════════════════════════════════
-- LAURA SOFIA FAJARDO RINCON — SE QUEDA EN JULIO, no se toca.
--   Es el ÚNICO de los 13 donde la escuela eligió el mes de verdad: concepto
--   'Mensualidad' pelado (el formato de los 11 creados a mano), efectivo, creada
--   y aprobada en el mismo minuto (2026-08-01 13:58), y el periodo 07 escrito
--   explícito mientras el vencimiento quedó en agosto. Los otros 12 traen
--   'Plan PLAN X' o 'Mensualidad MM/AAAA', que los genera el sistema.
--   Regla del dueño (2026-08-12): julio se queda donde la escuela lo seleccionó.
--   Consecuencia: pagó julio y su cobro de agosto ($150.000, id=2b299366) sigue
--   PENDIENTE con razón — es deuda real de agosto, no un duplicado.
-- María Natalia Lemus Díaz — pagó 2026-08-05 (transfer) $150.000, hoy rotulado 2026-9
UPDATE public.payments SET status = 'cancelled',
       rejection_reason = 'Agosto ya pagado el 2026-08-05; ese pago estaba rotulado a 2026-9 (auditoria 2026-08-12)',
       updated_at = now()
 WHERE id = 'eda610ea-7283-4cdd-96d5-fcbae3f6529e' AND status = 'pending';
UPDATE public.payments SET period_year = 2026, period_month = 8, updated_at = now()
 WHERE id = 'fa3faf4b-7781-4664-942c-8600da8f9721' AND period_year = 2026 AND period_month = 9;
-- MARIA PAULA ESCOBAR BENITEZ — pagó 2026-08-05 (transfer) $210.000, hoy rotulado 2026-7
UPDATE public.payments SET status = 'cancelled',
       rejection_reason = 'Agosto ya pagado el 2026-08-05; ese pago estaba rotulado a 2026-7 (auditoria 2026-08-12)',
       updated_at = now()
 WHERE id = '519eecc8-de24-4ef1-957c-1fa1e98cf484' AND status = 'pending';
UPDATE public.payments SET period_year = 2026, period_month = 8, updated_at = now()
 WHERE id = 'c0c78f0c-d5d2-4bc5-b079-f9e433f345a4' AND period_year = 2026 AND period_month = 7;
-- JUAN SEBASTIAN ROMERO AGUDELO — pagó 2026-08-04 (transfer) $150.000, hoy rotulado 2026-9
UPDATE public.payments SET status = 'cancelled',
       rejection_reason = 'Agosto ya pagado el 2026-08-04; ese pago estaba rotulado a 2026-9 (auditoria 2026-08-12)',
       updated_at = now()
 WHERE id = 'c8c2983a-9f6c-4a6e-b6e2-7e080bb36ebf' AND status = 'pending';
UPDATE public.payments SET period_year = 2026, period_month = 8, updated_at = now()
 WHERE id = '70188a75-0fb0-4e31-901a-961fda4aed27' AND period_year = 2026 AND period_month = 9;
-- JUAN JOSE PEÑA — pagó 2026-08-05 (transfer) $210.000, hoy rotulado 2026-7
UPDATE public.payments SET status = 'cancelled',
       rejection_reason = 'Agosto ya pagado el 2026-08-05; ese pago estaba rotulado a 2026-7 (auditoria 2026-08-12)',
       updated_at = now()
 WHERE id = '19393b70-9128-4e85-aca0-a2d321a170d5' AND status = 'pending';
UPDATE public.payments SET period_year = 2026, period_month = 8, updated_at = now()
 WHERE id = '9ef59758-d69e-4024-bb34-3f255867d029' AND period_year = 2026 AND period_month = 7;
-- JUANA TORRES LEON — pagó 2026-08-04 (transfer) $150.000, hoy rotulado 2026-7
UPDATE public.payments SET status = 'cancelled',
       rejection_reason = 'Agosto ya pagado el 2026-08-04; ese pago estaba rotulado a 2026-7 (auditoria 2026-08-12)',
       updated_at = now()
 WHERE id = '8f202d6e-81e5-4e82-b485-aafc095158d6' AND status = 'pending';
UPDATE public.payments SET period_year = 2026, period_month = 8, updated_at = now()
 WHERE id = '623c7046-a340-47f9-bd27-7ec857d78ef7' AND period_year = 2026 AND period_month = 7;

-- ════════════════════════════════════════════════════════════════════════════
-- §D · PONER EL PERIODO QUE FALTA (3 pagos)
-- ------------------------------------------------------------
-- Pagados en agosto y SIN period_year/period_month. Los índices únicos son
-- PARCIALES (exigen period NOT NULL), así que sin periodo un cobro se escapa del
-- dedup y hoy nada impide que se le duplique el mes.
-- Verificado: ninguno de los tres tiene otro cobro de agosto, no hay choque.
-- ════════════════════════════════════════════════════════════════════════════
-- Anderson Alexander González Ruiz — pagó 2026-08-10 (transfer) $130.000
UPDATE public.payments SET period_year = 2026, period_month = 8, updated_at = now()
 WHERE id = 'f65beca9-4b8c-45b6-a763-c1403839c761' AND period_year IS NULL AND period_month IS NULL;
-- camila andrea pineda pinzon — pagó 2026-08-10 (transfer) $130.000
UPDATE public.payments SET period_year = 2026, period_month = 8, updated_at = now()
 WHERE id = '20e8ed8e-cb9b-4b9f-8ac8-3cfba2c97d28' AND period_year IS NULL AND period_month IS NULL;
-- Miguel Ángel Runza Ramírez — pagó 2026-08-09 (transfer) $150.000
UPDATE public.payments SET period_year = 2026, period_month = 8, updated_at = now()
 WHERE id = '2c5bfa39-f901-41fa-be0b-5172b27b7758' AND period_year IS NULL AND period_month IS NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- §C · NO SE TOCA — prepago legítimo (2 pagos)
-- ------------------------------------------------------------
--   VIOLETA DEL CAMPO GARZON — pagó 2026-08-03 $180.000, rotulado 2026-9
--   VIOLETA DEL CAMPO GARZON — pagó 2026-08-03 $180.000, rotulado 2026-10
-- Violeta del Campo pagó agosto, septiembre y octubre: su agosto ya está pagado
-- aparte, así que estos dos rótulos son correctos. Es el único prepago multimes
-- real de la escuela y el script lo detecta solo (choca con un agosto PAGADO,
-- no impago).
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- §E · LOS DOS QUE PAGARON EL 30-JUL — también son de agosto
-- ------------------------------------------------------------
-- No entraron en §A/§B porque su `payment_date` cae en JULIO (el filtro de este
-- script son los pagos de agosto), pero tienen la misma forma que los 11 que
-- pagaron entre el 28 y el 31 de julio y sí quedaron rotulados a agosto.
-- Confirmado por el dueño (2026-08-12): son de agosto.
-- Los dos tienen un cobro de agosto impago que pasa a ser el duplicado.
-- ════════════════════════════════════════════════════════════════════════════

-- E.1 · MARIA XIMENA ROJAS PINEDA — pagó $150.000 el 2026-07-30 (efectivo)
--       Inscripción activa desde el 2026-07-30. Mismo monto en los dos cobros,
--       así que el cruce es limpio.
UPDATE public.payments SET status = 'cancelled',
       rejection_reason = 'Agosto ya pagado el 2026-07-30; ese pago estaba rotulado a 2026-07 (auditoria 2026-08-12)',
       updated_at = now()
 WHERE id = '67232118-5035-4324-840d-f85ee1014be6' AND status = 'pending';
UPDATE public.payments SET period_year = 2026, period_month = 8, updated_at = now()
 WHERE id = 'dd3ac7ae-4a0c-4b40-8478-7c5508e518e0' AND period_year = 2026 AND period_month = 7;

-- E.2 · JUAN MARTIN FORERO PINZON — pagó $150.000 el 2026-07-30 (transferencia)
--       Concepto «Primer pago», otro de los formatos hechos a mano. Su
--       inscripción activa arranca el 2026-08-02: en julio NO existía, así que
--       julio no podía ser su mes.
--       ⚠️ Los montos NO coinciden: pagó $150.000 y su cuota actual es $90.000
--       porque le cambiaron el plan a PLAN START. Se cancela el pendiente de
--       agosto ($90.000) porque ya pagó más que eso por ese mes; si la escuela
--       quiere devolver o abonar la diferencia de $60.000, es decisión suya.
UPDATE public.payments SET status = 'cancelled',
       rejection_reason = 'Agosto ya pagado el 2026-07-30 por $150.000 (rotulado a 2026-07); cuota actual $90.000 (auditoria 2026-08-12)',
       updated_at = now()
 WHERE id = '6bb56715-92e1-4f52-bffa-f2800dbba8a9' AND status = 'pending';
UPDATE public.payments SET period_year = 2026, period_month = 8, updated_at = now()
 WHERE id = '785cad3d-63e3-465d-bdc3-7ed236124452' AND period_year = 2026 AND period_month = 7;

-- ── §Z VERIFICACIÓN — debe devolver EXACTAMENTE 3 filas ────────────────────
--   · VIOLETA DEL CAMPO ×2 (periodos 9 y 10): prepago multimes legítimo (§C)
--   · LAURA SOFIA FAJARDO (periodo 7): se queda en julio a propósito, es la
--     única donde la escuela eligió el mes (ver §B)
-- Cualquier otra fila significa que quedó un pago de agosto mal rotulado.
SELECT p.id, COALESCE(c.full_name, pr.full_name) AS atleta, p.payment_date,
       p.period_year, p.period_month, p.amount
  FROM public.payments p
  LEFT JOIN public.children c  ON c.id = p.child_id
  LEFT JOIN public.profiles pr ON pr.id = p.user_id
 WHERE p.school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
   AND p.status IN ('paid','partial')
   AND to_char(p.payment_date, 'YYYY-MM') = '2026-08'
   AND (p.period_year IS DISTINCT FROM 2026 OR p.period_month IS DISTINCT FROM 8)
 ORDER BY atleta;
