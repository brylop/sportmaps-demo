-- =====================================================
-- QA VALIDATION SCRIPTS (DATA INTEGRITY)
-- =====================================================

-- ESCENARIO 1: Registro de Nuevo Director (School + School Member)
-- Objetivo: Verificar que al crear una escuela, el usuario queda como 'admin' y 'owner'.
-- Variables: NEW_SCHOOL_SLUG = 'academia-nueva-test', ADMIN_EMAIL = 'director@test.com'

SELECT 
    s.name as school_name, 
    p.email as admin_email,
    sm.role as member_role,
    sm.status as member_status
FROM schools s
JOIN profiles p ON s.admin_id = p.id
JOIN school_members sm ON sm.school_id = s.id AND sm.profile_id = p.id
WHERE s.slug = 'academia-nueva-test' 
AND p.email = 'director@test.com';

-- CRITERIO DE ÉXITO: 
-- Debe devolver 1 fila.
-- member_role = 'owner' (o 'admin')
-- member_status = 'active'


-- ESCENARIO 2: Inscripción Fallida (Rollback Check)
-- Objetivo: Verificar que si el pago falló, NO existe una inscripción activa (Dirty Read Check).
-- Variables: PARENT_EMAIL = 'padre@fail.com', PROGRAM_NAME = 'Fútbol Elite'

SELECT 
    e.enrollment_status,
    e.payment_status,
    e.is_active
FROM enrollments e
JOIN students st ON e.student_id = st.id
JOIN profiles parent ON st.parent_id = parent.id
JOIN programs prog ON e.program_id = prog.id
WHERE parent.email = 'padre@fail.com'
AND prog.name = 'Fútbol Elite'
AND e.created_at > (NOW() - INTERVAL '10 minutes');

-- CRITERIO DE ÉXITO:
-- Si el pago falló completamente en el backend: Debe devolver 0 filas.
-- Si el pago quedó 'rejected': payment_status = 'rejected' o 'failed', y enrollment_status != 'confirmed'.


-- ESCENARIO 3: Eliminación de Sede (Integridad Referencial)
-- Objetivo: Verificar que al borrar una sede, se borraron sus clases pero NO el historial financiero crítico.
-- Variables: DELETED_BRANCH_ID = 'uuid-de-la-sede-borrada'

-- A. Verificar Clases (Deben haber desaparecido o estar inactivas)
SELECT count(*) as active_classes 
FROM classes 
WHERE school_id = 'uuid-de-la-escuela' 
-- Nota: Si usas branches, sería WHERE branch_id = DELETED_BRANCH_ID
AND is_active = true;

-- B. Verificar Pagos (Deben persistir por auditoría)
SELECT count(*) as preserved_payments
FROM payments p
-- Join con una tabla history si mueves los borrados, o verificar soft-delete
WHERE p.school_id = 'uuid-de-la-escuela';

-- CRITERIO DE ÉXITO:
-- active_classes = 0 (para esa sede)
-- preserved_payments > 0 (No se debe borrar dinero)


-- ESCENARIO 4: Feature Flag de Pagos Activado
-- Objetivo: Confirmar que la escuela tiene Wompi habilitado.
SELECT name, payment_settings 
FROM schools 
WHERE slug = 'spirit-all-stars';

-- CRITERIO DE ÉXITO:
-- payment_settings->>'allow_online' = 'true'
