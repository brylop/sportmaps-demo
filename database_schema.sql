-- =====================================================
-- SPORTMAPS DATABASE SCHEMA
-- PostgreSQL / Supabase
-- Version: 1.0 MVP
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis"; -- Para funcionalidad de mapas
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Para búsqueda de texto mejorada

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE user_role AS ENUM ('school_admin', 'parent', 'coach', 'athlete', 'super_admin');
CREATE TYPE enrollment_status AS ENUM ('pending', 'confirmed', 'awaiting_approval', 'payment_rejected', 'inactive', 'completed', 'cancelled');
CREATE TYPE payment_status AS ENUM ('pending', 'pending_approval', 'paid', 'failed', 'rejected', 'overdue', 'refunded');
CREATE TYPE payment_method AS ENUM ('credit_card', 'debit_card', 'bank_transfer', 'nequi', 'daviplata', 'pse', 'cash');
CREATE TYPE payment_type AS ENUM ('automatic', 'manual');
CREATE TYPE transaction_type AS ENUM ('enrollment', 'monthly_tuition', 'late_fee', 'refund', 'discount', 'other');
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'excused');
CREATE TYPE student_status AS ENUM ('active', 'inactive', 'graduated', 'dropped_out', 'transferred');
CREATE TYPE sport_type AS ENUM ('football', 'basketball', 'volleyball', 'tennis', 'swimming', 'martial_arts', 'athletics', 'gymnastics', 'other');
CREATE TYPE skill_level AS ENUM ('beginner', 'intermediate', 'advanced', 'elite');
CREATE TYPE day_of_week AS ENUM ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');
CREATE TYPE notification_type AS ENUM ('payment_confirmation', 'payment_reminder', 'enrollment_approved', 'enrollment_rejected', 'class_cancelled', 'attendance_marked', 'announcement', 'message', 'system');
CREATE TYPE announcement_audience AS ENUM ('all_parents', 'specific_program', 'specific_class', 'all_coaches', 'all_students');

-- =====================================================
-- TABLA: profiles
-- Extensión de auth.users de Supabase
-- =====================================================

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    onboarding_completed BOOLEAN DEFAULT false,
    preferences JSONB DEFAULT '{}', -- Idioma, tema, notificaciones, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Índices
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_is_active ON profiles(is_active);

-- =====================================================
-- TABLA: schools
-- =====================================================

CREATE TABLE schools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL, -- Para URLs públicas
    description TEXT,
    logo_url TEXT,
    cover_image_url TEXT,

    -- Información de contacto
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    website TEXT,

    -- Dirección y ubicación
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT,
    country TEXT DEFAULT 'Colombia',
    postal_code TEXT,
    location GEOGRAPHY(POINT, 4326), -- Para búsqueda geoespacial

    -- Información bancaria (encriptada en producción)
    bank_name TEXT,
    bank_account_type TEXT, -- Ahorros, Corriente
    bank_account_number TEXT,
    bank_account_holder TEXT,
    nit TEXT,

    -- Información operativa
    sports_offered sport_type[] DEFAULT '{}',
    operating_hours JSONB, -- {"monday": {"open": "08:00", "close": "20:00"}, ...}
    facilities TEXT[], -- ["Cancha de fútbol", "Piscina", etc.]
    max_capacity INTEGER,

    -- Estado y visibilidad
    is_active BOOLEAN DEFAULT true,
    is_public BOOLEAN DEFAULT true, -- Visible en marketplace
    profile_completion_percentage INTEGER DEFAULT 0,

    -- Métricas
    average_rating DECIMAL(3,2) DEFAULT 0,
    total_reviews INTEGER DEFAULT 0,
    total_students INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_schools_updated_at BEFORE UPDATE ON schools
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Índices
CREATE INDEX idx_schools_admin_id ON schools(admin_id);
CREATE INDEX idx_schools_slug ON schools(slug);
CREATE INDEX idx_schools_city ON schools(city);
CREATE INDEX idx_schools_is_active ON schools(is_active);
CREATE INDEX idx_schools_is_public ON schools(is_public);
CREATE INDEX idx_schools_location ON schools USING GIST(location); -- Para búsquedas geoespaciales
CREATE INDEX idx_schools_sports_offered ON schools USING GIN(sports_offered); -- Para filtrar por deporte

