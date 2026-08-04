-- ============================================================
-- SPORTMAPS — Connected Accounts F0: cerrar el último acceso a las llaves de ENV
-- ------------------------------------------------------------
-- Ref: docs/payments-connected-accounts-fase0-cierre.md §2 ter. Fecha: 2026-07-30
--
-- La migración 20260730000002 dejó en 'aggregator' a toda escuela con alguna
-- transacción de pasarela. Al revisar los datos reales quedaron 4, y el diagnóstico
-- mostró que 3 son falsos positivos:
--
--   • Academia deportiva porras (2026-05-06) → MercadoPago, ids 1571xxxxxxx. No Wompi.
--   • MMA BLAIR TEAM (2026-05-06)            → MercadoPago, id 1579xxxxxxx.  No Wompi.
--   • Escuela Demo SportMaps (22–27 jul)     → Wompi comercio 11981889 (pruebas sandbox).
--   • DYNASTY VOLLEY CLUB (2026-07-29)       → Wompi comercio 1298966  ← el cobro real.
--
-- El primer segmento del transaction_id de Wompi identifica el comercio: 11981889 y
-- 1298966 son cuentas distintas, o sea NO hubo dinero de una escuela cayendo en la
-- cuenta de otra. Las llaves de ENV cambiaron entre el 27 y el 29 de julio.
--
-- El riesgo es a futuro: hoy ENV tiene las llaves de Dynasty, así que cualquier OTRA
-- escuela que cobre ahora le manda el dinero a Dynasty. Esta migración deja a Dynasty
-- como la única con acceso a ENV; el resto queda 'unset' = BLOQUEADA (fail-closed).
--
-- EFECTO COLATERAL ACEPTADO: la Escuela Demo queda bloqueada para cobrar online. Es
-- deliberado — mejor una demo sin checkout que dinero de la demo entrando a la cuenta
-- de un cliente real. Se le devuelve el checkout cuando exista la ruta de escritura
-- cifrada (F0.1) y se le conecten sus propias llaves sandbox como 'direct'.
--
-- Migraciones inmutables: no se edita 20260730000002 (ya aplicada); esto la corrige.
-- ============================================================

-- El id de Dynasty es específico de la BD de dev/staging (luebjarufsiadojhvxgi).
-- El guard evita que esta migración deje TODAS las escuelas bloqueadas si se aplica
-- a otra BD (p.ej. prod), donde la calibración tiene que hacerse por separado.
DO $$
DECLARE
    v_dynasty  uuid := '2d509571-3238-4c04-ac3f-6dfe20539226';
    v_afectadas integer;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.schools WHERE id = v_dynasty) THEN
        RAISE WARNING
            'Esta BD no contiene a DYNASTY VOLLEY CLUB (%): no se toca payment_mode. '
            'Calibrar aparte qué escuela es dueña de las llaves WOMPI_* de ESTE ambiente '
            'antes de bloquear el resto.', v_dynasty;
        RETURN;
    END IF;

    UPDATE public.schools
       SET payment_mode = 'unset'
     WHERE payment_mode = 'aggregator'
       AND id <> v_dynasty;

    GET DIAGNOSTICS v_afectadas = ROW_COUNT;
    RAISE WARNING 'payment_mode: % escuela(s) pasaron de aggregator a unset. Solo Dynasty conserva ENV.', v_afectadas;
END $$;

NOTIFY pgrst, 'reload schema';

-- ── Reporte: estado final por modo de pago ─────────────────────────────────────
-- Esperado: aggregator = 1 (Dynasty), unset = el resto, direct = 0 (todavía).
SELECT payment_mode, count(*) AS escuelas
  FROM public.schools
 GROUP BY payment_mode
 ORDER BY payment_mode;
