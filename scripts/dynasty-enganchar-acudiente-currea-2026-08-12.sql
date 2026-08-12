-- ============================================================================
-- DYNASTY — enganchar a Giovanny Currea con su hija Isabela
-- Fecha: 2026-08-12
--
-- QUÉ PASA HOY: la cuenta existe, el correo está confirmado y entró hoy a las
-- 14:46, pero NO ve a su hija y NO puede pagar. Lo único que las liga es
-- `children.parent_email_temp`, que es texto suelto, no una relación:
--   · `children.parent_id` está en NULL  → la app resuelve los hijos por ahí,
--     así que al entrar no ve nada.
--   · `payments.parent_id` está en NULL  → el guard anti-IDOR del checkout le
--     responde «No tienes permiso para pagar este registro» al propio papá.
--   · no tiene fila en `school_members` → los otros 273 acudientes de la
--     escuela sí la tienen (verificado: 150 de 150 en la muestra).
--
-- POR QUÉ PASÓ: se registró por su cuenta en vez de aceptar la invitación, así
-- que `accept_invitation_pro` nunca corrió y nunca ató el `parent_id`. Es el
-- mismo mecanismo que produjo las 13 identidades duplicadas de Dynasty; acá no
-- llegó a nacer una segunda ficha de la niña, solo quedó huérfana.
--
-- Datos:
--   papá   00aa5886-4254-4c47-8c0e-0829c712a9cc  curreagiova@hotmail.com
--   hija   cbbf7e56-6f9d-4c7f-bdc7-2473e82b671e  ISABELA CURREA PEÑUELA
--   cobro  7e6a8d93-c931-4b1d-8e40-2b0cb5246f88  $150.000 pending, vence 10-ago
--   invit. 295a2814-6861-444c-83e7-faf9598351e7  pending
--
-- Idempotente: cada UPDATE exige el estado de origen (NULL / pending). Nada se
-- borra. Ejecutar por bloques y leer el SELECT de cada uno.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- §0 · PREFLIGHT — foto antes de tocar nada (no modifica)
-- ────────────────────────────────────────────────────────────────────────────
SELECT 'papá'   AS que, p.id::text, p.email, p.full_name, p.role::text AS detalle
  FROM public.profiles p WHERE p.id = '00aa5886-4254-4c47-8c0e-0829c712a9cc'
UNION ALL
SELECT 'hija', c.id::text, COALESCE(c.parent_id::text, '❌ parent_id NULL'),
       c.full_name, c.parent_email_temp
  FROM public.children c WHERE c.id = 'cbbf7e56-6f9d-4c7f-bdc7-2473e82b671e'
UNION ALL
SELECT 'cobro', pa.id::text, COALESCE(pa.parent_id::text, '❌ pagador NULL'),
       pa.status, pa.amount::text
  FROM public.payments pa WHERE pa.child_id = 'cbbf7e56-6f9d-4c7f-bdc7-2473e82b671e'
UNION ALL
-- Subconsulta escalar, NO un FROM school_members: cuando no tiene membresía ese
-- FROM devuelve CERO filas y la fila desaparece del reporte en silencio en vez
-- de avisar que falta. El COALESCE no ayuda si no hay fila que coalescer.
SELECT 'membresía',
       COALESCE((SELECT sm.id::text FROM public.school_members sm
                  WHERE sm.profile_id = '00aa5886-4254-4c47-8c0e-0829c712a9cc'
                    AND sm.school_id  = '2d509571-3238-4c04-ac3f-6dfe20539226'),
                '❌ NO TIENE'),
       COALESCE((SELECT sm.role FROM public.school_members sm
                  WHERE sm.profile_id = '00aa5886-4254-4c47-8c0e-0829c712a9cc'
                    AND sm.school_id  = '2d509571-3238-4c04-ac3f-6dfe20539226'), '—'),
       '', ''
UNION ALL
SELECT 'invitación', i.id::text, i.status, i.child_name, i.monthly_fee::text
  FROM public.invitations i WHERE i.id = '295a2814-6861-444c-83e7-faf9598351e7';


