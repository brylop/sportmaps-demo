# SportMaps — Arquitectura de Base de Datos y Estado del MVP

> **Última actualización:** 2026-02-18
> **Branch activo:** `develop`
> **Stack:** React + Vite + TypeScript · Supabase (PostgreSQL) · Vercel

---

## 📦 Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **Frontend** | React 18, Vite, TypeScript, TailwindCSS, shadcn/ui |
| **Estado Global** | React Context API + TanStack React Query |
| **Routing** | React Router DOM v6 |
| **Backend / DB** | Supabase (PostgreSQL 15 + RLS) |
| **Autenticación** | Supabase Auth (JWT) |
| **Storage** | Supabase Storage (avatares, logos) |
| **Despliegue** | Vercel (frontend) + Supabase Cloud (DB) |

---

## 🗄️ Arquitectura de Base de Datos

### Diagrama General

```
auth.users
    └── profiles (role ENUM, onboarding_completed, sportmaps_points)
            │
            ├── [school] ──→ schools
            │                  ├── school_branches (N sedes)
            │                  │     └── facilities → facility_reservations
            │                  ├── school_members (pivot: profiles ↔ escuela ↔ sede)
            │                  ├── school_staff   (coaches con branch_id)
            │                  ├── invitations
            │                  ├── programs → enrollments
            │                  └── teams
            │                        ├── training_sessions → session_attendance
            │                        └── training_plans
            │
            ├── [coach] ──→ school_staff / school_members
            │                  └── → attendance_records, evaluations, announcements
            │
            ├── [parent] ──→ children
            │                  ├── → schools, school_branches, teams, programs
            │                  ├── academic_progress
            │                  └── payments (child_id, parent_id, school_id)
            │
            ├── [athlete] ──→ enrollments, athlete_stats, training_logs
            │                   └── health_records, wellness_appointments
            │
            └── [wellness_professional] ──→ wellness_appointments, health_records
```

---

## 📋 Tablas del Esquema

### 🔐 MÓDULO: USUARIOS

#### `profiles`
Extiende `auth.users`. Tabla central de identidad.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `uuid` PK | = `auth.users.id` |
| `full_name` | `text` | Nombre completo |
| `email` | `text` | Email sincronizado desde auth |
| `phone` | `text` | Teléfono |
| `role` | `ENUM` | `athlete \| parent \| coach \| school \| wellness_professional \| store_owner \| admin \| organizer` |
| `avatar_url` | `text` | URL de foto de perfil |
| `bio` | `text` | Biografía |
| `date_of_birth` | `date` | Fecha de nacimiento |
| `sportmaps_points` | `int` | Puntos de gamificación |
| `subscription_tier` | `ENUM` | `free \| basic \| premium` |
| `invitation_code` | `text` | Código único de invitación |
| `onboarding_completed` | `boolean` | ✅ Si completó el tour inicial |
| `created_at` | `timestamptz` | — |
| `updated_at` | `timestamptz` | — |

---

### 🏫 MÓDULO: ESCUELAS

#### `schools`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `uuid` PK | — |
| `owner_id` | `uuid` FK→`auth.users` | Dueño de la escuela |
| `name` | `text` | Nombre de la escuela |
| `slug` | `text` UNIQUE | Para URL pública `/s/:slug` |
| `description` | `text` | Descripción |
| `sport_types` | `text[]` | Deportes que ofrece |
| `city` | `text` | Ciudad |
| `lat` / `lng` | `numeric` | Geolocalización |
| `logo_url` | `text` | Logo |
| `cover_url` | `text` | Foto de portada |
| `is_verified` | `boolean` | Verificada por SportMaps |
| `is_demo` | `boolean` | Escuela de demostración |
| `status` | `text` | `active \| inactive \| pending` |

#### `school_branches` _(Multi-sede)_

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `uuid` PK | — |
| `school_id` | `uuid` FK→`schools` ON DELETE CASCADE | — |
| `name` | `text` | Ej: "Sede Norte", "Sede Fontibón" |
| `address` | `text` | Dirección física |
| `city` | `text` | Ciudad |
| `lat` / `lng` | `numeric` | Geolocalización |
| `is_main` | `boolean` | Sede principal |
| `capacity` | `int` | Aforo |
| `status` | `text` | `active \| inactive \| maintenance` |

