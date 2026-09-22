-- =============================================================================
-- 20260921205037_din3_backfill_wompi_provider_regresado.sql
-- Autor: brylop   Fecha: 2026-09-22   Versión anterior: 20260921131039
-- DIN-3 — segunda pasada: el default falso ya se quitó, pero el hueco que dejó
-- sigue sellando pagos reales de Wompi como "sin proveedor".
-- =============================================================================
--
-- CONTEXTO. 20260813180537_payment_provider_deja_de_mentir.sql quitó el
-- DEFAULT 'wompi' de payments.payment_provider (creado en
-- 20260504000001_payment_provider_generic.sql) y sembró NULL en el histórico
-- que no tenía evidencia real de pasarela. Esa parte quedó bien: verificado
-- hoy (2026-09-21), column_default = NULL y las 3.573 filas 'wompi' viejas
-- que eran en realidad manual/transfer/cash ya están en NULL.
--
-- EL PROBLEMA NUEVO (causado por el propio fix). Antes del 13-ago, el UPDATE
-- de confirmación del webhook de Wompi para pagos de escuela
-- (bff/src/routes/wompi.ts, handler que marca `payments.status = 'paid'`
-- ~línea 372) NUNCA escribía `payment_provider` explícito — no hacía falta,
-- el DEFAULT 'wompi' lo sellaba solo. Al quitar el default, ese mismo código
-- siguió sin escribirlo, así que TODO pago de Wompi confirmado por webhook
-- DESDE el 13-ago queda con payment_provider = NULL en vez de 'wompi'.
-- Contraste: bff/src/routes/mercadopago.ts SÍ setea
-- `payment_provider: 'mercadopago'` explícito en cada UPDATE de webhook
-- (líneas 398, 423, 554, 608, 642, 701) — Wompi es el único camino asimétrico.
--
-- MEDIDO EN LA BASE VIVA el 2026-09-21 (mcp__supabase__execute_sql, solo
-- lectura):
--   payment_provider   payment_channel   count
--   NULL               manual            3.674   (correcto: no es pasarela)
--   NULL               transfer            601   (correcto)
--   NULL               cash                158   (correcto)
--   'wompi'            online              150   (correcto, tenía provider)
--   NULL               (null)               40   (previo al fix del 13-ago)
--   NULL               online                8   ← REGRESIÓN, esta migración
--   'mercadopago'      manual                3   (registro manual con evidencia)
--
-- Las 8 filas con payment_channel='online' y payment_provider IS NULL tienen
-- TODAS wompi_reference Y wompi_transaction_id no nulos (evidencia real e
-- inequívoca de Wompi) y status='paid', con created_at entre 2026-07-30 y
-- 2026-09-05 — o sea, posteriores al fix que quitó el default. Esto es
-- exactamente el mismo bug que DIN-3 reportaba (una fila de pasarela real
-- que la columna no puede nombrar), solo que ahora en la dirección opuesta:
-- antes mentía 'wompi' de más, ahora falta 'wompi' donde sí corresponde.
-- Impacto en conciliación: cualquier reporte/reconciliación que agrupe o
-- filtre por payment_provider para reconocer "esto ya lo liquidó la pasarela,
-- no lo busques en el extracto bancario" vuelve a contar mal para estas 8
-- filas — las trata como si no tuvieran pasarela conocida.
--
-- ALCANCE DE ESTA MIGRACIÓN: solo backfill de datos. NO edita la migración
-- del 13-ago (inmutable). El fix de causa raíz en el código (agregar
-- `payment_provider: 'wompi'` al UPDATE de bff/src/routes/wompi.ts) va aparte,
-- en el PR de aplicación — sin eso, este backfill se vuelve a desactualizar
-- con el próximo pago de Wompi que llegue por ese webhook.
-- =============================================================================

BEGIN;

-- Solo toca filas con evidencia inequívoca de Wompi (referencia Y transacción
-- no nulas) que hoy no tienen provider. No toca las 40 filas NULL/(null canal)
-- que ya eran así antes del fix del 13-ago y no tienen esa evidencia.
UPDATE public.payments
   SET payment_provider = 'wompi',
       updated_at       = now()
 WHERE payment_provider IS NULL
   AND payment_channel = 'online'
   AND wompi_reference      IS NOT NULL
   AND wompi_transaction_id IS NOT NULL;

COMMIT;

-- ── Verificación (correr después) ───────────────────────────────────────────
-- Debe dar 0 filas: ya no debería quedar ningún pago online con evidencia de
-- Wompi y sin provider.
--
-- SELECT count(*) FROM public.payments
--  WHERE payment_provider IS NULL
--    AND payment_channel = 'online'
--    AND wompi_reference IS NOT NULL
--    AND wompi_transaction_id IS NOT NULL;
--
-- Y que las 8 (o las que haya en el momento de aplicar) ahora digan 'wompi':
--
-- SELECT id, payment_provider, payment_channel, wompi_reference, created_at
--   FROM public.payments
--  WHERE wompi_reference IN (
--      'SCH-MTOJ9ANR-4E7815','SCH-MTM9SUSQ-34C42B','SCH-MTRHP6YD-F2D38D',
--      'SCH-MTPTO619-438C7C','SCH-MSUHRRLW-A538E3','SCH-MSYW6BIL-65840A',
--      'SCH-MSYSHW80-9450B1','SCH-MSY1HSC7-C8E78F'
--  );
