-- =============================================================================
-- FIX & DIAGNOSE: Correct Misclassified Parents
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. AUTOMATIC FIX (High Confidence)
-- Update users who are 'athlete' but are listed as parents in the 'children' table.
-- -----------------------------------------------------------------------------
UPDATE profiles
SET role = 'parent'
WHERE role = 'athlete'
AND id IN (
  SELECT DISTINCT parent_id 
  FROM children
);

-- Sync the role_id column for these updated users
UPDATE profiles
SET role_id = (SELECT id FROM roles WHERE name = 'parent')
WHERE role = 'parent' 
AND (role_id IS NULL OR role_id != (SELECT id FROM roles WHERE name = 'parent'));


-- -----------------------------------------------------------------------------
-- 2. DIAGNOSTIC QUERY (Review Required)
-- Users who are 'athlete', have NO children, and NO enrollments.
-- These are likely parents who signed up but haven't added children yet.
-- -----------------------------------------------------------------------------
-- Run this SELECT to see the candidates:

SELECT 
  p.id, 
  p.full_name, 
  p.email, 
  p.created_at,
  p.role 
FROM profiles p
WHERE p.role = 'athlete'
AND p.id NOT IN (SELECT parent_id FROM children) -- No registered children
AND p.id NOT IN (SELECT user_id FROM enrollments WHERE status = 'active'); -- No active athlete enrollments

-- -----------------------------------------------------------------------------
-- 3. MANUAL FIX EXAMPLE
-- If you identify users in step 2 that should be parents, copy their IDs
-- and replace the example IDs below:
-- -----------------------------------------------------------------------------
/*
UPDATE profiles
SET role = 'parent',
    role_id = (SELECT id FROM roles WHERE name = 'parent')
WHERE id IN (
  'uuid-1',
  'uuid-2',
  'uuid-3'
);
*/
