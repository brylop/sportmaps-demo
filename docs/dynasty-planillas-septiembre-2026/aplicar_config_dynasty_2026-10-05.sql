-- =============================================================================
-- aplicar_config_dynasty_2026-10-05.sql
-- Dynasty Volley Club (school_id 2d509571-3238-4c04-ac3f-6dfe20539226)
-- Respuestas de Milena del 2026-10-05 (P5, P6, P12). Para pegar en el SQL Editor.
--
-- Orden recomendado:
--   0. Desplegar el BFF y el frontend que entienden `only_for` (commit a6f11996
--      + frontend sin commitear de la misma sesión). Si el Nequi se agrega ANTES
--      del deploy, el BFF viejo lo trata como llave GENERAL (vale para
--      mensualidades) y el panel viejo, al guardar, borra `only_for`.
--   1. Bloque A (Nequi solo inscripciones).
--   2. Bloque B (cobros mensuales automáticos).
--   3. Aplicar la migración 20261005120806 y DESPUÉS el bloque C.
--   4. Bloque V (verificación, solo lectura).
-- Cada bloque es idempotente.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- A) P5 — "Nequi personal de Milena donde se pagan las inscripciones nada más"
--
-- Se agrega a payment_accounts con only_for = ['inscripcion']:
--   · el verificador de comprobantes lo acepta como destino de INSCRIPCIONES;
--     para una mensualidad girada ahí deja el comprobante en AMARILLO (revisión
--     de la escuela), no en rojo ni en "destino ajeno";
--   · el bot de WhatsApp y el modal de pago de mensualidad NO lo muestran.
-- NO se escribe en nequi_number: las columnas sueltas no saben de restricciones.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.school_settings
SET payment_accounts = COALESCE(payment_accounts, '[]'::jsonb) || jsonb_build_array(
        jsonb_build_object(
            'id',       gen_random_uuid()::text,
            'type',     'nequi',
            'label',    'Nequi inscripciones',
            'value',    '3204298969',
            'active',   true,
            'only_for', jsonb_build_array('inscripcion')
        )
    ),
    updated_at = now()
WHERE school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
  AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(payment_accounts, '[]'::jsonb)) a
        WHERE regexp_replace(a->>'value', '[^0-9]', '', 'g') = '3204298969'
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- B) P6 — "sí, se deben generar siempre automáticos, y los de vencimiento"
--
-- Cobros mensuales: el cron pg_cron `generate-monthly-charges-daily` (06:30 UTC
-- = 01:30 COT, todos los días) llama open_month(escuela, año, mes) SOLO para
-- escuelas con auto_generate_payments = true. Dynasty lo tenía en false: por
-- eso octubre se abrió a mano.
--
-- Duplicados: open_month es idempotente (advisory lock + no crea si ya existe
-- un cobro activo del mismo atleta con el mismo period_year/period_month, o con
-- due_date dentro del mes). Verificado el 2026-10-05: preview_open_month de
-- octubre para Dynasty = 0 cobros. Activarlo hoy NO duplica octubre; solo
-- cobrará octubre a quien se inscriba de aquí a fin de mes sin cobro del mes,
-- y el 1-nov generará noviembre.
--
-- Vencimiento: NO requiere cambio. `apply-late-fees-daily` (02:00 COT) ya marca
-- pending → overdue a TODAS las escuelas al pasar due_date + payment_grace_days
-- (Dynasty: corte día 10 + 5 días de gracia → vence el 16). El recargo de mora
-- (late_fee_enabled) sigue APAGADO: es una decisión de precio de la escuela y
-- Milena no la pidió (ver bloque opcional al final).
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.school_settings
SET auto_generate_payments = true,
    updated_at = now()
WHERE school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
  AND auto_generate_payments IS DISTINCT FROM true;


-- ─────────────────────────────────────────────────────────────────────────────
-- C) P12 — "dejar la opción" de que los entrenadores suban fotos
-- REQUIERE la migración 20261005120806_coach_sube_fotos_matricula_y_asistencia
-- aplicada antes (crea las columnas). Sin ella este UPDATE falla con 42703.
--   · coach_can_upload_enrollment_forms: el coach sube la hoja de matrícula; la
--     escuela la revisa y aprueba en "Matrículas por revisar".
--   · coach_can_upload_attendance_sheets: la asistencia por foto aún no existe
--     como feature; el permiso queda listo para cuando salga.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.school_settings
SET coach_can_upload_enrollment_forms  = true,
    coach_can_upload_attendance_sheets = true,
    updated_at = now()
WHERE school_id = '2d509571-3238-4c04-ac3f-6dfe20539226';


-- ─────────────────────────────────────────────────────────────────────────────
-- V) Verificación (solo lectura)
-- ─────────────────────────────────────────────────────────────────────────────
-- Llaves: deben salir las 3 Bre-B + el Nequi con only_for ["inscripcion"];
-- nequi_number debe seguir NULL.
SELECT a->>'type' AS tipo, a->>'value' AS valor, a->>'active' AS activa, a->'only_for' AS solo_para,
       s.nequi_number
FROM public.school_settings s, jsonb_array_elements(s.payment_accounts) a
WHERE s.school_id = '2d509571-3238-4c04-ac3f-6dfe20539226';

-- Flags.
SELECT auto_generate_payments, payment_cutoff_day, payment_grace_days,
       late_fee_enabled, reminder_enabled, charge_notifications_enabled,
       coach_can_upload_enrollment_forms, coach_can_upload_attendance_sheets
FROM public.school_settings
WHERE school_id = '2d509571-3238-4c04-ac3f-6dfe20539226';

-- Lo que el cron crearía mañana para el mes en curso (esperado hoy: 0).
SELECT public.preview_open_month(
    '2d509571-3238-4c04-ac3f-6dfe20539226'::uuid,
    extract(year  from (now() AT TIME ZONE 'America/Bogota'))::int,
    extract(month from (now() AT TIME ZONE 'America/Bogota'))::int,
    NULL
) -> 'count' AS cobros_que_crearia_el_cron;


-- ─────────────────────────────────────────────────────────────────────────────
-- OPCIONAL — NO ejecutar sin decisión explícita de la escuela
-- ─────────────────────────────────────────────────────────────────────────────
-- Recargo de mora (5 % ya configurado, apagado). Suma dinero al cobro vencido:
-- UPDATE public.school_settings SET late_fee_enabled = true, updated_at = now()
-- WHERE school_id = '2d509571-3238-4c04-ac3f-6dfe20539226';
--
-- Recordatorio in-app 3 días antes del vencimiento (send_payment_reminders, 08:00 COT):
-- UPDATE public.school_settings SET reminder_enabled = true, updated_at = now()
-- WHERE school_id = '2d509571-3238-4c04-ac3f-6dfe20539226';
