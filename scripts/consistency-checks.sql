-- =============================================================================
-- consistency-checks.sql — chequeos de consistencia de cartera e identidad
-- Autor: brylop   Creado: 2026-08-04
-- =============================================================================
--
-- QUÉ ES ESTO
--
-- Las ocho consultas que escribimos a mano durante la auditoría del 2026-08-04,
-- convertidas en un chequeo repetible. Cada una salió de un incidente REAL de ese
-- día, y ninguno tenía quien lo detectara: nos enteramos de todos por casualidad,
-- persiguiendo otra cosa.
--
-- CÓMO SE CORRE
--
-- Pegar completo en el SQL editor de Supabase. Editar el `params` de abajo para
-- acotar a una escuela, o dejarlo en NULL para barrer todas. Es SOLO LECTURA: no
-- hay un solo UPDATE acá, a propósito.
--
-- La primera consulta es el tablero — una fila por hallazgo, con severidad. Las
-- secciones comentadas del final son para profundizar en un chequeo puntual.
--
-- GOTCHAS QUE YA ESTÁN CODIFICADOS ACÁ (aprendidos a golpes ese día)
--
--   · El atleta son TRES columnas: `child_id` XOR `user_id` XOR
--     `unregistered_athlete_id`. Cruzar solo por `child_id` deja fuera EN SILENCIO
--     a adultos y no registrados — `NULL = NULL` es NULL, ni true ni false. Nos
--     falló cuatro veces seguidas. Siempre `COALESCE(...)` como identidad.
--   · NO filtrar por `payment_type`: `open_month` inserta 'subscription' y
--     `createPendingPayment` inserta 'one_time'. Filtrar por uno esconde la mitad.
--   · Los estados terminales son `cancelled`, `rejected`, `failed`. Los "vivos"
--     son la misma lista que usan `open_month` y los índices
--     `uniq_payment_active_period_*`: pending, awaiting_approval, paid, partial,
--     overdue, glosado. Si esa lista cambia, hay que cambiarla acá también.
--   · Fecha de negocio = Colombia, no UTC. Un `CURRENT_DATE` pelado en el servidor
--     puede ser mañana.
--   · No usar CREATE TEMP TABLE ni RAISE NOTICE en el SQL editor de Supabase.
--
-- =============================================================================

WITH params AS (
    -- ↓↓↓ EDITAR: uuid de la escuela, o NULL para todas ↓↓↓
    SELECT '2d509571-3238-4c04-ac3f-6dfe20539226'::uuid AS school_id,
           (now() AT TIME ZONE 'America/Bogota')::date  AS hoy
),
vivos AS (
    SELECT ARRAY['pending','awaiting_approval','paid','partial','overdue','glosado'] AS st
),
-- Pagos con la identidad del atleta ya resuelta por las tres columnas.
pay AS (
    SELECT p.id, p.school_id, p.status, p.amount, p.amount_paid, p.concept,
           p.due_date, p.payment_date, p.period_year, p.period_month,
           p.parent_id, p.user_id, p.child_id, p.unregistered_athlete_id,
           p.created_at,
           COALESCE(p.child_id, p.user_id, p.unregistered_athlete_id) AS atleta_id,
           COALESCE(c.full_name, pr.full_name, ua.full_name)          AS atleta
      FROM public.payments p
      LEFT JOIN public.children              c  ON c.id  = p.child_id
      LEFT JOIN public.profiles              pr ON pr.id = p.user_id
      LEFT JOIN public.unregistered_athletes ua ON ua.id = p.unregistered_athlete_id
     WHERE (p.school_id = (SELECT school_id FROM params)
            OR (SELECT school_id FROM params) IS NULL)
),
-- Padrón unificado, para los chequeos de identidad duplicada.
padron AS (
    SELECT c.id, c.school_id, c.full_name, c.doc_number, c.date_of_birth,
           c.is_active, 'children'::text AS tabla,
           COALESCE(pr.phone, c.parent_phone_temp) AS telefono
      FROM public.children c
      LEFT JOIN public.profiles pr ON pr.id = c.parent_id
     WHERE (c.school_id = (SELECT school_id FROM params)
            OR (SELECT school_id FROM params) IS NULL)
    UNION ALL
    SELECT ua.id, ua.school_id, ua.full_name, ua.doc_number, ua.date_of_birth,
           ua.is_active, 'unregistered_athletes'::text, ua.phone
      FROM public.unregistered_athletes ua
     WHERE (ua.school_id = (SELECT school_id FROM params)
            OR (SELECT school_id FROM params) IS NULL)
),
-- Nombre comparable: minúsculas, sin acentos, espacios colapsados.
-- `translate` en vez de `unaccent` porque la extensión no está garantizada.
padron_norm AS (
    SELECT pd.*,
           regexp_replace(
             translate(lower(trim(pd.full_name)), 'áéíóúüñ', 'aeiouun'),
             '\s+', ' ', 'g') AS nombre_norm
      FROM padron pd
)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Cobros cuyo PERIODO y VENCIMIENTO se contradicen
--    Un cobro que cubre septiembre no puede vencer en agosto. Caso real: la vía
--    del QR ponía `due_date = CURRENT_DATE` sobre un periodo futuro, y el motor de
--    mora (que solo mira due_date) marcaba vencido un mes que no había empezado.
--    Corregido en mig 20260804125644 — esto es el guard de regresión.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT '1. periodo vence antes de empezar'         AS chequeo,
       'alta'                                      AS severidad,
       pay.atleta,
       pay.period_month || '/' || pay.period_year || ' vence ' || pay.due_date
         || ' · ' || pay.status || ' · $' || pay.amount                AS detalle,
       pay.id                                      AS ref
  FROM pay, vivos
 WHERE pay.status = ANY (vivos.st)
   AND pay.period_year IS NOT NULL AND pay.period_month IS NOT NULL
   AND pay.due_date < make_date(pay.period_year, pay.period_month, 1)

