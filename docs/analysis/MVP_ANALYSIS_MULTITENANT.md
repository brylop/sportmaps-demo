# 🏗️ ANÁLISIS COMPLETO: Demo → MVP Multitenant Escalable

**Fecha:** 2026-02-16  
**Proyecto:** SportMaps  
**Stack Actual:** React + TypeScript + Vite (Frontend) | FastAPI + MongoDB (Backend) | Supabase (Auth + DB)  
**Objetivo:** Convertir la demo actual en un MVP Production-Ready, Multitenant y Escalable

---

## 📊 RESUMEN EJECUTIVO

### Estado Actual del Proyecto

| Área | Demo | MVP Requerido | Gap |
|------|------|--------------|-----|
| **Frontend (UI/UX)** | 85% | 70% | ✅ Bien |
| **Backend APIs** | 15% | 80% | 🔴 CRÍTICO |
| **Base de Datos** | 25% | 90% | 🔴 CRÍTICO |
| **Multitenancy** | 0% | 100% | 🔴 CRÍTICO |
| **Seguridad (RLS)** | 10% | 95% | 🔴 CRÍTICO |
| **Testing** | 5% | 60% | 🟡 IMPORTANTE |
| **CI/CD** | 20% | 80% | 🟡 IMPORTANTE |
| **Escalabilidad** | 10% | 70% | 🟡 IMPORTANTE |

### Veredicto
> **La demo tiene un frontend excelente pero un backend casi inexistente. La arquitectura actual NO soporta multitenancy. Hay inconsistencia grave entre los 3 esquemas de base de datos que coexisten. El MVP requiere una refactorización profunda del backend y una consolidación del esquema de datos.**

---

## 🔴 PROBLEMAS CRÍTICOS (URGENCIAS INMEDIATAS)

### 1. 🗄️ TRES ESQUEMAS DE BASE DE DATOS INCONSISTENTES

**Este es el problema #1 del proyecto.** Existen 3 fuentes de verdad para la base de datos que NO coinciden entre sí:

| Archivo | Ubicación | Propósito | Problema |
|---------|-----------|-----------|----------|
| `database_schema.sql` | Raíz del proyecto | Esquema "ideal" para MVP | **NUNCA se ejecutó en Supabase** |
| `remote_schema.sql` | `frontend/` | Esquema REAL en Supabase | **Estructura diferente al ideal** |
| `types.ts` | `frontend/src/integrations/supabase/` | Tipos generados de Supabase | **Debe coincidir con remote_schema** |

**Ejemplos de inconsistencias graves:**

```
database_schema.sql          vs    remote_schema.sql (REAL)
─────────────────────────────────────────────────────────────
students (tabla dedicada)    →     children (tabla genérica)
schools.admin_id             →     schools.owner_id
programs.monthly_fee         →     programs.price_monthly
programs.sport_type (ENUM)   →     programs.sport (TEXT)
enrollments.school_id        →     NO EXISTE
enrollments.student_id       →     enrollments.user_id
profiles.role (5 valores)    →     profiles.role (8 valores)
attendance_records           →     attendance (diferente estructura)
transactions                 →     NO EXISTE
manual_payments              →     NO EXISTE
wellness_reports             →     wellness_evaluations
```

**🚨 URGENCIA:** Sin resolver esto, NO se puede construir nada. El frontend habla con un esquema (`remote_schema`), la documentación describe otro (`database_schema`), y el backend Python usa MongoDB (¡un tercero!).

**ACCIÓN REQUERIDA:**
1. Decidir cuál es la VERDAD: ¿el esquema de Supabase real o el ideal?
2. Crear migraciones para llevar Supabase al estado deseado
3. Regenerar los tipos TypeScript
4. Actualizar TODO el frontend para usar los tipos correctos

---

### 2. 🔀 BACKEND FRAGMENTADO: MongoDB + Supabase + Mock

El backend actual tiene un problema de identidad arquitectónica:

