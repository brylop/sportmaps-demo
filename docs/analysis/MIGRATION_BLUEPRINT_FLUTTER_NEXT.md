# Informe de Migración y Arquitectura: SportMaps MVP -> Producción (Flutter + Next.js + PostgreSQL)

Este documento detalla los flujos actuales implementados en el MVP (React + Supabase) y especifica los requerimientos técnicos para migrar a una arquitectura escalable basada en Flutter (Móvil), Next.js (Web/Backend API) y PostgreSQL gestionado.

---

## 1. Arquitectura de Datos (PostgreSQL)

El núcleo del sistema es la base de datos relacional. La estructura actual en Supabase debe migrarse preservando las relaciones multi-tenant.

### Tablas Principales (Core)
*   **`profiles`**: Usuarios del sistema (Padres, Admin Escuela, Staff).
    *   *Migración*: Extender `auth.users` o mantener tabla separada vinculada por UUID. Añadir roles (`role: 'school_admin' | 'parent' | 'superadmin'`).
*   **`schools`**: Entidades principales (Tenants).
    *   Campos: `id`, `name`, `slug`, `branding_colors`, `logo_url`, `onboarding_status`.
*   **`school_branches`**: Sedes de una escuela.
    *   Campos: `school_id`, `name`, `address`, `geo_location`.
*   **`programs`**: Oferta académica (Clases, Entrenamientos).
    *   Campos: `school_id`, `branch_id`, `name`, `sport`, `schedule` (JSON/Array), `price_monthly`, `capacity`.
*   **`children` / `athletes`**: Estudiantes.
    *   Campos: `parent_id` (Opcional/Nullable para pre-registro), `school_id` (Tenant), `full_name`, `date_of_birth`, `medical_info`.
    *   *Nuevo*: `parent_email_temp` (Para invitaciones pendientes).
*   **`enrollments`**: Vinculación Estudiante-Programa.
    *   Campos: `child_id`, `program_id`, `status` ('active', 'pending', 'cancelled'), `start_date`.
*   **`payments`**: Registro financiero.
    *   Campos: `school_id`, `payer_id` (Parent), `amount`, `status` ('paid', 'pending', 'overdue', 'rejected'), `method` ('card', 'manual', 'cash'), `proof_url`.

### Consideraciones de Migración
-   **Multi-tenancy**: Asegurar que TODAS las consultas a la API (Next.js) filtren obligatoriamente por `school_id`.
-   **Row Level Security (RLS)**: Si se usa Supabase Auth con Next.js, mantener las policies. Si se implementa un backend custom, replicar la lógica en middleware/servicios.

---

## 2. Flujos Funcionales Detallados

A continuación, los flujos de usuario que deben replicarse en Flutter (App Padres) y Next.js (Dashboard Administrativo).

### A. Gestión de Estudiantes e Invitaciones (Web Admin)
*Actor: Administrador de Escuela*
1.  **Carga Manual**:
    *   Formulario: Datos básicos del estudiante + Email del padre.
    *   *Backend*: Crea registro en `children`. Si el padre no existe (por email), guarda `parent_email_temp`.
    *   *Acción*: Envía correo de invitación con Link de Registro.
2.  **Carga Masiva (CSV)**:
    *   *Proceso*: Admin sube CSV. Frontend parsea y valida.
    *   *Backend*: Itera y crea registros `children` y `payments` (deuda inicial pendiente).
    *   *Acción*: Dispara correos de invitación masivos (Job queue recomendado en Prod).

### B. Registro de Padre y Vinculación (Web & Móvil)
*Actor: Padre de Familia*
1.  **Registro (Sign Up)**:
    *   Usuario crea cuenta con Email/Password o Google Auth.
2.  **Onboarding / Vinculación**:
    *   Al confirmar email, el sistema busca en `children` coincidencias por `parent_email_temp` (o `invitations` table).
    *   *Acción*: Asocia automáticamente los hijos encontrados al nuevo `user_id` del padre.
    *   *Resultado*: El padre entra al Dashboard y ya ve a sus hijos precargados.

