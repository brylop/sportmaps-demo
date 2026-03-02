-- Clean up previous test
DELETE FROM auth.users WHERE email = 'test_role_school@test.com';

-- Create a user with 'school' role in metadata
INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at,
    aud,
    role
) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'test_role_school@test.com',
    'encrypted_password',
    now(),
    '{"full_name": "Test School Admin", "role": "school"}'::jsonb,
    now(),
    now(),
    'authenticated',
    'authenticated'
);

-- Check the profile
SELECT id, email, full_name, role FROM public.profiles WHERE email = 'test_role_school@test.com';

-- EXPECTED OUTPUT: role should be 'school', not 'athlete'
