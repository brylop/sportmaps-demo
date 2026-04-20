-- =====================================================
-- MIGRACIÓN: ALINEACIÓN CON PRD (HU-1.2, HU-3.1)
-- =====================================================

-- 1. Actualización de la tabla PROFILES
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS middle_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS second_last_name TEXT,
ADD COLUMN IF NOT EXISTS doc_type TEXT DEFAULT 'CC',
ADD COLUMN IF NOT EXISTS doc_number TEXT,
ADD COLUMN IF NOT EXISTS mobile_phone TEXT,
ADD COLUMN IF NOT EXISTS city_id INTEGER,
ADD COLUMN IF NOT EXISTS address TEXT;

-- Migración de datos existentes (split simple de full_name)
UPDATE profiles 
SET first_name = split_part(full_name, ' ', 1),
    last_name = split_part(full_name, ' ', 2)
WHERE first_name IS NULL;

-- 2. Constraints de Unicidad y Not Null (Post-migración)
-- Nota: En un ambiente real, se asegurarían datos limpios antes de activar NOT NULL
ALTER TABLE profiles ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE profiles ALTER COLUMN last_name SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_doc_number_unique ON profiles(doc_number) WHERE doc_number IS NOT NULL;

-- 3. Actualización de la tabla STUDENTS (Hijos)
ALTER TABLE students
ADD COLUMN IF NOT EXISTS middle_name TEXT,
ADD COLUMN IF NOT EXISTS second_last_name TEXT,
ADD COLUMN IF NOT EXISTS doc_type TEXT DEFAULT 'RC',
ADD COLUMN IF NOT EXISTS doc_number TEXT,
ADD COLUMN IF NOT EXISTS health_provider TEXT,
ADD COLUMN IF NOT EXISTS blood_type TEXT,
ADD COLUMN IF NOT EXISTS allergies TEXT,
ADD COLUMN IF NOT EXISTS shirt_size TEXT,
ADD COLUMN IF NOT EXISTS shoe_size TEXT;

-- Unicidad de documento de estudiante
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_doc_number_unique ON students(doc_number);

-- 4. Nueva tabla de CIUDADES (Referencia DANE)
CREATE TABLE IF NOT EXISTS colombia_cities (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    dane_code TEXT UNIQUE
);

-- Comentario para el log
COMMENT ON TABLE profiles IS 'Alineado con PRD MVP v1.2: IAM y KYC Legal';
