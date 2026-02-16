# 🏗️ VALIDACIÓN ARQUITECTÓNICA DE FLUJOS — SportMaps MVP

**Fecha:** 2026-02-16  
**Método:** Análisis línea-por-línea del repositorio vs. documento de análisis MVP  
**Objetivo:** Validar el estado real de cada flujo arquitectónico y producir un plan de acción ejecutable

---

<architectural_analysis>

## ANÁLISIS PREVIO (Pensamiento Crítico)

### Rutas Críticas para el MVP:
1. **Auth → School Context → CRUD Operations** — Sin auth+contexto, nada funciona
2. **School → Programs → Students → Enrollments** — El flujo core de la plataforma
3. **Payments** — Revenue model, sin esto no hay negocio
4. **Multitenancy (RLS)** — Sin esto, datos se mezclan entre escuelas

### Dependencias entre flujos:
- Multitenancy depende de: Schema consolidado + RLS Policies
- CRUD depende de: Decisión MongoDB vs Supabase (actualmente split)
- Enrollments depende de: Students + Programs existiendo en la MISMA BD
- Payments depende de: Enrollments + contexto de escuela
- Dashboard depende de: Datos reales (no mocks)

### Gaps más urgentes que bloquean todo:
1. **Split de base de datos** — Frontend habla Supabase, Backend habla MongoDB. NADA se sincroniza.
2. **No hay tabla `school_members`** — Imposible saber qué usuarios pertenecen a qué escuela.
3. **`useSchoolContext` hardcoded** — La resolución de tenant está rota de raíz.

### Quick wins vs Complex refactors:
- **Quick:** Eliminar mocks hardcodeados, implementar lazy loading, mover credenciales a .env
- **Complex:** Consolidación de esquemas, implementación de RLS, migrar backend de MongoDB a Supabase

</architectural_analysis>

---

<flow_analysis>

## RESUMEN EJECUTIVO

### Estado General de los Flujos Arquitectónicos

| Área | Estado | Completitud | Bloqueador Principal |
|------|--------|-------------|---------------------|
| **Autenticación** | 🟡 PARCIAL | 65% | Demo mode entrelazado con auth real |
| **Multitenancy** | 🔴 FALTANTE | 5% | No existe school_members ni RLS |
| **Students CRUD** | 🔴 FALTANTE | 15% | Frontend→FastAPI→MongoDB, no llega a Supabase |
| **Programs CRUD** | 🟡 PARCIAL | 45% | Lectura Supabase OK, escritura parcial |
| **Classes CRUD** | 🔴 FALTANTE | 15% | Mismo problema que Students |
| **Enrollments** | 🟡 PARCIAL | 40% | Lectura Supabase OK, inscripción con hacks |
| **Payments** | 🟡 PARCIAL | 35% | Backend en MongoDB, frontend mixto, Wompi/ePayco en sandbox |
| **Attendance** | 🔴 FALTANTE | 10% | Esquema en Supabase, sin CRUD funcional |
| **Messages** | 🔴 FALTANTE | 20% | Tabla en Supabase, realtime configurado, sin UI funcional |
| **Notifications** | 🟡 PARCIAL | 50% | Tabla + realtime OK, creación parcial |
| **Dashboard/Analytics** | 🟡 PARCIAL | 35% | Stats reales parciales + mocks |
| **RBAC/Permissions** | 🟡 PARCIAL | 55% | Sistema frontend bueno, sin enforcement backend |
| **Marketplace/Explore** | 🔴 FALTANTE | 15% | Solo UI con datos demo hardcoded |

### Porcentaje Global de Completitud: **~28%** para MVP funcional

### Bloqueadores Críticos (Top 3):
1. 🔴 **Dualidad de base de datos** — MongoDB (backend) vs Supabase (frontend) — zero sincronización
2. 🔴 **Zero multitenancy** — `useSchoolContext` hardcoded a email demo
3. 🔴 **Frontend falsamente funcional** — Todo CRUD falla silenciosamente y devuelve mocks

---

## ANÁLISIS DETALLADO POR FLUJO

---

### 1. FLUJO: AUTENTICACIÓN Y SESIÓN

**Estado:** 🟡 PARCIAL  
**Completitud:** 65%

#### Archivos Involucrados:
| Archivo | Líneas clave | Rol |
|---------|-------------|-----|
| `frontend/src/contexts/AuthContext.tsx` | 1-340 | Provider principal de autenticación |
| `frontend/src/components/ProtectedRoute.tsx` | 1-34 | Guard de rutas protegidas |
| `frontend/src/integrations/supabase/client.ts` | 1-40 | Cliente Supabase |
| `frontend/src/lib/demo-credentials.ts` | — | Credenciales demo hardcoded |

#### ✅ Qué EXISTE y funciona:
- **Supabase Auth completo**: sign-up, sign-in, sign-out, session recovery
- **Profile auto-creation**: `createProfile()` en `AuthContext.tsx` crea perfil en Supabase al registrarse
- **ProtectedRoute**: Redirección a login si no hay sesión, guard por roles
- **Session persistence**: `localStorage` + `autoRefreshToken`

