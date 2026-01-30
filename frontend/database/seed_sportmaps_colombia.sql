-- =====================================================================
-- SPORTMAPS COLOMBIA - SCRIPT DE SEED COMPLETO
-- Arquitectura de 7 roles interconectada para Colombia
-- Ejecutar en Supabase SQL Editor
-- =====================================================================

-- PRE-REQUISITOS
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- =====================================================================
-- LIMPIEZA DE TABLAS (orden correcto para evitar FK violations)
-- =====================================================================
TRUNCATE TABLE public.facility_reservations RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.athlete_stats RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.training_logs RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.session_attendance RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.training_sessions RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.match_results RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.training_plans RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.announcements RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.team_members RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.teams RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.academic_progress RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.attendance RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.payments RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.children RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.reviews RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.enrollments RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.orders RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.products RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.school_staff RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.facilities RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.programs RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.schools RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.notifications RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.messages RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.activities RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.profiles RESTART IDENTITY CASCADE;

-- =====================================================================
-- DEFINICIÓN DE UUIDs ESTÁTICOS PARA REFERENCIAS CRUZADAS
-- =====================================================================

-- UUIDs para DUEÑOS DE ESCUELAS (role='school')
-- school_owner_1: Escuela Fútbol Bogotá
-- school_owner_2: Academia Baloncesto Medellín  
-- school_owner_3: Club Tenis Cali

-- UUIDs para COACHES (role='coach')
-- 6 coaches: 2 por escuela

-- UUIDs para PADRES (role='parent')
-- 10 padres colombianos

-- UUIDs para ATLETAS (role='athlete') 
-- 15 atletas (hijos de los padres)

-- UUIDs para MARCAS/TIENDAS (role='store_owner')
-- 2 marcas: DeportePro y NutriSport

-- UUIDs para PROFESIONAL DE BIENESTAR (role='wellness_professional')
-- 2 profesionales

-- =====================================================================
-- INSERCIÓN DE DATOS CON CTEs
-- =====================================================================

WITH 
-- ===================================================================
-- 1. DUEÑOS DE ESCUELAS (profiles)
-- ===================================================================
school_owners AS (
    INSERT INTO public.profiles (id, role, full_name, avatar_url, phone, bio, date_of_birth, subscription_tier)
    VALUES 
        ('11111111-1111-1111-1111-111111111101'::uuid, 'school', 'Carlos Alberto Rodríguez Gómez', 
         'https://randomuser.me/api/portraits/men/32.jpg', '+57 310 234 5678',
         'Director deportivo con 20 años de experiencia en fútbol formativo. Ex jugador profesional de Millonarios FC.',
         '1975-03-15', 'premium'),
        
        ('11111111-1111-1111-1111-111111111102'::uuid, 'school', 'María Fernanda Montoya Vélez',
         'https://randomuser.me/api/portraits/women/44.jpg', '+57 311 456 7890',
         'Entrenadora de baloncesto certificada FIBA. Fundadora de la Academia Baloncesto Medellín.',
         '1980-07-22', 'premium'),
        
        ('11111111-1111-1111-1111-111111111103'::uuid, 'school', 'Andrés Felipe Chaux Mosquera',
         'https://randomuser.me/api/portraits/men/56.jpg', '+57 312 678 9012',
         'Tenista profesional retirado. ATP ranking histórico #245. Formador de campeones juveniles.',
         '1978-11-30', 'enterprise')
    RETURNING id, full_name
),

-- ===================================================================
-- 2. COACHES (profiles)
-- ===================================================================
coaches AS (
    INSERT INTO public.profiles (id, role, full_name, avatar_url, phone, bio, date_of_birth, subscription_tier)
    VALUES 
        -- Coaches Escuela Fútbol Bogotá
        ('22222222-2222-2222-2222-222222222201'::uuid, 'coach', 'Juan Pablo Hernández López',
         'https://randomuser.me/api/portraits/men/22.jpg', '+57 313 111 2233',
         'Licenciado en Educación Física. Especialista en fútbol base Sub-8 a Sub-12.',
         '1988-04-12', 'basic'),
        
        ('22222222-2222-2222-2222-222222222202'::uuid, 'coach', 'Sebastián Andrés Muñoz Restrepo',
         'https://randomuser.me/api/portraits/men/28.jpg', '+57 314 222 3344',
         'Ex jugador de Santa Fe. Técnico certificado Conmebol nivel B.',
         '1985-09-08', 'basic'),
        
        -- Coaches Academia Baloncesto Medellín
        ('22222222-2222-2222-2222-222222222203'::uuid, 'coach', 'Laura Cristina Ospina Giraldo',
         'https://randomuser.me/api/portraits/women/32.jpg', '+57 315 333 4455',
         'Ex jugadora de la Selección Colombia de Baloncesto. Especialista en fundamentación.',
         '1990-02-28', 'basic'),
        
        ('22222222-2222-2222-2222-222222222204'::uuid, 'coach', 'Diego Alejandro Cárdenas Ríos',
         'https://randomuser.me/api/portraits/men/35.jpg', '+57 316 444 5566',
         'Preparador físico certificado. Coach de alto rendimiento juvenil.',
         '1987-06-15', 'basic'),
        
        -- Coaches Club Tenis Cali
        ('22222222-2222-2222-2222-222222222205'::uuid, 'coach', 'Valentina Sánchez Mejía',
         'https://randomuser.me/api/portraits/women/28.jpg', '+57 317 555 6677',
         'Tenista profesional WTA. Campeona suramericana juvenil 2010.',
         '1992-12-05', 'basic'),
        
        ('22222222-2222-2222-2222-222222222206'::uuid, 'coach', 'Ricardo Ernesto Vargas Patiño',
         'https://randomuser.me/api/portraits/men/42.jpg', '+57 318 666 7788',
         'Director técnico con certificación PTR Professional. 15 años de experiencia.',
         '1982-08-20', 'basic')
    RETURNING id, full_name
),

-- ===================================================================
-- 3. PADRES (profiles)
-- ===================================================================
parents AS (
    INSERT INTO public.profiles (id, role, full_name, avatar_url, phone, bio, date_of_birth, subscription_tier)
    VALUES 
        ('33333333-3333-3333-3333-333333333301'::uuid, 'parent', 'Ana María Pérez Londoño',
         'https://randomuser.me/api/portraits/women/52.jpg', '+57 320 111 0001',
         'Ingeniera de sistemas. Madre de dos deportistas.', '1982-05-10', 'basic'),
        
        ('33333333-3333-3333-3333-333333333302'::uuid, 'parent', 'Roberto Carlos Gutiérrez Arango',
         'https://randomuser.me/api/portraits/men/48.jpg', '+57 320 111 0002',
         'Contador público. Apasionado del fútbol.', '1978-11-22', 'basic'),
        
        ('33333333-3333-3333-3333-333333333303'::uuid, 'parent', 'Patricia Elena Valencia Suárez',
         'https://randomuser.me/api/portraits/women/38.jpg', '+57 320 111 0003',
         'Médica pediatra. Promueve el deporte en familia.', '1985-03-18', 'premium'),
        
        ('33333333-3333-3333-3333-333333333304'::uuid, 'parent', 'Jorge Enrique Martínez Duque',
         'https://randomuser.me/api/portraits/men/55.jpg', '+57 320 111 0004',
         'Abogado. Ex jugador de baloncesto universitario.', '1976-07-30', 'basic'),
        
        ('33333333-3333-3333-3333-333333333305'::uuid, 'parent', 'Claudia Marcela Ríos Bedoya',
         'https://randomuser.me/api/portraits/women/45.jpg', '+57 320 111 0005',
         'Administradora de empresas. Fanática del tenis.', '1980-09-05', 'premium'),
        
        ('33333333-3333-3333-3333-333333333306'::uuid, 'parent', 'Fernando José Castro Reyes',
         'https://randomuser.me/api/portraits/men/62.jpg', '+57 320 111 0006',
         'Arquitecto. Voluntario en eventos deportivos.', '1974-12-14', 'basic'),
        
        ('33333333-3333-3333-3333-333333333307'::uuid, 'parent', 'Sandra Milena Torres Ochoa',
         'https://randomuser.me/api/portraits/women/58.jpg', '+57 320 111 0007',
         'Profesora universitaria. Madre soltera de gemelos deportistas.', '1983-04-25', 'basic'),
        
        ('33333333-3333-3333-3333-333333333308'::uuid, 'parent', 'Andrés Mauricio López Zapata',
         'https://randomuser.me/api/portraits/men/38.jpg', '+57 320 111 0008',
         'Empresario. Patrocinador de torneos infantiles.', '1979-08-08', 'premium'),
        
        ('33333333-3333-3333-3333-333333333309'::uuid, 'parent', 'Luz Dary Gómez Cardona',
         'https://randomuser.me/api/portraits/women/42.jpg', '+57 320 111 0009',
         'Enfermera. Promotora de vida saludable.', '1981-01-17', 'basic'),
        
        ('33333333-3333-3333-3333-333333333310'::uuid, 'parent', 'Carlos Andrés Henao Ramírez',
         'https://randomuser.me/api/portraits/men/45.jpg', '+57 320 111 0010',
         'Comerciante. Ex futbolista aficionado.', '1977-06-28', 'basic')
    RETURNING id, full_name
),

