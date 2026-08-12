-- ============================================================================
-- DYNASTY VOLLEY CLUB — ALTAS NUEVAS desde el 2026-07-30 hasta hoy
--
-- SOLO LECTURA. Ni un INSERT ni un UPDATE: cada bloque termina en un SELECT.
-- Convención del SQL Editor de Supabase: sin CREATE TEMP TABLE ni RAISE NOTICE,
-- se corre bloque por bloque y se lee el resultado.
--
-- QUÉ CUENTA COMO "REGISTRO NUEVO"
-- No hay una sola tabla de atletas: el roster es la vista `school_athletes`,
-- que une TRES orígenes y NO expone `created_at`. Por eso acá se va a las
-- tablas base:
--   · menores           → public.children.created_at
--   · adultos           → public.school_members.created_at (role = 'athlete')
--   · no registrados    → public.unregistered_athletes.created_at
-- Y aparte se miran los HECHOS del período, que no siempre coinciden con un
-- alta: inscripciones nuevas (bloque 4), cobros emitidos (bloque 5) e
-- invitaciones (bloque 6). Un atleta viejo que recién se inscribió sale en el
-- bloque 4, no en el 2 — son preguntas distintas.
--
-- ZONA HORARIA
-- `created_at` es timestamptz (se guarda en UTC). El corte del 30-jul y la
-- columna `dia` se calculan en America/Bogota, no en UTC: si no, el primer día
-- del rango se corre 5 horas y aparecen/desaparecen filas del borde.
--
-- Fecha del corte: 2026-07-30 00:00 hora Colombia (el día de
-- `scripts/dynasty-cleanup-2026-07-30.sql`; todo lo anterior ya fue auditado).
-- Para mover el rango, cambiá la fecha en el CTE `param` de CADA bloque.
-- ============================================================================


-- ── 1. Resumen: cuántas altas por día y de qué tipo ─────────────────────────
-- La foto de una pantalla. Si acá no hay nada, no hace falta correr el resto.
WITH param AS (
    SELECT (SELECT id FROM public.schools WHERE name ILIKE '%dynasty%' LIMIT 1) AS school_id,
           '2026-07-30'::date AS desde
),
altas AS (
    SELECT 'menor'::text AS tipo, c.created_at, c.is_active
    FROM public.children c, param p
    WHERE c.school_id = p.school_id
      AND (c.created_at AT TIME ZONE 'America/Bogota')::date >= p.desde
    UNION ALL
    SELECT 'adulto', sm.created_at, sm.status = 'active'
    FROM public.school_members sm, param p
    WHERE sm.school_id = p.school_id
      AND sm.role = 'athlete'
      AND (sm.created_at AT TIME ZONE 'America/Bogota')::date >= p.desde
    UNION ALL
    SELECT 'no_registrado', ua.created_at, ua.is_active
    FROM public.unregistered_athletes ua, param p
    WHERE ua.school_id = p.school_id
      AND ua.linked_profile_id IS NULL          -- igual que la vista: el vinculado ya sale como adulto
      AND (ua.created_at AT TIME ZONE 'America/Bogota')::date >= p.desde
)
SELECT (created_at AT TIME ZONE 'America/Bogota')::date         AS dia,
       count(*)                                                  AS altas,
       count(*) FILTER (WHERE tipo = 'menor')                     AS menores,
       count(*) FILTER (WHERE tipo = 'adulto')                    AS adultos,
       count(*) FILTER (WHERE tipo = 'no_registrado')             AS no_registrados,
       count(*) FILTER (WHERE NOT is_active)                      AS ya_inactivos
FROM altas
GROUP BY ROLLUP ((created_at AT TIME ZONE 'America/Bogota')::date)
ORDER BY dia NULLS LAST;   -- la última fila (dia = NULL) es el TOTAL del rango