#### `school_members` _(Tabla Pivot de Membresía)_

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `uuid` PK | — |
| `school_id` | `uuid` FK→`schools` | — |
| `profile_id` | `uuid` FK→`profiles` | — |
| `branch_id` | `uuid` FK→`school_branches` | `NULL` = acceso a toda la escuela |
| `role` | `text` | `owner \| admin \| coach \| athlete \| parent` |
| `status` | `text` | `active \| inactive \| pending` |

#### `school_staff`

| Columna | Descripción |
|---------|-------------|
| `profile_id` | Coach o admin |
| `school_id` | A qué escuela pertenece |
| `branch_id` | A qué sede está asignado (nullable) |
| `role` | `coach \| admin \| assistant` |

#### `invitations`

| Columna | Descripción |
|---------|-------------|
| `code` | Código único |
| `school_id` | Escuela que invita |
| `role` | Rol al que se invita |
| `email` | Email del invitado |
| `status` | `pending \| accepted \| expired` |

---

### 🏃 MÓDULO: PROGRAMAS Y EQUIPOS

#### `programs`

| Columna | Descripción |
|---------|-------------|
| `school_id` | Escuela dueña |
| `name` | Nombre del programa |
| `sport` | Deporte |
| `description` | Descripción |
| `price` | Mensualidad |
| `capacity` | Cupos máximos |
| `schedule` | `JSONB` con días/horarios |
| `coach_id` | Entrenador asignado |

#### `enrollments`

| Columna | Descripción |
|---------|-------------|
| `profile_id` | FK→`profiles` (atleta) |
| `program_id` | FK→`programs` |
| `status` | `active \| cancelled \| pending` |
| `enrolled_at` | Fecha de inscripción |

#### `teams`

| Columna | Descripción |
|---------|-------------|
| `school_id` | FK→`schools` |
| `branch_id` | FK→`school_branches` |
| `name` | Nombre del equipo |
| `sport` | Deporte |
| `coach_id` | Entrenador principal |

#### `training_sessions` + `session_attendance`

```
training_sessions (team_id, date, duration)
    └── session_attendance (session_id, player_id, status: present|absent|late)
```

#### `training_plans` · `training_logs` · `athlete_stats`

Módulos de rendimiento deportivo individual y por equipo.

---

### 👨‍👩‍👧 MÓDULO: PADRES E HIJOS

#### `children`

| Columna | Descripción |
|---------|-------------|
| `parent_id` | FK→`auth.users` |
| `school_id` | FK→`schools` |
| `branch_id` | FK→`school_branches` |
| `team_id` | FK→`teams` |
| `program_id` | FK→`programs` |
| `full_name` | Nombre del hijo |
| `date_of_birth` | — |
| `monthly_fee` | Mensualidad individual |

#### `academic_progress`

| Columna | Descripción |
|---------|-------------|
| `child_id` | FK→`children` |
| `coach_id` | FK→`auth.users` |
| `subject` | Materia o habilidad evaluada |
| `score` | Calificación |
| `period` | Período escolar |

---

### 💰 MÓDULO: PAGOS

#### `payments`

| Columna | Descripción |
|---------|-------------|
| `school_id` | FK→`schools` |
| `parent_id` | FK→`auth.users` |
| `child_id` | FK→`children` |
| `program_id` | FK→`programs` (nullable) |
| `amount` | Monto |
| `status` | `pending \| paid \| overdue \| cancelled` |
| `due_date` | Fecha límite |
| `payment_method` | `cash \| transfer \| card \| online` |
| `payment_date` | Fecha de pago efectivo |

#### `cart`

| Columna | Descripción |
|---------|-------------|
| `user_id` | FK→`auth.users` |
| `items` | `JSONB` con productos/programas |

---

### 🏥 MÓDULO: WELLNESS

#### `wellness_appointments`

```
professional_id (FK→auth.users)  ←→  athlete_id (FK→profiles)
```

