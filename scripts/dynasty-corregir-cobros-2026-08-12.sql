-- ============================================================================
-- DYNASTY — corrección de cobros duplicados, mora falsa y periodo mal rotulado
-- Fecha: 2026-08-12
-- Detectado con: node scripts/audit-cobros-duplicados.mjs --school Dynasty
--
-- ES DINERO DE FAMILIAS REALES. Reglas que sigue este script:
--   · Nunca borra: 'cancelled' es reversible.
--   · Solo actúa sobre ids EXPLÍCITOS, verificados uno por uno contra la base.
--   · Idempotente: cada UPDATE exige el estado de origen esperado, así que
--     re-ejecutarlo no hace nada la segunda vez.
--   · No toca los casos ambiguos. Están listados al final en §5.
--
-- Ejecutar en el SQL editor por bloques y leer el SELECT final de cada uno.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- §0 · PREFLIGHT — foto antes de tocar nada (no modifica)
-- ────────────────────────────────────────────────────────────────────────────
SELECT 'PREFLIGHT' AS bloque, p.id, p.status, p.amount, p.due_date,
       p.period_year, p.period_month, p.created_at::date AS creado,
       COALESCE(c.full_name, pr.full_name) AS atleta, p.concept
  FROM public.payments p
  LEFT JOIN public.children c  ON c.id = p.child_id
  LEFT JOIN public.profiles pr ON pr.id = p.user_id
 WHERE p.id IN (
   -- §1 duplicados de identidad gemela
   '0d9b81dd-4903-4439-8075-b0653bf19f8f',  -- Gabriela Buitrago  $180.000
   'c7cc5ae6-033b-4abc-aa71-35375be947c1',  -- Gabriela Simbaqueva $180.000
   'b5736a03-75a8-4d25-8ed6-a92c6d25f68e',  -- Gabriela Núñez     $150.000
   '9e05a9e0-cef5-4555-b7a8-81a2699916e1',  -- Juanita Ramírez     $150.000
   -- §2 nacidos vencidos
   '6f1061d8-4e93-43a7-8146-621f9fbd3949',  -- Salomé Montenegro   $90.000
   'bc4c4839-25ff-428f-b06b-7572d0e8430d',  -- Laura Valentina Soto $150.000
   '18c81ebf-124b-4598-95c7-9b59cb5f9c43',  -- Sara Isabella Hdez  $210.000
   'd6166d79-6dc6-49ff-8e97-7f40cbf48a60',  -- Alisson Novoa       $150.000
   'db255177-0a8f-4df5-b68d-363962fa5ad5',  -- Daniela Beltrán     $180.000
   -- §3 periodo mal rotulado
   'c0c78f0c-d5d2-4bc5-b079-f9e433f345a4',  -- María Paula PAGADO (jul→ago)
   '519eecc8-de24-4ef1-957c-1fa1e98cf484'   -- María Paula pending agosto
 )
 ORDER BY atleta, p.created_at;


-- ════════════════════════════════════════════════════════════════════════════
-- §1 · CANCELAR el cobro duplicado que vive en la ficha gemela
-- ------------------------------------------------------------
-- La persona existe dos veces en la escuela. Pagó por una ficha y la otra
-- quedó con el cobro del MISMO mes abierto. Los tres primeros además tienen
-- parent_id NULL, así que la familia no podía pagarlos ni queriendo.
-- Se cancela el impago; el pagado no se toca.
-- ════════════════════════════════════════════════════════════════════════════
UPDATE public.payments
   SET status = 'cancelled',
       rejection_reason = 'Duplicado: la misma persona ya pagó este periodo en su otra ficha (auditoría 2026-08-12)',
       updated_at = now()
 WHERE id IN (
   '0d9b81dd-4903-4439-8075-b0653bf19f8f',  -- gemela pagó $210.000 el 4-ago
   'c7cc5ae6-033b-4abc-aa71-35375be947c1',  -- gemela pagó $180.000 el 5-ago
   'b5736a03-75a8-4d25-8ed6-a92c6d25f68e'   -- gemela pagó $180.000 el 12-ago
 )
   AND status = 'pending';   -- idempotente