-- ===================================================================
-- 4. ATLETAS (profiles)
-- ===================================================================
athletes AS (
    INSERT INTO public.profiles (id, role, full_name, avatar_url, phone, bio, date_of_birth, subscription_tier, sportmaps_points)
    VALUES 
        -- Hijos de Ana María (2)
        ('44444444-4444-4444-4444-444444444401'::uuid, 'athlete', 'Santiago Pérez Londoño',
         'https://randomuser.me/api/portraits/men/11.jpg', NULL,
         'Delantero Sub-12. Goleador de la liga distrital.', '2013-03-15', 'free', 1250),
        
        ('44444444-4444-4444-4444-444444444402'::uuid, 'athlete', 'Valentina Pérez Londoño',
         'https://randomuser.me/api/portraits/women/11.jpg', NULL,
         'Base de baloncesto Sub-14. MVP torneos locales.', '2011-08-22', 'free', 1580),
        
        -- Hijo de Roberto Carlos (1)
        ('44444444-4444-4444-4444-444444444403'::uuid, 'athlete', 'Mateo Gutiérrez Arango',
         'https://randomuser.me/api/portraits/men/12.jpg', NULL,
         'Mediocampista Sub-10. Promesa del fútbol bogotano.', '2015-05-10', 'free', 890),
        
        -- Hijos de Patricia (2)
        ('44444444-4444-4444-4444-444444444404'::uuid, 'athlete', 'Sofía Valencia Suárez',
         'https://randomuser.me/api/portraits/women/12.jpg', NULL,
         'Tenista Sub-12. Campeona regional 2024.', '2013-11-28', 'free', 2100),
        
        ('44444444-4444-4444-4444-444444444405'::uuid, 'athlete', 'Daniel Valencia Suárez',
         'https://randomuser.me/api/portraits/men/13.jpg', NULL,
         'Tenista Sub-14. Semifinalista nacional juvenil.', '2011-02-14', 'free', 1890),
        
        -- Hijo de Jorge Enrique (1)
        ('44444444-4444-4444-4444-444444444406'::uuid, 'athlete', 'Nicolás Martínez Duque',
         'https://randomuser.me/api/portraits/men/14.jpg', NULL,
         'Ala-pívot Sub-16. Selección Antioquia.', '2009-07-08', 'free', 2450),
        
        -- Hijo de Claudia Marcela (1)
        ('44444444-4444-4444-4444-444444444407'::uuid, 'athlete', 'Isabella Ríos Bedoya',
         'https://randomuser.me/api/portraits/women/13.jpg', NULL,
         'Tenista Sub-10. Talento en desarrollo.', '2015-12-03', 'free', 720),
        
        -- Hijos de Fernando José (2)
        ('44444444-4444-4444-4444-444444444408'::uuid, 'athlete', 'Alejandro Castro Reyes',
         'https://randomuser.me/api/portraits/men/15.jpg', NULL,
         'Portero Sub-14. Manos seguras del equipo.', '2011-04-20', 'free', 1340),
        
        ('44444444-4444-4444-4444-444444444409'::uuid, 'athlete', 'Camila Castro Reyes',
         'https://randomuser.me/api/portraits/women/14.jpg', NULL,
         'Escolta baloncesto Sub-12. Anotadora destacada.', '2013-09-15', 'free', 1150),
        
        -- Hijos de Sandra Milena - gemelos (2)
        ('44444444-4444-4444-4444-444444444410'::uuid, 'athlete', 'Tomás Torres Ochoa',
         'https://randomuser.me/api/portraits/men/16.jpg', NULL,
         'Defensa central Sub-12. Capitán del equipo.', '2013-06-12', 'free', 1420),
        
        ('44444444-4444-4444-4444-444444444411'::uuid, 'athlete', 'Lucas Torres Ochoa',
         'https://randomuser.me/api/portraits/men/17.jpg', NULL,
         'Lateral derecho Sub-12. Velocista nato.', '2013-06-12', 'free', 1380),
        
        -- Hijo de Andrés Mauricio (1)
        ('44444444-4444-4444-4444-444444444412'::uuid, 'athlete', 'Martín López Zapata',
         'https://randomuser.me/api/portraits/men/18.jpg', NULL,
         'Pívot baloncesto Sub-14. Altura 1.78m a los 13 años.', '2012-01-25', 'free', 1680),
        
        -- Hijo de Luz Dary (1)
        ('44444444-4444-4444-4444-444444444413'::uuid, 'athlete', 'Gabriela Gómez Cardona',
         'https://randomuser.me/api/portraits/women/15.jpg', NULL,
         'Tenista Sub-12. Disciplinada y constante.', '2013-10-08', 'free', 980),
        
        -- Hijo de Carlos Andrés (1)
        ('44444444-4444-4444-4444-444444444414'::uuid, 'athlete', 'Samuel Henao Ramírez',
         'https://randomuser.me/api/portraits/men/19.jpg', NULL,
         'Mediocampista creativo Sub-14. Visión de juego excepcional.', '2011-05-30', 'free', 1560),
        
        -- Atleta adicional
        ('44444444-4444-4444-4444-444444444415'::uuid, 'athlete', 'Emilia Rodríguez Mejía',
         'https://randomuser.me/api/portraits/women/16.jpg', NULL,
         'Armadora baloncesto Sub-10. Liderazgo natural.', '2015-08-18', 'free', 650)
    RETURNING id, full_name
),

-- ===================================================================
-- 5. MARCAS/TIENDAS (profiles)
-- ===================================================================
store_owners AS (
    INSERT INTO public.profiles (id, role, full_name, avatar_url, phone, bio, date_of_birth, subscription_tier)
    VALUES 
        ('55555555-5555-5555-5555-555555555501'::uuid, 'store_owner', 'DeportePro Colombia SAS',
         'https://images.unsplash.com/photo-1556906781-9a412961c28c?w=200', '+57 601 234 5678',
         'Fabricantes de uniformes deportivos personalizados. Más de 15 años vistiendo campeones.',
         '1990-01-01', 'enterprise'),
        
        ('55555555-5555-5555-5555-555555555502'::uuid, 'store_owner', 'NutriSport Suplementos',
         'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=200', '+57 604 567 8901',
         'Distribuidores autorizados de suplementación deportiva. Nutrición para atletas de todas las edades.',
         '1995-06-15', 'premium')
    RETURNING id, full_name
),

-- ===================================================================
-- 6. PROFESIONALES DE BIENESTAR (profiles)
-- ===================================================================
wellness_pros AS (
    INSERT INTO public.profiles (id, role, full_name, avatar_url, phone, bio, date_of_birth, subscription_tier)
    VALUES 
        ('66666666-6666-6666-6666-666666666601'::uuid, 'wellness_professional', 'Dr. Alejandro Moreno Silva',
         'https://randomuser.me/api/portraits/men/65.jpg', '+57 319 888 9900',
         'Médico deportólogo. Especialista en lesiones de atletas juveniles. Hospital San Ignacio.',
         '1972-04-10', 'premium'),
        
        ('66666666-6666-6666-6666-666666666602'::uuid, 'wellness_professional', 'Dra. Carolina Echeverri Bustamante',
         'https://randomuser.me/api/portraits/women/65.jpg', '+57 319 999 0011',
         'Fisioterapeuta deportiva. Rehabilitación y prevención de lesiones. Clínica del Deporte.',
         '1985-09-22', 'premium')
    RETURNING id, full_name
),