```typescript
// AuthContext.tsx — Funcional
const { data } = await supabase.auth.signInWithPassword({ email, password });
// Funciona correctamente con Supabase Auth
```

#### ❌ Qué FALTA:
1. **Credenciales hardcodeadas en código fuente** (`client.ts:9-10`):
   ```typescript
   const PRODUCTION_SUPABASE_URL = 'https://luebjarufsiadojhvxgi.supabase.co';
   const PRODUCTION_SUPABASE_KEY = 'eyJhbGciOi...';
   ```
   Debería ser SOLO `.env`

2. **ProtectedRoute NO valida school context** (`ProtectedRoute.tsx:28`):
   ```typescript
   // Solo valida rol, NO valida si el usuario pertenece a la escuela que intenta acceder
   if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
     return <Navigate to="/unauthorized" replace />;
   }
   ```

3. **Demo mode entrelazado**: `AuthContext.tsx` maneja tanto auth real como demo mode (`isDemoAccessing` flag), complicando la lógica.

4. **No hay refresh token rotation** ni **logout en todos los dispositivos**.

#### Impacto en MVP: 🟡 Medio — Auth funciona pero sin aislamiento por tenant.

---

### 2. FLUJO: MULTITENANCY (AISLAMIENTO POR ESCUELA)

**Estado:** 🔴 FALTANTE  
**Completitud:** 5%

#### Archivos Involucrados:
| Archivo | Problema |
|---------|---------|
| `frontend/src/hooks/useSchoolContext.ts` | Resolución hardcodeada |
| `frontend/src/lib/api/checkout.ts` | Fallback a "cualquier escuela" |
| `frontend/src/hooks/useSchoolData.ts` | Filtro por `owner_id` (solo dueño) |
| `database_schema.sql` | Schema ideal con RLS (nunca ejecutado) |
| Supabase real (types.ts) | Sin tabla `school_members`, sin RLS |

#### ❌ Qué FALTA (prácticamente todo):

1. **Resolución de tenant ROTA** (`useSchoolContext.ts:47-62`):
   ```typescript
   // PROBLEMA CRÍTICO: Hardcoded email
   const DEMO_SCHOOL_EMAIL = 'spoortmaps+school@gmail.com';
   
   // Si no encuentra por email, toma CUALQUIER escuela
   const { data: anySchool } = await supabase
     .from('schools')
     .select('id, name')
     .limit(1)
     .maybeSingle();
   ```

2. **Checkout hace lo mismo** (`checkout.ts:32-43`):
   ```typescript
   // Mismo patrón peligroso en el flujo de pago
   const { data: demoSchool } = await supabase
     .from('schools')
     .select('id')
     .eq('email', 'spoortmaps+school@gmail.com')
     .maybeSingle();
   // Fallback: Use any valid school
   const { data: anySchool } = await supabase.from('schools').select('id').limit(1).maybeSingle();
   ```

3. **No existe tabla `school_members`** — En `types.ts` las tablas son:
   - `schools` (con `owner_id` → 1 dueño por escuela)
   - Pero NO hay relación N:N para coaches, padres, atletas asignados a una escuela
   
4. **Zero RLS Policies activas** en la BD real (confirmado por `types.ts` que no reporta policies)

5. **No hay school context en la sesión** — Cuando un usuario pertenece a múltiples escuelas, no hay mecanismo de "cambiar de escuela"

#### Impacto en MVP: 🔴 CRÍTICO — Sin esto, escuela A ve datos de escuela B

---

### 3. FLUJO: STUDENTS CRUD

**Estado:** 🔴 FALTANTE  
**Completitud:** 15%

#### Archivos Involucrados:
| Archivo | Stack | Problema |
|---------|-------|---------|
| `frontend/src/lib/api/students.ts` | Fetch → FastAPI | Apunta a FastAPI backend |
| `backend/routes/students.py` | FastAPI → MongoDB | Usa MongoDB, no Supabase |
| `frontend/src/hooks/useSchoolContext.ts` | Supabase | `createStudentWithPendingPayment()` usa tabla `children` |
| Supabase `types.ts` | Supabase | Tabla `children`, NO `students` |

#### 🔴 CONFLICTO ARQUITECTÓNICO GRAVE:

**Existen DOS flujos paralelos para crear estudiantes que NO se hablan:**

**Flujo A: Frontend → FastAPI → MongoDB**
```typescript
// frontend/src/lib/api/students.ts:77-99
class StudentsAPI {
  private baseUrl = `${API_URL}/api/students`; // → FastAPI
  
  async createStudent(student: StudentCreate): Promise<Student> {
    const response = await fetch(this.baseUrl, { method: 'POST', ... });
    // Esto llama al backend Python
  }
}
```
```python
# backend/routes/students.py:72-82
@router.post("/", response_model=Student)
async def create_student(student: StudentCreate):
    await db.students.insert_one(student_obj.dict())  # MongoDB!
```

