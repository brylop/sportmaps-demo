-- ============================================================================
-- DYNASTY VOLLEY CLUB — fusión de las 13 identidades duplicadas
--
-- NO es una migración: es data de un solo tenant. Se corre a mano en el SQL
-- Editor, paso por paso, revisando el SELECT de verificación de cada bloque.
--
-- ORDEN OBLIGATORIO — PRIMERO SE CIERRA LA PUERTA
-- Correr DESPUÉS de aplicar `20260812183012_qr_signup_adopta_ficha_precargada`.
-- Ese es el productor: mientras `submit_qr_signup` siga sin ver la ficha
-- pre-cargada, cada papá que se registre sin teclear documento vuelve a
-- duplicar y esta limpieza se deshace sola. Es la misma regla del §11 del plan
-- de DIN-1: limpiar con los productores abiertos es trapear con la llave
-- abierta. Ritmo medido: ~1,3 duplicados por día.
--
-- NADIE SE BORRA
-- El absorbido queda `is_active = false` con su inscripción cancelada. Se puede
-- revertir con un UPDATE. El borrado físico, si alguna vez se quiere, va aparte
-- y después — hay cobros, asistencias e inscripciones apuntando a estas filas.
--
-- LA REGLA (decisión del dueño del producto, 2026-08-12)
-- Un solo acudiente por atleta. Sobrevive la identidad que YA TIENE EL PAGO.
-- Dos excepciones, ambas con fundamento:
--   · `adult ← child`: la ADULTA sobrevive siempre, tenga o no el pago. Es la
--     única que puede entrar, pagar y recibir avisos (regla dura del plan de
--     fusión). Aplica a Esteban Daniel Herrera → PASO 6.
--   · Nadie pagó (Alexander Castillo, Laura Sofía, Josué Cortés): sobrevive la
--     que tiene el cobro vivo, el equipo y las asistencias, y se le trasplanta
--     la cuenta de la otra.
--
-- CONSECUENCIA QUE HAY QUE AVISAR, NO ESCONDER
-- En Julieta Mayorga sobrevive la ficha del PAPÁ y se absorbe la de la MAMÁ; en
-- Josué Cortés sobrevive la del papá y se absorbe la de la mamá. **El acudiente
-- absorbido deja de ver al menor en su app.** Es el efecto directo de "un solo
-- acudiente", no un daño colateral del script. Hay que avisarles.
-- ============================================================================


