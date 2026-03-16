-- Migration: Settings Configuration Module RPCs
-- Date: 2026-03-12

-- 1. get_my_settings()
-- Fetches user profile, preferences, and school branding (if applicable)
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
    -- We assume the user is primary associated with one school for settings purposes
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
                'logo_url', v_school.logo_url,
                'branding_settings', v_school.branding_settings,
                'role_in_school', v_school.role
            )
        );
    END IF;

    RETURN v_result;
END;
$$;

-- 2. save_profile_settings
CREATE OR REPLACE FUNCTION save_profile_settings(
    p_full_name text,
    p_phone text,
    p_bio text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.profiles
    SET 
        full_name = p_full_name,
        phone = p_phone,
        bio = p_bio,
        updated_at = now()
    WHERE id = auth.uid();
    
    RETURN FOUND;
END;
$$;

-- 3. save_notification_preferences
CREATE OR REPLACE FUNCTION save_notification_preferences(
    p_preferences jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.profiles
    SET 
        preferences = (COALESCE(preferences, '{}'::jsonb) || p_preferences),
        updated_at = now()
    WHERE id = auth.uid();
    
    RETURN FOUND;
END;
$$;

-- 4. save_privacy_preferences
CREATE OR REPLACE FUNCTION save_privacy_preferences(
    p_preferences jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Privacy settings are stored within the preferences JSONB
    UPDATE public.profiles
    SET 
        preferences = (COALESCE(preferences, '{}'::jsonb) || p_preferences),
        updated_at = now()
    WHERE id = auth.uid();
    
    RETURN FOUND;
END;
$$;

-- 5. save_school_branding
CREATE OR REPLACE FUNCTION save_school_branding(
    p_school_id uuid,
    p_branding jsonb
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
            branding_settings = p_branding,
            updated_at = now()
        WHERE id = p_school_id;
        
        RETURN FOUND;
    END IF;
    
    RETURN FALSE;
END;
$$;

-- 6. save_school_info
CREATE OR REPLACE FUNCTION save_school_info(
    p_school_id uuid,
    p_name text,
    p_description text
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
            updated_at = now()
        WHERE id = p_school_id;
        
        RETURN FOUND;
    END IF;
    
    RETURN FALSE;
END;
$$;

-- 7. get_school_services
CREATE OR REPLACE FUNCTION get_school_services(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_services jsonb;
BEGIN
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', id,
            'name', name,
            'description', description,
            'sport', sport,
            'is_active', active,
            'price_monthly', price_monthly
        )
    ) INTO v_services
    FROM public.teams
    WHERE school_id = p_school_id
    AND status = 'active';
    
    RETURN COALESCE(v_services, '[]'::jsonb);
END;
$$;
