-- Migration: Fix pending invitations after schoolName registration bug
-- Problem: Users invited as school_admin/coach couldn't complete registration
--          because the form incorrectly required a "school name" input.
--          Now that the frontend is fixed, we extend expiry so they can retry.

-- 1. Add expires_at column if it doesn't exist
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now() + interval '30 days');

-- 2. Add parent_phone column if it doesn't exist
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS parent_phone text;

-- 3. Reset expiry for ALL pending invitations to 30 days from now
--    so any invite that was "stuck" due to the registration bug is still usable.
UPDATE public.invitations
SET expires_at = now() + interval '30 days'
WHERE status = 'pending';

-- 4. Reactivate recent invitations that may have been abandoned/declined
--    due to the registration bug (created in the last 60 days).
UPDATE public.invitations
SET status = 'pending',
    expires_at = now() + interval '30 days'
WHERE status = 'declined'
  AND created_at >= now() - interval '60 days'
  AND role_to_assign IN ('school_admin', 'coach', 'athlete');

-- 5. Verify result
DO $$
DECLARE
  v_pending  int;
  v_reactivated int;
BEGIN
  SELECT COUNT(*) INTO v_pending FROM public.invitations WHERE status = 'pending';
  RAISE NOTICE 'Invitaciones pendientes activas: %', v_pending;
END;
$$;
