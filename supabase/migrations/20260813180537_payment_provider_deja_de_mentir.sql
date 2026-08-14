-- ============================================================================
-- 20260813180537_payment_provider_deja_de_mentir.sql
-- Fecha: 2026-08-13   ·   DIN-3
-- Plan aprobado: docs/plan-payment-provider-default-fix.md
--
-- EL PROBLEMA. `payments.payment_provider` se creo con DEFAULT 'wompi'
-- (20260504000001_payment_provider_generic.sql), asi que TODA fila insertada sin
-- provider queda sellada como Wompi: efectivo, transferencias registradas a mano
-- y cobros emitidos por el sistema dicen todos "wompi".
--
-- Medido en la base el 2026-08-13 (el plan traia numeros del 30-jul, crecieron):
--
--   total de pagos                       3.616
--   dicen 'wompi'                        3.573
--   dicen 'mercadopago'                      3
--   ya en NULL                              40
--
--   por canal:  manual 2.995 · transfer 374 · online 147 · cash 59 · null 41
--   con evidencia REAL de pasarela         150
--   => la columna miente en 3.426 filas, el 95%.
--
-- VERIFICADO ANTES DE QUITAR EL DEFAULT. El plan pedia revisar que ningun INSERT
-- dependiera del default para una fila que SI es de pasarela. Los tres RPCs que
-- insertan pagos —submit_qr_signup, open_month, generate_qr_monthly_charge— no
-- mencionan `payment_provider` en ningun lado, pero eso esta BIEN: crean COBROS,
-- no pagos de pasarela, asi que dejarlos en NULL es la verdad. Los cuatro call
-- sites que si deben sellarlo ya lo hacen explicito (PaymentCheckoutModal.tsx
-- :273 wompi, :478 y :502 mercadopago, lib/api/transactions.ts:177).
--
-- VERIFICADO QUE NO ROMPE LA APP. Los tres puntos que leen la columna:
--   · lib/paymentOrigin.ts NO la usa para decidir si hubo pasarela — usa
--     payment_channel='online' o una referencia real. La lee solo para NOMBRAR.
--   · gatewayName(NULL) devuelve 'Wompi' por fallback, pero solo se invoca
--     cuando isGatewayPayment() ya dio true, y esas filas conservan su provider.
--   · La cola de «Cobros por Aprobar» filtra con isGatewayPayment
--     (PaymentsAutomationPage.tsx:1043), no con la columna. Ese era el riesgo de
--     verdad —esconder el comprobante de una familia— y no existe.
-- El propio codigo ya traia la advertencia escrita en PaymentsAutomationPage:293.
--
-- LO QUE SI CAMBIA DE FORMA VISIBLE: cualquier reporte que agrupe ingresos por
-- proveedor. Hoy da «100% Wompi», que es falso. Despues muestra 150 por pasarela
-- y el resto sin proveedor. En Dynasty son 670 cobros: 28 con pasarela real (no
-- se tocan) y 642 que pasan a NULL —184 pagados, 215 cancelados, 241 pendientes,
-- 2 en mora—. Conviene avisarle a la escuela antes de que lo note en el reporte.
--
-- ALCANCE: solo `payments`. El archivo 20260504000001 repite `DEFAULT 'wompi'` en
-- 9 lugares (school_payment_providers, vendor_payment_providers, marketplace…).
-- Se dejan para una segunda pasada, a proposito: asi un rollback es acotado.
-- ============================================================================

BEGIN;

-- ── 1. Quitar el default ────────────────────────────────────────────────────
-- Desde aca, un INSERT que no diga provider deja NULL, que es la verdad:
-- «este pago no paso por pasarela».
ALTER TABLE public.payments ALTER COLUMN payment_provider DROP DEFAULT;

COMMIT;