```
Backend (FastAPI server.py)
├── Usa MongoDB (Motor) para status_checks
├── routes/payments.py → MongoDB para pagos
├── routes/students.py → MongoDB para estudiantes
├── routes/classes.py → MongoDB para clases
│
Frontend (React)
├── Usa Supabase directamente para CRUD
├── AuthContext → Supabase Auth
├── hooks/useSchoolData → Supabase
├── lib/api/students → ¿Supabase? ¿Backend?
└── lib/demo-data → DATOS HARDCODEADOS
```

**Problema:** El frontend hace llamadas DIRECTAS a Supabase (saltándose el backend), mientras que el backend Python usa MongoDB (una base de datos diferente). Los datos viven en 2 lugares y no se sincronizan.

**🚨 URGENCIA:** Decidir la arquitectura:
- **Opción A (Recomendada para MVP):** Supabase es la ÚNICA base de datos. El frontend se conecta directamente vía el SDK. No hay backend Python para CRUD (Supabase RLS protege los datos). El backend Python se usa SOLO para lógica compleja (webhooks de pago, reportes, jobs).
- **Opción B:** Backend Python como API Gateway obligatorio. Todo CRUD pasa por FastAPI. Supabase solo como base de datos (no se usa el SDK desde el frontend). Mayor complejidad, mayor control.

---

### 3. 🏢 MULTITENANCY INEXISTENTE

**Estado actual:** El sistema NO tiene aislamiento de datos entre escuelas.

**Problemas específicos:**

1. **`useSchoolContext.ts` – Lógica de resolución rota:**
   ```typescript
   // ACTUAL: Busca escuela por email hardcodeado
   const DEMO_SCHOOL_EMAIL = 'spoortmaps+school@gmail.com';
   
   // Si no encuentra, toma CUALQUIER escuela de la BD
   const { data: anySchool } = await supabase
     .from('schools')
     .select('id, name')
     .limit(1)
     .maybeSingle();
   ```
   > Un usuario de la Escuela A podría ver datos de la Escuela B.

2. **No hay `school_id` como filtro obligatorio** en la mayoría de consultas:
   - `useSchoolData.ts` no filtra consistentemente
   - `useEvents.ts` no filtra por escuela
   - `useEnrollments.ts` no filtra por escuela

3. **RLS Policies:** El `database_schema.sql` tiene RLS policies bien diseñadas, pero el `remote_schema.sql` (la BD real) **NO las tiene implementadas**.

4. **Roles inconsistentes:**
   ```
   database_schema.sql: 'school_admin', 'parent', 'coach', 'athlete', 'super_admin'
   remote_schema.sql:   'athlete', 'parent', 'coach', 'school', 'wellness_professional', 'store_owner', 'admin', 'organizer'
   AuthContext.tsx:      Los mismos que remote_schema
   ```

**SOLUCIÓN MULTITENANT REQUERIDA:**

```
┌─────────────────────────────────────────────────┐
│           ESTRATEGIA MULTITENANT                │
│                                                 │
│  Modelo: Row-Level Isolation (Schema compartido)│
│                                                 │
│  1. Cada tabla principal tiene `school_id`      │
│  2. RLS Policies filtran por school_id          │
│  3. El usuario se asocia a 1+ escuelas          │
│  4. El contexto de escuela se resuelve al login │
│  5. Super_admin puede ver todo                  │
│                                                 │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │Escuela A│  │Escuela B│  │Escuela C│        │
│  │  RLS    │  │  RLS    │  │  RLS    │        │
│  └────┬────┘  └────┬────┘  └────┬────┘        │
│       │            │            │               │
│       └────────────┼────────────┘               │
│                    │                            │
│           ┌────────┴────────┐                  │
│           │  Supabase DB    │                  │
│           │ (Schema único)  │                  │
│           └─────────────────┘                  │
└─────────────────────────────────────────────────┘
```

---

### 4. 🔒 SEGURIDAD – CREDENCIALES EXPUESTAS

```typescript
// frontend/src/integrations/supabase/client.ts
const PRODUCTION_SUPABASE_URL = 'https://luebjarufsiadojhvxgi.supabase.co';
const PRODUCTION_SUPABASE_KEY = 'eyJhbGciOi...'; // ANON KEY HARDCODEADA
```