**Flujo B: Frontend → Supabase directamente**
```typescript
// frontend/src/hooks/useSchoolContext.ts:138-149
const { data: child, error: childError } = await supabase
    .from('children')  // Tabla Supabase (diferente nombre!)
    .insert({
        name: params.fullName,
        date_of_birth: params.dateOfBirth || null,
        ...
    } as any)
```

**Resultado:** Si creas un estudiante por Flujo A, no aparece en Supabase. Si lo creas por Flujo B, no aparece en MongoDB. Los datos viven en lugares distintos.

#### Mock Fallback silencioso (`students.ts:134-137`):
```typescript
catch (error) {
  console.warn('Error fetching students, falling back to mock data:', error);
  return this.getMockStudents(); // ← Siempre devuelve 4 estudiantes inventados
}
```
El usuario NUNCA ve un error — ve datos falsos creyendo que son reales.

#### Mismo patrón en update/delete (`students.ts:228-245`):
```typescript
async updateStudent(id: string, updates: StudentUpdate): Promise<Student> {
  try { /* ... */ }
  catch (error) {
    console.warn('Update error, simulating success', error); // ← SIMULA ÉXITO
    return { ...this.getMockStudents()[0], ...updates, id } as Student;
  }
}
```

#### Impacto en MVP: 🔴 CRÍTICO — El flujo core de la plataforma no funciona

---

### 4. FLUJO: PROGRAMS CRUD

**Estado:** 🟡 PARCIAL  
**Completitud:** 45%

#### Archivos Involucrados:
| Archivo | Stack | Estado |
|---------|-------|--------|
| `frontend/src/hooks/usePrograms.ts` | Supabase directo | ✅ READ funcional |
| `frontend/src/pages/ProgramsManagementPage.tsx` | UI | 🟡 Parcial |
| `frontend/src/lib/api/schools.ts` | Supabase + fallback | 🟡 Lee programas pero con fallback demo |

#### ✅ Qué EXISTE:
```typescript
// usePrograms.ts:46-51 — READ funciona con Supabase directo
const { data, error: fetchError } = await supabase
  .from('programs')
  .select('*')
  .eq('school_id', schoolId)
  .eq('active', true)
  .order('name');
```

```typescript
// usePrograms.ts:68-76 — ENROLL funciona con Supabase directo
const { error: enrollError } = await supabase.from('enrollments').insert({
  user_id: userId,
  program_id: programId,
  start_date: new Date().toISOString().split('T')[0],
  status: 'active',
});
```

#### ❌ Qué FALTA:
1. **No hay CREATE/UPDATE/DELETE** para programas en ningún hook
2. `ProgramsManagementPage` tiene UI pero no conecta con Supabase para mutaciones
3. La columna es `price_monthly` en types.ts, pero `useSchoolContext` usa `price`:
   ```typescript
   // useSchoolContext.ts:81 — Usa p.price (¿existe?)
   monthly_fee: p.price || DEFAULT_MONTHLY_FEE,
   // types.ts muestra: price_monthly (diferente campo!)
   ```

#### Impacto en MVP: 🟡 MEDIO — Lectura funciona, gestión no

---

### 5. FLUJO: CLASSES CRUD

**Estado:** 🔴 FALTANTE  
**Completitud:** 15%

#### Archivos Involucrados:
| Archivo | Stack | Problema |
|---------|-------|---------|
| `frontend/src/lib/api/classes.ts` | Fetch → FastAPI | Backend en MongoDB |
| `backend/routes/classes.py` | FastAPI → MongoDB | NO conecta con Supabase |

#### 🔴 Mismo problema que Students:
- Frontend `classesAPI` llama a FastAPI Python → MongoDB
- Supabase tiene una tabla `programs` (no `classes`)
- Frontend tiene mock fallback silencioso:
  ```typescript
  // classes.ts:150-153
  catch (error) {
    console.error('Error fetching classes, using mock data:', error);
    return this.getMockClasses(); // 3 clases inventadas
  }
  ```

#### Confusión conceptual: ¿Qué es una "class" vs un "program"?
- `database_schema.sql` tiene AMBAS tablas: `programs` + `classes`
- Supabase real tiene: `programs` (sí), `classes` (NO EXISTE en types.ts)
- El backend tiene `classes.py` que habla con MongoDB collections `classes` y `enrollments`
- Hay ZERO conexión entre estos mundos

#### Impacto en MVP: 🔴 CRÍTICO — No se pueden gestionar horarios

---

### 6. FLUJO: INSCRIPCIONES (ENROLLMENTS)

**Estado:** 🟡 PARCIAL  
**Completitud:** 40%