-- ===================================================================
-- 7. ESCUELAS DEPORTIVAS
-- ===================================================================
inserted_schools AS (
    INSERT INTO public.schools (id, owner_id, name, description, logo_url, cover_image_url, address, city, phone, email, website, rating, total_reviews, sports, amenities, verified, is_demo, certifications, levels_offered, accepts_reservations)
    VALUES 
        ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001'::uuid,
         '11111111-1111-1111-1111-111111111101'::uuid,
         'Escuela de Fútbol Bogotá FC',
         'Centro de formación deportiva especializado en fútbol base. Desarrollamos talento desde los 5 años con metodología europea adaptada al contexto colombiano. Más de 500 graduados en ligas profesionales.',
         'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=400',
         'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200',
         'Carrera 68 #23-45, Salitre',
         'Bogotá',
         '+57 601 345 6789',
         'info@futbolbogotafc.com',
         'www.futbolbogotafc.com',
         4.8, 127,
         ARRAY['Fútbol', 'Futsal'],
         ARRAY['Cancha sintética', 'Vestuarios', 'Gimnasio', 'Cafetería', 'Parqueadero', 'Tienda deportiva'],
         true, true,
         ARRAY['IDRD Certificado', 'Mindeportes', 'Liga Distrital Bogotá', 'Escuela Avalada FCF'],
         ARRAY['iniciacion', 'intermedio', 'avanzado', 'alto_rendimiento'],
         true),
        
        ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002'::uuid,
         '11111111-1111-1111-1111-111111111102'::uuid,
         'Academia de Baloncesto Medellín',
         'Formación integral en baloncesto. Canastas desde los 6 años hasta alto rendimiento. Alianza con clubes de la NBA G League. Instalaciones de primer nivel en el Valle de Aburrá.',
         'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400',
         'https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=1200',
         'Calle 10 #43-12, El Poblado',
         'Medellín',
         '+57 604 234 5678',
         'contacto@basketmedellin.com',
         'www.basketmedellin.com',
         4.7, 98,
         ARRAY['Baloncesto', 'Mini-basket'],
         ARRAY['3 canchas cubiertas', 'Gimnasio especializado', 'Análisis de video', 'Nutricionista', 'Psicólogo deportivo'],
         true, true,
         ARRAY['Liga Antioqueña de Baloncesto', 'FIBA School', 'Mindeportes'],
         ARRAY['iniciacion', 'intermedio', 'avanzado'],
         true),
        
        ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003'::uuid,
         '11111111-1111-1111-1111-111111111103'::uuid,
         'Club de Tenis Cali',
         'Tradición tenística desde 1985. Formamos campeones con valores. 8 canchas de arcilla y 4 canchas duras. Cuna de tenistas profesionales colombianos.',
         'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=400',
         'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=1200',
         'Avenida 6N #35-20, Granada',
         'Cali',
         '+57 602 456 7890',
         'info@clubteniscali.com',
         'www.clubteniscali.com',
         4.9, 156,
         ARRAY['Tenis', 'Pádel'],
         ARRAY['12 canchas', 'Pro shop', 'Restaurante', 'Piscina', 'Zona de estiramiento', 'Sala de masajes'],
         true, true,
         ARRAY['Liga Vallecaucana de Tenis', 'Federación Colombiana de Tenis', 'ITF Academy', 'PTR Certified'],
         ARRAY['iniciacion', 'intermedio', 'avanzado', 'alto_rendimiento'],
         true)
    RETURNING id, name
),

-- ===================================================================
-- 8. PROGRAMAS DEPORTIVOS
-- ===================================================================
inserted_programs AS (
    INSERT INTO public.programs (id, school_id, name, description, sport, age_min, age_max, price_monthly, schedule, max_participants, current_participants, image_url, active, is_demo, level)
    VALUES 
        -- Programas Escuela Fútbol Bogotá
        ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001'::uuid,
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001'::uuid,
         'Escuela de Iniciación Sub-8',
         'Introducción al fútbol para niños de 5 a 8 años. Desarrollo de motricidad, coordinación y amor por el deporte.',
         'Fútbol', 5, 8, 180000.00,
         'Martes y Jueves 3:00pm - 4:30pm, Sábados 9:00am - 11:00am',
         25, 22,
         'https://images.unsplash.com/photo-1596464716127-f2a82984de30?w=600',
         true, true, 'iniciacion'),
        
        ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb002'::uuid,
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001'::uuid,
         'Formación Sub-12',
         'Desarrollo técnico-táctico para jugadores de 9 a 12 años. Participación en torneos distritales.',
         'Fútbol', 9, 12, 220000.00,
         'Lunes, Miércoles y Viernes 4:00pm - 6:00pm',
         30, 28,
         'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=600',
         true, true, 'intermedio'),
        
        ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb003'::uuid,
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001'::uuid,
         'Alto Rendimiento Sub-17',
         'Preparación para ligas profesionales. Entrenamiento intensivo con análisis de video y preparación física especializada.',
         'Fútbol', 13, 17, 350000.00,
         'Lunes a Viernes 5:00pm - 7:30pm',
         20, 18,
         'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=600',
         true, true, 'alto_rendimiento'),
        
        -- Programas Academia Baloncesto Medellín
        ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb004'::uuid,
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002'::uuid,
         'Mini-Basket (6-9 años)',
         'Primeros pasos en el baloncesto. Juegos, fundamentos básicos y trabajo en equipo.',
         'Baloncesto', 6, 9, 170000.00,
         'Martes y Jueves 2:30pm - 4:00pm',
         20, 18,
         'https://images.unsplash.com/photo-1574623452334-1e0ac2b3ccb4?w=600',
         true, true, 'iniciacion'),
        
        ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb005'::uuid,
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002'::uuid,
         'Desarrollo Sub-14',
         'Perfeccionamiento técnico y táctico. Competencias regionales y nacionales.',
         'Baloncesto', 10, 14, 230000.00,
         'Lunes, Miércoles y Viernes 4:30pm - 6:30pm',
         24, 21,
         'https://images.unsplash.com/photo-1519861531473-9200262188bf?w=600',
         true, true, 'intermedio'),
        
        ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb006'::uuid,
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002'::uuid,
         'Elite Sub-18',
         'Preparación para baloncesto universitario y profesional. Contacto con scouts nacionales e internacionales.',
         'Baloncesto', 15, 18, 380000.00,
         'Lunes a Viernes 5:00pm - 8:00pm',
         16, 14,
         'https://images.unsplash.com/photo-1608245449230-4ac19066d2d0?w=600',
         true, true, 'avanzado'),
        
        -- Programas Club Tenis Cali
        ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb007'::uuid,
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003'::uuid,
         'Tenis Kids (5-9 años)',
         'Iniciación al tenis con metodología Play+Stay. Raquetas y pelotas adaptadas.',
         'Tenis', 5, 9, 200000.00,
         'Sábados y Domingos 8:00am - 10:00am',
         16, 14,
         'https://images.unsplash.com/photo-1551773188-0801da12ddda?w=600',
         true, true, 'iniciacion'),
        
        ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb008'::uuid,
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003'::uuid,
         'Junior Development (10-14)',
         'Desarrollo técnico completo. Participación en circuito Cosat y torneos nacionales.',
         'Tenis', 10, 14, 280000.00,
         'Lunes, Miércoles, Viernes 3:30pm - 5:30pm, Sábados 7:00am - 9:00am',
         12, 11,
         'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=600',
         true, true, 'intermedio'),
        
        ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb009'::uuid,
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003'::uuid,
         'Pro Academy (15-18)',
         'Programa de alto rendimiento. Preparación para circuito ITF Junior y universitario USA.',
         'Tenis', 15, 18, 450000.00,
         'Lunes a Viernes 6:00am - 8:00am y 4:00pm - 6:00pm',
         8, 7,
         'https://images.unsplash.com/photo-1530915534664-4ac6423816b7?w=600',
         true, true, 'alto_rendimiento')
    RETURNING id, name
),

