-- =============================================================================
-- Bandeja de comprobantes (WhatsApp) — cierre ÚNICO de lo que ya se decidió en Pagos
-- 2026-10-13 · NO ES UNA MIGRACIÓN · correr a mano en el SQL Editor, por partes
-- =============================================================================
-- Contexto: Dynasty tenía 206 filas abiertas en la Bandeja y 0 cerradas por la
-- escuela. Desde este cambio el BFF (al leer la bandeja) y la migración
-- 20261013124655 (trigger en payments) cierran solas las filas cuyo pago se
-- aprobó o rechazó. Este script hace lo mismo UNA vez para lo que ya estaba.
--
-- Regla (la misma del BFF y del trigger, nada más laxo):
--   · fila abierta: status in (failed, ignored, waiting_user) y sin prefijo
--     `cerrado_escuela:`; no `ya_registrado` (eso lo cierra su propio barrido)
--   · enlazada a un pago de la MISMA escuela por result_ref_id, por sha de la
--     imagen (pregunta_ocr->>'sha') o por referencia del OCR
--   · el pago está aprobado (paid/approved/completed) con aprobación posterior a
--     la llegada de la fila (-5 min), o su comprobante se rechazó después.
--
-- Medido read-only el 2026-10-13 en Dynasty (2d509571-…): 196 abiertas al
-- momento de medir (206 en el inventario; 10 se cerraron solas al abrir la
-- pestaña ese día) → **3** cumplen la regla (2 por result_ref_id, 1 por
-- referencia del OCR). Otras 20 tienen un pago aprobado de la MISMA familia
-- en los 10 días siguientes, pero sin enlace directo (casi todas «no es un
-- comprobante»): NO se cierran, cerrarlas sería adivinar.
--
-- Nada de esto toca `payments`. Ver docs/specs/comunicaciones-inventario.md §3.6.
-- =============================================================================

-- ── 1. Vista previa: qué se cerraría (correr y revisar) ────────────────────
with abiertas as (
    select q.id, q.school_id, q.status, q.error_message, q.created_at, q.result_ref_id,
           q.pregunta_ocr->>'sha'               as sha,
           q.pregunta_ocr->'ocr'->>'reference'  as ref
      from public.whatsapp_inbound_queue q
     where q.status in ('failed', 'ignored', 'waiting_user')
       and coalesce(q.error_message, '') not like 'cerrado_escuela:%'
       and coalesce(q.error_message, '') not like 'recuperado: ya_registrado%'
       and coalesce(q.error_message, '') not like 'referencia ya usada%'
),
candidatas as (
    select distinct on (a.id)
           a.id, a.school_id, a.status, a.error_message, a.created_at,
           p.id as payment_id, p.status as pago_status, p.concept,
           case when p.status in ('paid', 'approved', 'completed') then 'aprobado' else 'rechazado' end as decision
      from abiertas a
      join public.payments p
        on p.school_id = a.school_id
       and (p.id = a.result_ref_id
            or (a.sha is not null and p.receipt_image_sha256 = a.sha)
            or (a.ref is not null and (p.ocr_reference = a.ref or p.receipt_reference_norm = a.ref)))
     where (p.status in ('paid', 'approved', 'completed')
            and coalesce(p.approved_at, p.payment_date::timestamptz, p.updated_at) >= a.created_at - interval '5 minutes')
        or (p.receipt_rejected_at is not null
            and p.status in ('pending', 'overdue', 'partial', 'rejected')
            and p.receipt_rejected_at >= a.created_at - interval '5 minutes')
     order by a.id, (p.id = a.result_ref_id) desc
)
select s.name as escuela, c.decision, count(*) as filas,
       array_agg(c.id order by c.created_at) as ids
  from candidatas c join public.schools s on s.id = c.school_id
 group by s.name, c.decision
 order by s.name, c.decision;


-- ── 2. Cierre (en transacción; revisar el conteo antes del COMMIT) ──────────
begin;

with abiertas as (
    select q.id, q.school_id, q.status, q.error_message, q.created_at, q.result_ref_id,
           q.pregunta_ocr->>'sha'               as sha,
           q.pregunta_ocr->'ocr'->>'reference'  as ref
      from public.whatsapp_inbound_queue q
     where q.status in ('failed', 'ignored', 'waiting_user')
       and coalesce(q.error_message, '') not like 'cerrado_escuela:%'
       and coalesce(q.error_message, '') not like 'recuperado: ya_registrado%'
       and coalesce(q.error_message, '') not like 'referencia ya usada%'
),
candidatas as (
    select distinct on (a.id)
           a.id, a.error_message,
           case when p.status in ('paid', 'approved', 'completed')
                then 'el pago se aprobó (' || p.status || ': ' || left(coalesce(p.concept, ''), 80) || ')'
                else 'el comprobante se rechazó en Pagos (' || left(coalesce(p.concept, ''), 80) || ')'
           end as motivo
      from abiertas a
      join public.payments p
        on p.school_id = a.school_id
       and (p.id = a.result_ref_id
            or (a.sha is not null and p.receipt_image_sha256 = a.sha)
            or (a.ref is not null and (p.ocr_reference = a.ref or p.receipt_reference_norm = a.ref)))
     where (p.status in ('paid', 'approved', 'completed')
            and coalesce(p.approved_at, p.payment_date::timestamptz, p.updated_at) >= a.created_at - interval '5 minutes')
        or (p.receipt_rejected_at is not null
            and p.status in ('pending', 'overdue', 'partial', 'rejected')
            and p.receipt_rejected_at >= a.created_at - interval '5 minutes')
     order by a.id, (p.id = a.result_ref_id) desc
)
update public.whatsapp_inbound_queue q
   set status        = 'ignored',
       locked_until  = null,
       error_message = left('cerrado_escuela: resuelto_auto — ' || replace(c.motivo, '|', '/')
                            || ' (cierre único 2026-10-13) | ' || coalesce(q.error_message, ''), 1000),
       updated_at    = now()
  from candidatas c
 where q.id = c.id
   -- Que nadie la haya tocado entre la vista previa y ahora.
   and coalesce(q.error_message, '') = coalesce(c.error_message, '')
returning q.id, q.school_id;

-- Si el número de filas coincide con la vista previa (Dynasty: 3):
commit;
-- Si no: rollback;


-- ── 3. Comprobación ─────────────────────────────────────────────────────────
-- select count(*) filter (where error_message like 'cerrado_escuela: resuelto_auto%cierre único 2026-10-13%') as cerradas_hoy,
--        count(*) filter (where status in ('failed','ignored','waiting_user')
--                         and coalesce(error_message,'') not like 'cerrado_escuela:%')                    as siguen_abiertas
--   from public.whatsapp_inbound_queue
--  where school_id = '2d509571-3238-4c04-ac3f-6dfe20539226';
