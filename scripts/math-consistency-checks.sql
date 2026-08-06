-- =============================================================================
-- math-consistency-checks.sql — ¿los cálculos de plata dan lo mismo en todas las capas?
-- Autor: brylop   Creado: 2026-08-06
-- =============================================================================
--
-- QUÉ ES ESTO
--
-- Los hallazgos C-01 a C-05 de `docs/censo-calculos-monetarios.md`, convertidos en
-- chequeos medibles. El censo dice "el código difiere"; esto dice "difiere en N
-- atletas y $X", que es lo que decide qué se arregla primero.
--
-- Hermano de `consistency-checks.sql`. Aquel persigue cartera e identidad; este
-- persigue DIVERGENCIAS DE FÓRMULA entre la BD, el BFF y el navegador.
--
-- CÓMO SE CORRE
--
--   1. Correr el PREFLIGHT de abajo (está dentro de un /* */: descomentarlo o
--      copiar solo esa consulta). Si falta una columna, el tablero entero falla
--      con un error críptico en vez de saltarse el chequeo.
--   2. Pegar el tablero completo en el SQL editor de Supabase. Editar `params`
--      para acotar a una escuela, o dejarlo en NULL para barrer todas.
--
-- Es SOLO LECTURA: no hay un solo UPDATE acá, a propósito.
--
-- NO ESCRIBIR NADA DESPUÉS DEL `;` FINAL. El editor de Supabase parte el contenido
-- por punto y coma y manda cada trozo por separado: un bloque de comentarios al
-- final llega como statement vacío y responde
-- `42601: syntax error at end of input / LINE 0`, aunque la consulta esté perfecta.
-- Por eso esta sección de cierre está acá arriba y no al pie.
--
-- LO QUE ESTE SCRIPT NO MIDE
--
-- Dicho explícito para que no se lea como "ya está todo revisado":
--
--   · C-06 (los dos `prorationUtils` divergieron en `rolling_30`) — no se puede
--     medir en SQL: la divergencia está entre dos procesos de JS. Va con tests de
--     paridad, no con una consulta.
--   · C-07 (saldo negativo en cuentas por pagar a proveedores) — otra tabla, otro
--     eje; va en un chequeo del módulo contable.
--   · C-08 (`apply_late_fees` muta `amount`) — no es una inconsistencia de datos
--     sino un modelo que pierde la tarifa original. Acá solo se compensa restando
--     `late_fee_amount`.
--   · C-09 (la mora no toca `awaiting_approval` ni `glosado`) — es una pregunta de
--     negocio, no un defecto medible. Hay que confirmarla con el cliente.
--   · C-10 (filtro de sede inconsistente en el mismo hook) — se ve leyendo el
--     archivo, no la base.
--   · Marketplace, contable, nómina, créditos de sesión, recargo online y eventos
--     (que además están en USD) no entraron al censo todavía.
--
-- LA CADENA CANÓNICA (todo se mide contra esto)
--
-- La que efectivamente genera la plata, en `open_month`
-- (mig 20260803114540, líneas 134-142):
--
--   COALESCE(NULLIF(e.monthly_fee,0), NULLIF(op.price,0),
--            NULLIF(t.price_monthly,0), NULLIF(c.monthly_fee,0), 0)
--
-- Ojo con el `NULLIF(x, 0)`: un 0 NO es un precio, es un "sin definir" que cae al
-- siguiente eslabón. La vista `school_athletes` usa `COALESCE` pelado y sí lo trata
-- como precio. Esa diferencia es el chequeo C-04.
--
-- GOTCHAS
--
--   · El atleta son TRES columnas: `child_id` XOR `user_id` XOR
--     `unregistered_athlete_id`. Siempre `COALESCE(...)` como identidad.
--   · `payments.status` es TEXT, no el enum `pay_status`: literales pelados, sin cast.
--   · `payments.amount` NO es la tarifa. `apply_late_fees` hace `amount = amount + fee`
--     (hallazgo C-08), así que la tarifa original es `amount - late_fee_amount`.
--     Donde importa, acá se resta.
--   · `early_payment_discount_applied` (payments) y `early_payment_discount_*`
--     (school_settings) EXISTEN en la base pero NINGUNA migración del repo las crea:
--     son parte de la deriva de esquema. Por eso el preflight.
--   · `payments.payment_date` es el día en que la ESCUELA APRUEBA el comprobante, no
--     el día en que la familia pagó. No sirve para juzgar si algo llegó a tiempo
--     (por eso C-01c es un aviso y no una acusación); sí sirve para reproducir lo que
--     muestran las pantallas, que usan esa misma columna.
--   · Fecha de negocio = Colombia, no UTC. Un `CURRENT_DATE` pelado puede ser mañana.
--   · No usar CREATE TEMP TABLE ni RAISE NOTICE en el SQL editor de Supabase.
--
-- =============================================================================