#### Archivos Involucrados:
| Archivo | Stack | Estado |
|---------|-------|--------|
| `frontend/src/hooks/useEnrollments.ts` | Supabase | ✅ READ funcional |
| `frontend/src/hooks/usePrograms.ts` | Supabase | ✅ INSERT funcional |
| `frontend/src/lib/api/checkout.ts` | Supabase | 🟡 INSERT con hacks |
| `frontend/src/lib/api/classes.ts` | FastAPI | 🔴 Enroll via MongoDB |

#### ✅ Qué funciona:
```typescript
// useEnrollments.ts:54-69 — Lectura con JOIN real
const { data, error: fetchError } = await supabase
  .from('enrollments')
  .select(`
    *,
    program:programs(id, name, sport, school_id, school:schools(name, city))
  `)
  .eq('user_id', user.id)
  .order('created_at', { ascending: false });
```

#### ❌ Problemas:
1. **`checkout.ts` hace INSERT con `as any` para evadir TypeScript** (línea 55):
   ```typescript
   const { data: enrollment, error: enrollError } = await supabase
     .from('enrollments')
     .insert({
       user_id: payload.student_id, // FIX comment: student_id -> user_id
       program_id: payload.class_id, // FIX comment: class_id -> program_id
       status: 'active'
     } as any) // ← Ignoring TypeScript errors
   ```
   Los comments revelan confusión entre `student_id`, `user_id`, `class_id`, `program_id`

2. **Enrollments NO tienen school_id** en Supabase real:
   ```typescript
   // types.ts líneas 343-390 — enrollments table:
   // Columnas: id, user_id, program_id, start_date, end_date, status, created_at, updated_at
   // ¡NO HAY school_id! — Se pierde el tenant context
   ```

3. **Enrollment vía classes.py (Backend)** hace unenroll en MongoDB — completamente desconectado

#### Impacto en MVP: 🟡 MEDIO — Inscripción funciona parcialmente, pero sin tenant isolation

---

### 7. FLUJO: PAGOS

**Estado:** 🟡 PARCIAL  
**Completitud:** 35%

#### Archivos Involucrados:
| Archivo | Stack | Líneas | Estado |
|---------|-------|--------|--------|
| `backend/routes/payments.py` | FastAPI + MongoDB | 663 líneas | 🟡 Funcional para demo |
| `frontend/src/lib/api/checkout.ts` | Supabase | 100 líneas | 🟡 INSERT con hacks |
| `frontend/src/pages/PaymentsAutomationPage.tsx` | UI | — | 🟡 UI existe |
| `frontend/src/pages/MyPaymentsPage.tsx` | UI | — | 🟡 UI existe |
| `system_prompt.md` | Spec | 140 líneas | Lógica ideal descrita |

#### ✅ Qué EXISTE:
1. **Backend payments.py MUY completo** (663 líneas):
   - `POST /api/payments/create-intent` — Crear intención de pago
   - `POST /api/payments/process-demo-payment/{id}` — Simular pago
   - `POST /api/payments/register-manual` — Pago manual (transferencia)
   - `POST /api/payments/admin/review/{id}` — Aprobar/Rechazar pago
   - `POST /api/payments/wompi/create-signature` — Firma Wompi SHA-256
   - `POST /api/payments/wompi/webhook` — Webhook Wompi con validación de checksum
   - `GET /api/payments/transactions/{student_id}` — Historial
   - `GET /api/payments/subscriptions/{student_id}` — Suscripciones

2. **Wompi integration bien implementada** (líneas 468-601):
   - Signature generation con SHA-256
   - Webhook con validación de checksum
   - Manejo de eventos `transaction.updated`

3. **Tabla `payments` en Supabase** con estructura completa

#### ❌ Qué FALTA:
1. **Backend usa MongoDB, frontend usa Supabase** para pagos:
   ```python
   # payments.py:580-581 — Comentado!
   # In production: update Supabase payments table
   # supabase.from('payments').update(...)  ← TODO
   ```
   El webhook de Wompi guarda en MongoDB, pero la UI lee de Supabase.

2. **payments.py NO tiene school_id como parámetro** en la mayoría de operaciones

3. **Demo transactions generator** (líneas 103-139) devuelve datos ficticios cuando detecta `demo_` prefix

4. **ePayco** mencionado en `system_prompt.md` y frontend, pero backend solo tiene **Wompi**

5. **Payments en Supabase NO tiene `school_id`** según types.ts:
   ```typescript
   // Columns: amount, concept, parent_id, status, due_date, payment_date...
   // ¡NO HAY school_id! (pero checkout.ts intenta insertar uno con 'as any')
   ```

#### Impacto en MVP: 🟡 MEDIO-ALTO — El backend existe pero está desconectado del frontend

---

### 8. FLUJO: ASISTENCIA (ATTENDANCE)

**Estado:** 🔴 FALTANTE  
**Completitud:** 10%