UNION ALL
-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Inscripción activa CON cuota y SIN cobro del mes en curso
--    El atleta entrena y nadie le está cobrando. Caso real: JUANA TORRES LEON
--    salía "al día" sin tener mensualidad generada, y cinco altas de la tarde
--    quedaron sin cobro porque entraron después de la apertura del mes.
--    La cadena de resolución de cuota es la MISMA que usa open_month.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT '2. inscripcion activa sin cobro del mes',
       'alta',
       COALESCE(c.full_name, pr.full_name, ua.full_name),
       'cuota $' || fee.amount || ' · inscrita desde ' || e.start_date,
       e.id
  FROM public.enrollments e
  CROSS JOIN params
  CROSS JOIN vivos
  LEFT JOIN public.children              c  ON c.id  = e.child_id
  LEFT JOIN public.profiles              pr ON pr.id = e.user_id
  LEFT JOIN public.unregistered_athletes ua ON ua.id = e.unregistered_athlete_id
  LEFT JOIN public.teams                 t  ON t.id  = e.team_id
  CROSS JOIN LATERAL (
      SELECT COALESCE(
        NULLIF(e.monthly_fee, 0),
        NULLIF((SELECT op.price FROM public.offering_plans op WHERE op.id = e.offering_plan_id), 0),
        NULLIF(t.price_monthly, 0),
        NULLIF(c.monthly_fee, 0), 0) AS amount) fee
 WHERE (e.school_id = params.school_id OR params.school_id IS NULL)
   AND e.status = 'active'
   AND fee.amount > 0
   AND COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) IS NOT NULL
   AND NOT EXISTS (
       SELECT 1 FROM pay p2
        WHERE p2.atleta_id = COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id)
          AND p2.status = ANY (vivos.st)
          AND p2.period_year  = EXTRACT(YEAR  FROM params.hoy)::int
          AND p2.period_month = EXTRACT(MONTH FROM params.hoy)::int)

UNION ALL
-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Atleta "al día" con deuda más vieja sin saldar
--    La vista school_athletes tomaba el cobro MÁS NUEVO, así que un pago reciente
--    tapaba la deuda vieja. Caso real: LAURA SOFIA FAJARDO tenía julio pagado y
--    agosto pendiente, y el tablero la daba al día. Corregido en mig
--    20260804125913 — esto debe devolver CERO filas; si devuelve, la vista volvió
--    a mirar el cobro equivocado.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT '3. al dia con deuda vieja (REGRESION de la vista)',
       'alta',
       sa.full_name,
       'payment_status=' || sa.payment_status || ' pero tiene deuda sin saldar',
       sa.id
  FROM public.school_athletes sa
  CROSS JOIN params
 WHERE (sa.school_id = params.school_id OR params.school_id IS NULL)
   AND sa.is_active
   AND sa.payment_status = 'paid'
   AND EXISTS (
       SELECT 1 FROM pay p2
        WHERE p2.atleta_id = sa.id
          AND p2.status IN ('pending','awaiting_approval','overdue','partial','glosado'))

UNION ALL
-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Cobros SIN ATLETA — las tres columnas de identidad en NULL
--    Plata que nadie puede atribuir. Además queda fuera de los índices
--    uniq_payment_active_period_* y del dedup de open_month, así que se puede
--    duplicar libremente. Caso real: el pago de $90.000 de Dai Vázquez.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT '4. cobro sin atleta',
       'alta',
       COALESCE(pay.atleta, '(sin atleta)'),
       pay.concept || ' · $' || pay.amount || ' · ' || pay.status,
       pay.id
  FROM pay, vivos
 WHERE pay.status = ANY (vivos.st)
   AND pay.atleta_id IS NULL