-- =============================================================================
-- PREFLIGHT — correr ESTO PRIMERO, solo. Todas las filas deben decir 'OK'.
-- =============================================================================
/*
SELECT req.tabla || '.' || req.columna AS requerido,
       CASE WHEN c.column_name IS NULL THEN 'FALTA — quitar ese chequeo del tablero'
            ELSE 'OK' END               AS estado
  FROM (VALUES
         ('payments',        'amount'),
         ('payments',        'amount_paid'),
         ('payments',        'late_fee_amount'),
         ('payments',        'early_payment_discount_applied'),
         ('payments',        'period_year'),
         ('school_settings', 'early_payment_discount_enabled'),
         ('school_settings', 'early_payment_discount_days'),
         ('school_settings', 'early_payment_discount_percentage'),
         ('enrollments',     'monthly_fee'),
         ('offering_plans',  'price'),
         ('teams',           'price_monthly'),
         ('children',        'monthly_fee')
       ) AS req(tabla, columna)
  LEFT JOIN information_schema.columns c
         ON c.table_schema = 'public'
        AND c.table_name   = req.tabla
        AND c.column_name  = req.columna
 ORDER BY estado DESC, requerido;
*/


-- =============================================================================
-- TABLERO — una fila por hallazgo, con severidad
-- =============================================================================