**Análisis:**
- La **anon key** de Supabase es técnicamente segura para exponer en el frontend (está diseñada para eso)
- **PERO** sin RLS Policies activas, cualquier persona con esta key puede leer/escribir TODA la base de datos
- Las credenciales de producción están en el código fuente (debería ser solo en `.env`)

**🚨 URGENCIA:**
1. Implementar RLS Policies en Supabase (ANTES de ir a producción)
2. Mover credenciales a variables de entorno exclusivamente
3. Quitar el fallback hardcodeado

---

### 5. 📦 DATOS MOCK VS DATOS REALES

El frontend tiene una dependencia masiva de datos hardcodeados:

| Archivo | Tipo de datos | Problema |
|---------|--------------|----------|
| `lib/demo-data.ts` | Escuelas, programas, pagos | Datos inventados, no vienen de BD |
| `lib/demo-schools.ts` | 14KB de escuelas ficticias | No se sincronizan con Supabase |
| `lib/mock-data.ts` | Mock data genérica | Se usa como fallback cuando BD falla |
| `lib/demo-credentials.ts` | Credenciales demo | 7 roles con contraseñas hardcodeadas |
| `hooks/useDashboardStats.ts` | Stats (~7KB) | Genera datos aleatorios, no reales |
| `hooks/useDashboardConfig.ts` | Config del dashboard | Mezcla datos reales con demo |

**Impacto:** Incluso en "producción", el usuario ve datos inventados. Un MVP real NO puede funcionar así.

---

## 🟡 PROBLEMAS IMPORTANTES (Resolver antes del MVP)

### 6. Frontend Monolítico (76+ páginas sin lazy loading)

```typescript
// App.tsx - TODAS las páginas se importan estáticamente
import DashboardPage from "./pages/DashboardPage";         // 13KB
import SchoolStudentsManagementPage from "./pages/SchoolStudentsManagementPage"; // 23KB
import PaymentsAutomationPage from "./pages/PaymentsAutomationPage";            // 25KB
import SchoolDetailPage from "./pages/SchoolDetailPage";     // 32KB
// ... 72 más
```

**Problema:** El bundle carga ~76 páginas de golpe. El build output es ~2.3MB sin code splitting.

**Solución:**
```typescript
// Usar React.lazy() + Suspense
const DashboardPage = React.lazy(() => import("./pages/DashboardPage"));
const SchoolStudentsManagementPage = React.lazy(() => import("./pages/SchoolStudentsManagementPage"));
```

### 7. Sin Validación de Datos

- **Frontend:** Algunos formularios usan Zod, pero no consistentemente
- **Backend:** Zero validación. Los endpoints aceptan cualquier cosa
- **Base de datos:** Los constraints existen en `database_schema.sql` pero NO en la BD real

### 8. Sin Testing

- 0 tests unitarios ejecutables
- 0 tests de integración
- Playwright configurado pero sin tests E2E reales
- Vitest configurado pero sin tests

### 9. Sin CI/CD Real

- GitHub Actions inexistente
- Vercel deploy configurado (básico)
- No hay staging environment
- No hay checks de calidad automáticos

---

## 🗺️ ROADMAP: DEMO → MVP MULTITENANT

### FASE 0: Triage y Consolidación (1-2 semanas)
> **Objetivo:** Una sola fuente de verdad para los datos

| # | Tarea | Prioridad | Esfuerzo |
|---|-------|-----------|----------|
| 0.1 | **Decidir esquema definitivo** (unificar `database_schema.sql` + `remote_schema.sql`) | 🔴 | 2 días |
| 0.2 | **Crear migraciones SQL** para llevar Supabase al esquema decidido | 🔴 | 3 días |
| 0.3 | **Regenerar tipos TypeScript** desde Supabase (supabase gen types) | 🔴 | 1 día |
| 0.4 | **Decidir arquitectura backend:** Supabase-first vs API Gateway | 🔴 | 1 día |
| 0.5 | **Eliminar datos mock** y crear seed data real en Supabase | 🔴 | 2 días |
| 0.6 | **Implementar `.env` correcto** y eliminar credenciales hardcodeadas | 🔴 | 0.5 días |

### FASE 1: Multitenancy Core (2-3 semanas)
> **Objetivo:** Aislamiento de datos por escuela