#### `health_records`

```
athlete_id  ←→  professional_id
Contiene: diagnóstico, observaciones, fecha
```

---

### 🎪 MÓDULO: INSTALACIONES

#### `facilities`

| Columna | Descripción |
|---------|-------------|
| `school_id` | FK→`schools` |
| `branch_id` | FK→`school_branches` |
| `name` | Nombre (cancha, piscina...) |
| `type` | `court \| pool \| gym \| field` |
| `capacity` | Aforo |
| `price_per_hour` | Precio por hora |
| `is_available` | Disponibilidad |

#### `facility_reservations`

```
facility_id ↔ user_id ↔ team_id (opcional)
Con: date, start_time, end_time, status, participants
```

---

### 🎫 MÓDULO: EVENTOS (Organizer)

| Tabla | Descripción |
|-------|-------------|
| `events` | Evento público con `slug`, `sport`, `lat/lng`, `date` |
| `event_registrations` | Inscripciones al evento |

---

## 🔧 Funciones PostgreSQL (RPC)

| Función | Descripción |
|---------|-------------|
| `handle_new_user()` | **Trigger** en `auth.users → INSERT`. Crea el `profile` automáticamente con el rol del `raw_user_meta_data`. Fallback inteligente a `athlete`. |
| `complete_onboarding()` | `SECURITY DEFINER`. Actualiza `onboarding_completed = TRUE` para `auth.uid()`. |
| `is_branch_admin(user_id, branch_id)` | Verifica si un usuario es admin de una sede específica. Usada en RLS policies. |

---

## 🛡️ Seguridad (Row Level Security)

**RLS activado en:** `profiles`, `schools`, `school_branches`, `school_members`, `school_staff`, `payments`, `facilities`, `facility_reservations`, `children`, `programs`, `enrollments`, `invitations`, `events`.

**Políticas clave:**
- `profiles`: cada usuario solo ve/edita su propio perfil.
- `schools`: solo el `owner_id` puede hacer `UPDATE/DELETE`.
- `payments`: la escuela ve todos sus pagos; el padre solo ve los propios.
- `school_branches`: lectura pública; escritura solo para el owner de la escuela.
- `children`: solo el `parent_id` puede ver/editar.

---

## ⚡ Índices de Performance

```sql
-- Compuestos para dashboards
idx_payments_school_status_date  (school_id, status, due_date)
idx_attendance_records_composite (school_id, student_id, date)
idx_classes_school_schedule      (school_id, day_of_week, start_time)
idx_school_members_composite     (school_id, profile_id, status)

-- Búsqueda de texto fuzzy
idx_schools_name_trgm  USING GIN (name gin_trgm_ops) -- pg_trgm
idx_programs_schedule_gin        USING GIN (schedule)

-- FKs frecuentes
idx_children_parent_id / school_id / team_id / branch_id
idx_payments_child_id / parent_id / school_id
idx_teams_school_id / branch_id
```

---

## 📱 Estado del MVP — Frontend

### Páginas Implementadas (78 total)

#### ✅ Autenticación y Onboarding
| Página | Estado |
|--------|--------|
| `/login` | ✅ |
| `/register` | ✅ |
| `/school-onboarding` | ✅ Pasos guiados con progress bar |
| `/coach-onboarding` | ✅ Info + botón de confirmación |
| `/athlete-onboarding` | ✅ Info + acciones rápidas |
| `/parent-onboarding` | ✅ Hijos + Pagos + Calendario |
| `/wellness-onboarding` | ✅ |
| `/store-onboarding` | ✅ |
| `/organizer-onboarding` | ✅ |

#### ✅ Panel Escuela (Dueño)
| Página | Ruta |
|--------|------|
| Dashboard | `/dashboard` |
| Gestión de Sedes | `/branches` |
| Estudiantes | `/students` |
| Staff / Coaches | `/staff` |
| Programas | `/programs-management` |
| Instalaciones | `/facilities` |
| Finanzas | `/finances` |
| Pagos y Automatización | `/payments-automation` |
| Recordatorios de Pago | `/payment-reminders` |
| Asistencia (supervisión) | `/attendance-supervision` |
| Resultados globales | `/results-overview` |
| Reportes | `/school-reports` |
| Configuración | `/school-config` |
| Control de Pickup | `/pickup` |