-- ===================================================================
-- 9. INSTALACIONES (FACILITIES)
-- ===================================================================
inserted_facilities AS (
    INSERT INTO public.facilities (id, school_id, name, type, capacity, description, status, hourly_rate, booking_enabled)
    VALUES 
        -- Escuela Fútbol Bogotá
        ('cccccccc-cccc-cccc-cccc-ccccccccc001'::uuid,
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001'::uuid,
         'Cancha Principal Sintética', 'cancha_futbol', 22,
         'Cancha de fútbol 11 con césped sintético FIFA Quality Pro. Iluminación LED.',
         'available', 150000.00, true),
        
        ('cccccccc-cccc-cccc-cccc-ccccccccc002'::uuid,
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001'::uuid,
         'Cancha Futsal Cubierta', 'cancha_futsal', 10,
         'Cancha de microfútbol cubierta con piso especializado.',
         'available', 80000.00, true),
        
        ('cccccccc-cccc-cccc-cccc-ccccccccc003'::uuid,
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001'::uuid,
         'Gimnasio de Fuerza', 'gimnasio', 15,
         'Gimnasio equipado para preparación física de futbolistas.',
         'available', 0.00, false),
        
        -- Academia Baloncesto Medellín
        ('cccccccc-cccc-cccc-cccc-ccccccccc004'::uuid,
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002'::uuid,
         'Coliseo Principal', 'cancha_basket', 200,
         'Cancha de baloncesto profesional con graderías para 200 espectadores.',
         'available', 200000.00, true),
        
        ('cccccccc-cccc-cccc-cccc-ccccccccc005'::uuid,
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002'::uuid,
         'Cancha de Entrenamiento A', 'cancha_basket', 20,
         'Cancha auxiliar para entrenamientos y clínicas.',
         'available', 100000.00, true),
        
        ('cccccccc-cccc-cccc-cccc-ccccccccc006'::uuid,
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002'::uuid,
         'Sala de Video-Análisis', 'sala_video', 20,
         'Sala equipada con software Synergy para análisis táctico.',
         'available', 50000.00, true),
        
        -- Club Tenis Cali
        ('cccccccc-cccc-cccc-cccc-ccccccccc007'::uuid,
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003'::uuid,
         'Canchas de Arcilla 1-4', 'cancha_tenis', 8,
         '4 canchas de polvo de ladrillo estándar ITF.',
         'available', 60000.00, true),
        
        ('cccccccc-cccc-cccc-cccc-ccccccccc008'::uuid,
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003'::uuid,
         'Canchas Duras 5-8', 'cancha_tenis', 8,
         '4 canchas de superficie dura tipo US Open.',
         'available', 70000.00, true),
        
        ('cccccccc-cccc-cccc-cccc-ccccccccc009'::uuid,
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003'::uuid,
         'Cancha Central con Tribunas', 'cancha_tenis', 500,
         'Cancha principal para torneos con capacidad de 500 espectadores.',
         'available', 250000.00, true)
    RETURNING id, name
),

-- ===================================================================
-- 10. STAFF/COACHES DE ESCUELAS
-- ===================================================================
inserted_staff AS (
    INSERT INTO public.school_staff (id, school_id, full_name, email, phone, specialty, certifications, status)
    VALUES 
        -- Staff Escuela Fútbol Bogotá
        ('dddddddd-dddd-dddd-dddd-ddddddddd001'::uuid,
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001'::uuid,
         'Juan Pablo Hernández López',
         'jphernandez@futbolbogotafc.com', '+57 313 111 2233',
         'Fútbol Base Sub-8 a Sub-12',
         ARRAY['Licenciatura Educación Física', 'Entrenador CONMEBOL C', 'Primeros Auxilios'],
         'active'),
        
        ('dddddddd-dddd-dddd-dddd-ddddddddd002'::uuid,
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001'::uuid,
         'Sebastián Andrés Muñoz Restrepo',
         'smunoz@futbolbogotafc.com', '+57 314 222 3344',
         'Alto Rendimiento y Táctica',
         ARRAY['Ex Jugador Profesional', 'Entrenador CONMEBOL B', 'Análisis de Video'],
         'active'),
        
        -- Staff Academia Baloncesto Medellín
        ('dddddddd-dddd-dddd-dddd-ddddddddd003'::uuid,
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002'::uuid,
         'Laura Cristina Ospina Giraldo',
         'lospina@basketmedellin.com', '+57 315 333 4455',
         'Fundamentación y Técnica Individual',
         ARRAY['Ex Selección Colombia', 'FIBA Level 2', 'Coaching Juvenil'],
         'active'),
        
        ('dddddddd-dddd-dddd-dddd-ddddddddd004'::uuid,
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002'::uuid,
         'Diego Alejandro Cárdenas Ríos',
         'dcardenas@basketmedellin.com', '+57 316 444 5566',
         'Preparación Física y Rendimiento',
         ARRAY['Lic. Ciencias del Deporte', 'NSCA-CSCS', 'FMS Level 2'],
         'active'),
        
        -- Staff Club Tenis Cali
        ('dddddddd-dddd-dddd-dddd-ddddddddd005'::uuid,
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003'::uuid,
         'Valentina Sánchez Mejía',
         'vsanchez@clubteniscali.com', '+57 317 555 6677',
         'Tenis Femenino y Competencia',
         ARRAY['Ex WTA Player', 'PTR Professional', 'ITF Coaching Course'],
         'active'),
        
        ('dddddddd-dddd-dddd-dddd-ddddddddd006'::uuid,
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003'::uuid,
         'Ricardo Ernesto Vargas Patiño',
         'rvargas@clubteniscali.com', '+57 318 666 7788',
         'Alto Rendimiento y Biomecánica',
         ARRAY['PTR Master Professional', 'USTA High Performance', 'Biomecánica Deportiva'],
         'active')
    RETURNING id, full_name
),