### C. Inscripción y Checkout (Web & Móvil)
*Actor: Padre de Familia*
1.  **Exploración**: Busca escuelas/programas (Mapas, Filtros).
2.  **Selección**: Elige un programa.
3.  **Checkout**:
    *   *Selección de Hijo*: Elige un hijo existente o crea uno nuevo ("A quién inscribes?").
    *   *Pago*:
        *   **Online**: Pasarela (Stripe/Wompi). Webhook actualiza `payments.status = 'paid'` y `enrollments.status = 'active'`.
        *   **Manual/Transferencia**: Sube foto comprobante. Crea `payments.status = 'pending'`.
4.  **Confirmación**: Recibe correo. Si es manual, espera aprobación.

### D. Validación de Pagos (Web Admin)
*Actor: Tesorero / Admin Escuela*
1.  **Bandeja de Entrada**: Vista de pagos con estado `pending`.
2.  **Revisión**: Ver foto del comprobante vs Monto/Concepto.
3.  **Acción**:
    *   *Aprobar*: Actualiza pago a `paid`. Activa inscripción (`enrollments.status = 'active'`). Envía email confirmación.
    *   *Rechazar*: Marca como `rejected`. Envía notificación solicitando corrección.

### E. Recordatorios de Cobro (Automático/Manual)
1.  **Job Recurrente**: Detecta pagos vencidos (`due_date < now()` y `status != 'paid'`).
2.  **Acción Manual (Admin)**: Selecciona deudores y da clic en "Enviar Recordatorio".
3.  **Notificación**: Email + Push Notification (Flutter) al padre con link de pago.

---

## 3. Especificaciones Técnicas y SQL para Migración

### Mejoras Críticas para Producción (Vs MVP Actual)

1.  **Tabla de Invitaciones (`invitations`)**:
    *   *MVP*: Usa `parent_email_temp` en `children`.
    *   *Producción*: Usar tabla separada `invitations`. Permite múltiples intentos, expiración de tokens, y vinculación segura sin ensuciar la tabla de estudiantes.
2.  **Auditoría de Pagos**:
    *   *MVP*: Solo estado `approved`.
    *   *Producción*: Añadir `reviewed_by` (UUID Admin) y `reviewed_at` (Timestamp) en la tabla `payments` para trazabilidad financiera.
3.  **Aislamiento Multi-tenant**:
    *   *Backend Custom*: Implementar Middleware que inyecte `school_id` en cada consulta automáticamente, evitando fugas de datos.

### Script SQL Inicial (PostgreSQL Production-Ready)

Este DDL consolida la estructura ideal para la migración:

