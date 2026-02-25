-- Extended RLS Policies for SportMaps
-- Date: 2026-02-25
-- Focus: Infrastructure, Academic, Health, and Commerce modules

-- 1. INFRASTRUCTURE & CONFIGURATION
ALTER TABLE school_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE facility_reservations ENABLE ROW LEVEL SECURITY;

-- school_branches: Read by staff and parents of the school
CREATE POLICY "school_branches_read_policy" ON school_branches
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM school_members
            WHERE school_id = school_branches.school_id
            AND user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- facilities: Read by all members of the school
CREATE POLICY "facilities_read_policy" ON facilities
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM school_members
            WHERE school_id = facilities.school_id
            AND user_id = auth.uid()
        )
    );

-- 2. ACADEMIC & SPORTS (Extended)
ALTER TABLE training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_progress ENABLE ROW LEVEL SECURITY;

-- training_plans: Coaches can manage, others see
CREATE POLICY "training_plans_coach_policy" ON training_plans
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM school_members
            WHERE school_id = training_plans.school_id
            AND user_id = auth.uid()
            AND role IN ('school', 'admin', 'coach')
        )
    );

-- 3. HEALTH & STATS (Sensitive Data)
ALTER TABLE health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE athlete_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE wellness_appointments ENABLE ROW LEVEL SECURITY;

-- health_records: Strictly Private
CREATE POLICY "health_records_owner_parent_policy" ON health_records
    FOR SELECT USING (
        athlete_id = auth.uid() -- The athlete themselves
        OR EXISTS ( -- Or their parent
            SELECT 1 FROM children
            WHERE id = health_records.athlete_id
            AND parent_id = auth.uid()
        )
        OR EXISTS ( -- Or medical staff/admin of the school
            SELECT 1 FROM school_members
            WHERE school_id = (SELECT school_id FROM children WHERE id = health_records.athlete_id)
            AND user_id = auth.uid()
            AND role IN ('school', 'admin', 'wellness_professional')
        )
    );

-- 4. COMMERCE
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- products: Visible by school members
CREATE POLICY "products_visibility_policy" ON products
    FOR SELECT USING (
       EXISTS (
           SELECT 1 FROM school_members
           WHERE school_id = products.school_id
           AND user_id = auth.uid()
       )
    );

-- orders: Strictly for the user who created it
CREATE POLICY "orders_own_policy" ON orders
    FOR SELECT USING (user_id = auth.uid());