#### Archivos Involucrados:
| Archivo | Estado |
|---------|--------|
| Supabase `types.ts` → tabla `attendance` | ✅ Tabla existe |
| `frontend/src/pages/AttendancePage.tsx` | 🟡 UI existe |
| `frontend/src/pages/CoachAttendancePage.tsx` | 🟡 UI existe |
| `frontend/src/pages/AttendanceSupervisionPage.tsx` | 🟡 UI existe |
| Hooks para attendance | 🔴 NO existen |
| Backend endpoints | 🔴 NO existen |

#### Tabla en Supabase (types.ts:206-237):
```typescript
attendance: {
  Row: {
    child_id: string     // Referencia a children (NO students!)
    class_date: string
    status: string       // present/absent/late
    justification_reason: string | null
    justified_by: string | null
  }
}
```

#### ❌ No hay hooks ni APIs — Solo la tabla y las UIs vacías

#### Impacto en MVP: 🟡 IMPORTANTE — Feature esperada por escuelas

---

### 9. FLUJO: MENSAJERÍA (MESSAGES)

**Estado:** 🔴 FALTANTE  
**Completitud:** 20%

#### ✅ Qué existe:
1. **Tabla `messages` en Supabase** (types.ts:613-656):
   ```typescript
   messages: {
     Row: { id, sender_id, recipient_id, subject, content, read, created_at }
   }
   ```
2. **Tabla `message_attachments`** (types.ts:575-611)
3. **Realtime subscription** configurada (`useRealtime.ts:37-65`):
   ```typescript
   supabase.channel('messages-changes')
     .on('postgres_changes', { event: 'INSERT', table: 'messages', 
          filter: `recipient_id=eq.${user.id}` }, ...)
   ```
4. **MessagesPage** existe con UI

#### ❌ Qué falta:
- No hay hook `useMessages()` para CRUD
- MessagesPage probablemente muestra datos estáticos
- No hay send message, mark as read, thread management

#### Impacto en MVP: 🟢 DIFERIBLE — Puede lanzarse sin chat

---

### 10. FLUJO: NOTIFICACIONES

**Estado:** 🟡 PARCIAL  
**Completitud:** 50%

#### ✅ Qué funciona:
1. **Tabla en Supabase** con estructura completa
2. **`useDashboardStats.ts`** lee notificaciones reales:
   ```typescript
   const { data: notifData, count: notifCount } = await supabase
     .from('notifications')
     .select('id, read', { count: 'exact' })
     .eq('user_id', user.id);
   ```
3. **Realtime** configurado para INSERT (`useRealtime.ts:6-34`)
4. **`checkout.ts`** crea notificaciones al inscribir (línea 78):
   ```typescript
   await supabase.from('notifications').insert({
     user_id: payload.parent_id,
     title: 'Inscripción Exitosa',
     message: 'El pago ha sido procesado...',
     type: 'payment_success'
   });
   ```

#### ❌ Qué falta:
- No hay mark as read
- No hay push notifications (solo in-app)
- No hay preferences de notificación

---

### 11. FLUJO: DASHBOARD Y ANALYTICS

**Estado:** 🟡 PARCIAL  
**Completitud:** 35%

#### ✅ `useDashboardStats.ts` hace queries REALES diferenciadas por rol:
```typescript
if (effectiveRole === 'school') {
  const { data: schoolData } = await supabase
    .from('schools').select('id').eq('owner_id', user.id);
  // Then: programs count, active programs, enrollments count
}
if (effectiveRole === 'parent') {
  // children count, payments count, enrollments count
}
if (effectiveRole === 'coach') {
  // teams count
}
```

#### ❌ Problemas:
1. **Las queries dependen de datos reales** que actualmente no existen (porque CRUD está roto)
2. **No hay `useDashboardStatsReal.ts`** hook utilizado (existe pero no se importa en ninguna parte)
3. **ReportsPage, FinancesPage** muestran datos estáticos/demo

---

### 12. FLUJO: RBAC / PERMISOS

**Estado:** 🟡 PARCIAL  
**Completitud:** 55%

#### ✅ Sistema frontend robusto:

1. **`lib/permissions.ts`** (350 líneas) — Sistema completo:
   - 8 roles definidos: `athlete, parent, coach, school, wellness_professional, store_owner, admin, organizer`
   - ~40 permisos granulares (`students:create`, `finances:manage`, etc.)
   - Feature flags por rol
   - Data visibility rules

2. **`hooks/usePermissions.ts`** (96 líneas) — Hook reutilizable:
   ```typescript
   const { can, canAccess, hasFeature, isAdmin, hasRole } = usePermissions();
   // can('students:create') → boolean
   ```

3. **`ProtectedRoute.tsx`** — Role guard en rutas:
   ```typescript
   <ProtectedRoute allowedRoles={['school', 'admin']}>
     <SchoolStudentsManagementPage />
   </ProtectedRoute>
   ```