-- ── PASO 0 — La foto de ANTES (guardala antes de tocar nada) ────────────────
WITH d(persona, rol, atleta_id) AS (
    VALUES
    ('Anaisabel Mondragón',   'queda', '134bb246-df68-4ec1-aa91-1228ec3db94d'::uuid),
    ('Anaisabel Mondragón',   'se va', 'a9c265c5-6c08-41e8-a09d-1cb7ef1d3bd3'),
    ('Gabriela Buitrago',     'queda', 'ba7fb08b-6ad7-4c74-8cc5-a9020caa988b'),
    ('Gabriela Buitrago',     'se va', 'bb8dd235-b51f-40c2-9f9b-4322fc504b41'),
    ('Gabriela Simbaqueva',   'queda', 'ba7a82e5-77bf-4933-be08-d0e18e0a3d4c'),
    ('Gabriela Simbaqueva',   'se va', '0870aa6f-4b65-4c52-afa0-8a19c5e524a0'),
    ('Jefferson Rojas',       'queda', 'e3527635-3652-4418-baf2-638685f9ee10'),
    ('Jefferson Rojas',       'se va', '974791aa-e0ba-4012-a9f7-edd8c8759338'),
    ('Julieta Mayorga',       'queda', '4cc30a3a-bced-4ec7-a454-431b4aa33d74'),
    ('Julieta Mayorga',       'se va', '73d23aea-d9b3-4067-aebb-d1af4307515d'),
    ('Luis Alejandro Parra',  'queda', '09bb93ff-5a18-477f-9328-1c9cbe92bce3'),
    ('Luis Alejandro Parra',  'se va', '28661485-f914-4e48-89a5-19ecf04e0bf8'),
    ('Valentina Barreto',     'queda', '93eeedac-1105-4fb6-a19f-ba21f8e3ef94'),
    ('Valentina Barreto',     'se va', '00e720ba-cba2-46e1-bbf2-88167edf6352'),
    ('Valentina Barreto',     'se va', 'ee81c79f-366d-4e8c-972b-e9737384041a'),
    ('Jerónimo Balaguera',    'queda', 'd810819d-6814-4d92-bf9b-08e679c531e6'),
    ('Jerónimo Balaguera',    'se va', 'b29a8335-84a1-43e4-9ad9-6e0bad856718'),
    ('Darwin Hernández',      'queda', '4815a518-aadc-4100-ac06-455d8f732d40'),
    ('Darwin Hernández',      'se va', '4c271c5c-f879-4f04-8524-fd9bae99c293'),
    ('Alexander Castillo',    'queda', 'd2ef2a2b-1a02-4d19-960b-b2b52900d334'),
    ('Alexander Castillo',    'se va', '6f8cd23e-d6d0-40c2-a5f9-4be763134e9a'),
    ('Laura Sofía Castillo',  'queda', 'b3757287-caff-4c02-8e69-7daafc367013'),
    ('Laura Sofía Castillo',  'se va', '3429b7d9-d760-4e12-a42a-f257144c1937'),
    ('Josué Cortés',          'queda', 'cbf0b90e-7ad5-46fc-8e53-d41bfa1c440a'),
    ('Josué Cortés',          'se va', '632b0f58-b409-4be9-8633-ce41ec4c38a9'),
    ('Esteban D. Herrera',    'queda', '91923ae4-d06e-40da-9520-7af034e80ade'),  -- ADULTO
    ('Esteban D. Herrera',    'se va', 'aad8ddb9-5f7a-4d69-ba73-79dfc139b944')   -- menor
)
SELECT d.persona, d.rol, sa.athlete_type AS tipo, sa.is_active AS activo,
       sa.parent_email AS acudiente,
       (sa.parent_id IS NOT NULL OR sa.user_id IS NOT NULL) AS tiene_cuenta,
       sa.team_name AS equipo, sa.plan_name AS plan, sa.price_monthly AS cuota,
       (SELECT count(*) FROM public.payments py
         WHERE (py.child_id=d.atleta_id OR py.user_id=d.atleta_id) AND py.status='paid') AS pagos,
       (SELECT count(*) FROM public.enrollments e
         WHERE (e.child_id=d.atleta_id OR e.user_id=d.atleta_id) AND e.status='active') AS inscr_activas,
       right(d.atleta_id::text,12) AS identidad
FROM d LEFT JOIN public.school_athletes sa ON sa.id = d.atleta_id
ORDER BY d.persona, d.rol DESC;


-- ══ PASO 1 — Trasplantar la CUENTA donde el que paga no la tiene ═══════════
-- Tres casos donde el que pagó NO tiene cuenta y el que se absorbe SÍ. Si se
-- desactivara sin esto, la familia queda pagando y sin poder entrar a la app.
-- Se mueve `parent_id` (y el correo temporal) del absorbido al sobreviviente.

-- 1.a Verificar ANTES (3 filas: el sobreviviente sin cuenta, el otro con cuenta)
SELECT c.id, c.full_name, c.parent_id, c.parent_email_temp, c.is_active
FROM public.children c
WHERE c.id IN ('4815a518-aadc-4100-ac06-455d8f732d40','4c271c5c-f879-4f04-8524-fd9bae99c293',
               'd2ef2a2b-1a02-4d19-960b-b2b52900d334','6f8cd23e-d6d0-40c2-a5f9-4be763134e9a',
               'b3757287-caff-4c02-8e69-7daafc367013','3429b7d9-d760-4e12-a42a-f257144c1937')
