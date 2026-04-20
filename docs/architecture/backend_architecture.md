# SportMaps — Arquitectura Backend y Base de Datos

> Ultima actualizacion: Abril 2026
> Branch activo: `develop`
> Stack: React + Vite + TypeScript | Express BFF | Supabase (PostgreSQL) | Vercel

---

## Stack Tecnologico

| Capa | Tecnologia |
|------|-----------|
| Frontend | React 18, Vite, TypeScript, TailwindCSS, shadcn/ui |
| BFF (Backend for Frontend) | Express 5, Node.js, pg, Supabase JS |
| Base de Datos | Supabase (PostgreSQL 15 + RLS) |
| Autenticacion | Supabase Auth (JWT) |
| Storage | Supabase Storage (avatares, logos, documentos) |
| Email | Resend (via Edge Function `send-email`) |
| Pagos | Wompi + ePayco (Colombia) |
| Despliegue | Vercel (frontend + BFF) + Supabase Cloud (DB) |

---

## Arquitectura General

```
Cliente (React SPA)
    |
    |-- Supabase Auth (login, register, JWT)
    |-- Supabase Client (consultas directas con RLS)
    |
    └── BFF (Express API)
          |-- /api/v1/* (rutas autenticadas)
          |-- /api/explorar (busqueda publica)
          |-- /api/favoritos (favoritos ligeros)
          |-- /share (OG preview)
          |
          └── Supabase Service Role (operaciones privilegiadas)
                |-- Bypass RLS para operaciones admin
                |-- Bulk operations
                |-- Cross-table joins complejos
```

### Cuando se usa el BFF vs consulta directa

| Caso | Mecanismo |
|------|-----------|
| Consultas simples de lectura | Supabase Client directo (RLS protege) |
| Operaciones multi-tabla (crear alumno + enrollment + pago + invitacion) | BFF |
| Validaciones de negocio complejas | BFF |
| Webhooks de pasarelas de pago | BFF |
| Busqueda publica con filtros avanzados | BFF (`/api/explorar`) |
| Asistencia con deduccion de creditos | BFF |
| Renderizado de templates de mensajes | BFF |

---

## BFF — Estructura de Archivos

```
bff/
  src/
    index.ts                         # App Express, CORS, rate limiting, montaje de rutas
    middlewares/
      authMiddleware.ts              # requireAuth, requireRole, requirePermission, etc.
    routes/
      students.ts                    # GET /api/v1/students, POST /bulk
      students-create-one.route.ts   # POST /api/v1/students/create-one
      enrollments.ts                 # CRUD /api/v1/enrollments
      attendance.ts                  # Sesiones, asistencia, walk-in, finalize
      offerings.ts                   # Ofertas y planes
      session-bookings.ts            # Reservas de sesiones
      school-context.ts              # Modulos y features de escuela
      sport-configs.ts               # Configuracion por deporte
      billing-events.ts              # Eventos de facturacion
      reports.ts                     # Reportes y analitica
      epayco.ts                      # Crear sesion de pago
      epayco-webhook.ts              # Webhook ePayco
      wompi.ts                       # Webhook Wompi
      explorar.routes.ts             # Busqueda publica
      favoritos.routes.ts            # Favoritos
      school-staff.ts                # Staff de escuela
      events.route.ts                # Eventos deportivos
      organizers.route.ts            # Perfil de organizador
      school-delegations.route.ts    # Delegaciones a eventos
      templates.ts                   # Plantillas de mensajes
      polls.ts                       # Encuestas de asistencia
      marketplace.routes.ts          # Busqueda marketplace
      vendor.routes.ts               # Perfil de vendedor
      vendor-products.routes.ts      # Productos del vendedor
      vendor-services.routes.ts      # Servicios del vendedor
      marketplace-orders.routes.ts   # Ordenes de compra
      og-preview.routes.ts           # Meta tags para redes sociales
      system.ts                      # Cleanup y mantenimiento
      trainer/
        profile.ts                   # Perfil de entrenador personal
        onboarding.ts                # Onboarding del trainer
        workspace.ts                 # Workspace del trainer
        clients.ts                   # Clientes del trainer
        routines.ts                  # Rutinas y clases
    utils/
      brandingUtils.ts               # Branding para emails
```