#### ❌ Qué falta:
1. **ZERO enforcement en backend** — `students.py`, `classes.py`, `payments.py` no validan roles
2. **Supabase RLS no implementado** — La BD acepta cualquier operación con anon key
3. **No hay middleware** de autorización en FastAPI
4. **Roles inconsistentes**: Frontend usa `'school'`, schema ideal usa `'school_admin'`

---

## PROBLEMAS CRÍTICOS ENCONTRADOS

### 1. 🔴 BASE DE DATOS DUAL SIN SINCRONIZACIÓN

| Operación | Frontend llama a... | Datos van a... |
|-----------|-------------------|----------------|
| Crear estudiante (StudentsAPI) | `fetch('/api/students')` → FastAPI | **MongoDB** `students` collection |
| Crear estudiante (useSchoolContext) | `supabase.from('children')` | **Supabase** `children` table |
| Listar estudiantes (StudentsAPI) | `fetch('/api/students')` → FastAPI | **MongoDB** (o mock si falla) |
| Listar programas (usePrograms) | `supabase.from('programs')` | **Supabase** `programs` table |
| Procesar pago (payments.py) | FastAPI endpoint | **MongoDB** `transactions` + mock |
| Registrar inscripción (checkout.ts) | `supabase.from('enrollments')` | **Supabase** `enrollments` table |

**Consecuencia:** Un estudiante creado en la página de gestión (MongoDB) NO aparece en el checkout (Supabase). Un pago procesado por el backend (MongoDB) NO aparece en el dashboard (Supabase).

### 2. 🔴 MOCK DATA COMO FALLBACK SILENCIOSO

Los siguientes archivos **simulan éxito** cuando la operación real falla:

| Archivo | Línea | Comportamiento |
|---------|-------|---------------|
| `lib/api/students.ts` | 134-137 | `getStudents()` devuelve 4 estudiantes ficticios |
| `lib/api/students.ts` | 228-245 | `updateStudent()` simula éxito con datos mock |
| `lib/api/students.ts` | 255-259 | `deleteStudent()` simula éxito silenciosamente |
| `lib/api/students.ts` | 276-298 | `bulkUpload()` devuelve "5 exitosos" aunque falle |
| `lib/api/students.ts` | 306-333 | `getStats()` devuelve stats inventadas |
| `lib/api/classes.ts` | 150-153 | `getClasses()` devuelve 3 clases ficticias |
| `lib/api/classes.ts` | 262-272 | `enrollStudent()` devuelve enrollment mock |
| `lib/api/classes.ts` | 290-293 | `unenrollStudent()` simula éxito |
| `lib/api/checkout.ts` | 89-94 | `processEnrollment()` devuelve mock enrollment |
| `lib/api/parents.ts` | 71-78 | `addChild()` devuelve child mock |
| `lib/api/schools.ts` | 122-157 | `getSchoolBySlug()` devuelve demo hardcoded |
| `hooks/useSchoolContext.ts` | 89-96 | `programs` devuelve 4 programas demo hardcoded |
| `hooks/useSchoolData.ts` | 204-241 | `facilities` devuelve 3 mock facilities |
| `backend/routes/payments.py` | 203-205 | `create_intent` devuelve éxito aunque falle |
| `backend/routes/payments.py` | 257-259 | `process_payment` devuelve approved aunque falle |

**Esto es el anti-patrón más peligroso del proyecto:** El usuario cree que está operando con datos reales, pero todo es humo.

### 3. 🔴 ESQUEMA DE NOMBRADO INCONSISTENTE

| Concepto | database_schema.sql | Supabase real (types.ts) | Backend Python | Frontend API |
|----------|--------------------|-----------------------|---------------|-------------|
| Estudiante | `students` | `children` | `db.students` (Mongo) | `StudentsAPI` |
| Precio programa | `monthly_fee` | `price_monthly` | N/A | `monthly_fee` |
| Dueño escuela | `admin_id` | `owner_id` | N/A | `owner_id` |
| Deporte programa | `sport_type` (ENUM) | `sport` (TEXT) | `sport` (str) | `sport` (string) |
| Inscripción ref | `student_id` | `user_id` | `student_id` (Mongo) | `student_id`/`user_id` (confusión) |
| Tabla pagos | `transactions` | `payments` | `transactions` (Mongo) | `payments` |

### 4. 🟡 76 PÁGINAS IMPORTADAS ESTÁTICAMENTE

`App.tsx` importa 76 páginas sin lazy loading:
```typescript
// App.tsx líneas 14-103 — TODAS estáticas
import DashboardPage from "./pages/DashboardPage";
import SchoolStudentsManagementPage from "./pages/SchoolStudentsManagementPage";
// ... 74 más
```
Bundle estimado: ~2.3MB sin code splitting.

---

## PLAN DE ACCIÓN PRIORIZADO

### 🔴 CRÍTICO — Sprint 1 (Semana 1-2): Consolidación de Base de Datos