-- ===================================================================
-- 11. CHILDREN (Hijos vinculados a padres)
-- ===================================================================
inserted_children AS (
    INSERT INTO public.children (id, parent_id, full_name, date_of_birth, avatar_url, medical_info, school_id, team_name, sport, is_demo)
    VALUES 
        -- Hijos de Ana María (2 hijos)
        ('eeeeeeee-eeee-eeee-eeee-eeeeeeeee001'::uuid,
         '33333333-3333-3333-3333-333333333301'::uuid,
         'Santiago Pérez Londoño', '2013-03-15',
         'https://randomuser.me/api/portraits/men/11.jpg',
         'Sin alergias conocidas. Tipo sangre O+. EPS: Sura.',
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001'::uuid,
         'Sub-12 A', 'Fútbol', true),
        
        ('eeeeeeee-eeee-eeee-eeee-eeeeeeeee002'::uuid,
         '33333333-3333-3333-3333-333333333301'::uuid,
         'Valentina Pérez Londoño', '2011-08-22',
         'https://randomuser.me/api/portraits/women/11.jpg',
         'Alergia al polen. Tipo sangre A+. EPS: Sura. Usa inhalador preventivo.',
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002'::uuid,
         'Sub-14 Femenino', 'Baloncesto', true),
        
        -- Hijo de Roberto Carlos (1 hijo)
        ('eeeeeeee-eeee-eeee-eeee-eeeeeeeee003'::uuid,
         '33333333-3333-3333-3333-333333333302'::uuid,
         'Mateo Gutiérrez Arango', '2015-05-10',
         'https://randomuser.me/api/portraits/men/12.jpg',
         'Sin alergias. Tipo sangre B+. EPS: Sanitas. Lesión previa: esguince tobillo izq (2024, recuperado).',
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001'::uuid,
         'Sub-10', 'Fútbol', true),
        
        -- Hijos de Patricia (2 hijos)
        ('eeeeeeee-eeee-eeee-eeee-eeeeeeeee004'::uuid,
         '33333333-3333-3333-3333-333333333303'::uuid,
         'Sofía Valencia Suárez', '2013-11-28',
         'https://randomuser.me/api/portraits/women/12.jpg',
         'Intolerancia a la lactosa. Tipo sangre AB+. EPS: Nueva EPS.',
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003'::uuid,
         'Junior Development', 'Tenis', true),
        
        ('eeeeeeee-eeee-eeee-eeee-eeeeeeeee005'::uuid,
         '33333333-3333-3333-3333-333333333303'::uuid,
         'Daniel Valencia Suárez', '2011-02-14',
         'https://randomuser.me/api/portraits/men/13.jpg',
         'Sin alergias. Tipo sangre AB+. EPS: Nueva EPS. Tendinitis codo (tratado 2023).',
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003'::uuid,
         'Junior Development', 'Tenis', true),
        
        -- Hijo de Jorge Enrique (1 hijo)
        ('eeeeeeee-eeee-eeee-eeee-eeeeeeeee006'::uuid,
         '33333333-3333-3333-3333-333333333304'::uuid,
         'Nicolás Martínez Duque', '2009-07-08',
         'https://randomuser.me/api/portraits/men/14.jpg',
         'Alergia a picaduras de insectos. Tipo sangre O-. EPS: Coomeva. Lleva epinefrina.',
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002'::uuid,
         'Sub-16 Elite', 'Baloncesto', true),
        
        -- Hijo de Claudia Marcela (1 hijo)
        ('eeeeeeee-eeee-eeee-eeee-eeeeeeeee007'::uuid,
         '33333333-3333-3333-3333-333333333305'::uuid,
         'Isabella Ríos Bedoya', '2015-12-03',
         'https://randomuser.me/api/portraits/women/13.jpg',
         'Sin alergias. Tipo sangre A-. EPS: Sura.',
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003'::uuid,
         'Tenis Kids', 'Tenis', true),
        
        -- Hijos de Fernando José (2 hijos)
        ('eeeeeeee-eeee-eeee-eeee-eeeeeeeee008'::uuid,
         '33333333-3333-3333-3333-333333333306'::uuid,
         'Alejandro Castro Reyes', '2011-04-20',
         'https://randomuser.me/api/portraits/men/15.jpg',
         'Asma leve (controlada). Tipo sangre B-. EPS: Compensar. Usa inhalador SOS.',
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001'::uuid,
         'Sub-14 B', 'Fútbol', true),
        
        ('eeeeeeee-eeee-eeee-eeee-eeeeeeeee009'::uuid,
         '33333333-3333-3333-3333-333333333306'::uuid,
         'Camila Castro Reyes', '2013-09-15',
         'https://randomuser.me/api/portraits/women/14.jpg',
         'Sin alergias. Tipo sangre B-. EPS: Compensar.',
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002'::uuid,
         'Sub-12 Femenino', 'Baloncesto', true),
        
        -- Hijos de Sandra Milena - gemelos (2 hijos)
        ('eeeeeeee-eeee-eeee-eeee-eeeeeeeee010'::uuid,
         '33333333-3333-3333-3333-333333333307'::uuid,
         'Tomás Torres Ochoa', '2013-06-12',
         'https://randomuser.me/api/portraits/men/16.jpg',
         'Sin alergias. Tipo sangre O+. EPS: Sanitas. Gemelo de Lucas.',
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001'::uuid,
         'Sub-12 A', 'Fútbol', true),
        
        ('eeeeeeee-eeee-eeee-eeee-eeeeeeeee011'::uuid,
         '33333333-3333-3333-3333-333333333307'::uuid,
         'Lucas Torres Ochoa', '2013-06-12',
         'https://randomuser.me/api/portraits/men/17.jpg',
         'Alergia a mariscos. Tipo sangre O+. EPS: Sanitas. Gemelo de Tomás.',
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001'::uuid,
         'Sub-12 A', 'Fútbol', true),
        
        -- Hijo de Andrés Mauricio (1 hijo)
        ('eeeeeeee-eeee-eeee-eeee-eeeeeeeee012'::uuid,
         '33333333-3333-3333-3333-333333333308'::uuid,
         'Martín López Zapata', '2012-01-25',
         'https://randomuser.me/api/portraits/men/18.jpg',
         'Sin alergias. Tipo sangre A+. EPS: Sura. Esguince rodilla derecha (2023, recuperado).',
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002'::uuid,
         'Sub-14 Masculino', 'Baloncesto', true),
        
        -- Hijo de Luz Dary (1 hijo)
        ('eeeeeeee-eeee-eeee-eeee-eeeeeeeee013'::uuid,
         '33333333-3333-3333-3333-333333333309'::uuid,
         'Gabriela Gómez Cardona', '2013-10-08',
         'https://randomuser.me/api/portraits/women/15.jpg',
         'Alergia a la penicilina. Tipo sangre O+. EPS: Nueva EPS.',
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003'::uuid,
         'Junior Development', 'Tenis', true),
        
        -- Hijo de Carlos Andrés (1 hijo)
        ('eeeeeeee-eeee-eeee-eeee-eeeeeeeee014'::uuid,
         '33333333-3333-3333-3333-333333333310'::uuid,
         'Samuel Henao Ramírez', '2011-05-30',
         'https://randomuser.me/api/portraits/men/19.jpg',
         'Sin alergias. Tipo sangre AB-. EPS: Sanitas.',
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001'::uuid,
         'Sub-14 A', 'Fútbol', true),
        
        -- Atleta adicional (padre no registrado en sistema)
        ('eeeeeeee-eeee-eeee-eeee-eeeeeeeee015'::uuid,
         '33333333-3333-3333-3333-333333333301'::uuid, -- Asignado a Ana María como tutora
         'Emilia Rodríguez Mejía', '2015-08-18',
         'https://randomuser.me/api/portraits/women/16.jpg',
         'Sin alergias. Tipo sangre B+. EPS: Coomeva.',
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002'::uuid,
         'Mini-Basket', 'Baloncesto', true)
    RETURNING id, full_name
),

-- ===================================================================
-- 12. PRODUCTOS DE TIENDAS
-- ===================================================================
inserted_products AS (
    INSERT INTO public.products (id, vendor_id, name, description, price, stock, category, image_url, discount, rating, reviews_count)
    VALUES 
        -- Productos DeportePro Colombia
        ('ffffffff-ffff-ffff-ffff-ffffffffffff01'::uuid,
         '55555555-5555-5555-5555-555555555501'::uuid,
         'Uniforme Fútbol Personalizado',
         'Kit completo: camiseta, pantaloneta y medias. Sublimación full color. Tallas 4-16 años.',
         189000.00, 150, 'Uniformes',
         'https://images.unsplash.com/photo-1580087256394-dc596e1c8f4f?w=400',
         15, 4.7, 89),
        
        ('ffffffff-ffff-ffff-ffff-ffffffffffff02'::uuid,
         '55555555-5555-5555-5555-555555555501'::uuid,
         'Uniforme Baloncesto Junior',
         'Camiseta y pantaloneta de baloncesto. Material dry-fit premium. Personalizable.',
         165000.00, 120, 'Uniformes',
         'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400',
         10, 4.6, 67),
        
        ('ffffffff-ffff-ffff-ffff-ffffffffffff03'::uuid,
         '55555555-5555-5555-5555-555555555501'::uuid,
         'Kit Entrenamiento Completo',
         'Sudadera + pantalón + bolso deportivo. Colores personalizables por equipo.',
         245000.00, 80, 'Ropa Deportiva',
         'https://images.unsplash.com/photo-1556906781-9a412961c28c?w=400',
         0, 4.8, 45),
        
        ('ffffffff-ffff-ffff-ffff-ffffffffffff04'::uuid,
         '55555555-5555-5555-5555-555555555501'::uuid,
         'Balón Fútbol Profesional',
         'Balón termosellado FIFA Quality. Ideal para entrenamientos y partidos.',
         125000.00, 200, 'Equipamiento',
         'https://images.unsplash.com/photo-1614632537190-23e4b8e66c66?w=400',
         20, 4.9, 156),
        
        -- Productos NutriSport
        ('ffffffff-ffff-ffff-ffff-ffffffffffff05'::uuid,
         '55555555-5555-5555-5555-555555555502'::uuid,
         'Proteína Junior Whey',
         'Proteína de suero para atletas jóvenes. Sabor chocolate. 30 porciones.',
         185000.00, 100, 'Suplementos',
         'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=400',
         0, 4.5, 78),
        
        ('ffffffff-ffff-ffff-ffff-ffffffffffff06'::uuid,
         '55555555-5555-5555-5555-555555555502'::uuid,
         'Multivitamínico Deportista',
         'Complejo vitamínico diseñado para atletas en formación. 60 cápsulas.',
         89000.00, 150, 'Suplementos',
         'https://images.unsplash.com/photo-1550572017-edd951b55104?w=400',
         10, 4.4, 92),
        
        ('ffffffff-ffff-ffff-ffff-ffffffffffff07'::uuid,
         '55555555-5555-5555-5555-555555555502'::uuid,
         'Bebida Isotónica (Pack 12)',
         'Hidratación óptima durante entrenamientos. Sabores variados.',
         65000.00, 300, 'Hidratación',
         'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=400',
         5, 4.6, 234),
        
        ('ffffffff-ffff-ffff-ffff-ffffffffffff08'::uuid,
         '55555555-5555-5555-5555-555555555502'::uuid,
         'Barras Energéticas (Caja 24)',
         'Barras de avena y frutos secos. Perfectas para pre y post entrenamiento.',
         78000.00, 180, 'Snacks',
         'https://images.unsplash.com/photo-1622484212850-eb596d769eab?w=400',
         15, 4.7, 167)
    RETURNING id, name
),