ORDER BY c.full_name, c.created_at;

-- 1.b Mover la cuenta al sobreviviente
UPDATE public.children sup
   SET parent_id         = abs.parent_id,
       parent_email_temp = COALESCE(abs.parent_email_temp, sup.parent_email_temp),
       updated_at        = now()
FROM public.children abs
WHERE (sup.id, abs.id) IN (
        ('4815a518-aadc-4100-ac06-455d8f732d40'::uuid, '4c271c5c-f879-4f04-8524-fd9bae99c293'::uuid),
        ('d2ef2a2b-1a02-4d19-960b-b2b52900d334',       '6f8cd23e-d6d0-40c2-a5f9-4be763134e9a'),
        ('b3757287-caff-4c02-8e69-7daafc367013',       '3429b7d9-d760-4e12-a42a-f257144c1937'))
  AND sup.parent_id IS NULL          -- idempotente: si ya se corrió, no hace nada
  AND abs.parent_id IS NOT NULL;

-- 1.c Los cobros vivos del sobreviviente heredan el pagador — si no, 403 al pagar
UPDATE public.payments
   SET parent_id = c.parent_id
FROM public.children c
WHERE payments.child_id = c.id
  AND c.id IN ('4815a518-aadc-4100-ac06-455d8f732d40',
               'd2ef2a2b-1a02-4d19-960b-b2b52900d334',
               'b3757287-caff-4c02-8e69-7daafc367013')
  AND payments.parent_id IS NULL
  AND c.parent_id IS NOT NULL
  AND payments.status IN ('pending','overdue','partial','glosado','awaiting_approval');


-- ══ PASO 2 — Trasplantar el EQUIPO donde el que paga no lo tiene ═══════════
-- Gabriela Buitrago y Gabriela Simbaqueva pagaron sobre una inscripción SIN
-- equipo; el equipo (NUEVA ERA) está del lado que se absorbe. Sin esto quedan
-- pagas y fuera del roster de su equipo.

-- 2.a Verificar ANTES
SELECT e.id, c.full_name, e.status, t.name AS equipo, op.name AS plan, e.monthly_fee
FROM public.enrollments e
JOIN public.children c ON c.id = e.child_id
LEFT JOIN public.teams t ON t.id = e.team_id
LEFT JOIN public.offering_plans op ON op.id = e.offering_plan_id
WHERE e.child_id IN ('ba7fb08b-6ad7-4c74-8cc5-a9020caa988b','bb8dd235-b51f-40c2-9f9b-4322fc504b41',
                     'ba7a82e5-77bf-4933-be08-d0e18e0a3d4c','0870aa6f-4b65-4c52-afa0-8a19c5e524a0')
  AND e.status = 'active'
ORDER BY c.full_name;

-- 2.b Mover el equipo a la inscripción activa del sobreviviente
UPDATE public.enrollments sup
   SET team_id = abs.team_id, updated_at = now()
FROM public.enrollments abs
WHERE sup.status = 'active' AND abs.status = 'active'
  AND sup.team_id IS NULL AND abs.team_id IS NOT NULL
  AND (sup.child_id, abs.child_id) IN (
        ('ba7fb08b-6ad7-4c74-8cc5-a9020caa988b'::uuid, 'bb8dd235-b51f-40c2-9f9b-4322fc504b41'::uuid),
        ('ba7a82e5-77bf-4933-be08-d0e18e0a3d4c',       '0870aa6f-4b65-4c52-afa0-8a19c5e524a0'));

-- 2.c El `children.team_id` del sobreviviente acompaña (lo lee el roster)
UPDATE public.children sup
   SET team_id = COALESCE(sup.team_id, abs.team_id), updated_at = now()