| # | Tarea | Prioridad | Esfuerzo |
|---|-------|-----------|----------|
| 1.1 | **Implementar RLS Policies** en TODAS las tablas de Supabase | 🔴 | 3 días |
| 1.2 | **Refactorizar `useSchoolContext`**: resolver escuela por el usuario logueado, NO por email hardcodeado | 🔴 | 1 día |
| 1.3 | **Crear tabla `school_members`** (relación N:N entre profiles y schools con rol) | 🔴 | 1 día |
| 1.4 | **Agregar `school_id` filter** a TODOS los hooks y queries del frontend | 🔴 | 3 días |
| 1.5 | **Crear middleware de contexto** que inyecte `school_id` en todas las operaciones | 🟡 | 2 días |
| 1.6 | **Implementar school switching** para usuarios multi-escuela | 🟡 | 2 días |
| 1.7 | **Crear rol `super_admin`** con vista cross-tenant | 🟡 | 2 días |

### FASE 2: Backend MVP (3-4 semanas)
> **Objetivo:** APIs funcionales para los flujos core

| # | Tarea | Prioridad | Esfuerzo |
|---|-------|-----------|----------|
| 2.1 | **Students CRUD** (crear, listar, editar, CSV import) | 🔴 | 4 días |
| 2.2 | **Programs CRUD** (crear, listar, editar, eliminar) | 🔴 | 2 días |
| 2.3 | **Classes CRUD** + asignación de coach | 🔴 | 3 días |
| 2.4 | **Enrollments** (inscribir, cancelar, cambiar programa) | 🔴 | 3 días |
| 2.5 | **Attendance** (marcar, listar, reportar) | 🟡 | 3 días |
| 2.6 | **Payments** (integración ePayco real + pagos manuales con validación) | 🟡 | 5 días |
| 2.7 | **Notifications** (crear, marcar leída, push básico) | 🟢 | 2 días |
| 2.8 | **Messages** (enviar, recibir, listar conversaciones) | 🟢 | 3 días |

### FASE 3: Frontend Refactor (2-3 semanas)
> **Objetivo:** Frontend conectado a datos reales

| # | Tarea | Prioridad | Esfuerzo |
|---|-------|-----------|----------|
| 3.1 | **Conectar TODOS los hooks** con Supabase real (eliminar mocks) | 🔴 | 5 días |
| 3.2 | **Implementar lazy loading** de rutas (React.lazy) | 🟡 | 1 día |
| 3.3 | **Error boundaries** globales y por sección | 🟡 | 1 día |
| 3.4 | **Loading states** y skeleton loaders | 🟡 | 2 días |
| 3.5 | **Empty states** informativos con CTAs | 🟡 | 1 día |
| 3.6 | **Validación de formularios** consistente (Zod en todo) | 🟡 | 3 días |
| 3.7 | **Eliminar páginas innecesarias** para MVP (de 76 a ~30) | 🟢 | 2 días |

### FASE 4: Calidad y Escalabilidad (2 semanas)
> **Objetivo:** Listo para producción controlada

| # | Tarea | Prioridad | Esfuerzo |
|---|-------|-----------|----------|
| 4.1 | **Tests unitarios** para hooks y utils críticos | 🟡 | 3 días |
| 4.2 | **Tests E2E** para flujos principales (login, inscripción, pago) | 🟡 | 3 días |
| 4.3 | **CI/CD Pipeline** (GitHub Actions → Vercel) | 🟡 | 2 días |
| 4.4 | **Monitoring** (Sentry para errores, analytics básicos) | 🟢 | 1 día |
| 4.5 | **Rate limiting** y protección de endpoints | 🟢 | 1 día |
| 4.6 | **Backup strategy** para Supabase | 🟢 | 1 día |
| 4.7 | **Staging environment** separado de producción | 🟢 | 1 día |

---

## 🏗️ ARQUITECTURA PROPUESTA PARA MVP

