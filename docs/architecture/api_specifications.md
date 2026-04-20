# API Specifications - SportMaps BFF

**Base URL (local):** `http://localhost:3000`
**Base URL (produccion):** Configurada via `FRONTEND_URL` en variables de entorno

**Autenticacion:** Bearer token de Supabase en header `Authorization: Bearer <token>`
**Content-Type:** `application/json`

**Variables de entorno requeridas:**
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
- `EPAYCO_PUBLIC_KEY` / `EPAYCO_PRIVATE_KEY` / `EPAYCO_P_CUST_ID_CLIENTE` / `EPAYCO_P_KEY`
- `FRONTEND_URL`

---

## Tabla de Contenidos

1. [Health Check](#1-health-check)
2. [Estudiantes (Students)](#2-estudiantes)
3. [Inscripciones (Enrollments)](#3-inscripciones)
4. [Asistencia (Attendance)](#4-asistencia)
5. [Ofertas y Planes (Offerings)](#5-ofertas-y-planes)
6. [Session Bookings](#6-session-bookings)
7. [Contexto de Escuela](#7-contexto-de-escuela)
8. [Configuracion Deportiva](#8-configuracion-deportiva)
9. [Eventos de Facturacion](#9-eventos-de-facturacion)
10. [Reportes](#10-reportes)
11. [Pagos (ePayco)](#11-pagos-epayco)
12. [Webhooks](#12-webhooks)
13. [Explorar (Publico)](#13-explorar)
14. [Favoritos](#14-favoritos)
15. [Staff de Escuela](#15-staff-de-escuela)
16. [Eventos Deportivos](#16-eventos-deportivos)
17. [Organizadores](#17-organizadores)
18. [Delegaciones de Escuela](#18-delegaciones-de-escuela)
19. [Templates (Plantillas)](#19-templates)
20. [Encuestas (Polls)](#20-encuestas)
21. [Marketplace](#21-marketplace)
22. [Vendor (Vendedores)](#22-vendor)
23. [Ordenes del Marketplace](#23-ordenes-del-marketplace)
24. [Entrenador Personal (Trainer)](#24-entrenador-personal)
25. [Sistema](#25-sistema)
26. [OG Preview / Social Sharing](#26-og-preview)
27. [Middleware y Seguridad](#27-middleware-y-seguridad)
28. [Rate Limiting](#28-rate-limiting)
29. [Manejo de Errores](#29-manejo-de-errores)

---

## 1. Health Check

**Ruta:** `/health`
**Archivo:** `bff/src/index.ts`

### GET `/health`
Health check del servidor. Sin autenticacion.

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2026-04-16T10:00:00Z",
  "version": "1.0.0"
}
```

---

## 2. Estudiantes

**Base:** `/api/v1/students`
**Archivos:** `bff/src/routes/students.ts`, `bff/src/routes/students-create-one.route.ts`

### GET `/api/v1/students`
Listar estudiantes de la escuela.

**Auth:** `requireAuth` + `requireRole(owner, admin, super_admin, school_admin, school, coach, staff)`

**Response (200):**
```json
{
  "students": [
    {
      "id": "uuid",
      "full_name": "Santiago Garcia",
      "avatar_url": "https://...",
      "athlete_type": "child|user|unregistered",
      "team_name": "Thunder",
      "enrollment_status": "active",
      "parent_name": "Maria Garcia",
      "parent_email": "maria@email.com"
    }
  ]
}
```

---

### POST `/api/v1/students/bulk`
Carga masiva de estudiantes via datos JSON (no CSV). Auto-crea branches, teams, enrollments, pagos e invitaciones.

**Auth:** `requireAuth` + `requireRole(owner, admin, super_admin, school_admin, school, coach, staff)`

**Request Body:**
```json
{
  "students": [
    {
      "first_name": "Santiago",
      "last_name": "Garcia",
      "doc_number": "1234567890",
      "doc_type": "TI",
      "date_of_birth": "2014-05-20",
      "parent_name": "Maria Garcia",
      "parent_email": "maria@email.com",
      "parent_phone": "+573001234567",
      "team_name": "Thunder",
      "branch_name": "Sede Norte",
      "monthly_fee": 220000
    }
  ],
  "options": {
    "upsert": true,
    "defaultBranchId": "uuid (opcional)"
  }
}
```

**Response (200/207):**
```json
{
  "success": true,
  "message": "Importacion completada",
  "summary": {
    "total": 50,
    "inserted": 45,
    "updated": 3,
    "skipped": 2,
    "branches_created": 1,
    "teams_created": 2,
    "enrollments_created": 45,
    "invitations_created": 30
  },
  "skipped": [
    { "row": 12, "reason": "Email duplicado" }
  ]
}
```

---

### POST `/api/v1/students/create-one`
Crear un solo atleta. Soporta 4 tipos: menor (child), adulto existente, adulto por invitacion, adulto no registrado.

**Auth:** `requireAuth` + `requireRole(owner, admin, super_admin, school_admin, school, coach, staff)`

**Request Body (tipo child):**
```json
{
  "type": "child",
  "first_name": "Santiago",
  "last_name": "Garcia",
  "doc_number": "1234567890",
  "doc_type": "TI",
  "date_of_birth": "2014-05-20",
  "medical_info": "Alergia al mani",
  "parent_name": "Maria Garcia",
  "parent_email": "maria@email.com",
  "parent_phone": "+573001234567",
  "team_id": "uuid (opcional)",
  "offering_plan_id": "uuid (opcional)",
  "offering_id": "uuid (opcional)",
  "monthly_fee": 220000,
  "start_date": "2026-02-01"
}
```

**Request Body (tipo adult_existing):**
```json
{
  "type": "adult_existing",
  "user_id": "uuid",
  "team_id": "uuid (opcional)",
  "offering_plan_id": "uuid (opcional)",
  "monthly_fee": 220000,
  "start_date": "2026-02-01"
}
```

**Request Body (tipo adult_invite):**
```json
{
  "type": "adult_invite",
  "email": "atleta@email.com"
}
```

**Request Body (tipo unregistered_adult):**
```json
{
  "type": "unregistered_adult",
  "full_name": "Carlos Lopez",
  "email": "carlos@email.com",
  "phone": "+573001234567"
}
```

**Response (201):**
```json
{
  "success": true,
  "child_id": "uuid (si type=child)",
  "user_id": "uuid (si type=adult_existing)",
  "unregistered_athlete_id": "uuid (si type=unregistered_adult)",
  "enrollments_created": 1,
  "payment_created": true,
  "invitation_sent": true,
  "message": "Atleta creado exitosamente"
}
```

---

## 3. Inscripciones

**Base:** `/api/v1/enrollments`
**Archivo:** `bff/src/routes/enrollments.ts`

### POST `/api/v1/enrollments`
Crear inscripcion (a equipo o plan de oferta).

**Auth:** `requireAuth` + `requireRole(owner, admin, school_admin, coach, staff)`

**Request Body:**
```json
{
  "user_id": "uuid (opcional)",
  "child_id": "uuid (opcional)",
  "unregistered_athlete_id": "uuid (opcional)",
  "team_id": "uuid (opcional)",
  "offering_plan_id": "uuid (opcional)",
  "status": "active|cancelled|pending",
  "start_date": "2026-02-01",
  "end_date": "2026-12-31"
}
```

**Response (201):**
```json
{
  "message": "Inscripcion creada",
  "data": { "id": "uuid", "status": "active", "..." : "..." }
}
```

---

### GET `/api/v1/enrollments`
Listar inscripciones con filtros.

**Auth:** `requireAuth`

**Query Params:** `team_id`, `offering_plan_id`, `status`

**Response (200):**
```json
{
  "enrollments": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "child_id": "uuid",
      "team_id": "uuid",
      "offering_plan_id": "uuid",
      "status": "active",
      "start_date": "2026-02-01"
    }
  ]
}
```

---

### GET `/api/v1/enrollments/my-plan`
Obtener inscripciones activas del usuario autenticado con datos enriquecidos de plan/equipo.

**Auth:** `requireAuth`

**Query Params:** `child_id` (opcional, para hijos)

**Response (200):**
```json
{
  "enrollments": [
    {
      "id": "uuid",
      "offering_plan": { "name": "Plan Mensual", "max_sessions": 12, "price": 220000 },
      "offering": { "name": "Futbol Juvenil", "offering_type": "membership" },
      "team": { "name": "Thunder" },
      "school": { "name": "Academia Elite FC" },
      "computed": {
        "plan_status": "active",
        "percent_used": 42,
        "days_left": 18,
        "sessions_remaining": 7
      }
    }
  ]
}
```

---

### POST `/api/v1/enrollments/assign-plan`
Asignar plan de oferta a una inscripcion existente.

**Auth:** `requireAuth` + `requireRole(owner, admin, school_admin)`

**Request Body:**
```json
{
  "enrollment_id": "uuid",
  "offering_plan_id": "uuid"
}
```

---

### PATCH `/api/v1/enrollments/:id`
Actualizar inscripcion.

**Auth:** `requireAuth` + `requireRole(owner, admin, school_admin)`

**Request Body:**
```json
{
  "status": "active|cancelled|pending",
  "end_date": "2026-12-31",
  "offering_plan_id": "uuid"
}
```

---

### DELETE `/api/v1/enrollments/:id`
Cancelar inscripcion (cambia status a `cancelled`).

**Auth:** `requireAuth` + `requireRole(owner, admin, school_admin)`

---

## 4. Asistencia

**Base:** `/api/v1/attendance`
**Archivo:** `bff/src/routes/attendance.ts`

### GET `/api/v1/attendance/session/:teamId`
Obtener sesion del dia y registros de asistencia para un equipo.

**Auth:** `requireAuth` + `requireRole(owner, super_admin, admin, school_admin, coach)`

**Response (200):**
```json
{
  "session": {
    "id": "uuid",
    "team_id": "uuid",
    "session_date": "2026-04-16",
    "finalized": false,
    "finalized_at": null,
    "created_by": "uuid",
    "created_at": "2026-04-16T08:00:00Z"
  },
  "records": [
    {
      "child_id": "uuid",
      "user_id": null,
      "unregistered_athlete_id": null,
      "status": "present"
    }
  ]
}
```

---

### GET `/api/v1/attendance/roster/:contextType/:contextId`
Obtener roster con atletas, uso de plan y pagos. `contextType` puede ser `team` u `offering`.

**Auth:** `requireAuth` + `requireRole(owner, super_admin, admin, school_admin, coach)`

**Response (200):**
```json
{
  "athletes": [
    {
      "id": "uuid",
      "full_name": "Santiago Garcia",
      "avatar_url": "https://...",
      "athlete_type": "child",
      "enrollment_id": "uuid",
      "plan": {
        "plan_name": "Plan Mensual",
        "sessions_used": 5,
        "max_sessions": 12,
        "sessions_remaining": 7,
        "expires_at": "2026-05-01"
      },
      "payment": {
        "status": "paid",
        "amount": 220000
      }
    }
  ],
  "bookings": [],
  "context_type": "team",
  "context_id": "uuid"
}
```

---

### POST `/api/v1/attendance/session`
Guardar registros de asistencia (presente/ausente/tarde/justificado).

**Auth:** `requireAuth` + `requireRole(owner, super_admin, admin, school_admin, coach)`

**Request Body:**
```json
{
  "teamId": "uuid (opcional)",
  "sessionId": "uuid (opcional, crea nueva si no existe)",
  "records": [
    { "childId": "uuid", "status": "present" },
    { "userId": "uuid", "status": "absent" },
    { "unregisteredAthleteId": "uuid", "status": "late" }
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "sessionId": "uuid"
}
```

---

### POST `/api/v1/attendance/walk-in`
Marcar asistencia con deduccion automatica de creditos del plan.

**Auth:** `requireAuth` + `requireRole(owner, super_admin, admin, school_admin, coach)`

**Request Body:**
```json
{
  "enrollmentId": "uuid",
  "teamId": "uuid (opcional)",
  "sessionId": "uuid (opcional)",
  "offeringId": "uuid (opcional)",
  "status": "present|absent|late|excused",
  "childId": "uuid (o userId o unregisteredAthleteId)",
  "is_secondary": false
}
```

**Response (201):**
```json
{
  "success": true,
  "sessionId": "uuid",
  "plan_summary": {
    "plan_name": "Plan Mensual",
    "sessions_used": 6,
    "max_sessions": 12,
    "sessions_remaining": 6,
    "secondary_sessions_used": 0,
    "max_secondary_sessions": 4,
    "expires_at": "2026-05-01"
  }
}
```

---

### PATCH `/api/v1/attendance/session/:sessionId/finalize`
Finalizar sesion (irreversible). Procesa session bookings asociados.

**Auth:** `requireAuth` + `requireRole(owner, super_admin, admin, school_admin, coach)`

**Response (200):**
```json
{
  "success": true,
  "message": "Sesion finalizada",
  "summary": {
    "bookings_processed": 3,
    "details": []
  }
}
```

---

### GET `/api/v1/attendance/rate/:teamId`
Obtener porcentaje de asistencia del equipo.

**Auth:** `requireAuth` + `requireRole(owner, super_admin, admin, school_admin, coach)`

**Response (200):**
```json
{
  "rate": 94.5
}
```

---

### POST `/api/v1/attendance/link-unregistered`
Vincular atleta no registrado a un perfil existente (migracion).

**Auth:** `requireAuth` + `requireRole(owner, super_admin, admin, school_admin)`

**Request Body:**
```json
{
  "unregisteredAthleteId": "uuid",
  "targetUserId": "uuid (opcional)",
  "targetChildId": "uuid (opcional)"
}
```

---

## 5. Ofertas y Planes

**Base:** `/api/v1/offerings`
**Archivo:** `bff/src/routes/offerings.ts`

### GET `/api/v1/offerings`
Listar ofertas con planes. Incluye conteo de inscritos.

**Auth:** `requireAuth`

**Query Params:** `type`, `active_only`

**Response (200):**
```json
{
  "offerings": [
    {
      "id": "uuid",
      "name": "Futbol Juvenil",
      "offering_type": "membership|session_pack|court_booking|tournament|single_session",
      "sport": "futbol",
      "is_active": true,
      "enrolled_count": 34,
      "plans": [
        {
          "id": "uuid",
          "name": "Plan Mensual",
          "max_sessions": 12,
          "duration_days": 30,
          "price": 220000,
          "currency": "COP",
          "auto_renew": true
        }
      ]
    }
  ]
}
```

---

### POST `/api/v1/offerings`
Crear oferta.

**Auth:** `requireAuth` + `requireRole(...)`

**Request Body:**
```json
{
  "name": "Futbol Juvenil",
  "description": "Programa para jovenes de 8-12 anos",
  "offering_type": "membership",
  "sport": "futbol",
  "branch_id": "uuid (opcional)",
  "metadata": {},
  "sort_order": 1
}
```

---

### GET `/api/v1/offerings/:id`
Obtener oferta con planes.

### PATCH `/api/v1/offerings/:id`
Actualizar oferta.

### DELETE `/api/v1/offerings/:id`
Eliminar oferta.

### POST `/api/v1/offerings/plans`
Crear plan bajo una oferta.

**Request Body:**
```json
{
  "offering_id": "uuid",
  "name": "Plan Mensual",
  "description": "12 sesiones al mes",
  "max_sessions": 12,
  "max_secondary_sessions": 4,
  "duration_days": 30,
  "price": 220000,
  "currency": "COP",
  "slot_duration_minutes": 60,
  "auto_renew": true,
  "metadata": {},
  "sort_order": 1
}
```

### PATCH `/api/v1/offerings/plans/:planId`
Actualizar plan.

### DELETE `/api/v1/offerings/plans/:planId`
Eliminar plan.

---

## 6. Session Bookings

**Base:** `/api/v1/sessions` y `/api/v1/session-bookings`
**Archivo:** `bff/src/routes/session-bookings.ts`

### GET `/api/v1/sessions/:id/availability`
Obtener disponibilidad y capacidad de una sesion.

**Auth:** `requireAuth`

**Response (200):**
```json
{
  "id": "uuid",
  "max_capacity": 20,
  "current_bookings": 15,
  "available_spots": 5,
  "is_full": false
}
```

---

### POST `/api/v1/sessions/:id/book`
Reservar atleta en una sesion.

**Auth:** `requireAuth`

**Request Body:**
```json
{
  "enrollment_id": "uuid",
  "user_id": "uuid (opcional)",
  "child_id": "uuid (opcional)",
  "is_secondary": false,
  "booking_type": "reservation|drop_in|walk_in"
}
```

---

### GET `/api/v1/sessions/:id/bookings`
Listar reservas de una sesion (enriquecido con datos de atleta/plan).

**Auth:** `requireAuth` + `requireRole(owner, admin, school_admin, coach)`

---

## 7. Contexto de Escuela

**Base:** `/api/v1/school/context`
**Archivo:** `bff/src/routes/school-context.ts`

### GET `/api/v1/school/context`
Obtener modulos activos y features de la escuela.

**Auth:** `requireAuth`

**Response (200):**
```json
{
  "active_modules": ["attendance", "payments", "offerings", "reports"],
  "features": {
    "selfBooking": true,
    "capacityCheck": true,
    "offeringPlans": true,
    "creditDeduction": true,
    "courtBooking": false,
    "tournamentMode": false,
    "billingEvents": true,
    "sportConfigs": true
  },
  "is_universal_mode": false,
  "sports": [
    { "sport": "futbol", "categorization_axis": "age", "settings": {} }
  ],
  "primary_sport": "futbol"
}
```

---

### PATCH `/api/v1/school/context/modules`
Actualizar modulos activos.

**Auth:** `requireAuth` (solo owner/admin/super_admin)

**Request Body:**
```json
{
  "active_modules": ["attendance", "payments", "offerings"]
}
```

---

## 8. Configuracion Deportiva

**Base:** `/api/v1/sport-configs`
**Archivo:** `bff/src/routes/sport-configs.ts`

### GET `/api/v1/sport-configs`
Listar configuraciones deportivas activas.

### GET `/api/v1/sport-configs/:sport`
Obtener configuracion de un deporte especifico.

### POST `/api/v1/sport-configs`
Crear o actualizar configuracion deportiva (upsert por school_id + sport).

**Auth:** `requireAuth` + `requireRole(owner, admin, school_admin)`

**Request Body:**
```json
{
  "sport": "futbol",
  "categorization_axis": "age|weight|belt|level|division|none",
  "rules": [{ "..." : "..." }],
  "settings": {}
}
```

---

## 9. Eventos de Facturacion

**Base:** `/api/v1/billing-events`
**Archivo:** `bff/src/routes/billing-events.ts`

### GET `/api/v1/billing-events`
Listar eventos de facturacion.

**Auth:** `requireAuth`

**Query Params:** `enrollment_id`, `status`, `limit`

**Response (200):**
```json
{
  "billing_events": [
    {
      "id": "uuid",
      "enrollment_id": "uuid",
      "event_type": "charge|partial|refund|late_fee|adjustment",
      "amount_due": 220000,
      "amount_paid": 220000,
      "status": "paid|pending|overdue|cancelled",
      "due_date": "2026-02-01",
      "paid_date": "2026-01-30",
      "gateway": "wompi",
      "gateway_reference": "ref123"
    }
  ]
}
```

---

### POST `/api/v1/billing-events`
Crear evento de facturacion.

**Auth:** `requireAuth` + `requireRole(owner, admin, school_admin)`

**Request Body:**
```json
{
  "enrollment_id": "uuid",
  "offering_plan_id": "uuid (opcional)",
  "event_type": "charge|partial|refund|late_fee|adjustment",
  "amount_due": 220000,
  "amount_paid": 0,
  "late_fee_amount": 0,
  "currency": "COP",
  "due_date": "2026-02-01",
  "parent_event_id": "uuid (opcional)",
  "installment_number": 1,
  "payment_id": "uuid (opcional)",
  "gateway": "wompi|epayco|manual",
  "gateway_reference": "ref123",
  "notes": "Mensualidad febrero"
}
```

---

### PATCH `/api/v1/billing-events/:id`
Actualizar evento de facturacion.

**Auth:** `requireAuth` + `requireRole(owner, admin, school_admin)`

**Request Body:**
```json
{
  "amount_paid": 220000,
  "late_fee_amount": 0,
  "status": "paid",
  "paid_date": "2026-01-30",
  "payment_id": "uuid",
  "gateway": "wompi",
  "gateway_reference": "ref123",
  "notes": "Pago confirmado"
}
```

---

## 10. Reportes

**Base:** `/api/v1/reports`
**Archivo:** `bff/src/routes/reports.ts`

### GET `/api/v1/reports/school/summary`
Obtener resumen de la escuela: ocupacion, crecimiento, ingresos por concepto.

**Auth:** `requireAuth` + `requireRole(owner, super_admin, admin, auditor, reporter, school_admin)`

**Query Params:** `branch_id` (opcional)

**Response (200):**
```json
{
  "summary": {
    "occupancyRate": 85.5,
    "totalStudents": 87,
    "totalCapacity": 102,
    "netGrowthThisMonth": 5,
    "occupancyData": [
      { "name": "Sede Norte", "occupied": 45, "vacant": 5, "total_capacity": 50 }
    ],
    "growthData": [
      { "month": "2026-01", "nuevos": 12, "retiros": 2 }
    ],
    "revenueData": [
      { "name": "Mensualidades", "value": 15000000 },
      { "name": "Inscripciones", "value": 2000000 }
    ]
  }
}
```

---

## 11. Pagos (ePayco)

**Base:** `/api/v1/payments`
**Archivo:** `bff/src/routes/epayco.ts`

**Rate Limit:** 20 requests por minuto

### POST `/api/v1/payments/create-session`
Crear sesion de pago ePayco.

**Auth:** `requireAuth` + `requireRole(owner, admin, school_admin, parent, athlete)`

**Request Body:**
```json
{
  "paymentId": "uuid",
  "enrollmentId": "uuid (opcional)"
}
```

**Response (201):**
```json
{
  "sessionId": "temp_session_id"
}
```

---

## 12. Webhooks

### POST `/api/v1/webhooks/epayco`
Webhook de confirmacion ePayco. Sin autenticacion (validacion por firma).

**Archivo:** `bff/src/routes/epayco-webhook.ts`

### POST `/api/v1/webhooks/wompi`
Webhook de confirmacion Wompi. Sin autenticacion (validacion por firma).

**Archivo:** `bff/src/routes/wompi.ts`

---

## 13. Explorar

**Base:** `/api/explorar`
**Archivo:** `bff/src/routes/explorar.routes.ts`
**Auth:** Publico (sin autenticacion)

### GET `/api/explorar`
Busqueda publica con filtros.

**Query Params:**
| Param | Tipo | Descripcion |
|-------|------|-------------|
| `query` | string | Busqueda por texto |
| `city` | string | Filtrar por ciudad |
| `sport` | string | Filtrar por deporte |
| `price_max` | number | Precio maximo |
| `rating_min` | number | Rating minimo |
| `age` | number | Edad del atleta |
| `verified` | boolean | Solo verificados |
| `open_now` | boolean | Abiertas ahora |
| `lat` | number | Latitud |
| `lng` | number | Longitud |
| `distance_km` | number | Radio en km |
| `order_by` | string | Ordenamiento |
| `page` | number | Pagina |
| `limit` | number | Resultados por pagina |

---

### GET `/api/explorar/cerca`
Escuelas/ofertas cercanas por geolocalizacion.

**Query Params:** `lat`, `lng`, `radius_km`

---

### GET `/api/explorar/:id`
Detalle de una escuela u oferta.

---

### GET `/api/explorar/meta/categorias`
Listar categorias/deportes disponibles.

---

## 14. Favoritos

**Base:** `/api/favoritos`
**Archivo:** `bff/src/routes/favoritos.routes.ts`
**Auth:** `requireBasicAuth` (token sin contexto de escuela)

### GET `/api/favoritos`
Listar IDs de escuelas favoritas del usuario.

**Response (200):**
```json
{
  "school_ids": ["uuid1", "uuid2"]
}
```

---

### POST `/api/favoritos/toggle`
Alternar estado de favorito.

**Request Body:**
```json
{
  "school_id": "uuid"
}
```

**Response (200):**
```json
{
  "favorited": true
}
```

---

### POST `/api/favoritos/migrate`
Migrar favoritos anonimos al usuario autenticado despues de login.

**Request Body:**
```json
{
  "school_ids": ["uuid1", "uuid2"]
}
```

---

## 15. Staff de Escuela

**Base:** `/api/v1/school-staff`
**Archivo:** `bff/src/routes/school-staff.ts`
**Auth:** `requireAuth`

### GET `/api/v1/school-staff`
Listar todo el staff de la escuela.

### GET `/api/v1/school-staff/:id`
Obtener un miembro del staff.

### POST `/api/v1/school-staff`
Crear miembro del staff. Sincroniza `coach_auth_id` automaticamente.

**Request Body:**
```json
{
  "full_name": "Carlos Rodriguez",
  "email": "carlos@escuela.com",
  "phone": "+573001234567",
  "specialty": "Futbol",
  "certifications": "Licencia UEFA B",
  "branch_id": "uuid",
  "status": "active"
}
```

### PATCH `/api/v1/school-staff/:id`
Actualizar miembro del staff.

### DELETE `/api/v1/school-staff/:id`
Eliminar miembro del staff.

---

## 16. Eventos Deportivos

**Base:** `/api/v1/events`
**Archivo:** `bff/src/routes/events.route.ts`

### GET `/api/v1/events`
Listar eventos publicos publicados. Sin autenticacion.

**Query Params:** `sport`, `city`, `limit`, `offset`

**Response (200):**
```json
[
  {
    "id": "uuid",
    "title": "Torneo Interescolar 2026",
    "sport": "futbol",
    "description": "...",
    "event_date": "2026-06-15",
    "city": "Bogota",
    "slug": "torneo-interescolar-2026",
    "image_url": "https://...",
    "banner_url": "https://...",
    "status": "published",
    "visibility": "public"
  }
]
```

---

### GET `/api/v1/events/mine`
Listar eventos del organizador autenticado.

**Auth:** `requireAuth` + `requireRole(organizer)`

---

### POST `/api/v1/events`
Crear evento.

**Auth:** `requireAuth` + `requireRole(organizer)`

---

### GET `/api/v1/events/:id/preview`
Vista previa del evento (solo el organizador dueno).

**Auth:** `requireAuth` + `requireRole(organizer)`

---

### POST `/api/v1/events/:id/publish`
Publicar evento. Solo organizadores verificados.

**Auth:** `requireAuth` + `requireRole(organizer)`

---

### PUT `/api/v1/events/:id`
Actualizar evento.

**Auth:** `requireAuth` + `requireRole(organizer)`

---

### PATCH `/api/v1/events/:id/status`
Cambiar estado del evento.

**Auth:** `requireAuth` + `requireRole(organizer)`

---

### GET `/api/v1/events/:id/delegations`
Listar delegaciones inscritas en el evento.

**Auth:** `requireAuth` + `requireRole(organizer)`

---

### PATCH `/api/v1/events/:id/delegations/:delegationId`
Actualizar estado de una delegacion (aprobar/rechazar).

**Auth:** `requireAuth` + `requireRole(organizer)`

---

### GET `/api/v1/events/:id/documents`
Obtener documentos de identidad de atletas inscritos en el evento.

**Auth:** `requireAuth` + `requireRole(organizer)`

---

## 17. Organizadores

**Base:** `/api/v1/organizer`
**Archivo:** `bff/src/routes/organizers.route.ts`
**Auth:** `requireAuth` + `requireRole(organizer)`

### POST `/api/v1/organizer/profile`
Crear perfil de organizador.

**Request Body:**
```json
{
  "organization_name": "Liga Deportiva Nacional",
  "nit": "900123456-7",
  "city": "Bogota",
  "sports": ["futbol", "baloncesto"],
  "bio": "Organizamos los mejores torneos...",
  "logo_url": "https://...",
  "payment_methods": { "bank": true, "online": true },
  "bank_data": { "bank": "Bancolombia", "account": "1234567890", "type": "ahorros" },
  "verification_doc_url": "https://...",
  "qr_smart_enabled": true
}
```

---

### PUT `/api/v1/organizer/profile`
Actualizar perfil de organizador.

---

### GET `/api/v1/organizer/stats`
Obtener estadisticas del dashboard del organizador.

---

### GET `/api/v1/organizer/finances`
Obtener finanzas del organizador (ingresos, comisiones).

---

## 18. Delegaciones de Escuela

**Base:** `/api/v1/school/delegations`
**Archivo:** `bff/src/routes/school-delegations.route.ts`
**Auth:** `requireAuth` + `requireRole(school)`

### GET `/api/v1/school/delegations`
Listar delegaciones de la escuela a eventos.

**Response (200):**
```json
[
  {
    "id": "uuid",
    "event_id": "uuid",
    "status": "pending|approved|rejected",
    "total_amount": 500000,
    "paid_amount": 250000,
    "created_at": "2026-04-01T10:00:00Z",
    "team_count": 2,
    "athlete_count": 24,
    "event": {
      "title": "Torneo Interescolar 2026",
      "event_date": "2026-06-15"
    }
  }
]
```

---

### GET `/api/v1/school/delegations/:id`
Obtener detalle de delegacion con equipos y atletas.

---

## 19. Templates

**Base:** `/api/v1/templates`
**Archivo:** `bff/src/routes/templates.ts`
**Auth:** `requireAuth` + `requireRole(owner, admin, school_admin, school)`

### POST `/api/v1/templates/render`
Renderizar plantilla de pago (WhatsApp/email).

**Request Body:**
```json
{
  "payment_id": "uuid",
  "template_type": "payment_reminder",
  "channel": "whatsapp|email",
  "template_id": "uuid (opcional)"
}
```

**Response (200):**
```json
{
  "message": "Hola Maria, te recordamos que tienes un pago pendiente de $220,000..."
}
```

---

### POST `/api/v1/templates/render-batch`
Renderizar plantillas para multiples pagos.

**Request Body:**
```json
{
  "payment_ids": ["uuid1", "uuid2", "uuid3"],
  "template_type": "payment_reminder",
  "channel": "whatsapp|email"
}
```

**Response (200):**
```json
{
  "results": [
    { "paymentId": "uuid1", "success": true, "message": "Hola Maria..." },
    { "paymentId": "uuid2", "success": true, "message": "Hola Pedro..." },
    { "paymentId": "uuid3", "success": false, "error": "Pago no encontrado" }
  ]
}
```

---

## 20. Encuestas

**Base:** `/api/v1/polls`
**Archivo:** `bff/src/routes/polls.ts`

### GET `/api/v1/polls`
Listar encuestas.

**Auth:** `requireAuth` + `requireRole(coach, staff, school_admin)`

---

### POST `/api/v1/polls`
Crear encuesta de confirmacion de asistencia.

**Auth:** `requireAuth` + `requireRole(coach, staff, school_admin)`

---

### GET `/api/v1/polls/:pollId/results`
Obtener resultados de encuesta.

### PATCH `/api/v1/polls/:pollId/close`
Cerrar encuesta.

### DELETE `/api/v1/polls/:pollId`
Eliminar encuesta.

---

### POST `/api/v1/polls/:pollId/sessions/:sessionId/confirmations`
Agregar confirmacion manual.

### PATCH `/api/v1/polls/:pollId/sessions/:sessionId/confirmations/:bookingId`
Actualizar confirmacion.

### DELETE `/api/v1/polls/:pollId/sessions/:sessionId/confirmations/:bookingId`
Eliminar confirmacion.

---

### GET `/api/v1/polls/:pollId/public`
Obtener encuesta para votacion publica. Sin autenticacion.

### POST `/api/v1/polls/:pollId/confirm`
Confirmar asistencia en encuesta. Sin autenticacion.

---

## 21. Marketplace

**Base:** `/api/v1/marketplace`
**Archivo:** `bff/src/routes/marketplace.routes.ts`
**Auth:** `optionalAuth` (permite navegacion anonima, personaliza para usuarios logueados)

### GET `/api/v1/marketplace`
Busqueda unificada de productos y servicios.

**Query Params:**
| Param | Tipo | Descripcion |
|-------|------|-------------|
| `q` | string | Busqueda por texto |
| `type` | string | `all`, `product`, `service` |
| `category` | string | Categoria |
| `city` | string | Ciudad |
| `price_max` | number | Precio maximo |
| `service_type` | string | Tipo de servicio |
| `page` | number | Pagina |
| `limit` | number | Resultados por pagina |
| `order_by` | string | Ordenamiento |

---

### GET `/api/v1/marketplace/products/:id`
Detalle de producto con variantes y vendedor.

---

### GET `/api/v1/marketplace/services/:id`
Detalle de servicio con variaciones y vendedor.

---

## 22. Vendor

**Base:** `/api/v1/vendor`
**Archivo:** `bff/src/routes/vendor.routes.ts`
**Auth:** `requireMarketplaceAuth` (vendedores autenticados, sin contexto de escuela)

### GET `/api/v1/vendor/profile`
Obtener perfil del vendedor.

### POST `/api/v1/vendor/profile`
Crear perfil de vendedor (onboarding).

**Request Body:**
```json
{
  "display_name": "Tienda Equipate Mas",
  "description": "Articulos deportivos de calidad",
  "city": "Bogota",
  "address": "Calle 72 #10-34",
  "phone": "+573001234567",
  "email": "ventas@equipate.com",
  "nit": "900123456-7",
  "website_url": "https://equipate.com",
  "vendor_type": "store|individual"
}
```

### PUT `/api/v1/vendor/profile`
Actualizar perfil de vendedor.

---

### GET `/api/v1/vendor/products`
Listar productos del vendedor.

### POST `/api/v1/vendor/products`
Crear producto.

### PATCH `/api/v1/vendor/products/:id`
Actualizar producto.

### DELETE `/api/v1/vendor/products/:id`
Eliminar producto.

---

### GET `/api/v1/vendor/services`
Listar servicios del vendedor.

### POST `/api/v1/vendor/services`
Crear servicio.

### PATCH `/api/v1/vendor/services/:id`
Actualizar servicio.

### DELETE `/api/v1/vendor/services/:id`
Eliminar servicio.

---

## 23. Ordenes del Marketplace

**Base:** `/api/v1/marketplace/orders`
**Archivo:** `bff/src/routes/marketplace-orders.routes.ts`
**Auth:** `requireAuth`
**Rate Limit:** 20 requests por minuto

### GET `/api/v1/marketplace/orders`
Listar ordenes del usuario.

**Query Params:** `status`

### POST `/api/v1/marketplace/orders`
Crear orden desde el carrito.

**Request Body:**
```json
{
  "items": [
    { "product_id": "uuid", "quantity": 2, "variant_id": "uuid (opcional)" },
    { "service_id": "uuid", "variation_id": "uuid (opcional)" }
  ]
}
```

### GET `/api/v1/marketplace/orders/:id`
Detalle de orden.

### PATCH `/api/v1/marketplace/orders/:id`
Actualizar estado de orden.

---

## 24. Entrenador Personal

**Base:** `/api/v1/trainer`
**Archivos:** `bff/src/routes/trainer/profile.ts`, `bff/src/routes/trainer/onboarding.ts`, `bff/src/routes/trainer/workspace.ts`, `bff/src/routes/trainer/clients.ts`, `bff/src/routes/trainer/routines.ts`
**Auth:** `requireTrainerAuth` (middleware especial para entrenadores personales)

### GET `/api/v1/trainer/profile`
Obtener perfil del entrenador autenticado.

### PUT `/api/v1/trainer/profile`
Actualizar perfil.

**Request Body:**
```json
{
  "display_name": "Carlos Rodriguez",
  "tagline": "Entrenador personal certificado",
  "bio": "10 anos de experiencia...",
  "avatar_url": "https://...",
  "cover_image_url": "https://...",
  "primary_sport": "futbol",
  "secondary_sports": ["atletismo", "natacion"],
  "specialties": ["fuerza", "resistencia"],
  "experience_years": 10,
  "certifications": ["NSCA-CPT", "ACE"],
  "gallery_urls": ["https://..."],
  "rate_per_session": 80000,
  "rate_currency": "COP",
  "rate_notes": "Sesion de 60 minutos",
  "city": "Bogota",
  "address": "Parque Simon Bolivar",
  "lat": 4.658,
  "lng": -74.093,
  "modality": "presencial|virtual|ambos",
  "instagram_url": "https://instagram.com/carlostrainer",
  "whatsapp_number": "+573001234567"
}
```

### POST `/api/v1/trainer/profile/publish`
Publicar perfil del entrenador (hacerlo visible publicamente).

---

Rutas adicionales del trainer:
- **Onboarding:** flujo de configuracion inicial
- **Workspace:** gestion del espacio de trabajo
- **Clients:** gestion de clientes
- **Routines:** gestion de rutinas y clases

---

## 25. Sistema

**Base:** `/api/v1/system`
**Archivo:** `bff/src/routes/system.ts`

### POST `/api/v1/system/cleanup`
Trigger manual para limpieza de sesiones y refresh de salud.

**Auth:** `requireAuth` + `requireRole(admin, super_admin)`

**Response (200):**
```json
{
  "ok": true,
  "summary": {
    "sessions_finalized": 3,
    "school_count": 12
  },
  "message": "Cleanup completado"
}
```

---

## 26. OG Preview

**Base:** `/share`
**Archivo:** `bff/src/routes/og-preview.routes.ts`
**Auth:** Publico

### GET `/share?type=school&id=:schoolId`
Generar meta tags OG para compartir escuela en redes sociales.

### GET `/share?type=event&id=:eventId`
Generar meta tags OG para compartir evento en redes sociales.

**Response:** HTML con meta tags Open Graph.

---

## 27. Middleware y Seguridad

**Archivo:** `bff/src/middlewares/authMiddleware.ts`

### Funciones de middleware

| Middleware | Descripcion |
|-----------|-------------|
| `requireAuth` | Valida Bearer token via Supabase. Obtiene usuario de `school_members`. Sets: `req.user`, `req.schoolId`, `req.branchId`, `req.role` |
| `requireBasicAuth` | Validacion ligera de token sin contexto de escuela. Usado por favoritos |
| `requireRole(...roles)` | Verifica que el rol del usuario este en la lista permitida. Roles privilegiados (owner, super_admin, admin) siempre pasan |
| `requirePermission(...perms)` | Valida contra la matriz de permisos. El usuario debe tener AL MENOS uno de los permisos listados |
| `requireOwnership(table, param, field)` | Previene ataques IDOR. Verifica que el recurso pertenezca a la escuela o usuario |
| `requireMarketplaceAuth` | Para vendedores del marketplace. Lee rol desde `profiles` (no `school_members`) |
| `requireTrainerAuth` | Para entrenadores personales. Busca workspace en `schools` con `school_type = 'personal_trainer'` |
| `optionalAuth` | Auth opcional. No retorna 401 si no hay token. Permite navegacion anonima con personalizacion para logueados |
| `auditLog(...)` | Log de acciones relevantes a `security_audit_log`. Non-blocking |

### Roles del sistema

| Rol | Permisos clave |
|-----|---------------|
| `athlete` | dashboard, calendar:view, teams:view, stats:view, marketplace:browse |
| `parent` | + students:view, reports:view, appointments:create |
| `coach` | + calendar:create/edit/delete, teams:create/edit, students:edit, reports:create |
| `school` | + teams:delete, students:create/delete, finances:view/manage, products:create/edit |
| `school_admin` | Similar a school |
| `admin` / `super_admin` / `owner` | Acceso completo a todo |
| `organizer` | events:create/edit/delete, finances:view/manage |
| `wellness_professional` | services:create/edit/delete, appointments:view/create/manage, health_records |
| `store_owner` | products:create/edit/delete, inventory:view/manage, orders:view/manage |
| `staff` | Permisos operativos basicos |
| `reporter` | reports:view (solo lectura) |

---

## 28. Rate Limiting

| Tipo | Limite | Aplica a |
|------|--------|----------|
| **General** | 200 requests / 15 minutos | Todas las rutas |
| **Pagos** | 20 requests / 1 minuto | `/api/v1/payments/*`, `/api/v1/marketplace/orders/*` |

---

## 29. Manejo de Errores

Formato estandar de error:

```json
{
  "error": "Descripcion del error"
}
```

### Codigos HTTP

| Status | Descripcion |
|--------|-------------|
| `200` | OK |
| `201` | Creado exitosamente |
| `400` | Error de validacion o datos invalidos |
| `401` | Token invalido, expirado o ausente |
| `403` | Sin permisos para esta accion / Rol no autorizado |
| `404` | Recurso no encontrado |
| `409` | Conflicto (duplicado, capacidad llena) |
| `422` | Datos validos pero logicamente incorrectos |
| `429` | Rate limit excedido |
| `500` | Error interno del servidor |

### Headers de seguridad

Todas las respuestas API incluyen:
```
Cache-Control: no-store
Pragma: no-cache
Expires: 0
```

### CORS

Origenes permitidos:
- `localhost` (desarrollo)
- `FRONTEND_URL` (produccion)
- Subdominios de `sportmaps.co`
- Preview branches de `vercel.app`

---

**Version:** 2.0.0
**Ultima actualizacion:** Abril 2026
**Fuente:** Codigo real del BFF en `bff/src/routes/`
