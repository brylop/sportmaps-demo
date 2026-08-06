-- ============================================================================
-- Verificación de esquema VIVO — insumo del triage de los 26 «sin cobro agosto»
--
-- SOLO LECTURA. Ni un INSERT, UPDATE, DELETE ni DDL. Se puede correr en la base
-- compartida sin riesgo.
--
-- Por qué existe: las migraciones del repo no reproducen la base (hay deriva sin
-- versionar), así que el esquema del triage NO se deduce de `supabase/migrations/`.
-- Lo que PostgREST expone ya lo leí con la service key; acá va solo lo que
-- PostgREST NO puede darme: el CÓDIGO de las funciones, los triggers y los tipos
-- reales de columna.
--
-- CÓMO CORRERLO (editor SQL de Supabase):
--   El editor muestra SOLO el resultado de la última sentencia. Correr UN BLOQUE
--   A LA VEZ (seleccionar el bloque y Ctrl+Enter) y pegarme la salida.
--   El bloque 1 es el que más falta hace; si solo se puede correr uno, ese.
--
-- ── CORRIDO EL 2026-08-06. Qué devolvió: ────────────────────────────────────
--  1. `open_month` viva == la del repo. La cadena del monto queda confirmada:
--     COALESCE(NULLIF(e.monthly_fee,0), NULLIF(op.price,0),
--              NULLIF(t.price_monthly,0), NULLIF(c.monthly_fee,0), 0)
--     Vence en make_date(año, mes, LEAST(cutoff, último día)) → NO usa los días
--     de gracia. `close_month` y `generate_monthly_payments` NO EXISTEN.
--  2. Triggers: `trg_payments_fill_period` (rellena period_* en el INSERT),
--     `trg_notify_on_payment_created` (cada cobro emitido avisa a la familia),
--     `trg_adopt_orphan_payments_on_child_link` + `trg_backfill_payment_payer_on_link`
--     (al vincular acudiente, el cobro huérfano se adopta solo).
--  3. `school_athletes` es VISTA, con `WHERE ua.linked_profile_id IS NULL` en la
--     rama de no registrados, y su cuota NO usa la cadena de open_month → el
--     listado puede mostrar un monto distinto al que la emisión produce.
--  4. `invitations` confirmado SIN `child_id`. `payments.status` es TEXT.
--  5. `payments_status_check` fija el dominio real: pending, paid, overdue,
--     failed, cancelled, awaiting_approval, rejected, partial, glosado.
--     `payments_amount_positive` → amount > 0. `enrollments_active_needs_target`
--     existe pero es NOT VALID (las filas viejas no se chequearon).
--  6. NO hay rastro versionado del cargue: `external_school_imports` es scraping
--     del IDRD. PERO apareció algo mejor para las anulaciones: `audit_logs`
--     (table_name='payments') guarda `action='cancel_duplicate_charge'` con el
--     motivo completo — las 5 anulaciones del 5-ago están ahí, por payment_id.
--     `payment_audit_logs` NO sirve para filtrar: su school_id viene NULL.
-- ============================================================================


-- ── BLOQUE 1 · La cadena canónica del monto (lo que decide el $ del bucket D) ──
-- El spec exige calcular el monto "por la cadena canónica de open_month", no por
-- children.monthly_fee. Necesito el cuerpo REAL de la función en esta base, que
-- puede diferir del .sql del repo.
SELECT p.proname                                   AS funcion,
       pg_get_function_identity_arguments(p.oid)   AS argumentos,
       pg_get_functiondef(p.oid)                   AS definicion
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN (
     'open_month',
     'generate_monthly_payments',
     'qr_first_charge_due_date',
     'close_month'
   )
 ORDER BY p.proname;


-- ── BLOQUE 2 · Triggers vivos sobre las tablas que toca el triage ─────────────
-- Memoria del proyecto: un trigger NO versionado rellena period_year/period_month
-- desde due_date. Si existe, cambia cómo cuento "cobro del período" en el veto.
SELECT c.relname                                AS tabla,
       t.tgname                                 AS trigger,
       CASE WHEN t.tgenabled = 'D' THEN 'DESHABILITADO' ELSE 'activo' END AS estado,
       pg_get_triggerdef(t.oid)                 AS definicion
  FROM pg_trigger t
  JOIN pg_class c     ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE NOT t.tgisinternal
   AND n.nspname = 'public'
   AND c.relname IN ('payments', 'enrollments', 'children',
                     'unregistered_athletes', 'invitations')
 ORDER BY c.relname, t.tgname;


-- ── BLOQUE 3 · ¿school_athletes es vista? ¿cómo arma la cuota y el acudiente? ─
-- El triage NO debe leer la cuota de la vista si la vista tiene su propia cadena
-- distinta a open_month: esa divergencia es justo lo que se está auditando.
SELECT c.relname AS objeto,
       CASE c.relkind WHEN 'v' THEN 'vista'
                      WHEN 'm' THEN 'vista materializada'
                      WHEN 'r' THEN 'tabla' END AS tipo,
       pg_get_viewdef(c.oid, true) AS definicion
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relname IN ('school_athletes')
 ORDER BY c.relname;


-- ── BLOQUE 4 · Tipos y nulabilidad reales de las columnas que uso ────────────
-- Confirma contra la base lo que PostgREST me mostró como nombres de columna.
-- Ojo puesto en: payments.status (TEXT, no enum), enrollments.status,
-- invitations (que NO tiene child_id) y los *_id que uso para cruzar.
SELECT table_name, ordinal_position, column_name, data_type,
       is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name IN ('invitations', 'children', 'unregistered_athletes',
                      'enrollments', 'payments', 'offering_plans', 'teams')
 ORDER BY table_name, ordinal_position;


-- ── BLOQUE 5 · CHECKs de estado (qué valores son legales, sin adivinar) ──────
-- Para no inventar el set de estados vivos/terminales de payments y enrollments.
SELECT c.relname AS tabla, con.conname AS constraint,
       pg_get_constraintdef(con.oid) AS definicion
  FROM pg_constraint con
  JOIN pg_class c     ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND con.contype IN ('c', 'u')
   AND c.relname IN ('payments', 'enrollments', 'children', 'unregistered_athletes')
 ORDER BY c.relname, con.conname;


-- ── BLOQUE 6 · ¿Hay rastro versionado del cargue masivo? ─────────────────────
-- La ventana de la ráfaga la deduzco por created_at, pero si existe una tabla de
-- auditoría/importación el origen deja de ser inferencia y pasa a ser dato.
SELECT table_name
  FROM information_schema.tables
 WHERE table_schema = 'public'
   AND (table_name ILIKE '%audit%' OR table_name ILIKE '%activity%'
     OR table_name ILIKE '%import%' OR table_name ILIKE '%bulk%'
     OR table_name ILIKE '%log%')
 ORDER BY table_name;
