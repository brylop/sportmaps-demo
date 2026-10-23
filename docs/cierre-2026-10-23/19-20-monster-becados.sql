-- Monster´s Volley Club — becas (#19). PREPARADO el 2026-10-23, SIN EJECUTAR. Ver 19-20-monster-becados-y-montos.md.
-- Laura Ladino al 50 % = 72.500: confirmado por el usuario el 2026-10-23.
-- Mejor por la app (PUT /students/:id). Esto es el plan B, con candado por fila.
-- Esperado: inscripciones=6, cobros_anulados=5, cobros_reducidos=1. Si no, ROLLBACK.

BEGIN;
SET LOCAL lock_timeout = '5s';

WITH becados(enrollment_id, pago_id, cuota, motivo) AS (VALUES
  ('7c15208b-8f0b-4972-8b06-c05b37b5def3'::uuid, '1228eacc-c819-48c5-8ee3-b40e196d81ef'::uuid, 0,     'Beca deportiva'),                      -- Deivis Valle
  ('2fef91ae-2ce1-4296-981b-af54d94f4c8c'::uuid, 'dc03e41f-004c-46a2-9dd2-f6d65f145af7'::uuid, 72500, 'Beca 50 %'),                           -- Laura Ladino
  ('c8cd81af-2f3a-44fb-9f4c-1685356fb854'::uuid, '88033d18-9e7b-4e12-8b45-86d9f419d298'::uuid, 0,     'Beca profe'),                          -- Julián Torres
  ('c4348687-a98c-4d3a-b34c-1b7f2e0fc59e'::uuid, '26cfe32c-0955-4e72-843d-314fecf2e821'::uuid, 0,     'Beca profe'),                          -- Tatiana Díaz
  ('fe297351-5ae8-4b2e-ba12-044e2113bb9f'::uuid, 'b979bd59-d1d4-47a6-b504-04898fa1adc6'::uuid, 0,     'Beca profe'),                          -- Ana Forero
  ('bb74019a-aa90-479f-bc40-0a4e3957a95c'::uuid, '2049d58e-5b6b-408b-87dc-cada43ddf5fb'::uuid, 0,     'Beca profe')                           -- Sebastián Hurtado
),
ins AS (
  UPDATE public.enrollments e
     SET monthly_fee = b.cuota, fee_is_manual = true, fee_reason = b.motivo
    FROM becados b
   WHERE e.id = b.enrollment_id
     AND e.school_id = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c'
     AND e.status = 'active'
     AND e.monthly_fee IS NULL AND e.fee_is_manual = false
  RETURNING e.id
),
total AS (
  UPDATE public.payments p
     SET status = 'cancelled'
    FROM becados b
   WHERE p.id = b.pago_id AND b.cuota = 0
     AND p.school_id = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c'
     AND p.status = 'pending' AND p.amount = 145000
  RETURNING p.id
),
parcial AS (
  UPDATE public.payments p
     SET amount = b.cuota
    FROM becados b
   WHERE p.id = b.pago_id AND b.cuota > 0
     AND p.school_id = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c'
     AND p.status = 'pending' AND p.amount = 145000
  RETURNING p.id
)
SELECT (SELECT count(*) FROM ins) inscripciones, (SELECT count(*) FROM total) cobros_anulados, (SELECT count(*) FROM parcial) cobros_reducidos;

-- COMMIT;   -- descomentar solo si el resultado es 6 / 5 / 1
ROLLBACK;

-- Verificación (solo lectura). Antes: n=145, total=21535000. Después: n=140, total=20737500.
-- with r as (select public.preview_open_month('eb3ebc77-4ea4-4992-96c8-3c8ec574578c', 2026, 11, null) j),
--      i as (select (x->>'amount')::numeric m from r, jsonb_array_elements(j->'items') x)
-- select count(*) n, sum(m) total from i;
