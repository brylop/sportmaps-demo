-- VISUALIZATION SCRIPT
-- Run this to SEE your data in the result grid.

-- 1. Check School Configuration
SELECT 
    'School Config' as check_type,
    u.email,
    u.id as auth_user_id,
    p.role as profile_role,
    s.id as school_table_id,
    s.owner_id as school_owner_id,
    CASE 
        WHEN u.id = s.owner_id THEN '✅ OK: Auth matches Owner' 
        ELSE '❌ ERROR: Auth/Owner Mismatch' 
    END as status_check
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.schools s ON s.owner_id = u.id
WHERE u.email = 'spoortmaps+school@gmail.com';

-- 2. Check Parent Payments
SELECT 
    'Payment Record' as check_type,
    pay.id as payment_id,
    pay.amount,
    pay.status,
    pay.school_id as payment_school_id,
    pay.created_at,
    CASE 
        WHEN pay.school_id IS NOT NULL THEN '✅ Linked' 
        ELSE '❌ Orphan (No School ID)' 
    END as linkage_status
FROM auth.users parent
JOIN public.payments pay ON pay.parent_id = parent.id
WHERE parent.email = 'spoortmaps@gmail.com';