FROM public.children abs
WHERE (sup.id, abs.id) IN (
        ('ba7fb08b-6ad7-4c74-8cc5-a9020caa988b'::uuid, 'bb8dd235-b51f-40c2-9f9b-4322fc504b41'::uuid),
        ('ba7a82e5-77bf-4933-be08-d0e18e0a3d4c',       '0870aa6f-4b65-4c52-afa0-8a19c5e524a0'))
  AND sup.team_id IS NULL;


-- ══ PASO 3 — Ningún absorbido puede llevarse plata viva ════════════════════
-- Medido el 12-ago: de los 12 absorbidos child←child, NINGUNO tiene cobro vivo
-- ni pago recibido. Si esta consulta devuelve algo, PARAR: alguien pagó del
-- lado que se iba a desactivar y hay que decidir a mano (mover el cobro, no
-- cancelarlo — es plata de una familia).
SELECT c.full_name, py.id AS payment_id, py.amount, py.status, py.period_year, py.period_month
FROM public.payments py
JOIN public.children c ON c.id = py.child_id
WHERE py.child_id IN (
        'a9c265c5-6c08-41e8-a09d-1cb7ef1d3bd3','bb8dd235-b51f-40c2-9f9b-4322fc504b41',
        '0870aa6f-4b65-4c52-afa0-8a19c5e524a0','974791aa-e0ba-4012-a9f7-edd8c8759338',
        '73d23aea-d9b3-4067-aebb-d1af4307515d','28661485-f914-4e48-89a5-19ecf04e0bf8',
        '00e720ba-cba2-46e1-bbf2-88167edf6352','ee81c79f-366d-4e8c-972b-e9737384041a',
        'b29a8335-84a1-43e4-9ad9-6e0bad856718','4c271c5c-f879-4f04-8524-fd9bae99c293',
        '6f8cd23e-d6d0-40c2-a5f9-4be763134e9a','3429b7d9-d760-4e12-a42a-f257144c1937',
        '632b0f58-b409-4be9-8633-ce41ec4c38a9')
  AND py.status NOT IN ('cancelled','rejected','failed');


-- ══ PASO 4 — Cancelar las inscripciones del absorbido ══════════════════════
-- Esto es lo que corta el doble cobro de septiembre. Los índices únicos de
-- cobro son parciales `WHERE status='active'`, así que cancelar acá es lo que
-- deja el terreno limpio.
UPDATE public.enrollments
   SET status = 'cancelled', end_date = COALESCE(end_date, CURRENT_DATE), updated_at = now()
WHERE child_id IN (
        'a9c265c5-6c08-41e8-a09d-1cb7ef1d3bd3','bb8dd235-b51f-40c2-9f9b-4322fc504b41',
        '0870aa6f-4b65-4c52-afa0-8a19c5e524a0','974791aa-e0ba-4012-a9f7-edd8c8759338',
        '73d23aea-d9b3-4067-aebb-d1af4307515d','28661485-f914-4e48-89a5-19ecf04e0bf8',
        '00e720ba-cba2-46e1-bbf2-88167edf6352','ee81c79f-366d-4e8c-972b-e9737384041a',
        'b29a8335-84a1-43e4-9ad9-6e0bad856718','4c271c5c-f879-4f04-8524-fd9bae99c293',
        '6f8cd23e-d6d0-40c2-a5f9-4be763134e9a','3429b7d9-d760-4e12-a42a-f257144c1937',
        '632b0f58-b409-4be9-8633-ce41ec4c38a9')
  AND status IN ('active','pending');


-- ══ PASO 5 — Desactivar el absorbido ═══════════════════════════════════════
-- `is_active = false` lo saca del roster, de la generación de mes y de los
-- listados. NO lo borra: se revierte con un UPDATE si algo salió mal.
UPDATE public.children
   SET is_active = false, updated_at = now()
