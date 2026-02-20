-- ============================================================
-- SPORTMAPS SEED DATA
-- PARA PRUEBAS Y VALIDACIÓN DE RLS
-- ============================================================

-- 1. Insertar Roles básicos
INSERT INTO public.roles (name, display_name, description, is_visible) VALUES
('super_admin', 'Administrador de Plataforma', 'Acceso total a la infraestructura', false),
('school_admin', 'Gerente de Escuela', 'Gestión administrativa de la institución', true),
('coach', 'Entrenador / Instructor', 'Gestión de clases, asistencia y planes de entrenamiento', true),
('parent', 'Acudiente / Padre', 'Gestión de hijos, inscripciones y pagos', true),
('athlete', 'Atleta / Estudiante', 'Visualización de clases y progreso', true),
('wellness_professional', 'Profesional de Bienestar', 'Gestión de citas de salud y evaluaciones', true),
('store_owner', 'Dueño de Tienda', 'Gestión de productos y pedidos', true),
('organizer', 'Organizador de Eventos', 'Gestión de eventos y inscripciones', true)
ON CONFLICT (name) DO UPDATE SET 
    is_visible = EXCLUDED.is_visible,
    display_name = EXCLUDED.display_name;

-- 2. Categorías de Deporte Iniciales
INSERT INTO public.sports_categories (name, icon, description) VALUES
('Fútbol', 'soccer-ball', 'Escuelas de formación y torneos'),
('Tenis', 'tennis-racket', 'Academias y reserva de canchas'),
('Natación', 'swimmer', 'Clases dirigidas y práctica libre'),
('Baloncesto', 'basketball', 'Entrenamiento táctico y físico'),
('Voleibol', 'volleyball', 'Deporte colectivo y recreo'),
('Golf', 'golf', 'Deporte de precisión y estrategia'),  
('Boxeo', 'boxing', 'Defensa personal y resistencia'),
('Karate', 'karate', 'Defensa personal y disciplina'),
('Judo', 'judo', 'Defensa personal y disciplina'),
('Taekwondo', 'taekwondo', 'Defensa personal y disciplina'),
('Kung fu', 'kungfu', 'Defensa personal y disciplina'),
('Aikido', 'aikido', 'Defensa personal y disciplina'),
('Capoeira', 'capoeira', 'Defensa personal y disciplina'),
('MMA', 'mma', 'Defensa personal y disciplina'),
('Porrismo', 'cheerleader', 'Deporte que combina danza, gimnasia y acrobacia'),
('Cheerleading All-Star', 'stars', 'Competencia por niveles de dificultad (L1-L7)'),
('Cheerleading Scholastic', 'school', 'Equipos representativos de colegios y universidades'),
('Performance Cheer (Pom)', 'pompoms', 'Enfoque en danza con pompones y sincronización'),
('Hip Hop Cheer', 'music', 'Estilo urbano combinado con elementos de porrismo'),
('Jazz Cheer', 'dance', 'Técnica de danza jazz aplicada a la competición'),
('Sideline Cheer', 'megaphone', 'Apoyo tradicional en eventos deportivos'),
('Acrobacia y Tumbling', 'gymnastics', 'Especialidad en saltos y elementos gimnásticos'),
('Stunt Groups', 'people-group', 'Grupos especializados únicamente en elevaciones y lanzamientos')
ON CONFLICT (name) DO NOTHING;

-- 3. Configuración de ejemplo (Opcional para pruebas locales)
-- INSERT INTO public.schools (id, name, city, onboarding_status) ...