-- =====================================================
-- TABLA: students
-- =====================================================

CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

    -- Información personal
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    gender TEXT, -- Male, Female, Other, Prefer not to say
    photo_url TEXT,

    -- Información de contacto (padres)
    parent_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Si el padre se registra en la plataforma
    parent_name TEXT NOT NULL,
    parent_email TEXT NOT NULL,
    parent_phone TEXT NOT NULL,
    secondary_parent_name TEXT,
    secondary_parent_phone TEXT,

    -- Contacto de emergencia
    emergency_contact_name TEXT NOT NULL,
    emergency_contact_phone TEXT NOT NULL,
    emergency_contact_relationship TEXT,

    -- Información médica
    medical_notes TEXT, -- Alergias, condiciones, medicamentos
    blood_type TEXT,
    insurance_provider TEXT,
    insurance_policy_number TEXT,

    -- Estado
    status student_status DEFAULT 'active',
    status_changed_at TIMESTAMPTZ,
    status_changed_by UUID REFERENCES profiles(id),
    status_change_reason TEXT,

    -- Metadatos
    enrollment_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Índices
CREATE INDEX idx_students_school_id ON students(school_id);
CREATE INDEX idx_students_parent_id ON students(parent_id);
CREATE INDEX idx_students_status ON students(status);
CREATE INDEX idx_students_parent_email ON students(parent_email);
CREATE INDEX idx_students_name ON students USING GIN(to_tsvector('spanish', first_name || ' ' || last_name)); -- Búsqueda texto

-- =====================================================
-- TABLA: programs
-- =====================================================

CREATE TABLE programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

    name TEXT NOT NULL,
    sport_type sport_type NOT NULL,
    skill_level skill_level DEFAULT 'beginner',

    -- Rango de edad
    min_age INTEGER NOT NULL,
    max_age INTEGER NOT NULL,

    -- Información del programa
    description TEXT,
    objectives TEXT,
    duration_weeks INTEGER, -- Duración típica del programa

    -- Capacidad y precios
    max_capacity INTEGER,
    current_enrollment INTEGER DEFAULT 0,
    monthly_fee DECIMAL(10,2) NOT NULL,
    enrollment_fee DECIMAL(10,2) DEFAULT 0,

    -- Estado
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_programs_updated_at BEFORE UPDATE ON programs
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Índices
CREATE INDEX idx_programs_school_id ON programs(school_id);
CREATE INDEX idx_programs_sport_type ON programs(sport_type);
CREATE INDEX idx_programs_is_active ON programs(is_active);

-- =====================================================
-- TABLA: classes (Horarios de clase)
-- =====================================================

CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    coach_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

    name TEXT, -- Opcional: "Fútbol Sub-10 Grupo A"

    -- Horario
    day_of_week day_of_week NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,

    -- Ubicación
    location TEXT, -- "Cancha 1", "Piscina Principal", etc.

    -- Capacidad
    max_capacity INTEGER DEFAULT 20,
    current_enrollment INTEGER DEFAULT 0,

    -- Estado
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON classes
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Índices
CREATE INDEX idx_classes_program_id ON classes(program_id);
CREATE INDEX idx_classes_school_id ON classes(school_id);
CREATE INDEX idx_classes_coach_id ON classes(coach_id);
CREATE INDEX idx_classes_day_of_week ON classes(day_of_week);

-- Constraint: Evitar clases superpuestas para mismo entrenador
CREATE UNIQUE INDEX idx_classes_coach_time_conflict
ON classes(coach_id, day_of_week, start_time)
WHERE coach_id IS NOT NULL AND is_active = true;

-- =====================================================
-- TABLA: enrollments (Inscripciones)
-- =====================================================

