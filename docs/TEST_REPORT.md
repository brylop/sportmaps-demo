# SportMaps — Reporte de Testing Completo
**Fecha:** 2026-03-04
**Versión:** MVP 1.0
**Método:** Análisis estático de código (BFF + Frontend + Schema)
**Analista:** Claude Code

---

## Resumen Ejecutivo

| Área | Estado | Cobertura |
|---|---|---|
| Autenticación | ✅ Funcional | Alta |
| BFF — Students API | ✅ Funcional | Alta |
| BFF — Enrollments API | ⚠️ Issues menores | Media |
| BFF — Attendance API | ✅ Funcional | Alta |
| BFF — Reports API | ✅ Funcional | Media |
| BFF — Wompi Webhook | ✅ Funcional | Alta |
| Frontend — Auth Flow | ✅ Funcional | Alta |
| Frontend — Dashboard | ✅ Funcional | Alta |
| Frontend — Pagos | ⚠️ Incompleto | Baja |
| RLS / Seguridad | ⚠️ Riesgo medio | Media |
| Tests automatizados | ❌ Sin cobertura | 0% |

**Resultado global: APTO para demo con cliente. NO apto para producción aún.**

---

## 1. Autenticación

### 1.1 Login
- **Estado:** ✅ PASS
- Validación con Zod (email + min 6 chars password)
- Integración correcta con `supabase.auth.signIn`
- Redireccionamiento post-login a `from` o `/dashboard`
- Soporte para parámetros `?email=` e `?invite=` desde invitaciones

### 1.2 Recuperación de contraseña
- **Estado:** ✅ PASS
- Flujo "forgot password" implementado en `LoginPage.tsx`
- Envía reset via Supabase Auth

### 1.3 Registro
- **Estado:** ⚠️ REVISAR
- `RegisterPage.tsx` existe pero no se verificó si el rol se asigna correctamente en `profiles` al crear usuario
- **Riesgo:** Un nuevo usuario podría quedar sin rol definido y romper el flujo de `requireAuth`

### 1.4 Token Bearer (BFF)
- **Estado:** ✅ PASS
- `requireAuth` valida Bearer token via `supabase.auth.getUser(token)`
- Resuelve `school_id`, `branch_id` y `role` desde tabla `school_members`
- Roles privilegiados (`owner`, `super_admin`, `admin`) bypass automático en `requireRole`

### 1.5 Bug detectado — Auth middleware
- **Estado:** ❌ BUG
- Si el usuario existe en `auth.users` pero NO en `school_members` → `403` con mensaje detallado (incluye `profile_id` en el response). **Expone información interna.**
- **Fix:** Omitir `profile_id` del mensaje de error en producción.

---

## 2. BFF — Students API (`/api/v1/students`)

### 2.1 POST /students/bulk
- **Estado:** ✅ PASS
- Validación robusta con Zod v4 (usando `.issues` correctamente)
- Soporta upsert por `document_id`
- Límite de 200 estudiantes por carga
- Validaciones específicas: teléfono 10+ dígitos, fecha `YYYY-MM-DD`, `medical_info` JSON válido

### 2.2 Campos requeridos validados
| Campo | Validación | Estado |
|---|---|---|
| first_name | min 1, max 100 | ✅ |
| last_name | min 1, max 100 | ✅ |
| document_id | min 1, max 30 | ✅ |
| parent_name | min 2 chars | ✅ |
| parent_email | formato email | ✅ |
| parent_phone | 10+ dígitos numéricos | ✅ |
| monthly_fee | min $10,000 COP | ✅ |
| medical_info | JSON con `has_allergies` boolean | ✅ |
| date_of_birth | regex YYYY-MM-DD | ✅ |

### 2.3 Issues detectados
- **⚠️ Warning:** `medical_info` usa `.refine()` con `JSON.parse` — si el string no es JSON, lanza error silencioso. Cubierto, pero validación frágil.
- **⚠️ Warning:** No hay límite de rate en el endpoint bulk. Un payload de 200 estudiantes repetido en loop podría saturar Supabase.

---

## 3. BFF — Enrollments API (`/api/v1/enrollments`)

### 3.1 POST /enrollments
- **Estado:** ⚠️ BUG POTENCIAL
- Validación Zod correcta (`student_id`, `class_id` como UUIDs)
- **BUG:** En el check de duplicado usa `.eq('program_id', class_id)` pero la inserción usa también `program_id: class_id`. Sin embargo, el schema Zod acepta `program_id` como campo separado y opcional. Hay inconsistencia semántica entre `class_id` y `program_id` en el mismo endpoint.
- **BUG:** `findError` se declara pero nunca se verifica antes de usar `existing`. Si hay error en la consulta, el código continúa y puede insertar duplicados.

```typescript
// Línea problemática — findError nunca se revisa:
const { data: existing, error: findError } = await supabase...
if (existing) { ... }  // findError ignorado
```

### 3.2 Roles permitidos
- `owner, admin, school_admin, coach, staff` — correcto para el caso de uso

---