-- §1.4 · Ramírez Medina: misma niña con el documento mal digitado
--        (1141375184 vs 1141335184, misma fecha de nacimiento y mismo correo).
--        Ninguno de los dos está pagado → se conserva el MÁS ANTIGUO
--        (b6afeb34, creado 30-jul) y se cancela el posterior.
UPDATE public.payments
   SET status = 'cancelled',
       rejection_reason = 'Duplicado por documento mal digitado; se conserva el cobro b6afeb34 (auditoría 2026-08-12)',
       updated_at = now()
 WHERE id = '9e05a9e0-cef5-4555-b7a8-81a2699916e1'  -- JUANITA…, creado 5-ago
   AND status = 'pending';

-- Los CUATRO, incluido el de §1.4: la primera versión de este SELECT listaba
-- solo tres y escondía justo el que se cancela aparte.
SELECT '§1 cancelados' AS bloque, id, status, amount, rejection_reason
  FROM public.payments
 WHERE id IN ('0d9b81dd-4903-4439-8075-b0653bf19f8f',
              'c7cc5ae6-033b-4abc-aa71-35375be947c1',
              'b5736a03-75a8-4d25-8ed6-a92c6d25f68e',
              '9e05a9e0-cef5-4555-b7a8-81a2699916e1');


-- ════════════════════════════════════════════════════════════════════════════
-- §2 · QUITAR LA MORA FALSA de los cobros que nacieron vencidos
-- ------------------------------------------------------------
-- Cobros creados con `due_date` YA PASADA (se emitieron al asignar el plan con
-- el vencimiento de la ficha vieja). Nacieron en mora: la familia nunca tuvo un
-- día para pagarlos a tiempo.
--
-- Regla de negocio: un atleta que se inscribe después NO puede nacer vencido.
-- Paga ese mismo día o después, nunca antes de existir.
--
-- Pero hay DOS situaciones distintas y se corrigen distinto, según cuándo
-- arranca la inscripción ACTIVA (verificado una por una):
--
--   2.a · Inscripción activa desde el 30-jul / 1-ago → el mes que cursan es
--         AGOSTO. El cobro está mal rotulado a julio. Si solo se re-fecha y se
--         deja en julio, la próxima apertura les emite agosto y vuelve el
--         duplicado. Se re-rotula a agosto Y se re-fecha.
--         Verificado: ninguno de los 4 tiene ya un cobro activo de agosto, así
--         que el re-rotulado no choca con uniq_payment_active_period_per_child.
--
--   2.b · Salomé: su cobro de julio se CANCELA. Agosto ya lo pagó aparte
--         ($90.000, periodo 2026-8) y julio nunca fue un mes facturable en esta
--         escuela, así que ese cobro es el mismo artefacto del sistema.
--         (Revisado el 2026-08-12: la versión inicial lo trataba como deuda
--         legítima y eso era pedirle plata que no debe.)
--
-- El vencimiento nuevo es hoy + 5 días. Para usar el día de corte de la escuela
-- en vez de +5, cambiar el INTERVAL.
-- ════════════════════════════════════════════════════════════════════════════

-- 2.a · Mal rotulados a julio: su primer mes es AGOSTO
--
-- `late_fee_amount` va en 0, NO en NULL: la columna es NOT NULL con default 0
-- (verificado: 661 filas de la escuela, todas en 0). Ponerle NULL revienta con
-- «23502: null value in column late_fee_amount violates not-null constraint».
-- `late_fee_applied_at` sí es nullable.
UPDATE public.payments
   SET period_year         = 2026,
       period_month        = 8,
       due_date            = CURRENT_DATE + INTERVAL '5 days',
       status              = 'pending',
       late_fee_amount     = 0,
       late_fee_applied_at = NULL,
       updated_at          = now()
 WHERE id IN (
   'bc4c4839-25ff-428f-b06b-7572d0e8430d',  -- Laura Valentina, activa 1-ago
   '18c81ebf-124b-4598-95c7-9b59cb5f9c43',  -- Sara Isabella,   activa 1-ago
   'd6166d79-6dc6-49ff-8e97-7f40cbf48a60',  -- Alisson Novoa,   activa 1-ago
   'db255177-0a8f-4df5-b68d-363962fa5ad5'   -- Daniela Beltrán, activa 30-jul
 )
   AND status = 'overdue'
   AND period_month = 7;   -- idempotente