| # | Tarea | Archivos | Esfuerzo | Dependencia |
|---|-------|----------|----------|-------------|
| 1.1 | **Decidir: "students" o "children"** — Renombrar tabla en Supabase O cambiar todo el frontend | Migración SQL + `useSchoolContext.ts` + `parents.ts` + `types.ts` | 2 días | Ninguna |
| 1.2 | **Añadir `school_id` a enrollments** | Migración SQL + `types.ts` regenerar | 0.5 días | 1.1 |
| 1.3 | **Añadir `school_id` a payments** | Migración SQL + `types.ts` regenerar | 0.5 días | 1.1 |
| 1.4 | **Crear tabla `school_members`** (profile_id + school_id + role) | Nueva migración SQL | 1 día | 1.1 |
| 1.5 | **Regenerar types.ts** con `supabase gen types typescript` | `integrations/supabase/types.ts` | 0.5 días | 1.1-1.4 |
| 1.6 | **Eliminar TODA conexión a MongoDB** del backend | `server.py`, `payments.py`, `students.py`, `classes.py` | 2 días | 1.5 |
| 1.7 | **Migrar backend routes a usar Supabase Python** client | `payments.py`, `students.py`, `classes.py` | 3 días | 1.6 |
| 1.8 | **Implementar RLS Policies** en TODAS las tablas con `school_id` | SQL migrations file | 2 días | 1.4 |

### 🔴 CRÍTICO — Sprint 2 (Semana 3-4): Multitenancy + Auth

| # | Tarea | Archivos | Esfuerzo | Dependencia |
|---|-------|----------|----------|-------------|
| 2.1 | **Reescribir `useSchoolContext.ts`** — Resolver escuela por `school_members` + `auth.uid()` | `useSchoolContext.ts` | 1 día | 1.4 |
| 2.2 | **Crear `SchoolProvider` context** con school switching | Nuevo `contexts/SchoolContext.tsx` | 1 día | 2.1 |
| 2.3 | **Inyectar school_id** en TODOS los hooks que hacen queries | `useSchoolData.ts`, `useDashboardStats.ts`, `usePrograms.ts`, `useEnrollments.ts` + 8 más | 3 días | 2.2 |
| 2.4 | **Eliminar credenciales hardcodeadas** de `client.ts` | `client.ts` + crear `.env.example` | 0.5 días | Ninguna |
| 2.5 | **Limpiar ProtectedRoute** para validar tenant context | `ProtectedRoute.tsx` | 0.5 días | 2.2 |
| 2.6 | **Eliminar demo-data mock fallbacks** de todos los API clients | `students.ts`, `classes.ts`, `checkout.ts`, `schools.ts`, `parents.ts` | 2 días | 1.7 |

### 🟡 IMPORTANTE — Sprint 3 (Semana 5-6): CRUD Funcional

| # | Tarea | Archivos | Esfuerzo | Dependencia |
|---|-------|----------|----------|-------------|
| 3.1 | **Students CRUD vía Supabase** — Crear `useStudents` hook | Nuevo hook + conectar a `SchoolStudentsManagementPage` | 2 días | 2.3 |
| 3.2 | **Programs CRUD completo** — Agregar create/update/delete a `usePrograms` | `usePrograms.ts` + `ProgramsManagementPage` | 2 días | 2.3 |
| 3.3 | **Attendance CRUD** — Crear `useAttendance` hook | Nuevo hook + conectar a `AttendancePage`, `CoachAttendancePage` | 2 días | 3.1 |
| 3.4 | **Messages CRUD** — Crear `useMessages` hook con realtime | Nuevo hook + conectar a `MessagesPage` | 2 días | 2.3 |
| 3.5 | **Conectar checkout.ts a datos reales** — Eliminar `as any`, usar tipos correctos | `checkout.ts` | 1 día | 1.5, 3.1 |
| 3.6 | **Dashboard con datos reales** — Conectar stats a Supabase (ya parcialmente hecho) | `useDashboardStats.ts` | 1 día | 3.1, 3.2 |
| 3.7 | **CSV Import de estudiantes** — Migrar de backend Python a Edge Function o frontend processing | Nueva Edge Function O frontend logic | 2 días | 3.1 |

### 🟡 IMPORTANTE — Sprint 4 (Semana 7-8): Pagos Reales + UX

| # | Tarea | Archivos | Esfuerzo | Dependencia |
|---|-------|----------|----------|-------------|
| 4.1 | **Wompi webhook → Supabase** — Descomentar y activar la línea 580-581 de payments.py | `payments.py` o Edge Function | 1 día | 1.7 |
| 4.2 | **Pago manual con validación** — Admin approve/reject que actualice Supabase | Nuevo endpoint o Edge Function | 2 días | 4.1 |
| 4.3 | **Lazy loading de rutas** | `App.tsx` — wrap todas las páginas con `React.lazy()` | 1 día | Ninguna |
| 4.4 | **Error boundaries globales** | Nuevo `ErrorBoundary.tsx` + integrar en App | 0.5 días | Ninguna |
| 4.5 | **Loading skeletons** en componentes principales | `DashboardPage`, `SchoolStudentsManagementPage`, etc. | 2 días | 3.1 |
| 4.6 | **Eliminar páginas no-MVP** de las rutas | `App.tsx` — comentar 30+ rutas innecesarias | 0.5 días | Ninguna |