UNION ALL
-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Cobros SIN PAGADOR — impagables online
--    El guard anti-IDOR de create-session compara el caller contra
--    [parent_id, user_id]; con ambos en NULL responde 403 "No tienes permiso para
--    pagar este registro" al propio acudiente. Solo afecta a menores: para un
--    adulto, user_id ES el pagador.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT '5. cobro sin pagador (impagable online)',
       'media',
       COALESCE(pay.atleta, '(sin nombre)'),
       pay.concept || ' · $' || pay.amount || ' · vence ' || pay.due_date,
       pay.id
  FROM pay
 WHERE pay.status IN ('pending','awaiting_approval','overdue','partial','glosado')
   AND pay.parent_id IS NULL
   AND pay.user_id   IS NULL

UNION ALL
-- ─────────────────────────────────────────────────────────────────────────────
-- 6. DOS cobros vivos del mismo mes para el mismo atleta
--    Los índices únicos por periodo deberían impedirlo, pero son PARCIALES
--    (exigen period_year NOT NULL) y no cubren los cobros sin atleta. Caso real:
--    ISABELLA PRIETO con agosto de open_month y septiembre del alta.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT '6. dos cobros vivos del mismo mes',
       'alta',
       COALESCE(max(pay.atleta), '(sin nombre)'),
       pay.period_month || '/' || pay.period_year || ' · ' || count(*)
         || ' cobros · $' || sum(pay.amount),
       (array_agg(pay.id ORDER BY pay.id))[1]
  FROM pay, vivos
 WHERE pay.status = ANY (vivos.st)
   AND pay.atleta_id IS NOT NULL
   AND pay.period_year IS NOT NULL
 GROUP BY pay.atleta_id, pay.period_year, pay.period_month
HAVING count(*) > 1

UNION ALL
-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Cobros con PERIODO NULL — fuera de todo dedup
--    Los índices uniq_payment_active_period_* son parciales: sin periodo el cobro
--    se escapa y el mismo mes se puede cobrar dos veces. Un trigger no versionado
--    (trg_payments_fill_period, BEFORE INSERT) lo rellena desde due_date, así que
--    esto debería estar cerrado — es guard de regresión.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT '7. cobro sin periodo (fuera del dedup)',
       'media',
       COALESCE(pay.atleta, '(sin nombre)'),
       pay.concept || ' · $' || pay.amount || ' · vence ' || pay.due_date,
       pay.id
  FROM pay, vivos
 WHERE pay.status = ANY (vivos.st)
   AND (pay.period_year IS NULL OR pay.period_month IS NULL)
   AND pay.concept ILIKE '%mensual%'

UNION ALL
-- ─────────────────────────────────────────────────────────────────────────────
-- 8a. Atletas duplicados por DOCUMENTO
--     Señal fuerte, pero atrapa poco: el documento se re-teclea distinto cada vez.
--     Ojo con el falso positivo real: Sara y Silvana Sánchez comparten documento
--     y NO son la misma persona — alguien copió el dato al importar. Un match acá
--     puede ser "duplicado" o "documento mal cargado en una de las dos".
-- ─────────────────────────────────────────────────────────────────────────────
SELECT '8a. duplicado por documento',
       'alta',
       string_agg(pn.full_name, ' | ' ORDER BY pn.id),
       'doc ' || pn.doc_number || ' · ' || count(*) || ' registros',
       (array_agg(pn.id ORDER BY pn.id))[1]
  FROM padron_norm pn
 WHERE NULLIF(trim(pn.doc_number), '') IS NOT NULL
 GROUP BY pn.school_id, pn.doc_number
HAVING count(*) > 1

UNION ALL
-- ─────────────────────────────────────────────────────────────────────────────
-- 8b. Atletas duplicados por NOMBRE NORMALIZADO
--     La señal que sí atrapó lo observado: Josue Cortes Saenz, Gabriela Buitrago
--     y Julieta Mayorga tenían documentos distintos pero nombre idéntico al
--     normalizar. Y no toca a las hermanas Ariza Sánchez, que se llaman distinto.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT '8b. duplicado por nombre normalizado',
       'alta',
       string_agg(pn.full_name, ' | ' ORDER BY pn.id),
       count(*) || ' registros · ' || string_agg(DISTINCT pn.tabla, '+'),
       (array_agg(pn.id ORDER BY pn.id))[1]
  FROM padron_norm pn
 GROUP BY pn.school_id, pn.nombre_norm
HAVING count(*) > 1

