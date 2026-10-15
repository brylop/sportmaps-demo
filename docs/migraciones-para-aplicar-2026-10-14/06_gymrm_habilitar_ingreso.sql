-- =============================================================================
-- 06_gymrm_habilitar_ingreso.sql — GYM RM: HOY entran todos; el 17-oct se bloquea
-- a TODO el que esté vencido. Los vencidos siguen vencidos.
-- 2026-10-14 · pedido del usuario. Pegar en el SQL Editor una sola vez.
-- =============================================================================
-- Estado medido hoy (solo lectura):
--   · access_auto_block_overdue_enabled = false, overdue_hold_until = 2026-10-16.
--   · 3 PIN bloqueados (Grupo 2 en los 2 lectores) desde el 2026-08-27:
--     59 TELECILA CARRILLO, 65 DIANA MARGARITA FERNANDEZ, 88 YUDY ORTIZ.
--
-- Qué hace: encola el desbloqueo (Grupo 1) de todo PIN cuyo último comando
--   ejecutado en algún lector activo sea Grupo 2. El puente lo ejecuta en minutos.
--   Mientras el flag siga en false, nadie se vuelve a bloquear.
--
-- Qué NO hace:
--   · No toca payments: los cobros vencidos siguen 'overdue'.
--   · NO quita el cron 'gymrm-bloqueo-auto-2026-10-17'. Ese día, en orden (hora Colombia):
--       02:00  apply_late_fees: termina el hold del 16 → los cobros de octubre sin
--              pagar (vencen el 10 + 5 días de gracia) pasan a 'overdue'.
--       03:15  el cron enciende access_auto_block_overdue_enabled y borra el hold.
--       ≤03:30 el job de bloqueo (cada 15 min) bloquea a TODO el que tenga una
--              mensualidad 'overdue' y huella registrada. Se desbloquea solo
--              cuando paga o sube comprobante.
-- =============================================================================

BEGIN;

WITH last AS (
    SELECT DISTINCT ON (dc.device_id, (dc.metadata->>'pin'))
           dc.device_id, (dc.metadata->>'pin')::int AS pin,
           dc.command_type, (dc.metadata->>'group')::int AS grp
      FROM public.device_commands dc
      JOIN public.turnstile_devices d ON d.id = dc.device_id AND d.is_active
     WHERE dc.school_id = '2137182d-a695-4695-8e5a-61151fc59196'
       AND dc.status = 'executed'
       AND dc.command_type IN ('set_group', 'disable_user', 'enable_user')
     ORDER BY dc.device_id, (dc.metadata->>'pin'), dc.executed_at DESC
)
INSERT INTO public.device_commands
       (school_id, device_id, command_type, direction, status, issued_by, expires_at, metadata)
SELECT '2137182d-a695-4695-8e5a-61151fc59196',
       l.device_id,
       'set_group',
       CASE WHEN d.direction = 'both' THEN 'entry' ELSE d.direction END,
       'pending',
       NULL,
       now() + interval '24 hours',
       jsonb_build_object('pin', l.pin, 'group', 1, 'reason', 'gymrm_habilitar_todos_2026_10_14')
  FROM last l
  JOIN public.turnstile_devices d ON d.id = l.device_id
 WHERE l.command_type = 'set_group' AND l.grp = 2;

COMMIT;

-- Verificación (correr después):
-- select (select count(*) from cron.job where jobname='gymrm-bloqueo-auto-2026-10-17' and active) cron_17,  -- 1 (se queda)
--        (select access_auto_block_overdue_enabled from school_settings
--          where school_id='2137182d-a695-4695-8e5a-61151fc59196') auto_bloqueo_hoy,                          -- false
--        (select count(*) from device_commands where school_id='2137182d-a695-4695-8e5a-61151fc59196'
--          and metadata->>'reason'='gymrm_habilitar_todos_2026_10_14' and status='executed') desbloqueos;     -- 6 (3 PIN × 2 lectores)