-- ════════════════════════════════════════════════════════════════════════════
-- §1 · ATAR LA HIJA AL PAPÁ — esto es lo que le hace ver a Isabela
-- ════════════════════════════════════════════════════════════════════════════
UPDATE public.children
   SET parent_id  = '00aa5886-4254-4c47-8c0e-0829c712a9cc',
       updated_at = now()
 WHERE id = 'cbbf7e56-6f9d-4c7f-bdc7-2473e82b671e'
   AND parent_id IS NULL;   -- idempotente: si ya está atada, no toca nada


-- ════════════════════════════════════════════════════════════════════════════
-- §2 · PONERLE PAGADOR AL COBRO — esto es lo que le permite pagar
-- ------------------------------------------------------------
-- Solo los cobros VIVOS de esta niña. El cancelado se deja como está: no hace
-- falta que sea pagable y tocarlo solo ensucia el historial.
-- ════════════════════════════════════════════════════════════════════════════
UPDATE public.payments
   SET parent_id  = '00aa5886-4254-4c47-8c0e-0829c712a9cc',
       updated_at = now()
 WHERE child_id = 'cbbf7e56-6f9d-4c7f-bdc7-2473e82b671e'
   AND parent_id IS NULL
   AND status IN ('pending', 'overdue', 'awaiting_approval', 'partial', 'glosado');


-- ════════════════════════════════════════════════════════════════════════════
-- §3 · DARLE LA MEMBRESÍA QUE TIENEN LOS OTROS 273 ACUDIENTES
-- ------------------------------------------------------------
-- Sin esto queda como un perfil suelto que no pertenece a la escuela. Se copia
-- la forma exacta de las filas existentes: role='parent', status='active',
-- branch_id NULL.
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO public.school_members (profile_id, school_id, role, status, joined_at)
SELECT '00aa5886-4254-4c47-8c0e-0829c712a9cc',
       '2d509571-3238-4c04-ac3f-6dfe20539226',
       'parent', 'active', now()
 WHERE NOT EXISTS (               -- idempotente sin depender de un unique
   SELECT 1 FROM public.school_members
    WHERE profile_id = '00aa5886-4254-4c47-8c0e-0829c712a9cc'
      AND school_id  = '2d509571-3238-4c04-ac3f-6dfe20539226'
 );


-- ════════════════════════════════════════════════════════════════════════════
-- §4 · CERRAR LA INVITACIÓN
-- ------------------------------------------------------------
-- Queda en 'pending' aunque él ya se registró: si no se cierra, la escuela la
-- ve abierta y se la vuelve a enviar. La tabla NO tiene `accepted_at`, así que
-- lo único que se puede marcar es el status.
--
-- OJO — su `expires_at` es 2026-08-05 pero se creó el 2026-08-12: nació
-- vencida. No bloquea nada (el vencimiento no se valida en ningún lado), pero
-- explica por qué la UI la muestra como vencida.
-- ════════════════════════════════════════════════════════════════════════════
UPDATE public.invitations
   SET status = 'accepted'
 WHERE id = '295a2814-6861-444c-83e7-faf9598351e7'
   AND status = 'pending';   -- idempotente


-- ════════════════════════════════════════════════════════════════════════════
-- §5 · VERIFICACIÓN — así debe quedar
-- ------------------------------------------------------------
-- Esperado: hija con parent_id poblado · cobro pending con pagador · membresía
-- 'parent'/'active' · invitación 'accepted'.
-- ════════════════════════════════════════════════════════════════════════════
SELECT 'hija'       AS que, c.full_name AS dato,
       COALESCE(c.parent_id::text, '❌ SIGUE NULL') AS valor
  FROM public.children c WHERE c.id = 'cbbf7e56-6f9d-4c7f-bdc7-2473e82b671e'
UNION ALL
SELECT 'cobro ' || pa.status, pa.amount::text,
       COALESCE(pa.parent_id::text, '❌ SIN PAGADOR')
  FROM public.payments pa WHERE pa.child_id = 'cbbf7e56-6f9d-4c7f-bdc7-2473e82b671e'
