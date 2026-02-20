-- ============================================================
-- SPORTMAPS SEED DATA
-- PARA PRUEBAS Y VALIDACIÓN DE RLS
-- ============================================================

-- 1. Insertar Roles básicos
INSERT INTO public.roles (name, display_name, description) VALUES
('super_admin', 'Administrador de Plataforma', 'Acceso total a la infraestructura'),
('school_admin', 'Gerente de Escuela', 'Gestión administrativa de la institución'),
('coach', 'Entrenador / Instructor', 'Gestión de clases, asistencia y planes de entrenamiento'),
('parent', 'Acudiente / Padre', 'Gestión de hijos, inscripciones y pagos'),
('athlete', 'Atleta / Estudiante', 'Visualización de clases y progreso'),
('wellness_professional', 'Profesional de Bienestar', 'Gestión de citas de salud y evaluaciones')
ON CONFLICT (name) DO NOTHING;

-- 2. Categorías de Deporte Iniciales
INSERT INTO public.sports_categories (name, icon, description) VALUES
('Fútbol', 'soccer-ball', 'Escuelas de formación y torneos'),
('Tenis', 'tennis-racket', 'Academias y reserva de canchas'),
('Natación', 'swimmer', 'Clases dirigidas y práctica libre'),
('Baloncesto', 'basketball', 'Entrenamiento táctico y físico'),
('Voleibol', 'volleyball', 'Deporte colectivo y recreo')
ON CONFLICT (name) DO NOTHING;

-- 3. Configuración de ejemplo (Opcional para pruebas locales)
-- INSERT INTO public.schools (id, name, city, onboarding_status) ...