-- ── 2. Detalle: quién entró, con qué equipo/plan/cuota y quién paga ─────────
-- Una fila por atleta nuevo. `cobros_vivos` y `debe` responden lo que siempre
-- se pregunta después: ¿ya se le está cobrando o entró y quedó sin cobro?
WITH param AS (
    SELECT (SELECT id FROM public.schools WHERE name ILIKE '%dynasty%' LIMIT 1) AS school_id,
           '2026-07-30'::date AS desde
),
nuevos AS (
    -- menores
    SELECT c.id, 'menor'::text AS tipo, c.full_name, c.created_at, c.is_active,
           c.date_of_birth, c.doc_number,
           COALESCE(pr.full_name, c.parent_name_temp)   AS acudiente,
           COALESCE(pr.email,     c.parent_email_temp)  AS acudiente_email,
           (c.parent_id IS NOT NULL)                    AS acudiente_con_cuenta
    FROM public.children c
    JOIN param p ON c.school_id = p.school_id
    LEFT JOIN public.profiles pr ON pr.id = c.parent_id
    WHERE (c.created_at AT TIME ZONE 'America/Bogota')::date >= p.desde
    UNION ALL
    -- adultos (el atleta es su propio pagador)
    SELECT pr.id, 'adulto', pr.full_name, sm.created_at, sm.status = 'active',
           pr.date_of_birth, NULL,
           pr.full_name, pr.email, true
    FROM public.school_members sm
    JOIN param p ON sm.school_id = p.school_id
    JOIN public.profiles pr ON pr.id = sm.profile_id
    WHERE sm.role = 'athlete'
      AND (sm.created_at AT TIME ZONE 'America/Bogota')::date >= p.desde
    UNION ALL
    -- fichas precargadas sin cuenta
    SELECT ua.id, 'no_registrado', ua.full_name, ua.created_at, ua.is_active,
           ua.date_of_birth, ua.doc_number,
           NULL, ua.email, false
    FROM public.unregistered_athletes ua
    JOIN param p ON ua.school_id = p.school_id
    WHERE ua.linked_profile_id IS NULL
      AND (ua.created_at AT TIME ZONE 'America/Bogota')::date >= p.desde
)
SELECT to_char(n.created_at AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI') AS alta,
       n.tipo,
       n.full_name                                  AS atleta,
       n.is_active                                  AS activo,
       n.date_of_birth                              AS nacimiento,
       n.doc_number                                 AS documento,
       n.acudiente,
       n.acudiente_email,
       n.acudiente_con_cuenta,
       t.name                                       AS equipo,
       op.name                                      AS plan,
       -- la cadena real del monto: enrollments.monthly_fee > plan.price > equipo
       COALESCE(e.monthly_fee, op.price, t.price_monthly, 0)  AS cuota,
       e.status                                     AS inscripcion,
       cob.vivos                                    AS cobros_vivos,
       cob.debe                                     AS debe,
       n.id                                         AS atleta_id
FROM nuevos n
CROSS JOIN param pp
LEFT JOIN LATERAL (
    SELECT e2.*
    FROM public.enrollments e2
    WHERE (e2.child_id = n.id OR e2.user_id = n.id OR e2.unregistered_athlete_id = n.id)
      AND e2.school_id = pp.school_id
      AND e2.status = 'active'
    ORDER BY e2.created_at
    LIMIT 1
) e ON true
LEFT JOIN public.teams t           ON t.id  = e.team_id
LEFT JOIN public.offering_plans op ON op.id = e.offering_plan_id
LEFT JOIN LATERAL (
    SELECT count(*)                                        AS vivos,
           COALESCE(sum(py.amount) FILTER (
               WHERE py.status IN ('pending','overdue','partial','glosado','awaiting_approval')), 0) AS debe
    FROM public.payments py
    WHERE (py.child_id = n.id OR py.user_id = n.id OR py.unregistered_athlete_id = n.id)
      AND py.school_id = pp.school_id
      AND py.status NOT IN ('cancelled','rejected','failed')
) cob ON true
ORDER BY n.created_at DESC;


-- ── 3. Alerta de duplicados: ¿el "nuevo" ya existía con otro registro? ──────
-- El auto-registro NO adopta la ficha precargada de la escuela, así que una
-- misma persona puede quedar dos veces en el roster y ser facturable dos veces.
-- Esto compara cada alta nueva contra TODO el roster anterior al corte, por
-- nombre normalizado (sin tildes ni dobles espacios) y por documento.
-- Salida vacía = sin sospechas. Cualquier fila acá se revisa a mano ANTES de
-- emitirle cobro: ver scripts/audit-duplicate-athletes.mjs.
WITH param AS (
    SELECT (SELECT id FROM public.schools WHERE name ILIKE '%dynasty%' LIMIT 1) AS school_id,
           '2026-07-30'::date AS desde
),
roster AS (
    SELECT c.id, c.full_name, c.doc_number, c.date_of_birth, c.created_at, 'menor'::text AS tipo
    FROM public.children c JOIN param p ON c.school_id = p.school_id
    UNION ALL
    SELECT pr.id, pr.full_name, NULL, pr.date_of_birth, sm.created_at, 'adulto'
    FROM public.school_members sm JOIN param p ON sm.school_id = p.school_id
    JOIN public.profiles pr ON pr.id = sm.profile_id
    WHERE sm.role = 'athlete'
    UNION ALL
    SELECT ua.id, ua.full_name, ua.doc_number, ua.date_of_birth, ua.created_at, 'no_registrado'
    FROM public.unregistered_athletes ua JOIN param p ON ua.school_id = p.school_id
    WHERE ua.linked_profile_id IS NULL
),
norm AS (
    SELECT r.*,
           regexp_replace(
               lower(translate(r.full_name,
                               'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')),
               '\s+', ' ', 'g') AS clave
    FROM roster r
)
SELECT to_char(nuevo.created_at AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI') AS alta_nueva,
       nuevo.full_name    AS atleta_nuevo,
       nuevo.tipo         AS tipo_nuevo,
       viejo.full_name    AS posible_gemelo,
       viejo.tipo         AS tipo_gemelo,
       to_char(viejo.created_at AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS alta_gemelo,
       CASE WHEN nuevo.doc_number IS NOT NULL
             AND nuevo.doc_number = viejo.doc_number THEN 'documento igual'
            ELSE 'nombre igual' END AS coincidencia,
       nuevo.id AS id_nuevo,
       viejo.id AS id_gemelo
FROM norm nuevo
JOIN param p ON true
JOIN norm viejo
  ON viejo.id <> nuevo.id
 AND (viejo.created_at AT TIME ZONE 'America/Bogota')::date < p.desde
 AND (
        btrim(viejo.clave) = btrim(nuevo.clave)
     OR (nuevo.doc_number IS NOT NULL AND viejo.doc_number = nuevo.doc_number)
     )
WHERE (nuevo.created_at AT TIME ZONE 'America/Bogota')::date >= p.desde
ORDER BY nuevo.created_at DESC;


-- ── 4. Inscripciones creadas en el rango ────────────────────────────────────
-- Distinto del bloque 2: acá entra también el atleta VIEJO que recién ahora se
-- inscribió, cambió de equipo o le asignaron plan. Es lo que dispara cobros.
WITH param AS (
    SELECT (SELECT id FROM public.schools WHERE name ILIKE '%dynasty%' LIMIT 1) AS school_id,
           '2026-07-30'::date AS desde
)
SELECT to_char(e.created_at AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI') AS creada,
       COALESCE(c.full_name, pr.full_name, ua.full_name) AS atleta,
       CASE WHEN e.child_id IS NOT NULL THEN 'menor'
            WHEN e.user_id  IS NOT NULL THEN 'adulto'
            ELSE 'no_registrado' END                     AS tipo,
       e.status                                          AS estado,
       t.name                                            AS equipo,
       op.name                                           AS plan,
       COALESCE(e.monthly_fee, op.price, t.price_monthly, 0) AS cuota,
       e.start_date,
       e.expires_at,
       e.id                                              AS enrollment_id
FROM public.enrollments e
JOIN param p ON e.school_id = p.school_id
LEFT JOIN public.children c              ON c.id  = e.child_id
LEFT JOIN public.profiles pr             ON pr.id = e.user_id
LEFT JOIN public.unregistered_athletes ua ON ua.id = e.unregistered_athlete_id
LEFT JOIN public.teams t                 ON t.id  = e.team_id
LEFT JOIN public.offering_plans op       ON op.id = e.offering_plan_id
WHERE (e.created_at AT TIME ZONE 'America/Bogota')::date >= p.desde
ORDER BY e.created_at DESC;


-- ── 5. Cobros emitidos en el rango ──────────────────────────────────────────
-- OJO con el período: un cobro creado ahora con período de un mes anterior NO
-- está mal rotulado — es un pago atrasado cargado a mano desde el panel.
WITH param AS (
    SELECT (SELECT id FROM public.schools WHERE name ILIKE '%dynasty%' LIMIT 1) AS school_id,
           '2026-07-30'::date AS desde
)
SELECT to_char(py.created_at AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI') AS emitido,
       COALESCE(c.full_name, pr.full_name, ua.full_name) AS atleta,
       py.concept                                        AS concepto,
       py.amount                                         AS monto,
       py.status                                         AS estado,
       py.due_date                                       AS vence,
       py.period_year || '-' || lpad(py.period_month::text, 2, '0') AS periodo,
       py.payment_date                                   AS pagado_el,
       (py.parent_id IS NULL AND py.child_id IS NOT NULL) AS menor_sin_pagador,  -- 403 al pagar
       py.id                                             AS payment_id
FROM public.payments py
JOIN param p ON py.school_id = p.school_id
LEFT JOIN public.children c               ON c.id  = py.child_id
LEFT JOIN public.profiles pr              ON pr.id = py.user_id
LEFT JOIN public.unregistered_athletes ua ON ua.id = py.unregistered_athlete_id
WHERE (py.created_at AT TIME ZONE 'America/Bogota')::date >= p.desde
ORDER BY py.created_at DESC;


-- ── 6. Invitaciones del rango (enviadas y aceptadas) ────────────────────────
-- La otra puerta de entrada. `expires_at` es decorativo: no se valida en
-- ningún lado, así que una "vencida" se puede aceptar igual — no la cuentes
-- como muerta.
WITH param AS (
    SELECT (SELECT id FROM public.schools WHERE name ILIKE '%dynasty%' LIMIT 1) AS school_id,
           '2026-07-30'::date AS desde
)
SELECT (i.created_at AT TIME ZONE 'America/Bogota')::date AS dia,
       i.status                                           AS estado,
       i.role_to_assign                                   AS rol,
       count(*)                                           AS cantidad
FROM public.invitations i
JOIN param p ON i.school_id = p.school_id
WHERE (i.created_at AT TIME ZONE 'America/Bogota')::date >= p.desde
GROUP BY 1, 2, 3
ORDER BY 1 DESC, 2;


-- ═══════════════════════════════════════════════════════════════════════════
-- 7. ¿LOS DUPLICADOS YA COBRARON DOS VECES?
--
-- Es el paso 1 de la Ola 0 de docs/auditoria-altas-dynasty-2026-08-08.md.
-- Hasta que este bloque cierre no se fusiona, no se anula y no se emite nada.
--
-- LOS 8 GRUPOS SON UNA LISTA FIJA, A PROPÓSITO
-- No los vuelve a detectar: los recibe. Salieron del bloque 3 (5 personas
-- contra la precarga del 6-jul) y de la lectura del bloque 2 (3 pares donde
-- AMBOS lados son posteriores al corte, que el bloque 3 por diseño no ve).
-- Se listan por ID para que la decisión sea sobre la fila exacta y no sobre un
-- nombre — el criterio por nombre ya falló antes en esta misma escuela.
--
-- VALENTINA BARRETO VA CON TRES IDs, no con dos: la ficha precargada más DOS
-- auto-registros del 6-ago separados por 17 minutos. Por eso el bloque agrupa
-- por persona en vez de cruzar parejas: con parejas se la cuenta dos veces (el
-- error que produjo el «9 personas / 20 registros» de la primera lectura).
--
-- NO ENTRA Juliana Simbaqueva: comparte fecha de nacimiento con Gabriela pero
-- tiene documento consecutivo (…363 / …364). Son gemelas, no una fila repetida.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 7.a VEREDICTO — ¿hay un mismo período cobrado en dos identidades? ───────
-- Esta es LA pregunta. Una fila acá = la familia recibió dos cobros del mismo
-- mes por la misma persona. Si además `pagados` > 0, no es un cobro de más:
-- es plata que ya entró dos veces, y eso es devolución o crédito, no anulación.
-- Salida vacía = ningún grupo cobró doble todavía; la fusión es preventiva.
WITH grupos(persona, atleta_id) AS (
    VALUES
      -- ── contra la precarga del 6-jul (bloque 3) ──
      ('Valentina Barreto García',   '93eeedac-1105-4fb6-a19f-ba21f8e3ef94'::uuid),  -- ficha 6-jul
      ('Valentina Barreto García',   '00e720ba-cba2-46e1-bbf2-88167edf6352'::uuid),  -- auto 6-ago 22:01
      ('Valentina Barreto García',   'ee81c79f-366d-4e8c-972b-e9737384041a'::uuid),  -- auto 6-ago 22:18
      ('Josue Cortes Saenz',         'cbf0b90e-7ad5-46fc-8e53-d41bfa1c440a'::uuid),
      ('Josue Cortes Saenz',         '632b0f58-b409-4be9-8633-ce41ec4c38a9'::uuid),
      ('Gabriela Buitrago Forero',   'bb8dd235-b51f-40c2-9f9b-4322fc504b41'::uuid),
      ('Gabriela Buitrago Forero',   'ba7fb08b-6ad7-4c74-8cc5-a9020caa988b'::uuid),
      ('Luis Alejandro Parra Moreno','28661485-f914-4e48-89a5-19ecf04e0bf8'::uuid),
      ('Luis Alejandro Parra Moreno','09bb93ff-5a18-477f-9328-1c9cbe92bce3'::uuid),
      ('Anaisabel Mondragón Mejía',  'a9c265c5-6c08-41e8-a09d-1cb7ef1d3bd3'::uuid),
      ('Anaisabel Mondragón Mejía',  '134bb246-df68-4ec1-aa91-1228ec3db94d'::uuid),
      -- ── pares donde los dos lados son posteriores al corte (bloque 2) ──
      ('Gabriela Simbaqueva Pedraza','ba7a82e5-77bf-4933-be08-d0e18e0a3d4c'::uuid),  -- acudiente con cuenta
      ('Gabriela Simbaqueva Pedraza','0870aa6f-4b65-4c52-afa0-8a19c5e524a0'::uuid),  -- marcianap@ (sin cuenta)
      ('Jerónimo Balaguera',         'b29a8335-84a1-43e4-9ad9-6e0bad856718'::uuid),  -- 4-ago, sin cobro
      ('Jerónimo Balaguera',         'd810819d-6814-4d92-bf9b-08e679c531e6'::uuid),  -- 3-ago, debe 90k
      ('Julieta Mayorga Veloza',     '4cc30a3a-bced-4ec7-a454-431b4aa33d74'::uuid),  -- papá
      ('Julieta Mayorga Veloza',     '73d23aea-d9b3-4067-aebb-d1af4307515d'::uuid)   -- mamá
),
cobros AS (
    SELECT g.persona, g.atleta_id, py.id, py.amount, py.status, py.due_date,
           py.period_year, py.period_month, py.payment_date
    FROM grupos g
    JOIN public.payments py
      ON py.child_id = g.atleta_id
      OR py.user_id = g.atleta_id
      OR py.unregistered_athlete_id = g.atleta_id
    WHERE py.status NOT IN ('cancelled', 'rejected', 'failed')
)
SELECT persona,
       COALESCE(period_year || '-' || lpad(period_month::text, 2, '0'), '(sin período)') AS periodo,
       count(DISTINCT atleta_id)                              AS identidades_cobradas,
       count(*)                                               AS cobros,
       sum(amount)                                            AS total_cobrado,
       count(*) FILTER (WHERE status = 'paid')                AS ya_pagados,
       COALESCE(sum(amount) FILTER (WHERE status = 'paid'), 0) AS plata_ya_recibida
FROM cobros
GROUP BY 1, 2
HAVING count(DISTINCT atleta_id) > 1     -- el mismo mes, en dos identidades
ORDER BY 1, 2;


-- ── 7.b DETALLE — todos los cobros de las 17 identidades ───────────────────
-- Para leer el veredicto de 7.a caso por caso y saber cuál cobro se anula.
-- Ojo con `(sin período)`: `period_*` puede venir NULL en cobros viejos, y esos
-- NO agrupan con nadie en 7.a — un doble cobro puede esconderse ahí. Por eso
-- este detalle trae también `due_date`: si dos identidades tienen cobros que
-- vencen el mismo día, es el mismo mes aunque el período esté vacío.
WITH grupos(persona, atleta_id) AS (
    VALUES
      ('Valentina Barreto García',   '93eeedac-1105-4fb6-a19f-ba21f8e3ef94'::uuid),
      ('Valentina Barreto García',   '00e720ba-cba2-46e1-bbf2-88167edf6352'::uuid),
      ('Valentina Barreto García',   'ee81c79f-366d-4e8c-972b-e9737384041a'::uuid),
      ('Josue Cortes Saenz',         'cbf0b90e-7ad5-46fc-8e53-d41bfa1c440a'::uuid),
      ('Josue Cortes Saenz',         '632b0f58-b409-4be9-8633-ce41ec4c38a9'::uuid),
      ('Gabriela Buitrago Forero',   'bb8dd235-b51f-40c2-9f9b-4322fc504b41'::uuid),
      ('Gabriela Buitrago Forero',   'ba7fb08b-6ad7-4c74-8cc5-a9020caa988b'::uuid),
      ('Luis Alejandro Parra Moreno','28661485-f914-4e48-89a5-19ecf04e0bf8'::uuid),
      ('Luis Alejandro Parra Moreno','09bb93ff-5a18-477f-9328-1c9cbe92bce3'::uuid),
      ('Anaisabel Mondragón Mejía',  'a9c265c5-6c08-41e8-a09d-1cb7ef1d3bd3'::uuid),
      ('Anaisabel Mondragón Mejía',  '134bb246-df68-4ec1-aa91-1228ec3db94d'::uuid),
      ('Gabriela Simbaqueva Pedraza','ba7a82e5-77bf-4933-be08-d0e18e0a3d4c'::uuid),
      ('Gabriela Simbaqueva Pedraza','0870aa6f-4b65-4c52-afa0-8a19c5e524a0'::uuid),
      ('Jerónimo Balaguera',         'b29a8335-84a1-43e4-9ad9-6e0bad856718'::uuid),
      ('Jerónimo Balaguera',         'd810819d-6814-4d92-bf9b-08e679c531e6'::uuid),
      ('Julieta Mayorga Veloza',     '4cc30a3a-bced-4ec7-a454-431b4aa33d74'::uuid),
      ('Julieta Mayorga Veloza',     '73d23aea-d9b3-4067-aebb-d1af4307515d'::uuid)
)
SELECT g.persona,
       right(g.atleta_id::text, 12)                       AS identidad,
       to_char(py.created_at AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI') AS emitido,
       py.concept                                         AS concepto,
       py.amount                                          AS monto,
       py.status                                          AS estado,
       py.due_date                                        AS vence,
       COALESCE(py.period_year || '-' || lpad(py.period_month::text, 2, '0'),
                '(sin período)')                          AS periodo,
       py.payment_date                                    AS pagado_el,
       (py.parent_id IS NULL AND py.child_id IS NOT NULL)  AS sin_pagador,
       py.id                                              AS payment_id
FROM grupos g
LEFT JOIN public.payments py
       ON (py.child_id = g.atleta_id
        OR py.user_id = g.atleta_id
        OR py.unregistered_athlete_id = g.atleta_id)
      AND py.status NOT IN ('cancelled', 'rejected', 'failed')
ORDER BY g.persona, g.atleta_id, py.due_date NULLS LAST;
-- LEFT JOIN a propósito: la identidad SIN cobros también tiene que salir — es
-- la candidata natural a ser absorbida, y si no aparece, no se ve que existe.


-- ── 7.c FICHA COMPARATIVA — ¿cuál identidad sobrevive? ─────────────────────
-- La fusión nunca se dispara sola: la confirma un humano. Esto es lo que ese
-- humano necesita ver. Regla dura del plan de fusión: si una de las dos es
-- ADULTO, la adulta sobrevive siempre (es la única que puede entrar, pagar y
-- recibir avisos). Entre dos del mismo tipo manda el que ya pagó, tiene
-- acudiente real, equipo y cuota.
WITH grupos(persona, atleta_id) AS (
    VALUES
      ('Valentina Barreto García',   '93eeedac-1105-4fb6-a19f-ba21f8e3ef94'::uuid),
      ('Valentina Barreto García',   '00e720ba-cba2-46e1-bbf2-88167edf6352'::uuid),
      ('Valentina Barreto García',   'ee81c79f-366d-4e8c-972b-e9737384041a'::uuid),
      ('Josue Cortes Saenz',         'cbf0b90e-7ad5-46fc-8e53-d41bfa1c440a'::uuid),
      ('Josue Cortes Saenz',         '632b0f58-b409-4be9-8633-ce41ec4c38a9'::uuid),
      ('Gabriela Buitrago Forero',   'bb8dd235-b51f-40c2-9f9b-4322fc504b41'::uuid),
      ('Gabriela Buitrago Forero',   'ba7fb08b-6ad7-4c74-8cc5-a9020caa988b'::uuid),
      ('Luis Alejandro Parra Moreno','28661485-f914-4e48-89a5-19ecf04e0bf8'::uuid),
      ('Luis Alejandro Parra Moreno','09bb93ff-5a18-477f-9328-1c9cbe92bce3'::uuid),
      ('Anaisabel Mondragón Mejía',  'a9c265c5-6c08-41e8-a09d-1cb7ef1d3bd3'::uuid),
      ('Anaisabel Mondragón Mejía',  '134bb246-df68-4ec1-aa91-1228ec3db94d'::uuid),
      ('Gabriela Simbaqueva Pedraza','ba7a82e5-77bf-4933-be08-d0e18e0a3d4c'::uuid),
      ('Gabriela Simbaqueva Pedraza','0870aa6f-4b65-4c52-afa0-8a19c5e524a0'::uuid),
      ('Jerónimo Balaguera',         'b29a8335-84a1-43e4-9ad9-6e0bad856718'::uuid),
      ('Jerónimo Balaguera',         'd810819d-6814-4d92-bf9b-08e679c531e6'::uuid),
      ('Julieta Mayorga Veloza',     '4cc30a3a-bced-4ec7-a454-431b4aa33d74'::uuid),
      ('Julieta Mayorga Veloza',     '73d23aea-d9b3-4067-aebb-d1af4307515d'::uuid)
)
SELECT g.persona,
       right(g.atleta_id::text, 12)                     AS identidad,
       sa.athlete_type                                  AS tipo,
       sa.full_name                                     AS nombre_guardado,
       sa.is_active                                     AS activo,
       sa.date_of_birth                                 AS nacimiento,
       sa.parent_name                                   AS acudiente,
       sa.parent_email                                  AS acudiente_email,
       (sa.parent_id IS NOT NULL OR sa.user_id IS NOT NULL) AS tiene_cuenta,
       sa.team_name                                     AS equipo,
       sa.plan_name                                     AS plan,
       sa.price_monthly                                 AS cuota,
       sa.payment_status                                AS estado_pago,
       pagos.pagados                                    AS cobros_pagados,
       pagos.vivos                                      AS cobros_vivos,
       -- señales de arrastre: fusionar sin mover esto deja huérfanos apuntando
       -- a una identidad desactivada (paso 0 del plan de fusión). OJO:
       -- `attendance_records.child_id` solo existe para MENORES — para adulto y
       -- no registrado esta columna da 0 y no significa "no tiene historia".
       (SELECT count(*) FROM public.attendance_records ar WHERE ar.child_id = g.atleta_id) AS asistencias,
       (SELECT count(*) FROM public.enrollments e
         WHERE (e.child_id = g.atleta_id OR e.user_id = g.atleta_id
                OR e.unregistered_athlete_id = g.atleta_id)
           AND e.status = 'active')                     AS inscripciones_activas
FROM grupos g
LEFT JOIN public.school_athletes sa ON sa.id = g.atleta_id
LEFT JOIN LATERAL (
    SELECT count(*) FILTER (WHERE py.status = 'paid') AS pagados,
           count(*) FILTER (WHERE py.status IN ('pending','overdue','partial',
                                                'glosado','awaiting_approval')) AS vivos
    FROM public.payments py
    WHERE py.child_id = g.atleta_id
       OR py.user_id = g.atleta_id
       OR py.unregistered_athlete_id = g.atleta_id
) pagos ON true
ORDER BY g.persona, sa.athlete_type, pagos.pagados DESC NULLS LAST;
-- Si una identidad sale con TODO en NULL, es que ya no está en el roster: o se
-- desactivó, o el `unregistered` quedó vinculado (`linked_profile_id`), o el
-- adulto perdió su `school_members`. Ese caso ya está resuelto — no se fusiona.