```sql
-- 1. EXTENSIÓN PARA UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUMS
CREATE TYPE user_role AS ENUM ('superadmin', 'school_admin', 'staff', 'parent');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'overdue', 'rejected');
CREATE TYPE payment_method AS ENUM ('card', 'manual', 'cash', 'transfer');
CREATE TYPE enrollment_status AS ENUM ('active', 'pending', 'cancelled', 'waitlist');

-- 3. TABLA DE USUARIOS (Profiles)
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Vinculado a Auth Provider (Firebase/Supabase Auth UUID)
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(150),
    role user_role DEFAULT 'parent',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. ESCUELAS (Tenants)
CREATE TABLE schools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    logo_url TEXT,
    branding_colors JSONB DEFAULT '{"primary": "#000000", "secondary": "#ffffff"}',
    onboarding_status BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. SEDES (Branches)
CREATE TABLE school_branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    address TEXT,
    geo_location POINT,
    is_active BOOLEAN DEFAULT TRUE
);

-- 6. PROGRAMAS
CREATE TABLE programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES school_branches(id),
    name VARCHAR(100) NOT NULL,
    sport VARCHAR(50),
    schedule JSONB NOT NULL,
    price_monthly DECIMAL(10, 2) NOT NULL,
    capacity INT DEFAULT 20,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. ESTUDIANTES / ATHLETES
CREATE TABLE children (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    full_name VARCHAR(150) NOT NULL,
    date_of_birth DATE,
    medical_info TEXT,
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7.1 TABLA DE INVITACIONES (MEJORA PROPUESTA)
CREATE TABLE invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    child_id UUID REFERENCES children(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    token UUID DEFAULT uuid_generate_v4(),
    status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, expired
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. INSCRIPCIONES (Enrollments)
CREATE TABLE enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    child_id UUID REFERENCES children(id) ON DELETE CASCADE,
    program_id UUID REFERENCES programs(id) ON DELETE RESTRICT,
    status enrollment_status DEFAULT 'pending',
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    notes TEXT,
    UNIQUE(child_id, program_id, status)
);

-- 9. PAGOS
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    payer_id UUID REFERENCES profiles(id),
    enrollment_id UUID REFERENCES enrollments(id),
    amount DECIMAL(10, 2) NOT NULL,
    status payment_status DEFAULT 'pending',
    method payment_method DEFAULT 'manual',
    proof_url TEXT,
    transaction_ref VARCHAR(100),
    due_date DATE,
    reviewed_by UUID REFERENCES profiles(id), -- Auditoría
    reviewed_at TIMESTAMP WITH TIME ZONE,     -- Auditoría
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ÍNDICES PARA RENDIMIENTO (Multi-tenancy obligatorio)
CREATE INDEX idx_children_school ON children(school_id);
CREATE INDEX idx_payments_school ON payments(school_id);
CREATE INDEX idx_enrollments_child ON enrollments(child_id);
CREATE INDEX idx_invitations_email ON invitations(email);
```

### Frontend Web (Next.js - Admin & Landing)
*   **Tecnología**: Next.js 14+ (App Router).
*   **UI Library**: Shadcn/UI + TailwindCSS (Ya implementado, reutilizable).
*   **State Management**: React Query (TanStack Query) para data server-side.
*   **Rutas Clave**:
    *   `/dashboard/school/[schoolId]`: Layout principal administrativo.
    *   `/dashboard/students`: Tabla con filtros, acciones masivas, modal importe.
    *   `/dashboard/finance`: Bandeja de validación de pagos.
    *   `/dashboard/settings`: Configuración de sede y branding.

### App Móvil (Flutter - Padres)
*   **Enfoque**: Experiencia nativa para padres.
 *   **Pantallas Clave**: 
    *   `HomeScreen`: Resumen (Hijos, Próximas Clases, Pagos Pendientes).
    *   `ChildProfileScreen`: Progreso, Asistencia, QR de acceso.
    *   `ExplorerScreen`: Mapa de escuelas (Google Maps/Mapbox).
    *   `PaymentsScreen`: Historial y botón de pago rápido.
*   **Servicios**:
    *   `AuthService`: Login, Token management.
    *   `NotificationService`: Firebase Cloud Messaging (Push).
    *   `LocationService`: Para Check-in/Check-out en sedes.

### Backend API (Next.js API Routes o NestJS)
*   **Endpoints requeridos**:
    *   `POST /api/auth/register`: Registro usuario y vinculación automática.
    *   `POST /api/students/import`: Procesamiento de CSV (Streaming si es grande).
    *   `GET /api/payments/pending`: Para validación admin.
    *   `POST /api/payments/approve`: Lógica transaccional (Update Payment + Update Enrollment + Send Email).
    *   `POST /api/notifications/remind`: Envío de recordatorios.

---

## 4. Próximos Pasos Sugeridos

1.  **Configurar Repositorio Monorepo** (opcional pero recomendado):
    *   `apps/web` (Next.js Dashboard)
    *   `apps/mobile` (Flutter)
    *   `packages/shared` (Tipos TS, lógica compartida).
2.  **Migrar Base de Datos**: Exportar Schema Supabase -> SQL depurado para instancia Postgres AWS/Render/Railway.
3.  **Desarrollo de API**: Extraer la lógica de los `hooks` actuales (`useSchoolContext`, `createStudent...`) hacia controladores de API seguros.
4.  **Implementación Flutter**: Comenzar con Auth y `HomeScreen` consumiendo la nueva API.
