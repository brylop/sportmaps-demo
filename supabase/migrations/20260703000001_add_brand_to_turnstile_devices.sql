-- ════════════════════════════════════════════════════════════════════════════
-- Agregar columna brand a la tabla turnstile_devices
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.turnstile_devices
  ADD COLUMN IF NOT EXISTS brand text NOT NULL DEFAULT 'Genérico';

-- Reload schema for PostgREST to pick up the new column instantly.
NOTIFY pgrst, 'reload schema';
