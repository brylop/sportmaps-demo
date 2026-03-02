-- Migration: Add RPC for School Dashboard Stats
-- Eliminates frontend N+1 queries by aggregating stats in the backend

CREATE OR REPLACE FUNCTION get_school_dashboard_stats(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_school_id uuid;
  v_result json;
BEGIN
  -- Validate caller
  IF auth.uid() != p_user_id AND NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Get school ID for the given owner
  SELECT id INTO v_school_id
  FROM schools
  WHERE owner_id = p_user_id
  LIMIT 1;

  IF v_school_id IS NULL THEN
    RETURN json_build_object(
      'programs', 0,
      'active_programs', 0,
      'active_teams', 0,
      'total_students', 0,
      'pending_payments', 0,
      'total_revenue', 0
    );
  END IF;

  -- Build aggregated stats JSON
  SELECT json_build_object(
    'programs', (SELECT COUNT(*) FROM teams WHERE school_id = v_school_id),
    'active_programs', (SELECT COUNT(*) FROM teams WHERE school_id = v_school_id AND active = true),
    'active_teams', (SELECT COUNT(*) FROM teams WHERE school_id = v_school_id AND active = true),
    'total_students', (
      SELECT COUNT(*)
      FROM enrollments e
      JOIN teams t ON e.program_id = t.id
      WHERE t.school_id = v_school_id AND e.status = 'active'
    ),
    'pending_payments', (
      SELECT COUNT(*)
      FROM payments p
      WHERE p.school_id = v_school_id AND p.status = 'pending'
    ),
    'total_revenue', (
      SELECT COALESCE(SUM(amount), 0)
      FROM payments p
      WHERE p.school_id = v_school_id AND p.status IN ('completed', 'approved')
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;
