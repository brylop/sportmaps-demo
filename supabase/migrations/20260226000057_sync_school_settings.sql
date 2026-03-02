-- Migration: Synchronize school_settings schema with frontend requirements
-- Adds missing automation and policy fields

ALTER TABLE public.school_settings 
  ADD COLUMN IF NOT EXISTS auto_generate_payments BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS reminder_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS reminder_days_before INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS late_fee_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS late_fee_percentage INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS allow_coach_messaging BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS require_payment_proof BOOLEAN DEFAULT TRUE;

-- Add comments for documentation
COMMENT ON COLUMN public.school_settings.auto_generate_payments IS 'Whether to automatically create pending payments each month';
COMMENT ON COLUMN public.school_settings.reminder_enabled IS 'Whether payment reminders are enabled';
COMMENT ON COLUMN public.school_settings.reminder_days_before IS 'Number of days before due date to send reminders';
COMMENT ON COLUMN public.school_settings.late_fee_enabled IS 'Whether late fees are applied after grace period';
COMMENT ON COLUMN public.school_settings.late_fee_percentage IS 'Percentage of late fee to apply';
COMMENT ON COLUMN public.school_settings.allow_coach_messaging IS 'Whether coaches are allowed to message parents directly';
COMMENT ON COLUMN public.school_settings.require_payment_proof IS 'Whether parents must upload a receipt for manual payments';