### Montaje de Rutas (index.ts)

| Base Path | Router | Rate Limit |
|-----------|--------|------------|
| `/api/v1/students` | students + students-create-one | General |
| `/api/v1/enrollments` | enrollments | General |
| `/api/v1/attendance` | attendance | General |
| `/api/v1/offerings` | offerings | General |
| `/api/v1/sessions` | session-bookings | General |
| `/api/v1/session-bookings` | session-bookings | General |
| `/api/v1/school/context` | school-context | General |
| `/api/v1/sport-configs` | sport-configs | General |
| `/api/v1/billing-events` | billing-events | General |
| `/api/v1/reports` | reports | General |
| `/api/v1/payments` | epayco | **Payment** (20/min) |
| `/api/v1/webhooks/epayco` | epayco-webhook | Sin limite |
| `/api/v1/webhooks/wompi` | wompi | Sin limite |
| `/api/explorar` | explorar | General |
| `/api/favoritos` | favoritos | General |
| `/api/v1/school-staff` | school-staff | General |
| `/api/v1/events` | events | General |
| `/api/v1/organizer` | organizers | General |
| `/api/v1/school/delegations` | school-delegations | General |
| `/api/v1/templates` | templates | General |
| `/api/v1/polls` | polls | General |
| `/api/v1/marketplace` | marketplace | General |
| `/api/v1/vendor` | vendor | General |
| `/api/v1/vendor/products` | vendor-products | General |
| `/api/v1/vendor/services` | vendor-services | General |
| `/api/v1/marketplace/orders` | marketplace-orders | **Payment** (20/min) |
| `/share` | og-preview | General |
| `/api/v1/trainer` | trainer/* | General |
| `/api/v1/system` | system | General |

### Rate Limiting

| Tipo | Limite |
|------|--------|
| General | 200 requests / 15 minutos |
| Payment | 20 requests / 1 minuto |

---

## Middleware de Autenticacion y Autorizacion

**Archivo:** `bff/src/middlewares/authMiddleware.ts`

### Cadena de Middleware

```
Request
  → CORS (origenes permitidos)
  → Body Parser (JSON, 5MB max)
  → Pino HTTP Logger
  → Rate Limiter
  → Route Handler
      → requireAuth / requireBasicAuth / requireMarketplaceAuth / requireTrainerAuth / optionalAuth
      → requireRole(...)
      → requirePermission(...)
      → requireOwnership(...)
      → Controller Logic
      → auditLog(...)
```

### Tipos de Auth

| Middleware | Uso | Contexto |
|-----------|-----|----------|
| `requireAuth` | Rutas de escuela | Resuelve school_id, branch_id, role desde `school_members` |
| `requireBasicAuth` | Favoritos | Solo valida token, sin contexto de escuela |
| `requireMarketplaceAuth` | Vendor/Marketplace | Lee role desde `profiles` (no school_members) |
| `requireTrainerAuth` | Entrenador personal | Busca workspace en `schools` con `school_type='personal_trainer'` |
| `optionalAuth` | Marketplace publico | No falla sin token. Personaliza si hay usuario logueado |

### Roles y Permisos

| Rol | Permisos Clave |
|-----|---------------|
| `athlete` | dashboard, calendar:view, teams:view, stats:view, marketplace:browse |
| `parent` | + students:view, reports:view, appointments:create |
| `coach` | + calendar:CRUD, teams:create/edit, students:edit, reports:create |
| `school` | + teams:delete, students:CRUD, finances:view/manage |
| `school_admin` | Similar a school (scoped a sede) |
| `organizer` | events:CRUD, finances:view/manage |
| `wellness_professional` | services:CRUD, appointments:manage, health_records |
| `store_owner` | products:CRUD, inventory:manage, orders:manage |
| `staff` | Permisos operativos basicos |
| `reporter` | reports:view (solo lectura) |
| `admin` / `super_admin` / `owner` | **Acceso total** — bypass de requireRole |

---

## Base de Datos — Tablas Principales

### Modulo: Usuarios

#### `profiles`
Extiende `auth.users`. Tabla central de identidad.

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| `id` | uuid PK | = `auth.users.id` |
| `full_name` | text | Nombre completo |
| `email` | text | Email sincronizado desde auth |
| `phone` | text | Telefono |
| `role` | text | athlete, parent, coach, school, organizer, etc. |
| `avatar_url` | text | URL de foto de perfil |
| `bio` | text | Biografia |
| `date_of_birth` | date | Fecha de nacimiento |
| `onboarding_completed` | boolean | Si completo el tour inicial |

### Modulo: Escuelas

#### `schools`
| Columna | Tipo | Descripcion |
|---------|------|-------------|
| `id` | uuid PK | |
| `owner_id` | uuid FK→auth.users | Dueno de la escuela |
| `name` | text | Nombre |
| `slug` | text UNIQUE | Para URL publica |
| `city` | text | Ciudad |
| `lat` / `lng` | numeric | Geolocalizacion |
| `is_verified` | boolean | Verificada por SportMaps |
| `school_type` | text | `school` o `personal_trainer` |
| `status` | text | active, inactive, pending |

#### `school_branches` (Multi-sede)
| Columna | Descripcion |
|---------|-------------|
| `school_id` | FK→schools |
| `name` | Nombre de la sede |
| `address` | Direccion fisica |
| `capacity` | Aforo |
| `is_main` | Sede principal |

#### `school_members` (Pivot de Membresia)
| Columna | Descripcion |
|---------|-------------|
| `school_id` | FK→schools |
| `profile_id` | FK→profiles |
| `branch_id` | FK→school_branches (null = toda la escuela) |
| `role` | owner, admin, coach, athlete, parent, staff |
| `status` | active, inactive, pending |

#### `school_staff`
| Columna | Descripcion |
|---------|-------------|
| `school_id` | FK→schools |
| `full_name` | Nombre |
| `email` | Email |
| `specialty` | Especialidad |
| `branch_id` | Sede asignada |
| `coach_auth_id` | FK→auth.users (sync automatico) |

#### `school_settings`
Configuracion de la escuela: modulos activos, SportMaps Pay, etc.

### Modulo: Equipos y Ofertas

#### `teams`
| Columna | Descripcion |
|---------|-------------|
| `school_id` | FK→schools |
| `branch_id` | FK→school_branches |
| `name` | Nombre del equipo |
| `sport` | Deporte |

#### `offerings`
| Columna | Descripcion |
|---------|-------------|
| `school_id` | FK→schools |
| `name` | Nombre de la oferta |
| `offering_type` | membership, session_pack, court_booking, tournament, single_session |
| `sport` | Deporte |
| `is_active` | Estado |

#### `offering_plans`
| Columna | Descripcion |
|---------|-------------|
| `offering_id` | FK→offerings |
| `name` | Nombre del plan |
| `max_sessions` | Sesiones incluidas |
| `max_secondary_sessions` | Sesiones secundarias |
| `duration_days` | Duracion en dias |
| `price` | Precio |
| `auto_renew` | Renovacion automatica |

#### `enrollments`
| Columna | Descripcion |
|---------|-------------|
| `user_id` / `child_id` / `unregistered_athlete_id` | Atleta inscrito (uno de tres) |
| `team_id` | FK→teams |
| `offering_plan_id` | FK→offering_plans |
| `school_id` | FK→schools |
| `status` | active, cancelled, pending |
| `start_date` / `end_date` | Periodo |

### Modulo: Hijos y Atletas

#### `children`
| Columna | Descripcion |
|---------|-------------|
| `parent_id` | FK→auth.users |
| `school_id` | FK→schools |
| `full_name` | Nombre |
| `date_of_birth` | Fecha de nacimiento |
| `doc_number` / `doc_type` | Documento de identidad |
| `medical_info` | Informacion medica |

#### `unregistered_athletes`
Atletas temporales antes de que se registren en la plataforma.

### Modulo: Asistencia

#### `attendance_sessions`
| Columna | Descripcion |
|---------|-------------|
| `team_id` | FK→teams |
| `session_date` | Fecha |
| `finalized` | Si esta cerrada |
| `created_by` | FK→auth.users |

#### `attendance_records`
| Columna | Descripcion |
|---------|-------------|
| `session_id` | FK→attendance_sessions |
| `child_id` / `user_id` / `unregistered_athlete_id` | Atleta |
| `status` | present, absent, late, excused |

#### `session_bookings`
Reservas de sesiones en ofertas con capacidad limitada.

### Modulo: Pagos

#### `payments`
| Columna | Descripcion |
|---------|-------------|
| `school_id` | FK→schools |
| `parent_id` / `user_id` | Quien paga |
| `child_id` | Hijo (si aplica) |
| `enrollment_id` | FK→enrollments |
| `amount` | Monto |
| `status` | pending, paid, overdue, cancelled |
| `due_date` | Fecha limite |
| `payment_method` | Manual, Wompi, ePayco |

#### `billing_events`
Eventos detallados de facturacion (cargos, pagos parciales, reembolsos, recargos).

### Modulo: Eventos Deportivos

#### `events`
| Columna | Descripcion |
|---------|-------------|
| `organizer_id` | FK→event_organizers |
| `title` | Titulo |
| `sport` | Deporte |
| `event_date` | Fecha |
| `city` | Ciudad |
| `status` | draft, published, cancelled, completed |
| `visibility` | public, private |

#### `event_organizers`
Perfil de organizador: organization_name, nit, is_verified, etc.

#### `event_delegations`
Delegaciones de escuelas a eventos.

#### `event_teams` / `event_team_members`
Equipos y atletas dentro de delegaciones.

### Modulo: Marketplace

#### `vendor_profiles`
Perfil de vendedor: display_name, city, nit, vendor_type.

#### `products` / `product_variants`
Productos con variantes (talla, color, etc).

#### `service_listings` / `service_variations`
Servicios ofrecidos con variaciones.

### Modulo: Trainer (Entrenador Personal)

#### `trainer_profiles`
Perfil publico del entrenador: especialidades, tarifas, certificaciones, galeria.

Usa `schools` con `school_type = 'personal_trainer'` como workspace.

---

## Funciones PostgreSQL (RPC)

| Funcion | Descripcion |
|---------|-------------|
| `handle_new_user()` | Trigger en auth.users INSERT. Crea profile con rol de raw_user_meta_data |
| `user_school_ids()` | Retorna array de school_ids donde el usuario tiene membresia activa. Usada en RLS |
| `search_marketplace()` | Busqueda unificada de productos y servicios |
| `accept_invitation()` | SECURITY DEFINER. Acepta invitacion y crea school_member |

---

## Seguridad (Row Level Security)

**RLS activado en todas las tablas de datos.**

### Patron por tipo

| Tipo de tabla | Patron RLS |
|--------------|-----------|
| Escolar (children, payments, enrollments) | `school_id IN user_school_ids() OR parent_id = auth.uid()` |
| Personal (carts, notifications) | `user_id = auth.uid()` |
| Publica (events publicados, marketplace) | `SELECT` abierto, `INSERT/UPDATE/DELETE` restringido |

### Headers de seguridad del BFF

```
Cache-Control: no-store
Pragma: no-cache
Expires: 0
```

Previene cache de datos sensibles en proxies y navegadores.

---

## Flujo de Onboarding

```
Registro → auth.users INSERT
     ↓
Trigger handle_new_user() → crea profile con onboarding_completed = FALSE
     ↓
ProtectedRoute detecta onboarding_completed === false
     ↓
Redirige segun role:
  school    → /setup/school (wizard guiado)
  coach     → /coach-onboarding
  parent    → /parent-onboarding
  athlete   → /athlete-onboarding
  organizer → /organizer/onboarding
     ↓
Usuario completa onboarding
     ↓
updateProfile({ onboarding_completed: true })
     ↓
Dashboard del rol correspondiente
```

---

## Documentacion Relacionada

- **API completa de endpoints:** [`api_specifications.md`](./api_specifications.md)
- **Seguridad y RBAC:** [`security.md`](./security.md)
- **Arquitectura frontend:** [`frontend_architecture.md`](./frontend_architecture.md)
- **Credenciales demo:** [`../guides/DEMO_CREDENTIALS.md`](../guides/DEMO_CREDENTIALS.md)

---

*SportMaps Demo — Abril 2026*