-- ===================================================================
-- 13. EQUIPOS DE COACHES
-- ===================================================================
inserted_teams AS (
    INSERT INTO public.teams (id, coach_id, name, sport, age_group, season, is_demo)
    VALUES 
        -- Equipos de Juan Pablo (Coach Fútbol Bogotá)
        ('77777777-7777-7777-7777-777777777701'::uuid,
         '22222222-2222-2222-2222-222222222201'::uuid,
         'Leones Sub-10', 'Fútbol', 'Sub-10', '2025', true),
        
        ('77777777-7777-7777-7777-777777777702'::uuid,
         '22222222-2222-2222-2222-222222222201'::uuid,
         'Leones Sub-12', 'Fútbol', 'Sub-12', '2025', true),
        
        -- Equipos de Sebastián (Coach Fútbol Bogotá)
        ('77777777-7777-7777-7777-777777777703'::uuid,
         '22222222-2222-2222-2222-222222222202'::uuid,
         'Águilas Sub-14', 'Fútbol', 'Sub-14', '2025', true),
        
        -- Equipos de Laura (Coach Baloncesto Medellín)
        ('77777777-7777-7777-7777-777777777704'::uuid,
         '22222222-2222-2222-2222-222222222203'::uuid,
         'Tigres Mini-Basket', 'Baloncesto', 'Sub-10', '2025', true),
        
        ('77777777-7777-7777-7777-777777777705'::uuid,
         '22222222-2222-2222-2222-222222222203'::uuid,
         'Tigres Sub-12 Femenino', 'Baloncesto', 'Sub-12', '2025', true),
        
        -- Equipos de Diego (Coach Baloncesto Medellín)
        ('77777777-7777-7777-7777-777777777706'::uuid,
         '22222222-2222-2222-2222-222222222204'::uuid,
         'Pumas Sub-14', 'Baloncesto', 'Sub-14', '2025', true),
        
        ('77777777-7777-7777-7777-777777777707'::uuid,
         '22222222-2222-2222-2222-222222222204'::uuid,
         'Pumas Sub-16 Elite', 'Baloncesto', 'Sub-16', '2025', true)
    RETURNING id, name
),

-- ===================================================================
-- 14. MIEMBROS DE EQUIPOS
-- ===================================================================
inserted_team_members AS (
    INSERT INTO public.team_members (id, team_id, player_name, player_number, position, parent_contact)
    VALUES 
        -- Leones Sub-12 (Fútbol)
        ('88888888-8888-8888-8888-888888888801'::uuid,
         '77777777-7777-7777-7777-777777777702'::uuid,
         'Santiago Pérez Londoño', 10, 'Delantero Centro', '+57 320 111 0001'),
        
        ('88888888-8888-8888-8888-888888888802'::uuid,
         '77777777-7777-7777-7777-777777777702'::uuid,
         'Tomás Torres Ochoa', 4, 'Defensa Central', '+57 320 111 0007'),
        
        ('88888888-8888-8888-8888-888888888803'::uuid,
         '77777777-7777-7777-7777-777777777702'::uuid,
         'Lucas Torres Ochoa', 2, 'Lateral Derecho', '+57 320 111 0007'),
        
        -- Leones Sub-10 (Fútbol)
        ('88888888-8888-8888-8888-888888888804'::uuid,
         '77777777-7777-7777-7777-777777777701'::uuid,
         'Mateo Gutiérrez Arango', 7, 'Mediocampista', '+57 320 111 0002'),
        
        -- Águilas Sub-14 (Fútbol)
        ('88888888-8888-8888-8888-888888888805'::uuid,
         '77777777-7777-7777-7777-777777777703'::uuid,
         'Alejandro Castro Reyes', 1, 'Portero', '+57 320 111 0006'),
        
        ('88888888-8888-8888-8888-888888888806'::uuid,
         '77777777-7777-7777-7777-777777777703'::uuid,
         'Samuel Henao Ramírez', 8, 'Mediocampista Creativo', '+57 320 111 0010'),
        
        -- Tigres Sub-14 Femenino (Baloncesto)
        ('88888888-8888-8888-8888-888888888807'::uuid,
         '77777777-7777-7777-7777-777777777705'::uuid,
         'Valentina Pérez Londoño', 5, 'Base', '+57 320 111 0001'),
        
        ('88888888-8888-8888-8888-888888888808'::uuid,
         '77777777-7777-7777-7777-777777777705'::uuid,
         'Camila Castro Reyes', 23, 'Escolta', '+57 320 111 0006'),
        
        -- Pumas Sub-14 (Baloncesto)
        ('88888888-8888-8888-8888-888888888809'::uuid,
         '77777777-7777-7777-7777-777777777706'::uuid,
         'Martín López Zapata', 15, 'Pívot', '+57 320 111 0008'),
        
        -- Pumas Sub-16 Elite (Baloncesto)
        ('88888888-8888-8888-8888-888888888810'::uuid,
         '77777777-7777-7777-7777-777777777707'::uuid,
         'Nicolás Martínez Duque', 34, 'Ala-Pívot', '+57 320 111 0004'),
        
        -- Tigres Mini-Basket
        ('88888888-8888-8888-8888-888888888811'::uuid,
         '77777777-7777-7777-7777-777777777704'::uuid,
         'Emilia Rodríguez Mejía', 11, 'Armadora', '+57 320 111 0001')
    RETURNING id, player_name
),

-- ===================================================================
-- 15. RESEÑAS DE ESCUELAS
-- ===================================================================
inserted_reviews AS (
    INSERT INTO public.reviews (id, school_id, user_id, rating, comment)
    VALUES 
        -- Reseñas Escuela Fútbol Bogotá
        ('99999999-9999-9999-9999-999999999901'::uuid,
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001'::uuid,
         '33333333-3333-3333-3333-333333333301'::uuid,
         5, 'Excelente escuela. Mi hijo Santiago ha mejorado muchísimo su técnica. Los coaches son muy profesionales.'),
        
        ('99999999-9999-9999-9999-999999999902'::uuid,
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001'::uuid,
         '33333333-3333-3333-3333-333333333302'::uuid,
         5, 'Mateo ama ir a entrenar. Las instalaciones son de primera y el ambiente es muy positivo.'),
        
        ('99999999-9999-9999-9999-999999999903'::uuid,
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001'::uuid,
         '33333333-3333-3333-3333-333333333307'::uuid,
         4, 'Muy buena escuela. A mis gemelos les encanta. Solo sugeriría más horarios disponibles los fines de semana.'),
        
        -- Reseñas Academia Baloncesto Medellín
        ('99999999-9999-9999-9999-999999999904'::uuid,
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002'::uuid,
         '33333333-3333-3333-3333-333333333301'::uuid,
         5, 'Valentina ha crecido como deportista y como persona. El programa de desarrollo es excepcional.'),
        
        ('99999999-9999-9999-9999-999999999905'::uuid,
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002'::uuid,
         '33333333-3333-3333-3333-333333333304'::uuid,
         5, 'Nicolás pasó de la liga local a selección Antioquia gracias a esta academia. 100% recomendada.'),
        
        ('99999999-9999-9999-9999-999999999906'::uuid,
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002'::uuid,
         '33333333-3333-3333-3333-333333333308'::uuid,
         4, 'Muy buen nivel técnico. El análisis de video ayuda mucho a los chicos a mejorar.'),
        
        -- Reseñas Club Tenis Cali
        ('99999999-9999-9999-9999-999999999907'::uuid,
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003'::uuid,
         '33333333-3333-3333-3333-333333333303'::uuid,
         5, 'El mejor club de tenis del Valle. Sofía y Daniel han ganado varios torneos gracias a la formación.'),
        
        ('99999999-9999-9999-9999-999999999908'::uuid,
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003'::uuid,
         '33333333-3333-3333-3333-333333333305'::uuid,
         5, 'Isabella está fascinada con las clases. Los coaches tienen mucha paciencia con los pequeños.'),
        
        ('99999999-9999-9999-9999-999999999909'::uuid,
         'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003'::uuid,
         '33333333-3333-3333-3333-333333333309'::uuid,
         4, 'Excelentes instalaciones y metodología. Gabriela ha mejorado su juego significativamente.')
    RETURNING id
),

