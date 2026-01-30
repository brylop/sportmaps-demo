-- =============================================================================
-- SPORTMAPS SEED SCRIPT (Idempotent)
-- =============================================================================
-- Description: Populates the database with demo schools, users, athletes, and metrics.
-- Safe to run multiple times: Uses ON CONFLICT to avoid duplicates.
-- Includes table creation for 'spm_performance_metrics' if missing.
-- =============================================================================

-- 1. EXTENSIONS & SETUP
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. CREATE MISSING TABLES
-- We need a table for performance metrics as it wasn't in the original schema
CREATE TABLE IF NOT EXISTS spm_performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID REFERENCES spm_players(id),
    category TEXT NOT NULL, -- 'physical', 'technical', 'tactical'
    metric_name TEXT NOT NULL, -- 'Speed', 'Strength', 'Attendance'
    value DECIMAL NOT NULL,
    unit TEXT, -- 'km/h', 'kg', '%'
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index for faster dashboard queries
-- CREATE INDEX IF NOT EXISTS idx_spm_perf_metrics_player ON spm_performance_metrics(player_id, recorded_at);

-- 3. VARIABLES (Using DO block for complex checking is possible, but for a seed script
-- with relationships, we will use STATIC UUIDs to guarantee FK integrity without complex lookups).

-- =============================================================================
-- STATIC DATA DEFINITIONS
-- =============================================================================

-- SCHOOLS (CLUBS)
-- ID: 10000000-0000-0000-0000-000000000001 -> Club Fútbol Bogotá
-- ID: 10000000-0000-0000-0000-000000000002 -> Club Patinaje Medellín

-- USERS (COACHES)
-- ID: 20000000-0000-0000-0000-000000000001 -> Coach Bogotá 1
-- ID: 20000000-0000-0000-0000-000000000002 -> Coach Bogotá 2
-- ID: 20000000-0000-0000-0000-000000000003 -> Coach Medellín 1
-- ID: 20000000-0000-0000-0000-000000000004 -> Coach Medellín 2

-- USERS (PARENTS) & ATHLETES will follow distinct patterns.

-- =============================================================================
-- DATA INSERTION
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- A. SCHOOLS / CLUBS
-- -----------------------------------------------------------------------------
INSERT INTO spm_clubs (id, name, slug, city, country)
VALUES
    ('10000000-0000-0000-0000-000000000001', 'Academia de Fútbol Capital', 'futbol-bogota', 'Bogotá', 'Colombia'),
    ('10000000-0000-0000-0000-000000000002', 'Escuela Elite Patinaje Antioquia', 'patinaje-medellin', 'Medellín', 'Colombia')
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name, city = EXCLUDED.city; 
-- Note: 'slug' conflict is also possible, but ID is primary.

