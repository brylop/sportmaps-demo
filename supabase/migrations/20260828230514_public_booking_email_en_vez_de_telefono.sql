-- =============================================================================
-- 20260828230514_public_booking_email_en_vez_de_telefono.sql
-- Autor: judegor99   Fecha: 2026-08-29   Versión anterior: 20260828230513
-- Objetivo: cierra un hallazgo de seguridad en el flujo público de reserva
--   (bff/src/routes/public-booking.routes.ts, /agendar/:slug). El paso de
--   identificación pedía TELÉFONO y buscaba ese teléfono contra
--   public.profiles.phone SIN filtrar por escuela — cualquiera, desde el
--   link público de CUALQUIER escuela, podía escribir un teléfono ajeno y
--   recibir de vuelta el correo completo (sin enmascarar, sin OTP) de la
--   cuenta dueña de ese teléfono en TODA la plataforma.
--
--   Fix de producto (no solo de seguridad): el paso de identificación pasa
--   a pedir CORREO en vez de teléfono, y el código de verificación llega a
--   ese mismo correo. Como el usuario ahora provee su propio identificador
--   (no uno ajeno que el sistema "adivina"), confirmar "ya existe una
--   cuenta con este correo" deja de ser una fuga — es exactamente lo mismo
--   que cualquier formulario de registro le dice al usuario sobre su propio
--   dato. El código en bff/ deja de tocar public.profiles.phone y
--   public.children (ese segundo lookup, por parent_phone, ya estaba roto
--   en producción: children no tiene columna parent_phone, solo
--   parent_phone_temp — el SELECT fallaba en silencio y ese escenario
--   nunca matcheaba nada).
--
--   public_booking_verifications no tiene ninguna migración propia en el
--   historial (drift total, no solo "sin registro" — ni un archivo la
--   menciona). Esta es la primera migración que la toca.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
-- =============================================================================

BEGIN;

-- El teléfono ya no se recolecta en este flujo. Se deja la columna (no se
-- borra, hay filas históricas) pero deja de ser obligatoria.
ALTER TABLE public.public_booking_verifications
  ALTER COLUMN phone DROP NOT NULL;

-- resolved_email pasa a ser el identificador de anti-flood (antes era
-- phone) — mismo patrón de índice que ya existía para teléfono.
CREATE INDEX idx_public_booking_verif_email
  ON public.public_booking_verifications (school_id, resolved_email, created_at);

COMMIT;
