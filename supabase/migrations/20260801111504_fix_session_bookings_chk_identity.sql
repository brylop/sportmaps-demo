-- Drop outdated constraints if they exist
ALTER TABLE public.session_bookings DROP CONSTRAINT IF EXISTS check_hybrid_booking;
ALTER TABLE public.session_bookings DROP CONSTRAINT IF EXISTS chk_booking_identity;

-- Add updated constraint to support unregistered_athlete_id
ALTER TABLE public.session_bookings ADD CONSTRAINT chk_booking_identity CHECK (
  (user_id IS NOT NULL AND child_id IS NULL AND unregistered_athlete_id IS NULL)
  OR
  (user_id IS NULL AND child_id IS NOT NULL AND unregistered_athlete_id IS NULL)
  OR
  (user_id IS NULL AND child_id IS NULL AND unregistered_athlete_id IS NOT NULL)
);