-- -----------------------------------------------------------------------------
-- B. USERS - COACHES
-- -----------------------------------------------------------------------------
INSERT INTO spm_users (id, email, full_name, role, phone, avatar_url)
VALUES
    ('20000000-0000-0000-0000-000000000001', 'carlos.ruiz@futbolbogota.co', 'Carlos Ruiz', 'coach', '+573001234567', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Carlos'),
    ('20000000-0000-0000-0000-000000000002', 'andres.henao@futbolbogota.co', 'Andrés Henao', 'coach', '+573001234568', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Andres'),
    ('20000000-0000-0000-0000-000000000003', 'maria.velez@patinajemed.co', 'María Vélez', 'coach', '+573009876543', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Maria'),
    ('20000000-0000-0000-0000-000000000004', 'juan.perez@patinajemed.co', 'Juan Pérez', 'coach', '+573009876544', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Juan')
ON CONFLICT (email) DO NOTHING;

-- -----------------------------------------------------------------------------
-- C. USERS - PARENTS (6 Parents)
-- IDs 3000...
-- -----------------------------------------------------------------------------
INSERT INTO spm_users (id, email, full_name, role, phone, avatar_url)
VALUES
    ('30000000-0000-0000-0000-000000000001', 'fernando.gomez@gmail.com', 'Fernando Gómez', 'parent', '+573101112233', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Fernando'),
    ('30000000-0000-0000-0000-000000000002', 'laura.castro@hotmail.com', 'Laura Castro', 'parent', '+573102223344', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Laura'),
    ('30000000-0000-0000-0000-000000000003', 'diana.martinez@outlook.com', 'Diana Martínez', 'parent', '+573103334455', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Diana'),
    ('30000000-0000-0000-0000-000000000004', 'pedro.sanchez@gmail.com', 'Pedro Sánchez', 'parent', '+573104445566', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Pedro'),
    ('30000000-0000-0000-0000-000000000005', 'sofia.lopez@yahoo.com', 'Sofía López', 'parent', '+573105556677', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sofia'),
    ('30000000-0000-0000-0000-000000000006', 'jorge.duque@gmail.com', 'Jorge Duque', 'parent', '+573106667788', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jorge')
ON CONFLICT (email) DO NOTHING;

-- -----------------------------------------------------------------------------
-- D. USERS - PLAYERS & PLAYER PROFILES (12 Athletes)
-- IDs 4000... for Users, 5000... for Player Profiles
-- -----------------------------------------------------------------------------
-- We need to insert the USER first, then the PLAYER profile.

-- ATHLETE USERS
INSERT INTO spm_users (id, email, full_name, role, avatar_url)
VALUES
    -- Football Players (Children of Parents 1-3)
    ('40000000-0000-0000-0000-000000000001', 'santi.gomez@kid.com', 'Santiago Gómez', 'player', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Santi'),
    ('40000000-0000-0000-0000-000000000002', 'mateo.gomez@kid.com', 'Mateo Gómez', 'player', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mateo'),
    ('40000000-0000-0000-0000-000000000003', 'lucas.castro@kid.com', 'Lucas Castro', 'player', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Lucas'),
    ('40000000-0000-0000-0000-000000000004', 'tomas.martinez@kid.com', 'Tomás Martínez', 'player', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Tomas'),
    ('40000000-0000-0000-0000-000000000005', 'samuel.martinez@kid.com', 'Samuel Martínez', 'player', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Samuel'),
    ('40000000-0000-0000-0000-000000000006', 'jeronimo.martinez@kid.com', 'Jerónimo Martínez', 'player', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jero'),
    
    -- Skating Players (Children of Parents 4-6)
    ('40000000-0000-0000-0000-000000000007', 'valeria.sanchez@kid.com', 'Valeria Sánchez', 'player', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Valeria'),
    ('40000000-0000-0000-0000-000000000008', 'mariana.sanchez@kid.com', 'Mariana Sánchez', 'player', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mariana'),
    ('40000000-0000-0000-0000-000000000009', 'isabella.lopez@kid.com', 'Isabella López', 'player', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Isabella'),
    ('40000000-0000-0000-0000-000000000010', 'gabriela.duque@kid.com', 'Gabriela Duque', 'player', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Gabriela'),
    ('40000000-0000-0000-0000-000000000011', 'antonella.duque@kid.com', 'Antonella Duque', 'player', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Anto'),
    ('40000000-0000-0000-0000-000000000012', 'luciana.duque@kid.com', 'Luciana Duque', 'player', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Luciana')
ON CONFLICT (email) DO NOTHING;

-- ATHLETE PROFILES
INSERT INTO spm_players (id, user_id, nickname, birthdate, position, height_cm, weight_kg, dominant_foot)
VALUES
    -- Football
    ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Santi', '2012-05-15', 'Delantero', 145, 38, 'Derecho'),
    ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'Teo', '2014-08-20', 'Defensa', 135, 32, 'Izquierdo'),
    ('50000000-0000-0000-0000-000000000003', 'Rayo', '2011-03-10', 'Mediocampista', 150, 42, 'Derecho'),
    ('50000000-0000-0000-0000-000000000004', 'Tomy', '2013-11-05', 'Portero', 148, 40, 'Derecho'),
    ('50000000-0000-0000-0000-000000000005', 'Samu', '2012-01-30', 'Lateral', 142, 36, 'Derecho'),
    ('50000000-0000-0000-0000-000000000006', 'Jero', '2014-06-12', 'Extremo', 138, 33, 'Izquierdo'),

    -- Skating (Positions: Velocidad, Fondo, Artístico)
    ('50000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000007', 'Vale', '2012-02-14', 'Velocidad', 146, 39, NULL),
    ('50000000-0000-0000-0000-000000000008', 'Mari', '2010-09-22', 'Fondo', 158, 48, NULL),
    ('50000000-0000-0000-0000-000000000009', 'Isa', '2013-04-18', 'Artístico', 140, 35, NULL),
    ('50000000-0000-0000-0000-000000000010', 'Gaby', '2011-07-07', 'Velocidad', 152, 43, NULL),
    ('50000000-0000-0000-0000-000000000011', 'Anto', '2014-12-01', 'Fondo', 136, 31, NULL),
    ('50000000-0000-0000-0000-000000000012', 'Lu', '2012-10-30', 'Artístico', 144, 38, NULL)
ON CONFLICT (user_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- E. PERFORMANCE METRICS (5 per athlete, last 15 days)
-- -----------------------------------------------------------------------------
-- We'll use a functional approach to generate these for all existing players if desired,
-- but to keep it strictly idempotent with controlled data, explicit inserts are safer
-- or using a DO block iterating over known IDs.

INSERT INTO spm_performance_metrics (player_id, category, metric_name, value, unit, recorded_at)
SELECT 
    p.id, 
    m.category, 
    m.name, 
    (random() * (m.max_val - m.min_val) + m.min_val)::decimal(10,2), 
    m.unit, 
    NOW() - (interval '1 day' * (random() * 15)::int)
FROM spm_players p
CROSS JOIN (
    VALUES 
        ('physical', 'Velocidad 20m', 2.8, 4.5, 's'),
        ('physical', 'Salto Vertical', 20, 50, 'cm'),
        ('technical', 'Precisión Pases', 60, 95, '%'),
        ('physical', 'Resistencia', 5, 12, 'min'),
        ('tactical', 'Asistencia', 80, 100, '%')
) AS m(category, name, min_val, max_val, unit)
WHERE NOT EXISTS (
    SELECT 1 FROM spm_performance_metrics pm 
    WHERE pm.player_id = p.id AND pm.metric_name = m.name 
    AND pm.recorded_at > NOW() - interval '20 days'
);

-- Note: The metrics insertion above is safe to run repeatedly because of the WHERE NOT EXISTS check.
-- It generates new metrics only if recent ones don't exist, effectively topping up the dashboard data.

COMMIT;

-- =============================================================================
-- END OF SCRIPT
-- =============================================================================