CREATE TABLE enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE RESTRICT,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

    -- Estado de inscripción
    enrollment_status enrollment_status DEFAULT 'pending',
    payment_status payment_status DEFAULT 'pending',
    payment_type payment_type DEFAULT 'manual',
    payment_method payment_method,

    -- Fechas
    enrollment_date DATE DEFAULT CURRENT_DATE,
    start_date DATE NOT NULL,
    end_date DATE, -- Si el programa tiene duración fija

    -- Tokens de pago (para recurrencia)
    payment_token TEXT, -- ePayco token para cobros recurrentes
    payment_token_metadata JSONB, -- Info adicional del token

    -- Referencias
    next_payment_date DATE,
    monthly_amount DECIMAL(10,2) NOT NULL,

    -- Estado
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_enrollments_updated_at BEFORE UPDATE ON enrollments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Índices
CREATE INDEX idx_enrollments_student_id ON enrollments(student_id);
CREATE INDEX idx_enrollments_program_id ON enrollments(program_id);
CREATE INDEX idx_enrollments_school_id ON enrollments(school_id);
CREATE INDEX idx_enrollments_status ON enrollments(enrollment_status);
CREATE INDEX idx_enrollments_payment_status ON enrollments(payment_status);
CREATE INDEX idx_enrollments_next_payment ON enrollments(next_payment_date) WHERE is_active = true;

-- Constraint: Un estudiante no puede estar inscrito dos veces en el mismo programa activo
CREATE UNIQUE INDEX idx_enrollments_unique_active
ON enrollments(student_id, program_id)
WHERE is_active = true;

-- =====================================================
-- TABLA: class_enrollments (Relación N:N entre enrollments y classes)
-- =====================================================

CREATE TABLE class_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_class_enrollments_enrollment ON class_enrollments(enrollment_id);
CREATE INDEX idx_class_enrollments_class ON class_enrollments(class_id);

-- Constraint único
CREATE UNIQUE INDEX idx_class_enrollments_unique
ON class_enrollments(enrollment_id, class_id);

-- =====================================================
-- TABLA: transactions (Transacciones de pago)
-- =====================================================

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    enrollment_id UUID REFERENCES enrollments(id) ON DELETE SET NULL,

    -- Información de transacción
    transaction_type transaction_type NOT NULL,
    payment_method payment_method NOT NULL,
    payment_type payment_type NOT NULL,

    -- Montos
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'COP',

    -- Estado
    payment_status payment_status DEFAULT 'pending',

    -- Referencias externas (ePayco, Wompi, etc.)
    external_transaction_id TEXT, -- ID de la pasarela
    external_reference TEXT,
    gateway_response JSONB, -- Respuesta completa de la pasarela

    -- Metadata
    description TEXT,
    notes TEXT,
    processed_by UUID REFERENCES profiles(id), -- Admin que procesó (si manual)
    processed_at TIMESTAMPTZ,

    -- Fechas
    due_date DATE,
    paid_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Índices
CREATE INDEX idx_transactions_school_id ON transactions(school_id);
CREATE INDEX idx_transactions_student_id ON transactions(student_id);
CREATE INDEX idx_transactions_enrollment_id ON transactions(enrollment_id);
CREATE INDEX idx_transactions_status ON transactions(payment_status);
CREATE INDEX idx_transactions_external_id ON transactions(external_transaction_id);
CREATE INDEX idx_transactions_due_date ON transactions(due_date);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);

-- =====================================================
-- TABLA: manual_payments (Pagos manuales pendientes de aprobación)
-- =====================================================

CREATE TABLE manual_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,

    -- Comprobante
    proof_of_payment_url TEXT NOT NULL, -- URL de la imagen/PDF del comprobante
    payment_method payment_method NOT NULL,

    -- Información adicional del padre
    notes TEXT, -- Comentarios del padre

    -- Revisión admin
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT, -- Comentarios del admin
    approval_status payment_status DEFAULT 'pending_approval',
    rejection_reason TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_manual_payments_updated_at BEFORE UPDATE ON manual_payments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Índices
CREATE INDEX idx_manual_payments_transaction ON manual_payments(transaction_id);
CREATE INDEX idx_manual_payments_school ON manual_payments(school_id);
CREATE INDEX idx_manual_payments_status ON manual_payments(approval_status);
CREATE INDEX idx_manual_payments_created ON manual_payments(created_at DESC);

-- =====================================================
-- TABLA: attendance_records (Registros de asistencia)
-- =====================================================

