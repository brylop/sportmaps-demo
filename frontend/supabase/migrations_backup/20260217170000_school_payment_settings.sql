-- FEATURE FLAG: Payment Settings per School
-- Description: Adds configuration column to control enabled payment methods for each school.

-- 1. Add payment_settings column with default manual-only
ALTER TABLE public.schools 
ADD COLUMN IF NOT EXISTS payment_settings JSONB DEFAULT '{"allow_online": false, "allow_manual": true}';

-- 2. Add comment for documentation
COMMENT ON COLUMN public.schools.payment_settings IS 'Configuration for enabled payment methods. E.g. {"allow_online": true, "allow_manual": true}';

-- 3. Update existing schools to have this default (if they were NULL)
UPDATE public.schools 
SET payment_settings = '{"allow_online": false, "allow_manual": true}'
WHERE payment_settings IS NULL;
