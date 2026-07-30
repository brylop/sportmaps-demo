-- ============================================================
-- SPIRIT ALL STARS — congelar toda capacidad de cobro (escuela de PRUEBAS)
-- ------------------------------------------------------------
-- Fecha: 2026-07-30
--
-- MOTIVO
-- SPIRIT ALL STARS es una escuela de pruebas, pero está viva en el mismo ambiente que
-- DYNASTY (cliente real): 117 cobros de menores, 101 pendientes, $18.380.000. Mientras
-- exista esa capacidad de cobro hay dos riesgos concretos:
--   1. Con el código HOY desplegado, una escuela en payment_mode='unset' todavía cae a
--      las llaves WOMPI_* de ENV — que son de Dynasty. Un cobro de prueba en SPIRIT le
--      metería dinero a la cuenta comercial de Dynasty.
--   2. El cron diario de generación de cobros y el motor de recordatorios siguen
--      operando: se acumulan cobros y se le mandan avisos a contactos de prueba.
--
-- QUÉ HACE (no destructivo, reversible)
--   1. Apaga los interruptores de school_settings: generación automática, recordatorios
--      y pagos online.
--   2. Anula ('cancelled') los cobros pendientes/vencidos. No borra filas.
--   3. Deja payment_mode en 'unset' (ya lo estaba por 20260730000003).
--
-- NO se borra la escuela ni sus atletas: `schools` no tiene columna de baja lógica, así
-- que "inactivar" se implementa apagando lo que puede cobrar o notificar.
--
-- PARA REVERTIR: volver los flags a TRUE y pasar los cobros de 'cancelled' a 'pending'
-- (el SELECT final imprime los conteos para poder deshacerlo con precisión).
--
-- NOTA: sin CREATE TEMPORARY TABLE a propósito — el pooler de Supabase puede servir cada
-- statement desde otra sesión y la temp table se pierde ("relation ... does not exist").
-- El nombre real de la escuela trae un espacio final, así que se compara con TRIM().
-- ============================================================

BEGIN;

-- ── 1. Interruptores: nada genera, recuerda ni cobra ───────────────────────────
UPDATE public.school_settings ss
   SET auto_generate_payments = FALSE,
       reminder_enabled        = FALSE,
       wompi_enabled           = FALSE,
       updated_at              = now()
 WHERE ss.school_id IN (
           SELECT s.id FROM public.schools s WHERE TRIM(s.name) = 'SPIRIT ALL STARS'
       );

-- ── 2. Anular los cobros vivos (no se borran) ─────────────────────────────────
UPDATE public.payments p
   SET status     = 'cancelled',
       updated_at = now()
 WHERE p.school_id IN (
           SELECT s.id FROM public.schools s WHERE TRIM(s.name) = 'SPIRIT ALL STARS'
       )
   AND p.status IN ('pending', 'overdue');

-- ── 3. Modo de pago explícitamente bloqueado ──────────────────────────────────
UPDATE public.schools
   SET payment_mode = 'unset'
 WHERE TRIM(name) = 'SPIRIT ALL STARS'
   AND payment_mode <> 'unset';

COMMIT;

-- ── Verificación ──────────────────────────────────────────────────────────────
SELECT s.name,
       s.payment_mode,
       ss.auto_generate_payments,
       ss.reminder_enabled,
       ss.wompi_enabled,
       count(p.id) FILTER (WHERE p.status IN ('pending','overdue')) AS cobros_vivos,
       count(p.id) FILTER (WHERE p.status = 'cancelled')            AS cobros_anulados,
       count(p.id) FILTER (WHERE p.status = 'paid')                 AS cobros_pagados
  FROM public.schools s
  LEFT JOIN public.school_settings ss ON ss.school_id = s.id
  LEFT JOIN public.payments        p  ON p.school_id  = s.id
 WHERE TRIM(s.name) = 'SPIRIT ALL STARS'
 GROUP BY s.name, s.payment_mode, ss.auto_generate_payments, ss.reminder_enabled, ss.wompi_enabled;