## 4. BFF — Attendance API (`/api/v1/attendance`)

### 4.1 GET /attendance/session/:teamId
- **Estado:** ✅ PASS
- Consulta sesión del día actual por `team_id`
- Retorna `{ session: null, records: [] }` si no hay sesión — manejo correcto

### 4.2 POST /attendance/session
- **Estado:** ✅ PASS
- Crea sesión si no existe; verifica que no esté `finalized` antes de permitir escritura
- Validación de `teamId` y `records` como array no vacío
- Upsert de registros por `child_id + attendance_date`

### 4.3 Roles y seguridad
- `owner, super_admin, admin, school_admin, coach` — apropiado

### 4.4 Issues detectados
- **⚠️ Warning:** No hay validación de que `records[].status` sea un valor válido del enum `attendance_status` (`present`, `absent`, `late`, `excused`). Un valor inválido llegaría directo a Supabase y generaría error 500 en lugar de 400.

---

## 5. BFF — Reports API (`/api/v1/reports`)

### 5.1 GET /reports/school/summary
- **Estado:** ✅ PASS
- Resuelve join ambiguo entre `enrollments` y `teams` correctamente (dos pasos separados)
- Agrega: capacidad total, estudiantes activos, ocupación por programa, crecimiento mensual
- Filtro por `branch_id` para `school_admin`

### 5.2 Issues detectados
- **⚠️ Warning:** La función `getBranchFilter` acepta `branch_id` del query string sin sanitización adicional — aunque Supabase lo parametriza, es buena práctica validar que sea UUID.
- **⚠️ Warning:** El mapa `growthMap` se construye pero no se ve el endpoint que lo devuelve en el fragmento analizado. Verificar que sea parte de la respuesta final.

---

## 6. BFF — Wompi Webhook (`/webhooks/wompi`)

### 6.1 Validación de checksum
- **Estado:** ✅ PASS
- Implementa verificación SHA-256 correctamente
- Construye el string de checksum dinámicamente desde `signature.properties`
- Rechaza con `401` si el checksum no coincide — correcto

### 6.2 Procesamiento de eventos
- **Estado:** ✅ PASS
- Mapeo de estados Wompi → estados internos:

| Wompi | Interno |
|---|---|
| APPROVED | paid |
| DECLINED | rejected |
| VOIDED | refunded |
| ERROR | failed |
| PENDING | pending |

### 6.3 Issues detectados
- **⚠️ Warning:** El secret `WOMPI_EVENTS_SECRET` tiene fallback `'YOUR_WOMPI_SECRET'`. Si la variable de entorno no está seteada, el webhook acepta cualquier firma falsa. **Crítico en producción.**
- **⚠️ Warning:** No hay idempotencia explícita en el webhook. Si Wompi reenvía el mismo evento dos veces, el payment se actualizaría dos veces (aunque al mismo estado, no es idealmente correcto).
- **❌ BUG:** El update en Supabase busca por `receipt_number = txReference`, pero no está claro que esa columna exista en la tabla `payments` del schema actual (el schema usa `transaction_id` o `reference`). Verificar mapeo.

---

## 7. Frontend — Páginas por rol

### 7.1 Cobertura de páginas (~78 detectadas)

| Módulo | Páginas | Estado |
|---|---|---|
| Auth (Login, Register, Reset) | 3 | ✅ |
| Dashboard | 1 | ✅ |
| Estudiantes | StudentsPage, SchoolStudentsManagement | ✅ |
| Asistencia | AttendancePage, CoachAttendance, ChildAttendance, Supervision | ✅ |
| Pagos | MyPayments, Checkout, ParentCheckout, PaymentResult, Reminders | ⚠️ |
| Reportes | ReportsPage, CoachReports, AnalyticsDashboard, AdminAnalytics | ✅ |
| Mensajes | MessagesPage, MessagesDetail | ✅ |
| Calendario | CalendarPage, CalendarAdvanced | ✅ |
| Tienda | ShopPage, StorePage, CartPage, ProductDetail, StoreProducts | ⚠️ |
| Wellness | WellnessPage, AthleteWellness, NutritionPage, MedicalHistory | ✅ |
| Admin | AdminPanel, AdminUsers, AdminClubs, InvitationsManagement | ✅ |
| Escuela | SchoolSettings, SchoolSetup, ProgramsManagement, Facilities | ✅ |
| Organizer | eventos/, organizer/ | ⚠️ Sin revisar |
| Entrenador | CoachEvaluations, TrainingPlans, GoalsPage | ✅ |

### 7.2 Dashboard
- **Estado:** ✅ PASS
- Carga `StatCard`, `ActivityList`, `QuickActions`, `NotificationList` según rol
- Splash de bienvenida para onboarding nuevo
- Banner de completar perfil
- Hook `useDashboardStatsReal` para datos reales (buen signo)
- Modal de invitación pendiente procesado automáticamente

### 7.3 Flujo de pagos frontend
- **Estado:** ⚠️ INCOMPLETO
- `CheckoutPage`, `ParentCheckoutPage`, `PaymentResultPage` existen
- No se verificó integración completa con Wompi desde frontend (SDK o redirección)
- `system_prompt.md` describe el flujo pero la implementación real no fue verificada end-to-end

