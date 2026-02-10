-- Ensure Demo School exists (linked to demo profile)
-- Profile ID for 'Spirit All Stars' from setup-demo-data.mjs: 04c1512c-517e-4a1e-b4a8-ba3b4b75470d
-- School ID expected by enrollments: 81e9dc1d-3683-4b59-98f4-37197c77c213

INSERT INTO public.schools (id, owner_id, name, address, city, phone, email, description, logo_url, cover_image_url, verified, sports, amenities)
VALUES (
  '81e9dc1d-3683-4b59-98f4-37197c77c213',
  '04c1512c-517e-4a1e-b4a8-ba3b4b75470d',
  'Spirit All Stars',
  'Calle 170 # 15-20',
  'Bogotá',
  '300 123 4567',
  'contacto@spiritallstars.com',
  'Academia líder en Cheerleading y Porrismo en Bogotá. Formamos atletas de alto rendimiento con valores y disciplina.',
  'https://ui-avatars.com/api/?name=Spirit+All+Stars&background=E11D48&color=fff',
  'https://images.unsplash.com/photo-1517926116664-ac9be6dc9c05?q=80&w=2000&auto=format&fit=crop',
  true,
  ARRAY['Cheerleading', 'Gimnasia', 'Porras'],
  ARRAY['Cafetería', 'Parqueadero', 'WiFi', 'Enfermería']
)
ON CONFLICT (id) DO UPDATE 
SET owner_id = EXCLUDED.owner_id; -- Ensure owner link is correct

-- Insert Facilities for this school
INSERT INTO public.facilities (school_id, name, type, capacity, description, status)
VALUES 
  ('81e9dc1d-3683-4b59-98f4-37197c77c213', 'Gimnasio de Acrobatics - Sede Norte', 'Gimnasio de Porras', 30, 'Spring floor profesional con paneles de seguridad y foso de espuma.', 'available'),
  ('81e9dc1d-3683-4b59-98f4-37197c77c213', 'Sala de Tumbling - Fontibón', 'Pista de Tumbling', 15, 'Pista de tumbling de 12 metros con camas elásticas.', 'available'),
  ('81e9dc1d-3683-4b59-98f4-37197c77c213', 'Área de Estiramientos - La Granja', 'Sala de Preparación Física', 20, 'Espacio amplio con espejos para calentamiento y flexibilidad.', 'occupied'),
  ('81e9dc1d-3683-4b59-98f4-37197c77c213', 'Cancha Principal', 'Coliseo', 50, 'Escenario principal para competencias internas y exhibiciones.', 'maintenance')
ON CONFLICT DO NOTHING;