### 🟢 DESEABLE — Sprint 5+ (Post-MVP)

| # | Tarea | Esfuerzo |
|---|-------|----------|
| 5.1 | Tests unitarios para hooks (Vitest) | 3 días |
| 5.2 | Tests E2E para flujos críticos (Playwright) | 3 días |
| 5.3 | CI/CD con GitHub Actions | 1 día |
| 5.4 | Sentry error monitoring | 0.5 días |
| 5.5 | Store/Products module | 5 días |
| 5.6 | Wellness module | 3 días |
| 5.7 | Events/Organizer module | 3 días |
| 5.8 | Advanced analytics/reports | 5 días |

---

## RECOMENDACIONES PARA MVP

### Decisiones Arquitectónicas Clave

| Decisión | Recomendación | Justificación |
|----------|--------------|---------------|
| **MongoDB vs Supabase** | ❌ Eliminar MongoDB | Ya tienen Supabase con auth, realtime, storage. Tener 2 BDs es insostenible. |
| **Backend Python** | 🟡 Mantener SOLO para webhooks/jobs | CRUD hagan directo frontend→Supabase (protegido por RLS). Python solo para: Wompi webhook, PDF generation, email sending, CSV processing |
| **"students" vs "children"** | ✅ Mantener `children` (es lo que tiene Supabase) | Renombrar en Supabase es más caro que adaptar el frontend. Actualizar tipos y hooks a usar `children` |
| **Programs vs Classes** | ✅ Solo `programs` | Supabase solo tiene `programs`. No crear `classes`. Los horarios van como `schedule` JSON en `programs` |
| **LazyLoading** | ✅ Inmediato | Quick win, reduce bundle de 2.3MB a ~500KB initial |
| **Páginas MVP** | ✅ Máximo 30 rutas | Las otras 46 quedan comentadas pero no eliminadas |

### Flujos que DEBEN diferirse post-MVP:
1. **Store/Ecommerce** (products, orders, inventory) — 8 páginas
2. **Wellness module** (appointments, evaluations, medical history) — 6 páginas
3. **Events/Organizer** (create event, event management, events map) — 4 páginas
4. **Advanced Search** (geolocation, filters avanzados) — 1 página
5. **Training Plans** (coach feature avanzada) — 1 página
6. **Real-time chat** (polling simple first, WebSocket after MVP)

### Riesgos y Mitigaciones:

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| RLS Policies bloquean funcionalidad existente | ALTA | Probar exhaustivamente en staging antes de activar en prod |
| Migración MongoDB→Supabase pierde datos demo | MEDIA | Crear seed data SQL antes de migrar |
| Frontend rompe al eliminar mocks | ALTA | Implementar error boundaries + empty states ANTES de eliminar mocks |
| Wompi webhook no funciona en prod | MEDIA | Probar con Wompi sandbox exhaustivamente |
| Usuarios confunden datos demo con reales | ALTA | Eliminar el flag `is_demo` y crear un environment completamente separado para demos |

---

## ORDEN DE EJECUCIÓN SUGERIDO (Ruta Crítica)

```
Week 1: ┌─ 1.1 (naming) → 1.2 (school_id enrollments) → 1.3 (school_id payments)
        └─ 1.4 (school_members table) → 1.5 (regenerate types)
        
Week 2: ┌─ 1.6 (remove MongoDB) → 1.7 (backend → Supabase)
        └─ 1.8 (RLS policies)
        └─ 2.4 (remove hardcoded creds) [parallel, quick win]
        
Week 3: ┌─ 2.1 (rewrite useSchoolContext) → 2.2 (SchoolProvider)
        └─ 2.3 (inject school_id in ALL hooks)
        └─ 2.6 (eliminate mock fallbacks)
        
Week 4: ┌─ 3.1 (Students CRUD) → 3.3 (Attendance)
        ├─ 3.2 (Programs CRUD) → 3.5 (Fix checkout)
        └─ 3.6 (Dashboard real data)
        
Week 5: ┌─ 4.1 (Wompi→Supabase) → 4.2 (Manual payments)
        └─ 4.3 (Lazy loading) + 4.4 (Error boundaries) [parallel]
        └─ 3.7 (CSV Import)
        
Week 6: ┌─ 4.5 (Loading states) + 4.6 (Remove non-MVP pages)
        └─ QA Manual + Bug fixes
        └─ Staging deployment + Smoke testing
```

**Total estimado: 6-8 semanas con 2 desarrolladores (1 backend/Supabase, 1 frontend)**

</flow_analysis>

---

_Validación arquitectónica generada por análisis línea-por-línea del repositorio SportMaps Demo_  
_Última actualización: 2026-02-16_