CREATE TABLE attendance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

    -- Fecha y estado
    attendance_date DATE NOT NULL,
    status attendance_status NOT NULL,

    -- Quién marcó la asistencia
    marked_by UUID NOT NULL REFERENCES profiles(id),
    marked_at TIMESTAMPTZ DEFAULT NOW(),

    -- Notas adicionales
    notes TEXT,

    -- Check-in automático (QR)
    check_in_method TEXT, -- 'manual', 'qr_code', 'mobile_app'
    check_in_time TIMESTAMPTZ,
    check_out_time TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_attendance_records_updated_at BEFORE UPDATE ON attendance_records
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Índices
CREATE INDEX idx_attendance_class ON attendance_records(class_id);
CREATE INDEX idx_attendance_student ON attendance_records(student_id);
CREATE INDEX idx_attendance_school ON attendance_records(school_id);
CREATE INDEX idx_attendance_date ON attendance_records(attendance_date DESC);
CREATE INDEX idx_attendance_status ON attendance_records(status);

-- Constraint: Una asistencia por estudiante por clase por día
CREATE UNIQUE INDEX idx_attendance_unique
ON attendance_records(class_id, student_id, attendance_date);

-- =====================================================
-- TABLA: wellness_reports (Reportes de bienestar)
-- =====================================================

CREATE TABLE wellness_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attendance_record_id UUID REFERENCES attendance_records(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,

    -- Fecha
    report_date DATE NOT NULL,

    -- Métricas de bienestar
    energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 5),
    mood TEXT, -- emoji o texto
    has_pain BOOLEAN DEFAULT false,
    pain_description TEXT,

    -- Notas del entrenador
    coach_notes TEXT,
    reported_by UUID NOT NULL REFERENCES profiles(id),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_wellness_student ON wellness_reports(student_id);
CREATE INDEX idx_wellness_school ON wellness_reports(school_id);
CREATE INDEX idx_wellness_date ON wellness_reports(report_date DESC);
CREATE INDEX idx_wellness_has_pain ON wellness_reports(has_pain) WHERE has_pain = true;

-- =====================================================
-- TABLA: notifications (Notificaciones)
-- =====================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Contenido
    type notification_type NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,

    -- Metadata
    data JSONB, -- Información adicional (IDs, enlaces, etc.)
    deep_link TEXT, -- URL para navegar dentro de la app

    -- Estado
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,

    -- Push notification
    fcm_token TEXT, -- Token FCM para envío
    sent_at TIMESTAMPTZ,
    delivery_status TEXT, -- 'pending', 'sent', 'failed'

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- =====================================================
-- TABLA: announcements (Anuncios)
-- =====================================================

CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES profiles(id),

    -- Contenido
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    image_url TEXT,

    -- Audiencia
    audience announcement_audience NOT NULL,
    target_program_id UUID REFERENCES programs(id), -- Si es specific_program
    target_class_id UUID REFERENCES classes(id), -- Si es specific_class

    -- Publicación
    is_published BOOLEAN DEFAULT false,
    published_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    is_pinned BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON announcements
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Índices
CREATE INDEX idx_announcements_school ON announcements(school_id);
CREATE INDEX idx_announcements_published ON announcements(is_published, published_at);
CREATE INDEX idx_announcements_audience ON announcements(audience);