WHERE id IN (
        'a9c265c5-6c08-41e8-a09d-1cb7ef1d3bd3','bb8dd235-b51f-40c2-9f9b-4322fc504b41',
        '0870aa6f-4b65-4c52-afa0-8a19c5e524a0','974791aa-e0ba-4012-a9f7-edd8c8759338',
        '73d23aea-d9b3-4067-aebb-d1af4307515d','28661485-f914-4e48-89a5-19ecf04e0bf8',
        '00e720ba-cba2-46e1-bbf2-88167edf6352','ee81c79f-366d-4e8c-972b-e9737384041a',
        'b29a8335-84a1-43e4-9ad9-6e0bad856718','4c271c5c-f879-4f04-8524-fd9bae99c293',
        '6f8cd23e-d6d0-40c2-a5f9-4be763134e9a','3429b7d9-d760-4e12-a42a-f257144c1937',
        '632b0f58-b409-4be9-8633-ce41ec4c38a9')
  AND is_active;


-- ══ PASO 6 — Esteban Daniel Herrera: adult ← child ═════════════════════════
-- Va aparte porque cruza tablas: la identidad que sobrevive vive en `profiles`
-- (+ `school_members`) y la que se absorbe en `children`. La adulta sobrevive
-- aunque ninguna haya pagado — es la única que puede entrar y pagar.
--
-- El menor tiene 1 cobro VIVO de $150.000 que hay que mover, no cancelar.

-- 6.a Verificar ANTES: 1 cobro vivo del lado del menor
SELECT py.id, py.amount, py.status, py.period_year, py.period_month, py.due_date, py.parent_id
FROM public.payments py
WHERE py.child_id = 'aad8ddb9-5f7a-4d69-ba73-79dfc139b944'
  AND py.status NOT IN ('cancelled','rejected','failed');

-- 6.b Chequeo de colisión: ¿el adulto ya tiene un cobro del mismo período?
--     Si devuelve filas, NO correr 6.c (el índice único de período lo rechaza):
--     cancelar el del menor en vez de moverlo.
SELECT py.id, py.period_year, py.period_month, py.status
FROM public.payments py
WHERE py.user_id = '91923ae4-d06e-40da-9520-7af034e80ade'
  AND py.status NOT IN ('cancelled','rejected','failed')
  AND (py.period_year, py.period_month) IN (
      SELECT p2.period_year, p2.period_month FROM public.payments p2
       WHERE p2.child_id = 'aad8ddb9-5f7a-4d69-ba73-79dfc139b944'
         AND p2.status NOT IN ('cancelled','rejected','failed'));

-- 6.c Mover el cobro del menor al adulto
UPDATE public.payments
   SET child_id  = NULL,
       user_id   = '91923ae4-d06e-40da-9520-7af034e80ade',
       parent_id = '91923ae4-d06e-40da-9520-7af034e80ade',  -- el adulto se paga a sí mismo
       updated_at = now()
WHERE child_id = 'aad8ddb9-5f7a-4d69-ba73-79dfc139b944'
  AND status NOT IN ('cancelled','rejected','failed');

-- 6.d Cancelar la inscripción del menor y desactivarlo
UPDATE public.enrollments
   SET status = 'cancelled', end_date = COALESCE(end_date, CURRENT_DATE), updated_at = now()
WHERE child_id = 'aad8ddb9-5f7a-4d69-ba73-79dfc139b944' AND status IN ('active','pending');

UPDATE public.children
   SET is_active = false, updated_at = now()
WHERE id = 'aad8ddb9-5f7a-4d69-ba73-79dfc139b944' AND is_active;