```
┌─────────────────────────────────────────────────────────────┐
│                    ARQUITECTURA MVP                         │
│                                                             │
│  ┌──────────────┐         ┌──────────────────────────┐      │
│  │   Frontend    │         │      Supabase             │      │
│  │  React + TS   │────────▶│  ┌────────────────────┐  │      │
│  │  Vite + SWC   │  SDK    │  │  PostgreSQL DB     │  │      │
│  │  shadcn/ui    │         │  │  + RLS Policies    │  │      │
│  │  TailwindCSS  │         │  │  + Triggers        │  │      │
│  └──────┬───────┘         │  │  + Views           │  │      │
│         │                  │  └────────────────────┘  │      │
│         │                  │  ┌────────────────────┐  │      │
│         │                  │  │  Supabase Auth     │  │      │
│         │                  │  │  (JWT + RLS)       │  │      │
│         │                  │  └────────────────────┘  │      │
│         │                  │  ┌────────────────────┐  │      │
│         │                  │  │  Supabase Storage  │  │      │
│         │                  │  │  (Archivos, fotos) │  │      │
│         │                  │  └────────────────────┘  │      │
│         │                  │  ┌────────────────────┐  │      │
│         │                  │  │  Realtime (WS)     │  │      │
│         │                  │  │  (Mensajes, notif) │  │      │
│         │                  │  └────────────────────┘  │      │
│         │                  └──────────────────────────┘      │
│         │                                                    │
│         │  APIs REST                                         │
│         ▼                                                    │
│  ┌──────────────┐                                           │
│  │  Edge Funcs   │  Supabase Edge Functions (Deno)          │
│  │  o FastAPI    │  ─ Webhooks de pago (ePayco)             │
│  │  (serverless) │  ─ Reportes/PDF generation               │
│  │               │  ─ Email notifications                   │
│  │               │  ─ CSV import processing                 │
│  │               │  ─ Scheduled jobs (cobros recurrentes)   │
│  └──────────────┘                                           │
│                                                             │
│  ┌──────────────┐                                           │
│  │   Vercel      │  Hosting Frontend (SPA)                  │
│  │   + CDN       │  ─ Auto deploy desde GitHub              │
│  │               │  ─ Preview deployments por PR            │
│  └──────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
```

### ¿Por qué esta arquitectura?

1. **Supabase-first:** Ya lo usan para auth. Usarlo para TODO (DB, Storage, Realtime) reduce complejidad
2. **RLS = Multitenancy gratis:** Supabase RLS filtra datos a nivel de DB. No necesitas middleware custom
3. **Edge Functions para lógica compleja:** Webhooks de pago, generación de PDFs, envío de emails
4. **Eliminar MongoDB:** Tener 2 bases de datos NO tiene sentido para un MVP
5. **Eliminar backend Python para CRUD:** El frontend habla directamente con Supabase (protegido por RLS)

---

## 📋 ESQUEMA DE BASE DE DATOS CONSOLIDADO PROPUESTO

### Tablas para MVP (priorizadas)

```sql
-- CORE (Fase 0-1)
profiles          -- Extender auth.users (ya existe, ajustar roles)
schools           -- Escuelas deportivas (tenant principal)
school_members    -- 🆕 Relación profiles ↔ schools (con rol en esa escuela)

-- ACADÉMICO (Fase 2)
programs          -- Programas deportivos por escuela
classes           -- Horarios de clase por programa
students          -- 🔄 Renombrar de 'children', agregar school_id
enrollments       -- Inscripciones student ↔ program

-- OPERACIONAL (Fase 2)
attendance        -- Asistencia (ajustar estructura)
payments          -- Pagos (consolidar transactions + manual_payments)

-- COMUNICACIÓN (Fase 3)
notifications     -- Notificaciones por usuario
messages          -- Chat directo
announcements     -- Anuncios por escuela

-- AUDITORÍA (Fase 4)
audit_log         -- Log de cambios (quién hizo qué)
```

### Tabla `school_members` (🆕 Clave para Multitenancy)

```sql
CREATE TABLE school_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'coach', 'parent', 'athlete')),
    is_primary BOOLEAN DEFAULT false, -- Escuela principal del usuario
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(school_id, profile_id)
);

-- RLS: Un usuario solo ve los miembros de sus propias escuelas
CREATE POLICY "Members see own school members"
ON school_members FOR SELECT
USING (
    school_id IN (
        SELECT school_id FROM school_members WHERE profile_id = auth.uid()
    )
);
```

