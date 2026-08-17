-- ============================================================================
-- event_organizers: las tres columnas que el código escribe y la tabla no tiene
--
-- Fecha: 2026-08-17
-- Encontrado al regenerar los tipos de Supabase (INF-8): con los tipos al día,
-- `tsc` señaló cinco lecturas de `bank_data` en una tabla que no la tiene.
--
-- ── Lo que está roto hoy ────────────────────────────────────────────────────
-- El onboarding de organizador **falla siempre**, no en un caso de borde:
--
--   OrganizerOnboardingPage manda `bank_data` en todo envío
--     `bank_data: paymentMethods.includes('bank_transfer') ? bankData : {}`
--   El esquema zod del BFF lo acepta (`organizers.route.ts:17`)
--   y el upsert a `event_organizers` lo lleva a una columna inexistente
--   → PostgREST falla → 500 «Error al guardar el perfil del organizador»
--
-- Y `OrganizerSettingsPage` lee `data.bank_data?.bank_name` etc.: siempre
-- `undefined`, así que el formulario de datos bancarios sale vacío aunque se
-- hubiera guardado algo.
--
-- `nequi_number` y `whatsapp_number` los recoge el wizard y **zod los descarta
-- en silencio** (strip de claves desconocidas), así que hoy se pierden sin
-- error. Se agregan también, y en el mismo commit se suman al esquema del BFF:
-- pedirle un dato al usuario para tirarlo es peor que no pedirlo.
--
-- ── Por qué es seguro ───────────────────────────────────────────────────────
-- `event_organizers` tiene **0 filas** (verificado por REST el 2026-08-17), así
-- que no hay backfill, ni default que recalcular, ni riesgo de bloqueo.
--
-- `bank_data` es jsonb y NO se separa en columnas a propósito: son datos de
-- cuenta bancaria que solo consume el formulario, y `payment_methods` (que sí
-- existe) es otra cosa — la lista de métodos aceptados, `string[]`. Reutilizar
-- una para la otra fue la alternativa considerada y descartada: distinto dato,
-- distinta forma.
-- ============================================================================

BEGIN;

ALTER TABLE public.event_organizers
    ADD COLUMN IF NOT EXISTS bank_data       jsonb DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS nequi_number    text,
    ADD COLUMN IF NOT EXISTS whatsapp_number text;

COMMENT ON COLUMN public.event_organizers.bank_data IS
    'Datos de la cuenta para transferencia: bank_name, account_type, account_number, '
    'holder_name, holder_document. Distinto de payment_methods, que es la lista de '
    'métodos aceptados (string[]). Lo escribe el onboarding de organizador y lo lee '
    'OrganizerSettingsPage.';

COMMENT ON COLUMN public.event_organizers.nequi_number IS
    'Número de Nequi del organizador. Lo recogía el wizard desde antes, pero el esquema '
    'del BFF lo descartaba en silencio.';

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ────────────────────────────────────────────────────────────────────────────
-- Verificación: las tres columnas existen y la tabla sigue vacía.
-- ────────────────────────────────────────────────────────────────────────────
SELECT column_name, data_type, column_default
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'event_organizers'
   AND column_name IN ('bank_data', 'nequi_number', 'whatsapp_number')
 ORDER BY column_name;

SELECT count(*) AS filas_event_organizers FROM public.event_organizers;