-- 2.b · Salomé Montenegro: su julio se CANCELA, no se re-fecha.
--
-- Decisión del dueño (2026-08-12), corrigiendo el supuesto inicial de este
-- script. La primera versión lo trataba como deuda legítima —entró el 6-jul,
-- «cursó julio»— y solo le quitaba la mora. Ese supuesto se cae con la
-- evidencia:
--   · El piso de facturación de Dynasty es AGOSTO: de 452 atletas activos,
--     julio solo tiene los cobros sueltos de este mismo artefacto.
--   · Su cobro lleva concepto 'Plan PLAN START', que solo produce
--     `emitPlanCharge`: lo creó el sistema el 2026-08-06 con el periodo tomado
--     de la fecha de inscripción vieja, naciendo con 27 días de mora.
--   · Su AGOSTO ya está pagado ($90.000 el 2026-08-07, id=ec3bf88b), así que
--     tampoco se puede re-rotular: chocaría con un agosto pagado.
-- Es el mismo artefacto que en los otros 12, solo que en su caso agosto también
-- se generó y se pagó. Cobrarle julio sería pedirle plata que no debe.
UPDATE public.payments
   SET status = 'cancelled',
       rejection_reason = 'Julio no se facturaba en esta escuela; cobro creado por la asignacion de plan con periodo de la inscripcion vieja. Agosto pagado el 2026-08-07 (auditoria 2026-08-12)',
       late_fee_amount     = 0,        -- NOT NULL: ver nota en 2.a
       late_fee_applied_at = NULL,
       updated_at          = now()
 WHERE id = '6f1061d8-4e93-43a7-8146-621f9fbd3949'
   AND status = 'overdue';   -- idempotente

SELECT '§2 corregidos' AS bloque, id, status, amount, period_year, period_month,
       due_date, late_fee_amount
  FROM public.payments
 WHERE id IN ('6f1061d8-4e93-43a7-8146-621f9fbd3949',
              'bc4c4839-25ff-428f-b06b-7572d0e8430d',
              '18c81ebf-124b-4598-95c7-9b59cb5f9c43',
              'd6166d79-6dc6-49ff-8e97-7f40cbf48a60',
              'db255177-0a8f-4df5-b68d-363962fa5ad5');


-- ════════════════════════════════════════════════════════════════════════════
-- §3 · MARÍA PAULA ESCOBAR BENÍTEZ — el pago quedó rotulado al mes anterior
-- ------------------------------------------------------------
-- Su inscripción ACTIVA arranca el 2026-08-05. La escuela le creó el 5-ago un
-- cobro de $210.000 rotulado a JULIO (vencimiento 30-jul, el día de la ficha
-- vieja que quedó cancelada) y lo marcó pagado. Al día siguiente la apertura de
-- agosto generó OTRO cobro de $210.000. Pagó una vez y le cobran dos.
--
-- Corrección: el pago es de AGOSTO → se re-rotula, y se cancela el de agosto.
-- (Julio no se factura: su inscripción de julio está cancelada.)
--
-- ⚠️ EL ORDEN IMPORTA: `uniq_payment_active_period_per_child` prohíbe dos cobros
-- activos del mismo (child_id, año, mes). Si se re-rotula el pagado a agosto
-- ANTES de cancelar el pending de agosto, el UPDATE falla con 23505. Primero
-- se cancela, después se re-rotula.
-- ════════════════════════════════════════════════════════════════════════════

-- 3.a · PRIMERO cancelar el cobro de agosto duplicado
UPDATE public.payments
   SET status = 'cancelled',
       rejection_reason = 'Agosto ya estaba pagado con c0c78f0c, que había quedado rotulado a julio (auditoría 2026-08-12)',
       updated_at = now()
 WHERE id = '519eecc8-de24-4ef1-957c-1fa1e98cf484'
   AND status = 'pending';   -- idempotente

-- 3.b · DESPUÉS re-rotular el pago a su periodo real
UPDATE public.payments
   SET period_year  = 2026,
       period_month = 8,
       concept      = 'Mensualidad Agosto 2026',
       updated_at   = now()
 WHERE id = 'c0c78f0c-d5d2-4bc5-b079-f9e433f345a4'
   AND status = 'paid'
   AND period_month = 7;   -- idempotente