---

## 🔑 REGLAS DE MULTITENANCY

### Principios

1. **Todo dato pertenece a una escuela.** Si una tabla no tiene `school_id`, no es multitenant.
2. **El usuario se autentica una vez, pero opera en contexto de una escuela.** Si pertenece a varias, elige cuál.
3. **RLS Policy = Ley absoluta.** Ningún query puede saltarse la policy. Ni siquiera un bug en el frontend expondría datos.
4. **`service_role` NUNCA en el frontend.** Solo en Edge Functions para operaciones admin.

### Patrón de RLS para cada tabla

```sql
-- Patrón genérico para cualquier tabla con school_id
CREATE POLICY "Users see data from their schools"
ON [tabla] FOR SELECT
USING (
    school_id IN (
        SELECT school_id FROM school_members 
        WHERE profile_id = auth.uid()
    )
);

-- Patrón para INSERT: solo admin/coach de esa escuela
CREATE POLICY "Admins/coaches can insert"
ON [tabla] FOR INSERT
WITH CHECK (
    school_id IN (
        SELECT school_id FROM school_members 
        WHERE profile_id = auth.uid()
        AND role IN ('admin', 'coach')
    )
);
```

---

## 📊 PÁGINAS DEL MVP vs DEMO

### Mantener (30 páginas core)

| Módulo | Páginas | Notas |
|--------|---------|-------|
| **Auth** | LoginPage, RegisterPage | Funcionales |
| **Onboarding** | SchoolOnboardingPage | Simplificar |
| **Dashboard** | DashboardPage | Conectar a datos reales |
| **Estudiantes** | SchoolStudentsManagementPage | CRUD real |
| **Programas** | ProgramsManagementPage | CRUD real |
| **Asistencia** | AttendancePage, CoachAttendancePage | Funcionalidad básica |
| **Pagos** | PaymentsPage, MyPaymentsPage, PaymentsAutomationPage, CheckoutPage | Core revenue |
| **Comunicación** | MessagesPage, NotificationsPage, AnnouncementsPage | Simplificar |
| **Explorar** | ExplorePage, SchoolDetailPage, PublicSchoolPage | Marketplace |
| **Reportes** | ReportsPage, FinancesPage | Datos reales |
| **Configuración** | SettingsPage, ProfilePage | Ajustar |
| **Calendario** | CalendarPage | Funcionalidad básica |

### Eliminar o Diferir para Post-MVP (~46 páginas)

- StorePages (5 páginas) → No es core
- WellnessPages (4 páginas) → Diferir
- EventPages (2 páginas) → Diferir  
- OrganizerPages (4 páginas) → Diferir
- AdvancedSearchPage → Simplificar en ExplorePage
- GoalsPage, NutritionPage → Diferir
- TrainingPlansPage → Diferir
- AcademicProgressPage → Diferir
- AdminAnalyticsPage → Diferir (reportes básicos primero)
- StaffPage → Diferir (usar school_members)
- FacilitiesPage → Diferir
- TeamsPage → Merge con Programs
- DemoWelcomePage, DemoProfilesPage → Solo para demo, no MVP
- CartPage, ProductDetailPage, ShopPage → Ecommerce diferido

---

## ⚡ PLAN DE ESCALABILIDAD

### Corto Plazo (MVP)

| Estrategia | Implementación |
|------------|---------------|
| **Database indexing** | Los índices del `database_schema.sql` están bien diseñados. Migrarlos |
| **Query optimization** | Usar views de Supabase para queries complejos (ya diseñados) |
| **CDN para assets** | Vercel ya provee CDN |
| **Connection pooling** | Supabase usa PgBouncer por defecto |
| **Code splitting** | React.lazy() en todas las rutas |

### Mediano Plazo (Post-MVP)

| Estrategia | Implementación |
|------------|---------------|
| **Caching** | React Query ya configurado (staleTime: 5min) - extender |
| **Edge Functions** | Para lógica intensiva (reportes, PDFs) |
| **Supabase branching** | Para staging environments |
| **Horizontal scaling** | Supabase scales automáticamente |
| **Real-time subscriptions** | Para chat y notificaciones push |

