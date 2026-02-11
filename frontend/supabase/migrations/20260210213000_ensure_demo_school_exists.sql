-- Ensure the School Profile exists in the public.schools table
-- This fixes the foreign key violation when inserting payments
-- It finds the profile with role='school' and inserts it into schools if missing

DO $$
BEGIN
    -- Fix for missing updated_at column which causes trigger failure
    BEGIN
        ALTER TABLE public.schools ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;
END $$;

DO $$
DECLARE
    school_profile_id UUID;
    school_name TEXT;
BEGIN
    -- Get the ID and Name (or default) of the first school user
    SELECT id, COALESCE(full_name, 'Academia Demo') INTO school_profile_id, school_name
    FROM public.profiles
    WHERE role = 'school'
    LIMIT 1;

    -- If we found a school profile
    IF school_profile_id IS NOT NULL THEN
        -- Insert into schools if it doesn't exist
        INSERT INTO public.schools (id, owner_id, name, description, address, city, phone, email)
        VALUES (
            school_profile_id,
            school_profile_id, -- Set owner_id same as id for demo simplicity, ensuring RLS works
            school_name, 
            'Academia Deportiva de Demostración',
            'Calle 123 # 45-67',
            'Bogotá',
            '3001234567',
            'spoortmaps+school@gmail.com'
        )
        ON CONFLICT (id) DO UPDATE SET
            owner_id = EXCLUDED.owner_id,
            email = EXCLUDED.email,
            phone = EXCLUDED.phone,
            address = EXCLUDED.address,
            city = EXCLUDED.city;
        
        RAISE NOTICE 'Ensured school exists for profile %', school_profile_id;
    ELSE
        RAISE NOTICE 'No school profile found in profiles table';
    END IF;
END $$;