SELECT '§3 María Paula' AS bloque, id, status, amount, period_year, period_month, concept
  FROM public.payments
 WHERE child_id = '4dd5ac0a-3270-4d28-9900-cf35227e3473'
 ORDER BY created_at;


-- ════════════════════════════════════════════════════════════════════════════
-- §4 · LAURA VALENTINA SOTO SÁENZ — segunda inscripción activa (bug F0)
-- ------------------------------------------------------------
-- Una sola persona con DOS inscripciones activas. La del 10-ago no tiene plan
-- ni cuota (se creó al agregarle un segundo equipo, que por diseño debería ser
-- una categoría de la inscripción existente, no una inscripción nueva).
-- Mientras siga activa, la próxima apertura de mes le emite un segundo cobro.
-- ════════════════════════════════════════════════════════════════════════════
UPDATE public.enrollments
   SET status = 'cancelled', updated_at = now()
 WHERE id = '0610967b-986f-4a8b-a996-729392a1ab4a'
   AND status = 'active'
   AND offering_plan_id IS NULL
   AND monthly_fee IS NULL;   -- solo si sigue siendo la incompleta

-- El sujeto va en `child_id`, NO en `user_id`: Laura Valentina es menor. La
-- primera versión de este SELECT filtraba por user_id y devolvía CERO filas,
-- así que el bloque parecía haber fallado cuando en realidad había funcionado.
SELECT '§4 Laura Valentina' AS bloque, id, status, team_id, offering_plan_id, monthly_fee, start_date
  FROM public.enrollments
 WHERE child_id = '51624a9e-59a2-4682-97d6-851ede27e8d2'
 ORDER BY created_at;


-- ════════════════════════════════════════════════════════════════════════════
-- §5 · LO QUE NO TOCA ESTE SCRIPT — requiere decisión de la escuela
-- ============================================================================
-- 5.1 · MARÍA CAMILA VALDERRAMA — ¿una niña o dos?
--       'María Camila Valderrama'        doc=10320076657 (11 dígitos, inválido)
--                                        acudiente leonardo.valenciamh@outlook.com  cuota $150.000
--       'MARIA CAMILA VALDERRAMA JULIO'  doc=110237637   nac=2015-04-05
--                                        acudiente ladyjuzo@gmail.com               cuota $90.000
--       Mismo nombre pero documentos sin parecido, acudientes distintos y cuotas
--       distintas. Si son la misma, cancelar uno de los dos cobros; si son dos
--       niñas, ambos son correctos. NO se puede decidir con los datos.
--       Cobros vivos: 0ad83129 ($150.000) y dfba2b9d ($90.000).
--
-- 5.2 · JUAN JOSÉ PEÑA y LAURA SOFÍA FAJARDO — NO son error.
--       Salieron en el eje E (pago rotulado al mes anterior) pero su inscripción
--       activa arranca el 6-jul: cursaron julio y deben agosto de verdad.
--       Sus cobros de agosto se dejan como están.
--
-- 5.3 · Los 10 atletas con doble ficha facturable (eje C) — $1.230.000/mes.
--       Cancelar el cobro no alcanza: hay que FUSIONAR las identidades
--       (trasladar equipo/cuota/pagos a la que sobrevive, vincular la absorbida
--       vía linked_profile_id y cancelar su inscripción). Va por el
--       procedimiento de docs/plan-fusion-identidades-duplicadas.md, no acá.
--
-- 5.4 · Pagos que cubren VARIOS MESES — revisado, sin problema en Dynasty.
--       Se buscaron tres señales: sobrepago (amount_paid > amount) = 0 casos,
--       concepto que menciona varios meses = 0 casos, y un mismo comprobante
--       aplicado a varios cobros = 1 caso (sep + oct de $180.000 cada uno,
--       AMBOS marcados 'paid'). Ese quedó bien aplicado: no dispara recordatorio.
--       Si aparecen más adelante, el riesgo es que solo se marque pagado UNO de
--       los meses cubiertos y los otros queden reclamando deuda.
--
-- 5.5 · Verificación final: correr de nuevo el barrido y confirmar que
--       los ejes B, D y E quedan en 0 salvo lo listado en 5.1–5.3.
--         node scripts/audit-cobros-duplicados.mjs --school Dynasty
-- ============================================================================