#### ✅ Panel Coach
| Página | Ruta |
|--------|------|
| Toma de Asistencia | `/coach-attendance` |
| Evaluaciones | `/evaluations` |
| Planes de Entrenamiento | `/training-plans` |
| Resultados | `/results` |
| Reportes | `/coach-reports` |
| Anuncios | `/announcements` |

#### ✅ Panel Padre
| Página | Ruta |
|--------|------|
| Mis Hijos | `/children` |
| Progreso del Hijo | `/children/:id/progress` |
| Asistencia del Hijo | `/children/:id/attendance` |
| Mis Pagos | `/my-payments` |
| Progreso Académico | `/academic-progress` |
| Checkout para Padre | `/parent-checkout` |

#### ✅ Panel Atleta
| Página | Ruta |
|--------|------|
| Inscripciones | `/enrollments` |
| Estadísticas | `/stats` |
| Objetivos | `/goals` |
| Entrenamiento | `/training` |
| Wellness personal | `/wellness` |
| Tienda | `/shop` |

#### ✅ Módulos Compartidos
| Página | Ruta |
|--------|------|
| Calendario | `/calendar` |
| Mensajes | `/messages` |
| Notificaciones | `/notifications` |
| Perfil | `/profile` |
| Configuración | `/settings` |
| Explorar Escuelas | `/explore` |
| Página Pública Escuela | `/s/:slug` |
| Mapa de Eventos | `/events` |
| Evento Público | `/event/:slug` |

---

## 🔄 Flujo de Onboarding (Implementado)

```
Registro → auth.users INSERT
     ↓
Trigger handle_new_user() → crea profiles con onboarding_completed = FALSE
     ↓
ProtectedRoute detecta onboarding_completed === false
     ↓
Redirige según role:
  school  → /school-onboarding  (pasos guiados)
  coach   → /coach-onboarding   (info + confirmar)
  parent  → /parent-onboarding  (hijos + pagos)
  athlete → /athlete-onboarding (explorar + reservar)
     ↓
Usuario hace clic en cualquier acción
     ↓
updateProfile({ onboarding_completed: true }) → DB actualizada
     ↓
Navega a la ruta destino → ProtectedRoute permite el paso
     ↓
Dashboard / Módulo solicitado ✅
```

---

## ⚠️ Deuda Técnica y Pendientes

| Item | Prioridad | Estado |
|------|-----------|--------|
| Aplicar migración `add_onboarding_tracking.sql` en Supabase Cloud | 🔴 Alta | Pendiente manual |
| Lint error: `payment_settings` en `ParentCheckoutPage` | 🟡 Media | Pendiente |
| Lint error: `activeTeams` en `DashboardPage` | 🟡 Media | Pendiente |
| Tests E2E del flujo de onboarding | 🔴 Alta | Sin implementar |
| Real-time notifications (Supabase Realtime) | 🟢 Baja | Sin implementar |
| Push notifications móviles | 🟢 Baja | Sin implementar |

---

## 📁 Estructura de Archivos Clave

```
frontend/
├── src/
│   ├── contexts/
│   │   ├── AuthContext.tsx        # Sesión, perfil, updateProfile
│   │   └── SchoolContext.tsx      # Escuela activa, rol, onboardingStatus
│   ├── components/
│   │   └── ProtectedRoute.tsx     # Guard de rutas + check de onboarding
│   ├── hooks/
│   │   ├── useSchoolContext.ts    # Lógica de resolución de escuela/rol
│   │   └── useDashboardStatsReal.ts
│   └── pages/                    # 78 páginas (ver listado arriba)
└── supabase/
    ├── migrations/
    │   └── 20260218120000_add_onboarding_tracking.sql  # ⚠️ Aplicar en Cloud
    └── OPTIMIZE_DATABASE.sql     # Índices de performance
```

---

*Generado por Antigravity AI · SportMaps Demo · 2026-02-18*
