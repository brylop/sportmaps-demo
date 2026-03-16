-- ============================================================
-- MIGRACIÓN: Fix Athlete Enrollments
-- Fecha: 2026-03-12
-- Descripción: Actualiza get_athlete_enrollments para incluir
--              inscripciones directas, por invitación y 
--              reservas (explorar escuelas).
-- ============================================================

CREATE OR REPLACE FUNCTION get_athlete_enrollments()
RETURNS TABLE (
  id UUID,
  enrollment_status VARCHAR,
  start_date DATE,
  end_date DATE,
  expires_at TIMESTAMPTZ,
  sessions_used INT,
  program_id UUID,
  team_id UUID,
  program_name VARCHAR,
  sport VARCHAR,
  level VARCHAR,
  image_url TEXT,
  price_monthly INT,
  school_id UUID,
  school_name VARCHAR,
  school_logo TEXT,
  school_primary_color VARCHAR,
  payment_id UUID,
  payment_status VARCHAR,
  payment_amount_cents INT,
  payment_due_date DATE,
  has_pending_payment BOOLEAN,
  has_processing_payment BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  RETURN QUERY
  -- 1. INSCRIPCIONES ACTIVAS (Enrollments - Directas o Invitaciones)
  SELECT 
    e.id,
    e.status::VARCHAR as enrollment_status,
    e.start_date,
    e.end_date,
    NULL::TIMESTAMPTZ as expires_at,
    0::INT as sessions_used,
    e.program_id,
    e.team_id,
    COALESCE(p.name, t.name, 'Programa Deportivo')::VARCHAR as program_name,
    COALESCE(p.sport, st.name, 'Deporte')::VARCHAR as sport,
    COALESCE(p.level, 'Todos')::VARCHAR as level,
    COALESCE(p.image_url, s.logo_url)::TEXT as image_url,
    COALESCE(p.price_monthly, 0)::INT as price_monthly,
    s.id as school_id,
    s.name::VARCHAR as school_name,
    s.logo_url::TEXT as school_logo,
    COALESCE(b.primary_color, '#0A2540')::VARCHAR as school_primary_color,
    
    pay.id as payment_id,
    pay.status::VARCHAR as payment_status,
    pay.amount_cents as payment_amount_cents,
    pay.due_date as payment_due_date,
    (pay.status = 'pending') as has_pending_payment,
    (pay.status = 'processing') as has_processing_payment

  FROM enrollments e
  LEFT JOIN programs p ON p.id = e.program_id
  LEFT JOIN teams t ON t.id = e.team_id
  LEFT JOIN sports st ON st.id = t.sport_id
  LEFT JOIN schools s ON s.id = COALESCE(p.school_id, t.school_id)
  LEFT JOIN school_branding b ON b.school_id = s.id
  LEFT JOIN LATERAL (
    SELECT ap.id, ap.status, ap.amount_cents, ap.due_date 
    FROM athlete_payments ap 
    WHERE ap.enrollment_id = e.id 
    ORDER BY ap.due_date DESC NULLS LAST, ap.created_at DESC 
    LIMIT 1
  ) pay ON true
  WHERE e.user_id = v_user_id 
    AND e.status IN ('active', 'pending')

  UNION ALL

  -- 2. RESERVAS CONFIRMADAS DESDE EXPLORAR (Bookings)
  SELECT 
    b.id, -- Usamos el ID de la reserva
    b.status::VARCHAR as enrollment_status,
    b.scheduled_at::DATE as start_date,
    NULL::DATE as end_date,
    NULL::TIMESTAMPTZ as expires_at,
    0::INT as sessions_used,
    b.program_id,
    NULL::UUID as team_id,
    p.name::VARCHAR as program_name,
    p.sport::VARCHAR as sport,
    p.level::VARCHAR as level,
    COALESCE(p.image_url, s.logo_url)::TEXT as image_url,
    COALESCE(p.price_monthly, 0)::INT as price_monthly,
    s.id as school_id,
    s.name::VARCHAR as school_name,
    s.logo_url::TEXT as school_logo,
    COALESCE(br.primary_color, '#0A2540')::VARCHAR as school_primary_color,
    
    pay.id as payment_id,
    pay.status::VARCHAR as payment_status,
    pay.amount_cents as payment_amount_cents,
    pay.due_date as payment_due_date,
    (pay.status = 'pending') as has_pending_payment,
    (pay.status = 'processing') as has_processing_payment

  FROM bookings b
  JOIN programs p ON p.id = b.program_id
  JOIN schools s ON s.id = p.school_id
  LEFT JOIN school_branding br ON br.school_id = s.id
  LEFT JOIN LATERAL (
    SELECT ap.id, ap.status, ap.amount_cents, ap.due_date 
    FROM athlete_payments ap 
    WHERE ap.booking_id = b.id 
    ORDER BY ap.due_date DESC NULLS LAST, ap.created_at DESC 
    LIMIT 1
  ) pay ON true
  WHERE b.athlete_id = v_user_id 
    AND b.status IN ('confirmed', 'trial_confirmed')
    AND b.scheduled_at >= CURRENT_DATE - INTERVAL '30 days'; -- Mostrar reservas recientes
END;
$$;