-- ── 2. Backfill del historico, en tandas ────────────────────────────────────
-- Va FUERA de la transaccion de arriba y en tandas de 500 a proposito:
-- `trg_audit_payments` es AFTER INSERT OR UPDATE OR DELETE FOR EACH ROW y no
-- esta acotado por columna, asi que este UPDATE escribe ~3.426 filas de
-- auditoria. Partirlo evita una transaccion larga sobre la tabla de dinero.
--
-- Los otros tres triggers de `payments` NO se disparan o salen temprano:
--   trg_payment_fee_to_expense_upd    AFTER UPDATE OF status  -> no dispara
--   trg_bump_qr_paid_count            AFTER UPDATE OF status  -> no dispara
--   trg_extend_enrollment_on_payment_paid  dispara, pero su guarda exige
--                                     status='paid' AND OLD.status <> 'paid'
--
-- La regla: sin evidencia de pasarela, el provider es NULL. Las 150 con
-- evidencia y las 3 de mercadopago quedan intactas.
DO $$
DECLARE
    v_tanda   int;
    v_total   int := 0;
    v_vueltas int := 0;
BEGIN
    LOOP
        WITH objetivo AS (
            SELECT id
              FROM public.payments
             WHERE payment_provider = 'wompi'
               AND payment_channel IS DISTINCT FROM 'online'
               AND wompi_reference        IS NULL
               AND wompi_transaction_id   IS NULL
               AND provider_transaction_id IS NULL
             LIMIT 500
        )
        UPDATE public.payments p
           SET payment_provider = NULL,
               updated_at       = now()
          FROM objetivo o
         WHERE p.id = o.id;

        GET DIAGNOSTICS v_tanda = ROW_COUNT;
        v_total   := v_total + v_tanda;
        v_vueltas := v_vueltas + 1;

        EXIT WHEN v_tanda = 0;

        -- Cota de seguridad: con 500 por vuelta, 50 vueltas son 25.000 filas,
        -- muy por encima de las ~3.426 esperadas. Si se llega aca, algo esta mal
        -- (por ejemplo un trigger reponiendo 'wompi') y conviene parar y mirar.
        IF v_vueltas > 50 THEN
            RAISE EXCEPTION 'DIN-3: el backfill supero 50 vueltas (% filas). Abortado para revisar.', v_total;
        END IF;
    END LOOP;

    RAISE NOTICE 'DIN-3: % fila(s) pasadas a payment_provider = NULL en % tanda(s).', v_total, v_vueltas - 1;
END $$;


-- ── 3. Que la columna diga lo que es ────────────────────────────────────────
COMMENT ON COLUMN public.payments.payment_provider IS
    'Pasarela que proceso el pago. NULL = NO paso por pasarela (efectivo, transferencia, '
    'registro manual, o cobro emitido por el sistema). Tuvo DEFAULT ''wompi'' desde '
    '20260504000001 hasta 20260813180537, asi que sellaba como Wompi todo lo que se '
    'insertara sin provider — el 95% de las filas. Esa migracion quito el default y puso '
    'en NULL el historico sin evidencia de pasarela. Para saber si hubo pasarela NO uses '
    'esta columna: usa payment_channel = ''online'' o una referencia real '
    '(wompi_reference / wompi_transaction_id / provider_transaction_id). Esta columna '
    'sirve para NOMBRAR la pasarela cuando ya sabes que la hubo.';


-- ── Verificacion (correr despues) ───────────────────────────────────────────
-- 1. Que el default ya no este:
--
-- SELECT column_default
--   FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='payments'
--    AND column_name='payment_provider';
-- ESPERADO: NULL.
--
-- 2. Que los numeros cuadren — el provider ahora deberia seguir al canal:
--
-- SELECT COALESCE(payment_provider,'(null)') AS provider,
--        COALESCE(payment_channel,'(null)')  AS canal,
--        count(*)
--   FROM public.payments
--  GROUP BY 1,2
--  ORDER BY 3 DESC;
-- ESPERADO: 'wompi' y 'mercadopago' solo en filas con canal 'online' o con
-- referencia de pasarela. Todo lo manual/transfer/cash en '(null)'.
--
-- 3. Que no se perdio ninguna pasarela real:
--
-- SELECT count(*) FROM public.payments
--  WHERE payment_provider IS NULL
--    AND (payment_channel = 'online' OR wompi_reference IS NOT NULL
--         OR wompi_transaction_id IS NOT NULL OR provider_transaction_id IS NOT NULL);
-- ESPERADO: 0. Si da mas, el backfill toco algo que no debia.
--   (Nota: pueden aparecer las 40 filas que YA estaban en NULL antes de esta
--    migracion, si alguna tiene evidencia de pasarela. Eso es anterior y no lo
--    causo este backfill.)
--
-- 4. Leer el NOTICE del DO: dice cuantas filas y cuantas tandas.
