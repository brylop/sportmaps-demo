-- ============================================================================
-- DYNASTY — enganchar los 2 acudientes que ya tienen cuenta y quedaron sueltos
-- Fecha: 2026-08-12
-- Detectado con: node scripts/audit-acudientes-desenganchados.mjs --school Dynasty
--
-- Mismo patrón que Giovanny Currea (ver dynasty-enganchar-acudiente-currea):
-- el acudiente se registró POR SU CUENTA en vez de aceptar la invitación, así
-- que `accept_invitation_pro` nunca corrió y `children.parent_id` quedó en NULL.
-- Lo único que los liga es `parent_email_temp`, que es texto suelto.
--
-- Consecuencia: no ve a su atleta al entrar (la app resuelve por `parent_id`) y
-- si el cobro también tiene `parent_id` NULL, el guard anti-IDOR del checkout le
-- responde 403 «No tienes permiso para pagar» al propio acudiente.
--
-- ALCANCE: son SOLO ESTOS DOS. De 500 children de Dynasty, 211 no tienen
-- `parent_id`, pero 195 de esos correos NO tienen perfil: el acudiente nunca
-- creó cuenta y no hay a quién atar. Esos $21,5M de cobros impagables NO se
-- arreglan con SQL — o la familia se registra, o la escuela cobra por fuera.
--
-- Idempotente: cada UPDATE exige el estado de origen. Nada se borra.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- §0 · PREFLIGHT (no modifica)
-- ────────────────────────────────────────────────────────────────────────────
SELECT c.full_name                                   AS atleta,
       c.date_of_birth                               AS nacimiento,
       c.doc_number                                  AS documento,
       COALESCE(c.parent_id::text, '❌ parent_id NULL') AS enganche,
       c.parent_email_temp                           AS correo_en_ficha,
       (SELECT p.id::text FROM public.profiles p
         WHERE lower(trim(p.email)) = lower(trim(c.parent_email_temp)))  AS perfil_existente,
       (SELECT count(*) FROM public.payments pa
         WHERE pa.child_id = c.id AND pa.parent_id IS NULL
           AND pa.status IN ('pending','overdue','awaiting_approval','partial','glosado')) AS cobros_impagables
  FROM public.children c
 WHERE c.id IN ('4129cf66-32a0-4154-ab41-05ce45f2edc5',   -- Salome Lamprea Vergel
                '4815a518-aadc-4100-ac06-455d8f732d40');  -- Darwin Hernandez


-- ════════════════════════════════════════════════════════════════════════════
-- §1 · SALOME LAMPREA VERGEL — caso idéntico a Isabela Currea
-- ------------------------------------------------------------
--   menor   4129cf66-32a0-4154-ab41-05ce45f2edc5  nac 2010-10-27, doc 1014994111
--   mamá    5381063e-35db-453e-86b2-518d2b59081f  lvergelportillo@gmail.com
--   cobro   582f5ed2-77df-4e00-9f7b-0fc0fb0b7135  $180.000 pending, sin pagador
--   invit.  f0996ce8-980a-4dd2-8560-5e4e7700ddc0  pending
-- ════════════════════════════════════════════════════════════════════════════

-- 1.a · Atar la hija a la mamá → la ve al entrar
UPDATE public.children
   SET parent_id  = '5381063e-35db-453e-86b2-518d2b59081f',
       updated_at = now()
 WHERE id = '4129cf66-32a0-4154-ab41-05ce45f2edc5'
   AND parent_id IS NULL;

-- 1.b · Pagador en los cobros VIVOS → puede pagar
UPDATE public.payments
   SET parent_id  = '5381063e-35db-453e-86b2-518d2b59081f',
       updated_at = now()
 WHERE child_id = '4129cf66-32a0-4154-ab41-05ce45f2edc5'
   AND parent_id IS NULL
   AND status IN ('pending','overdue','awaiting_approval','partial','glosado');

-- 1.c · Membresía: no la tiene, y los otros 274 acudientes de Dynasty sí
INSERT INTO public.school_members (profile_id, school_id, role, status, joined_at)
SELECT '5381063e-35db-453e-86b2-518d2b59081f',
       '2d509571-3238-4c04-ac3f-6dfe20539226', 'parent', 'active', now()
 WHERE NOT EXISTS (
   SELECT 1 FROM public.school_members
    WHERE profile_id = '5381063e-35db-453e-86b2-518d2b59081f'
      AND school_id  = '2d509571-3238-4c04-ac3f-6dfe20539226');

-- 1.d · Cerrar la invitación: sigue 'pending' aunque ya tiene cuenta, así que la
--       escuela la ve abierta y se la reenvía de más.
UPDATE public.invitations
   SET status = 'accepted'
 WHERE id = 'f0996ce8-980a-4dd2-8560-5e4e7700ddc0'
   AND status = 'pending';