### Largo Plazo (Scale)

| Estrategia | Implementación |
|------------|---------------|
| **Read replicas** | Supabase Pro plan |
| **Partitioning** | Por `school_id` si supera millones de registros |
| **Microservicios** | Edge Functions como microservicios |
| **Multi-region** | Supabase multi-region (Enterprise) |

---

## 💰 ESTIMACIÓN DE ESFUERZO

| Fase | Semanas | Devs | Costo Aprox (Freelancer Sr) |
|------|---------|------|---------------------------|
| **Fase 0:** Consolidación | 1-2 | 1 Backend + 1 Full Stack | $2,000 - $4,000 USD |
| **Fase 1:** Multitenancy | 2-3 | 1 Backend (Supabase) | $3,000 - $5,000 USD |
| **Fase 2:** Backend MVP | 3-4 | 1 Backend + 1 Frontend | $5,000 - $8,000 USD |
| **Fase 3:** Frontend Refactor | 2-3 | 1 Frontend | $3,000 - $5,000 USD |
| **Fase 4:** QA y Polish | 1-2 | 1 QA + 1 DevOps | $2,000 - $3,000 USD |
| **TOTAL** | **9-14 semanas** | **2-3 devs** | **$15,000 - $25,000 USD** |

---

## ✅ CHECKLIST DE ENTREGA MVP

### Funcional
- [ ] Login/Register con roles reales (no demo)
- [ ] Onboarding de escuela completo (crear school + profile admin)
- [ ] CRUD de estudiantes (individual + CSV import)
- [ ] CRUD de programas y clases
- [ ] Inscripción de estudiante a programa
- [ ] Toma de asistencia por clase
- [ ] Pago online (ePayco) + pago manual (comprobante)
- [ ] Dashboard con datos reales
- [ ] Mensajes entre admin-padres
- [ ] Reportes básicos (asistencia, ingresos)

### Técnico
- [ ] Un solo esquema de BD (consolidado + migrado)
- [ ] RLS Policies en TODAS las tablas
- [ ] Zero datos mock en producción
- [ ] Types TypeScript auto-generados
- [ ] Variables de entorno (no credenciales en código)
- [ ] Error handling global
- [ ] Loading states en toda la app
- [ ] Lazy loading de rutas

### Calidad
- [ ] Tests unitarios para lógica de negocio
- [ ] Tests E2E para flujos críticos (3 flujos mínimo)
- [ ] CI pipeline (lint + type check + tests)
- [ ] Staging environment funcional

---

## 🎯 CONCLUSIÓN FINAL

### Lo BUENO del proyecto actual:
1. ✅ **UI/UX profesional** – El frontend es visualmente excelente
2. ✅ **Sistema de roles** – RBAC bien diseñado en `permissions.ts`
3. ✅ **PWA configurado** – Service worker y manifest listos
4. ✅ **Supabase Auth** – Funcional y bien implementado
5. ✅ **DB Schema ideal** – `database_schema.sql` está muy bien diseñado con RLS, triggers, views

### Lo MALO que hay que arreglar URGENTE:
1. 🔴 **Tres esquemas de BD inconsistentes** – Fuente de todos los bugs
2. 🔴 **Backend Python + MongoDB duplica a Supabase** – Elegir uno y migrar
3. 🔴 **Zero multitenancy** – Cualquier usuario puede ver datos de otras escuelas potencialmente
4. 🔴 **Datos mock en producción** – 6+ archivos de datos ficticios
5. 🔴 **Credenciales hardcodeadas** (aunque la anon key es técnicamente segura)

### Recomendación #1:
> **No agregar NINGUNA feature nueva hasta que los problemas de las Fases 0 y 1 se resuelvan.** Construir sobre cimientos rotos solo aumentará la deuda técnica. Primero consoliden la base de datos, implementen RLS, y eliminen los mocks. Después, conectar el frontend que ya existe será relativamente rápido.

---

_Documento generado por análisis automatizado del repositorio SportMaps Demo_  
_Última actualización: 2026-02-16_
