-- =========================================================================
-- Diferencias FONTIBON 2026.xlsx -> FONTIBON 2026 (1).xlsx
-- Total cambios: 0
-- Match por doc_number (match seguro)
-- =========================================================================

-- Verificacion: cuantos atletas tienen RH ahora
SELECT COUNT(*) FROM public.children WHERE school_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' AND medical_info LIKE '%RH:%';