-- =====================================================
-- TABLA: messages (Mensajería directa)
-- =====================================================

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

    -- Remitente y destinatario
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Hilo de conversación
    conversation_id UUID, -- Para agrupar mensajes del mismo hilo
    parent_message_id UUID REFERENCES messages(id), -- Si es respuesta

    -- Contenido
    subject TEXT,
    body TEXT NOT NULL,
    attachments JSONB, -- URLs de archivos adjuntos

    -- Estado
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    is_archived BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_messages_school ON messages(school_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_recipient ON messages(recipient_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_is_read ON messages(is_read);
CREATE INDEX idx_messages_created ON messages(created_at DESC);

-- =====================================================
-- TABLA: reviews (Reseñas de escuelas)
-- =====================================================

CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    parent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE SET NULL, -- Estudiante por el cual se hace la reseña

    -- Calificación
    overall_rating INTEGER NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
    coaches_rating INTEGER CHECK (coaches_rating BETWEEN 1 AND 5),
    facilities_rating INTEGER CHECK (facilities_rating BETWEEN 1 AND 5),
    communication_rating INTEGER CHECK (communication_rating BETWEEN 1 AND 5),
    value_rating INTEGER CHECK (value_rating BETWEEN 1 AND 5),

    -- Contenido
    title TEXT NOT NULL,
    body TEXT NOT NULL,

    -- Interacción
    helpful_count INTEGER DEFAULT 0,

    -- Respuesta de la escuela
    school_response TEXT,
    school_response_at TIMESTAMPTZ,

    -- Moderación
    is_flagged BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false, -- Padre verificado que tuvo hijo inscrito

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Índices
CREATE INDEX idx_reviews_school ON reviews(school_id);
CREATE INDEX idx_reviews_parent ON reviews(parent_id);
CREATE INDEX idx_reviews_rating ON reviews(overall_rating);
CREATE INDEX idx_reviews_created ON reviews(created_at DESC);

-- Constraint: Un padre solo puede dejar una reseña por escuela
CREATE UNIQUE INDEX idx_reviews_unique_parent_school
ON reviews(school_id, parent_id);

-- =====================================================
-- TABLA: leads (Captura de leads del marketplace)
-- =====================================================

CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

    -- Información del lead
    parent_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    child_age INTEGER,
    message TEXT,

    -- Fuente
    source TEXT, -- 'marketplace', 'referral', 'direct', 'social_media'
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,

    -- Estado
    status TEXT DEFAULT 'new', -- 'new', 'contacted', 'qualified', 'converted', 'lost'
    assigned_to UUID REFERENCES profiles(id),

    -- Seguimiento
    contacted_at TIMESTAMPTZ,
    converted_at TIMESTAMPTZ,
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Índices
CREATE INDEX idx_leads_school ON leads(school_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_created ON leads(created_at DESC);

-- =====================================================
-- TABLA: audit_log (Log de auditoría)
-- =====================================================

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id),
    school_id UUID REFERENCES schools(id),

    -- Acción
    action TEXT NOT NULL, -- 'create', 'update', 'delete', 'login', etc.
    entity_type TEXT NOT NULL, -- 'student', 'enrollment', 'payment', etc.
    entity_id UUID,

    -- Detalles
    old_values JSONB,
    new_values JSONB,
    metadata JSONB,

    -- Contexto
    ip_address INET,
    user_agent TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_school ON audit_log(school_id);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

-- =====================================================
-- VISTAS ÚTILES
-- =====================================================

-- Vista de dashboard de escuela
CREATE VIEW school_dashboard_stats AS
SELECT
    s.id as school_id,
    s.name as school_name,
    COUNT(DISTINCT st.id) FILTER (WHERE st.status = 'active') as active_students,
    COUNT(DISTINCT p.id) FILTER (WHERE p.is_active = true) as active_programs,
    COUNT(DISTINCT e.id) FILTER (WHERE e.is_active = true) as active_enrollments,
    COALESCE(SUM(e.monthly_amount) FILTER (WHERE e.is_active = true AND e.payment_status = 'paid'), 0) as monthly_revenue,
    COALESCE(SUM(e.monthly_amount) FILTER (WHERE e.is_active = true AND e.payment_status IN ('pending', 'overdue')), 0) as pending_revenue,
    ROUND(AVG(CASE WHEN ar.status = 'present' THEN 100 ELSE 0 END), 2) as attendance_rate
FROM schools s
LEFT JOIN students st ON st.school_id = s.id
LEFT JOIN programs p ON p.school_id = s.id
LEFT JOIN enrollments e ON e.school_id = s.id
LEFT JOIN attendance_records ar ON ar.school_id = s.id AND ar.attendance_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY s.id, s.name;

-- Vista de estudiantes con información de inscripción
CREATE VIEW student_enrollments_view AS
SELECT
    st.id as student_id,
    st.first_name,
    st.last_name,
    st.school_id,
    st.status as student_status,
    e.id as enrollment_id,
    p.name as program_name,
    p.sport_type,
    e.enrollment_status,
    e.payment_status,
    e.monthly_amount,
    e.next_payment_date,
    e.start_date,
    COUNT(ar.id) FILTER (WHERE ar.status = 'present') as classes_attended,
    COUNT(ar.id) as total_classes
FROM students st
LEFT JOIN enrollments e ON e.student_id = st.id AND e.is_active = true
LEFT JOIN programs p ON p.id = e.program_id
LEFT JOIN class_enrollments ce ON ce.enrollment_id = e.id
LEFT JOIN attendance_records ar ON ar.student_id = st.id AND ar.class_id = ce.class_id
GROUP BY st.id, e.id, p.id;

-- Vista de pagos pendientes de aprobación
CREATE VIEW pending_manual_payments_view AS
SELECT
    mp.id,
    mp.school_id,
    s.name as school_name,
    st.first_name || ' ' || st.last_name as student_name,
    st.parent_name,
    st.parent_email,
    t.amount,
    mp.payment_method,
    mp.proof_of_payment_url,
    mp.notes,
    mp.created_at,
    mp.approval_status
FROM manual_payments mp
JOIN transactions t ON t.id = mp.transaction_id
JOIN students st ON st.id = mp.student_id
JOIN schools s ON s.id = mp.school_id
WHERE mp.approval_status = 'pending_approval'
ORDER BY mp.created_at ASC;

-- =====================================================
-- FUNCIONES ÚTILES
-- =====================================================

-- Función para actualizar el rating promedio de una escuela
CREATE OR REPLACE FUNCTION update_school_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE schools
    SET
        average_rating = (
            SELECT ROUND(AVG(overall_rating)::numeric, 2)
            FROM reviews
            WHERE school_id = NEW.school_id AND is_flagged = false
        ),
        total_reviews = (
            SELECT COUNT(*)
            FROM reviews
            WHERE school_id = NEW.school_id AND is_flagged = false
        )
    WHERE id = NEW.school_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_school_rating_trigger
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION update_school_rating();

-- Función para actualizar el conteo de estudiantes de una escuela
CREATE OR REPLACE FUNCTION update_school_student_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE schools
    SET total_students = (
        SELECT COUNT(*)
        FROM students
        WHERE school_id = COALESCE(NEW.school_id, OLD.school_id) AND status = 'active'
    )
    WHERE id = COALESCE(NEW.school_id, OLD.school_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_school_student_count_trigger
AFTER INSERT OR UPDATE OR DELETE ON students
FOR EACH ROW EXECUTE FUNCTION update_school_student_count();

-- Función para actualizar enrollment count de programas
CREATE OR REPLACE FUNCTION update_program_enrollment_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE programs
    SET current_enrollment = (
        SELECT COUNT(*)
        FROM enrollments
        WHERE program_id = COALESCE(NEW.program_id, OLD.program_id)
        AND is_active = true
        AND enrollment_status = 'confirmed'
    )
    WHERE id = COALESCE(NEW.program_id, OLD.program_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_program_enrollment_count_trigger
AFTER INSERT OR UPDATE OR DELETE ON enrollments
FOR EACH ROW EXECUTE FUNCTION update_program_enrollment_count();

-- Función para actualizar enrollment count de clases
CREATE OR REPLACE FUNCTION update_class_enrollment_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE classes
    SET current_enrollment = (
        SELECT COUNT(*)
        FROM class_enrollments ce
        JOIN enrollments e ON e.id = ce.enrollment_id
        WHERE ce.class_id = COALESCE(NEW.class_id, OLD.class_id)
        AND e.is_active = true
        AND e.enrollment_status = 'confirmed'
    )
    WHERE id = COALESCE(NEW.class_id, OLD.class_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_class_enrollment_count_trigger
AFTER INSERT OR DELETE ON class_enrollments
FOR EACH ROW EXECUTE FUNCTION update_class_enrollment_count();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE wellness_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Políticas para profiles
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Políticas para schools
CREATE POLICY "Public can view active public schools" ON schools
    FOR SELECT USING (is_active = true AND is_public = true);

CREATE POLICY "School admins can view their school" ON schools
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'school_admin'
            AND profiles.id = schools.admin_id
        )
    );

CREATE POLICY "School admins can update their school" ON schools
    FOR UPDATE USING (admin_id = auth.uid());

-- Políticas para students
CREATE POLICY "School admins can view their students" ON students
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM schools
            WHERE schools.id = students.school_id
            AND schools.admin_id = auth.uid()
        )
    );

CREATE POLICY "Parents can view their children" ON students
    FOR SELECT USING (parent_id = auth.uid());

CREATE POLICY "Coaches can view students in their classes" ON students
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM classes c
            JOIN class_enrollments ce ON ce.class_id = c.id
            JOIN enrollments e ON e.id = ce.enrollment_id
            WHERE e.student_id = students.id
            AND c.coach_id = auth.uid()
        )
    );