-- ── PASO 7 — Verificación FINAL: una sola identidad viva por persona ───────
-- Cada persona tiene que salir con `vivas = 1`. Cualquier 2 es un paso que no
-- corrió.
WITH d(persona, atleta_id) AS (
    VALUES
    ('Anaisabel Mondragón',  '134bb246-df68-4ec1-aa91-1228ec3db94d'::uuid),
    ('Anaisabel Mondragón',  'a9c265c5-6c08-41e8-a09d-1cb7ef1d3bd3'),
    ('Gabriela Buitrago',    'ba7fb08b-6ad7-4c74-8cc5-a9020caa988b'),
    ('Gabriela Buitrago',    'bb8dd235-b51f-40c2-9f9b-4322fc504b41'),
    ('Gabriela Simbaqueva',  'ba7a82e5-77bf-4933-be08-d0e18e0a3d4c'),
    ('Gabriela Simbaqueva',  '0870aa6f-4b65-4c52-afa0-8a19c5e524a0'),
    ('Jefferson Rojas',      'e3527635-3652-4418-baf2-638685f9ee10'),
    ('Jefferson Rojas',      '974791aa-e0ba-4012-a9f7-edd8c8759338'),
    ('Julieta Mayorga',      '4cc30a3a-bced-4ec7-a454-431b4aa33d74'),
    ('Julieta Mayorga',      '73d23aea-d9b3-4067-aebb-d1af4307515d'),
    ('Luis Alejandro Parra', '09bb93ff-5a18-477f-9328-1c9cbe92bce3'),
    ('Luis Alejandro Parra', '28661485-f914-4e48-89a5-19ecf04e0bf8'),
    ('Valentina Barreto',    '93eeedac-1105-4fb6-a19f-ba21f8e3ef94'),
    ('Valentina Barreto',    '00e720ba-cba2-46e1-bbf2-88167edf6352'),
    ('Valentina Barreto',    'ee81c79f-366d-4e8c-972b-e9737384041a'),
    ('Jerónimo Balaguera',   'd810819d-6814-4d92-bf9b-08e679c531e6'),
    ('Jerónimo Balaguera',   'b29a8335-84a1-43e4-9ad9-6e0bad856718'),
    ('Darwin Hernández',     '4815a518-aadc-4100-ac06-455d8f732d40'),
    ('Darwin Hernández',     '4c271c5c-f879-4f04-8524-fd9bae99c293'),
    ('Alexander Castillo',   'd2ef2a2b-1a02-4d19-960b-b2b52900d334'),
    ('Alexander Castillo',   '6f8cd23e-d6d0-40c2-a5f9-4be763134e9a'),
    ('Laura Sofía Castillo', 'b3757287-caff-4c02-8e69-7daafc367013'),
    ('Laura Sofía Castillo', '3429b7d9-d760-4e12-a42a-f257144c1937'),
    ('Josué Cortés',         'cbf0b90e-7ad5-46fc-8e53-d41bfa1c440a'),
    ('Josué Cortés',         '632b0f58-b409-4be9-8633-ce41ec4c38a9'),
    ('Esteban D. Herrera',   '91923ae4-d06e-40da-9520-7af034e80ade'),
    ('Esteban D. Herrera',   'aad8ddb9-5f7a-4d69-ba73-79dfc139b944')
)
SELECT d.persona,
       count(*) FILTER (WHERE sa.id IS NOT NULL AND sa.is_active)          AS vivas,
       count(*) FILTER (WHERE ins.activas > 0)                             AS con_inscripcion_activa,
       max(CASE WHEN sa.is_active THEN sa.parent_email END)                AS acudiente_final,
       bool_or(sa.is_active AND (sa.parent_id IS NOT NULL OR sa.user_id IS NOT NULL)) AS el_que_queda_tiene_cuenta,
       max(CASE WHEN sa.is_active THEN sa.team_name END)                   AS equipo_final
FROM d
LEFT JOIN public.school_athletes sa ON sa.id = d.atleta_id
LEFT JOIN LATERAL (
    SELECT count(*) AS activas FROM public.enrollments e
     WHERE (e.child_id=d.atleta_id OR e.user_id=d.atleta_id) AND e.status='active'
) ins ON true
GROUP BY d.persona
ORDER BY 2 DESC, 1;


-- ── PASO 8 — ¿Volvió a aparecer alguno? (correr en unos días) ──────────────
-- Si después de aplicar la migración siguen naciendo duplicados, la puerta
-- cerrada no era la única. Es el bloque 3 del script de auditoría:
--   scripts/dynasty-nuevos-registros-2026-08-08.sql
