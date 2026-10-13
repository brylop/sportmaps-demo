-- =============================================================================
-- 20261010144557_cobros_f1_invariantes_payments.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-10   Versión anterior: 20261010144556
-- Objetivo: F1 de «Cobros y pagos» (spec cobros-multiples §6.5, §16.4, §12 M6).
--   1. CHECK payments_amount_invariante:
--        list_amount IS NULL OR amount = list_amount − discount_amount + late_fee_amount
--      creado NOT VALID y validado en la misma migración SOLO si 0 filas lo violan
--      (si alguna lo viola, queda NOT VALID —protege las filas nuevas— y se avisa
--      con WARNING; no se aborta).
--   2. payments_amount_positive reemplazado por
--        amount > 0 OR (amount = 0 AND status = 'paid' AND discount_amount > 0)
--      (exoneración de mensualidad = «beca del mes», §6.5).
--   3. Trigger BEFORE UPDATE OF amount trg_zzz_payments_rebase_list_amount: los
--      escritores de amount que no conocen las columnas nuevas siguen funcionando
--      y el invariante se mantiene (ver «Escritores de amount» abajo).
--   4. H7 (rechazar INSERT sin atleta): NO se crea aquí. El radio muestra dos
--      caminos VIVOS y legítimos que insertan sin child_id/user_id/
--      unregistered_athlete_id (ver abajo). Se separa a una rama propia; la RPC
--      create_charge_batch exige el atleta en cada fila que crea (M9).
--
-- ── Medición previa (base viva, 2026-10-10, solo lectura) ───────────────────
-- Invariante (1):
--   · Filas con list_amount puesto: 4. ANTES de M5 las 4 lo violan (discount_amount
--     = 0 y amount < list_amount). DESPUÉS de M5 (backfill) 0 lo violan:
--       250.000 − 75.000 + 0 = 175.000 · 35.000 − 4.200 = 30.800 ·
--       245.000 − 12.250 = 232.750 · 140.000 − 14.000 = 126.000;
--     y la fila de hermanos queda 200.000 − 20.000 = 180.000.
--   · Por eso M5 tiene que estar aplicada antes que esta; si no, el VALIDATE se
--     salta y queda el WARNING.
-- CHECK de monto (2): filas con amount <= 0 hoy: 0 → valida.
-- Escritores de amount (grep bff/src + frontend/src; pg_proc.prosrc):
--   · apply_late_fees (base): amount += fee y late_fee_amount += fee en el mismo
--     UPDATE → preserva el invariante. Sin cambio.
--   · bff/src/routes/students.ts:1159 y :1290 (cambio de equipo / plan): reescriben
--     amount de cobros 'pending' del período. Sin (3) una mensualidad con
--     hermanos/alta/modal violaría el CHECK y el UPDATE fallaría.
--   · frontend RegisterCashPaymentModal.tsx:435 y :517 (staff desde el navegador,
--     H6): sobrescribe amount al registrar un pago. Igual que arriba.
--   · No hay otros escritores de amount en funciones de la base.
--   (3) re-basa list_amount = amount + discount_amount − late_fee_amount cuando
--   cambia amount SIN que cambien list_amount, discount_amount ni late_fee_amount
--   y el invariante quedaría roto: el cambio se atribuye al valor de lista (lo que
--   esos caminos quieren decir: «la tarifa es otra»). Nombre «zzz»: corre después
--   de trg_zz_guard_payments_client, que así sigue viendo exactamente lo que mandó
--   el cliente. Cuando F3 quite el UPDATE de amount del modal y la rama S3 cierre
--   amount para staff navegador, este trigger queda solo para students.ts.
-- H7 (cobros sin atleta): 219 filas, 2 en los últimos 30 días, 0 en 7 días.
--   Caminos vivos que las crean:
--   · frontend/src/pages/ParentCheckoutPage.tsx:438 — insert con
--     child_id = childId || null y parent_id = el usuario: un atleta ADULTO que paga
--     su propia cuota queda sin user_id (ej. «Cuota social Agosto 2026», pagada en
--     línea, provider_reference puesto).
--   · bff/src/services/recurring-charges.service.ts:155 — débito automático de un
--     adulto: parent_id = sub.user_id, child_id NULL, sin user_id.
--   Un trigger que rechace el INSERT rompería el checkout y el débito automático de
--   adultos. Se documenta y se separa (rama aparte: que esos dos caminos estampen
--   user_id; después, el trigger).
-- =============================================================================

BEGIN;

-- ── 1. Invariante amount = lista − descuentos + recargo ─────────────────────
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_amount_invariante;
ALTER TABLE public.payments
    ADD CONSTRAINT payments_amount_invariante
    CHECK (list_amount IS NULL OR amount = list_amount - discount_amount + late_fee_amount)
    NOT VALID;

DO $$
DECLARE
    v_viol integer;
BEGIN
    SELECT count(*) INTO v_viol
      FROM public.payments
     WHERE list_amount IS NOT NULL
       AND amount <> list_amount - discount_amount + late_fee_amount;

    IF v_viol = 0 THEN
        ALTER TABLE public.payments VALIDATE CONSTRAINT payments_amount_invariante;
    ELSE
        RAISE WARNING 'payments_amount_invariante queda NOT VALID: % filas lo violan (¿falta aplicar M5 20261010144556?). '
                      'Protege las filas nuevas; validar a mano después de corregirlas.', v_viol;
    END IF;
END $$;

-- ── 2. Monto positivo salvo exoneración de mensualidad ──────────────────────
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_amount_positive;
ALTER TABLE public.payments
    ADD CONSTRAINT payments_amount_positive
    CHECK (amount > 0 OR (amount = 0 AND status = 'paid' AND discount_amount > 0))
    NOT VALID;
ALTER TABLE public.payments VALIDATE CONSTRAINT payments_amount_positive;

-- ── 3. Re-base de list_amount para escritores de amount ajenos a los ajustes ─
CREATE OR REPLACE FUNCTION public.fn_payments_rebase_list_amount()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
    IF NEW.list_amount IS NOT NULL
       AND NEW.amount IS DISTINCT FROM OLD.amount
       AND NEW.list_amount     IS NOT DISTINCT FROM OLD.list_amount
       AND NEW.discount_amount IS NOT DISTINCT FROM OLD.discount_amount
       AND NEW.late_fee_amount IS NOT DISTINCT FROM OLD.late_fee_amount
       AND NEW.amount <> NEW.list_amount - NEW.discount_amount + NEW.late_fee_amount THEN
        NEW.list_amount := NEW.amount + NEW.discount_amount - NEW.late_fee_amount;
    END IF;
    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_payments_rebase_list_amount() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_payments_rebase_list_amount() TO service_role;

DROP TRIGGER IF EXISTS trg_zzz_payments_rebase_list_amount ON public.payments;
CREATE TRIGGER trg_zzz_payments_rebase_list_amount
    BEFORE UPDATE OF amount ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.fn_payments_rebase_list_amount();

COMMIT;
