-- Migration: Expand School Settings RPCs
-- Date: 2026-03-12

-- Update get_my_settings to include more school fields
CREATE OR REPLACE FUNCTION get_my_settings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_profile record;
    v_school record;
    v_membership_role text;
    v_result jsonb;
BEGIN
    v_user_id := auth.uid();
    
    -- Get profile info
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Profile not found');
    END IF;

    -- Get school info if the user is a school/school_admin or owner
    SELECT s.*, sm.role INTO v_school
    FROM public.schools s
    JOIN public.school_members sm ON s.id = sm.school_id
    WHERE sm.profile_id = v_user_id
    AND sm.role IN ('owner', 'admin', 'school_admin', 'school')
    LIMIT 1;

    v_result := jsonb_build_object(
        'profile', jsonb_build_object(
            'id', v_profile.id,
            'full_name', v_profile.full_name,
            'email', v_profile.email,
            'phone', v_profile.phone,
            'avatar_url', v_profile.avatar_url,
            'bio', v_profile.bio,
            'role', v_profile.role,
            'preferences', v_profile.preferences
        )
    );

    IF v_school.id IS NOT NULL THEN
        v_result := v_result || jsonb_build_object(
            'school', jsonb_build_object(
                'id', v_school.id,
                'name', v_school.name,
                'description', v_school.description,
                'city', v_school.city,
                'address', v_school.address,
                'phone', v_school.phone,
                'email', v_school.email,
                'website', v_school.website,
                'logo_url', v_school.logo_url,
                'branding_settings', v_school.branding_settings,
                'role_in_school', v_school.role
            )
        );
    END IF;

    RETURN v_result;
END;
$$;

-- Update save_school_info to include all school fields
CREATE OR REPLACE FUNCTION save_school_info(
    p_school_id uuid,
    p_name text,
    p_description text,
    p_city text,
    p_address text,
    p_phone text,
    p_email text,
    p_website text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if user has permission to edit this school
    IF EXISTS (
        SELECT 1 FROM public.school_members
        WHERE school_id = p_school_id
        AND profile_id = auth.uid()
        AND role IN ('owner', 'admin', 'school_admin', 'school')
    ) THEN
        UPDATE public.schools
        SET 
            name = p_name,
            description = p_description,
            city = p_city,
            address = p_address,
            phone = p_phone,
            email = p_email,
            website = p_website,
            updated_at = now()
        WHERE id = p_school_id;
        
        RETURN FOUND;
    END IF;
    
    RETURN FALSE;
END;
$$;