-- ===================================================================
-- 16. INSCRIPCIONES (ENROLLMENTS)
-- ===================================================================
inserted_enrollments AS (
    INSERT INTO public.enrollments (id, user_id, program_id, status, start_date)
    VALUES 
        -- Inscripciones Fútbol
        ('aabbccdd-aabb-ccdd-eeff-aabbccddeef1'::uuid,
         '44444444-4444-4444-4444-444444444401'::uuid,
         'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb002'::uuid,
         'active', '2025-01-15'),
        
        ('aabbccdd-aabb-ccdd-eeff-aabbccddeef2'::uuid,
         '44444444-4444-4444-4444-444444444403'::uuid,
         'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001'::uuid,
         'active', '2025-02-01'),
        
        ('aabbccdd-aabb-ccdd-eeff-aabbccddeef3'::uuid,
         '44444444-4444-4444-4444-444444444408'::uuid,
         'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb003'::uuid,
         'active', '2024-08-01'),
        
        ('aabbccdd-aabb-ccdd-eeff-aabbccddeef4'::uuid,
         '44444444-4444-4444-4444-444444444410'::uuid,
         'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb002'::uuid,
         'active', '2025-01-15'),
        
        ('aabbccdd-aabb-ccdd-eeff-aabbccddeef5'::uuid,
         '44444444-4444-4444-4444-444444444411'::uuid,
         'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb002'::uuid,
         'active', '2025-01-15'),
        
        ('aabbccdd-aabb-ccdd-eeff-aabbccddeef6'::uuid,
         '44444444-4444-4444-4444-444444444414'::uuid,
         'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb003'::uuid,
         'active', '2024-08-01'),
        
        -- Inscripciones Baloncesto
        ('aabbccdd-aabb-ccdd-eeff-aabbccddeef7'::uuid,
         '44444444-4444-4444-4444-444444444402'::uuid,
         'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb005'::uuid,
         'active', '2024-08-01'),
        
        ('aabbccdd-aabb-ccdd-eeff-aabbccddeef8'::uuid,
         '44444444-4444-4444-4444-444444444406'::uuid,
         'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb006'::uuid,
         'active', '2024-01-15'),
        
        ('aabbccdd-aabb-ccdd-eeff-aabbccddeef9'::uuid,
         '44444444-4444-4444-4444-444444444409'::uuid,
         'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb005'::uuid,
         'active', '2025-02-01'),
        
        ('aabbccdd-aabb-ccdd-eeff-aabbccddefa0'::uuid,
         '44444444-4444-4444-4444-444444444412'::uuid,
         'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb005'::uuid,
         'active', '2024-08-01'),
        
        ('aabbccdd-aabb-ccdd-eeff-aabbccddefb1'::uuid,
         '44444444-4444-4444-4444-444444444415'::uuid,
         'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb004'::uuid,
         'active', '2025-03-01'),
        
        -- Inscripciones Tenis
        ('aabbccdd-aabb-ccdd-eeff-aabbccddefc2'::uuid,
         '44444444-4444-4444-4444-444444444404'::uuid,
         'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb008'::uuid,
         'active', '2024-01-15'),
        
        ('aabbccdd-aabb-ccdd-eeff-aabbccddefd3'::uuid,
         '44444444-4444-4444-4444-444444444405'::uuid,
         'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb008'::uuid,
         'active', '2023-08-01'),
        
        ('aabbccdd-aabb-ccdd-eeff-aabbccddefe4'::uuid,
         '44444444-4444-4444-4444-444444444407'::uuid,
         'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb007'::uuid,
         'active', '2025-02-01'),
        
        ('aabbccdd-aabb-ccdd-eeff-aabbccddeff5'::uuid,
         '44444444-4444-4444-4444-444444444413'::uuid,
         'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb008'::uuid,
         'active', '2024-08-01')
    RETURNING id
),

-- ===================================================================
-- 17. PAGOS DE PADRES
-- ===================================================================
inserted_payments AS (
    INSERT INTO public.payments (id, parent_id, amount, concept, due_date, payment_date, status, receipt_number)
    VALUES 
        -- Pagos de Ana María
        ('pppppppp-pppp-pppp-pppp-pppppppppp01'::uuid,
         '33333333-3333-3333-3333-333333333301'::uuid,
         220000.00, 'Mensualidad Julio - Santiago (Fútbol Sub-12)',
         '2025-07-05', '2025-07-03', 'paid', 'REC-2025-07-001'),
        
        ('pppppppp-pppp-pppp-pppp-pppppppppp02'::uuid,
         '33333333-3333-3333-3333-333333333301'::uuid,
         230000.00, 'Mensualidad Julio - Valentina (Basket Sub-14)',
         '2025-07-05', '2025-07-03', 'paid', 'REC-2025-07-002'),
        
        -- Pagos de Roberto Carlos
        ('pppppppp-pppp-pppp-pppp-pppppppppp03'::uuid,
         '33333333-3333-3333-3333-333333333302'::uuid,
         180000.00, 'Mensualidad Julio - Mateo (Fútbol Sub-10)',
         '2025-07-05', NULL, 'pending', NULL),
        
        -- Pagos de Patricia
        ('pppppppp-pppp-pppp-pppp-pppppppppp04'::uuid,
         '33333333-3333-3333-3333-333333333303'::uuid,
         560000.00, 'Mensualidad Julio - Sofía y Daniel (Tenis Junior)',
         '2025-07-05', '2025-07-01', 'paid', 'REC-2025-07-003'),
        
        -- Pagos de Jorge Enrique
        ('pppppppp-pppp-pppp-pppp-pppppppppp05'::uuid,
         '33333333-3333-3333-3333-333333333304'::uuid,
         380000.00, 'Mensualidad Julio - Nicolás (Basket Elite)',
         '2025-07-05', '2025-07-04', 'paid', 'REC-2025-07-004'),
        
        -- Pagos de Claudia Marcela
        ('pppppppp-pppp-pppp-pppp-pppppppppp06'::uuid,
         '33333333-3333-3333-3333-333333333305'::uuid,
         200000.00, 'Mensualidad Julio - Isabella (Tenis Kids)',
         '2025-07-05', NULL, 'pending', NULL),
        
        -- Pagos de Sandra Milena (gemelos)
        ('pppppppp-pppp-pppp-pppp-pppppppppp07'::uuid,
         '33333333-3333-3333-3333-333333333307'::uuid,
         440000.00, 'Mensualidad Julio - Tomás y Lucas (Fútbol Sub-12)',
         '2025-07-05', '2025-07-05', 'paid', 'REC-2025-07-005')
    RETURNING id
)