-- ════════════════════════════════════════════════════════════════════════════
-- §2 · DARWIN HERNANDEZ — ⚠️ NO ES UN MENOR. Leer antes de ejecutar.
-- ------------------------------------------------------------
-- La fila de `children` tiene nacimiento 1972-12-29 y documento 80441327 (una
-- cédula, no una tarjeta de identidad). Tiene 53 años: es un ATLETA ADULTO que
-- quedó cargado como menor, y el «acudiente» es él mismo —mismo nombre, mismo
-- correo (wislod31@gmail.com), perfil 936ca700 con rol 'parent'.
--
-- O sea que atarlo lo deja siendo su propio acudiente. Funciona —vería su
-- registro y podría pagar— pero el modelo correcto es otro: atleta adulto con
-- `school_members.role = 'athlete'` y la inscripción sobre `user_id`, no una
-- fila en `children`. Es el mismo patrón child+adult de los casos 10 y 12 del
-- eje C (Oscar Baquero, Esteban Herrera).
--
-- URGENCIA: NINGUNA. Su único cobro vivo ($130.000, 749e4c83) ya está PAGADO y
-- el otro está cancelado, así que no hay nada bloqueado. El beneficio de atarlo
-- es solo que vea su registro en la app.
--
-- DOS OPCIONES — elegir una:
--
--   (1) PARCHE MÍNIMO — se vuelve su propio acudiente y ve su registro hoy.
--       Descomentar:
--
-- UPDATE public.children
--    SET parent_id  = '936ca700-eb81-498c-bf8a-738329e50c52',
--        updated_at = now()
--  WHERE id = '4815a518-aadc-4100-ac06-455d8f732d40'
--    AND parent_id IS NULL;
--
-- INSERT INTO public.school_members (profile_id, school_id, role, status, joined_at)
-- SELECT '936ca700-eb81-498c-bf8a-738329e50c52',
--        '2d509571-3238-4c04-ac3f-6dfe20539226', 'parent', 'active', now()
--  WHERE NOT EXISTS (
--    SELECT 1 FROM public.school_members
--     WHERE profile_id = '936ca700-eb81-498c-bf8a-738329e50c52'
--       AND school_id  = '2d509571-3238-4c04-ac3f-6dfe20539226');
--
--   (2) CONVERTIRLO EN ATLETA ADULTO — lo correcto, pero NO va por este script.
--       Hay que mover la inscripción y los cobros de `child_id` a `user_id`,
--       darle `school_members.role='athlete'` y desactivar la fila de children.
--       Toca un cobro PAGADO, así que va con el procedimiento de fusión de
--       identidades (docs/plan-fusion-identidades-duplicadas.md) y no a mano.
--
-- Mi recomendación: (2), junto con Oscar Baquero y Esteban Herrera, que son el
-- mismo caso. (1) solo si necesita ver su registro ya.
-- ════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════
-- §3 · VERIFICACIÓN
-- ------------------------------------------------------------
-- Esperado para Salome: enganche con el uuid de la mamá, 0 cobros impagables,
-- membresía parent/active, invitación accepted.
-- Darwin sigue igual salvo que se haya elegido la opción (1).
-- ════════════════════════════════════════════════════════════════════════════
SELECT c.full_name                                      AS atleta,
       COALESCE(c.parent_id::text, '❌ SIGUE NULL')       AS enganche,
       (SELECT count(*) FROM public.payments pa
         WHERE pa.child_id = c.id AND pa.parent_id IS NULL
           AND pa.status IN ('pending','overdue','awaiting_approval','partial','glosado')) AS impagables,
       COALESCE((SELECT sm.role || '/' || sm.status FROM public.school_members sm
                  WHERE sm.profile_id = (SELECT p.id FROM public.profiles p
                                          WHERE lower(trim(p.email)) = lower(trim(c.parent_email_temp)))
                    AND sm.school_id = c.school_id), '❌ sin membresía') AS membresia
  FROM public.children c
 WHERE c.id IN ('4129cf66-32a0-4154-ab41-05ce45f2edc5',
                '4815a518-aadc-4100-ac06-455d8f732d40');

-- Invitación de Salome
SELECT id, status, child_name, monthly_fee
  FROM public.invitations
 WHERE id = 'f0996ce8-980a-4dd2-8560-5e4e7700ddc0';


-- ════════════════════════════════════════════════════════════════════════════
-- §4 · LO QUE NO TOCA ESTE SCRIPT
-- ------------------------------------------------------------
-- 4.1 · La cuota de Salome no cuadra: la invitación dice $150.000 y su cobro es
--       de $180.000. NO lo cambio: que difieran es normal —la invitación es una
--       propuesta y la escuela puede cambiar el plan después— y en Dynasty las
--       24 diferencias van en AMBAS direcciones, que es la firma de cambios
--       legítimos, no de un bug. Si el plan correcto es el de $150.000, hay que
--       corregir `enrollments.offering_plan_id` + `monthly_fee` y el cobro vivo,
--       como se hizo con Isabela Currea. Lo confirma la escuela, no el dato.
--
-- 4.2 · Las otras 13 invitaciones colgadas en 'pending' de acudientes que YA
--       tienen cuenta. No las cierro en bloque porque cada una hay que verificar
--       que el perfil corresponde de verdad a esa familia. Listado:
--         node scripts/audit-acudientes-desenganchados.mjs --school Dynasty
--       y mirar los marcados con [D].
--
-- 4.3 · Los 195 acudientes SIN cuenta ($21,5M en cobros impagables). No es un
--       problema de datos: hay que que la familia se registre o cobrar por fuera.
-- ════════════════════════════════════════════════════════════════════════════
