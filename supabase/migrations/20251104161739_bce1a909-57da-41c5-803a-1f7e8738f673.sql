-- Simplify children table RLS policies
-- Drop the complex policy that may be causing issues
DROP POLICY IF EXISTS "Parents can view non-demo children" ON children;

-- The simple policy "Parents can view own children" is sufficient
-- It allows parents to see all their children regardless of is_demo status
-- The existing policy: (auth.uid() = parent_id) already works correctly

-- Ensure is_demo defaults to false for non-demo users
-- This is already set in the table definition, but let's be explicit