-- Políticas para enrollments
CREATE POLICY "School admins can manage enrollments" ON enrollments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM schools
            WHERE schools.id = enrollments.school_id
            AND schools.admin_id = auth.uid()
        )
    );

CREATE POLICY "Parents can view their children's enrollments" ON enrollments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM students
            WHERE students.id = enrollments.student_id
            AND students.parent_id = auth.uid()
        )
    );

-- Políticas para transactions
CREATE POLICY "School admins can view their transactions" ON transactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM schools
            WHERE schools.id = transactions.school_id
            AND schools.admin_id = auth.uid()
        )
    );

CREATE POLICY "Parents can view their children's transactions" ON transactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM students
            WHERE students.id = transactions.student_id
            AND students.parent_id = auth.uid()
        )
    );

-- Políticas para notifications
CREATE POLICY "Users can view their notifications" ON notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their notifications" ON notifications
    FOR UPDATE USING (user_id = auth.uid());

-- Políticas para reviews (públicas)
CREATE POLICY "Anyone can view non-flagged reviews" ON reviews
    FOR SELECT USING (is_flagged = false);

CREATE POLICY "Parents can create reviews" ON reviews
    FOR INSERT WITH CHECK (
        parent_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'parent'
        )
    );

CREATE POLICY "Parents can update their own reviews" ON reviews
    FOR UPDATE USING (parent_id = auth.uid());