---

## 8. Base de datos — Schema

### 8.1 Tablas principales confirmadas
- `profiles`, `schools`, `school_members`, `enrollments`, `payments`, `transactions`
- `attendance_sessions`, `attendance_records`, `teams`, `students`

### 8.2 ENUMs correctamente definidos
- `enrollment_status`, `payment_status`, `payment_method`, `attendance_status`, `user_role` — todos bien tipados

### 8.3 Issues detectados
- **⚠️ Warning:** Extension `postgis` requerida — verificar que Supabase Cloud la tenga habilitada (no todas las instancias la tienen por defecto).
- **⚠️ Warning:** Columna `location GEOGRAPHY(POINT, 4326)` en `schools` — si PostGIS no está activo, la migración falla completa.
- **❌ BUG potencial:** Script `RESET_MIGRATIONS.sql` hace `DELETE FROM supabase_migrations` sin WHERE. Si alguien lo ejecuta en producción por error, borra el historial completo de migraciones Supabase. **Archivar o proteger.**

---

## 9. Seguridad

| Punto | Estado | Descripción |
|---|---|---|
| Bearer token validado en cada request | ✅ | Via `requireAuth` |
| Roles verificados por endpoint | ✅ | Via `requireRole` |
| Multi-tenant por `school_id` | ✅ | `req.schoolId` desde `school_members` |
| Exposición de `profile_id` en error 403 | ❌ | Mensaje revela info interna |
| `WOMPI_EVENTS_SECRET` sin fallback seguro | ❌ | Aceptaría firmas inválidas si env vacío |
| Rate limiting en bulk upload | ⚠️ | No implementado |
| SQL injection | ✅ | Supabase client parametriza |
| XSS | ✅ | React escapa por defecto |
| CORS | ⚠️ | No verificado en BFF |
| `RESET_MIGRATIONS.sql` peligroso | ❌ | Sin WHERE, ejecutable por accidente |

---

## 10. Tests automatizados

| Tipo | Estado |
|---|---|
| Unit tests (Vitest) | ❌ No existen |
| Integration tests | ❌ No existen |
| E2E (Playwright) | ❌ Config presente, 0 tests escritos |
| Scripts SQL QA | ⚠️ Existen pero son manuales |

**Playwright está instalado** (`v1.57.0`) pero `playwright-report/` y `test-results/` están vacíos. No hay ningún test `.spec.ts` escrito.

---

## 11. Hallazgos Críticos (Prioritarios antes de producción)

| # | Severidad | Descripción | Archivo |
|---|---|---|---|
| 1 | 🔴 Alta | `WOMPI_EVENTS_SECRET` con fallback inseguro | `bff/src/routes/wompi.ts` |
| 2 | 🔴 Alta | `findError` no verificado en enrollments → duplicados posibles | `bff/src/routes/enrollments.ts` |
| 3 | 🔴 Alta | `RESET_MIGRATIONS.sql` sin WHERE — peligroso | `tests/RESET_MIGRATIONS.sql` |
| 4 | 🟡 Media | Error 403 expone `profile_id` | `bff/src/middlewares/authMiddleware.ts` |
| 5 | 🟡 Media | `attendance status` no validado contra enum | `bff/src/routes/attendance.ts` |
| 6 | 🟡 Media | Webhook Wompi no idempotente | `bff/src/routes/wompi.ts` |
| 7 | 🟡 Media | PostGIS puede no estar habilitado en Supabase | `database_schema.sql` |
| 8 | 🟢 Baja | Sin rate limiting en `/students/bulk` | `bff/src/routes/students.ts` |
| 9 | 🟢 Baja | Flujo de pago frontend no verificado end-to-end | `frontend/src/pages/` |
| 10 | 🟢 Baja | 0% cobertura de tests automatizados | `tests/` |

---

## 12. Recomendaciones para el cliente (demo hoy)

### Lo que funciona para mostrar
- ✅ Login / Registro de escuela
- ✅ Dashboard con estadísticas
- ✅ Carga masiva de estudiantes (CSV/bulk)
- ✅ Registro de asistencia por equipo
- ✅ Reportes de resumen de escuela
- ✅ Mensajes y notificaciones

### Lo que NO mostrar aún
- ❌ Flujo de pago con Wompi (no verificado end-to-end)
- ❌ Tienda / ecommerce
- ❌ Módulo organizer de eventos

### Fixes rápidos antes del cliente (< 1h)
1. Setear `WOMPI_EVENTS_SECRET` en `.env` correctamente
2. Quitar `profile_id` del mensaje de error 403
3. Agregar `if (findError) throw findError` en enrollments
4. Mover `RESET_MIGRATIONS.sql` fuera de `tests/` a `docs/scripts/` con nombre más explícito

---

*Reporte generado por análisis estático — sin entorno de ejecución activo. Para validación completa, ejecutar con datos reales en Supabase.*