-- ===================================================================
-- 18. ATHLETE STATS (MÉTRICAS HISTÓRICAS)
-- Genera 10 métricas por atleta en los últimos 30 días
-- ===================================================================
INSERT INTO public.athlete_stats (athlete_id, stat_date, stat_type, value, unit, notes, is_demo)
SELECT 
    athlete_id,
    (CURRENT_DATE - (random() * 30)::int) as stat_date,
    stat_type,
    CASE 
        WHEN stat_type = 'VO2 Max' THEN 35 + (random() * 20)  -- 35-55 ml/kg/min
        WHEN stat_type = 'Velocidad' THEN 15 + (random() * 15) -- 15-30 km/h
        WHEN stat_type = 'Salto Vertical' THEN 25 + (random() * 35) -- 25-60 cm
        WHEN stat_type = 'Precisión Tiro' THEN 50 + (random() * 45) -- 50-95%
        WHEN stat_type = 'Resistencia' THEN 60 + (random() * 35) -- 60-95 puntos
        WHEN stat_type = 'Agilidad' THEN 5 + (random() * 10) -- 5-15 seg (menor mejor)
        WHEN stat_type = 'Fuerza Core' THEN 40 + (random() * 50) -- 40-90 puntos
        WHEN stat_type = 'Flexibilidad' THEN 10 + (random() * 25) -- 10-35 cm
        WHEN stat_type = 'Coordinación' THEN 50 + (random() * 45) -- 50-95 puntos
        WHEN stat_type = 'Tiempo Reacción' THEN 0.2 + (random() * 0.3) -- 0.2-0.5 seg
    END as value,
    CASE 
        WHEN stat_type = 'VO2 Max' THEN 'ml/kg/min'
        WHEN stat_type = 'Velocidad' THEN 'km/h'
        WHEN stat_type = 'Salto Vertical' THEN 'cm'
        WHEN stat_type = 'Precisión Tiro' THEN '%'
        WHEN stat_type = 'Resistencia' THEN 'puntos'
        WHEN stat_type = 'Agilidad' THEN 'segundos'
        WHEN stat_type = 'Fuerza Core' THEN 'puntos'
        WHEN stat_type = 'Flexibilidad' THEN 'cm'
        WHEN stat_type = 'Coordinación' THEN 'puntos'
        WHEN stat_type = 'Tiempo Reacción' THEN 'segundos'
    END as unit,
    'Medición durante entrenamiento regular' as notes,
    true as is_demo
FROM (
    SELECT unnest(ARRAY[
        '44444444-4444-4444-4444-444444444401'::uuid,
        '44444444-4444-4444-4444-444444444402'::uuid,
        '44444444-4444-4444-4444-444444444403'::uuid,
        '44444444-4444-4444-4444-444444444404'::uuid,
        '44444444-4444-4444-4444-444444444405'::uuid,
        '44444444-4444-4444-4444-444444444406'::uuid,
        '44444444-4444-4444-4444-444444444407'::uuid,
        '44444444-4444-4444-4444-444444444408'::uuid,
        '44444444-4444-4444-4444-444444444409'::uuid,
        '44444444-4444-4444-4444-444444444410'::uuid,
        '44444444-4444-4444-4444-444444444411'::uuid,
        '44444444-4444-4444-4444-444444444412'::uuid,
        '44444444-4444-4444-4444-444444444413'::uuid,
        '44444444-4444-4444-4444-444444444414'::uuid,
        '44444444-4444-4444-4444-444444444415'::uuid
    ]) as athlete_id
) athletes
CROSS JOIN (
    SELECT unnest(ARRAY[
        'VO2 Max', 'Velocidad', 'Salto Vertical', 'Precisión Tiro', 'Resistencia',
        'Agilidad', 'Fuerza Core', 'Flexibilidad', 'Coordinación', 'Tiempo Reacción'
    ]) as stat_type
) stats;

-- ===================================================================
-- 19. TRAINING LOGS (REGISTROS DE ENTRENAMIENTO)
-- Genera registros de los últimos 30 días por atleta
-- ===================================================================
INSERT INTO public.training_logs (athlete_id, training_date, exercise_type, duration_minutes, intensity, calories_burned, notes, is_demo)
SELECT 
    athlete_id,
    (CURRENT_DATE - generate_series(1, 15)) as training_date,
    exercise_types[1 + (random() * 4)::int] as exercise_type,
    45 + (random() * 75)::int as duration_minutes,
    intensities[1 + (random() * 3)::int] as intensity,
    200 + (random() * 400)::int as calories_burned,
    'Sesión de entrenamiento completada' as notes,
    true as is_demo
FROM (
    SELECT unnest(ARRAY[
        '44444444-4444-4444-4444-444444444401'::uuid,
        '44444444-4444-4444-4444-444444444402'::uuid,
        '44444444-4444-4444-4444-444444444403'::uuid,
        '44444444-4444-4444-4444-444444444404'::uuid,
        '44444444-4444-4444-4444-444444444405'::uuid,
        '44444444-4444-4444-4444-444444444406'::uuid,
        '44444444-4444-4444-4444-444444444407'::uuid,
        '44444444-4444-4444-4444-444444444408'::uuid,
        '44444444-4444-4444-4444-444444444409'::uuid,
        '44444444-4444-4444-4444-444444444410'::uuid,
        '44444444-4444-4444-4444-444444444411'::uuid,
        '44444444-4444-4444-4444-444444444412'::uuid,
        '44444444-4444-4444-4444-444444444413'::uuid,
        '44444444-4444-4444-4444-444444444414'::uuid,
        '44444444-4444-4444-4444-444444444415'::uuid
    ]) as athlete_id
) athletes
CROSS JOIN (
    SELECT 
        ARRAY['Técnica', 'Táctica', 'Físico', 'Partido Práctica', 'Recuperación'] as exercise_types,
        ARRAY['low', 'medium', 'high', 'max'] as intensities
) params;

-- ===================================================================
-- 20. NOTIFICACIONES DEMO
-- ===================================================================
INSERT INTO public.notifications (user_id, title, message, type, read, link)
VALUES 
    ('33333333-3333-3333-3333-333333333301'::uuid, 
     '¡Nuevo torneo disponible!', 
     'El torneo Sub-12 de la Liga Distrital comienza el 15 de agosto. Inscribe a tu hijo.',
     'info', false, '/tournaments'),
    
    ('33333333-3333-3333-3333-333333333301'::uuid, 
     'Pago confirmado', 
     'Tu pago de $450,000 ha sido procesado correctamente.',
     'success', true, '/payments'),
    
    ('33333333-3333-3333-3333-333333333304'::uuid, 
     '¡Nicolás convocado a Selección!', 
     'Felicitaciones, Nicolás ha sido convocado a la Selección Antioquia Sub-16.',
     'success', false, '/athletes'),
    
    ('22222222-2222-2222-2222-222222222201'::uuid, 
     'Nueva solicitud de inscripción', 
     'Tienes 3 nuevas solicitudes de inscripción para el equipo Sub-12.',
     'info', false, '/team/enrollments'),
    
    ('11111111-1111-1111-1111-111111111101'::uuid, 
     'Reporte mensual listo', 
     'El reporte de asistencia y rendimiento de junio está disponible.',
     'info', true, '/reports');

-- ===================================================================
-- RESUMEN DE DATOS INSERTADOS
-- ===================================================================
-- Ejecutar para verificar:
/*
SELECT 'profiles' as tabla, count(*) as registros FROM public.profiles
UNION ALL SELECT 'schools', count(*) FROM public.schools
UNION ALL SELECT 'programs', count(*) FROM public.programs
UNION ALL SELECT 'facilities', count(*) FROM public.facilities
UNION ALL SELECT 'school_staff', count(*) FROM public.school_staff
UNION ALL SELECT 'children', count(*) FROM public.children
UNION ALL SELECT 'teams', count(*) FROM public.teams
UNION ALL SELECT 'team_members', count(*) FROM public.team_members
UNION ALL SELECT 'products', count(*) FROM public.products
UNION ALL SELECT 'reviews', count(*) FROM public.reviews
UNION ALL SELECT 'enrollments', count(*) FROM public.enrollments
UNION ALL SELECT 'payments', count(*) FROM public.payments
UNION ALL SELECT 'athlete_stats', count(*) FROM public.athlete_stats
UNION ALL SELECT 'training_logs', count(*) FROM public.training_logs
UNION ALL SELECT 'notifications', count(*) FROM public.notifications
ORDER BY tabla;
*/

-- =====================================================================
-- FIN DEL SCRIPT
-- =====================================================================