-- =====================================================
-- DATOS SEMILLA PARA DEMO (Opcional)
-- =====================================================

-- Puedes descomentar esto para crear datos de demo
/*
-- Crear usuario demo de escuela
INSERT INTO profiles (id, role, full_name, email, onboarding_completed)
VALUES ('00000000-0000-0000-0000-000000000001', 'school_admin', 'Demo Admin', 'demo@sportmaps.com', true);

-- Crear escuela demo
INSERT INTO schools (id, admin_id, name, slug, email, phone, address, city, sports_offered, is_public)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000001',
    'Academia Elite FC',
    'academia-elite-fc',
    'contacto@academiaelite.com',
    '+57 300 1234567',
    'Calle 123 #45-67',
    'Bogotá',
    ARRAY['football']::sport_type[],
    true
);
*/

-- =====================================================
-- ÍNDICES DE RENDIMIENTO ADICIONALES
-- =====================================================

-- Para reportes financieros
CREATE INDEX idx_transactions_date_amount ON transactions(created_at DESC, amount)
WHERE payment_status = 'paid';

-- Para dashboard de asistencia
CREATE INDEX idx_attendance_recent ON attendance_records(school_id, attendance_date DESC)
WHERE attendance_date >= CURRENT_DATE - INTERVAL '30 days';

-- Para búsqueda de estudiantes por nombre
CREATE INDEX idx_students_full_name_trgm ON students
USING GIN ((first_name || ' ' || last_name) gin_trgm_ops);

-- Para próximos pagos (facturación recurrente)
CREATE INDEX idx_enrollments_upcoming_payments ON enrollments(next_payment_date)
WHERE is_active = true AND next_payment_date <= CURRENT_DATE + INTERVAL '7 days';

-- =====================================================
-- COMENTARIOS EN TABLAS Y COLUMNAS
-- =====================================================

COMMENT ON TABLE schools IS 'Escuelas deportivas registradas en la plataforma';
COMMENT ON TABLE students IS 'Estudiantes/atletas inscritos en las escuelas';
COMMENT ON TABLE enrollments IS 'Inscripciones de estudiantes en programas';
COMMENT ON TABLE transactions IS 'Registro de todas las transacciones financieras';
COMMENT ON TABLE manual_payments IS 'Pagos manuales pendientes de verificación administrativa';
COMMENT ON TABLE attendance_records IS 'Registros diarios de asistencia a clases';

-- =====================================================
-- FIN DEL SCHEMA
-- =====================================================