WITH params AS (
    -- ↓↓↓ EDITAR: uuid de la escuela, o NULL para todas ↓↓↓
    SELECT '2d509571-3238-4c04-ac3f-6dfe20539226'::uuid AS school_id,
           (now() AT TIME ZONE 'America/Bogota')::date  AS hoy,
           -- ↓↓↓ 'resumen' = un conteo por chequeo (empezar SIEMPRE por acá).
           --     'detalle'  = una fila por hallazgo. C-03b solo ya son cientos de
           --     filas y tapa los chequeos que vienen después. ↓↓↓
           'resumen'::text                              AS modo
),
vivos AS (
    SELECT ARRAY['pending','awaiting_approval','paid','partial','overdue','glosado'] AS st
),
-- Config de descuento por escuela. `days` y `percentage` con los mismos defaults
-- que aplica el frontend cuando la columna viene NULL (PaymentCheckoutModal:178-179).
cfg AS (
    SELECT ss.school_id,
           COALESCE(ss.early_payment_discount_enabled, false)  AS desc_on,
           COALESCE(ss.early_payment_discount_days, 5)         AS desc_dias,
           COALESCE(ss.early_payment_discount_percentage, 0)   AS desc_pct
      FROM public.school_settings ss
),
-- Pagos con la identidad del atleta resuelta y la tarifa separada de la mora.
pay AS (
    SELECT p.id, p.school_id, p.status, p.amount, p.amount_paid, p.due_date,
           p.payment_date, p.period_year, p.period_month, p.created_at,
           COALESCE(p.late_fee_amount, 0)                AS mora,
           p.amount - COALESCE(p.late_fee_amount, 0)     AS tarifa,
           COALESCE(p.early_payment_discount_applied, 0) AS descuento,
           COALESCE(p.child_id, p.user_id, p.unregistered_athlete_id) AS atleta_id,
           COALESCE(c.full_name, pr.full_name, ua.full_name)          AS atleta,
           (p.created_at AT TIME ZONE 'America/Bogota')::date         AS creado_bogota
      FROM public.payments p
      LEFT JOIN public.children              c  ON c.id  = p.child_id
      LEFT JOIN public.profiles              pr ON pr.id = p.user_id
      LEFT JOIN public.unregistered_athletes ua ON ua.id = p.unregistered_athlete_id
     WHERE (p.school_id = (SELECT school_id FROM params)
            OR (SELECT school_id FROM params) IS NULL)
),
-- Tarifa de cada inscripción activa, calculada por las DOS fórmulas que conviven.
--
-- APROXIMACIÓN CONOCIDA: la vista `school_athletes` resuelve plan y equipo con
-- LATERALes SEPARADOS (pueden salir de inscripciones distintas) y fuerza la cuota
-- del equipo a 0 cuando hay plan activo. Acá se modela por inscripción. Coincide en
-- el caso normal (una inscripción por atleta); si un atleta tiene inscripción de
-- plan Y de equipo a la vez, este chequeo puede diferir de la vista — y ese atleta
-- ya es un hallazgo del otro script.
canon AS (
    SELECT e.id                        AS enrollment_id,
           e.school_id,
           COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) AS atleta_id,
           COALESCE(c.full_name, pr.full_name, ua.full_name)          AS atleta,
           e.monthly_fee               AS fee_inscripcion,
           op.price                    AS fee_plan,
           t.price_monthly             AS fee_equipo,
           c.monthly_fee               AS fee_children,
           -- 1) La canónica: la que genera la plata (open_month).
           COALESCE(
             NULLIF(e.monthly_fee, 0),
             NULLIF(op.price, 0),
             NULLIF(t.price_monthly, 0),
             NULLIF(c.monthly_fee, 0),
             0
           )                           AS fee_canon,
           -- 2) La de la vista `school_athletes`: la que ve la escuela en pantalla.
           CASE
             WHEN e.offering_plan_id IS NOT NULL THEN COALESCE(e.monthly_fee, op.price, 0)
             WHEN e.team_id          IS NOT NULL THEN COALESCE(e.monthly_fee, t.price_monthly, 0)
             ELSE COALESCE(c.monthly_fee, 0)
           END                         AS fee_vista
      FROM public.enrollments e
      LEFT JOIN public.children              c  ON c.id  = e.child_id
      LEFT JOIN public.profiles              pr ON pr.id = e.user_id
      LEFT JOIN public.unregistered_athletes ua ON ua.id = e.unregistered_athlete_id
      LEFT JOIN public.offering_plans        op ON op.id = e.offering_plan_id
      LEFT JOIN public.teams                 t  ON t.id  = e.team_id
     WHERE e.status = 'active'
       AND (e.school_id = (SELECT school_id FROM params)
            OR (SELECT school_id FROM params) IS NULL)
),
-- Una fila por atleta con su tarifa canónica, para comparar contra los KPIs que
-- agregan por atleta y no por inscripción.
canon_atleta AS (
    SELECT school_id, atleta_id, max(atleta) AS atleta, max(fee_canon) AS fee_canon
      FROM canon
     WHERE atleta_id IS NOT NULL
     GROUP BY school_id, atleta_id
),
-- Todos los hallazgos en crudo. El SELECT final decide si se muestran uno por uno
-- o agregados — así el resumen y el detalle NUNCA pueden divergir, que es
-- justamente el pecado que persigue este script.
hallazgos AS (

-- ─────────────────────────────────────────────────────────────────────────────
-- C-01a. Descuento por pronto pago MAYOR al techo que permite la escuela
--    El descuento lo calcula y lo persiste el NAVEGADOR (PaymentCheckoutModal
--    escribe `early_payment_discount_applied` en 6 puntos; no hay contraparte en
--    BFF ni en SQL). Nadie del lado servidor valida el monto.
--    Umbral deliberadamente conservador: se compara contra el techo usando la base
--    MÁS GRANDE posible (`amount`, que ya incluye mora) y con +1 de tolerancia de
--    redondeo. Lo que salga acá excede el techo por cualquier lectura. Cero falsos
--    positivos, a cambio de dejar pasar los excesos chicos.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'C-01a. descuento por encima del techo de la escuela' AS chequeo,
       'critica'                                             AS severidad,
       pay.atleta                                            AS atleta,
       'descuento $' || pay.descuento
         || ' > techo $' || round(pay.amount * cfg.desc_pct / 100.0)
         || ' (' || cfg.desc_pct || '% de $' || pay.amount || ')'
         || ' · ' || pay.status                              AS detalle,
       pay.id                                                AS ref
  FROM pay
  JOIN cfg ON cfg.school_id = pay.school_id
 WHERE pay.descuento > 0
   AND pay.descuento > round(pay.amount * cfg.desc_pct / 100.0) + 1

UNION ALL
-- ─────────────────────────────────────────────────────────────────────────────
-- C-01b. Descuento aplicado con el beneficio APAGADO en la escuela
--    Puede ser legítimo (la escuela lo apagó después de concederlo) o puede ser un
--    descuento escrito por fuera de la regla. Sin bitácora del lado servidor no hay
--    forma de distinguirlo desde acá — por eso 'alta' y no 'critica'.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'C-01b. descuento con el beneficio apagado o en 0%',
       'alta',
       pay.atleta,
       'descuento $' || pay.descuento
         || ' · escuela: enabled=' || cfg.desc_on || ' pct=' || cfg.desc_pct
         || ' · cobro creado ' || pay.creado_bogota,
       pay.id
  FROM pay
  JOIN cfg ON cfg.school_id = pay.school_id
 WHERE pay.descuento > 0
   AND (cfg.desc_on IS FALSE OR cfg.desc_pct <= 0)

UNION ALL
-- ─────────────────────────────────────────────────────────────────────────────
-- C-01c. AVISO: descuento acreditado con la ventana ya vencida
--    La ventana va de `created_at` (Bogotá) a +N días, y la elegibilidad la decide
--    `todayColombia()` del DISPOSITIVO: un teléfono con la fecha corrida entra igual.
--
--    OJO — ESTE CHEQUEO NO PRUEBA NADA POR SÍ SOLO. `payment_date` es el día en que
--    la ESCUELA APRUEBA el comprobante, no el día en que la familia pagó. Una familia
--    que pagó dentro de la ventana y cuyo comprobante se aprobó una semana después
--    cae acá siendo inocente — y ese es el caso NORMAL, no la excepción.
--
--    Sirve para acotar la lista de candidatos, no para acusar. Para confirmar uno hay
--    que mirar la fecha real de la transferencia en el comprobante. Por eso 'aviso'.
--    El chequeo que sí acusa sin ambigüedad es C-01a (excede el techo).
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'C-01c. AVISO descuento acreditado con la ventana vencida',
       'aviso',
       pay.atleta,
       'aprobado ' || pay.payment_date
         || ' · ventana vencia ' || (pay.creado_bogota + cfg.desc_dias)
         || ' (' || cfg.desc_dias || 'd desde ' || pay.creado_bogota || ')'
         || ' · descuento $' || pay.descuento
         || ' · VERIFICAR la fecha real del comprobante antes de concluir',
       pay.id
  FROM pay
  JOIN cfg ON cfg.school_id = pay.school_id
 WHERE pay.descuento > 0
   AND pay.payment_date IS NOT NULL
   AND pay.payment_date > (pay.creado_bogota + cfg.desc_dias)

UNION ALL
-- ─────────────────────────────────────────────────────────────────────────────
-- C-01d. Descuento concedido teniendo deuda ANTERIOR sin pagar
--    `hasEarlierUnpaidPayment()` debía bloquearlo, pero es fail-open: ante error de
--    red devuelve false, o sea CONCEDE. Esto mide cuántas veces se cayó por ahí.
--    La identidad va por las tres columnas, no solo child_id/parent_id como la
--    función original — así que puede encontrar casos que ella ni miraba.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'C-01d. descuento con deuda anterior sin pagar',
       'alta',
       pay.atleta,
       'descuento $' || pay.descuento
         || ' · tenia ' || (
              SELECT count(*) FROM pay q
               WHERE q.school_id = pay.school_id
                 AND q.atleta_id = pay.atleta_id
                 AND q.created_at < pay.created_at
                 AND q.status IN ('pending','overdue','partial')
            ) || ' cobro(s) anterior(es) impago(s)',
       pay.id
  FROM pay
 WHERE pay.descuento > 0
   AND pay.atleta_id IS NOT NULL
   AND EXISTS (
         SELECT 1 FROM pay q
          WHERE q.school_id = pay.school_id
            AND q.atleta_id = pay.atleta_id
            AND q.created_at < pay.created_at
            AND q.status IN ('pending','overdue','partial')
       )

UNION ALL
-- ─────────────────────────────────────────────────────────────────────────────
-- C-02a. RESUMEN: cuánto infla el dashboard los ingresos, TOTAL HISTÓRICO
--    RPC `school_payment_kpis`:  paid → LEAST(amount, COALESCE(amount_paid, amount))
--    Hook `useDashboardStatsReal`: paid → amount pelado
--    La diferencia es, peso por peso, lo que el dashboard muestra de más.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'C-02a. RESUMEN inflacion de ingresos (historico)',
       'critica',
       'TODA LA SELECCION',
       'dashboard $' || sum(pay.amount)
         || ' vs KPI $' || sum(LEAST(pay.amount, COALESCE(pay.amount_paid, pay.amount)))
         || ' · infla $' || (sum(pay.amount) - sum(LEAST(pay.amount, COALESCE(pay.amount_paid, pay.amount))))
         || ' en ' || (count(*) FILTER (WHERE COALESCE(pay.amount_paid, pay.amount) < pay.amount)) || ' cobros',
       NULL::uuid
  FROM pay
 WHERE pay.status = 'paid'
HAVING sum(pay.amount) - sum(LEAST(pay.amount, COALESCE(pay.amount_paid, pay.amount))) > 0

UNION ALL
-- ─────────────────────────────────────────────────────────────────────────────
-- C-02b. RESUMEN: lo mismo, acotado al MES EN CURSO por `payment_date`
--    Este es el número que se ve HOY en pantalla: el hook filtra
--    `payment_date >= primer día del mes` (useDashboardStatsReal:119).
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'C-02b. RESUMEN inflacion de ingresos (mes en curso)',
       'critica',
       'TODA LA SELECCION',
       'mes ' || to_char((SELECT hoy FROM params), 'YYYY-MM')
         || ' · dashboard $' || sum(pay.amount)
         || ' vs KPI $' || sum(LEAST(pay.amount, COALESCE(pay.amount_paid, pay.amount)))
         || ' · infla $' || (sum(pay.amount) - sum(LEAST(pay.amount, COALESCE(pay.amount_paid, pay.amount)))),
       NULL::uuid
  FROM pay
 WHERE pay.status = 'paid'
   AND pay.payment_date >= date_trunc('month', (SELECT hoy FROM params))::date
HAVING sum(pay.amount) - sum(LEAST(pay.amount, COALESCE(pay.amount_paid, pay.amount))) > 0

UNION ALL
-- ─────────────────────────────────────────────────────────────────────────────
-- C-02c. DETALLE: los cobros 'paid' donde amount_paid < amount
--    Cada uno de estos es un cobro que el dashboard cuenta completo y el RPC de
--    KPIs cuenta por lo realmente abonado. La causa normal es el descuento por
--    pronto pago: la aprobación de comprobante escribe amount_paid = amount - descuento.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'C-02c. cobro pagado con amount_paid < amount',
       'media',
       pay.atleta,
       'amount $' || pay.amount || ' vs pagado $' || COALESCE(pay.amount_paid, 0)
         || ' · brecha $' || (pay.amount - COALESCE(pay.amount_paid, 0))
         || CASE WHEN pay.descuento > 0
                 THEN ' · descuento registrado $' || pay.descuento
                 ELSE ' · SIN descuento registrado que lo explique' END,
       pay.id
  FROM pay
 WHERE pay.status = 'paid'
   AND COALESCE(pay.amount_paid, pay.amount) < pay.amount

UNION ALL
-- ─────────────────────────────────────────────────────────────────────────────
-- C-03a. RESUMEN: cuánto se equivoca el "Ingreso Potencial Mes"
--    `reports.ts:270` resuelve la tarifa como `children.monthly_fee || teams.price_monthly`,
--    saltándose los DOS primeros eslabones de la canónica (enrollments.monthly_fee y
--    offering_plans.price). Y parte de `children`, así que adultos y no registrados
--    no existen para ese KPI.
--    (Aparte: ese endpoint tiene `.limit(500)` sobre children — una escuela con más
--    de 500 menores trunca el KPI en silencio. No se mide acá.)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'C-03a. RESUMEN ingreso potencial: canonica vs reports',
       'alta',
       'TODA LA SELECCION',
       'canonica $' || sum(ca.fee_canon)
         || ' vs reports $' || sum(
              COALESCE(NULLIF(c.monthly_fee, 0), NULLIF(t.price_monthly, 0), 0)
            )
         || ' · brecha $' || (sum(ca.fee_canon) - sum(
              COALESCE(NULLIF(c.monthly_fee, 0), NULLIF(t.price_monthly, 0), 0)
            ))
         || ' sobre ' || count(*) || ' atletas activos',
       NULL::uuid
  FROM canon_atleta ca
  LEFT JOIN public.children c ON c.id = ca.atleta_id
  LEFT JOIN public.teams    t ON t.id = c.team_id
HAVING sum(ca.fee_canon) <> sum(COALESCE(NULLIF(c.monthly_fee, 0), NULLIF(t.price_monthly, 0), 0))

UNION ALL
-- ─────────────────────────────────────────────────────────────────────────────
-- C-03b. DETALLE: atletas que el "Ingreso Potencial" cotiza mal
--    El caso típico: precio en el plan → reports lo ve en $0.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'C-03b. atleta mal cotizado en ingreso potencial',
       'alta',
       ca.atleta,
       'canonica $' || ca.fee_canon
         || ' vs reports $' || COALESCE(NULLIF(c.monthly_fee, 0), NULLIF(t.price_monthly, 0), 0)
         || CASE WHEN c.id IS NULL
                 THEN ' · INVISIBLE para el KPI (no es `children`)'
                 ELSE '' END,
       ca.atleta_id
  FROM canon_atleta ca
  LEFT JOIN public.children c ON c.id = ca.atleta_id
  LEFT JOIN public.teams    t ON t.id = c.team_id
 WHERE ca.fee_canon <> COALESCE(NULLIF(c.monthly_fee, 0), NULLIF(t.price_monthly, 0), 0)

UNION ALL
-- ─────────────────────────────────────────────────────────────────────────────
-- C-04a. La escuela ve $0 y a la familia le llega el cobro
--    `open_month` usa NULLIF(x,0): el 0 cae al siguiente eslabón y cobra.
--    La vista `school_athletes` usa COALESCE pelado: el 0 es precio y muestra $0.
--    Este es el caso que duele: roster en $0, factura por el precio del plan.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'C-04a. la vista muestra $0 pero open_month cobra',
       'alta',
       canon.atleta,
       'vista $' || canon.fee_vista || ' vs cobro $' || canon.fee_canon
         || ' · inscripcion.monthly_fee=' || COALESCE(canon.fee_inscripcion::text, 'NULL')
         || ' plan=' || COALESCE(canon.fee_plan::text, 'NULL')
         || ' equipo=' || COALESCE(canon.fee_equipo::text, 'NULL'),
       canon.enrollment_id
  FROM canon
 WHERE canon.fee_vista = 0
   AND canon.fee_canon > 0

UNION ALL
-- ─────────────────────────────────────────────────────────────────────────────
-- C-04b. Cualquier otra divergencia vista vs cobro
--    No solo el caso del 0: cualquier atleta donde la pantalla y el generador no
--    coinciden. Si esto sale vacío salvo por C-04a, la única divergencia es la
--    semántica del 0 — que es una decisión de producto pendiente ("exonerado"),
--    no un bug suelto.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'C-04b. vista y cobro discrepan (otros casos)',
       'media',
       canon.atleta,
       'vista $' || canon.fee_vista || ' vs cobro $' || canon.fee_canon
         || ' · inscripcion=' || COALESCE(canon.fee_inscripcion::text, 'NULL')
         || ' plan=' || COALESCE(canon.fee_plan::text, 'NULL')
         || ' equipo=' || COALESCE(canon.fee_equipo::text, 'NULL')
         || ' children=' || COALESCE(canon.fee_children::text, 'NULL'),
       canon.enrollment_id
  FROM canon
 WHERE canon.fee_vista <> canon.fee_canon
   AND NOT (canon.fee_vista = 0 AND canon.fee_canon > 0)   -- ya salió en C-04a

UNION ALL
-- ─────────────────────────────────────────────────────────────────────────────
-- C-05a. RESUMEN: cobros por exactamente $150.000
--    `students.ts:412` y `:482` hacen `student.monthly_fee || 150000` en la carga
--    masiva. Ese número no sale de ninguna configuración de la escuela. Y por ser
--    `||` y no `??`, una cuota legítima de 0 también termina en 150.000.
--    Puede haber escuelas cuya mensualidad REAL sea $150.000: por eso el resumen
--    es un aviso, y el detalle (C-05b) es el que acusa.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'C-05a. AVISO cobros por exactamente $150.000',
       'aviso',
       'TODA LA SELECCION',
       count(*) || ' cobros por $150.000, ' || count(DISTINCT pay.atleta_id) || ' atletas'
         || ' · el mas viejo ' || min(pay.creado_bogota)
         || ' · comparar con la mensualidad real de la escuela',
       NULL::uuid
  FROM pay
 WHERE pay.tarifa = 150000
HAVING count(*) > 0

UNION ALL
-- ─────────────────────────────────────────────────────────────────────────────
-- C-05b. Cobro por $150.000 que NO coincide con la tarifa del atleta
--    Acá el fallback inventado ya no tiene excusa: el atleta tiene una tarifa
--    canónica distinta y aun así se le facturó el número mágico.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'C-05b. cobro de $150.000 sobre atleta con otra tarifa',
       'alta',
       pay.atleta,
       'cobrado $150.000 (tarifa canonica $' || ca.fee_canon || ')'
         || ' · ' || pay.status
         || ' · periodo ' || COALESCE(pay.period_month::text, '?')
         || '/' || COALESCE(pay.period_year::text, '?'),
       pay.id
  FROM pay
  JOIN canon_atleta ca ON ca.atleta_id = pay.atleta_id
                      AND ca.school_id = pay.school_id
 WHERE pay.tarifa = 150000
   AND ca.fee_canon > 0
   AND ca.fee_canon <> 150000

UNION ALL
-- ─────────────────────────────────────────────────────────────────────────────
-- C-12a. RESUMEN: tarifa CONGELADA — la inscripción dejó de seguir al plan
--    Al inscribir, el precio del plan se COPIA a `enrollments.monthly_fee`
--    (enrollments.ts:303), y la cadena canónica lee ese campo ANTES que el plan.
--    El PATCH de un plan (offerings.ts:385) no cascadea a `enrollments`: no hay
--    trigger ni RPC de recálculo. La escuela sube el precio, el catálogo lo muestra
--    y `open_month` sigue cobrando el viejo, para siempre y en silencio.
--    Los que entran DESPUÉS (incluido el alta por QR) sí toman el precio nuevo:
--    dos atletas del mismo equipo pueden pagar distinto según cuándo entraron.
--
--    OJO: congelar el precio pactado puede ser una decisión LEGÍTIMA de la escuela.
--    Este chequeo NO dice que esté mal; dice cuántos están en una tarifa distinta a
--    la del catálogo, que hoy es información que nadie tiene.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'C-12a. RESUMEN tarifa congelada vs precio del plan hoy',
       'alta',
       'TODA LA SELECCION',
       count(*) || ' inscripciones con tarifa distinta al plan'
         || ' · cobrando $' || sum(canon.fee_inscripcion)
         || ' vs catalogo $' || sum(canon.fee_plan)
         || ' · diferencia mensual $' || (sum(canon.fee_plan) - sum(canon.fee_inscripcion)),
       NULL::uuid
  FROM canon
 WHERE canon.fee_inscripcion IS NOT NULL
   AND canon.fee_inscripcion <> 0
   AND canon.fee_plan IS NOT NULL
   AND canon.fee_plan <> canon.fee_inscripcion
HAVING count(*) > 0

UNION ALL
-- ─────────────────────────────────────────────────────────────────────────────
-- C-12b. DETALLE: quién está en una tarifa que ya no es la del catálogo
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'C-12b. inscripcion con tarifa vieja frente al plan',
       'alta',
       canon.atleta,
       'se le cobra $' || canon.fee_inscripcion
         || ' · el plan hoy vale $' || canon.fee_plan
         || ' · ' || CASE WHEN canon.fee_plan > canon.fee_inscripcion
                          THEN 'la escuela deja de percibir $' || (canon.fee_plan - canon.fee_inscripcion)
                          ELSE 'la familia paga $' || (canon.fee_inscripcion - canon.fee_plan) || ' de mas'
                     END,
       canon.enrollment_id
  FROM canon
 WHERE canon.fee_inscripcion IS NOT NULL
   AND canon.fee_inscripcion <> 0
   AND canon.fee_plan IS NOT NULL
   AND canon.fee_plan <> canon.fee_inscripcion

UNION ALL
-- ─────────────────────────────────────────────────────────────────────────────
-- C-12c. Lo mismo para EQUIPOS (escuelas que cobran por equipo, sin plan)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'C-12c. inscripcion con tarifa vieja frente al equipo',
       'media',
       canon.atleta,
       'se le cobra $' || canon.fee_inscripcion
         || ' · el equipo hoy vale $' || canon.fee_equipo,
       canon.enrollment_id
  FROM canon
 WHERE canon.fee_inscripcion IS NOT NULL
   AND canon.fee_inscripcion <> 0
   AND canon.fee_plan IS NULL          -- sin plan: manda el equipo
   AND canon.fee_equipo IS NOT NULL
   AND canon.fee_equipo <> canon.fee_inscripcion
)

-- ─────────────────────────────────────────────────────────────────────────────
-- SALIDA — según `params.modo`
--   'resumen': las filas agregadas (las que dicen TODA LA SELECCION, que traen los
--              montos) + un conteo por chequeo. Cabe en pantalla.
--   'detalle': una fila por hallazgo.
-- Un chequeo que no aparece en el resumen es un chequeo con CERO hallazgos.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT h.chequeo, h.severidad, h.atleta, h.detalle, h.ref
  FROM hallazgos h
 WHERE (SELECT modo FROM params) = 'detalle'
    OR COALESCE(h.atleta, '') = 'TODA LA SELECCION'

UNION ALL

SELECT h.chequeo, h.severidad, '— conteo —', count(*) || ' hallazgo(s)', NULL::uuid
  FROM hallazgos h
 WHERE (SELECT modo FROM params) = 'resumen'
   AND COALESCE(h.atleta, '') <> 'TODA LA SELECCION'
 GROUP BY h.chequeo, h.severidad

 ORDER BY 1, 3;
