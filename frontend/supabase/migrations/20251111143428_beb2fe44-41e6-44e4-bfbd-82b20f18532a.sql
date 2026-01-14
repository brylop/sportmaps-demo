-- ============================================
-- STORAGE BUCKETS CONFIGURATION
-- ============================================

-- Create storage buckets for different file types
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('avatars', 'avatars', true),
  ('medical-documents', 'medical-documents', false),
  ('payment-receipts', 'payment-receipts', false),
  ('facility-photos', 'facility-photos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for avatars bucket (public read, authenticated write)
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND 
  auth.role() = 'authenticated'
);

CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS Policies for medical-documents bucket (private)
CREATE POLICY "Users can view own medical documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'medical-documents' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload medical documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'medical-documents' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS Policies for payment-receipts bucket (private)
CREATE POLICY "Users can view own payment receipts"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'payment-receipts' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Schools can upload payment receipts"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'payment-receipts' AND 
  auth.role() = 'authenticated'
);

-- RLS Policies for facility-photos bucket (public read, schools write)
CREATE POLICY "Anyone can view facility photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'facility-photos');

CREATE POLICY "Schools can upload facility photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'facility-photos' AND 
  auth.role() = 'authenticated'
);

-- ============================================
-- ENABLE REALTIME FOR EXISTING TABLES
-- ============================================

-- Enable realtime for notifications
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Enable realtime for messages
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- ============================================
-- CALENDAR EVENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL, -- 'training', 'match', 'meeting', 'other'
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  location TEXT,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  all_day BOOLEAN DEFAULT false,
  reminder_minutes INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_demo BOOLEAN DEFAULT false
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own calendar events"
ON public.calendar_events FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own calendar events"
ON public.calendar_events FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendar events"
ON public.calendar_events FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendar events"
ON public.calendar_events FOR DELETE
USING (auth.uid() = user_id);

-- Enable realtime for calendar events
ALTER TABLE public.calendar_events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_events;

-- ============================================
-- MESSAGE ATTACHMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view message attachments"
ON public.message_attachments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.messages 
    WHERE messages.id = message_attachments.message_id 
    AND (messages.sender_id = auth.uid() OR messages.recipient_id = auth.uid())
  )
);

CREATE POLICY "Users can create message attachments"
ON public.message_attachments FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.messages 
    WHERE messages.id = message_attachments.message_id 
    AND messages.sender_id = auth.uid()
  )
);

-- ============================================
-- SEARCH FILTERS TABLE (for school recommendations)
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_search_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  preferred_sports TEXT[] DEFAULT '{}',
  preferred_cities TEXT[] DEFAULT '{}',
  max_price NUMERIC,
  min_age INTEGER,
  max_age INTEGER,
  preferred_amenities TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_search_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own search preferences"
ON public.user_search_preferences FOR ALL
USING (auth.uid() = user_id);

-- ============================================
-- ANALYTICS EVENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  page_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Only admins can view analytics (we'll implement admin role later)
CREATE POLICY "System can insert analytics"
ON public.analytics_events FOR INSERT
WITH CHECK (true);

-- ============================================
-- PAYMENT REMINDERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.payment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES public.payments(id) ON DELETE CASCADE NOT NULL,
  reminded_at TIMESTAMPTZ DEFAULT NOW(),
  reminder_type TEXT NOT NULL, -- 'email', 'notification', 'sms'
  sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payment_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment reminders"
ON public.payment_reminders FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.payments 
    WHERE payments.id = payment_reminders.payment_id 
    AND payments.parent_id = auth.uid()
  )
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON public.calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON public.calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_team_id ON public.calendar_events(team_id);
CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id ON public.message_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON public.analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_payment_reminders_payment_id ON public.payment_reminders(payment_id);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE TRIGGER update_calendar_events_updated_at
BEFORE UPDATE ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_search_preferences_updated_at
BEFORE UPDATE ON public.user_search_preferences
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();