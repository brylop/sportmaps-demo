-- ==============================================================================
-- VALIDATION SCRIPT: VERIFY RLS HARDENING DEPLOYMENT
-- Fecha: 2026-02-17
-- Autor: Antigravity AI Agent
-- Descripción: Verifica que las tablas críticas tengan RLS activo y las políticas correctas.
-- ==============================================================================

SELECT 
    tablename, 
    policyname, 
    roles, 
    cmd, 
    qual, 
    with_check 
FROM pg_policies 
WHERE tablename IN ('children', 'payments', 'enrollments', 'school_members')
ORDER BY tablename, policyname;

-- Verificar funciones de seguridad creadas
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname IN ('check_is_school_member', 'check_is_school_admin', 'check_is_branch_admin');

-- Verificar columnas clave
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('schools', 'payments', 'enrollments') 
  AND column_name IN ('owner_id', 'parent_id', 'child_id', 'payment_settings');
