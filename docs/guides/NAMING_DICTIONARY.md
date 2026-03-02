# 📖 Diccionario de Naming — SportMaps MVP

> **Fuente de verdad** para nombres de tablas, columnas y conceptos.  
> Última actualización: 2026-02-16 | Branch: `develop`

## Decisión Clave: La tabla es `children`, la UI dice "Estudiantes"

| Contexto | Término UI (español) | Tabla Supabase | VIEW disponible |
|----------|---------------------|---------------|-----------------|
| Padre registra un hijo | "Mi hijo/a" | `children` | — |
| Escuela gestiona estudiantes | "Estudiante" | `children` | `students` |
| Coach ve su grupo | "Alumno" | `children` | `students` |
| Admin ve reportes | "Estudiante" | `children` | `students` |

**¿Por qué no renombrar la tabla?**
- La tabla `children` ya existe en producción con datos reales
- Renombrar rompe 10+ archivos frontend que usan `.from('children')`
- La VIEW `students` da la interfaz amigable sin romper nada
- Para operaciones CRUD, el frontend sigue usando `.from('children')`
- Para queries de reportes/consultas, puede usar la VIEW `.from('students')`

---

## Mapa Completo de Naming

### Tablas Principales

| Concepto | Tabla | Columna ID Owner | Columna Precio |
|----------|-------|-------------------|----------------|
| Escuela | `schools` | `owner_id` (uuid → auth.users) | — |
| Miembro de escuela | `school_members` | `profile_id` (uuid → auth.users) | — |
| Programa/Actividad | `programs` | `school_id` (uuid → schools) | `price_monthly` (numeric) |
| Estudiante/Hijo | `children` | `parent_id` (uuid → auth.users) | — |
| Inscripción | `enrollments` | `user_id` (uuid → profiles) | — |
| Pago | `payments` | `parent_id` (uuid → auth.users) | `amount` (numeric) |
| Staff de escuela | `school_staff` | `school_id` (uuid → schools) | — |
| Equipo | `teams` | `coach_id` (uuid → auth.users) | — |
| Instalación | `facilities` | `school_id` (uuid → schools) | `hourly_rate` (numeric) |
| Notificación | `notifications` | `user_id` (uuid → auth.users) | — |
| Mensaje | `messages` | `sender_id` / `recipient_id` | — |
| Perfil de usuario | `profiles` | `id` (uuid → auth.users) | — |

### Columnas de Multitenancy

| Tabla | Columna Tenant | Auto-fill? |
|-------|---------------|------------|
| `schools` | `id` (es el tenant) | — |
| `school_members` | `school_id` | No |
| `programs` | `school_id` | No |
| `children` | `school_id` | No |
| `enrollments` | `school_id` | **Sí** (trigger desde `programs.school_id`) |
| `payments` | `school_id` | **Sí** (backfill desde children/enrollments) |
| `facilities` | `school_id` | No |
| `school_staff` | `school_id` | No |
| `teams` | `school_id` | No |
| `attendance` | — (via `child_id → children.school_id`) | Indirecto |
| `notifications` | — (global per user) | N/A |

### Enums

| Enum | Valores |
|------|---------|
| `user_role` | `athlete`, `parent`, `coach`, `school`, `wellness_professional`, `store_owner`, `admin` |
| `app_role` | (mismo que user_role) |
| `subscription_tier` | `free`, `basic`, `premium`, `enterprise` |
| `activity_status` | `scheduled`, `in_progress`, `completed`, `cancelled` |
| School member `role` | `owner`, `admin`, `coach`, `staff`, `parent`, `athlete`, `viewer` |
| School member `status` | `active`, `inactive`, `pending`, `suspended` |

---

## ⚠️ Trampas de Naming Conocidas

| Lo que dice el código muerto | Lo que REALMENTE es | Dónde aparece |
|-----------------------------|--------------------|-|
| `student_id` | `child_id` o `user_id` | `checkout.ts`, `backend/students.py` |
| `class_id` | `program_id` | `checkout.ts` |
| `monthly_fee` | `price_monthly` | `useSchoolContext.ts` usa `p.price` |
| `admin_id` | `owner_id` | `database_schema.sql` ideal |
| `sport_type` | `sport` | `database_schema.sql` ideal |
| `transactions` (MongoDB) | `payments` (Supabase) | `backend/payments.py` |
| `students` (MongoDB) | `children` (Supabase) | `backend/students.py` |
| `classes` (MongoDB) | `programs` (Supabase) | `backend/classes.py` |

---

## Frontend: Qué usar dónde

```typescript
// ✅ CORRECTO: Operaciones CRUD de hijos/estudiantes
const { data } = await supabase.from('children').select('*').eq('school_id', schoolId);

// ✅ CORRECTO: Consultas enriquecidas para reportes de escuela
const { data } = await supabase.from('students').select('*').eq('school_id', schoolId);

// ✅ CORRECTO: Precio de programa
const price = program.price_monthly;

// ✅ CORRECTO: Dueño de escuela
const isOwner = school.owner_id === user.id;

// ✅ CORRECTO: Verificar membresía
const { data } = await supabase.from('school_members')
  .select('role, status')
  .eq('profile_id', user.id)
  .eq('school_id', currentSchoolId);

// ❌ INCORRECTO: No usar estos
// supabase.from('spm_users') — DEPRECATED, usar profiles
// fetch('/api/students')     — MongoDB, ELIMINAR
// fetch('/api/classes')      — MongoDB, ELIMINAR
```