UNION ALL
-- ─────────────────────────────────────────────────────────────────────────────
-- 8c. AVISO (no bloqueo): mismo teléfono Y misma fecha de nacimiento
--     Esta señal TIENE FALSOS POSITIVOS REALES y por eso es aviso y no regla:
--     las hermanas Mariana y Sofia Ariza Sánchez comparten fecha de nacimiento
--     (2011-11-16) y el teléfono del acudiente. Fusionar por acá haría desaparecer
--     a una niña. Es la única señal que habría atrapado a Dai Vázquez /
--     DAIMARIS VASQUEZ PEREZ, que se llaman distinto — así que sirve, pero SIEMPRE
--     con revisión humana.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT '8c. AVISO: mismo telefono y fecha de nacimiento',
       'revisar',
       string_agg(pn.full_name, ' | ' ORDER BY pn.id),
       'tel ' || pn.telefono || ' · nace ' || pn.date_of_birth
         || ' · ' || count(*) || ' registros (pueden ser HERMANOS)',
       (array_agg(pn.id ORDER BY pn.id))[1]
  FROM padron_norm pn
 WHERE NULLIF(trim(pn.telefono), '') IS NOT NULL
   AND pn.date_of_birth IS NOT NULL
 GROUP BY pn.school_id, pn.telefono, pn.date_of_birth
HAVING count(*) > 1

ORDER BY 1, 3;


-- =============================================================================
-- DETALLE POR CHEQUEO — descomentar el que interese
-- =============================================================================
--
-- Chequeo 2, con lo que generaría la apertura del mes (misma lógica, sin
-- persistir). Útil ANTES de correr open_month, que es por ESCUELA y no por
-- atleta: en la auditoría generó 21 cobros y disparó 15 notificaciones reales
-- cuando la intención era arreglar UNO.
--
--   SELECT public.preview_open_month('<school_id>', 2026, 8);
--
-- Chequeo 6, viendo las dos filas en conflicto y de qué generador vino cada una
-- (el `concept` delata la vía: 'Mensualidad MM/YYYY - NOMBRE' = open_month;
-- 'Plan X — Mensualidad completa…' = alta; 'Mensualidad Septiembre 2026 - NOMBRE
-- (ESCUELA)' = QR; 'Mensualidad' pelado = registro manual):
--
--   SELECT c.full_name, p.id, p.concept, p.amount, p.status, p.due_date,
--          p.period_month || '/' || p.period_year AS periodo, p.created_at
--     FROM public.payments p JOIN public.children c ON c.id = p.child_id
--    WHERE p.school_id = '<school_id>'
--      AND p.status IN ('pending','awaiting_approval','paid','partial','overdue','glosado')
--    ORDER BY c.full_name, p.period_year, p.period_month, p.created_at;
--
-- Chequeo 8, decidiendo cuál registro sobrevive: el que carga inscripciones y
-- cobros. NUNCA fusionar sin mirar esto.
--
--   SELECT c.id, c.full_name, c.doc_number, c.date_of_birth, c.created_at::date,
--          c.is_active, c.parent_id,
--          (SELECT count(*) FROM public.enrollments e
--            WHERE e.child_id = c.id AND e.status = 'active') AS insc_activas,
--          (SELECT COALESCE(sum(p.amount), 0) FROM public.payments p
--            WHERE p.child_id = c.id
--              AND p.status IN ('pending','awaiting_approval','overdue','partial','glosado')) AS deuda
--     FROM public.children c
--    WHERE c.id IN ('<id_a>', '<id_b>');
--
-- =============================================================================
-- CÓMO SE REPARA (referencia, no ejecutar a ciegas)
-- =============================================================================
--
-- · Mes mal imputado: MOVER el cobro pagado al periodo correcto, no anular y
--   regenerar. `cancelled` está EXCLUIDO del WHERE de los índices únicos y del
--   NOT EXISTS de open_month, así que anular DEJA EL PERIODO LIBRE y la próxima
--   apertura lo vuelve a crear y a notificar. Ocupar el periodo con una fila viva
--   es lo único que lo protege.
-- · Un pago que cubre dos meses no se puede representar con un periodo por fila:
--   hay que partirlo en dos filas. Al copiar, EXCLUIR `qr_id` (duplica
--   school_join_qr_codes.paid_count), `sportmaps_fee`/`gross_amount` (crea un
--   egreso fantasma vía fn_school_fee_to_expense), `reference` (índice único
--   payments_reference_key) y todo el bloque `ocr_*` + `receipt_reference_norm` +
--   `receipt_image_sha256` (índices únicos de dedup de comprobante).
-- · Identidades partidas (perfil adulto + unregistered_athletes): mover primero
--   equipo/cuota/cobros al que sobrevive y SOLO DESPUÉS setear
--   `linked_profile_id`. La tercera rama de school_athletes filtra
--   `WHERE linked_profile_id IS NULL`, así que vincular antes lo saca del listado
--   y se pierde el equipo y el plan.