UNION ALL
-- Igual que en §0: escalar, para que la fila aparezca incluso si el INSERT falló.
SELECT 'membresía',
       COALESCE((SELECT sm.role FROM public.school_members sm
                  WHERE sm.profile_id = '00aa5886-4254-4c47-8c0e-0829c712a9cc'
                    AND sm.school_id  = '2d509571-3238-4c04-ac3f-6dfe20539226'), '—'),
       COALESCE((SELECT sm.status FROM public.school_members sm
                  WHERE sm.profile_id = '00aa5886-4254-4c47-8c0e-0829c712a9cc'
                    AND sm.school_id  = '2d509571-3238-4c04-ac3f-6dfe20539226'),
                '❌ SIGUE SIN MEMBRESÍA')
UNION ALL
SELECT 'invitación', i.child_name, i.status
  FROM public.invitations i WHERE i.id = '295a2814-6861-444c-83e7-faf9598351e7';


-- ════════════════════════════════════════════════════════════════════════════
-- §6 · CORREGIR EL PLAN — le pusieron PLAN PRO y su plan es PLAN START
-- ------------------------------------------------------------
-- Confirmado por el dueño (2026-08-12): su plan es el de $90.000.
--
-- Y no es solo el monto: es el PLAN. La invitación traía PLAN START y la
-- inscripción quedó con PLAN PRO, que cuesta $150.000:
--
--     invitación   plan 091f39c4 = PLAN START  $ 90.000   ← el correcto
--     inscripción  plan c9348cd7 = PLAN PRO    $150.000   ← lo que tiene hoy
--     cobro vivo   plan c9348cd7 = PLAN PRO    $150.000
--     children.monthly_fee = 0                            (no se usa: la fuente
--                                                          del monto es la
--                                                          inscripción)
--
-- Por eso se cambia `offering_plan_id` además de `monthly_fee` y `amount`. Si
-- solo se bajara el número, la inscripción diría PLAN PRO y cobraría $90.000,
-- y el próximo mes la generación volvería a leer el plan y cobraría $150.000.
--
-- El concepto del cobro también se corrige: dice «Mensualidad 08/2026», que no
-- nombra el plan, así que no hace falta tocarlo — pero el cobro cancelado dice
-- «Plan PLAN PRO» y se deja como está (es historial).
-- ════════════════════════════════════════════════════════════════════════════

-- 6.a · La inscripción: plan y cuota
UPDATE public.enrollments
   SET offering_plan_id = '091f39c4-62c3-45c8-97b3-b6e32acc3b86',  -- PLAN START
       monthly_fee      = 90000,
       updated_at       = now()
 WHERE id = '41489088-c9f1-498b-bdb8-0cc21b110035'
   AND status = 'active'
   AND offering_plan_id = 'c9348cd7-3157-4b25-9a1f-d4c2f9ace428';  -- idempotente

-- 6.b · El cobro vivo: plan y monto
UPDATE public.payments
   SET offering_plan_id = '091f39c4-62c3-45c8-97b3-b6e32acc3b86',  -- PLAN START
       amount           = 90000,
       updated_at       = now()
 WHERE id = '7e6a8d93-c931-4b1d-8e40-2b0cb5246f88'
   AND status = 'pending'
   AND amount = 150000;   -- idempotente

SELECT '§6 plan corregido' AS bloque,
       (SELECT op.name || ' $' || op.price::text
          FROM public.offering_plans op
         WHERE op.id = e.offering_plan_id)          AS plan_inscripcion,
       e.monthly_fee                                AS cuota_inscripcion,
       (SELECT pa.amount FROM public.payments pa
         WHERE pa.id = '7e6a8d93-c931-4b1d-8e40-2b0cb5246f88') AS monto_cobro
  FROM public.enrollments e
 WHERE e.id = '41489088-c9f1-498b-bdb8-0cc21b110035';
